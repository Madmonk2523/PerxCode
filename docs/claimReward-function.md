# claimReward Cloud Function Contract

Callable name: `claimReward`
Region: `us-central1`

## Request payload

```json
{
  "locationId": "harbor-coffee",
  "locationName": "Harbor Coffee",
  "rewardValue": 1,
  "radiusMeters": 100,
  "locationLatitude": 40.74192,
  "locationLongitude": -73.98942,
  "userLatitude": 40.74201,
  "userLongitude": -73.9893,
  "clientTimestamp": 1712048000000
}
```

## Required server checks

1. Require authenticated user (`context.auth.uid`).
2. Validate payload types/ranges.
3. Compute distance between user and location server-side.
4. Reject if `distance > radiusMeters`.
5. Reject if a reward for (`uid`, `locationId`) exists in the past 24 hours.
6. On success, write reward doc and increment `users/{uid}.tokenBalance` in a transaction.

## Response payload

```json
{
  "granted": true,
  "tokensAwarded": 1,
  "locationName": "Harbor Coffee"
}
```

If rejected:

```json
{
  "granted": false,
  "reason": "cooldown|outside_radius"
}
```
