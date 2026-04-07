import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPLORED_KEY = 'perx_explored_v1';
const LOCAL_REWARDS_KEY = (uid) => `perx_rewards_${uid}`;

export async function loadExploredPoints() {
  try {
    const raw = await AsyncStorage.getItem(EXPLORED_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

export async function saveExploredPoints(points) {
  try {
    await AsyncStorage.setItem(EXPLORED_KEY, JSON.stringify(points));
  } catch {
    // Ignore local cache failures.
  }
}

export async function loadLocalRewards(uid) {
  if (!uid) return [];
  try {
    const raw = await AsyncStorage.getItem(LOCAL_REWARDS_KEY(uid));
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

export async function saveLocalRewards(uid, rewards) {
  if (!uid) return;
  try {
    await AsyncStorage.setItem(LOCAL_REWARDS_KEY(uid), JSON.stringify(rewards));
  } catch {
    // Ignore local cache failures.
  }
}
