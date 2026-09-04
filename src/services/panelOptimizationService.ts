import type { Rooftop, Obstacle } from '@/types/rooftop.js';
import type { SolarAnalysis, SelectedSolarArea } from '@/types/solar.js';
import type {
  PanelSpecification,
  DesignConstraints,
  OptimizationObjective,
  PanelInstance,
  PanelLayout,
} from '@/types/optimization.js';
import { isPointInPolygon } from '@/utils/geoUtils';

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS = 6378137;

export const DEFAULT_DESIGN_CONSTRAINTS: DesignConstraints = {
  orientation: 'portrait',
  tiltDeg: 15,
  azimuthDeg: 180, // Default South-facing
  edgeClearanceM: 0.5,
  obstacleClearanceM: 0.3,
  rowSpacingM: 0.7,
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

/**
 * Packs photovoltaic modules inside the selected solar area using geometric ray-grid projection.
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

  // Determine physical module dimensions based on orientation
  let dimAlongRow = panelSpec.widthM; // u-axis
  let dimAlongCol = panelSpec.lengthM; // v-axis

  if (constraints.orientation === 'landscape') {
    dimAlongRow = panelSpec.lengthM;
    dimAlongCol = panelSpec.widthM;
  }

  // Tilted module ground projection length
  const tiltRad = (constraints.tiltDeg || 15) * DEG_TO_RAD;
  const groundProjectionCol = dimAlongCol * Math.cos(tiltRad);

  const stepU = dimAlongRow + constraints.panelSpacingM;
  const stepV = groundProjectionCol + constraints.rowSpacingM;

  // Find bounding box of selected area
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

  // Conversion constants
  const metersPerDegLat = EARTH_RADIUS * DEG_TO_RAD;
  const metersPerDegLng = metersPerDegLat * Math.cos(centerLat * DEG_TO_RAD);

  // Rotation angle corresponding to azimuth (relative to East-West row alignment)
  const mountAzimuth = constraints.azimuthDeg ?? rooftop.orientation ?? 180;
  const rotationRad = (mountAzimuth - 180) * DEG_TO_RAD;
  const cosR = Math.cos(rotationRad);
  const sinR = Math.sin(rotationRad);

  const widthM = (maxLng - minLng) * metersPerDegLng;
  const heightM = (maxLat - minLat) * metersPerDegLat;
  const maxSpanM = Math.sqrt(widthM * widthM + heightM * heightM) * 1.2;

  const panels: PanelInstance[] = [];
  let panelIndex = 1;

  // Inset selected boundary by edge clearance
  const edgeBuffer = Math.max(0.2, constraints.edgeClearanceM);

  // Grid scan over span
  for (let v = -maxSpanM / 2 + edgeBuffer; v <= maxSpanM / 2 - edgeBuffer; v += stepV) {
    for (let u = -maxSpanM / 2 + edgeBuffer; u <= maxSpanM / 2 - edgeBuffer; u += stepU) {
      if (constraints.maxPanelCount && panels.length >= constraints.maxPanelCount) {
        break;
      }

      // Half-dimensions of module
      const hu = dimAlongRow / 2;
      const hv = groundProjectionCol / 2;

      // 4 corners in local rotated frame (meters relative to center)
      const localCorners: [number, number][] = [
        [u - hu, v - hv],
        [u + hu, v - hv],
        [u + hu, v + hv],
        [u - hu, v + hv],
      ];

      // Transform local (u, v) meters -> world [lng, lat]
      const geoCorners: [number, number][] = localCorners.map(([lu, lv]) => {
        const rotX = lu * cosR - lv * sinR;
        const rotY = lu * sinR + lv * cosR;
        const lng = centerLng + rotX / metersPerDegLng;
        const lat = centerLat + rotY / metersPerDegLat;
        return [lng, lat];
      });

      // 1. Strict containment check inside selected solar area and roof boundary
      if (!isPanelInsidePolygon(geoCorners, selectedBoundary)) {
        continue;
      }
      if (!isPanelInsidePolygon(geoCorners, roofBoundary)) {
        continue;
      }

      // 2. Obstacle collision check
      if (isPanelCollidingWithObstacles(geoCorners, rooftop.obstacles, constraints.obstacleClearanceM)) {
        continue;
      }

      // 3. Panel centroid
      const centroidLng = (geoCorners[0][0] + geoCorners[2][0]) / 2;
      const centroidLat = (geoCorners[0][1] + geoCorners[2][1]) / 2;

      // Sample solar potential
      let solarZone: 'High' | 'Medium' | 'Low' | 'Mixed' = 'High';
      let solarAccessPct = 92;

      if (solarAnalysis) {
        solarAccessPct = Math.round(solarAnalysis.avgSolarAccessPct);
        solarZone = solarAnalysis.overallClassification === 'HIGH' ? 'High' : 'Medium';
      }

      const panelGeo: GeoJSON.Polygon = {
        type: 'Polygon',
        coordinates: [[...geoCorners, geoCorners[0]]],
      };

      panels.push({
        id: `panel-${panelIndex}`,
        layoutId: 'layout-draft',
        index: panelIndex++,
        geometry: panelGeo,
        centroid: { lat: centroidLat, lng: centroidLng },
        orientation: constraints.orientation === 'landscape' ? 'landscape' : 'portrait',
        lengthM: panelSpec.lengthM,
        widthM: panelSpec.widthM,
        tiltDeg: constraints.tiltDeg,
        azimuthDeg: mountAzimuth,
        sectionId: null,
        solarZone,
        solarAccessPct,
        ratedPowerW: panelSpec.ratedPowerW,
        isLocked: false,
        isDeleted: false,
      });
    }
  }

  return panels;
}

/**
 * Evaluates scores and validates constraints for a candidate panel layout.
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

  // Validation
  const issues: string[] = [];
  const warnings: string[] = [];

  if (activePanelCount === 0) {
    issues.push('No valid panels could be placed within the selected area constraints.');
  }

  if (selectedArea.obstacleConflicts > 0) {
    warnings.push('Selected area contains marked obstacles; panels were routed around clearance buffers.');
  }

  if (utilizationPct > 85) {
    warnings.push('High roof packing density; verify maintenance walkway clearances.');
  }

  const isValid = issues.length === 0;

  // Score breakdown
  const solarQuality = solarAnalysis ? Math.min(100, Math.round(solarAnalysis.avgSolarAccessPct)) : 90;
  const spatialEfficiency = Math.min(100, Math.round(utilizationPct * 1.2));
  const compliance = isValid ? 100 : 40;

  const layoutScore = Math.round(solarQuality * 0.45 + spatialEfficiency * 0.35 + compliance * 0.20);

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
      compliance,
    },
    validation: {
      isValid,
      issues,
      warnings,
    },
    isLocked: false,
    isFinal: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generates all candidate layout alternatives (e.g. Max Generation, Max Capacity, Balanced).
 */
export function generateCandidateLayouts(
  rooftop: Rooftop,
  selectedArea: SelectedSolarArea,
  panelSpec: PanelSpecification,
  constraints: DesignConstraints = DEFAULT_DESIGN_CONSTRAINTS,
  solarAnalysis?: SolarAnalysis | null,
): PanelLayout[] {
  const layouts: PanelLayout[] = [];

  // Layout A: Maximum Generation (Standard Portrait, South-facing 180°, 0.8m row pitch)
  const constrGen: DesignConstraints = {
    ...constraints,
    orientation: 'portrait',
    azimuthDeg: 180,
    tiltDeg: 18,
    rowSpacingM: 0.8,
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

  // Layout B: Maximum Capacity (Landscape, tight 0.5m row pitch for maximum modules)
  const constrCap: DesignConstraints = {
    ...constraints,
    orientation: 'landscape',
    azimuthDeg: 180,
    tiltDeg: 12,
    rowSpacingM: 0.5,
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

  // Layout C: Balanced (Optimal yield and walkway access)
  const constrBal: DesignConstraints = {
    ...constraints,
    orientation: 'portrait',
    azimuthDeg: 180,
    tiltDeg: 15,
    rowSpacingM: 0.7,
    edgeClearanceM: 0.6,
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

  return layouts;
}
