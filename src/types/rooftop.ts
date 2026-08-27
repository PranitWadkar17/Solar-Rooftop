// ============================================
// Phase 3 — Rooftop & Obstacle Type Definitions
// ============================================

// --- Roof Classification ---

export type RoofClassification =
  | 'flat'
  | 'sloped'
  | 'gabled'
  | 'hip'
  | 'mixed'
  | 'unknown';

export const ROOF_CLASSIFICATION_LABELS: Record<RoofClassification, string> = {
  flat: 'Flat',
  sloped: 'Sloped',
  gabled: 'Gabled',
  hip: 'Hip',
  mixed: 'Mixed',
  unknown: 'Unknown / Needs Confirmation',
};

// --- Obstacle Categories ---

export type ObstacleType =
  | 'tree'
  | 'water_tank'
  | 'staircase_room'
  | 'ac_unit'
  | 'solar_heater'
  | 'existing_solar_panel'
  | 'chimney_vent'
  | 'equipment'
  | 'building_structure'
  | 'other';

export type ObstacleGeometryKind = 'point' | 'rectangle' | 'polygon';

export type ObstacleSource = 'ai' | 'map_data' | 'user_drawn' | 'user_corrected' | 'derived';

export type ObstacleStatus = 'pending' | 'accepted' | 'rejected' | 'edited';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type DataSource = 'ai_detected' | 'map_building_data' | 'user_drawn' | 'user_corrected' | 'derived';

export type AreaUnit = 'metric' | 'imperial';

// --- Obstacle Model ---

export interface Obstacle {
  id: string;
  rooftopId: string;
  type: ObstacleType;
  geometryKind: ObstacleGeometryKind;
  geometry: GeoJSON.Polygon | GeoJSON.Point;
  area: number | null;         // sq meters, null for point obstacles
  height: number | null;       // meters, nullable
  clearance: number;           // meters — configurable buffer
  confidence: number | null;   // 0-100, null for manual
  confidenceLevel: ConfidenceLevel | null;
  source: ObstacleSource;
  status: ObstacleStatus;
  label: string | null;        // user-given name
  createdAt: string;
  updatedAt: string;
}

// --- Roof Section Model ---

export interface RoofSection {
  id: string;
  rooftopId: string;
  geometry: GeoJSON.Polygon;
  area: number;
  orientation: number | null;    // azimuth in degrees, nullable
  tilt: number | null;           // degrees, nullable — NOT fabricated from 2D
  roofType: RoofClassification;
  source: DataSource;
  confidence: number | null;
  label: string;
}

// --- Rooftop Model ---

export interface Rooftop {
  id: string;
  assessmentId: string;
  geometry: GeoJSON.Polygon;
  area: number;                  // sq meters
  perimeter: number;             // meters
  centroid: { lat: number; lng: number };
  boundingBox: [number, number, number, number]; // [south, north, west, east]
  approxDimensions: { length: number; width: number } | null; // meters
  orientation: number | null;    // azimuth degrees
  orientationCardinal: string | null; // N, NE, E, etc.
  roofType: RoofClassification;
  sections: RoofSection[];
  obstacles: Obstacle[];
  source: DataSource;
  confidence: number | null;
  updatedAt: string;
}

// --- Area Breakdown ---

export interface AreaBreakdown {
  totalRoofArea: number;        // sq meters
  obstacleArea: number;         // sq meters
  clearanceArea: number;        // sq meters
  walkwayArea: number;          // sq meters (reserved, configurable)
  physicalUsableArea: number;   // sq meters
}

// --- Geometry Validation ---

export interface GeometryValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// --- Obstacle Category Definition ---

export interface ObstacleCategoryDef {
  type: ObstacleType;
  label: string;
  icon: string;
  color: string;
  defaultHeight: number | null;
  defaultClearance: number;
  supportedGeometries: ObstacleGeometryKind[];
  description: string;
}

// --- Drawing / Editing Tool State ---

export type RooftopToolMode =
  | 'select'
  | 'draw_roof'
  | 'edit_roof'
  | 'draw_obstacle_point'
  | 'draw_obstacle_rect'
  | 'draw_obstacle_polygon'
  | 'edit_obstacle';

// --- Rooftop Workspace State ---

export interface RooftopWorkspaceState {
  rooftop: Rooftop | null;
  toolMode: RooftopToolMode;
  selectedObstacleId: string | null;
  selectedSectionId: string | null;
  activeUnit: AreaUnit;
  drawingPoints: [number, number][];  // [lat, lng] pairs for active drawing
  isDirty: boolean;                   // unsaved changes flag
  saveStatus: 'saved' | 'saving' | 'unsaved';
  aiDetectionStatus: 'idle' | 'detecting' | 'done' | 'error';
  aiDetectionError: string | null;
  showFirstTimeGuide: boolean;
  // Layer toggles
  showRoofBoundary: boolean;
  showObstacles: boolean;
  showClearance: boolean;
  showExistingSolar: boolean;
  showSections: boolean;
}
