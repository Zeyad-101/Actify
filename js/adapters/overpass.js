// OpenStreetMap Overpass adapter for nearby Actify GoOut options.

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const EARTH_RADIUS_METERS = 6371000;

function distanceBetween(lat1, lon1, lat2, lon2) {
  const toRadians = degrees => degrees * Math.PI / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
    * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function friendlyType(tags) {
  if (tags.amenity === 'cafe') return 'Cafe';
  if (tags.amenity === 'restaurant') return 'Restaurant';
  if (tags.leisure === 'park') return 'Park';
  return null;
}

async function findNearby(lat, lon, radiusMeters = 1500) {
  try {
    const query = `[out:json];node(around:${radiusMeters},${lat},${lon})[name][amenity~"^(cafe|restaurant)$"];node(around:${radiusMeters},${lat},${lon})[name][leisure="park"];out;`;
    const url = `${OVERPASS_ENDPOINT}?data=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    if (!data || !Array.isArray(data.elements)) return [];

    return data.elements
      .filter(place => place && place.tags && place.tags.name
        && Number.isFinite(place.lat) && Number.isFinite(place.lon))
      .map(place => ({
        name: place.tags.name,
        type: friendlyType(place.tags),
        distanceMeters: Math.round(distanceBetween(lat, lon, place.lat, place.lon)),
      }))
      .filter(place => place.type)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 5);
  } catch {
    return [];
  }
}

window.OverpassAdapter = { findNearby };
