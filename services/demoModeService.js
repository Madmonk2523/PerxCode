import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const DEMO_MODE_KEY = 'perx_demo_mode_v1';
const DEMO_WALLET_KEY = 'perx_demo_wallet_v1';
const DEMO_ANCHOR_KEY = 'perx_demo_anchor_v1';
const SESSION_MAX = 25;
export const LOCATION_COOLDOWN_MS = 60 * 1000;

export const DEMO_CENTER = {
  latitude: 19.3206,
  longitude: -81.3845,
};

export const DEMO_RADIUS_METERS = 300;

const BASE_NAMES = [
  'Lobby Cafe',
  'Pool Bar',
  'Beach Grill',
  'Sushi Bar',
  'Ice Cream',
  'Gift Shop',
];

function metersToLatLng(center, eastMeters, northMeters) {
  const latDelta = northMeters / 111111;
  const lngDelta = eastMeters / (111111 * Math.cos((center.latitude * Math.PI) / 180));
  return {
    latitude: center.latitude + latDelta,
    longitude: center.longitude + lngDelta,
  };
}

export function buildWalkableDemoLocations(centerCoords = DEMO_CENTER) {
  const locations = [];
  for (let i = 0; i < 50; i += 1) {
    const ring = Math.floor(i / 10); // 0..4
    const step = i % 10;
    const radius = 26 + ring * 28 + (step % 2) * 6; // roughly 26m..146m
    const angle = ((step * 36 + ring * 11) * Math.PI) / 180;
    const east = Math.cos(angle) * radius;
    const north = Math.sin(angle) * radius;
    const coord = metersToLatLng(centerCoords, east, north);
    const base = BASE_NAMES[i % BASE_NAMES.length];
    locations.push({
      id: `demo_${String(i + 1).padStart(2, '0')}`,
      name: `${base} ${i + 1}`,
      reward: (i % 3) + 1,
      latitude: coord.latitude,
      longitude: coord.longitude,
      radiusMeters: 22,
    });
  }
  return locations;
}

let sessionClaimedLocationAt = new Map();
let sessionClaimTotal = 0;
let claimBatchInFlight = false;

function toRad(value) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(a, b) {
  const earthRadius = 6371e3;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return earthRadius * c;
}

export function isWithinRadius(userCoords, location) {
  if (!userCoords || !location) return false;
  return getDistanceMeters(userCoords, location) <= (location.radiusMeters || DEMO_RADIUS_METERS);
}

export function getDistanceToLocation(userCoords, location) {
  if (!userCoords || !location) return Infinity;
  return getDistanceMeters(userCoords, location);
}

export async function getUserLocation() {
  const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    latitude: current.coords.latitude,
    longitude: current.coords.longitude,
  };
}

export async function loadDemoMode() {
  try {
    const raw = await AsyncStorage.getItem(DEMO_MODE_KEY);
    if (raw == null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export async function setDemoMode(value) {
  await AsyncStorage.setItem(DEMO_MODE_KEY, value ? 'true' : 'false');
}

export async function saveDemoAnchorLocation(coords) {
  if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return;
  await AsyncStorage.setItem(DEMO_ANCHOR_KEY, JSON.stringify(coords));
}

export async function loadDemoAnchorLocation() {
  try {
    const raw = await AsyncStorage.getItem(DEMO_ANCHOR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null;
    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
    };
  } catch {
    return null;
  }
}

function createEmptyWallet() {
  return {
    balance: 0,
    claims: [],
    redemptions: [],
    expiredClaims: [],
  };
}

function computeWalletBalance(claims) {
  return (Array.isArray(claims) ? claims : []).reduce((sum, item) => sum + Number(item?.reward || 0), 0);
}

export async function loadWallet() {
  try {
    const raw = await AsyncStorage.getItem(DEMO_WALLET_KEY);
    if (!raw) return createEmptyWallet();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createEmptyWallet();
    if (!Array.isArray(parsed.claims)) parsed.claims = [];
    if (!Array.isArray(parsed.redemptions)) parsed.redemptions = [];
    if (!Array.isArray(parsed.expiredClaims)) parsed.expiredClaims = [];

    const now = Date.now();
    const activeClaims = [];
    const newlyExpired = [];
    for (const claim of parsed.claims) {
      const expiresAt = Number(claim?.expiresAt || 0);
      if (expiresAt > 0 && expiresAt <= now) {
        newlyExpired.push({
          ...claim,
          expiredAt: now,
        });
      } else {
        activeClaims.push(claim);
      }
    }

    parsed.claims = activeClaims;
    if (newlyExpired.length) {
      parsed.expiredClaims = [...newlyExpired, ...parsed.expiredClaims];
    }
    parsed.balance = computeWalletBalance(parsed.claims);

    if (newlyExpired.length) {
      await saveWallet(parsed);
    }

    return parsed;
  } catch {
    return createEmptyWallet();
  }
}

async function saveWallet(wallet) {
  await AsyncStorage.setItem(DEMO_WALLET_KEY, JSON.stringify(wallet));
}

export async function redeemWalletClaim(claimId) {
  if (!claimId) {
    return loadWallet();
  }

  const wallet = await loadWallet();
  const claims = Array.isArray(wallet.claims) ? wallet.claims : [];
  const index = claims.findIndex((item) => item?.id === claimId);

  if (index < 0) {
    return wallet;
  }

  const claim = claims[index];
  const nextClaims = [...claims.slice(0, index), ...claims.slice(index + 1)];

  const nextWallet = {
    ...wallet,
    balance: computeWalletBalance(nextClaims),
    claims: nextClaims,
    redemptions: [
      {
        ...claim,
        redeemedAt: Date.now(),
      },
      ...(Array.isArray(wallet.redemptions) ? wallet.redemptions : []),
    ],
  };

  await saveWallet(nextWallet);
  return nextWallet;
}

export async function redeemWalletLocation(locationId) {
  if (!locationId) {
    return loadWallet();
  }

  const wallet = await loadWallet();
  const claims = Array.isArray(wallet.claims) ? wallet.claims : [];
  const removed = claims.filter((item) => item?.locationId === locationId);

  if (!removed.length) {
    return wallet;
  }

  const nextClaims = claims.filter((item) => item?.locationId !== locationId);

  const nextWallet = {
    ...wallet,
    balance: computeWalletBalance(nextClaims),
    claims: nextClaims,
    redemptions: [
      ...removed.map((item) => ({
        ...item,
        redeemedAt: Date.now(),
      })),
      ...(Array.isArray(wallet.redemptions) ? wallet.redemptions : []),
    ],
  };

  await saveWallet(nextWallet);
  return nextWallet;
}

function createRewardCode() {
  return `PERX-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function updateWallet(claimItem) {
  const wallet = await loadWallet();
  const next = {
    ...wallet,
    balance: Number(wallet.balance || 0) + Number(claimItem.reward || 0),
    claims: [claimItem, ...wallet.claims],
  };
  await saveWallet(next);
  return next;
}

export async function claimReward({ location, userCoords, demoModeEnabled }) {
  if (!location) {
    return { ok: false, reason: 'invalid-location' };
  }

  const within = isWithinRadius(userCoords, location);
  if (!within) {
    return { ok: false, reason: 'outside-radius' };
  }

  const lastClaimAt = sessionClaimedLocationAt.get(location.id) || 0;
  const elapsed = Date.now() - lastClaimAt;
  if (elapsed < LOCATION_COOLDOWN_MS) {
    return {
      ok: false,
      reason: 'cooldown-active',
      cooldownRemainingMs: LOCATION_COOLDOWN_MS - elapsed,
    };
  }

  if (sessionClaimTotal >= SESSION_MAX) {
    return { ok: false, reason: 'session-max-reached' };
  }

  const allowedReward = Math.max(0, Math.min(location.reward, SESSION_MAX - sessionClaimTotal));
  if (allowedReward <= 0) {
    return { ok: false, reason: 'session-max-reached' };
  }

  const now = Date.now();
  const claimItem = {
    id: `${location.id}-${now}`,
    locationId: location.id,
    locationName: location.name,
    reward: allowedReward,
    code: createRewardCode(),
    claimedAt: now,
    expiresAt: now + 5 * 60 * 1000,
    demoMode: !!demoModeEnabled,
  };

  const wallet = await updateWallet(claimItem);
  sessionClaimedLocationAt.set(location.id, now);
  sessionClaimTotal += allowedReward;

  return {
    ok: true,
    claim: claimItem,
    wallet,
    session: {
      totalClaimed: sessionClaimTotal,
      remaining: Math.max(0, SESSION_MAX - sessionClaimTotal),
      claimedLocationIds: Array.from(sessionClaimedLocationAt.keys()).filter((id) => {
        const claimedAt = sessionClaimedLocationAt.get(id) || 0;
        return Date.now() - claimedAt < LOCATION_COOLDOWN_MS;
      }),
    },
  };
}

export async function claimNearbyRewards({ userCoords, locations, demoModeEnabled, maxClaimsPerPass = 5 }) {
  if (!userCoords || !Array.isArray(locations) || locations.length === 0) {
    return {
      claims: [],
      wallet: await loadWallet(),
      session: getSessionState(),
    };
  }

  if (claimBatchInFlight) {
    return {
      claims: [],
      wallet: await loadWallet(),
      session: getSessionState(),
    };
  }

  claimBatchInFlight = true;

  try {
    const claims = [];
    let wallet = await loadWallet();
    let session = getSessionState();

    for (const location of locations) {
      if (claims.length >= maxClaimsPerPass) break;
      if ((session?.remaining || 0) <= 0) break;

      const result = await claimReward({
        location,
        userCoords,
        demoModeEnabled,
      });

      if (!result?.ok) continue;
      claims.push(result.claim);
      wallet = result.wallet;
      session = result.session;
    }

    return { claims, wallet, session };
  } finally {
    claimBatchInFlight = false;
  }
}

export function getSessionState() {
  const now = Date.now();
  for (const [locationId, claimedAt] of sessionClaimedLocationAt.entries()) {
    if (now - claimedAt >= LOCATION_COOLDOWN_MS) {
      sessionClaimedLocationAt.delete(locationId);
    }
  }

  return {
    totalClaimed: sessionClaimTotal,
    remaining: Math.max(0, SESSION_MAX - sessionClaimTotal),
    claimedLocationIds: Array.from(sessionClaimedLocationAt.keys()),
  };
}

export function getLocationCooldownRemainingMs(locationId) {
  if (!locationId) return 0;
  const claimedAt = sessionClaimedLocationAt.get(locationId) || 0;
  if (!claimedAt) return 0;
  return Math.max(0, LOCATION_COOLDOWN_MS - (Date.now() - claimedAt));
}

export function buildInventory(claims) {
  const map = new Map();
  (Array.isArray(claims) ? claims : []).forEach((item) => {
    const key = item.locationId || item.locationName || 'unknown';
    const current = map.get(key);
    if (!current) {
      map.set(key, {
        id: key,
        locationId: item.locationId,
        locationName: item.locationName || 'Unknown',
        quantity: Number(item.reward || 0),
        claims: [item],
      });
      return;
    }
    current.quantity += Number(item.reward || 0);
    current.claims.push(item);
  });
  return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
}
