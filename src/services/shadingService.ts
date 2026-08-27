// ============================================
// Shading Engine — 3D Obstacle Shadow Ray-Tracing
// ============================================

import type { Obstacle } from '@/types/rooftop.js';
import type { ProjectedShadow, ShadingSourceBreakdown } from '@/types/solar.js';
import { isPointInPolygon } from '@/utils/geoUtils';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS = 6378137;

/**
 * Calculates the geometric shadow projection for all active obstacles on the rooftop
 * at a specific solar azimuth and elevation.
 */
export function calculateProjectedShadows(
  obstacles: Obstacle[],
  sunAzimuth: number,
  sunElevation: number,
  defaultHeightMeters: number = 1.5,
): ProjectedShadow[] {
  // If sun is at or below horizon, no ray-traced shadows exist
  if (sunElevation <= 1) {
    return [];
  }

  // Shadow direction is opposite to sun azimuth
  const shadowAzimuthDeg = (sunAzimuth + 180) % 360;
  const shadowAzimuthRad = shadowAzimuthDeg * DEG_TO_RAD;

  // Elevation angle clamped to minimum 3° to avoid infinite length at horizon
  const effectiveElevationRad = Math.max(3, sunElevation) * DEG_TO_RAD;
  const tanElevation = Math.tan(effectiveElevationRad);

  const projected: ProjectedShadow[] = [];

  for (const obs of obstacles) {
    if (obs.status === 'rejected') continue;

    const height = obs.height ?? defaultHeightMeters;
    if (height <= 0) continue;

    // Shadow length in meters: L = height / tan(elevation)
    // Capped at 25 meters for rooftop realism
    const shadowLengthMeters = Math.min(25, height / tanElevation);

    const dx = shadowLengthMeters * Math.sin(shadowAzimuthRad); // East displacement (m)
    const dy = shadowLengthMeters * Math.cos(shadowAzimuthRad); // North displacement (m)

    // Base obstacle coordinates in [lng, lat]
    let baseRing: [number, number][] = [];

    if (obs.geometryKind === 'point' && obs.geometry.type === 'Point') {
      const [lng, lat] = obs.geometry.coordinates;
      const radiusMeters = 0.6;
      const dLat = (radiusMeters / EARTH_RADIUS) * RAD_TO_DEG;
      const dLng = dLat / Math.cos(lat * DEG_TO_RAD);

      baseRing = [
        [lng - dLng, lat - dLat],
        [lng + dLng, lat - dLat],
        [lng + dLng, lat + dLat],
        [lng - dLng, lat + dLat],
        [lng - dLng, lat - dLat],
      ];
    } else if (obs.geometry.type === 'Polygon') {
      baseRing = obs.geometry.coordinates[0] as [number, number][];
    }

    if (baseRing.length < 3) continue;

    const centroidLat = baseRing[0][1];
    const deltaLat = (dy / EARTH_RADIUS) * RAD_TO_DEG;
    const deltaLng = (dx / (EARTH_RADIUS * Math.cos(centroidLat * DEG_TO_RAD))) * RAD_TO_DEG;

    // Top extruded ring shifted by (deltaLng, deltaLat)
    const topRing: [number, number][] = baseRing.map(([lng, lat]) => [lng + deltaLng, lat + deltaLat]);

    // Construct the convex hull / bounding shadow polygon from base to top
    // For realistic Leaflet overlay, form a complete polygon from base vertices + top vertices
    const shadowPoly: [number, number][] = [
      ...baseRing.slice(0, -1),
      ...topRing.slice(0, -1).reverse(),
      baseRing[0],
    ];

    projected.push({
      obstacleId: obs.id,
      obstacleType: obs.type,
      obstacleLabel: obs.label || obs.type.replace(/_/g, ' '),
      shadowPolygon: shadowPoly,
      shadowLengthMeters: Math.round(shadowLengthMeters * 10) / 10,
      shadowAzimuth: Math.round(shadowAzimuthDeg * 10) / 10,
    });
  }

  return projected;
}

/**
 * Checks if a specific [lng, lat] point is currently covered by any projected shadow.
 */
export function isPointShaded(
  point: [number, number],
  shadows: ProjectedShadow[],
): { isShaded: boolean; obstacleLabels: string[] } {
  const sources: string[] = [];

  for (const shadow of shadows) {
    if (isPointInPolygon(point, shadow.shadowPolygon)) {
      sources.push(shadow.obstacleLabel);
    }
  }

  return {
    isShaded: sources.length > 0,
    obstacleLabels: Array.from(new Set(sources)),
  };
}

/**
 * Computes the breakdown of shading loss contributions by obstacle category.
 */
export function computeShadingBreakdown(
  obstacles: Obstacle[],
  totalRooftopArea: number,
): ShadingSourceBreakdown[] {
  const categoriesMap = new Map<string, { count: number; estimatedArea: number }>();

  for (const obs of obstacles) {
    if (obs.status === 'rejected') continue;

    const catName = obs.type.replace(/_/g, ' ').toUpperCase();
    const current = categoriesMap.get(catName) || { count: 0, estimatedArea: 0 };

    const area = obs.area ?? (obs.clearance * obs.clearance * Math.PI);
    const shadowFactor = (obs.height ?? 1.5) * 1.4; // Average daily shadow footprint multiplier

    categoriesMap.set(catName, {
      count: current.count + 1,
      estimatedArea: current.estimatedArea + area * shadowFactor,
    });
  }

  const result: ShadingSourceBreakdown[] = [];
  let totalShadowArea = 0;

  categoriesMap.forEach((val) => {
    totalShadowArea += val.estimatedArea;
  });

  categoriesMap.forEach((val, key) => {
    const impactPct = totalShadowArea > 0 ? Math.round((val.estimatedArea / totalRooftopArea) * 100 * 10) / 10 : 0;
    result.push({
      sourceType: key,
      impactPct: Math.min(25, impactPct),
      affectedAreaSqM: Math.round(val.estimatedArea * 10) / 10,
    });
  });

  return result.sort((a, b) => b.impactPct - a.impactPct);
}
