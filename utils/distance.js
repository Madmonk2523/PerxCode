/**
 * Haversine formula — returns the distance between two GPS coordinates in meters.
 */
export function getDistanceMeters(coordA, coordB) {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(coordB.latitude - coordA.latitude);
  const dLon = toRad(coordB.longitude - coordA.longitude);
  const lat1 = toRad(coordA.latitude);
  const lat2 = toRad(coordB.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value) {
  return (value * Math.PI) / 180;
}
