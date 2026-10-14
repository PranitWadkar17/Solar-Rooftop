// ============================================
// Workflow Validation Service — Phase Transition Validation & Error Recovery
// ============================================

import type { AssessmentState } from '@/types/index.js';
import type { Rooftop } from '@/types/rooftop.js';
import type { SolarAnalysis } from '@/types/solar.js';
import type { PanelLayout } from '@/types/optimization.js';
import { loadAssessment, recoverFromBackup as recoverAssessmentBackup } from './assessmentService';
import { loadRooftop } from './rooftopService';
import { loadSolarAnalysis } from './solarAnalysisService';
import { loadPanelLayout } from './optimizationService';

export type WorkflowPhase = 
  | 'landing'
  | 'location_selection'
  | 'rooftop_definition'
  | 'solar_analysis'
  | 'panel_optimization'
  | 'energy_report';

export interface PhaseRequirements {
  phase: WorkflowPhase;
  requires: {
    assessment: boolean;
    location: boolean;
    building: boolean;
    rooftop: boolean;
    solarAnalysis: boolean;
    panelLayout: boolean;
  };
}

export interface ValidationCheckpoint {
  phase: WorkflowPhase;
  canProceed: boolean;
  missingRequirements: string[];
  warnings: string[];
  recommendations: string[];
}

const PHASE_REQUIREMENTS: Record<WorkflowPhase, PhaseRequirements['requires']> = {
  landing: {
    assessment: false,
    location: false,
    building: false,
    rooftop: false,
    solarAnalysis: false,
    panelLayout: false,
  },
  location_selection: {
    assessment: true,
    location: false,
    building: false,
    rooftop: false,
    solarAnalysis: false,
    panelLayout: false,
  },
  rooftop_definition: {
    assessment: true,
    location: true,
    building: true,
    rooftop: false, // Will be created in this phase
    solarAnalysis: false,
    panelLayout: false,
  },
  solar_analysis: {
    assessment: true,
    location: true,
    building: true,
    rooftop: true,
    solarAnalysis: false, // Will be created in this phase
    panelLayout: false,
  },
  panel_optimization: {
    assessment: true,
    location: true,
    building: true,
    rooftop: true,
    solarAnalysis: true,
    panelLayout: false, // Will be created in this phase
  },
  energy_report: {
    assessment: true,
    location: true,
    building: true,
    rooftop: true,
    solarAnalysis: true,
    panelLayout: true,
  },
};

/**
 * Validates whether user can proceed to a specific phase
 */
export function validatePhaseTransition(
  targetPhase: WorkflowPhase,
  assessment: AssessmentState | null,
  rooftop: Rooftop | null,
  solarAnalysis: SolarAnalysis | null,
  panelLayout: PanelLayout | null,
): ValidationCheckpoint {
  const requirements = PHASE_REQUIREMENTS[targetPhase];
  const missing: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check assessment
  if (requirements.assessment && !assessment) {
    missing.push('Assessment not found. Please start a new assessment.');
  } else if (assessment && !assessment.assessmentId) {
    missing.push('Assessment is missing required ID. Data may be corrupted.');
  }

  // Check location
  if (requirements.location && assessment) {
    if (assessment.selectedLatitude === null || assessment.selectedLongitude === null) {
      missing.push('Location not selected. Please select a location on the map.');
    }
    if (!assessment.selectedAddress) {
      warnings.push('Location address not available. This may affect reporting.');
    }
  }

  // Check building
  if (requirements.building && assessment) {
    if (!assessment.selectedBuildingGeometry && !assessment.selectedLatitude) {
      missing.push('Building or location not selected. Please select a building or mark a location.');
    }
    if (!assessment.selectedBuildingGeometry) {
      warnings.push('No building footprint available. You will need to draw the rooftop manually.');
    }
  }

  // Check rooftop
  if (requirements.rooftop && !rooftop) {
    missing.push('Rooftop not defined. Please complete rooftop boundary and obstacle marking.');
  } else if (rooftop) {
    if (rooftop.area < 10) {
      warnings.push('Rooftop area is very small (<10 m²). Verify the boundary is correct.');
    }
    if (rooftop.obstacles.length === 0) {
      recommendations.push('No obstacles marked. Consider marking any rooftop obstructions for accurate analysis.');
    }
  }

  // Check solar analysis
  if (requirements.solarAnalysis && !solarAnalysis) {
    missing.push('Solar analysis not completed. Please run solar suitability analysis first.');
  } else if (solarAnalysis) {
    if (solarAnalysis.status !== 'completed') {
      missing.push('Solar analysis is not complete. Please wait for analysis to finish.');
    }
    if (rooftop && solarAnalysis.rooftopVersionTimestamp !== rooftop.updatedAt) {
      warnings.push('Rooftop was modified after solar analysis. Consider re-running analysis for accuracy.');
    }
    if (!solarAnalysis.selectedArea) {
      recommendations.push('No solar installation area selected. A recommended area will be auto-selected.');
    }
  }

  // Check panel layout
  if (requirements.panelLayout && !panelLayout) {
    missing.push('Panel layout not generated. Please complete panel placement optimization.');
  } else if (panelLayout) {
    if (panelLayout.activePanelCount === 0) {
      warnings.push('Panel layout has no panels. Check constraints or selected area size.');
    }
    if (panelLayout.validation && !panelLayout.validation.isValid) {
      warnings.push('Panel layout has validation issues. Review warnings before proceeding.');
    }
  }

  return {
    phase: targetPhase,
    canProceed: missing.length === 0,
    missingRequirements: missing,
    warnings,
    recommendations,
  };
}

/**
 * Attempts to recover workflow state from storage
 */
export function recoverWorkflowState(assessmentId: string): {
  assessment: AssessmentState | null;
  rooftop: Rooftop | null;
  solarAnalysis: SolarAnalysis | null;
  panelLayout: PanelLayout | null;
  recovered: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let recovered = false;

  // Try to load assessment
  let assessment = loadAssessment();
  if (!assessment && assessmentId) {
    // Try backup recovery
    assessment = recoverAssessmentBackup();
    if (assessment) {
      recovered = true;
      console.log('Recovered assessment from backup');
    } else {
      errors.push('Could not recover assessment data');
    }
  }

  // Try to load rooftop
  let rooftop: Rooftop | null = null;
  if (assessmentId) {
    rooftop = loadRooftop(assessmentId);
    if (!rooftop) {
      errors.push('Could not load rooftop data');
    }
  }

  // Try to load solar analysis
  let solarAnalysis: SolarAnalysis | null = null;
  if (assessmentId) {
    solarAnalysis = loadSolarAnalysis(assessmentId);
    if (!solarAnalysis) {
      errors.push('Could not load solar analysis');
    }
  }

  // Try to load panel layout
  let panelLayout: PanelLayout | null = null;
  if (assessmentId) {
    panelLayout = loadPanelLayout(assessmentId);
    if (!panelLayout) {
      errors.push('Could not load panel layout');
    }
  }

  return {
    assessment,
    rooftop,
    solarAnalysis,
    panelLayout,
    recovered,
    errors: errors.filter(e => e !== 'Could not load rooftop data' || assessment !== null), // Filter out expected missing data
  };
}

/**
 * Determines the furthest phase the user can access based on current data
 */
export function determineFurthestPhase(
  assessment: AssessmentState | null,
  rooftop: Rooftop | null,
  solarAnalysis: SolarAnalysis | null,
  panelLayout: PanelLayout | null,
): WorkflowPhase {
  if (!assessment) return 'landing';
  
  if (panelLayout && panelLayout.activePanelCount > 0) {
    return 'energy_report';
  }
  
  if (solarAnalysis && solarAnalysis.status === 'completed') {
    return 'panel_optimization';
  }
  
  if (rooftop && rooftop.area > 0) {
    return 'solar_analysis';
  }
  
  if (assessment.selectedBuildingGeometry || assessment.selectedLatitude !== null) {
    return 'rooftop_definition';
  }
  
  return 'location_selection';
}

/**
 * Validates data consistency across phases
 */
export function validateDataConsistency(
  assessment: AssessmentState | null,
  rooftop: Rooftop | null,
  solarAnalysis: SolarAnalysis | null,
  panelLayout: PanelLayout | null,
): { consistent: boolean; issues: string[] } {
  const issues: string[] = [];

  if (assessment && rooftop) {
    if (rooftop.assessmentId !== assessment.assessmentId) {
      issues.push('Rooftop assessment ID mismatch');
    }
  }

  if (rooftop && solarAnalysis) {
    if (solarAnalysis.rooftopId !== rooftop.id) {
      issues.push('Solar analysis rooftop ID mismatch');
    }
    if (solarAnalysis.assessmentId !== rooftop.assessmentId) {
      issues.push('Solar analysis assessment ID mismatch');
    }
  }

  if (solarAnalysis && panelLayout) {
    if (panelLayout.solarAnalysisId !== solarAnalysis.id) {
      issues.push('Panel layout solar analysis ID mismatch');
    }
    if (panelLayout.rooftopId !== solarAnalysis.rooftopId) {
      issues.push('Panel layout rooftop ID mismatch');
    }
  }

  if (assessment && panelLayout) {
    if (panelLayout.assessmentId !== assessment.assessmentId) {
      issues.push('Panel layout assessment ID mismatch');
    }
  }

  return {
    consistent: issues.length === 0,
    issues,
  };
}

/**
 * Suggests recovery actions based on validation results
 */
export function suggestRecoveryActions(checkpoint: ValidationCheckpoint): string[] {
  const actions: string[] = [];

  if (!checkpoint.canProceed) {
    if (checkpoint.missingRequirements.some(r => r.includes('Assessment'))) {
      actions.push('Start a new assessment from the beginning');
    }
    if (checkpoint.missingRequirements.some(r => r.includes('Location'))) {
      actions.push('Return to location selection and choose a location');
    }
    if (checkpoint.missingRequirements.some(r => r.includes('Building'))) {
      actions.push('Select a building or mark your rooftop location on the map');
    }
    if (checkpoint.missingRequirements.some(r => r.includes('Rooftop'))) {
      actions.push('Complete rooftop boundary definition and mark obstacles');
    }
    if (checkpoint.missingRequirements.some(r => r.includes('Solar analysis'))) {
      actions.push('Run solar suitability analysis on the rooftop');
    }
    if (checkpoint.missingRequirements.some(r => r.includes('Panel layout'))) {
      actions.push('Generate and optimize panel layout');
    }
  }

  return actions;
}
