// ============================================
// Assessment Service — Client-Side Persistence
// Enhanced with data validation and recovery mechanisms
// Shaped for future REST API swap
// ============================================

import { v4 as uuidv4 } from 'uuid';
import type { AssessmentState } from '@/types/index.js';

const STORAGE_KEY = 'solarroof-assessment';
const BACKUP_KEY = 'solarroof-assessment-backup';
const VERSION_KEY = 'solarroof-data-version';
const CURRENT_VERSION = '1.0';

function generateAssessmentId(): string {
  const uuid = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
  return `SR-${uuid}`;
}

/**
 * Validates assessment state structure
 */
function validateAssessmentState(state: unknown): state is AssessmentState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Partial<AssessmentState>;
  
  // Required fields
  if (!s.assessmentId || typeof s.assessmentId !== 'string') return false;
  if (!s.status || typeof s.status !== 'string') return false;
  if (!s.mapLayer || typeof s.mapLayer !== 'string') return false;
  
  // Validate coordinate types if present
  if (s.selectedLatitude !== null && typeof s.selectedLatitude !== 'number') return false;
  if (s.selectedLongitude !== null && typeof s.selectedLongitude !== 'number') return false;
  
  return true;
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
    consumption: null,
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
    // Validate before saving
    if (!validateAssessmentState(state)) {
      console.error('Invalid assessment state - skipping persistence');
      return;
    }
    
    // Create backup of existing data before overwriting
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) {
      try {
        sessionStorage.setItem(BACKUP_KEY, existing);
      } catch (backupError) {
        console.warn('Failed to create backup:', backupError);
        // Continue with save anyway
      }
    }
    
    // Save new data with version
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    sessionStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  } catch (e) {
    console.error('Failed to persist assessment state:', e);
    
    // If storage is full, try to clear backup and retry
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      try {
        sessionStorage.removeItem(BACKUP_KEY);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        console.warn('Storage was full - cleared backup and retried successfully');
      } catch (retryError) {
        console.error('Failed to save even after clearing backup:', retryError);
      }
    }
  }
}

export function loadAssessment(): AssessmentState | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    
    // Validate loaded data
    if (!validateAssessmentState(parsed)) {
      console.error('Loaded assessment data is invalid');
      
      // Try to recover from backup
      const backup = sessionStorage.getItem(BACKUP_KEY);
      if (backup) {
        console.log('Attempting to recover from backup...');
        const backupParsed = JSON.parse(backup);
        if (validateAssessmentState(backupParsed)) {
          console.log('Successfully recovered from backup');
          // Restore backup as current
          sessionStorage.setItem(STORAGE_KEY, backup);
          return backupParsed;
        }
      }
      
      return null;
    }
    
    // Check version compatibility
    const version = sessionStorage.getItem(VERSION_KEY);
    if (version && version !== CURRENT_VERSION) {
      console.warn(`Data version mismatch: stored=${version}, current=${CURRENT_VERSION}`);
      // In future, add migration logic here
    }
    
    return parsed;
  } catch (error) {
    console.error('Failed to load assessment:', error);
    
    // Try backup recovery
    try {
      const backup = sessionStorage.getItem(BACKUP_KEY);
      if (backup) {
        const backupParsed = JSON.parse(backup);
        if (validateAssessmentState(backupParsed)) {
          console.log('Recovered from backup after parse error');
          return backupParsed;
        }
      }
    } catch (backupError) {
      console.error('Backup recovery also failed:', backupError);
    }
    
    return null;
  }
}

export function clearAssessment(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(BACKUP_KEY);
    sessionStorage.removeItem(VERSION_KEY);
  } catch (error) {
    console.error('Failed to clear assessment:', error);
  }
}

/**
 * Recovers assessment from backup if main storage is corrupted
 */
export function recoverFromBackup(): AssessmentState | null {
  try {
    const backup = sessionStorage.getItem(BACKUP_KEY);
    if (!backup) {
      console.log('No backup available');
      return null;
    }
    
    const parsed = JSON.parse(backup);
    if (!validateAssessmentState(parsed)) {
      console.error('Backup data is also invalid');
      return null;
    }
    
    // Restore backup as current
    sessionStorage.setItem(STORAGE_KEY, backup);
    console.log('Successfully recovered from backup');
    return parsed;
  } catch (error) {
    console.error('Failed to recover from backup:', error);
    return null;
  }
}

/**
 * Checks data integrity and returns status
 */
export function checkDataIntegrity(): { 
  healthy: boolean; 
  hasBackup: boolean; 
  mainValid: boolean;
  backupValid: boolean;
  version: string | null;
} {
  let mainValid = false;
  let backupValid = false;
  let hasBackup = false;
  
  try {
    const main = sessionStorage.getItem(STORAGE_KEY);
    if (main) {
      const parsed = JSON.parse(main);
      mainValid = validateAssessmentState(parsed);
    }
  } catch {
    mainValid = false;
  }
  
  try {
    const backup = sessionStorage.getItem(BACKUP_KEY);
    if (backup) {
      hasBackup = true;
      const parsed = JSON.parse(backup);
      backupValid = validateAssessmentState(parsed);
    }
  } catch {
    backupValid = false;
  }
  
  const version = sessionStorage.getItem(VERSION_KEY);
  
  return {
    healthy: mainValid,
    hasBackup,
    mainValid,
    backupValid,
    version,
  };
}
