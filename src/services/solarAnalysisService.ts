// ============================================
// Solar Analysis Orchestrator & Persistence Service
// ============================================

import { v4 as uuidv4 } from 'uuid';
import type { Rooftop } from '@/types/rooftop.js';
import type { SolarAnalysis, SelectedSolarArea, SolarAssumptions } from '@/types/solar.js';
import { getSolarResource } from './solarResourceService';
import { computeShadingBreakdown } from './shadingService';
import {
  generateSolarAnalysisZones,
  computeSectionSolarMetrics,
  DEFAULT_SOLAR_ASSUMPTIONS,
} from './irradianceService';
import { calculateUsableAreaBreakdown } from '@/utils/geoUtils';

const STORAGE_PREFIX = 'solarroof-solar-';

function getStorageKey(assessmentId: string): string {
  return `${STORAGE_PREFIX}${assessmentId}`;
}

/**
 * Executes full solar resource, ray-traced shading, and irradiance analysis.
 */
export async function runSolarAnalysis(
  rooftop: Rooftop,
  existingSelectedArea: SelectedSolarArea | null = null,
  assumptions: SolarAssumptions = DEFAULT_SOLAR_ASSUMPTIONS,
): Promise<SolarAnalysis> {
  const { centroid } = rooftop;

  // 1. Retrieve Solar Resource Data
  const resourceData = await getSolarResource(centroid.lat, centroid.lng);

  // 2. Physical Usable Area from Phase 3
  const usableBreakdown = calculateUsableAreaBreakdown(rooftop.area, rooftop.obstacles);

  // 3. Generate Smooth Solar Potential Zones & Solar-Effective Area
  const zoneResult = generateSolarAnalysisZones(
    rooftop,
    resourceData,
    rooftop.obstacles,
    usableBreakdown.physicalUsableArea,
    assumptions,
  );

  // 4. Compute Section-by-Section Metrics
  const sectionMetrics = computeSectionSolarMetrics(rooftop, resourceData, zoneResult.avgSolarAccess);

  // 5. Compute Shading Source Breakdown
  const shadingBreakdown = computeShadingBreakdown(rooftop.obstacles, rooftop.area);

  // 6. Overall Classification
  const avgAccess = zoneResult.avgSolarAccess;
  const overallClassification = avgAccess >= 80 ? 'HIGH' : avgAccess >= 60 ? 'MEDIUM' : 'LOW';

  // 7. Confidence Assessment
  const hasObstacleHeights = rooftop.obstacles.some((o) => o.height !== null && o.height > 0);
  const confidenceScore = hasObstacleHeights && !resourceData.isFallback ? 'HIGH' : 'MEDIUM';

  const analysis: SolarAnalysis = {
    id: `solar-${uuidv4().substring(0, 8)}`,
    assessmentId: rooftop.assessmentId,
    rooftopId: rooftop.id,
    rooftopVersionTimestamp: rooftop.updatedAt,
    status: 'completed',
    analyzedAt: new Date().toISOString(),
    resourceData,
    zones: zoneResult.zones,
    selectedArea: existingSelectedArea,
    sectionMetrics,
    shadingBreakdown,
    avgSolarAccessPct: zoneResult.avgSolarAccess,
    avgShadingImpactPct: zoneResult.avgShadingLoss,
    peakSunHoursAnnual: Math.round((resourceData.annualGhi / 365) * 100) / 100,
    grossRoofAreaSqM: rooftop.area,
    physicalUsableAreaSqM: usableBreakdown.physicalUsableArea,
    solarEffectiveAreaSqM: zoneResult.solarEffectiveAreaSqM,
    overallClassification,
    confidenceScore,
    confidenceFactors: {
      solarDataAvailable: true,
      roofGeometryAccurate: rooftop.source === 'user_drawn' || rooftop.source === 'user_corrected',
      obstacleHeightsKnown: hasObstacleHeights,
      terrainEvaluated: false,
    },
    assumptions,
    updatedAt: new Date().toISOString(),
  };

  saveSolarAnalysis(analysis);
  return analysis;
}

/**
 * Checks if the existing solar analysis was computed on an older version of the rooftop geometry.
 */
export function isAnalysisOutdated(analysis: SolarAnalysis | null, rooftop: Rooftop | null): boolean {
  if (!analysis || !rooftop) return false;
  if (analysis.rooftopId !== rooftop.id) return true;
  return analysis.rooftopVersionTimestamp !== rooftop.updatedAt;
}

// --- Persistence ---

export function saveSolarAnalysis(analysis: SolarAnalysis): void {
  try {
    sessionStorage.setItem(getStorageKey(analysis.assessmentId), JSON.stringify(analysis));
  } catch (e) {
    console.warn('Failed to persist solar analysis:', e);
  }
}

export function loadSolarAnalysis(assessmentId: string): SolarAnalysis | null {
  try {
    const stored = sessionStorage.getItem(getStorageKey(assessmentId));
    if (!stored) return null;
    return JSON.parse(stored) as SolarAnalysis;
  } catch {
    return null;
  }
}

export function clearSolarAnalysis(assessmentId: string): void {
  sessionStorage.removeItem(getStorageKey(assessmentId));
}
