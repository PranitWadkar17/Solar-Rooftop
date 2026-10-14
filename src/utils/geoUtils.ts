// ============================================
// Geospatial Utilities — Area, Perimeter, Centroid, Orientation, Validation
// Enhanced with precise geodesic calculations and validation
// ============================================

const EARTH_RADIUS = 6378137; // WGS84 equatorial radius in meters
const EARTH_RADIUS_POLAR = 6356752.314245; // WGS84 polar radius
const EARTH_FLATTENING = 1 / 298.257223563; // WGS84 flattening
const SQ_METERS_TO_SQ_FEET = 10.7639;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// --- Enhanced Area Calculation Methods ---

/**
 * Returns the Earth radius at a given latitude (accounting for ellipsoid shape)
 */
function getEarthRadiusAtLatitude(latDeg: number): number {
  const latRad = latDeg * DEG_TO_RAD;
  const cosLat = Math.cos(latRad);
  const sinLat = Math.sin(latRad);
  
  const a = EARTH_RADIUS;
  const b = EARTH_RADIUS_POLAR;
  
  const numerator = (a * a * cosLat) ** 2 + (b * b * sinLat) ** 2;
  const denominator = (a * cosLat) ** 2 + (b * sinLat) ** 2;
  
  return Math.sqrt(numerator / denominator);
}

// --- Projection Helpers ---

/**
 * Enhanced projection to meters using accurate ellipsoidal Earth radius
 */
function projectToMeters(
  coordinates: [number, number][],
): [number, number][] {
  if (coordinates.length === 0) return [];
  
  // Calculate mean latitude for accurate radius
  let sumLat = 0;
  for (const c of coordinates) sumLat += c[1];
  const meanLat = sumLat / coordinates.length;
  const meanLatRad = meanLat * DEG_TO_RAD;
  
  // Use ellipsoidal radius at mean latitude
  const radiusAtLat = getEarthRadiusAtLatitude(meanLat);
  const cosLat = Math.cos(meanLatRad);
  
  const originLng = coordinates[0][0];
  const originLat = coordinates[0][1];
  
  return coordinates.map(([lng, lat]) => {
    const x = ((lng - originLng) * DEG_TO_RAD) * radiusAtLat * cosLat;
    const y = ((lat - originLat) * DEG_TO_RAD) * radiusAtLat;
    return [x, y];
  });
}

/**
 * Calculates the geodesic area of a polygon using more accurate spherical excess formula
 * for polygons larger than 10,000 m². Falls back to planar for smaller areas.
 * @param coordinates Array of [longitude, latitude] pairs
 * @returns Area in square meters
 */
function calculateSphericalExcessArea(coordinates: [number, number][]): number {
  if (coordinates.length < 3) return 0;
  
  // Convert to radians
  const pointsRad = coordinates.map(([lng, lat]) => ({
    lng: lng * DEG_TO_RAD,
    lat: lat * DEG_TO_RAD,
  }));
  
  let sphericalExcess = 0;
  const n = pointsRad.length;
  
  for (let i = 0; i < n; i++) {
    const p1 = pointsRad[i];
    const p2 = pointsRad[(i + 1) % n];
    
    // Spherical excess formula (Girard's theorem)
    sphericalExcess += 2 * Math.atan2(
      Math.tan((p2.lng - p1.lng) / 2) * 
      (Math.tan(p1.lat / 2) + Math.tan(p2.lat / 2)),
      1 + Math.tan(p1.lat / 2) * Math.tan(p2.lat / 2)
    );
  }
  
  // Use mean latitude for radius
  const meanLat = coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length;
  const radiusAtLat = getEarthRadiusAtLatitude(meanLat);
  
  return Math.abs(sphericalExcess) * radiusAtLat * radiusAtLat;
}

// --- Area ---

/**
 * Calculates the approximate geodesic area of a polygon ring in square meters.
 * Uses planar projection for small areas (<10,000 m²) and spherical excess for larger areas.
 * Enhanced for accuracy with ellipsoidal Earth model.
 * @param coordinates Array of [longitude, latitude] pairs
 * @returns Area in square meters
 */
export function calculatePolygonArea(coordinates: [number, number][]): number {
  if (!coordinates || coordinates.length < 3) return 0;
  
  // Quick planar estimate to determine which method to use
  const pts = projectToMeters(coordinates);
  let planarArea = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    planarArea += pts[i][0] * pts[j][1];
    planarArea -= pts[j][0] * pts[i][1];
  }
  planarArea = Math.abs(planarArea) / 2;
  
  // For large areas (>10,000 m² or ~100m x 100m), use spherical excess for better accuracy
  if (planarArea > 10000) {
    const sphericalArea = calculateSphericalExcessArea(coordinates);
    // Sanity check: spherical and planar should be within 5% for reasonable polygons
    if (Math.abs(sphericalArea - planarArea) / planarArea > 0.05) {
      console.warn(`Large area calculation discrepancy detected. Planar: ${planarArea.toFixed(1)} m², Spherical: ${sphericalArea.toFixed(1)} m²`);
    }
    return sphericalArea;
  }
  
  return planarArea;
}

// --- Perimeter ---

/**
 * Vincenty formula for more accurate geodesic distance between two points
 * Falls back to Haversine for convergence issues (rare)
 */
function vincentyDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const a = EARTH_RADIUS;
  const b = EARTH_RADIUS_POLAR;
  const f = EARTH_FLATTENING;
  
  const L = (lng2 - lng1) * DEG_TO_RAD;
  const U1 = Math.atan((1 - f) * Math.tan(lat1 * DEG_TO_RAD));
  const U2 = Math.atan((1 - f) * Math.tan(lat2 * DEG_TO_RAD));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);
  
  let lambda = L;
  let lambdaP;
  let iterLimit = 100;
  let cosSqAlpha, sinSigma, cos2SigmaM, cosSigma, sigma;
  
  do {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt(
      (cosU2 * sinLambda) ** 2 +
      (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2
    );
    
    if (sinSigma === 0) return 0; // Co-incident points
    
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;
    
    if (isNaN(cos2SigmaM)) cos2SigmaM = 0; // Equatorial line
    
    const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda = L + (1 - C) * f * sinAlpha * (
      sigma + C * sinSigma * (
        cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)
      )
    );
  } while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0);
  
  if (iterLimit === 0) {
    // Vincenty formula failed to converge, fall back to Haversine
    return haversineDistance(lat1, lng1, lat2, lng2);
  }
  
  const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
  const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma = B * sinSigma! * (
    cos2SigmaM! + B / 4 * (
      cosSigma! * (-1 + 2 * cos2SigmaM! * cos2SigmaM!) -
      B / 6 * cos2SigmaM! * (-3 + 4 * sinSigma! * sinSigma!) *
      (-3 + 4 * cos2SigmaM! * cos2SigmaM!)
    )
  );
  
  return b * A * (sigma! - deltaSigma);
}

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  
  const meanLat = (lat1 + lat2) / 2;
  const radiusAtLat = getEarthRadiusAtLatitude(meanLat);
  
  return radiusAtLat * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculates perimeter of a polygon in meters using Vincenty formula for accuracy.
 * @param coordinates Array of [longitude, latitude] pairs
 */
export function calculatePerimeter(coordinates: [number, number][]): number {
  if (!coordinates || coordinates.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length;
    perimeter += vincentyDistance(
      coordinates[i][1], coordinates[i][0],
      coordinates[j][1], coordinates[j][0],
    );
  }
  return perimeter;
}

/**
 * Calculates the distance between two [lng, lat] points in meters using Vincenty formula.
 */
export function distanceBetweenPoints(
  a: [number, number],
  b: [number, number],
): number {
  return vincentyDistance(a[1], a[0], b[1], b[0]);
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
 * Enhanced with Vincenty distance for accuracy.
 * Returns dimensions in meters.
 */
export function calculateApproxDimensions(
  coordinates: [number, number][],
): { length: number; width: number } {
  const [south, north, west, east] = calculateBoundingBox(coordinates);
  const lengthNS = vincentyDistance(south, west, north, west);
  const widthEW = vincentyDistance(south, west, south, east);
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
 * Generates a more accurate buffer zone around a polygon using offset curve algorithm.
 * For small buffers (<2m), uses simple scaling. For larger buffers, uses proper offset.
 * Returns a new polygon expanded by `bufferMeters` outward.
 */
export function generateObstacleBuffer(
  coordinates: [number, number][],
  bufferMeters: number,
): [number, number][] {
  if (bufferMeters <= 0) return coordinates;
  
  const area = calculatePolygonArea(coordinates);
  const centroid = calculateCentroid(coordinates);
  
  // For small buffers relative to object size, use scaling
  if (bufferMeters < 2 || area < 10) {
    const avgRadius = Math.sqrt(area / Math.PI);
    const scale = 1 + (bufferMeters / Math.max(0.5, avgRadius));
    return coordinates.map(([lng, lat]) => [
      centroid.lng + (lng - centroid.lng) * scale,
      centroid.lat + (lat - centroid.lat) * scale,
    ]);
  }
  
  // For larger buffers, use proper offset with normal vectors
  const buffered: [number, number][] = [];
  const n = coordinates.length;
  
  // Convert to meters for offset calculation
  const pts = projectToMeters(coordinates);
  const meanLat = coordinates.reduce((sum, c) => sum + c[1], 0) / n;
  const radiusAtLat = getEarthRadiusAtLatitude(meanLat);
  const cosLat = Math.cos(meanLat * DEG_TO_RAD);
  
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;
    
    // Calculate edge normals
    const v1x = pts[i][0] - pts[prev][0];
    const v1y = pts[i][1] - pts[prev][1];
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y) || 1;
    const n1x = -v1y / len1;
    const n1y = v1x / len1;
    
    const v2x = pts[next][0] - pts[i][0];
    const v2y = pts[next][1] - pts[i][1];
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y) || 1;
    const n2x = -v2y / len2;
    const n2y = v2x / len2;
    
    // Average normal (bisector)
    const nx = (n1x + n2x) / 2;
    const ny = (n1y + n2y) / 2;
    const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
    
    // Offset point
    const offsetX = pts[i][0] + (nx / nlen) * bufferMeters;
    const offsetY = pts[i][1] + (ny / nlen) * bufferMeters;
    
    // Convert back to lat/lng
    const lng = coordinates[i][0] + (offsetX - pts[i][0]) / (radiusAtLat * cosLat) * RAD_TO_DEG;
    const lat = coordinates[i][1] + (offsetY - pts[i][1]) / radiusAtLat * RAD_TO_DEG;
    
    buffered.push([lng, lat]);
  }
  
  return buffered;
}

/**
 * Generates a circular buffer around a point with accurate geodesic calculation.
 */
export function generatePointBuffer(
  center: [number, number],
  radiusMeters: number,
  segments: number = 24, // Increased from 16 for smoother circles
): [number, number][] {
  const [lng, lat] = center;
  const radiusAtLat = getEarthRadiusAtLatitude(lat);
  const latOffset = (radiusMeters / radiusAtLat) * RAD_TO_DEG;
  const lngOffset = latOffset / Math.cos(lat * DEG_TO_RAD);
  const points: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    points.push([
      lng + lngOffset * Math.cos(angle),
      lat + latOffset * Math.sin(angle),
    ]);
  }
  // Close the ring
  points.push(points[0]);
  return points;
}

// --- Usable Area Breakdown ---

import type { AreaBreakdown, Obstacle } from '@/types/rooftop.js';

/**
 * Estimates obstacle height from shadow length if sun position is known.
 * Returns estimated height in meters, or null if cannot estimate.
 * @param shadowLengthMeters Measured or observed shadow length
 * @param sunElevationDeg Solar elevation angle in degrees
 */
export function estimateHeightFromShadow(
  shadowLengthMeters: number,
  sunElevationDeg: number,
): number | null {
  if (sunElevationDeg <= 5 || sunElevationDeg >= 85) {
    // Shadow too long or too short for reliable estimation
    return null;
  }
  
  const sunElevationRad = sunElevationDeg * DEG_TO_RAD;
  const height = shadowLengthMeters * Math.tan(sunElevationRad);
  
  // Sanity check: rooftop obstacles typically 0.3m - 6m
  if (height < 0.3 || height > 6) {
    return null;
  }
  
  return Math.round(height * 10) / 10;
}

/**
 * Calculates physical usable area breakdown with enhanced clearance calculations.
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

    // More accurate clearance area calculation using actual buffer geometry
    if (obs.clearance > 0) {
      if (obs.geometryKind === 'polygon' && obs.geometry.type === 'Polygon') {
        const obstacleRing = obs.geometry.coordinates[0] as [number, number][];
        const bufferedRing = generateObstacleBuffer(obstacleRing, obs.clearance);
        const bufferedArea = calculatePolygonArea(bufferedRing);
        clearanceArea += Math.max(0, bufferedArea - obsArea);
      } else if (obs.geometryKind === 'point' && obs.geometry.type === 'Point') {
        const pointCoords = obs.geometry.coordinates as [number, number];
        const bufferedRing = generatePointBuffer(pointCoords, obs.clearance);
        clearanceArea += calculatePolygonArea(bufferedRing);
      } else {
        // Fallback for other geometry types
        const side = Math.sqrt(obsArea || 1);
        const bufferedSide = side + 2 * obs.clearance;
        clearanceArea += bufferedSide * bufferedSide - (obsArea || 0);
      }
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
 * Enhanced with comprehensive checks.
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

  // Check for duplicate consecutive vertices
  let duplicateCount = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    if (coordinates[i][0] === coordinates[i + 1][0] && 
        coordinates[i][1] === coordinates[i + 1][1]) {
      duplicateCount++;
    }
  }
  
  if (duplicateCount > 0) {
    warnings.push(`${duplicateCount} duplicate consecutive vertices detected`);
  }

  // Calculate area
  const area = calculatePolygonArea(coordinates);
  if (area < minArea) {
    errors.push(`Polygon area (${area.toFixed(2)} m²) is too small (minimum ${minArea} m²).`);
  }

  // Area sanity checks
  if (area > 1000000) { // 1 km²
    errors.push(`Polygon area (${area.toFixed(0)} m²) is unrealistically large for a building. Verify coordinates.`);
  }

  // Check for self-intersection
  if (checkPolygonSelfIntersection(coordinates)) {
    errors.push('Polygon has self-intersecting edges. Please fix the boundary.');
  }

  // Check aspect ratio (extremely elongated polygons may indicate errors)
  const dims = calculateApproxDimensions(coordinates);
  const aspectRatio = dims.length / Math.max(0.1, dims.width);
  if (aspectRatio > 20) {
    warnings.push(`Extreme aspect ratio (${aspectRatio.toFixed(1)}:1). Verify polygon shape is correct.`);
  }

  // Check perimeter vs area ratio (detect suspicious slivers)
  const perimeter = calculatePerimeter(coordinates);
  const compactness = (4 * Math.PI * area) / (perimeter * perimeter);
  if (compactness < 0.1) {
    warnings.push('Polygon shape is very irregular or thin. Verify boundary accuracy.');
  }

  // Vertex count warnings
  if (coordinates.length < 4) {
    warnings.push('Polygon has only 3 vertices. Consider if more detail is needed.');
  }
  
  if (coordinates.length > 500) {
    warnings.push('Polygon has excessive vertices (>500). This may impact performance.');
  }

  // Small area warning (separate from error)
  if (area < 5 && area >= minArea) {
    warnings.push('Very small polygon — verify the boundary is correct.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
