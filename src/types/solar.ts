// ============================================
// Phase 4 — Solar Resource, Irradiance & Shading Types
// ============================================

export type SolarPotentialClassification = 'HIGH' | 'MEDIUM' | 'LOW';

export type SolarAnalysisStatus = 'idle' | 'analyzing' | 'completed' | 'outdated' | 'error';

export type SolarVisualizationLayer =
  | 'satellite'
  | 'roof_boundary'
  | 'heatmap'
  | 'shadows'
  | 'obstacles'
  | 'clearance'
  | 'effective_area'
  | 'selected_area';

export type AnalysisPeriodMode = 'annual' | 'summer' | 'monsoon' | 'winter' | 'custom';

export type SolarAreaToolMode = 'view' | 'draw_selection' | 'edit_selection';

export type SelectionMethod = 'manual' | 'recommended' | 'manual-edited-recommendation';

// --- Sun Position ---

export interface SunPosition {
  azimuth: number;       // degrees clockwise from North (0° = N, 90° = E, 180° = S, 270° = W)
  elevation: number;     // degrees above horizon (-90° to +90°)
  zenith: number;        // degrees from vertical (90° - elevation)
  declination: number;   // solar declination in degrees
  hourAngle: number;     // degrees
  isDaylight: boolean;
  sunrise: string;       // HH:mm local
  sunset: string;        // HH:mm local
  solarNoon: string;     // HH:mm local
}

// --- Solar Resource Data (Provider Normalized) ---

export interface MonthlySolarData {
  month: number;         // 1 (Jan) - 12 (Dec)
  monthName: string;
  ghi: number;           // Global Horizontal Irradiance (kWh/m²/day)
  dni: number;           // Direct Normal Irradiance (kWh/m²/day)
  dhi: number;           // Diffuse Horizontal Irradiance (kWh/m²/day)
  avgTempC: number;      // Average temperature in °C
}

export interface SolarResourceData {
  provider: string;      // e.g. 'NASA POWER / PVGIS Satellite' or 'Hottel Clear-Sky Model'
  dataset: string;       // e.g. 'MERRA-2 Satellite Geospatial'
  retrievedAt: string;
  latitude: number;
  longitude: number;
  annualGhi: number;     // Total kWh/m²/year
  annualDni: number;     // Total kWh/m²/year
  annualDhi: number;     // Total kWh/m²/year
  peakSunHoursDaily: number; // Avg hours/day
  monthlyData: MonthlySolarData[];
  resolution: string;    // e.g. '0.5° x 0.5° GIS mesh'
  isFallback: boolean;
}

// --- Smooth Solar Irradiance Zone ---

export interface SolarIrradianceZone {
  id: string;
  classification: SolarPotentialClassification;
  color: string;
  polygon: [number, number][]; // [lng, lat] ring
  area: number;                // m²
  avgSolarAccessPct: number;
  avgIrradiance: number;       // kWh/m²/year
}

// --- Dynamic Shadow Geometry ---

export interface ProjectedShadow {
  obstacleId: string;
  obstacleType: string;
  obstacleLabel: string;
  shadowPolygon: [number, number][]; // [lng, lat] ring for map overlay
  shadowLengthMeters: number;
  shadowAzimuth: number;
}

// --- Shading Source Breakdown ---

export interface ShadingSourceBreakdown {
  sourceType: string;    // 'Tree', 'Water Tank', 'Building Structure', etc.
  impactPct: number;     // Estimated contribution to shading losses (%)
  affectedAreaSqM: number;
}

// --- Section Solar Metrics ---

export interface SectionSolarMetric {
  sectionId: string;
  label: string;
  area: number;          // m²
  orientation: number | null; // azimuth
  tilt: number | null;
  avgAnnualIrradiance: number; // kWh/m²/year
  avgSolarAccessPct: number;   // %
  avgShadingLossPct: number;   // %
  classification: SolarPotentialClassification;
  suitabilityScore: number;    // 0 - 100
}

// --- User-Selected Solar Area ---

export interface SelectedSolarArea {
  id: string;
  rooftopId: string;
  geometry: GeoJSON.Polygon;
  area: number;          // m²
  solarZone: 'High' | 'Medium' | 'Low' | 'Mixed';
  avgSolarAccessPct: number;
  avgShadingLossPct: number;
  obstacleConflicts: number;
  selectionMethod: SelectionMethod;
  createdAt: string;
  updatedAt: string;
}

// --- Solar Assumptions Configuration ---

export interface SolarAssumptions {
  highThresholdPct: number;       // e.g. 80%
  mediumThresholdPct: number;     // e.g. 60%
  gridResolutionMeters: number;   // e.g. 1.5m
  defaultObstacleHeightMeters: number; // e.g. 1.5m if not specified
  albedoGroundReflectance: number; // e.g. 0.20
  soilingLossAssumptionPct: number; // e.g. 2.0%
}

// --- Full Solar Analysis Model ---

export interface SolarAnalysis {
  id: string;
  assessmentId: string;
  rooftopId: string;
  rooftopVersionTimestamp: string; // Used to detect if rooftop geometry was modified in Phase 3
  status: SolarAnalysisStatus;
  analyzedAt: string;
  resourceData: SolarResourceData;
  zones: SolarIrradianceZone[];
  selectedArea: SelectedSolarArea | null;
  sectionMetrics: SectionSolarMetric[];
  shadingBreakdown: ShadingSourceBreakdown[];
  // Aggregated Key Metrics
  avgSolarAccessPct: number;
  avgShadingImpactPct: number;
  peakSunHoursAnnual: number;
  grossRoofAreaSqM: number;
  physicalUsableAreaSqM: number;
  solarEffectiveAreaSqM: number; // Strictly <= physicalUsableAreaSqM
  overallClassification: SolarPotentialClassification;
  confidenceScore: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceFactors: {
    solarDataAvailable: boolean;
    roofGeometryAccurate: boolean;
    obstacleHeightsKnown: boolean;
    terrainEvaluated: boolean;
  };
  assumptions: SolarAssumptions;
  updatedAt: string;
}

// --- Timeline State ---

export interface SolarTimelineState {
  date: string;          // YYYY-MM-DD
  timeMinutes: number;   // minutes from midnight (0 - 1439, e.g. 720 = 12:00)
  isPlaying: boolean;
  playbackSpeed: number; // 1x, 2x, 4x
  periodMode: AnalysisPeriodMode;
}
