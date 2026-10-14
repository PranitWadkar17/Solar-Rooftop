// ============================================
// Rooftop Service — Persistence & Derivation
// Shaped for future REST API swap
// ============================================

import { v4 as uuidv4 } from 'uuid';
import type { Rooftop, RoofSection, Obstacle, RoofClassification, ObstacleType, ObstacleGeometryKind, DataSource } from '@/types/rooftop.js';
import type { AssessmentState } from '@/types/index.js';
import {
  calculatePolygonArea,
  calculatePerimeter,
  calculateCentroid,
  calculateBoundingBox,
  calculateApproxDimensions,
  calculateOrientation,
} from '@/utils/geoUtils';
import { getObstacleCategory } from '@/data/obstacleCategories';

const STORAGE_PREFIX = 'solarroof-rooftop-';
const BACKUP_SUFFIX = '-backup';

function getStorageKey(assessmentId: string): string {
  return `${STORAGE_PREFIX}${assessmentId}`;
}

function getBackupKey(assessmentId: string): string {
  return `${STORAGE_PREFIX}${assessmentId}${BACKUP_SUFFIX}`;
}

/**
 * Validates rooftop data structure
 */
function validateRooftop(rooftop: unknown): rooftop is Rooftop {
  if (!rooftop || typeof rooftop !== 'object') return false;
  const r = rooftop as Partial<Rooftop>;
  
  if (!r.id || !r.assessmentId) return false;
  if (!r.geometry || !r.geometry.coordinates || r.geometry.coordinates.length === 0) return false;
  if (typeof r.area !== 'number' || r.area <= 0) return false;
  if (!Array.isArray(r.obstacles) || !Array.isArray(r.sections)) return false;
  
  return true;
}

// --- Derive Rooftop from Phase 2 Building Footprint ---

function extractRingCoordinates(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number][] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates[0] as [number, number][];
  }
  // MultiPolygon — take the largest ring
  let largest: [number, number][] = [];
  let largestArea = 0;
  for (const poly of geometry.coordinates) {
    const ring = poly[0] as [number, number][];
    const area = calculatePolygonArea(ring);
    if (area > largestArea) {
      largestArea = area;
      largest = ring;
    }
  }
  return largest;
}

export function deriveRooftopFromAssessment(assessment: AssessmentState): Rooftop | null {
  if (!assessment.assessmentId) return null;

  let coords: [number, number][] = [];
  let source: DataSource = 'derived';
  let confidence: number | null = null;

  if (assessment.selectedBuildingGeometry) {
    coords = extractRingCoordinates(assessment.selectedBuildingGeometry);
    source = assessment.selectedBuildingIsManual ? 'user_drawn' : 'map_building_data';
    confidence = source === 'map_building_data' ? 75 : null;
  } else if (assessment.selectedLatitude !== null && assessment.selectedLongitude !== null) {
    // Generate an initial default 12m x 10m rooftop footprint centered on the selected point
    const lat = assessment.selectedLatitude;
    const lng = assessment.selectedLongitude;
    const EARTH_RADIUS = 6378137;
    const dLat = (5 / EARTH_RADIUS) * (180 / Math.PI); // ~10m North-South
    const dLng = ((6 / EARTH_RADIUS) * (180 / Math.PI)) / Math.cos((lat * Math.PI) / 180); // ~12m East-West

    coords = [
      [lng - dLng, lat - dLat],
      [lng + dLng, lat - dLat],
      [lng + dLng, lat + dLat],
      [lng - dLng, lat + dLat],
      [lng - dLng, lat - dLat],
    ];
    source = 'derived';
  } else {
    return null;
  }

  if (coords.length < 3) return null;

  const area = calculatePolygonArea(coords);
  const perimeter = calculatePerimeter(coords);
  const centroid = calculateCentroid(coords);
  const bbox = calculateBoundingBox(coords);
  const dims = calculateApproxDimensions(coords);
  const orient = calculateOrientation(coords);

  const rooftopId = `roof-${uuidv4().substring(0, 8)}`;

  return {
    id: rooftopId,
    assessmentId: assessment.assessmentId,
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
    area,
    perimeter,
    centroid,
    boundingBox: bbox,
    approxDimensions: dims,
    orientation: orient.azimuth,
    orientationCardinal: orient.cardinal,
    roofType: 'unknown',
    sections: [],
    obstacles: [],
    source,
    confidence,
    updatedAt: new Date().toISOString(),
  };
}

// --- Recalculate Geometry from Coordinates ---

export function recalculateRooftopGeometry(rooftop: Rooftop): Rooftop {
  const coords = rooftop.geometry.coordinates[0] as [number, number][];
  return {
    ...rooftop,
    area: calculatePolygonArea(coords),
    perimeter: calculatePerimeter(coords),
    centroid: calculateCentroid(coords),
    boundingBox: calculateBoundingBox(coords),
    approxDimensions: calculateApproxDimensions(coords),
    orientation: calculateOrientation(coords).azimuth,
    orientationCardinal: calculateOrientation(coords).cardinal,
    updatedAt: new Date().toISOString(),
  };
}

// --- Obstacle CRUD ---

export function createObstacle(
  rooftopId: string,
  type: ObstacleType,
  geometryKind: ObstacleGeometryKind,
  geometry: GeoJSON.Polygon | GeoJSON.Point,
  area: number | null,
): Obstacle {
  const cat = getObstacleCategory(type);
  const now = new Date().toISOString();
  return {
    id: `obs-${uuidv4().substring(0, 8)}`,
    rooftopId,
    type,
    geometryKind,
    geometry,
    area,
    height: cat.defaultHeight,
    clearance: cat.defaultClearance,
    confidence: null,
    confidenceLevel: null,
    source: 'user_drawn',
    status: 'accepted',
    label: null,
    createdAt: now,
    updatedAt: now,
  };
}

// --- Roof Section ---

export function createRoofSection(
  rooftopId: string,
  geometry: GeoJSON.Polygon,
  label: string,
  roofType: RoofClassification = 'unknown',
): RoofSection {
  const coords = geometry.coordinates[0] as [number, number][];
  const orient = calculateOrientation(coords);
  return {
    id: `sec-${uuidv4().substring(0, 8)}`,
    rooftopId,
    geometry,
    area: calculatePolygonArea(coords),
    orientation: orient.azimuth,
    tilt: null, // NOT fabricated from 2D
    roofType,
    source: 'user_drawn',
    confidence: null,
    label,
  };
}

// --- Persistence ---

export function saveRooftop(rooftop: Rooftop): void {
  try {
    // Validate before saving
    if (!validateRooftop(rooftop)) {
      console.error('Invalid rooftop data - skipping persistence');
      return;
    }
    
    const key = getStorageKey(rooftop.assessmentId);
    const backupKey = getBackupKey(rooftop.assessmentId);
    
    // Create backup
    const existing = sessionStorage.getItem(key);
    if (existing) {
      try {
        sessionStorage.setItem(backupKey, existing);
      } catch (backupError) {
        console.warn('Failed to create rooftop backup:', backupError);
      }
    }
    
    sessionStorage.setItem(key, JSON.stringify(rooftop));
  } catch (e) {
    console.error('Failed to persist rooftop:', e);
    
    // Handle quota exceeded
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      try {
        const backupKey = getBackupKey(rooftop.assessmentId);
        sessionStorage.removeItem(backupKey);
        sessionStorage.setItem(getStorageKey(rooftop.assessmentId), JSON.stringify(rooftop));
        console.warn('Storage full - cleared backup and retried');
      } catch (retryError) {
        console.error('Failed to save rooftop even after clearing backup:', retryError);
      }
    }
  }
}

export function loadRooftop(assessmentId: string): Rooftop | null {
  try {
    const stored = sessionStorage.getItem(getStorageKey(assessmentId));
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    
    if (!validateRooftop(parsed)) {
      console.error('Loaded rooftop data is invalid');
      
      // Try backup recovery
      const backup = sessionStorage.getItem(getBackupKey(assessmentId));
      if (backup) {
        console.log('Attempting to recover rooftop from backup...');
        const backupParsed = JSON.parse(backup);
        if (validateRooftop(backupParsed)) {
          console.log('Successfully recovered rooftop from backup');
          sessionStorage.setItem(getStorageKey(assessmentId), backup);
          return backupParsed;
        }
      }
      
      return null;
    }
    
    return parsed as Rooftop;
  } catch (error) {
    console.error('Failed to load rooftop:', error);
    
    // Try backup recovery
    try {
      const backup = sessionStorage.getItem(getBackupKey(assessmentId));
      if (backup) {
        const backupParsed = JSON.parse(backup);
        if (validateRooftop(backupParsed)) {
          console.log('Recovered rooftop from backup after error');
          return backupParsed as Rooftop;
        }
      }
    } catch (backupError) {
      console.error('Rooftop backup recovery failed:', backupError);
    }
    
    return null;
  }
}

export function clearRooftop(assessmentId: string): void {
  try {
    sessionStorage.removeItem(getStorageKey(assessmentId));
    sessionStorage.removeItem(getBackupKey(assessmentId));
  } catch (error) {
    console.error('Failed to clear rooftop:', error);
  }
}
