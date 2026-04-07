import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  setDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { loadLocalRewards, saveLocalRewards } from './localStorageService';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// ─── User ─────────────────────────────────────────────────────────────────────

/**
 * Fetch the Firestore user document once.
 */
export async function getUserDocument(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  return null;
}

/**
 * Subscribe to real-time changes on the user document.
 * Returns an unsubscribe function.
 */
export function subscribeToUser(uid, callback) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    }
  });
}

// ─── Rewards ──────────────────────────────────────────────────────────────────

/**
 * Fetch all rewards for a user, sorted newest first.
 * Avoids composite index by sorting client-side.
 */
export async function fetchRewards(uid) {
  const local = await loadLocalRewards(uid);

  try {
    const q = query(collection(db, 'rewards'), where('userId', '==', uid));
    const snap = await getDocs(q);
    const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const merged = mergeRewards(remote, local);
    await saveLocalRewards(uid, serializeRewardsForStorage(merged));
    return sortRewardsNewestFirst(merged);
  } catch {
    return sortRewardsNewestFirst(local);
  }
}

/**
 * Check whether the user earned a reward from this location in the last 24 hours.
 * Queries without orderBy to avoid requiring a composite Firestore index.
 */
export async function hasEarnedRecently(uid, locationId) {
  const now = Date.now();

  const local = await loadLocalRewards(uid);
  const localRecent = local.some((r) => {
    if (r.locationId !== locationId) return false;
    const ms = getRewardTimestampMs(r);
    return ms > 0 && now - ms < TWENTY_FOUR_HOURS_MS;
  });

  if (localRecent) return true;

  const q = query(
    collection(db, 'rewards'),
    where('userId', '==', uid),
    where('locationId', '==', locationId)
  );

  const snap = await getDocs(q);
  if (snap.empty) return false;

  const remoteRecent = snap.docs.some((d) => {
    const ms = getRewardTimestampMs(d.data());
    return ms > 0 && now - ms < TWENTY_FOUR_HOURS_MS;
  });

  if (remoteRecent) {
    const remoteRewards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const merged = mergeRewards(remoteRewards, local);
    await saveLocalRewards(uid, serializeRewardsForStorage(merged));
  }

  return remoteRecent;
}

/**
 * Write a reward document and atomically increment the user's token balance.
 * Uses setDoc with merge:true so the user doc is created if it somehow doesn't exist.
 */
export async function awardReward(uid, location) {
  const local = await loadLocalRewards(uid);

  // Write the reward history entry
  const rewardPayload = {
    userId: uid,
    locationId: location.id,
    locationName: location.name,
    amount: location.rewardValue,
    tokensEarned: location.rewardValue,
    timestamp: serverTimestamp(),
  };

  let newRewardId = `local-${Date.now()}`;
  try {
    const docRef = await addDoc(collection(db, 'rewards'), rewardPayload);
    newRewardId = docRef.id;

    // Atomically increment the balance — safe against concurrent writes
    await setDoc(
      doc(db, 'users', uid),
      { tokenBalance: increment(location.rewardValue) },
      { merge: true }
    );
  } catch {
    // If offline, we still keep local history. User balance syncs from Firestore when online.
  }

  const newLocalReward = {
    id: newRewardId,
    userId: uid,
    locationId: location.id,
    locationName: location.name,
    amount: location.rewardValue,
    tokensEarned: location.rewardValue,
    timestampMs: Date.now(),
  };

  const merged = mergeRewards([newLocalReward], local);
  await saveLocalRewards(uid, serializeRewardsForStorage(merged));
  return newLocalReward;
}

function getRewardTimestampMs(reward) {
  if (!reward) return 0;
  if (typeof reward.timestampMs === 'number') return reward.timestampMs;
  if (reward.timestamp?.toMillis) return reward.timestamp.toMillis();
  if (typeof reward.timestamp === 'number') return reward.timestamp;
  if (typeof reward.timestamp === 'string') {
    const parsed = Date.parse(reward.timestamp);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function normalizeReward(reward) {
  const tokens = reward.tokensEarned ?? reward.amount ?? 0;
  return {
    id: reward.id || `r-${Math.random().toString(36).slice(2, 9)}`,
    userId: reward.userId,
    locationId: reward.locationId,
    locationName: reward.locationName,
    amount: tokens,
    tokensEarned: tokens,
    timestamp: reward.timestamp,
    timestampMs: getRewardTimestampMs(reward),
  };
}

function mergeRewards(primary, secondary) {
  const map = new Map();

  [...secondary, ...primary].forEach((item) => {
    const reward = normalizeReward(item);
    const key = reward.id || `${reward.locationId}-${reward.timestampMs}`;
    map.set(key, reward);
  });

  return Array.from(map.values());
}

function sortRewardsNewestFirst(rewards) {
  return [...rewards].sort((a, b) => getRewardTimestampMs(b) - getRewardTimestampMs(a));
}

function serializeRewardsForStorage(rewards) {
  return rewards.map((reward) => ({
    id: reward.id,
    userId: reward.userId,
    locationId: reward.locationId,
    locationName: reward.locationName,
    amount: reward.amount ?? reward.tokensEarned ?? 0,
    tokensEarned: reward.tokensEarned ?? reward.amount ?? 0,
    timestampMs: getRewardTimestampMs(reward),
  }));
}
