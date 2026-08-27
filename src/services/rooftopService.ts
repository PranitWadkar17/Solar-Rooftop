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

function getStorageKey(assessmentId: string): string {
  return `${STORAGE_PREFIX}${assessmentId}`;
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
    sessionStorage.setItem(getStorageKey(rooftop.assessmentId), JSON.stringify(rooftop));
  } catch (e) {
    console.warn('Failed to persist rooftop:', e);
  }
}

export function loadRooftop(assessmentId: string): Rooftop | null {
  try {
    const stored = sessionStorage.getItem(getStorageKey(assessmentId));
    if (!stored) return null;
    return JSON.parse(stored) as Rooftop;
  } catch {
    return null;
  }
}

export function clearRooftop(assessmentId: string): void {
  sessionStorage.removeItem(getStorageKey(assessmentId));
}
