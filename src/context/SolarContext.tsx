// ============================================
// Solar Context — State Management for Phase 4
// ============================================

import React, { createContext, useContext, useReducer, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Rooftop } from '@/types/rooftop.js';
import type {
  SolarAnalysis,
  SolarTimelineState,
  SunPosition,
  ProjectedShadow,
  SelectedSolarArea,
  SolarAreaToolMode,
  AnalysisPeriodMode,
} from '@/types/solar.js';
import { calculateSunPosition, getSeasonalDatePresets } from '@/services/sunPositionService';
import { calculateProjectedShadows } from '@/services/shadingService';
import { runSolarAnalysis, isAnalysisOutdated, saveSolarAnalysis } from '@/services/solarAnalysisService';
import { generateRecommendedSolarArea, evaluateSelectedSolarArea } from '@/services/irradianceService';

// --- State Interface ---

export interface SolarWorkspaceState {
  rooftop: Rooftop | null;
  analysis: SolarAnalysis | null;
  status: 'idle' | 'analyzing' | 'completed' | 'outdated' | 'error';
  errorMessage: string | null;
  timeline: SolarTimelineState;
  toolMode: SolarAreaToolMode;
  drawingPoints: [number, number][]; // [lat, lng]
  selectedSectionId: string | null;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  // Layer toggles
  showHeatmap: boolean;
  showShadows: boolean;
  showEffectiveArea: boolean;
  showSelectedArea: boolean;
  showObstacles: boolean;
  showClearance: boolean;
}

// --- Initial State ---

const seasonalDates = getSeasonalDatePresets();

const initialTimeline: SolarTimelineState = {
  date: seasonalDates.summer,
  timeMinutes: 720, // 12:00 PM Midday
  isPlaying: false,
  playbackSpeed: 1,
  periodMode: 'annual',
};

const initialState: SolarWorkspaceState = {
  rooftop: null,
  analysis: null,
  status: 'idle',
  errorMessage: null,
  timeline: initialTimeline,
  toolMode: 'view',
  drawingPoints: [],
  selectedSectionId: null,
  saveStatus: 'saved',
  showHeatmap: true,
  showShadows: true,
  showEffectiveArea: true,
  showSelectedArea: true,
  showObstacles: true,
  showClearance: true,
};

// --- Actions ---

type SolarAction =
  | { type: 'INIT'; payload: { rooftop: Rooftop; analysis: SolarAnalysis | null } }
  | { type: 'SET_ANALYSIS'; payload: SolarAnalysis }
  | { type: 'SET_STATUS'; payload: SolarWorkspaceState['status'] }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_TIME'; payload: number }
  | { type: 'SET_DATE'; payload: string }
  | { type: 'SET_PERIOD_MODE'; payload: AnalysisPeriodMode }
  | { type: 'TOGGLE_PLAYBACK' }
  | { type: 'SET_PLAYBACK_SPEED'; payload: number }
  | { type: 'SET_TOOL_MODE'; payload: SolarAreaToolMode }
  | { type: 'ADD_DRAWING_POINT'; payload: [number, number] }
  | { type: 'UNDO_DRAWING_POINT' }
  | { type: 'CLEAR_DRAWING_POINTS' }
  | { type: 'SET_SELECTED_AREA'; payload: SelectedSolarArea | null }
  | { type: 'RECOMMEND_BEST_AREA' }
  | { type: 'CLEAR_SELECTED_AREA' }
  | { type: 'SELECT_SECTION'; payload: string | null }
  | { type: 'TOGGLE_LAYER'; payload: keyof Pick<SolarWorkspaceState, 'showHeatmap' | 'showShadows' | 'showEffectiveArea' | 'showSelectedArea' | 'showObstacles' | 'showClearance'> }
  | { type: 'MARK_SAVED' };

// --- Reducer ---

function solarReducer(state: SolarWorkspaceState, action: SolarAction): SolarWorkspaceState {
  switch (action.type) {
    case 'INIT': {
      const isOutdated = isAnalysisOutdated(action.payload.analysis, action.payload.rooftop);
      return {
        ...state,
        rooftop: action.payload.rooftop,
        analysis: action.payload.analysis,
        status: isOutdated ? 'outdated' : action.payload.analysis ? 'completed' : 'idle',
        errorMessage: null,
      };
    }

    case 'SET_ANALYSIS':
      return {
        ...state,
        analysis: action.payload,
        status: 'completed',
        errorMessage: null,
        saveStatus: 'saved',
      };

    case 'SET_STATUS':
      return { ...state, status: action.payload };

    case 'SET_ERROR':
      return { ...state, errorMessage: action.payload, status: 'error' };

    case 'SET_TIME':
      return {
        ...state,
        timeline: { ...state.timeline, timeMinutes: Math.max(360, Math.min(1080, action.payload)) },
      };

    case 'SET_DATE':
      return {
        ...state,
        timeline: { ...state.timeline, date: action.payload, periodMode: 'custom' },
      };

    case 'SET_PERIOD_MODE': {
      let targetDate = state.timeline.date;
      if (action.payload === 'summer') targetDate = seasonalDates.summer;
      if (action.payload === 'monsoon') targetDate = seasonalDates.monsoon;
      if (action.payload === 'winter') targetDate = seasonalDates.winter;
      if (action.payload === 'annual') targetDate = seasonalDates.summer;
      return {
        ...state,
        timeline: { ...state.timeline, periodMode: action.payload, date: targetDate },
      };
    }

    case 'TOGGLE_PLAYBACK':
      return {
        ...state,
        timeline: { ...state.timeline, isPlaying: !state.timeline.isPlaying },
      };

    case 'SET_PLAYBACK_SPEED':
      return {
        ...state,
        timeline: { ...state.timeline, playbackSpeed: action.payload },
      };

    case 'SET_TOOL_MODE':
      return {
        ...state,
        toolMode: action.payload,
        drawingPoints: action.payload === 'draw_selection' ? [] : state.drawingPoints,
      };

    case 'ADD_DRAWING_POINT':
      return {
        ...state,
        drawingPoints: [...state.drawingPoints, action.payload],
      };

    case 'UNDO_DRAWING_POINT':
      return {
        ...state,
        drawingPoints: state.drawingPoints.slice(0, -1),
      };

    case 'CLEAR_DRAWING_POINTS':
      return {
        ...state,
        drawingPoints: [],
      };

    case 'SET_SELECTED_AREA': {
      if (!state.analysis) return state;
      const updatedAnalysis: SolarAnalysis = {
        ...state.analysis,
        selectedArea: action.payload,
        updatedAt: new Date().toISOString(),
      };
      saveSolarAnalysis(updatedAnalysis);
      return {
        ...state,
        analysis: updatedAnalysis,
        toolMode: 'view',
        drawingPoints: [],
        saveStatus: 'saved',
      };
    }

    case 'RECOMMEND_BEST_AREA': {
      if (!state.rooftop || !state.analysis) return state;
      const recommended = generateRecommendedSolarArea(
        state.rooftop,
        state.rooftop.obstacles,
        state.analysis.solarEffectiveAreaSqM,
      );
      const updatedAnalysis: SolarAnalysis = {
        ...state.analysis,
        selectedArea: recommended,
        updatedAt: new Date().toISOString(),
      };
      saveSolarAnalysis(updatedAnalysis);
      return {
        ...state,
        analysis: updatedAnalysis,
        toolMode: 'view',
        drawingPoints: [],
        saveStatus: 'saved',
      };
    }

    case 'CLEAR_SELECTED_AREA': {
      if (!state.analysis) return state;
      const updatedAnalysis: SolarAnalysis = {
        ...state.analysis,
        selectedArea: null,
        updatedAt: new Date().toISOString(),
      };
      saveSolarAnalysis(updatedAnalysis);
      return {
        ...state,
        analysis: updatedAnalysis,
        toolMode: 'view',
        drawingPoints: [],
        saveStatus: 'saved',
      };
    }

    case 'SELECT_SECTION':
      return { ...state, selectedSectionId: action.payload };

    case 'TOGGLE_LAYER':
      return { ...state, [action.payload]: !state[action.payload] };

    case 'MARK_SAVED':
      return { ...state, saveStatus: 'saved' };

    default:
      return state;
  }
}

// --- Context Value Interface ---

interface SolarContextValue {
  state: SolarWorkspaceState;
  dispatch: React.Dispatch<SolarAction>;
  currentSunPosition: SunPosition;
  currentProjectedShadows: ProjectedShadow[];
  triggerReanalysis: () => Promise<void>;
  completeManualSelection: (geoCoords: [number, number][]) => void;
}

const SolarContext = createContext<SolarContextValue | null>(null);

// --- Provider ---

export function SolarProvider({
  children,
  initialRooftop,
  initialAnalysis,
}: {
  children: React.ReactNode;
  initialRooftop: Rooftop | null;
  initialAnalysis: SolarAnalysis | null;
}) {
  const [state, dispatch] = useReducer(solarReducer, {
    ...initialState,
    rooftop: initialRooftop,
    analysis: initialAnalysis,
    status: isAnalysisOutdated(initialAnalysis, initialRooftop)
      ? 'outdated'
      : initialAnalysis
      ? 'completed'
      : 'idle',
  });

  const animationFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);

  // Trigger analysis if not present
  const triggerReanalysis = useCallback(async () => {
    if (!state.rooftop) return;
    dispatch({ type: 'SET_STATUS', payload: 'analyzing' });
    try {
      const result = await runSolarAnalysis(state.rooftop, state.analysis?.selectedArea ?? null);
      dispatch({ type: 'SET_ANALYSIS', payload: result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Solar analysis failed';
      dispatch({ type: 'SET_ERROR', payload: msg });
    }
  }, [state.rooftop, state.analysis]);

  useEffect(() => {
    if (state.rooftop && !state.analysis && state.status === 'idle') {
      triggerReanalysis();
    }
  }, [state.rooftop, state.analysis, state.status, triggerReanalysis]);

  // Complete manual drawing selection
  const completeManualSelection = useCallback(
    (geoCoords: [number, number][]) => {
      if (!state.rooftop || !state.analysis || geoCoords.length < 3) return;
      const closedCoords: [number, number][] = [...geoCoords, geoCoords[0]];
      const evaluated = evaluateSelectedSolarArea(
        closedCoords,
        state.rooftop,
        state.rooftop.obstacles,
        'manual',
      );
      dispatch({ type: 'SET_SELECTED_AREA', payload: evaluated });
    },
    [state.rooftop, state.analysis]
  );

  // Real-time astronomical Sun Position at current timeline state
  const currentSunPosition = useMemo<SunPosition>(() => {
    const lat = state.rooftop?.centroid.lat ?? 20;
    const lng = state.rooftop?.centroid.lng ?? 78;
    return calculateSunPosition(lat, lng, state.timeline.date, state.timeline.timeMinutes);
  }, [state.rooftop, state.timeline.date, state.timeline.timeMinutes]);

  // Real-time 3D Projected Shadows
  const currentProjectedShadows = useMemo<ProjectedShadow[]>(() => {
    if (!state.rooftop || !state.showShadows) return [];
    return calculateProjectedShadows(
      state.rooftop.obstacles,
      currentSunPosition.azimuth,
      currentSunPosition.elevation,
      state.analysis?.assumptions.defaultObstacleHeightMeters ?? 1.5,
    );
  }, [state.rooftop, state.showShadows, currentSunPosition.azimuth, currentSunPosition.elevation, state.analysis]);

  // Sun path playback animation loop (06:00 -> 18:00)
  useEffect(() => {
    if (!state.timeline.isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      dispatch({ type: 'TOGGLE_PLAYBACK' });
      return;
    }

    const animate = (timestamp: number) => {
      if (!lastTickTimeRef.current) lastTickTimeRef.current = timestamp;
      const elapsed = timestamp - lastTickTimeRef.current;

      const tickInterval = 50 / state.timeline.playbackSpeed;

      if (elapsed > tickInterval) {
        lastTickTimeRef.current = timestamp;
        let nextTime = state.timeline.timeMinutes + 3;
        if (nextTime > 1080) {
          nextTime = 360; // Loop back to 06:00
        }
        dispatch({ type: 'SET_TIME', payload: nextTime });
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [state.timeline.isPlaying, state.timeline.timeMinutes, state.timeline.playbackSpeed]);

  return (
    <SolarContext.Provider
      value={{
        state,
        dispatch,
        currentSunPosition,
        currentProjectedShadows,
        triggerReanalysis,
        completeManualSelection,
      }}
    >
      {children}
    </SolarContext.Provider>
  );
}

// --- Hook ---

export function useSolar() {
  const ctx = useContext(SolarContext);
  if (!ctx) throw new Error('useSolar must be used within a SolarProvider');
  return ctx;
}
