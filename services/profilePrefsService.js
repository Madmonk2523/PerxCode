import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_PREFS_KEY = 'perx_profile_prefs_v1';

function createDefaultPrefs() {
  return {
    avatarUri: null,
  };
}

export async function loadProfilePrefs() {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_PREFS_KEY);
    if (!raw) return createDefaultPrefs();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createDefaultPrefs();

    return {
      ...createDefaultPrefs(),
      ...parsed,
    };
  } catch {
    return createDefaultPrefs();
  }
}

export async function saveProfilePrefs(nextPrefs) {
  const current = await loadProfilePrefs();
  const merged = {
    ...current,
    ...(nextPrefs || {}),
  };
  await AsyncStorage.setItem(PROFILE_PREFS_KEY, JSON.stringify(merged));
  return merged;
}
