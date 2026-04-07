// Grayscale/desaturated premium map style.
export const PERX_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1f' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8f95a3' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f1016' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ color: '#1a1a1e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2b31' }] },
  { featureType: 'road.arterial', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2f3137' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#12151c' }] },
];
