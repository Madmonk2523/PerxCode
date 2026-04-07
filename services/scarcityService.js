import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'perx_scarcity_v1';

function getDayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function loadScarcityState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { day: getDayKey(), remaining: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { day: getDayKey(), remaining: {} };
    return parsed;
  } catch {
    return { day: getDayKey(), remaining: {} };
  }
}

export async function ensureScarcityForLocations(locations) {
  const state = await loadScarcityState();
  const day = getDayKey();
  const fresh = state.day === day ? state : { day, remaining: {} };

  locations.forEach((loc) => {
    if (typeof fresh.remaining[loc.id] !== 'number') {
      fresh.remaining[loc.id] = Math.max(1, loc.maxClaimsPerDay || 8);
    }
  });

  await AsyncStorage.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}

export async function consumeLocationClaim(locationId) {
  const state = await loadScarcityState();
  const day = getDayKey();
  const normalized = state.day === day ? state : { day, remaining: {} };

  const current = normalized.remaining[locationId] ?? 0;
  normalized.remaining[locationId] = Math.max(0, current - 1);
  await AsyncStorage.setItem(KEY, JSON.stringify(normalized));
  return normalized.remaining[locationId];
}
