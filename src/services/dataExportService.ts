// ============================================
// Data Export Service — JSON/GeoJSON Export & Data Validation
// ============================================

import type { AssessmentState } from '@/types/index.js';
import type { Rooftop } from '@/types/rooftop.js';
import type { SolarAnalysis } from '@/types/solar.js';
import type { PanelLayout } from '@/types/optimization.js';

export interface ProjectExport {
  version: string;
  exportedAt: string;
  assessment: AssessmentState;
  rooftop: Rooftop | null;
  solarAnalysis: SolarAnalysis | null;
  panelLayout: PanelLayout | null;
  metadata: {
    appVersion: string;
    userAgent: string;
    exportReason?: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  dataIntegrity: {
    assessmentValid: boolean;
    rooftopValid: boolean;
    solarAnalysisValid: boolean;
    panelLayoutValid: boolean;
  };
}

/**
 * Validates data integrity before export or storage
 */
export function validateProjectData(
  assessment: AssessmentState | null,
  rooftop: Rooftop | null,
  solarAnalysis: SolarAnalysis | null,
  panelLayout: PanelLayout | null,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Assessment validation
  let assessmentValid = true;
  if (!assessment) {
    errors.push('Assessment data is missing');
    assessmentValid = false;
  } else {
    if (!assessment.assessmentId) {
      errors.push('Assessment ID is missing');
      assessmentValid = false;
    }
    if (assessment.selectedLatitude === null || assessment.selectedLongitude === null) {
      warnings.push('Location not selected in assessment');
    }
    if (!assessment.selectedBuildingGeometry && assessment.selectedLatitude === null) {
      errors.push('Neither building geometry nor location is available');
      assessmentValid = false;
    }
  }

  // Rooftop validation
  let rooftopValid = true;
  if (rooftop) {
    if (!rooftop.id || !rooftop.assessmentId) {
      errors.push('Rooftop is missing required identifiers');
      rooftopValid = false;
    }
    if (!rooftop.geometry || !rooftop.geometry.coordinates || rooftop.geometry.coordinates.length === 0) {
      errors.push('Rooftop geometry is invalid or empty');
      rooftopValid = false;
    }
    if (rooftop.area <= 0) {
      errors.push('Rooftop area must be positive');
      rooftopValid = false;
    }
    if (rooftop.area > 1000000) {
      warnings.push('Rooftop area is unusually large (>1km²)');
    }
    // Check for ID consistency
    if (assessment && rooftop.assessmentId !== assessment.assessmentId) {
      errors.push('Rooftop assessment ID does not match assessment');
      rooftopValid = false;
    }
  }

  // Solar analysis validation
  let solarAnalysisValid = true;
  if (solarAnalysis) {
    if (!solarAnalysis.id || !solarAnalysis.assessmentId || !solarAnalysis.rooftopId) {
      errors.push('Solar analysis is missing required identifiers');
      solarAnalysisValid = false;
    }
    if (!solarAnalysis.resourceData) {
      errors.push('Solar resource data is missing');
      solarAnalysisValid = false;
    }
    if (solarAnalysis.solarEffectiveAreaSqM > solarAnalysis.physicalUsableAreaSqM) {
      errors.push('Solar effective area cannot exceed physical usable area');
      solarAnalysisValid = false;
    }
    if (solarAnalysis.physicalUsableAreaSqM > solarAnalysis.grossRoofAreaSqM) {
      errors.push('Physical usable area cannot exceed gross roof area');
      solarAnalysisValid = false;
    }
    // Check consistency with rooftop
    if (rooftop && solarAnalysis.rooftopId !== rooftop.id) {
      errors.push('Solar analysis rooftop ID does not match rooftop');
      solarAnalysisValid = false;
    }
  }

  // Panel layout validation
  let panelLayoutValid = true;
  if (panelLayout) {
    if (!panelLayout.id || !panelLayout.assessmentId || !panelLayout.rooftopId) {
      errors.push('Panel layout is missing required identifiers');
      panelLayoutValid = false;
    }
    if (panelLayout.systemCapacityKWp <= 0) {
      warnings.push('Panel layout has zero capacity');
    }
    if (panelLayout.activePanelCount === 0) {
      warnings.push('Panel layout has no active panels');
    }
    if (panelLayout.activePanelCount !== panelLayout.panels.filter(p => !p.isDeleted).length) {
      errors.push('Active panel count does not match actual panel count');
      panelLayoutValid = false;
    }
    // Check consistency
    if (solarAnalysis && panelLayout.solarAnalysisId !== solarAnalysis.id) {
      errors.push('Panel layout solar analysis ID does not match');
      panelLayoutValid = false;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    dataIntegrity: {
      assessmentValid,
      rooftopValid,
      solarAnalysisValid,
      panelLayoutValid,
    },
  };
}

/**
 * Exports complete project data as JSON
 */
export function exportProjectAsJSON(
  assessment: AssessmentState,
  rooftop: Rooftop | null,
  solarAnalysis: SolarAnalysis | null,
  panelLayout: PanelLayout | null,
  exportReason?: string,
): { data: ProjectExport; validation: ValidationResult } {
  const validation = validateProjectData(assessment, rooftop, solarAnalysis, panelLayout);

  const projectExport: ProjectExport = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    assessment,
    rooftop,
    solarAnalysis,
    panelLayout,
    metadata: {
      appVersion: '1.0.0',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      exportReason,
    },
  };

  return { data: projectExport, validation };
}

/**
 * Downloads JSON data as a file
 */
export function downloadJSON(data: ProjectExport, filename?: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `solar-assessment-${data.assessment.assessmentId}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports rooftop and panel layout as GeoJSON for GIS applications
 */
export function exportAsGeoJSON(
  rooftop: Rooftop,
  panelLayout: PanelLayout | null,
  solarAnalysis: SolarAnalysis | null,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  // Add rooftop boundary
  features.push({
    type: 'Feature',
    id: rooftop.id,
    geometry: rooftop.geometry,
    properties: {
      type: 'rooftop_boundary',
      area: rooftop.area,
      perimeter: rooftop.perimeter,
      orientation: rooftop.orientation,
      roofType: rooftop.roofType,
      assessmentId: rooftop.assessmentId,
    },
  });

  // Add obstacles
  for (const obstacle of rooftop.obstacles) {
    if (obstacle.status === 'rejected') continue;
    features.push({
      type: 'Feature',
      id: obstacle.id,
      geometry: obstacle.geometry,
      properties: {
        type: 'obstacle',
        obstacleType: obstacle.type,
        area: obstacle.area,
        height: obstacle.height,
        clearance: obstacle.clearance,
        label: obstacle.label,
      },
    });
  }

  // Add solar zones if available
  if (solarAnalysis) {
    for (const zone of solarAnalysis.zones) {
      features.push({
        type: 'Feature',
        id: zone.id,
        geometry: {
          type: 'Polygon',
          coordinates: [zone.polygon],
        },
        properties: {
          type: 'solar_zone',
          classification: zone.classification,
          area: zone.area,
          avgSolarAccessPct: zone.avgSolarAccessPct,
          avgIrradiance: zone.avgIrradiance,
        },
      });
    }

    // Add selected solar area
    if (solarAnalysis.selectedArea) {
      features.push({
        type: 'Feature',
        id: solarAnalysis.selectedArea.id,
        geometry: solarAnalysis.selectedArea.geometry,
        properties: {
          type: 'selected_solar_area',
          area: solarAnalysis.selectedArea.area,
          solarZone: solarAnalysis.selectedArea.solarZone,
          avgSolarAccessPct: solarAnalysis.selectedArea.avgSolarAccessPct,
        },
      });
    }
  }

  // Add panel instances
  if (panelLayout) {
    for (const panel of panelLayout.panels) {
      if (panel.isDeleted) continue;
      features.push({
        type: 'Feature',
        id: panel.id,
        geometry: panel.geometry,
        properties: {
          type: 'solar_panel',
          index: panel.index,
          orientation: panel.orientation,
          tiltDeg: panel.tiltDeg,
          azimuthDeg: panel.azimuthDeg,
          ratedPowerW: panel.ratedPowerW,
          solarZone: panel.solarZone,
          solarAccessPct: panel.solarAccessPct,
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Downloads GeoJSON data as a file
 */
export function downloadGeoJSON(geoJSON: GeoJSON.FeatureCollection, filename?: string): void {
  const jsonString = JSON.stringify(geoJSON, null, 2);
  const blob = new Blob([jsonString], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `solar-rooftop-${Date.now()}.geojson`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validates imported JSON data structure
 */
export function validateImportedData(data: unknown): { valid: boolean; error?: string; data?: ProjectExport } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data format' };
  }

  const obj = data as Partial<ProjectExport>;

  if (!obj.version) {
    return { valid: false, error: 'Missing version field' };
  }

  if (obj.version !== '1.0') {
    return { valid: false, error: `Unsupported version: ${obj.version}. Expected 1.0` };
  }

  if (!obj.assessment) {
    return { valid: false, error: 'Missing assessment data' };
  }

  if (!obj.assessment.assessmentId) {
    return { valid: false, error: 'Assessment missing required ID' };
  }

  // Validate data integrity
  const validation = validateProjectData(
    obj.assessment,
    obj.rooftop ?? null,
    obj.solarAnalysis ?? null,
    obj.panelLayout ?? null,
  );

  if (!validation.valid) {
    return { valid: false, error: `Data validation failed: ${validation.errors.join(', ')}` };
  }

  return { valid: true, data: obj as ProjectExport };
}

/**
 * Imports project from JSON file
 */
export async function importProjectFromFile(file: File): Promise<{ valid: boolean; error?: string; data?: ProjectExport }> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return validateImportedData(parsed);
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Failed to parse JSON' };
  }
}
