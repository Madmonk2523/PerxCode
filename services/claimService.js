import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

const claimRewardCallable = httpsCallable(functions, 'claimReward');

export async function claimRewardFromServer({ location, userCoords }) {
  const payload = {
    locationId: location.id,
    locationName: location.name,
    rewardValue: location.rewardValue,
    radiusMeters: location.radiusMeters,
    locationLatitude: location.latitude,
    locationLongitude: location.longitude,
    userLatitude: userCoords.latitude,
    userLongitude: userCoords.longitude,
    clientTimestamp: Date.now(),
  };

  const result = await claimRewardCallable(payload);
  return result.data;
}
