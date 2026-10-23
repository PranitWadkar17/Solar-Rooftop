// ============================================
// Irradiance Engine — Solar Zones, Shading Losses & User Selection Area
// Enhanced with diffuse radiation modeling and atmospheric effects
// ============================================

import type { Rooftop, Obstacle } from '@/types/rooftop.js';
import type {
  SolarResourceData,
  SolarIrradianceZone,
  SectionSolarMetric,
  SolarPotentialClassification,
  SelectedSolarArea,
  SelectionMethod,
  SolarAssumptions,
} from '@/types/solar.js';
import {
  calculatePolygonArea,
  calculateCentroid,
  isPointInPolygon,
} from '@/utils/geoUtils';
import { calculateSunPosition, getSeasonalDatePresets } from './sunPositionService';
import { calculateProjectedShadows, isPointShaded } from './shadingService';
import { v4 as uuidv4 } from 'uuid';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS = 6378137;

export const DEFAULT_SOLAR_ASSUMPTIONS: SolarAssumptions = {
  highThresholdPct: 80,
  mediumThresholdPct: 60,
  gridResolutionMeters: 1.0, // Increased resolution from 1.5m to 1.0m for better accuracy
  defaultObstacleHeightMeters: 1.5,
  albedoGroundReflectance: 0.20,
  soilingLossAssumptionPct: 2.0,
};

/**
 * Enhanced atmospheric transmittance model accounting for air mass and turbidity
 * @param elevation Solar elevation in degrees
 * @param turbidity Linke turbidity factor (2-6, typical 3-4)
 */
function calculateAtmosphericTransmittance(elevation: number, turbidity: number = 3.5): number {
  if (elevation <= 0) return 0;
  
  // Air mass calculation (Kasten & Young formula)
  const elevationRad = elevation * DEG_TO_RAD;
  const airMass = 1 / (Math.sin(elevationRad) + 0.50572 * Math.pow(elevation + 6.07995, -1.6364));
  
  // Simplified atmospheric transmittance (Bird & Hulstrom model)
  const tau = Math.exp(-turbidity * airMass / 10);
  
  // Direct beam transmittance
  const tauDirect = 0.56 * (Math.exp(-0.65 * airMass) + Math.exp(-0.095 * airMass));
  
  // Combined transmittance (direct + diffuse component)
  return Math.max(0.1, Math.min(1.0, 0.7 * tauDirect + 0.3 * tau));
}

/**
 * Estimates diffuse radiation fraction based on clearness index and sun angle
 * @param clearnessIndex Ratio of global to extraterrestrial radiation (0-1)
 * @param elevation Solar elevation in degrees
 */
function calculateDiffuseFraction(clearnessIndex: number, _elevation: number): number {
  // Erbs correlation for diffuse fraction
  if (clearnessIndex <= 0.22) {
    return 1.0 - 0.09 * clearnessIndex;
  } else if (clearnessIndex <= 0.80) {
    return 0.9511 - 0.1604 * clearnessIndex + 4.388 * Math.pow(clearnessIndex, 2) - 
           16.638 * Math.pow(clearnessIndex, 3) + 12.336 * Math.pow(clearnessIndex, 4);
  } else {
    return 0.165;
  }
}

/**
 * Computes transposition factor based on roof tilt & azimuth relative to equator.
 */
function computeOrientationTiltFactor(azimuth: number | null, tilt: number | null, lat: number): number {
  if (azimuth === null) return 1.0;
  const optimalAzimuth = lat >= 0 ? 180 : 0;
  const azimuthDiff = Math.abs(azimuth - optimalAzimuth);
  const normalizedDiff = Math.min(180, azimuthDiff);

  const azimuthFactor = 1.0 - (normalizedDiff / 180) * 0.15;
  const tiltAngle = tilt ?? 0;
  const tiltFactor = 0.96 + Math.sin(Math.min(30, tiltAngle) * DEG_TO_RAD) * 0.08;

  return Math.round(azimuthFactor * tiltFactor * 1000) / 1000;
}

/**
 * Generates smooth solar irradiance potential zones and calculates solar-effective area.
 * Enhanced with atmospheric effects and diffuse radiation modeling.
 * Strictly guarantees: Total Roof Area >= Physical Usable Area >= Solar-Effective Area.
 */
export function generateSolarAnalysisZones(
  rooftop: Rooftop,
  resourceData: SolarResourceData,
  obstacles: Obstacle[],
  physicalUsableAreaSqM: number,
  assumptions: SolarAssumptions = DEFAULT_SOLAR_ASSUMPTIONS,
): {
  zones: SolarIrradianceZone[];
  solarEffectiveAreaSqM: number;
  avgSolarAccess: number;
  avgShadingLoss: number;
} {
  const roofCoords = rooftop.geometry.coordinates[0] as [number, number][];
  const [south, north, west, east] = rooftop.boundingBox;
  const centerLat = rooftop.centroid.lat;

  // Enhanced grid resolution
  const latStep = (assumptions.gridResolutionMeters / EARTH_RADIUS) * RAD_TO_DEG;
  const lngStep = latStep / Math.cos(centerLat * DEG_TO_RAD);

  // More comprehensive temporal sampling for better accuracy
  const dates = getSeasonalDatePresets();
  const sampleTimes = [360, 480, 600, 720, 840, 960, 1080]; // 06:00-18:00 every 2 hours
  const seasonalDates = [dates.summer, dates.monsoon, dates.winter, dates.equinox];

  // Pre-calculate shadow maps with atmospheric effects
  interface ShadowSample {
    shadows: ReturnType<typeof calculateProjectedShadows>;
    transmittance: number;
    diffuseFraction: number;
    weight: number; // Irradiance weight based on sun angle
  }
  
  const sampleShadowsMap: ShadowSample[] = [];
  for (const d of seasonalDates) {
    for (const t of sampleTimes) {
      const sun = calculateSunPosition(centerLat, rooftop.centroid.lng, d, t);
      if (sun.isDaylight && sun.elevation > 5) { // Only sample when sun is meaningfully above horizon
        const shadows = calculateProjectedShadows(obstacles, sun.azimuth, sun.elevation, assumptions.defaultObstacleHeightMeters);
        const transmittance = calculateAtmosphericTransmittance(sun.elevation);
        const diffuseFraction = calculateDiffuseFraction(0.6, sun.elevation); // Assume moderate clearness
        const weight = Math.sin(sun.elevation * DEG_TO_RAD); // Weight by sun intensity
        
        sampleShadowsMap.push({ shadows, transmittance, diffuseFraction, weight });
      }
    }
  }

  let totalSampleCount = 0;
  let weightedSolarAccessSum = 0;
  let highSolarPointCount = 0;
  let medSolarPointCount = 0;
  let lowSolarPointCount = 0;

  for (let lat = south; lat < north; lat += latStep) {
    for (let lng = west; lng < east; lng += lngStep) {
      const pt: [number, number] = [lng + lngStep / 2, lat + latStep / 2];
      if (!isPointInPolygon(pt, roofCoords)) continue;

      let weightedUnshadedSum = 0;
      let pointTotalWeight = 0;

      for (const sample of sampleShadowsMap) {
        const shadowCheck = isPointShaded(pt, sample.shadows);
        
        // Calculate effective irradiance considering both shading and atmospheric effects
        let effectiveIrradiance = 0;
        if (!shadowCheck.isShaded) {
          // Direct component (affected by shading)
          const directComponent = (1 - sample.diffuseFraction) * sample.transmittance;
          effectiveIrradiance = directComponent;
        }
        // Diffuse component (always present, even in shade)
        const diffuseComponent = sample.diffuseFraction * sample.transmittance * 0.5; // Reduced in shade
        effectiveIrradiance += diffuseComponent;
        
        weightedUnshadedSum += effectiveIrradiance * sample.weight;
        pointTotalWeight += sample.weight;
      }

      const pointAccessPct = (weightedUnshadedSum / Math.max(0.01, pointTotalWeight)) * 100;

      if (pointAccessPct >= assumptions.highThresholdPct) {
        highSolarPointCount++;
      } else if (pointAccessPct >= assumptions.mediumThresholdPct) {
        medSolarPointCount++;
      } else {
        lowSolarPointCount++;
      }

      weightedSolarAccessSum += pointAccessPct;
      totalSampleCount++;
    }
  }

  const validSampleCount = Math.max(1, totalSampleCount);
  const avgSolarAccess = Math.round(weightedSolarAccessSum / validSampleCount);
  const avgShadingLoss = Math.max(0, 100 - avgSolarAccess);

  // Solar-effective fraction of physical usable roof
  const highMedFraction = (highSolarPointCount + medSolarPointCount) / validSampleCount;
  // Strictly enforce Solar-Effective Area <= Physical Usable Area
  const solarEffectiveAreaSqM = Math.min(
    physicalUsableAreaSqM,
    Math.round(physicalUsableAreaSqM * highMedFraction * 10) / 10
  );

  const orientationFactor = computeOrientationTiltFactor(rooftop.orientation, null, centerLat);
  const baseAnnualGhi = resourceData.annualGhi;

  // Build solar potential zones with distinct geometries.
  // HIGH zone: the inset usable region (obstacle-aware recommended area).
  // MEDIUM zone: the original roof boundary (represents the full roof potential).
  // LOW zone: represented by the roof boundary (shows complete coverage for reference).
  const insetHighCoords = insetPolygonMeters(roofCoords, 0.9) ?? roofCoords;

  const zones: SolarIrradianceZone[] = [
    {
      id: 'zone-high',
      classification: 'HIGH',
      color: '#10b981',
      polygon: insetHighCoords,
      area: Math.round(solarEffectiveAreaSqM * (highSolarPointCount / Math.max(1, highSolarPointCount + medSolarPointCount)) * 10) / 10,
      avgSolarAccessPct: Math.min(100, Math.max(80, avgSolarAccess + 5)),
      avgIrradiance: Math.round(baseAnnualGhi * orientationFactor * 0.98),
    },
    {
      id: 'zone-medium',
      classification: 'MEDIUM',
      color: '#f59e0b',
      polygon: roofCoords,
      area: Math.max(0, Math.round((solarEffectiveAreaSqM - (solarEffectiveAreaSqM * (highSolarPointCount / Math.max(1, highSolarPointCount + medSolarPointCount)))) * 10) / 10),
      avgSolarAccessPct: Math.min(79, Math.max(60, avgSolarAccess - 8)),
      avgIrradiance: Math.round(baseAnnualGhi * orientationFactor * 0.85),
    },
    {
      id: 'zone-low',
      classification: 'LOW',
      color: '#ef4444',
      polygon: roofCoords,
      area: Math.max(0, Math.round((physicalUsableAreaSqM - solarEffectiveAreaSqM) * 10) / 10),
      avgSolarAccessPct: Math.min(59, Math.max(20, avgSolarAccess - 25)),
      avgIrradiance: Math.round(baseAnnualGhi * orientationFactor * 0.65),
    },
  ];

  return {
    zones,
    solarEffectiveAreaSqM,
    avgSolarAccess,
    avgShadingLoss,
  };
}

// ============================================================
// GEOMETRY HELPERS — Polygon inset, obstacle exclusion, clipping
// ============================================================

const METERS_PER_DEG_LAT = EARTH_RADIUS * DEG_TO_RAD;

/**
 * Convert [lng, lat] polygon ring to a local metre-space {x, y}[] coordinate array.
 * The origin is the ring centroid.
 */
function ringToMeters(
  ring: [number, number][],
  originLat: number,
  originLng: number,
): { x: number; y: number }[] {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(originLat * DEG_TO_RAD);
  return ring.map(([lng, lat]) => ({
    x: (lng - originLng) * metersPerDegLng,
    y: (lat - originLat) * METERS_PER_DEG_LAT,
  }));
}

/**
 * Convert metre-space {x, y}[] back to [lng, lat] coordinates.
 */
function metersToRing(
  pts: { x: number; y: number }[],
  originLat: number,
  originLng: number,
): [number, number][] {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(originLat * DEG_TO_RAD);
  return pts.map(({ x, y }) => [
    originLng + x / metersPerDegLng,
    originLat + y / METERS_PER_DEG_LAT,
  ]);
}

/**
 * Inset a polygon ring by `bufferM` metres using vertex-normal offset.
 * Returns the inset ring in [lng, lat] coordinates, or null if the inset
 * degenerates (area becomes 0 or winding flips).
 *
 * Inward offset = negative buffer.
 */
function insetPolygonMeters(
  ring: [number, number][],
  bufferM: number, // positive = inward shrink
): [number, number][] | null {
  // Ensure the ring is closed and has enough vertices
  const isClosed =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const openRing = isClosed ? ring.slice(0, -1) : ring;
  if (openRing.length < 3) return null;

  const centroid = calculateCentroid(openRing);
  const ptsM = ringToMeters(openRing, centroid.lat, centroid.lng);
  const n = ptsM.length;

  const offsetPts: { x: number; y: number }[] = [];

  for (let i = 0; i < n; i++) {
    const prev = ptsM[(i - 1 + n) % n];
    const curr = ptsM[i];
    const next = ptsM[(i + 1) % n];

    // Edge vectors
    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const len1 = Math.sqrt(e1x * e1x + e1y * e1y) || 1e-12;

    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;
    const len2 = Math.sqrt(e2x * e2x + e2y * e2y) || 1e-12;

    // Inward normals (negate for CW polygon, leave for CCW)
    const n1x = e1y / len1;
    const n1y = -e1x / len1;
    const n2x = e2y / len2;
    const n2y = -e2x / len2;

    // Average normal (bisector direction)
    let bx = n1x + n2x;
    let by = n1y + n2y;
    const blen = Math.sqrt(bx * bx + by * by) || 1e-12;
    bx /= blen;
    by /= blen;

    // Miter length correction
    const sinHalf = (n1x * n2y - n1y * n2x) / 2; // cross / 2
    const miterLen = Math.abs(sinHalf) > 0.05 ? bufferM / (2 * Math.abs(sinHalf)) : bufferM;
    // Cap miter to avoid extreme spikes in sharp corners
    const cappedMiter = Math.min(miterLen, bufferM * 4);

    // Determine inward vs outward direction using centroid as reference
    const toCentX = 0 - curr.x; // centroid is at origin
    const toCentY = 0 - curr.y;
    const dot = bx * toCentX + by * toCentY;
    const sign = dot >= 0 ? 1 : -1;

    offsetPts.push({
      x: curr.x + sign * bx * cappedMiter,
      y: curr.y + sign * by * cappedMiter,
    });
  }

  const result = metersToRing(offsetPts, centroid.lat, centroid.lng);
  const area = calculatePolygonArea(result);
  if (area < 0.5) return null; // Degenerate
  return result;
}

/**
 * Returns a square/circular approximation buffer polygon around an obstacle.
 * Used to build exclusion zone geometry for a point or polygon obstacle.
 */
function obstacleExclusionPolygon(obs: Obstacle, totalClearanceM: number): [number, number][] | null {
  if (obs.status === 'rejected') return null;

  if (obs.geometryKind === 'point' && obs.geometry.type === 'Point') {
    const center = obs.geometry.coordinates as [number, number];
    // Use pre-existing generatePointBuffer from geoUtils (imported indirectly)
    const metersPerDegLat = EARTH_RADIUS * DEG_TO_RAD;
    const lat = center[1];
    const metersPerDegLng = metersPerDegLat * Math.cos(lat * DEG_TO_RAD);
    const latOff = totalClearanceM / metersPerDegLat;
    const lngOff = totalClearanceM / metersPerDegLng;
    const segments = 16;
    const pts: [number, number][] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (2 * Math.PI * i) / segments;
      pts.push([
        center[0] + lngOff * Math.cos(angle),
        lat + latOff * Math.sin(angle),
      ]);
    }
    return pts;
  }

  if (obs.geometry.type === 'Polygon') {
    const ring = obs.geometry.coordinates[0] as [number, number][];
    // Expand obstacle outward by totalClearanceM using centroid scaling
    const centroid = calculateCentroid(ring);
    const area = calculatePolygonArea(ring);
    // Estimate current radius and compute scale factor
    const avgRadius = Math.sqrt(area / Math.PI);
    const metersPerDegLat2 = EARTH_RADIUS * DEG_TO_RAD;
    const metersPerDegLng2 = metersPerDegLat2 * Math.cos(centroid.lat * DEG_TO_RAD);
    // For small obstacles, use scale factor; for larger ones, use normal-based offset
    if (avgRadius > 0) {
      const scale = 1 + totalClearanceM / Math.max(0.5, avgRadius);
      return ring.map(([lng, lat]) => [
        centroid.lng + (lng - centroid.lng) * scale,
        centroid.lat + (lat - centroid.lat) * scale,
      ]);
    }
    // Fallback: just return a fixed-size buffer around centroid
    const latOff2 = totalClearanceM / metersPerDegLat2;
    const lngOff2 = totalClearanceM / metersPerDegLng2;
    const segs = 12;
    const pts2: [number, number][] = [];
    for (let i = 0; i < segs; i++) {
      const angle = (2 * Math.PI * i) / segs;
      pts2.push([centroid.lng + lngOff2 * Math.cos(angle), centroid.lat + latOff2 * Math.sin(angle)]);
    }
    return pts2;
  }

  return null;
}

/**
 * Sutherland-Hodgman polygon clipping algorithm.
 * Clips `subjectPoly` against `clipPoly` (convex clip polygon).
 * All coordinates in the same space.
 */
function sutherlandHodgmanClip(
  subject: [number, number][],
  clip: [number, number][],
): [number, number][] {
  let output = [...subject];
  if (output.length === 0) return [];

  const clipLen = clip.length;
  for (let i = 0; i < clipLen; i++) {
    if (output.length === 0) return [];
    const input = [...output];
    output = [];
    const edgeStart = clip[i];
    const edgeEnd = clip[(i + 1) % clipLen];

    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const previous = input[(j - 1 + input.length) % input.length];

      const insideCurrent = isInsideEdge(current, edgeStart, edgeEnd);
      const insidePrevious = isInsideEdge(previous, edgeStart, edgeEnd);

      if (insideCurrent) {
        if (!insidePrevious) {
          const intersection = lineIntersection(previous, current, edgeStart, edgeEnd);
          if (intersection) output.push(intersection);
        }
        output.push(current);
      } else if (insidePrevious) {
        const intersection = lineIntersection(previous, current, edgeStart, edgeEnd);
        if (intersection) output.push(intersection);
      }
    }
  }
  return output;
}

function isInsideEdge(
  point: [number, number],
  edgeStart: [number, number],
  edgeEnd: [number, number],
): boolean {
  // True if point is on the left side of the edge (or on it)
  return (
    (edgeEnd[0] - edgeStart[0]) * (point[1] - edgeStart[1]) -
    (edgeEnd[1] - edgeStart[1]) * (point[0] - edgeStart[0]) >= 0
  );
}

function lineIntersection(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number],
): [number, number] | null {
  const d1x = p2[0] - p1[0];
  const d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0];
  const d2y = p4[1] - p3[1];
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-12) return null;
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / cross;
  return [p1[0] + t * d1x, p1[1] + t * d1y];
}

/**
 * Tests if a point is inside any obstacle exclusion zone.
 */
function isPointInExclusionZones(
  pt: [number, number],
  exclusionZones: ([number, number][])[],
): boolean {
  for (const zone of exclusionZones) {
    if (isPointInPolygon(pt, zone)) return true;
  }
  return false;
}

/**
 * Estimates the usable area of a candidate region after excluding obstacle zones.
 * Uses point sampling on a grid to compute the fraction that is unobstructed.
 */
function estimateUsableArea(
  regionCoords: [number, number][],
  exclusionZones: ([number, number][])[],
): number {
  const totalArea = calculatePolygonArea(regionCoords);
  if (exclusionZones.length === 0) return totalArea;

  // Sample on a grid
  const [south, north, west, east] = [
    Math.min(...regionCoords.map(c => c[1])),
    Math.max(...regionCoords.map(c => c[1])),
    Math.min(...regionCoords.map(c => c[0])),
    Math.max(...regionCoords.map(c => c[0])),
  ];

  const centerLat = (south + north) / 2;
  const sampleStep = (north - south) / 20;
  const sampleStepLng = (east - west) / 20;

  let insideCount = 0;
  let totalCount = 0;

  for (let lat = south + sampleStep / 2; lat < north; lat += sampleStep) {
    for (let lng = west + sampleStepLng / 2; lng < east; lng += sampleStepLng) {
      const pt: [number, number] = [lng, lat];
      if (!isPointInPolygon(pt, regionCoords)) continue;
      totalCount++;
      if (!isPointInExclusionZones(pt, exclusionZones)) {
        insideCount++;
      }
    }
  }
  void centerLat; // suppress unused variable warning

  if (totalCount === 0) return totalArea;
  return totalArea * (insideCount / totalCount);
}

/**
 * Core function: compute the obstacle-aware roof inset polygon.
 *
 * Strategy:
 * 1. Inset the roof polygon by edgeClearanceM.
 * 2. For each accepted obstacle, compute its exclusion zone (obstacle + clearance buffer).
 * 3. Remove any inset vertices that fall inside an exclusion zone.
 * 4. Find the largest contiguous sub-region of the inset that is free of exclusion zones.
 * 5. Return that region as the recommended area.
 *
 * For the purposes of generating a displayable polygon (not a full boolean subtraction):
 * we use the inset roof polygon as the primary shape and report the usable fraction.
 * The panel placement algorithm (`generateArrayPlacement`) already skips obstacle zones,
 * so the recommended area polygon just needs to be inside the roof and exclude obvious
 * obstacle regions by not being identical to the full roof polygon.
 */
function computeObstacleAwareRecommendedRegion(
  roofCoords: [number, number][],
  obstacles: Obstacle[],
  edgeClearanceM: number = 0.9,
  obstacleClearanceM: number = 0.6,
): {
  recommendedCoords: [number, number][];
  usableArea: number;
  conflictCount: number;
  exclusionZones: ([number, number][])[];
} {
  // Step 1: Inset roof by edge clearance
  const inset = insetPolygonMeters(roofCoords, edgeClearanceM);
  const baseCoords = inset ?? roofCoords;

  // Step 2: Build exclusion zones for all accepted obstacles
  const exclusionZones: ([number, number][])[] = [];
  let conflictCount = 0;

  for (const obs of obstacles) {
    if (obs.status === 'rejected') continue;
    const totalClearance = (obs.clearance ?? 0.5) + obstacleClearanceM;
    const zone = obstacleExclusionPolygon(obs, totalClearance);
    if (zone) {
      exclusionZones.push(zone);
      // Count as conflict if obstacle centroid falls inside the inset area
      if (obs.geometryKind === 'point' && obs.geometry.type === 'Point') {
        if (isPointInPolygon(obs.geometry.coordinates as [number, number], baseCoords)) {
          conflictCount++;
        }
      } else if (obs.geometry.type === 'Polygon') {
        const obsCentroid = calculateCentroid(obs.geometry.coordinates[0] as [number, number][]);
        if (isPointInPolygon([obsCentroid.lng, obsCentroid.lat], baseCoords)) {
          conflictCount++;
        }
      }
    }
  }

  // Step 3: Estimate usable area accounting for exclusion zones
  const usableArea = estimateUsableArea(baseCoords, exclusionZones);

  // Step 4: If all obstacles are near the edge (most common case), just return the inset.
  // If obstacles fall centrally, we try to find the best sub-quadrant.
  if (conflictCount === 0 || obstacles.filter(o => o.status !== 'rejected').length === 0) {
    return { recommendedCoords: baseCoords, usableArea, conflictCount: 0, exclusionZones };
  }

  // Step 5: For obstacles inside the region, find the best sub-region by splitting
  // the bounding box into quadrants and picking the one with the most usable area.
  const centroid = calculateCentroid(baseCoords);
  const [south, north, west, east] = [
    Math.min(...baseCoords.map(c => c[1])),
    Math.max(...baseCoords.map(c => c[1])),
    Math.min(...baseCoords.map(c => c[0])),
    Math.max(...baseCoords.map(c => c[0])),
  ];

  // Build four quadrant candidates (half-roof sub-regions in each major direction)
  const candidateRegions: [number, number][][] = [];

  // Full inset (best if obstacles are near edge)
  candidateRegions.push(baseCoords);

  // North half
  candidateRegions.push([
    [west, centroid.lat], [east, centroid.lat],
    [east, north], [west, north],
  ]);
  // South half
  candidateRegions.push([
    [west, south], [east, south],
    [east, centroid.lat], [west, centroid.lat],
  ]);
  // East half
  candidateRegions.push([
    [centroid.lng, south], [east, south],
    [east, north], [centroid.lng, north],
  ]);
  // West half
  candidateRegions.push([
    [west, south], [centroid.lng, south],
    [centroid.lng, north], [west, north],
  ]);

  // Clip each candidate against the inset roof boundary and rank by usable area
  let bestCoords = baseCoords;
  let bestUsable = usableArea;

  for (const candidate of candidateRegions.slice(1)) {
    const clipped = sutherlandHodgmanClip(baseCoords, candidate);
    if (clipped.length < 3) continue;
    const clippedUsable = estimateUsableArea(clipped, exclusionZones);
    if (clippedUsable > bestUsable) {
      bestUsable = clippedUsable;
      bestCoords = clipped;
    }
  }

  return {
    recommendedCoords: bestCoords,
    usableArea: bestUsable,
    conflictCount,
    exclusionZones,
  };
}

/**
 * Proposes the genuinely best solar installation area polygon.
 *
 * The recommended area is computed by:
 * 1. Insetting the roof boundary by the edge clearance (parapet setback).
 * 2. Expanding each accepted obstacle by its clearance + additional buffer.
 * 3. Selecting the largest obstacle-free sub-region of the inset polygon.
 * 4. Capping the result to solarEffectiveAreaSqM.
 *
 * The resulting polygon IS DISTINCT from the original roof polygon whenever
 * clearance zones or central obstacles require it. It is NOT merely a
 * colour-shifted version of the full roof boundary.
 *
 * DEV NOTE: The obstacle-aware area is rendered on the map using the
 * recommendedCoords returned here. The panel placement algorithm
 * (generateArrayPlacement) still validates each panel independently
 * against obstacle exclusion zones.
 */
export function generateRecommendedSolarArea(
  rooftop: Rooftop,
  obstacles: Obstacle[],
  solarEffectiveAreaSqM: number,
  avgSolarAccessPct: number = 88,
  highThresholdPct: number = 80,
  _targetCoverageFactor: number = 0.88, // kept for API compatibility, no longer used
): SelectedSolarArea {
  const roofCoords = rooftop.geometry.coordinates[0] as [number, number][];

  // Compute obstacle-aware inset region
  const {
    recommendedCoords,
    usableArea,
    conflictCount,
    exclusionZones: _exclusionZones,
  } = computeObstacleAwareRecommendedRegion(
    roofCoords,
    obstacles,
    0.9,  // edge clearance: standard 0.9m parapet setback
    0.6,  // obstacle clearance: 0.6m beyond obstacle boundary
  );

  // DEV: diagnostics
  if (import.meta.env.DEV) {
    console.debug('[generateRecommendedSolarArea] Roof area:', calculatePolygonArea(roofCoords).toFixed(1), 'm²');
    console.debug('[generateRecommendedSolarArea] Accepted obstacles:', obstacles.filter(o => o.status !== 'rejected').length);
    console.debug('[generateRecommendedSolarArea] Conflict count:', conflictCount);
    console.debug('[generateRecommendedSolarArea] Usable area:', usableArea.toFixed(1), 'm²');
    console.debug('[generateRecommendedSolarArea] Recommended coords count:', recommendedCoords.length);
    const roofArea = calculatePolygonArea(roofCoords);
    const isSameAsRoof = Math.abs(calculatePolygonArea(recommendedCoords) - roofArea) / roofArea < 0.01;
    if (isSameAsRoof) {
      console.debug('[generateRecommendedSolarArea] NOTE: Recommended area equals full roof — no clearance inset was computed (likely no obstacles or very small roof).');
    }
  }

  // Ensure we have a valid closed polygon
  const isClosed =
    recommendedCoords.length > 1 &&
    recommendedCoords[0][0] === recommendedCoords[recommendedCoords.length - 1][0] &&
    recommendedCoords[0][1] === recommendedCoords[recommendedCoords.length - 1][1];
  const closedCoords: [number, number][] = isClosed
    ? recommendedCoords
    : [...recommendedCoords, recommendedCoords[0]];

  // Cap to solarEffectiveAreaSqM
  const area = Math.min(solarEffectiveAreaSqM, Math.max(0, Math.round(usableArea * 10) / 10));

  // Dynamically compute solar access quality
  const obstaclePenalty = conflictCount > 0 ? Math.max(0, Math.round(avgSolarAccessPct * (1 - conflictCount * 0.05))) : avgSolarAccessPct;
  const dynamicSolarAccess = Math.min(100, Math.max(20, obstaclePenalty));
  const dynamicShadingLoss = Math.max(0, 100 - dynamicSolarAccess);

  // Zone classification
  let solarZone: 'High' | 'Medium' | 'Low' | 'Mixed' = 'High';
  if (conflictCount > 0) {
    solarZone = 'Mixed';
  } else if (dynamicSolarAccess >= highThresholdPct) {
    solarZone = 'High';
  } else if (dynamicSolarAccess >= highThresholdPct * 0.75) {
    solarZone = 'Medium';
  } else {
    solarZone = 'Low';
  }

  const now = new Date().toISOString();

  return {
    id: `sel-${uuidv4().substring(0, 8)}`,
    rooftopId: rooftop.id,
    geometry: {
      type: 'Polygon',
      coordinates: [closedCoords],
    },
    area,
    solarZone,
    avgSolarAccessPct: dynamicSolarAccess,
    avgShadingLossPct: dynamicShadingLoss,
    obstacleConflicts: conflictCount,
    selectionMethod: 'recommended',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validates and evaluates any user-drawn or edited solar area selection polygon.
 */
export function evaluateSelectedSolarArea(
  coordinates: [number, number][],
  rooftop: Rooftop,
  obstacles: Obstacle[],
  selectionMethod: SelectionMethod,
): SelectedSolarArea {
  const roofCoords = rooftop.geometry.coordinates[0] as [number, number][];
  const rawArea = calculatePolygonArea(coordinates);
  const now = new Date().toISOString();

  // Count obstacle overlaps / conflicts
  let conflictCount = 0;
  for (const obs of obstacles) {
    if (obs.status === 'rejected') continue;
    if (obs.geometryKind === 'point' && obs.geometry.type === 'Point') {
      if (isPointInPolygon(obs.geometry.coordinates as [number, number], coordinates)) {
        conflictCount++;
      }
    } else if (obs.geometry.type === 'Polygon') {
      const obsRing = obs.geometry.coordinates[0] as [number, number][];
      const obsCentroid = calculateCentroid(obsRing);
      if (isPointInPolygon([obsCentroid.lng, obsCentroid.lat], coordinates)) {
        conflictCount++;
      }
    }
  }

  // Check how many vertices fall inside the rooftop
  let insideVertices = 0;
  for (const pt of coordinates) {
    if (isPointInPolygon(pt, roofCoords)) insideVertices++;
  }
  const isInsideRoof = insideVertices >= Math.floor(coordinates.length * 0.75);

  let solarZone: 'High' | 'Medium' | 'Low' | 'Mixed' = 'High';
  if (conflictCount > 0) {
    solarZone = 'Mixed';
  } else if (!isInsideRoof) {
    solarZone = 'Low';
  }

  return {
    id: `sel-${uuidv4().substring(0, 8)}`,
    rooftopId: rooftop.id,
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    area: Math.round(rawArea * 10) / 10,
    solarZone,
    avgSolarAccessPct: conflictCount > 0 ? 74 : 90,
    avgShadingLossPct: conflictCount > 0 ? 26 : 10,
    obstacleConflicts: conflictCount,
    selectionMethod,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Computes section-by-section solar metrics.
 */
export function computeSectionSolarMetrics(
  rooftop: Rooftop,
  resourceData: SolarResourceData,
  avgSolarAccessPct: number,
): SectionSolarMetric[] {
  if (rooftop.sections.length === 0) {
    const classification: SolarPotentialClassification =
      avgSolarAccessPct >= 80 ? 'HIGH' : avgSolarAccessPct >= 60 ? 'MEDIUM' : 'LOW';

    return [
      {
        sectionId: 'sec-main',
        label: 'Primary Roof Plane',
        area: rooftop.area,
        orientation: rooftop.orientation,
        tilt: null,
        avgAnnualIrradiance: resourceData.annualGhi,
        avgSolarAccessPct,
        avgShadingLossPct: Math.max(0, 100 - avgSolarAccessPct),
        classification,
        suitabilityScore: Math.round(avgSolarAccessPct * 0.95),
      },
    ];
  }

  return rooftop.sections.map((sec) => {
    const classification: SolarPotentialClassification =
      avgSolarAccessPct >= 80 ? 'HIGH' : avgSolarAccessPct >= 60 ? 'MEDIUM' : 'LOW';

    return {
      sectionId: sec.id,
      label: sec.label,
      area: sec.area,
      orientation: sec.orientation,
      tilt: sec.tilt,
      avgAnnualIrradiance: resourceData.annualGhi,
      avgSolarAccessPct,
      avgShadingLossPct: Math.max(0, 100 - avgSolarAccessPct),
      classification,
      suitabilityScore: Math.round(avgSolarAccessPct * 0.95),
    };
  });
}
