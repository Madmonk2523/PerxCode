import React, { useCallback, useState, useEffect } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { auth } from '../services/firebase';
import { logout } from '../services/authService';
import { loadWallet, buildInventory } from '../services/demoModeService';
import { loadProfilePrefs, saveProfilePrefs } from '../services/profilePrefsService';

const DEMO_ALLOWED_EMAIL = 'chasemallor@gmail.com';

function dayKeyFromReward(reward) {
  const raw = reward?.timestamp?.toDate ? reward.timestamp.toDate() : new Date(reward?.timestampMs || reward?.timestamp || Date.now());
  return raw.toISOString().slice(0, 10);
}

function calcStreak(rewards) {
  const keys = Array.from(new Set((Array.isArray(rewards) ? rewards : []).map(dayKeyFromReward))).sort().reverse();
  if (!keys.length) return 0;
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (keys.includes(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }
  return streak;
}

export default function ProfileScreen() {
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [avatarUri, setAvatarUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);
  const previewAnim = useState(() => new Animated.Value(0))[0];
  const user = auth.currentUser;
  const isDemoUser = (user?.email || '').trim().toLowerCase() === DEMO_ALLOWED_EMAIL;

  const refreshProfileData = useCallback(async () => {
    if (!isDemoUser) {
      setBalance(0);
      setRewards([]);
      setRedemptions([]);
      return;
    }

    const wallet = await loadWallet();
    setBalance(wallet.balance || 0);
    setRewards(wallet.claims || []);
    setRedemptions(wallet.redemptions || []);
  }, [isDemoUser]);

  useEffect(() => {
    if (!isDemoUser) {
      setBalance(0);
      setRewards([]);
      setLoading(false);
      return;
    }

    Promise.all([loadWallet(), loadProfilePrefs()])
      .then(([wallet, prefs]) => {
        setBalance(wallet.balance || 0);
        setRewards(wallet.claims || []);
        setRedemptions(wallet.redemptions || []);
        setAvatarUri(prefs.avatarUri || null);
      })
      .finally(() => setLoading(false));
  }, [isDemoUser, user]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const tick = async () => {
        if (!mounted) return;
        await refreshProfileData();
      };

      tick();
      const interval = setInterval(tick, 1000);

      return () => {
        mounted = false;
        clearInterval(interval);
      };
    }, [refreshProfileData])
  );

  const totalLocations = buildInventory(rewards).length;
  const streak = calcStreak(rewards);
  const memberSince = user?.metadata?.creationTime ? new Date(user.metadata.creationTime).getFullYear() : new Date().getFullYear();
  const totalClaims = rewards.length + redemptions.length;
  const totalRedeemed = redemptions.length;

  const achievements = [
    {
      id: 'first-claim',
      title: 'First Claim',
      subtitle: 'Claim your first PERX',
      unlocked: totalClaims >= 1,
    },
    {
      id: 'explorer',
      title: 'Explorer',
      subtitle: 'Claim at 5 locations',
      unlocked: totalLocations >= 5,
    },
    {
      id: 'on-fire',
      title: 'On Fire',
      subtitle: 'Maintain a 3-day streak',
      unlocked: streak >= 3,
    },
    {
      id: 'spender',
      title: 'Redemption Pro',
      subtitle: 'Redeem 5 rewards',
      unlocked: totalRedeemed >= 5,
    },
  ];

  const saveAvatarFromUri = async (sourceUri) => {
    if (!sourceUri) return;
    setSavingAvatar(true);
    try {
      // Keep source URI directly; this avoids copy failures from provider URIs (e.g. ph://, content://).
      await saveProfilePrefs({ avatarUri: sourceUri });
      setAvatarUri(sourceUri);
    } catch {
      Alert.alert('Profile Photo', 'Could not save that photo. Please try again.');
    } finally {
      setSavingAvatar(false);
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to set your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    await saveAvatarFromUri(asset.uri);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow camera access to take a profile picture.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    await saveAvatarFromUri(asset.uri);
  };

  const onEditPhoto = () => {
    Alert.alert('Profile Picture', 'Choose how you want to set your picture.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose from Camera Roll', onPress: () => void pickFromLibrary() },
      { text: 'Take Photo', onPress: () => void takePhoto() },
    ]);
  };

  const openAvatarPreview = () => {
    if (!avatarUri) return;
    setAvatarPreviewVisible(true);
    previewAnim.setValue(0);
    Animated.spring(previewAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 16,
      stiffness: 170,
    }).start();
  };

  const closeAvatarPreview = () => {
    Animated.timing(previewAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => setAvatarPreviewVisible(false));
  };

  const onLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeLoading}>
        <ActivityIndicator color="#2563EB" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Profile</Text>

        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {avatarUri ? (
                <Pressable style={styles.avatarPressTarget} onPress={openAvatarPreview}>
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                </Pressable>
              ) : (
                <Text style={styles.avatarText}>{user?.email?.[0]?.toUpperCase() ?? 'P'}</Text>
              )}
            </View>
            <View style={styles.heroMeta}>
              <Text style={styles.email}>{user?.email ?? 'No email'}</Text>
              <Text style={styles.memberSince}>Member since {memberSince}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.photoBtn, savingAvatar && styles.photoBtnDisabled]}
            onPress={onEditPhoto}
            activeOpacity={0.85}
            disabled={savingAvatar}
          >
            <Text style={styles.photoBtnText}>{savingAvatar ? 'Saving...' : 'Edit Profile Picture'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          <View style={styles.tile}><Text style={styles.tileLabel}>Balance</Text><Text style={styles.tileValue}>{balance}</Text></View>
          <View style={styles.tile}><Text style={styles.tileLabel}>Streak</Text><Text style={styles.tileValue}>{streak}d</Text></View>
          <View style={styles.tile}><Text style={styles.tileLabel}>Locations</Text><Text style={styles.tileValue}>{totalLocations}</Text></View>
          <View style={styles.tile}><Text style={styles.tileLabel}>Redeemed</Text><Text style={styles.tileValue}>{totalRedeemed}</Text></View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Rules</Text>
          <Text style={styles.infoBody}>1. Enter a location radius to claim PERX automatically.</Text>
          <Text style={styles.infoBody}>2. Each location has a cooldown before you can claim there again.</Text>
          <Text style={styles.infoBody}>3. Open Wallet to redeem claimed PERX before expiration.</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Achievements</Text>
          {achievements.map((item) => (
            <View key={item.id} style={styles.achievementRow}>
              <View style={[styles.achievementDot, item.unlocked && styles.achievementDotUnlocked]} />
              <View style={styles.achievementMeta}>
                <Text style={[styles.achievementTitle, item.unlocked && styles.achievementTitleUnlocked]}>{item.title}</Text>
                <Text style={styles.achievementSub}>{item.subtitle}</Text>
              </View>
              <Text style={[styles.achievementState, item.unlocked && styles.achievementStateUnlocked]}>
                {item.unlocked ? 'Unlocked' : 'Locked'}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={avatarPreviewVisible} transparent animationType="none" onRequestClose={closeAvatarPreview}>
        <Pressable style={styles.previewBackdrop} onPress={closeAvatarPreview}>
          <Animated.View
            style={[
              styles.previewImageWrap,
              {
                opacity: previewAnim,
                transform: [
                  {
                    scale: previewAnim.interpolate({ inputRange: [0, 1], outputRange: [0.76, 1] }),
                  },
                ],
              },
            ]}
          >
            {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.previewImage} /> : null}
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0B0F' },
  safe: { flex: 1, backgroundColor: '#0B0B0F', paddingHorizontal: 20 },
  scrollContent: { paddingBottom: 28 },
  heading: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 8, marginBottom: 12 },
  heroCard: {
    borderRadius: 22,
    backgroundColor: '#131620',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
  },
  avatarWrap: { alignItems: 'center', flexDirection: 'row' },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPressTarget: {
    width: '100%',
    height: '100%',
  },
  avatarImage: { width: '100%', height: '100%' },
  heroMeta: { marginLeft: 12, flexShrink: 1 },
  avatarText: { color: '#fff', fontSize: 34, fontWeight: '800' },
  email: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  memberSince: { color: '#93C5FD', marginTop: 3, fontSize: 12, fontWeight: '600' },
  photoBtn: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.5)',
    backgroundColor: 'rgba(37,99,235,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtnDisabled: { opacity: 0.75 },
  photoBtnText: { color: '#DBEAFE', fontWeight: '800', fontSize: 13 },
  grid: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: {
    width: '48%',
    borderRadius: 20,
    backgroundColor: '#131620',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  tileLabel: { color: '#9CA3AF', fontSize: 12 },
  tileValue: { color: '#fff', fontWeight: '800', fontSize: 28, marginTop: 6 },

  infoCard: {
    borderRadius: 20,
    marginTop: 14,
    backgroundColor: '#121822',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    padding: 14,
  },
  infoTitle: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  infoBody: { color: '#CBD5E1', marginTop: 6, lineHeight: 19 },
  achievementRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: 9,
    marginTop: 9,
  },
  achievementDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#64748B',
  },
  achievementDotUnlocked: { backgroundColor: '#22C55E' },
  achievementMeta: { marginLeft: 10, flex: 1 },
  achievementTitle: { color: '#E2E8F0', fontWeight: '700', fontSize: 13 },
  achievementTitleUnlocked: { color: '#DCFCE7' },
  achievementSub: { color: '#94A3B8', marginTop: 2, fontSize: 12 },
  achievementState: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  achievementStateUnlocked: { color: '#22C55E' },

  logoutBtn: {
    marginTop: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.6)',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(248,113,113,0.08)',
  },
  logoutText: { color: '#F87171', fontWeight: '700', fontSize: 15 },

  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,6,12,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  previewImageWrap: {
    width: '100%',
    maxWidth: 380,
    aspectRatio: 1,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
});
