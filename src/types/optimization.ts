// ============================================
// Phase 5 — Panel Optimization & Solar Array Types
// ============================================

export type PanelOrientation = 'portrait' | 'landscape' | 'auto';

export type OptimizationObjective =
  | 'max_generation'
  | 'max_capacity'
  | 'best_utilization'
  | 'balanced'
  | 'consumption_optimized';

export type OptimizationToolMode = 'select' | 'delete' | 'move';

// --- Panel Hardware Specification ---

export type ManufacturerBrand = 'Tata Power Solar' | 'Vikram Solar' | 'Adani Solar' | string;

export interface PanelSpecification {
  id: string;
  manufacturer: ManufacturerBrand;
  model: string;
  ratedPowerW: number;      // e.g. 550 W
  lengthM: number;          // e.g. 2.28 m
  widthM: number;           // e.g. 1.13 m
  thicknessMm?: number;     // e.g. 35 mm
  weightKg?: number;        // e.g. 28.5 kg
  efficiencyPct: number;    // e.g. 21.5 %
  technology: string;       // e.g. 'TOPCon Bifacial', 'Mono-PERC'
  tempCoeffPmax: number;    // e.g. -0.30 %/°C
  isDemo: boolean;
  source: string;
  // Professional suitability & specifications
  seriesName?: string;
  cellType?: string;
  bestIn?: string;
  suits?: string;
  whenToUse?: string;
  roofLoadBearingKgPerSqM?: string; // e.g. "18 - 22 kg/m²"
  windSpeedRatingKmh?: number;      // e.g. 180 km/h
  dailyMinMaxKwh?: { min: number; max: number };
  annualMinMaxKwh?: { min: number; max: number };
  warrantyYearsProduct?: number;
  warrantyYearsPerformance?: number;
  bifacialGainPct?: number;
}

export interface ManufacturerProfile {
  id: 'tata' | 'vikram' | 'adani';
  brandName: 'Tata Power Solar' | 'Vikram Solar' | 'Adani Solar';
  tagline: string;
  badge: string;
  accentColor: string;
  overview: string;
  bestIn: string[];
  suitedFor: string[];
  whenToUse: string;
  certifications: string[];
  warrantyHighlight: string;
  models: PanelSpecification[];
}


// --- Individual Placed Panel Instance ---

export interface PanelInstance {
  id: string;
  layoutId: string;
  index: number;
  geometry: GeoJSON.Polygon; // [lng, lat] coordinates for the 4 corners of the panel
  centroid: { lat: number; lng: number };
  orientation: 'portrait' | 'landscape';
  lengthM: number;
  widthM: number;
  tiltDeg: number;
  azimuthDeg: number;
  sectionId: string | null;
  solarZone: 'High' | 'Medium' | 'Low' | 'Mixed';
  solarAccessPct: number;
  ratedPowerW: number;
  isLocked: boolean;
  isDeleted: boolean;
}

// --- Design & Placement Constraints ---

export interface DesignConstraints {
  orientation: PanelOrientation;
  tiltDeg: number;          // Mount tilt angle (e.g. 15° - 25°)
  azimuthDeg: number | null;// Mount azimuth (180° = South, 0° = North, null = auto)
  edgeClearanceM: number;   // Roof parapet edge clearance (e.g. 0.5m)
  obstacleClearanceM: number; // Extra setback from obstacle boundaries (e.g. 0.3m)
  rowSpacingM: number;      // Inter-row pitch spacing (e.g. 0.8m for shading clearance)
  panelSpacingM: number;    // Inter-module gap (e.g. 0.02m)
  maxPanelCount: number | null;
  targetCapacityKWp: number | null;
}

// --- Layout Validation Result ---

export interface LayoutValidation {
  isValid: boolean;
  issues: string[];
  warnings: string[];
}

// --- Layout Score Breakdown ---

export interface LayoutScoreBreakdown {
  solarQuality: number;     // 0 - 100
  spatialEfficiency: number;// 0 - 100
  compliance: number;       // 0 - 100
}

// --- Complete Array Layout Model ---

export interface PanelLayout {
  id: string;
  name: string;
  assessmentId: string;
  rooftopId: string;
  solarAnalysisId: string;
  selectedAreaId: string;
  objective: OptimizationObjective;
  panelSpec: PanelSpecification;
  constraints: DesignConstraints;
  panels: PanelInstance[];
  activePanelCount: number;
  systemCapacityKWp: number; // Panel Count * ratedPowerW / 1000
  occupiedAreaSqM: number;   // Total area of active panel modules
  selectedAreaSqM: number;   // Input constraint area from Phase 4
  utilizationPct: number;    // occupiedAreaSqM / selectedAreaSqM * 100
  layoutScore: number;       // Weighted 0 - 100 score
  scoreBreakdown: LayoutScoreBreakdown;
  validation: LayoutValidation;
  structuralValidation?: {
    loadCapacityCheck: 'pass' | 'warning' | 'fail';
    windZoneCompliance: 'pass' | 'unknown';
    fireAccessCompliance: 'pass' | 'warning';
    issues: string[];
    recommendations: string[];
  };
  codeCompliance?: {
    edgeClearance: { required: number; actual: number; compliant: boolean };
    obstacleClearance: { required: number; actual: number; compliant: boolean };
    walkwayWidth: { required: number; actual: number; compliant: boolean };
    fireAccess: { required: boolean; provided: boolean; compliant: boolean };
    structuralLoad: { maxKgPerSqM: number; actualKgPerSqM: number; compliant: boolean };
  };
  isLocked: boolean;
  isFinal: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Optimization State Model ---

export interface OptimizationWorkspaceState {
  layouts: PanelLayout[];
  activeLayoutId: string | null;
  selectedPanelId: string | null;
  toolMode: OptimizationToolMode;
  isOptimizing: boolean;
  showComparison: boolean;
  status: 'idle' | 'optimizing' | 'completed' | 'outdated' | 'error';
  errorMessage: string | null;
  // History for Undo / Redo
  undoStack: PanelLayout[];
  redoStack: PanelLayout[];
  // Layer visibility
  showPanels: boolean;
  showRoofBoundary: boolean;
  showObstacles: boolean;
  showSolarLayer: boolean;
  showSelectedArea: boolean;
  // Consumption data
  consumption: import('@/types/index.js').ElectricityConsumptionProfile | null;
}
