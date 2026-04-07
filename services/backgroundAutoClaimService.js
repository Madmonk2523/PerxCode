import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import {
  buildWalkableDemoLocations,
  claimNearbyRewards,
  DEMO_CENTER,
  loadDemoAnchorLocation,
  loadDemoMode,
} from './demoModeService';

export const PERX_BACKGROUND_TASK = 'perx-background-auto-claim';
const PERX_NOTIFICATION_CHANNEL = 'perx-claims';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

if (!TaskManager.isTaskDefined(PERX_BACKGROUND_TASK)) {
  TaskManager.defineTask(PERX_BACKGROUND_TASK, async ({ data, error }) => {
    if (error) return;

    const points = data?.locations || [];
    if (!points.length) return;

    const latest = points[0];
    const userCoords = {
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
    };

    const demoModeEnabled = await loadDemoMode();
    const anchor = (await loadDemoAnchorLocation()) || DEMO_CENTER;
    const locations = buildWalkableDemoLocations(anchor);

    const result = await claimNearbyRewards({
      userCoords,
      locations,
      demoModeEnabled,
      maxClaimsPerPass: 3,
    });

    if (!result.claims.length) return;

    await sendPerxClaimNotifications(result.claims, { source: 'background' });
  });
}

async function ensurePerxNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(PERX_NOTIFICATION_CHANNEL, {
    name: 'PERX Claims',
    description: 'Reward claim updates and nearby claim summaries',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 180, 120, 180],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function sendPerxClaimNotifications(claims, { source = 'foreground' } = {}) {
  const list = Array.isArray(claims) ? claims : [];
  if (!list.length) return;

  await ensurePerxNotificationChannel();

  for (const claim of list) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `PERX Claimed at ${claim.locationName}`,
        body: `+$${claim.reward} added to your wallet`,
        sound: true,
        data: {
          locationId: claim.locationId,
          source,
          type: 'single-claim',
        },
      },
      trigger: null,
    });
  }
}

export async function ensurePerxNotificationPermission() {
  await ensurePerxNotificationChannel();
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const asked = await Notifications.requestPermissionsAsync();
  return !!(asked.granted || asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
}

export async function startBackgroundAutoClaim() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') return false;

  const notificationsGranted = await ensurePerxNotificationPermission();
  if (!notificationsGranted) return false;

  const started = await Location.hasStartedLocationUpdatesAsync(PERX_BACKGROUND_TASK);
  if (started) return true;

  await Location.startLocationUpdatesAsync(PERX_BACKGROUND_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30000,
    distanceInterval: 30,
    pausesUpdatesAutomatically: false,
    foregroundService:
      Platform.OS === 'android'
        ? {
            notificationTitle: 'PERX Auto Claim Active',
            notificationBody: 'Claiming nearby PERX while app is backgrounded',
          }
        : undefined,
  });

  return true;
}

export async function stopBackgroundAutoClaim() {
  const started = await Location.hasStartedLocationUpdatesAsync(PERX_BACKGROUND_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(PERX_BACKGROUND_TASK);
  }
}
