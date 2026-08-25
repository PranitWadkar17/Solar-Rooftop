// ============================================
// Assessment Service — Client-Side Persistence
// Shaped for future REST API swap
// ============================================

import { v4 as uuidv4 } from 'uuid';
import type { AssessmentState } from '@/types/index.js';

const STORAGE_KEY = 'solarroof-assessment';

function generateAssessmentId(): string {
  const uuid = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
  return `SR-${uuid}`;
}

export function createAssessment(): AssessmentState {
  const assessment: AssessmentState = {
    assessmentId: generateAssessmentId(),
    status: 'idle',
    selectedLatitude: null,
    selectedLongitude: null,
    selectedAddress: null,
    selectedBoundingBox: null,
    locationSource: null,
    locationConfirmed: false,
    selectedBuildingId: null,
    selectedBuildingGeometry: null,
    selectedBuildingArea: null,
    selectedBuildingName: null,
    selectedBuildingIsManual: false,
    nearbyBuildings: [],
    mapLayer: 'street',
    mapCenter: { lat: 20, lng: 0 },
    mapZoom: 2,
    createdAt: new Date().toISOString(),
    error: null,
  };
  persistAssessment(assessment);
  return assessment;
}

export function persistAssessment(state: AssessmentState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to persist assessment state:', e);
  }
}

export function loadAssessment(): AssessmentState | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as AssessmentState;
    if (!parsed.assessmentId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAssessment(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
