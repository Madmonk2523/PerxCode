import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import BottomSheetModal from '../components/BottomSheetModal';
import { auth } from '../services/firebase';
import {
  buildWalkableDemoLocations,
  claimNearbyRewards,
  DEMO_CENTER,
  getDistanceToLocation,
  getLocationCooldownRemainingMs,
  getSessionState,
  getUserLocation,
  isWithinRadius,
  loadDemoMode,
  loadWallet,
  saveDemoAnchorLocation,
  setDemoMode,
} from '../services/demoModeService';
import { PERX_MAP_STYLE } from '../constants/mapStyle';
import {
  ensurePerxNotificationPermission,
  sendPerxClaimNotifications,
  startBackgroundAutoClaim,
  stopBackgroundAutoClaim,
} from '../services/backgroundAutoClaimService';

const DEMO_ALLOWED_EMAIL = 'chasemallor@gmail.com';

function formatDistance(value) {
  if (!Number.isFinite(value)) return '--';
  if (value >= 1000) return `${(value / 1000).toFixed(1)} km away`;
  return `${Math.round(value)}m away`;
}

function formatCooldown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const min = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const sec = String(totalSeconds % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function DemoMarker({ active, withinRadius, claimed }) {
  return (
    <View style={styles.markerWrap}>
      <View
        style={[
          styles.markerPulse,
          active && styles.markerPulseActive,
          withinRadius && styles.markerPulseInside,
          claimed && styles.markerPulseClaimed,
        ]}
      />
      <View
        style={[
          styles.markerCore,
          active && styles.markerCoreActive,
          withinRadius && styles.markerCoreInside,
          claimed && styles.markerCoreClaimed,
        ]}
      />
    </View>
  );
}

export default function MapScreen() {
  const currentUserEmail = (auth.currentUser?.email || '').trim().toLowerCase();
  const demoAllowed = currentUserEmail === DEMO_ALLOWED_EMAIL;

  const [userLocation, setUserLocation] = useState(null);
  const [anchorLocation, setAnchorLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [demoModeOn, setDemoModeOn] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [claimedThisSession, setClaimedThisSession] = useState([]);
  const [sessionRemaining, setSessionRemaining] = useState(5);
  const [autoClaiming, setAutoClaiming] = useState(false);
  const [lastClaim, setLastClaim] = useState(null);
  const [teleportArmed, setTeleportArmed] = useState(false);

  const mapRef = useRef(null);
  const watchRef = useRef(null);
  const demoOverrideUntilRef = useRef(0);
  const demoModeOnRef = useRef(false);
  const isMountedRef = useRef(true);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const autoClaimLockRef = useRef(false);

  const markerPoints = useMemo(
    () => buildWalkableDemoLocations(anchorLocation || DEMO_CENTER),
    [anchorLocation]
  );

  const startLocationTracking = useCallback(async () => {
    setLoadingLocation(true);
    setPermissionDenied(false);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (!isMountedRef.current) {
        return false;
      }

      if (status !== 'granted') {
        setPermissionDenied(true);
        setLoadingLocation(false);
        return false;
      }

      const first = await getUserLocation();

      if (!isMountedRef.current) {
        return false;
      }

      setAnchorLocation(first);
      saveDemoAnchorLocation(first).catch(() => {});
      setUserLocation(first);
      setLoadingLocation(false);

      ensurePerxNotificationPermission().catch(() => {});
      startBackgroundAutoClaim().catch(() => {});

      watchRef.current?.remove();
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 2500, distanceInterval: 2 },
        (update) => {
          if (!isMountedRef.current) return;
          if (demoModeOnRef.current && Date.now() < demoOverrideUntilRef.current) return;
          setUserLocation({ latitude: update.coords.latitude, longitude: update.coords.longitude });
        }
      );

      return true;
    } catch {
      setPermissionDenied(true);
      setLoadingLocation(false);
      return false;
    }
  }, []);

  const promptEnableLocation = async () => {
    const granted = await startLocationTracking();
    if (granted) return;

    Alert.alert(
      'Turn Location On',
      'Location is required to use this app. Please enable location permission and try again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings();
          },
        },
      ]
    );
  };

  useEffect(() => {
    loadDemoMode().then((savedValue) => {
      setDemoModeOn(demoAllowed ? savedValue : false);
    });
    loadWallet().then((wallet) => setWalletBalance(wallet.balance || 0));
    const state = getSessionState();
    setClaimedThisSession(state.claimedLocationIds);
    setSessionRemaining(state.remaining);
  }, [demoAllowed]);

  useEffect(() => {
    demoModeOnRef.current = demoModeOn;
  }, [demoModeOn]);

  useEffect(() => {
    isMountedRef.current = true;

    startLocationTracking().catch(() => setLoadingLocation(false));

    return () => {
      isMountedRef.current = false;
      watchRef.current?.remove();
    };
  }, [startLocationTracking]);

  useEffect(() => {
    const timer = setInterval(() => {
      const state = getSessionState();
      const nextIds = state.claimedLocationIds || [];
      setClaimedThisSession((prev) => {
        if (prev.length === nextIds.length && prev.every((id, index) => id === nextIds[index])) {
          return prev;
        }
        return nextIds;
      });
      setSessionRemaining((prev) => {
        const next = state.remaining || 0;
        return prev === next ? prev : next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (demoModeOn) {
      startBackgroundAutoClaim().catch(() => {});
      return;
    }
    stopBackgroundAutoClaim().catch(() => {});
  }, [demoModeOn]);

  const runAutoClaim = useCallback(
    async (coords) => {
      if (!coords || autoClaimLockRef.current) return;
      autoClaimLockRef.current = true;
      setAutoClaiming(true);

      try {
        const result = await claimNearbyRewards({
          userCoords: coords,
          locations: markerPoints,
          demoModeEnabled: demoModeOn,
          maxClaimsPerPass: 3,
        });

        if (!result.claims.length) return;

        setWalletBalance(result.wallet.balance || 0);
        setClaimedThisSession(result.session.claimedLocationIds || []);
        setSessionRemaining(result.session.remaining || 0);

        if (result.claims.length === 1) {
          const claim = result.claims[0];
          showToast(`Auto-claimed ${claim.locationName}: +$${claim.reward}`);
        } else {
          const total = result.claims.reduce((sum, item) => sum + Number(item.reward || 0), 0);
          showToast(`Auto-claimed ${result.claims.length} PERX spots: +$${total}`);
        }

        sendPerxClaimNotifications(result.claims, { source: 'foreground' }).catch(() => {});

        successAnim.setValue(0);
        Animated.sequence([
          Animated.timing(successAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.delay(900),
          Animated.timing(successAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start();
      } finally {
        setAutoClaiming(false);
        autoClaimLockRef.current = false;
      }
    },
    [demoModeOn, markerPoints, successAnim]
  );

  useEffect(() => {
    if (!userLocation) return;
    runAutoClaim(userLocation).catch(() => {});
  }, [runAutoClaim, userLocation]);

  useEffect(() => {
    if (!userLocation) return;

    const interval = setInterval(() => {
      runAutoClaim(userLocation).catch(() => {});
    }, 1200);

    return () => clearInterval(interval);
  }, [runAutoClaim, userLocation]);

  const showToast = (message) => {
    setLastClaim({ message, id: Date.now() });
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const onSelectLocation = (location) => {
    setSelectedLocation(location);
    setSheetVisible(true);
    setTeleportArmed(false);

    if (mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: { latitude: location.latitude, longitude: location.longitude },
          zoom: 16.5,
          pitch: 22,
          heading: 0,
        },
        { duration: 360 }
      );
    }
  };

  const onMapPress = (event) => {
    if (sheetVisible) {
      setSheetVisible(false);
      return;
    }

    if (!demoAllowed || !demoModeOn || !teleportArmed || !mapRef.current) return;

    const coords = event.nativeEvent.coordinate;
    demoOverrideUntilRef.current = Date.now() + 3 * 60 * 1000;
    setUserLocation(coords);
    setTeleportArmed(false);
    showToast('Teleported to selected point');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    mapRef.current.animateCamera(
      {
        center: coords,
        zoom: 16.2,
        pitch: 20,
        heading: 8,
      },
      { duration: 420 }
    );
  };

  const centerOnMe = async () => {
    if (!mapRef.current) return;

    try {
      const current = await getUserLocation();
      setUserLocation(current);
      mapRef.current.animateCamera(
        {
          center: current,
          zoom: 16.2,
          pitch: 18,
          heading: 0,
        },
        { duration: 420 }
      );
      Haptics.selectionAsync();
      showToast('Centered on your live location');
    } catch {
      showToast('Could not get live location');
    }
  };

  const selectedDistance = useMemo(() => {
    if (!selectedLocation || !userLocation) return Infinity;
    return getDistanceToLocation(userLocation, selectedLocation);
  }, [selectedLocation, userLocation]);

  const selectedCooldownMs = useMemo(() => {
    if (!selectedLocation) return 0;
    return getLocationCooldownRemainingMs(selectedLocation.id);
  }, [claimedThisSession, selectedLocation]);

  const selectedIsClaimed = useMemo(() => {
    if (!selectedLocation) return false;
    return selectedCooldownMs > 0 || claimedThisSession.includes(selectedLocation.id);
  }, [claimedThisSession, selectedCooldownMs, selectedLocation]);

  if (loadingLocation) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading demo map...</Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Location access required</Text>
        <Text style={styles.errorBody}>Turn on location permission to use this app.</Text>
        <Pressable style={styles.enableLocationButton} onPress={() => void promptEnableLocation()}>
          <Text style={styles.enableLocationButtonText}>Turn Location On to Use App</Text>
        </Pressable>
      </View>
    );
  }

  const initialRegion = userLocation
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: 19.3206,
        longitude: -81.3845,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        customMapStyle={PERX_MAP_STYLE}
        showsUserLocation={false}
        showsMyLocationButton
        onPress={onMapPress}
      >
        {markerPoints.map((loc) => {
          const within = isWithinRadius(userLocation, loc);
          const active = selectedLocation?.id === loc.id;
          const claimed = claimedThisSession.includes(loc.id);
          return (
            <Marker
              key={loc.id}
              coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
              onPress={() => onSelectLocation(loc)}
              tracksViewChanges={false}
            >
              <DemoMarker active={active} withinRadius={within} claimed={claimed} />
            </Marker>
          );
        })}

        {userLocation ? (
          <Marker coordinate={userLocation} tracksViewChanges={false}>
            <View style={styles.userMarkerOuter}>
              <View style={styles.userMarkerInner} />
            </View>
          </Marker>
        ) : null}
      </MapView>

      <View style={styles.topLeftLogo}><Text style={styles.logoText}>PERX</Text></View>

      {demoAllowed ? (
        <View style={styles.topRightCard}>
          <Text style={styles.topLabel}>Demo Mode</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>{demoModeOn ? 'ON' : 'OFF'}</Text>
            <Switch
              value={demoModeOn}
              onValueChange={(v) => {
                setDemoModeOn(v);
                setDemoMode(v);
                if (!v) {
                  demoOverrideUntilRef.current = 0;
                  setTeleportArmed(false);
                }
              }}
              thumbColor={demoModeOn ? '#fff' : '#ddd'}
              trackColor={{ false: '#475467', true: '#2563EB' }}
            />
          </View>
          <Text style={styles.locationCount}>50 walkable spots</Text>
        </View>
      ) : (
        <View style={styles.topRightCardLive}>
          <Text style={styles.topLabel}>Live Map</Text>
          <Text style={styles.locationCount}>Business locations nearby</Text>
        </View>
      )}

      {demoAllowed && demoModeOn ? (
        <Pressable
          style={[styles.teleportPill, teleportArmed && styles.teleportPillArmed]}
          onPress={() => {
            setTeleportArmed((prev) => {
              const next = !prev;
              showToast(next ? 'Teleport armed. Tap the map.' : 'Teleport canceled');
              return next;
            });
          }}
        >
          <Text style={styles.teleportText}>{teleportArmed ? 'TAP MAP' : 'TELEPORT'}</Text>
        </Pressable>
      ) : null}

      <Pressable style={styles.locatePill} onPress={() => void centerOnMe()}>
        <Text style={styles.locateText}>LOCATE</Text>
      </Pressable>

      <View style={styles.walletPill}>
        <Text style={styles.walletLabel}>Wallet</Text>
        <Text style={styles.walletValue}>${walletBalance}</Text>
      </View>

      <View style={styles.sessionPill}>
        <Text style={styles.sessionText}>{`Session remaining: $${sessionRemaining}`}</Text>
      </View>

      {lastClaim ? (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            },
          ]}
        >
          <Text style={styles.toastText}>{lastClaim.message}</Text>
        </Animated.View>
      ) : null}

      <BottomSheetModal visible={sheetVisible} onClose={() => setSheetVisible(false)}>
        {selectedLocation ? (
          <View>
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>{selectedLocation.name}</Text>
            </View>
            <Text style={styles.sheetMeta}>Ritz-Carlton Grand Cayman</Text>
            <Text style={styles.sheetMeta}>{formatDistance(selectedDistance)}</Text>

            <View style={styles.rewardBox}>
              <Text style={styles.rewardLabel}>Reward</Text>
              <Text style={styles.rewardValue}>${selectedLocation.reward} off</Text>
            </View>

            <View style={[styles.claimHintCard, selectedIsClaimed && styles.claimHintCardClaimed]}>
              <Text style={[styles.claimHintText, selectedIsClaimed && styles.claimHintTextClaimed]}>
                {selectedIsClaimed ? 'Claimed' : 'Enter radius to claim'}
              </Text>
              {selectedCooldownMs > 0 ? (
                <Text style={styles.cooldownText}>Cooldown: {formatCooldown(selectedCooldownMs)}</Text>
              ) : null}
            </View>

            <Animated.View
              style={{
                marginTop: 10,
                opacity: successAnim,
                transform: [{ scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                alignItems: 'center',
              }}
            >
              <Ionicons name="checkmark-circle" size={28} color="#22C55E" />
              <Text style={styles.successText}>Reward added successfully</Text>
            </Animated.View>
          </View>
        ) : null}
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0F' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B0B0F' },
  loadingText: { marginTop: 10, color: '#B6BCC8' },
  errorTitle: { color: '#fff', fontSize: 21, fontWeight: '800' },
  errorBody: { color: '#B6BCC8', marginTop: 8, textAlign: 'center', paddingHorizontal: 28 },
  enableLocationButton: {
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  enableLocationButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  topLeftLogo: {
    position: 'absolute',
    top: 56,
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(11,11,15,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  logoText: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 1.4 },

  topRightCard: {
    position: 'absolute',
    top: 56,
    right: 16,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(11,11,15,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 136,
  },
  topRightCardLive: {
    position: 'absolute',
    top: 56,
    right: 16,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(11,11,15,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 156,
  },
  topLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '700' },
  toggleRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  locationCount: { color: '#93C5FD', marginTop: 6, fontSize: 11, fontWeight: '700' },

  walletPill: {
    position: 'absolute',
    bottom: 114,
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: 'rgba(11,11,15,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  walletLabel: { color: '#B6BCC8', fontSize: 12 },
  walletValue: { marginTop: 2, color: '#fff', fontWeight: '900', fontSize: 22 },

  sessionPill: {
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sessionText: { color: '#DBEAFE', fontWeight: '700', fontSize: 12 },

  markerWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  markerPulse: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(99,102,241,0.38)' },
  markerPulseActive: { transform: [{ scale: 1.16 }], backgroundColor: 'rgba(99,102,241,0.52)' },
  markerPulseInside: { backgroundColor: 'rgba(139,92,246,0.68)' },
  markerPulseClaimed: { backgroundColor: 'rgba(34,197,94,0.55)' },
  markerCore: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: '#7C3AED',
  },
  markerCoreActive: { transform: [{ scale: 1.15 }] },
  markerCoreInside: { backgroundColor: '#8B5CF6' },
  markerCoreClaimed: { backgroundColor: '#22C55E' },
  userMarkerOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(37,99,235,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
  },
  teleportPill: {
    position: 'absolute',
    left: 16,
    bottom: 158,
    borderRadius: 999,
    backgroundColor: 'rgba(124,58,237,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  teleportPillArmed: {
    backgroundColor: 'rgba(239,68,68,0.92)',
  },
  teleportText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  locatePill: {
    position: 'absolute',
    left: 16,
    bottom: 114,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  locateText: { color: '#fff', fontWeight: '800', fontSize: 11 },

  toast: {
    position: 'absolute',
    top: 136,
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.68)',
  },
  toastText: { color: '#DCFCE7', fontWeight: '800' },

  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: '#fff', fontSize: 23, fontWeight: '800', flex: 1 },
  sheetMeta: { marginTop: 4, color: '#B6BCC8', fontSize: 14 },
  rewardBox: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(37,99,235,0.17)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.52)',
    padding: 12,
  },
  rewardLabel: { color: '#BFDBFE', fontWeight: '700', fontSize: 12 },
  rewardValue: { marginTop: 4, color: '#fff', fontSize: 26, fontWeight: '900' },
  claimHintCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.45)',
    backgroundColor: 'rgba(37,99,235,0.16)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  claimHintCardClaimed: {
    borderColor: 'rgba(34,197,94,0.55)',
    backgroundColor: 'rgba(34,197,94,0.14)',
  },
  claimHintText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  claimHintTextClaimed: {
    color: '#22C55E',
  },
  cooldownText: {
    marginTop: 5,
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: '700',
  },
  successText: { color: '#86EFAC', marginTop: 4, fontWeight: '700' },
});
