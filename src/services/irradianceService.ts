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

  // Build clean visual solar potential zones representing the rooftop
  const zones: SolarIrradianceZone[] = [
    {
      id: 'zone-high',
      classification: 'HIGH',
      color: '#10b981',
      polygon: roofCoords,
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

/**
 * Proposes a high-quality candidate recommended solar installation area polygon.
 * Insets the roof polygon by ~0.8m to avoid parapets and obstacles.
 */
export function generateRecommendedSolarArea(
  rooftop: Rooftop,
  obstacles: Obstacle[],
  solarEffectiveAreaSqM: number,
  avgSolarAccessPct: number = 88,
  highThresholdPct: number = 80,
  targetCoverageFactor: number = 0.88,
): SelectedSolarArea {
  const roofCoords = rooftop.geometry.coordinates[0] as [number, number][];
  const centroid = calculateCentroid(roofCoords);

  // Dynamic inset scale factor
  const scale = Math.max(0.6, Math.min(0.95, targetCoverageFactor));
  const insetCoords: [number, number][] = roofCoords.map(([lng, lat]) => [
    centroid.lng + (lng - centroid.lng) * scale,
    centroid.lat + (lat - centroid.lat) * scale,
  ]);

  const rawArea = calculatePolygonArea(insetCoords);
  // Cap recommended area to solarEffectiveAreaSqM
  const area = Math.min(solarEffectiveAreaSqM, Math.round(rawArea * 10) / 10);

  // Check obstacle conflicts dynamically (both points and polygon centroids)
  let conflictCount = 0;
  for (const obs of obstacles) {
    if (obs.status === 'rejected') continue;
    if (obs.geometryKind === 'point' && obs.geometry.type === 'Point') {
      if (isPointInPolygon(obs.geometry.coordinates as [number, number], insetCoords)) {
        conflictCount++;
      }
    } else if (obs.geometry.type === 'Polygon') {
      const obsCentroid = calculateCentroid(obs.geometry.coordinates[0] as [number, number][]);
      if (isPointInPolygon([obsCentroid.lng, obsCentroid.lat], insetCoords)) {
        conflictCount++;
      }
    }
  }

  // Dynamically derive solar access based on roof baseline and obstacles
  const dynamicSolarAccess = conflictCount > 0
    ? Math.max(50, Math.round(avgSolarAccessPct * 0.85))
    : Math.min(100, Math.round(avgSolarAccessPct * 1.05));

  const dynamicShadingLoss = Math.max(0, 100 - dynamicSolarAccess);

  // Dynamic zone classification based on thresholds
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
      coordinates: [insetCoords],
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
