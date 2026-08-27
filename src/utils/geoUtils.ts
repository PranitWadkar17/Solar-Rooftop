// ============================================
// Geospatial Utilities — Area, Perimeter, Centroid, Orientation, Validation
// ============================================

const EARTH_RADIUS = 6378137; // meters
const SQ_METERS_TO_SQ_FEET = 10.7639;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// --- Projection Helpers ---

function projectToMeters(
  coordinates: [number, number][],
): [number, number][] {
  if (coordinates.length === 0) return [];
  let sumLat = 0;
  for (const c of coordinates) sumLat += c[1];
  const meanLatRad = (sumLat / coordinates.length) * DEG_TO_RAD;
  const cosLat = Math.cos(meanLatRad);
  const originLng = coordinates[0][0];
  const originLat = coordinates[0][1];
  return coordinates.map(([lng, lat]) => {
    const x = ((lng - originLng) * DEG_TO_RAD) * EARTH_RADIUS * cosLat;
    const y = ((lat - originLat) * DEG_TO_RAD) * EARTH_RADIUS;
    return [x, y];
  });
}

// --- Area ---

/**
 * Calculates the approximate geodesic area of a polygon ring in square meters
 * using the planar projection / Shoelace formula on WGS84 coordinates.
 * @param coordinates Array of [longitude, latitude] pairs
 * @returns Area in square meters
 */
export function calculatePolygonArea(coordinates: [number, number][]): number {
  if (!coordinates || coordinates.length < 3) return 0;
  const pts = projectToMeters(coordinates);
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i][0] * pts[j][1];
    area -= pts[j][0] * pts[i][1];
  }
  return Math.abs(area) / 2;
}

// --- Perimeter ---

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculates perimeter of a polygon in meters using Haversine.
 * @param coordinates Array of [longitude, latitude] pairs
 */
export function calculatePerimeter(coordinates: [number, number][]): number {
  if (!coordinates || coordinates.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length;
    perimeter += haversineDistance(
      coordinates[i][1], coordinates[i][0],
      coordinates[j][1], coordinates[j][0],
    );
  }
  return perimeter;
}

/**
 * Calculates the distance between two [lng, lat] points in meters.
 */
export function distanceBetweenPoints(
  a: [number, number],
  b: [number, number],
): number {
  return haversineDistance(a[1], a[0], b[1], b[0]);
}

// --- Centroid ---

/**
 * Calculates centroid of a polygon (geographic average of vertices).
 * @param coordinates Array of [longitude, latitude] pairs
 */
export function calculateCentroid(coordinates: [number, number][]): { lat: number; lng: number } {
  if (!coordinates || coordinates.length === 0) return { lat: 0, lng: 0 };
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of coordinates) {
    sumLng += lng;
    sumLat += lat;
  }
  return {
    lng: sumLng / coordinates.length,
    lat: sumLat / coordinates.length,
  };
}

// --- Bounding Box ---

/**
 * Calculates bounding box [south, north, west, east].
 */
export function calculateBoundingBox(
  coordinates: [number, number][],
): [number, number, number, number] {
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const [lng, lat] of coordinates) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [minLat, maxLat, minLng, maxLng];
}

// --- Approximate Dimensions ---

/**
 * Calculates approximate length and width of a polygon using its bounding box.
 * Returns dimensions in meters.
 */
export function calculateApproxDimensions(
  coordinates: [number, number][],
): { length: number; width: number } {
  const [south, north, west, east] = calculateBoundingBox(coordinates);
  const lengthNS = haversineDistance(south, west, north, west);
  const widthEW = haversineDistance(south, west, south, east);
  const longer = Math.max(lengthNS, widthEW);
  const shorter = Math.min(lengthNS, widthEW);
  return { length: longer, width: shorter };
}

// --- Orientation / Azimuth ---

const CARDINAL_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/**
 * Calculates the principal axis orientation of a polygon in degrees (0-360, clockwise from North).
 */
export function calculateOrientation(
  coordinates: [number, number][],
): { azimuth: number; cardinal: string } {
  if (!coordinates || coordinates.length < 3) return { azimuth: 0, cardinal: 'N' };

  const pts = projectToMeters(coordinates);

  // Find the longest edge
  let maxDist = 0;
  let bestAngle = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const dx = pts[j][0] - pts[i][0];
    const dy = pts[j][1] - pts[i][1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) {
      maxDist = dist;
      // Angle from north, clockwise
      bestAngle = (90 - Math.atan2(dy, dx) * RAD_TO_DEG + 360) % 360;
    }
  }

  // Normalize to 0-180 (a roof face can point either direction along its edge)
  const normalizedAzimuth = bestAngle % 180;
  const cardinalIndex = Math.round(normalizedAzimuth / 45) % 8;
  const cardinal = CARDINAL_DIRECTIONS[cardinalIndex];

  return { azimuth: Math.round(normalizedAzimuth * 10) / 10, cardinal };
}

// --- Point in Polygon (Ray Casting) ---

/**
 * Tests whether a point lies inside a polygon using the ray casting algorithm.
 * All coordinates are [longitude, latitude].
 */
export function isPointInPolygon(
  point: [number, number],
  polygon: [number, number][],
): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// --- Self-Intersection Detection ---

function segmentsIntersect(
  a1: [number, number], a2: [number, number],
  b1: [number, number], b2: [number, number],
): boolean {
  const d1x = a2[0] - a1[0], d1y = a2[1] - a1[1];
  const d2x = b2[0] - b1[0], d2y = b2[1] - b1[1];
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-12) return false;
  const t = ((b1[0] - a1[0]) * d2y - (b1[1] - a1[1]) * d2x) / cross;
  const u = ((b1[0] - a1[0]) * d1y - (b1[1] - a1[1]) * d1x) / cross;
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}

/**
 * Checks if a polygon has self-intersecting edges (bowtie / figure-8).
 */
export function checkPolygonSelfIntersection(coordinates: [number, number][]): boolean {
  const n = coordinates.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = coordinates[i];
    const a2 = coordinates[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // Adjacent (closing) edge
      const b1 = coordinates[j];
      const b2 = coordinates[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

// --- Obstacle Clearance Buffer ---

/**
 * Generates a rectangular buffer zone around a polygon.
 * Returns a new polygon expanded by `bufferMeters` outward.
 */
export function generateObstacleBuffer(
  coordinates: [number, number][],
  bufferMeters: number,
): [number, number][] {
  const centroid = calculateCentroid(coordinates);
  const scale = 1 + (bufferMeters / Math.max(1, Math.sqrt(calculatePolygonArea(coordinates))));
  return coordinates.map(([lng, lat]) => [
    centroid.lng + (lng - centroid.lng) * scale,
    centroid.lat + (lat - centroid.lat) * scale,
  ]);
}

/**
 * Generates a circular buffer around a point.
 */
export function generatePointBuffer(
  center: [number, number],
  radiusMeters: number,
  segments: number = 16,
): [number, number][] {
  const [lng, lat] = center;
  const latOffset = (radiusMeters / EARTH_RADIUS) * RAD_TO_DEG;
  const lngOffset = latOffset / Math.cos(lat * DEG_TO_RAD);
  const points: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    points.push([
      lng + lngOffset * Math.cos(angle),
      lat + latOffset * Math.sin(angle),
    ]);
  }
  return points;
}

// --- Usable Area Breakdown ---

import type { AreaBreakdown, Obstacle } from '@/types/rooftop.js';

/**
 * Calculates physical usable area breakdown.
 * walkwayPercent: fraction of total roof reserved for walkways (e.g., 0.05 = 5%).
 */
export function calculateUsableAreaBreakdown(
  totalRoofArea: number,
  obstacles: Obstacle[],
  walkwayPercent: number = 0.05,
): AreaBreakdown {
  let obstacleArea = 0;
  let clearanceArea = 0;

  for (const obs of obstacles) {
    if (obs.status === 'rejected') continue;

    const obsArea = obs.area ?? 0;
    obstacleArea += obsArea;

    // Approximate clearance area as a ring proportional to clearance buffer
    if (obs.clearance > 0 && obsArea > 0) {
      const side = Math.sqrt(obsArea);
      const bufferedSide = side + 2 * obs.clearance;
      clearanceArea += bufferedSide * bufferedSide - obsArea;
    } else if (obs.clearance > 0 && obs.geometryKind === 'point') {
      clearanceArea += Math.PI * obs.clearance * obs.clearance;
    }
  }

  const walkwayArea = totalRoofArea * walkwayPercent;
  const physicalUsableArea = Math.max(0, totalRoofArea - obstacleArea - clearanceArea - walkwayArea);

  return {
    totalRoofArea: Math.round(totalRoofArea * 100) / 100,
    obstacleArea: Math.round(obstacleArea * 100) / 100,
    clearanceArea: Math.round(clearanceArea * 100) / 100,
    walkwayArea: Math.round(walkwayArea * 100) / 100,
    physicalUsableArea: Math.round(physicalUsableArea * 100) / 100,
  };
}

// --- Formatting ---

/**
 * Formats square meters into readable metric and imperial strings.
 */
export function formatArea(sqMeters: number): {
  sqMeters: string;
  sqFeet: string;
  display: string;
} {
  const roundedMeters = Math.round(sqMeters);
  const sqFeet = Math.round(sqMeters * SQ_METERS_TO_SQ_FEET);
  return {
    sqMeters: `${roundedMeters.toLocaleString()} m²`,
    sqFeet: `${sqFeet.toLocaleString()} sq ft`,
    display: `${roundedMeters.toLocaleString()} m² (${sqFeet.toLocaleString()} sq ft)`,
  };
}

/**
 * Formats a distance in meters to a readable string.
 */
export function formatDistance(meters: number): string {
  if (meters < 1) return `${Math.round(meters * 100)} cm`;
  if (meters < 1000) return `${meters.toFixed(1)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

// --- Geometry Validation ---

import type { GeometryValidationResult } from '@/types/rooftop.js';

/**
 * Validates a polygon for use as a rooftop or obstacle boundary.
 */
export function validatePolygon(
  coordinates: [number, number][],
  minArea: number = 1,
): GeometryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!coordinates || coordinates.length < 3) {
    errors.push('Polygon must have at least 3 vertices.');
    return { valid: false, errors, warnings };
  }

  const area = calculatePolygonArea(coordinates);
  if (area < minArea) {
    errors.push(`Polygon area (${area.toFixed(2)} m²) is too small (minimum ${minArea} m²).`);
  }

  if (checkPolygonSelfIntersection(coordinates)) {
    errors.push('Polygon has self-intersecting edges. Please fix the boundary.');
  }

  if (area < 5) {
    warnings.push('Very small polygon — verify the boundary is correct.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
