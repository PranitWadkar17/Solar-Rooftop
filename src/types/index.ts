// ============================================
// SolarRoof Intelligence — Type Definitions
// ============================================

// --- Phase 1 Types ---

export interface Capability {
  id: string;
  icon: string;
  title: string;
  description: string;
  accent: 'solar' | 'green' | 'blue';
}

export interface WorkflowStep {
  number: string;
  title: string;
  description: string;
  icon: string;
}

export interface UseCase {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface TechCategory {
  category: string;
  icon: string;
  technologies: string[];
}

export interface TrustPillar {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface ScoreItem {
  label: string;
  value: number;
  color: string;
}

export interface Scenario {
  id: string;
  label: string;
  change: string;
  newValue: string;
  delta: string;
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

// --- Phase 2 Types ---

export type MapLayerType = 'street' | 'satellite';
export type LocationSource = 'search' | 'geolocation' | 'map_click';
export type AssessmentStatus =
  | 'idle'
  | 'location_searching'
  | 'location_selected'
  | 'building_loading'
  | 'building_selected'
  | 'site_confirmed'
  | 'error';

export interface GeocodingResult {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
  boundingBox: [number, number, number, number] | null; // [south, north, west, east]
  addressParts: {
    name?: string;
    locality?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
  type?: string;
}

export interface BuildingFootprint {
  id: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  properties: {
    name?: string;
    buildingType?: string;
    levels?: number;
    area?: number; // approximate area in sq meters
    isManual?: boolean; // true if manually drawn
    vertexCount?: number;
  };
  center: { lat: number; lng: number };
}

export interface AssessmentState {
  assessmentId: string | null;
  status: AssessmentStatus;
  // Location
  selectedLatitude: number | null;
  selectedLongitude: number | null;
  selectedAddress: string | null;
  selectedBoundingBox: [number, number, number, number] | null;
  locationSource: LocationSource | null;
  locationConfirmed: boolean;
  // Building
  selectedBuildingId: string | null;
  selectedBuildingGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  selectedBuildingArea: number | null;
  selectedBuildingName: string | null;
  selectedBuildingIsManual: boolean;
  nearbyBuildings: BuildingFootprint[];
  // Map
  mapLayer: MapLayerType;
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
  // Meta
  createdAt: string | null;
  error: string | null;
}

export type ThemeName = 'night' | 'day';
