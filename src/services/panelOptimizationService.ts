import type { Rooftop, Obstacle } from '@/types/rooftop.js';
import type { SolarAnalysis, SelectedSolarArea } from '@/types/solar.js';
import type { ElectricityConsumptionProfile } from '@/types/index.js';
import type {
  PanelSpecification,
  DesignConstraints,
  OptimizationObjective,
  PanelInstance,
  PanelLayout,
} from '@/types/optimization.js';
import { isPointInPolygon } from '@/utils/geoUtils';
import { calculateRequiredPanelCount } from '@/utils/consumptionUtils';

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS = 6378137;

// --- Building Code and Structural Constraints ---

export interface StructuralValidation {
  loadCapacityCheck: 'pass' | 'warning' | 'fail';
  windZoneCompliance: 'pass' | 'unknown';
  fireAccessCompliance: 'pass' | 'warning';
  issues: string[];
  recommendations: string[];
}

export interface CodeCompliance {
  edgeClearance: { required: number; actual: number; compliant: boolean };
  obstacleClearance: { required: number; actual: number; compliant: boolean };
  walkwayWidth: { required: number; actual: number; compliant: boolean };
  fireAccess: { required: boolean; provided: boolean; compliant: boolean };
  structuralLoad: { maxKgPerSqM: number; actualKgPerSqM: number; compliant: boolean };
}

/**
 * Validates structural suitability for solar panel installation
 * Based on typical rooftop solar structural requirements
 */
function validateStructuralRequirements(
  rooftop: Rooftop,
  panelCount: number,
  _panelSpec: PanelSpecification,
): StructuralValidation {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Estimate panel weight: typical solar panel ~20-25 kg + mounting ~10 kg
  const avgPanelWeightKg = 22;
  const mountingWeightKg = 10;
  const totalWeightKg = panelCount * (avgPanelWeightKg + mountingWeightKg);
  const roofArea = rooftop.area;
  const loadPerSqM = totalWeightKg / roofArea;

  // Typical flat roof load capacity: 150-300 kg/m² (residential), 300-500 kg/m² (commercial)
  // Solar system typically adds 15-25 kg/m²
  const typicalSolarLoadKgPerSqM = 20;
  const maxRecommendedLoad = 25; // Conservative threshold

  let loadCapacityCheck: 'pass' | 'warning' | 'fail' = 'pass';

  if (loadPerSqM > maxRecommendedLoad) {
    loadCapacityCheck = 'warning';
    issues.push(`Estimated load (${loadPerSqM.toFixed(1)} kg/m²) exceeds typical solar load capacity. Structural engineer assessment required.`);
  } else if (loadPerSqM > typicalSolarLoadKgPerSqM) {
    recommendations.push(`Load approaches ${loadPerSqM.toFixed(1)} kg/m². Verify roof structural capacity before installation.`);
  }

  // Wind zone compliance (cannot determine without location-specific data)
  const windZoneCompliance: 'pass' | 'unknown' = 'unknown';
  recommendations.push('Verify wind load calculations per local building codes (ASCE 7 or equivalent).');

  // Fire access compliance (check for sufficient walkways)
  let fireAccessCompliance: 'pass' | 'warning' = 'pass';
  const roofDiagonal = Math.sqrt(2 * roofArea); // Rough estimate

  if (roofArea > 1000) { // Large commercial roof
    recommendations.push('Large roof area detected. Ensure 1.2m wide access pathways per fire code requirements.');
  }

  if (roofDiagonal > 75) { // Very large building
    fireAccessCompliance = 'warning';
    issues.push('Building dimensions suggest fire code may require 6ft (1.8m) wide access pathways and equipment access zones.');
  }

  // Roof type considerations
  if (rooftop.roofType === 'unknown') {
    recommendations.push('Roof type not confirmed. Verify mounting system compatibility with actual roof structure.');
  }

  return {
    loadCapacityCheck,
    windZoneCompliance,
    fireAccessCompliance,
    issues,
    recommendations,
  };
}

/**
 * Validates compliance with building codes and installation standards
 */
function validateCodeCompliance(
  constraints: DesignConstraints,
  panelLayout: { panels: PanelInstance[]; occupiedAreaSqM: number },
  selectedArea: SelectedSolarArea,
): CodeCompliance {
  // IBC / IRC typical requirements for rooftop solar
  const requiredEdgeClearance = 0.9; // 3 ft typical setback from parapet
  const requiredObstacleClearance = 0.6; // 2 ft clearance from obstacles
  const requiredWalkwayWidth = 0.9; // 3 ft minimum walkway
  const requiredFireAccess = selectedArea.area > 500; // >500m² typically requires access

  // Structural load limits (conservative residential assumption)
  const maxStructuralLoadKgPerSqM = 25;
  const avgPanelKg = 22;
  const mountingKg = 10;
  const actualLoadKgPerSqM = (panelLayout.panels.length * (avgPanelKg + mountingKg)) / selectedArea.area;

  return {
    edgeClearance: {
      required: requiredEdgeClearance,
      actual: constraints.edgeClearanceM,
      compliant: constraints.edgeClearanceM >= requiredEdgeClearance * 0.9, // 10% tolerance
    },
    obstacleClearance: {
      required: requiredObstacleClearance,
      actual: constraints.obstacleClearanceM,
      compliant: constraints.obstacleClearanceM >= requiredObstacleClearance * 0.9,
    },
    walkwayWidth: {
      required: requiredWalkwayWidth,
      actual: constraints.rowSpacingM,
      compliant: constraints.rowSpacingM >= requiredWalkwayWidth * 0.8, // Walkway can be narrower than row spacing
    },
    fireAccess: {
      required: requiredFireAccess,
      provided: constraints.edgeClearanceM >= 0.9 && constraints.rowSpacingM >= 0.8,
      compliant: !requiredFireAccess || (constraints.edgeClearanceM >= 0.9 && constraints.rowSpacingM >= 0.8),
    },
    structuralLoad: {
      maxKgPerSqM: maxStructuralLoadKgPerSqM,
      actualKgPerSqM: Math.round(actualLoadKgPerSqM * 10) / 10,
      compliant: actualLoadKgPerSqM <= maxStructuralLoadKgPerSqM,
    },
  };
}

export const DEFAULT_DESIGN_CONSTRAINTS: DesignConstraints = {
  orientation: 'portrait',
  tiltDeg: 15,
  azimuthDeg: 180, // Default South-facing
  edgeClearanceM: 0.9, // Increased from 0.5 for code compliance
  obstacleClearanceM: 0.6, // Increased from 0.3 for safety
  rowSpacingM: 0.9, // Increased from 0.7 for walkway access
  panelSpacingM: 0.02,
  maxPanelCount: null,
  targetCapacityKWp: null,
};

/**
 * Checks if all 4 corners of a panel rectangle fall inside a boundary polygon.
 */
function isPanelInsidePolygon(
  corners: [number, number][],
  boundary: [number, number][],
): boolean {
  for (const corner of corners) {
    if (!isPointInPolygon(corner, boundary)) return false;
  }
  return true;
}

/**
 * Checks if a panel collides with any rooftop obstacle or clearance zone.
 */
function isPanelCollidingWithObstacles(
  corners: [number, number][],
  obstacles: Obstacle[],
  extraClearanceM: number,
): boolean {
  // Approximate centroid of panel
  const centroidLng = (corners[0][0] + corners[2][0]) / 2;
  const centroidLat = (corners[0][1] + corners[2][1]) / 2;

  for (const obs of obstacles) {
    if (obs.status === 'rejected') continue;

    const totalClearanceM = (obs.clearance || 0.5) + extraClearanceM;

    if (obs.geometryKind === 'point' && obs.geometry.type === 'Point') {
      const [obsLng, obsLat] = obs.geometry.coordinates;
      // Haversine / flat earth distance
      const dLat = (centroidLat - obsLat) * DEG_TO_RAD;
      const dLng = (centroidLng - obsLng) * DEG_TO_RAD * Math.cos(obsLat * DEG_TO_RAD);
      const distM = Math.sqrt(dLat * dLat + dLng * dLng) * EARTH_RADIUS;

      if (distM < totalClearanceM + 0.8) {
        return true;
      }
    } else if (obs.geometry.type === 'Polygon') {
      const obsRing = obs.geometry.coordinates[0] as [number, number][];
      // Check if panel corners fall inside obstacle polygon
      for (const corner of corners) {
        if (isPointInPolygon(corner, obsRing)) return true;
      }
    }
  }

  return false;
}

interface CandidateSlot {
  u: number;
  v: number;
  geoCorners: [number, number][];
  centroidLat: number;
  centroidLng: number;
  solarZone: 'High' | 'Medium' | 'Low' | 'Mixed';
  solarAccessPct: number;
  score: number;
}

interface PlacementScanConfig {
  orientation: 'portrait' | 'landscape';
  dimAlongRow: number;
  groundProjectionCol: number;
  stepU: number;
  stepV: number;
  edgeBufferM: number;
  obstacleClearanceM: number;
}

function sampleSolarAtPoint(
  centroidLng: number,
  centroidLat: number,
  solarAnalysis?: SolarAnalysis | null,
): { solarZone: CandidateSlot['solarZone']; solarAccessPct: number; zoneScoreMultiplier: number } {
  let solarZone: CandidateSlot['solarZone'] = 'High';
  let solarAccessPct = 92;
  let zoneScoreMultiplier = 3;

  if (solarAnalysis?.zones && solarAnalysis.zones.length > 0) {
    let matchedZone = false;
    for (const zone of solarAnalysis.zones) {
      if (isPointInPolygon([centroidLng, centroidLat], zone.polygon)) {
        matchedZone = true;
        solarAccessPct = zone.avgSolarAccessPct ?? 90;
        if (zone.classification === 'HIGH') {
          solarZone = 'High';
          zoneScoreMultiplier = 3;
        } else if (zone.classification === 'MEDIUM') {
          solarZone = 'Medium';
          zoneScoreMultiplier = 2;
        } else {
          solarZone = 'Low';
          zoneScoreMultiplier = 1;
        }
        break;
      }
    }
    if (!matchedZone) {
      solarAccessPct = Math.round(solarAnalysis.avgSolarAccessPct ?? 90);
      solarZone = solarAnalysis.overallClassification === 'HIGH' ? 'High' : 'Medium';
      zoneScoreMultiplier = solarAnalysis.overallClassification === 'HIGH' ? 3 : 2;
    }
  } else if (solarAnalysis) {
    solarAccessPct = Math.round(solarAnalysis.avgSolarAccessPct ?? 90);
    solarZone = solarAnalysis.overallClassification === 'HIGH' ? 'High' : 'Medium';
    zoneScoreMultiplier = solarAnalysis.overallClassification === 'HIGH' ? 3 : 2;
  }

  return { solarZone, solarAccessPct, zoneScoreMultiplier };
}

function scanSlotsForConfig(
  config: PlacementScanConfig,
  selectedBoundary: [number, number][],
  roofBoundary: [number, number][] | null,
  obstacles: Obstacle[],
  centerLng: number,
  centerLat: number,
  metersPerDegLng: number,
  metersPerDegLat: number,
  cosR: number,
  sinR: number,
  solarAnalysis?: SolarAnalysis | null,
): CandidateSlot[] {
  const { dimAlongRow, groundProjectionCol, stepU, stepV, edgeBufferM, obstacleClearanceM } = config;
  const hu = dimAlongRow / 2;
  const hv = groundProjectionCol / 2;

  // Project selected polygon into the array's local (u, v) meter frame so the
  // grid is aligned to the polygon AABB rather than an arbitrary origin.
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const [lng, lat] of selectedBoundary) {
    const rotX = (lng - centerLng) * metersPerDegLng;
    const rotY = (lat - centerLat) * metersPerDegLat;
    const u = rotX * cosR + rotY * sinR;
    const v = -rotX * sinR + rotY * cosR;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  const spanU = Math.max(0, maxU - minU);
  const spanV = Math.max(0, maxV - minV);
  const adaptiveEdge = Math.min(
    edgeBufferM,
    Math.max(0.12, Math.min(spanU, spanV) * 0.08),
  );

  const startU = minU + adaptiveEdge + hu;
  const startV = minV + adaptiveEdge + hv;
  const endU = maxU - adaptiveEdge - hu;
  const endV = maxV - adaptiveEdge - hv;

  if (endU < startU || endV < startV) {
    return [];
  }

  const toGeoCorners = (u: number, v: number): [number, number][] => {
    const localCorners: [number, number][] = [
      [u - hu, v - hv],
      [u + hu, v - hv],
      [u + hu, v + hv],
      [u - hu, v + hv],
    ];
    return localCorners.map(([lu, lv]) => {
      const rotX = lu * cosR - lv * sinR;
      const rotY = lu * sinR + lv * cosR;
      return [centerLng + rotX / metersPerDegLng, centerLat + rotY / metersPerDegLat];
    });
  };

  const collectAtPhase = (offsetU: number, offsetV: number): CandidateSlot[] => {
    const slots: CandidateSlot[] = [];
    for (let v = startV + offsetV; v <= endV + 1e-6; v += stepV) {
      for (let u = startU + offsetU; u <= endU + 1e-6; u += stepU) {
        const geoCorners = toGeoCorners(u, v);
        if (!isPanelInsidePolygon(geoCorners, selectedBoundary)) continue;
        if (roofBoundary && roofBoundary.length >= 3 && !isPanelInsidePolygon(geoCorners, roofBoundary)) {
          continue;
        }
        if (isPanelCollidingWithObstacles(geoCorners, obstacles, obstacleClearanceM)) continue;

        const centroidLng = (geoCorners[0][0] + geoCorners[2][0]) / 2;
        const centroidLat = (geoCorners[0][1] + geoCorners[2][1]) / 2;
        const solar = sampleSolarAtPoint(centroidLng, centroidLat, solarAnalysis);
        const distFromCenterM = Math.sqrt(u * u + v * v);
        const score =
          solar.zoneScoreMultiplier * 1000 + solar.solarAccessPct * 5 - distFromCenterM * 4;

        slots.push({
          u,
          v,
          geoCorners,
          centroidLat,
          centroidLng,
          solarZone: solar.solarZone,
          solarAccessPct: solar.solarAccessPct,
          score,
        });
      }
    }
    return slots;
  };

  // Try origin-aligned grid and half-step phases; keep the densest packing.
  const phases: CandidateSlot[][] = [
    collectAtPhase(0, 0),
    collectAtPhase(stepU / 2, 0),
    collectAtPhase(0, stepV / 2),
    collectAtPhase(stepU / 2, stepV / 2),
  ];
  phases.sort((a, b) => b.length - a.length);
  return phases[0] ?? [];
}

/**
 * Packs photovoltaic modules inside the selected solar area using geometric ray-grid projection.
 * Falls back to looser spacing / the opposite orientation if the primary constraints place nothing.
 */
export function generateArrayPlacement(
  rooftop: Rooftop,
  selectedArea: SelectedSolarArea,
  panelSpec: PanelSpecification,
  constraints: DesignConstraints = DEFAULT_DESIGN_CONSTRAINTS,
  solarAnalysis?: SolarAnalysis | null,
): PanelInstance[] {
  const roofBoundary = rooftop.geometry.coordinates[0] as [number, number][];
  const selectedBoundary = selectedArea.geometry.coordinates[0] as [number, number][];

  let minLng = 180;
  let maxLng = -180;
  let minLat = 90;
  let maxLat = -90;
  for (const [lng, lat] of selectedBoundary) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const metersPerDegLat = EARTH_RADIUS * DEG_TO_RAD;
  const metersPerDegLng = metersPerDegLat * Math.cos(centerLat * DEG_TO_RAD);

  const mountAzimuth = constraints.azimuthDeg ?? rooftop.orientation ?? 180;
  const rotationRad = (mountAzimuth - 180) * DEG_TO_RAD;
  const cosR = Math.cos(rotationRad);
  const sinR = Math.sin(rotationRad);

  const tiltRad = (constraints.tiltDeg || 15) * DEG_TO_RAD;
  const primaryOrientation: 'portrait' | 'landscape' =
    constraints.orientation === 'landscape' ? 'landscape' : 'portrait';
  const altOrientation: 'portrait' | 'landscape' =
    primaryOrientation === 'portrait' ? 'landscape' : 'portrait';

  const makeConfig = (
    orientation: 'portrait' | 'landscape',
    rowSpacingM: number,
    edgeClearanceM: number,
    panelSpacingM: number,
    obstacleClearanceM: number,
  ): PlacementScanConfig => {
    const dimAlongRow = orientation === 'landscape' ? panelSpec.lengthM : panelSpec.widthM;
    const dimAlongCol = orientation === 'landscape' ? panelSpec.widthM : panelSpec.lengthM;
    const groundProjectionCol = dimAlongCol * Math.cos(tiltRad);
    return {
      orientation,
      dimAlongRow,
      groundProjectionCol,
      stepU: dimAlongRow + panelSpacingM,
      stepV: groundProjectionCol + rowSpacingM,
      edgeBufferM: edgeClearanceM,
      obstacleClearanceM,
    };
  };

  const attempts: PlacementScanConfig[] = [
    makeConfig(
      primaryOrientation,
      constraints.rowSpacingM,
      constraints.edgeClearanceM,
      constraints.panelSpacingM,
      constraints.obstacleClearanceM,
    ),
    makeConfig(
      altOrientation,
      constraints.rowSpacingM,
      constraints.edgeClearanceM,
      constraints.panelSpacingM,
      constraints.obstacleClearanceM,
    ),
    makeConfig(primaryOrientation, 0.45, 0.25, Math.min(0.02, constraints.panelSpacingM), 0.3),
    makeConfig(altOrientation, 0.35, 0.15, 0.02, 0.2),
  ];

  const selectedIsInsideRoof =
    roofBoundary &&
    roofBoundary.length >= 3 &&
    selectedBoundary.every((pt) => isPointInPolygon(pt, roofBoundary));

  let candidateSlots: CandidateSlot[] = [];
  let usedConfig = attempts[0];

  for (const attempt of attempts) {
    const slots = scanSlotsForConfig(
      attempt,
      selectedBoundary,
      selectedIsInsideRoof ? roofBoundary : null,
      rooftop.obstacles ?? [],
      centerLng,
      centerLat,
      metersPerDegLng,
      metersPerDegLat,
      cosR,
      sinR,
      solarAnalysis,
    );
    if (slots.length > candidateSlots.length) {
      candidateSlots = slots;
      usedConfig = attempt;
    }
    if (candidateSlots.length > 0 && attempt === attempts[0]) {
      break;
    }
    if (candidateSlots.length > 0 && attempt !== attempts[0]) {
      break;
    }
  }

  let selectedSlots: CandidateSlot[] = [];

  if (constraints.maxPanelCount && constraints.maxPanelCount > 0 && constraints.maxPanelCount < candidateSlots.length) {
    const ranked = [...candidateSlots].sort((a, b) => b.score - a.score);
    const topSlots = ranked.slice(0, constraints.maxPanelCount);
    selectedSlots = topSlots.sort((a, b) => {
      const vDiff = b.v - a.v;
      if (Math.abs(vDiff) > 0.05) return vDiff;
      return a.u - b.u;
    });
  } else {
    selectedSlots = [...candidateSlots].sort((a, b) => {
      const vDiff = b.v - a.v;
      if (Math.abs(vDiff) > 0.05) return vDiff;
      return a.u - b.u;
    });
  }

  const usedOrientation = usedConfig.orientation;

  return selectedSlots.map((slot, idx) => {
    const panelGeo: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [[...slot.geoCorners, slot.geoCorners[0]]],
    };

    return {
      id: `panel-${idx + 1}`,
      layoutId: 'layout-draft',
      index: idx + 1,
      geometry: panelGeo,
      centroid: { lat: slot.centroidLat, lng: slot.centroidLng },
      orientation: usedOrientation,
      lengthM: panelSpec.lengthM,
      widthM: panelSpec.widthM,
      tiltDeg: constraints.tiltDeg,
      azimuthDeg: mountAzimuth,
      sectionId: null,
      solarZone: slot.solarZone,
      solarAccessPct: slot.solarAccessPct,
      ratedPowerW: panelSpec.ratedPowerW,
      isLocked: false,
      isDeleted: false,
    };
  });
}

/**
 * Returns the existing layout when it already has placed modules; otherwise
 * generates a packed array from the selected rooftop area, panel size, spacing, and obstacles.
 */
export function ensurePlacedLayout(
  rooftop: Rooftop | null,
  solarAnalysis: SolarAnalysis | null,
  layout: PanelLayout | null,
  panelSpec: PanelSpecification,
  constraints: DesignConstraints = DEFAULT_DESIGN_CONSTRAINTS,
): PanelLayout | null {
  if (layout && layout.activePanelCount > 0 && layout.panels.some((p) => !p.isDeleted)) {
    return layout;
  }
  if (!rooftop || !solarAnalysis?.selectedArea) {
    return layout;
  }

  const panels = generateArrayPlacement(
    rooftop,
    solarAnalysis.selectedArea,
    layout?.panelSpec ?? panelSpec,
    layout?.constraints ?? constraints,
    solarAnalysis,
  );

  return evaluateLayout(
    layout?.id ?? 'layout-report',
    layout?.name ?? 'Report Array Layout',
    layout?.objective ?? 'max_capacity',
    rooftop,
    solarAnalysis.selectedArea,
    layout?.panelSpec ?? panelSpec,
    layout?.constraints ?? constraints,
    panels,
    solarAnalysis,
  );
}

/**
 * Evaluates scores and validates constraints for a candidate panel layout.
 * Enhanced with structural validation and code compliance checks.
 */
export function evaluateLayout(
  layoutId: string,
  name: string,
  objective: OptimizationObjective,
  rooftop: Rooftop,
  selectedArea: SelectedSolarArea,
  panelSpec: PanelSpecification,
  constraints: DesignConstraints,
  panels: PanelInstance[],
  solarAnalysis?: SolarAnalysis | null,
): PanelLayout {
  const activePanels = panels.filter((p) => !p.isDeleted);
  const activePanelCount = activePanels.length;

  const panelAreaM2 = panelSpec.lengthM * panelSpec.widthM;
  const occupiedAreaSqM = Math.round(activePanelCount * panelAreaM2 * 10) / 10;
  const selectedAreaSqM = Math.round(selectedArea.area * 10) / 10;
  const utilizationPct = selectedAreaSqM > 0 ? Math.min(100, Math.round((occupiedAreaSqM / selectedAreaSqM) * 100)) : 0;

  const systemCapacityKWp = Math.round(((activePanelCount * panelSpec.ratedPowerW) / 1000) * 100) / 100;

  // Enhanced validation with structural and code compliance
  const issues: string[] = [];
  const warnings: string[] = [];

  if (activePanelCount === 0) {
    issues.push('No valid panels could be placed within the selected area constraints.');
  }

  // Structural validation
  const structuralValidation = validateStructuralRequirements(rooftop, activePanelCount, panelSpec);
  if (structuralValidation.loadCapacityCheck === 'fail') {
    issues.push(...structuralValidation.issues.filter(i => i.includes('exceeds')));
  } else if (structuralValidation.loadCapacityCheck === 'warning') {
    warnings.push(...structuralValidation.issues);
  }
  warnings.push(...structuralValidation.recommendations);

  // Code compliance validation
  const codeCompliance = validateCodeCompliance(
    constraints,
    { panels: activePanels, occupiedAreaSqM },
    selectedArea
  );

  if (!codeCompliance.edgeClearance.compliant) {
    warnings.push(`Edge clearance (${codeCompliance.edgeClearance.actual}m) below recommended ${codeCompliance.edgeClearance.required}m. Verify local code requirements.`);
  }

  if (!codeCompliance.obstacleClearance.compliant) {
    warnings.push(`Obstacle clearance (${codeCompliance.obstacleClearance.actual}m) below recommended ${codeCompliance.obstacleClearance.required}m.`);
  }

  if (!codeCompliance.fireAccess.compliant) {
    warnings.push('Fire access pathways may not meet local code requirements for roofs >500m². Verify with local AHJ.');
  }

  if (!codeCompliance.structuralLoad.compliant) {
    issues.push(`Structural load (${codeCompliance.structuralLoad.actualKgPerSqM} kg/m²) exceeds conservative limit. Structural engineer evaluation required.`);
  }

  if (selectedArea.obstacleConflicts > 0) {
    warnings.push('Selected area contains marked obstacles; panels were routed around clearance buffers.');
  }

  if (utilizationPct > 85) {
    warnings.push('High roof packing density; verify maintenance walkway clearances per local fire code.');
  }

  // Panel spacing validation
  if (constraints.rowSpacingM < 0.5) {
    warnings.push('Row spacing <0.5m may cause inter-row shading and restrict maintenance access.');
  }

  // Tilt validation
  if (constraints.tiltDeg < 5) {
    warnings.push('Very low tilt angle may cause water pooling and reduced cleaning efficiency.');
  } else if (constraints.tiltDeg > 35) {
    warnings.push('High tilt angle increases wind load and may require additional ballast.');
  }

  const isValid = issues.length === 0;

  // Enhanced score breakdown with code compliance factor
  const solarQuality = solarAnalysis ? Math.min(100, Math.round(solarAnalysis.avgSolarAccessPct)) : 90;
  const spatialEfficiency = Math.min(100, Math.round(utilizationPct * 1.1)); // Slight bonus for good utilization
  const complianceScore = isValid ? (
    (codeCompliance.edgeClearance.compliant ? 25 : 15) +
    (codeCompliance.obstacleClearance.compliant ? 25 : 15) +
    (codeCompliance.fireAccess.compliant ? 25 : 15) +
    (codeCompliance.structuralLoad.compliant ? 25 : 10)
  ) : 40;

  const layoutScore = Math.round(solarQuality * 0.40 + spatialEfficiency * 0.30 + complianceScore * 0.30);

  const now = new Date().toISOString();

  return {
    id: layoutId,
    name,
    assessmentId: rooftop.assessmentId,
    rooftopId: rooftop.id,
    solarAnalysisId: solarAnalysis?.id ?? 'solar-derived',
    selectedAreaId: selectedArea.id,
    objective,
    panelSpec,
    constraints,
    panels,
    activePanelCount,
    systemCapacityKWp,
    occupiedAreaSqM,
    selectedAreaSqM,
    utilizationPct,
    layoutScore,
    scoreBreakdown: {
      solarQuality,
      spatialEfficiency,
      compliance: complianceScore,
    },
    validation: {
      isValid,
      issues,
      warnings,
    },
    structuralValidation,
    codeCompliance,
    isLocked: false,
    isFinal: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generates all candidate layout alternatives with optimized constraints.
 * Enhanced with code-compliant spacing and structural considerations.
 */
export function generateCandidateLayouts(
  rooftop: Rooftop,
  selectedArea: SelectedSolarArea,
  panelSpec: PanelSpecification,
  constraints: DesignConstraints = DEFAULT_DESIGN_CONSTRAINTS,
  solarAnalysis?: SolarAnalysis | null,
  consumption?: ElectricityConsumptionProfile | null,
): PanelLayout[] {
  const layouts: PanelLayout[] = [];

  // Layout A: Maximum Generation (Optimized for energy output)
  // - Portrait orientation for better summer performance
  // - Increased tilt for optimal angle
  // - Wider row spacing to minimize shading
  const constrGen: DesignConstraints = {
    ...constraints,
    orientation: 'portrait',
    azimuthDeg: 180,
    tiltDeg: 20,
    rowSpacingM: 1.0,
    edgeClearanceM: 0.9,
    obstacleClearanceM: 0.6,
    panelSpacingM: 0.03,
  };
  const panelsGen = generateArrayPlacement(rooftop, selectedArea, panelSpec, constrGen, solarAnalysis);
  layouts.push(
    evaluateLayout(
      'layout-max-gen',
      'Layout A — Max Generation',
      'max_generation',
      rooftop,
      selectedArea,
      panelSpec,
      constrGen,
      panelsGen,
      solarAnalysis,
    )
  );

  // Layout B: Maximum Capacity (Optimized for panel count)
  // - Landscape orientation for better packing
  // - Lower tilt to reduce footprint
  // - Tighter spacing while maintaining access
  const constrCap: DesignConstraints = {
    ...constraints,
    orientation: 'landscape',
    azimuthDeg: 180,
    tiltDeg: 10,
    rowSpacingM: 0.7,
    edgeClearanceM: 0.75,
    obstacleClearanceM: 0.5,
    panelSpacingM: 0.02,
  };
  const panelsCap = generateArrayPlacement(rooftop, selectedArea, panelSpec, constrCap, solarAnalysis);
  layouts.push(
    evaluateLayout(
      'layout-max-cap',
      'Layout B — Max Capacity',
      'max_capacity',
      rooftop,
      selectedArea,
      panelSpec,
      constrCap,
      panelsCap,
      solarAnalysis,
    )
  );

  // Layout C: Balanced (Optimized for practical installation and maintenance)
  // - Portrait orientation (standard)
  // - Moderate tilt
  // - Code-compliant spacing for walkways and access
  const constrBal: DesignConstraints = {
    ...constraints,
    orientation: 'portrait',
    azimuthDeg: 180,
    tiltDeg: 15,
    rowSpacingM: 0.9,
    edgeClearanceM: 0.9,
    obstacleClearanceM: 0.6,
    panelSpacingM: 0.03,
  };
  const panelsBal = generateArrayPlacement(rooftop, selectedArea, panelSpec, constrBal, solarAnalysis);
  layouts.push(
    evaluateLayout(
      'layout-balanced',
      'Layout C — Balanced Array',
      'balanced',
      rooftop,
      selectedArea,
      panelSpec,
      constrBal,
      panelsBal,
      solarAnalysis,
    )
  );

  // Layout D: Consumption-Optimized (Only if consumption data is available)
  if (consumption && consumption.annualKwh) {
    const solarResourceKwhPerKwp = solarAnalysis?.peakSunHoursAnnual
      ? solarAnalysis.peakSunHoursAnnual * 365
      : 1450;

    const requiredPanelCount = calculateRequiredPanelCount(
      consumption,
      panelSpec,
      solarResourceKwhPerKwp
    );

    if (requiredPanelCount && requiredPanelCount > 0) {
      const constrConsumption: DesignConstraints = {
        ...constraints,
        orientation: 'portrait',
        azimuthDeg: 180,
        tiltDeg: 15,
        rowSpacingM: 0.9,
        edgeClearanceM: 0.9,
        obstacleClearanceM: 0.6,
        panelSpacingM: 0.03,
        maxPanelCount: requiredPanelCount,
      };

      const panelsConsumption = generateArrayPlacement(
        rooftop,
        selectedArea,
        panelSpec,
        constrConsumption,
        solarAnalysis
      );

      layouts.unshift(
        evaluateLayout(
          'layout-consumption',
          `Layout — Consumption Match (${panelsConsumption.length} panels)`,
          'consumption_optimized' as OptimizationObjective,
          rooftop,
          selectedArea,
          panelSpec,
          constrConsumption,
          panelsConsumption,
          solarAnalysis,
        )
      );
    }
  }

  return layouts;
}

// ============================================================
// MULTI-ANGLE LAYOUT OPTIMIZER — Re-adjust Panels Engine
// ============================================================

export interface ReadjustResult {
  bestLayout: PanelLayout;
  previousPanelCount: number;
  newPanelCount: number;
  previousCapacityKWp: number;
  newCapacityKWp: number;
  candidatesEvaluated: number;
  anglesSearched: number[];
  improvementReason: string;
  improved: boolean;
}

/**
 * Generates and evaluates a comprehensive set of alternative panel arrangements
 * by searching multiple azimuth angles, orientations, tilt angles, and row
 * configurations. Returns the best candidate found.
 *
 * This is the engine behind the "Re-adjust Panels" button. It does NOT simply
 * redraw the existing layout — it genuinely explores alternatives and compares
 * them by panel count, capacity, solar quality, and code compliance.
 *
 * The existing layout is preserved if no better arrangement is found.
 */
export function optimizeLayoutMultiAngle(
  rooftop: Rooftop,
  selectedArea: SelectedSolarArea,
  panelSpec: PanelSpecification,
  baseConstraints: DesignConstraints,
  currentLayout: PanelLayout,
  solarAnalysis?: SolarAnalysis | null,
): ReadjustResult {
  const previousPanelCount = currentLayout.activePanelCount;
  const previousCapacityKWp = currentLayout.systemCapacityKWp;

  // --- Define search space ---

  // Azimuth angles to try: center on roof orientation ± 90°
  // and always include standard S/SE/SW orientations
  const roofAzimuth = rooftop.orientation ?? 180;
  const baseAzimuths = new Set<number>([
    0, 45, 90, 135, 180, 225, 270, 315, // 8 compass directions
    roofAzimuth, // roof's own principal axis
    (roofAzimuth + 90) % 360, // perpendicular
  ]);
  // Add fine-grained sweep around each base azimuth
  const candidateAzimuths: number[] = [];
  for (const az of baseAzimuths) {
    for (let offset = -15; offset <= 15; offset += 15) {
      candidateAzimuths.push(((az + offset) % 360 + 360) % 360);
    }
  }
  const uniqueAzimuths = [...new Set(candidateAzimuths)].sort((a, b) => a - b);

  // Tilt angles (degrees): practical range for flat/low-pitched roofs
  const tiltAngles = [5, 10, 15, 20, 25, 30];

  // Orientations
  const orientations: Array<'portrait' | 'landscape'> = ['portrait', 'landscape'];

  // Row spacing variants (meeting code minimum walkway width)
  const rowSpacings = [0.7, 0.9, 1.0, 1.2];

  let bestLayout = currentLayout;
  let bestScore = currentLayout.layoutScore;
  let bestPanelCount = currentLayout.activePanelCount;
  let candidatesEvaluated = 0;
  const anglesSearched: number[] = [];

  // --- Exhaustive search ---
  for (const azimuth of uniqueAzimuths) {
    for (const tilt of tiltAngles) {
      for (const orientation of orientations) {
        for (const rowSpacing of rowSpacings) {
          const candidateConstraints: DesignConstraints = {
            ...baseConstraints,
            azimuthDeg: azimuth,
            tiltDeg: tilt,
            orientation,
            rowSpacingM: rowSpacing,
            edgeClearanceM: Math.max(0.75, baseConstraints.edgeClearanceM),
            obstacleClearanceM: Math.max(0.5, baseConstraints.obstacleClearanceM),
          };

          const panels = generateArrayPlacement(
            rooftop,
            selectedArea,
            panelSpec,
            candidateConstraints,
            solarAnalysis,
          );

          candidatesEvaluated++;

          if (panels.length === 0) continue;

          const layoutId = `readjust-az${azimuth}-t${tilt}-${orientation}-rs${rowSpacing}`;
          const layoutName = `Re-adjust ${orientation.charAt(0).toUpperCase()}${orientation.slice(1)} ${azimuth}° T${tilt}°`;

          const candidate = evaluateLayout(
            layoutId,
            layoutName,
            'max_generation',
            rooftop,
            selectedArea,
            panelSpec,
            candidateConstraints,
            panels,
            solarAnalysis,
          );

          if (!candidate.validation.isValid) continue;

          // Ranking: prioritize panel count first, then layoutScore for ties
          const isBetter =
            candidate.activePanelCount > bestPanelCount ||
            (candidate.activePanelCount === bestPanelCount && candidate.layoutScore > bestScore);

          if (isBetter) {
            bestLayout = candidate;
            bestScore = candidate.layoutScore;
            bestPanelCount = candidate.activePanelCount;
            if (!anglesSearched.includes(azimuth)) anglesSearched.push(azimuth);
          }
        }
      }
    }
  }

  const improved = bestLayout.id !== currentLayout.id;

  let improvementReason: string;
  if (!improved) {
    improvementReason = 'No improvement found across all candidate configurations. The existing layout is optimal for this area.';
  } else {
    const panelDiff = bestLayout.activePanelCount - previousPanelCount;
    const capDiff = (bestLayout.systemCapacityKWp - previousCapacityKWp).toFixed(2);
    improvementReason =
      `Found better arrangement at ${bestLayout.constraints.azimuthDeg}° azimuth, ` +
      `${bestLayout.constraints.tiltDeg}° tilt, ${bestLayout.constraints.orientation} orientation. ` +
      `Panel count: ${previousPanelCount} → ${bestLayout.activePanelCount} (${panelDiff >= 0 ? '+' : ''}${panelDiff}), ` +
      `Capacity: ${previousCapacityKWp} → ${bestLayout.systemCapacityKWp} kWp (${Number(capDiff) >= 0 ? '+' : ''}${capDiff} kWp). ` +
      `Evaluated ${candidatesEvaluated} candidate layouts.`;
  }

  return {
    bestLayout,
    previousPanelCount,
    newPanelCount: bestLayout.activePanelCount,
    previousCapacityKWp,
    newCapacityKWp: bestLayout.systemCapacityKWp,
    candidatesEvaluated,
    anglesSearched,
    improvementReason,
    improved,
  };
}
