import { useMemo } from 'react';

const LEVELS = [
  { minXp: 0, name: 'Explorer' },
  { minXp: 80, name: 'Pro' },
  { minXp: 180, name: 'Elite' },
];

function dayKeyFromReward(reward) {
  const ts = reward.timestamp?.toDate ? reward.timestamp.toDate() : new Date(reward.timestampMs || reward.timestamp || Date.now());
  return ts.toISOString().slice(0, 10);
}

function calcStreak(dayKeys) {
  if (!dayKeys.length) return 0;
  const unique = Array.from(new Set(dayKeys)).sort().reverse();
  let streak = 0;
  let cursor = new Date();

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (unique.includes(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }

  return streak;
}

export function usePerxProgress(rewards) {
  return useMemo(() => {
    const normalized = Array.isArray(rewards) ? rewards : [];
    const totalClaims = normalized.length;
    const totalXp = normalized.reduce((acc, item) => acc + ((item.tokensEarned ?? item.amount ?? 0) * 10), 0);
    const dayKeys = normalized.map(dayKeyFromReward);
    const streak = calcStreak(dayKeys);

    const level = LEVELS.reduce((current, next) => (totalXp >= next.minXp ? next : current), LEVELS[0]);
    return {
      totalClaims,
      totalXp,
      streak,
      levelName: level.name,
    };
  }, [rewards]);
}
