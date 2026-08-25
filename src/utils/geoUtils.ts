// ============================================
// Geospatial Utilities — Area Calculation & Formatting
// ============================================

/**
 * Calculates the approximate geodesic area of a polygon ring in square meters
 * using the planar projection / Shoelace formula on WGS84 coordinates.
 * @param coordinates Array of [longitude, latitude] pairs
 * @returns Area in square meters
 */
export function calculatePolygonArea(coordinates: [number, number][]): number {
  if (!coordinates || coordinates.length < 3) return 0;

  // Earth radius in meters
  const EARTH_RADIUS = 6378137;

  // Calculate centroid latitude for projection
  let sumLat = 0;
  for (const coord of coordinates) {
    sumLat += coord[1];
  }
  const meanLatRad = (sumLat / coordinates.length) * (Math.PI / 180);
  const cosLat = Math.cos(meanLatRad);

  // Project coordinates to meters relative to first point
  const originLng = coordinates[0][0];
  const originLat = coordinates[0][1];

  const pointsMeters: [number, number][] = coordinates.map(([lng, lat]) => {
    const x = ((lng - originLng) * Math.PI / 180) * EARTH_RADIUS * cosLat;
    const y = ((lat - originLat) * Math.PI / 180) * EARTH_RADIUS;
    return [x, y];
  });

  // Shoelace formula
  let area = 0;
  const n = pointsMeters.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pointsMeters[i][0] * pointsMeters[j][1];
    area -= pointsMeters[j][0] * pointsMeters[i][1];
  }

  return Math.abs(area) / 2;
}

/**
 * Formats square meters into readable metric and imperial strings
 */
export function formatArea(sqMeters: number): {
  sqMeters: string;
  sqFeet: string;
  display: string;
} {
  const roundedMeters = Math.round(sqMeters);
  const sqFeet = Math.round(sqMeters * 10.7639);

  return {
    sqMeters: `${roundedMeters.toLocaleString()} m²`,
    sqFeet: `${sqFeet.toLocaleString()} sq ft`,
    display: `${roundedMeters.toLocaleString()} m² (${sqFeet.toLocaleString()} sq ft)`,
  };
}
