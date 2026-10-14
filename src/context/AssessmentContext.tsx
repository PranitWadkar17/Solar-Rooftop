// ============================================
// Assessment Context — State Management + Persistence
// ============================================

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { AssessmentState, MapLayerType, LocationSource, BuildingFootprint, ElectricityConsumptionProfile } from '@/types/index.js';
import { createAssessment, persistAssessment, loadAssessment, clearAssessment } from '@/services/assessmentService.js';

// --- Actions ---

type AssessmentAction =
  | { type: 'INIT'; payload: AssessmentState }
  | { type: 'SET_STATUS'; payload: AssessmentState['status'] }
  | { type: 'SELECT_LOCATION'; payload: { lat: number; lng: number; address: string; boundingBox: [number, number, number, number] | null; source: LocationSource } }
  | { type: 'SET_NEARBY_BUILDINGS'; payload: BuildingFootprint[] }
  | { type: 'SELECT_BUILDING'; payload: BuildingFootprint }
  | { type: 'DESELECT_BUILDING' }
  | { type: 'SET_CONSUMPTION'; payload: ElectricityConsumptionProfile }
  | { type: 'CLEAR_CONSUMPTION' }
  | { type: 'CONFIRM_SITE' }
  | { type: 'UNCONFIRM_SITE' }
  | { type: 'SET_MAP_LAYER'; payload: MapLayerType }
  | { type: 'SET_MAP_VIEW'; payload: { lat: number; lng: number; zoom: number } }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

// --- Default State ---

const defaultState: AssessmentState = {
  assessmentId: null,
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
  createdAt: null,
  error: null,
};

// --- Reducer ---

function assessmentReducer(state: AssessmentState, action: AssessmentAction): AssessmentState {
  switch (action.type) {
    case 'INIT':
      return { ...action.payload };

    case 'SET_STATUS':
      return { ...state, status: action.payload, error: null };

    case 'SELECT_LOCATION':
      return {
        ...state,
        selectedLatitude: action.payload.lat,
        selectedLongitude: action.payload.lng,
        selectedAddress: action.payload.address,
        selectedBoundingBox: action.payload.boundingBox,
        locationSource: action.payload.source,
        locationConfirmed: false,
        status: 'location_selected',
        selectedBuildingId: null,
        selectedBuildingGeometry: null,
        selectedBuildingArea: null,
        selectedBuildingName: null,
        selectedBuildingIsManual: false,
        nearbyBuildings: [],
        error: null,
      };

    case 'SET_NEARBY_BUILDINGS':
      return { ...state, nearbyBuildings: action.payload };

    case 'SELECT_BUILDING':
      return {
        ...state,
        selectedBuildingId: action.payload.id,
        selectedBuildingGeometry: action.payload.geometry,
        selectedBuildingArea: action.payload.properties.area ?? null,
        selectedBuildingName: action.payload.properties.name ?? action.payload.properties.buildingType ?? 'Selected Building',
        selectedBuildingIsManual: Boolean(action.payload.properties.isManual),
        status: 'building_selected',
        error: null,
      };

    case 'DESELECT_BUILDING':
      return {
        ...state,
        selectedBuildingId: null,
        selectedBuildingGeometry: null,
        selectedBuildingArea: null,
        selectedBuildingName: null,
        selectedBuildingIsManual: false,
        status: 'location_selected',
      };

    case 'SET_CONSUMPTION':
      return { ...state, consumption: action.payload, error: null };

    case 'CLEAR_CONSUMPTION':
      return { ...state, consumption: null };

    case 'CONFIRM_SITE':
      return { ...state, locationConfirmed: true, status: 'site_confirmed' };

    case 'UNCONFIRM_SITE':
      return {
        ...state,
        locationConfirmed: false,
        status: state.selectedBuildingId ? 'building_selected' : 'location_selected',
      };

    case 'SET_MAP_LAYER':
      return { ...state, mapLayer: action.payload };

    case 'SET_MAP_VIEW':
      return {
        ...state,
        mapCenter: { lat: action.payload.lat, lng: action.payload.lng },
        mapZoom: action.payload.zoom,
      };

    case 'SET_ERROR':
      return { ...state, error: action.payload, status: 'error' };

    case 'CLEAR_ERROR':
      return { ...state, error: null, status: state.selectedLatitude ? 'location_selected' : 'idle' };

    case 'RESET':
      clearAssessment();
      return { ...defaultState };

    default:
      return state;
  }
}

// --- Context ---

interface AssessmentContextValue {
  state: AssessmentState;
  dispatch: React.Dispatch<AssessmentAction>;
}

const AssessmentContext = createContext<AssessmentContextValue>({
  state: defaultState,
  dispatch: () => {},
});

// --- Provider ---

export function AssessmentProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(assessmentReducer, defaultState, () => {
    // Try to restore from sessionStorage
    const stored = loadAssessment();
    if (stored) return stored;
    // Create fresh assessment
    return createAssessment();
  });

  // Persist state changes (but not on every render)
  const stateJson = JSON.stringify(state);
  useEffect(() => {
    if (state.assessmentId) {
      persistAssessment(state);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateJson]);

  return (
    <AssessmentContext.Provider value={{ state, dispatch }}>
      {children}
    </AssessmentContext.Provider>
  );
}

// --- Hook ---

export function useAssessment() {
  const ctx = useContext(AssessmentContext);
  if (!ctx) throw new Error('useAssessment must be used within AssessmentProvider');

  const { state, dispatch } = ctx;

  const selectLocation = useCallback(
    (lat: number, lng: number, address: string, boundingBox: [number, number, number, number] | null, source: LocationSource) => {
      dispatch({ type: 'SELECT_LOCATION', payload: { lat, lng, address, boundingBox, source } });
    },
    [dispatch]
  );

  const selectBuilding = useCallback(
    (building: BuildingFootprint) => {
      dispatch({ type: 'SELECT_BUILDING', payload: building });
    },
    [dispatch]
  );

  const setConsumption = useCallback(
    (profile: ElectricityConsumptionProfile) => {
      dispatch({ type: 'SET_CONSUMPTION', payload: profile });
    },
    [dispatch]
  );

  const clearConsumption = useCallback(() => {
    dispatch({ type: 'CLEAR_CONSUMPTION' });
  }, [dispatch]);

  const confirmSite = useCallback(() => {
    dispatch({ type: 'CONFIRM_SITE' });
  }, [dispatch]);

  const resetAssessment = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  return {
    state,
    dispatch,
    selectLocation,
    selectBuilding,
    setConsumption,
    clearConsumption,
    confirmSite,
    resetAssessment,
  };
}
