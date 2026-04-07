export const TEST_MODE = false;

export const TEST_USER = {
  uid: 'test-user',
  email: 'testmode@georewards.app',
};

const now = Date.now();

export const TEST_STATE = {
  tokenBalance: 6,
  rewards: [
    {
      id: 'seed-1',
      locationId: 'harbor-coffee',
      locationName: 'Harbor Coffee',
      tokensEarned: 1,
      timestamp: new Date(now - 1000 * 60 * 40),
    },
    {
      id: 'seed-2',
      locationId: 'north-market',
      locationName: 'North Market',
      tokensEarned: 2,
      timestamp: new Date(now - 1000 * 60 * 120),
    },
    {
      id: 'seed-3',
      locationId: 'studio-fit',
      locationName: 'Studio Fit',
      tokensEarned: 3,
      timestamp: new Date(now - 1000 * 60 * 60 * 24),
    },
  ],
};

const RECENT_MS = 24 * 60 * 60 * 1000;

export function getTestBalance() {
  return TEST_STATE.tokenBalance;
}

export function getTestRewards() {
  return [...TEST_STATE.rewards].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function hasRecentTestReward(locationId) {
  const nowMs = Date.now();
  return TEST_STATE.rewards.some((r) => {
    if (r.locationId !== locationId) return false;
    return nowMs - r.timestamp.getTime() < RECENT_MS;
  });
}

export function awardTestReward(location) {
  const reward = {
    id: `test-${Date.now()}`,
    locationId: location.id,
    locationName: location.name,
    tokensEarned: location.rewardValue,
    timestamp: new Date(),
  };

  TEST_STATE.tokenBalance += location.rewardValue;
  TEST_STATE.rewards.unshift(reward);

  return {
    reward,
    tokenBalance: TEST_STATE.tokenBalance,
  };
}
