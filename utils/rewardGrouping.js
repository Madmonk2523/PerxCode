export function splitRewardsByTime(rewards) {
  const today = [];
  const week = [];
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  rewards.forEach((item) => {
    const ts = item.timestamp?.toDate ? item.timestamp.toDate().getTime() : new Date(item.timestampMs || item.timestamp || 0).getTime();
    if (ts >= startOfToday) {
      today.push(item);
    } else if (ts >= startOfWeek) {
      week.push(item);
    }
  });

  return { today, week };
}
