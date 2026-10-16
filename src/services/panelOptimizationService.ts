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

  const candidateSlots: CandidateSlot[] = [];

  // Inset selected boundary by edge clearance
  const edgeBuffer = Math.max(0.2, constraints.edgeClearanceM);

  // 1. Grid scan over span to find all physically valid candidate module locations
  for (let v = -maxSpanM / 2 + edgeBuffer; v <= maxSpanM / 2 - edgeBuffer; v += stepV) {
    for (let u = -maxSpanM / 2 + edgeBuffer; u <= maxSpanM / 2 - edgeBuffer; u += stepU) {
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

      // Strict containment check inside selected solar area and roof boundary
      if (!isPanelInsidePolygon(geoCorners, selectedBoundary)) {
        continue;
      }
      if (!isPanelInsidePolygon(geoCorners, roofBoundary)) {
        continue;
      }

      // Obstacle collision check
      if (isPanelCollidingWithObstacles(geoCorners, rooftop.obstacles, constraints.obstacleClearanceM)) {
        continue;
      }

      // Panel centroid
      const centroidLng = (geoCorners[0][0] + geoCorners[2][0]) / 2;
      const centroidLat = (geoCorners[0][1] + geoCorners[2][1]) / 2;

      // Dynamically sample solar potential from solar analysis zones
      let solarZone: 'High' | 'Medium' | 'Low' | 'Mixed' = 'High';
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

      // Proximity to center of area for clean, contiguous cluster layout (avoid random scattered placement)
      const distFromCenterM = Math.sqrt(u * u + v * v);
      const score = (zoneScoreMultiplier * 1000) + (solarAccessPct * 5) - (distFromCenterM * 4);

      candidateSlots.push({
        u,
        v,
        geoCorners,
        centroidLat,
        centroidLng,
        solarZone,
        solarAccessPct,
        score,
      });
    }
  }

  // 2. Select panels: if maxPanelCount is specified (e.g. for consumption-based layout),
  // pick the highest-solar-yield and best-clustered slots rather than arbitrary/random row truncations
  let selectedSlots: CandidateSlot[] = [];

  if (constraints.maxPanelCount && constraints.maxPanelCount > 0 && constraints.maxPanelCount < candidateSlots.length) {
    // Sort descending by score to pick the best spots
    const ranked = [...candidateSlots].sort((a, b) => b.score - a.score);
    const topSlots = ranked.slice(0, constraints.maxPanelCount);
    // Sort chosen slots into orderly rows (v descending, u ascending) for neat array alignment
    selectedSlots = topSlots.sort((a, b) => {
      const vDiff = b.v - a.v;
      if (Math.abs(vDiff) > 0.05) return vDiff;
      return a.u - b.u;
    });
  } else {
    // Keep all candidate slots sorted neatly by rows
    selectedSlots = [...candidateSlots].sort((a, b) => {
      const vDiff = b.v - a.v;
      if (Math.abs(vDiff) > 0.05) return vDiff;
      return a.u - b.u;
    });
  }

  // 3. Construct PanelInstance array
  const panels: PanelInstance[] = selectedSlots.map((slot, idx) => {
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
      orientation: constraints.orientation === 'landscape' ? 'landscape' : 'portrait',
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

  return panels;
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
    tiltDeg: 20, // Increased from 18 for better performance
    rowSpacingM: 1.0, // Increased from 0.8 for less shading
    edgeClearanceM: 0.9, // Code compliant
    obstacleClearanceM: 0.6, // Safety margin
    panelSpacingM: 0.03, // Adequate module gap
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
    tiltDeg: 10, // Reduced from 12 for better packing
    rowSpacingM: 0.7, // Minimum practical spacing
    edgeClearanceM: 0.75, // Slightly reduced but safe
    obstacleClearanceM: 0.5, // Minimum safe distance
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
    rowSpacingM: 0.9, // Full walkway width
    edgeClearanceM: 0.9, // Fire code compliant
    obstacleClearanceM: 0.6, // Safe clearance
    panelSpacingM: 0.03, // Adequate drainage gap
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
  // - Generate only the number of panels needed for consumption
  // - Use balanced constraints for practical installation
  if (consumption && consumption.annualKwh) {
    // Calculate solar resource: peakSunHoursAnnual is essentially kWh/m²/year
    // For PV systems, we convert this to kWh/kWp by considering typical system factors
    // Standard assumption: 1 kWp system with optimal orientation yields ~peakSunHours × 365 kWh/year
    const solarResourceKwhPerKwp = solarAnalysis?.peakSunHoursAnnual 
      ? solarAnalysis.peakSunHoursAnnual * 365 
      : 1450; // Default for moderate climate
    
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
        maxPanelCount: requiredPanelCount, // Limit to required count
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
