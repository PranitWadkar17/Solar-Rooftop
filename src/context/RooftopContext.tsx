// ============================================
// Rooftop Context — State Management for Phase 3
// ============================================

import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type {
  RooftopWorkspaceState,
  Rooftop,
  Obstacle,
  RoofSection,
  RooftopToolMode,
  RoofClassification,
  AreaUnit,
} from '@/types/rooftop.js';
import { saveRooftop } from '@/services/rooftopService';

// --- Initial State ---

const initialState: RooftopWorkspaceState = {
  rooftop: null,
  toolMode: 'select',
  selectedObstacleId: null,
  selectedSectionId: null,
  activeUnit: 'metric',
  drawingPoints: [],
  isDirty: false,
  saveStatus: 'saved',
  aiDetectionStatus: 'idle',
  aiDetectionError: null,
  showFirstTimeGuide: true,
  showRoofBoundary: true,
  showObstacles: true,
  showClearance: true,
  showExistingSolar: true,
  showSections: true,
};

// --- Actions ---

type RooftopAction =
  | { type: 'SET_ROOFTOP'; payload: Rooftop }
  | { type: 'UPDATE_ROOFTOP_GEOMETRY'; payload: GeoJSON.Polygon }
  | { type: 'SET_ROOF_TYPE'; payload: RoofClassification }
  | { type: 'SET_TOOL_MODE'; payload: RooftopToolMode }
  | { type: 'ADD_DRAWING_POINT'; payload: [number, number] }
  | { type: 'UNDO_DRAWING_POINT' }
  | { type: 'CLEAR_DRAWING_POINTS' }
  | { type: 'ADD_OBSTACLE'; payload: Obstacle }
  | { type: 'UPDATE_OBSTACLE'; payload: { id: string; changes: Partial<Obstacle> } }
  | { type: 'DELETE_OBSTACLE'; payload: string }
  | { type: 'ACCEPT_OBSTACLE'; payload: string }
  | { type: 'REJECT_OBSTACLE'; payload: string }
  | { type: 'ACCEPT_ALL_OBSTACLES' }
  | { type: 'SELECT_OBSTACLE'; payload: string | null }
  | { type: 'ADD_SECTION'; payload: RoofSection }
  | { type: 'DELETE_SECTION'; payload: string }
  | { type: 'SELECT_SECTION'; payload: string | null }
  | { type: 'SET_UNIT'; payload: AreaUnit }
  | { type: 'TOGGLE_LAYER'; payload: keyof Pick<RooftopWorkspaceState, 'showRoofBoundary' | 'showObstacles' | 'showClearance' | 'showExistingSolar' | 'showSections'> }
  | { type: 'SET_AI_STATUS'; payload: { status: RooftopWorkspaceState['aiDetectionStatus']; error?: string | null } }
  | { type: 'MARK_SAVED' }
  | { type: 'DISMISS_GUIDE' };

// --- Reducer ---

function rooftopReducer(state: RooftopWorkspaceState, action: RooftopAction): RooftopWorkspaceState {
  switch (action.type) {
    case 'SET_ROOFTOP':
      return { ...state, rooftop: action.payload, isDirty: false, saveStatus: 'saved' };

    case 'UPDATE_ROOFTOP_GEOMETRY':
      if (!state.rooftop) return state;
      return {
        ...state,
        rooftop: {
          ...state.rooftop,
          geometry: action.payload,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
        saveStatus: 'unsaved',
      };

    case 'SET_ROOF_TYPE':
      if (!state.rooftop) return state;
      return {
        ...state,
        rooftop: { ...state.rooftop, roofType: action.payload, updatedAt: new Date().toISOString() },
        isDirty: true,
        saveStatus: 'unsaved',
      };

    case 'SET_TOOL_MODE':
      return { ...state, toolMode: action.payload, drawingPoints: [] };

    case 'ADD_DRAWING_POINT':
      return { ...state, drawingPoints: [...state.drawingPoints, action.payload] };

    case 'UNDO_DRAWING_POINT':
      return { ...state, drawingPoints: state.drawingPoints.slice(0, -1) };

    case 'CLEAR_DRAWING_POINTS':
      return { ...state, drawingPoints: [] };

    case 'ADD_OBSTACLE':
      if (!state.rooftop) return state;
      return {
        ...state,
        rooftop: {
          ...state.rooftop,
          obstacles: [...state.rooftop.obstacles, action.payload],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
        saveStatus: 'unsaved',
      };

    case 'UPDATE_OBSTACLE':
      if (!state.rooftop) return state;
      return {
        ...state,
        rooftop: {
          ...state.rooftop,
          obstacles: state.rooftop.obstacles.map((o) =>
            o.id === action.payload.id
              ? { ...o, ...action.payload.changes, updatedAt: new Date().toISOString() }
              : o
          ),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
        saveStatus: 'unsaved',
      };

    case 'DELETE_OBSTACLE':
      if (!state.rooftop) return state;
      return {
        ...state,
        rooftop: {
          ...state.rooftop,
          obstacles: state.rooftop.obstacles.filter((o) => o.id !== action.payload),
          updatedAt: new Date().toISOString(),
        },
        selectedObstacleId: state.selectedObstacleId === action.payload ? null : state.selectedObstacleId,
        isDirty: true,
        saveStatus: 'unsaved',
      };

    case 'ACCEPT_OBSTACLE':
      if (!state.rooftop) return state;
      return {
        ...state,
        rooftop: {
          ...state.rooftop,
          obstacles: state.rooftop.obstacles.map((o) =>
            o.id === action.payload ? { ...o, status: 'accepted' as const, updatedAt: new Date().toISOString() } : o
          ),
        },
        isDirty: true,
        saveStatus: 'unsaved',
      };

    case 'REJECT_OBSTACLE':
      if (!state.rooftop) return state;
      return {
        ...state,
        rooftop: {
          ...state.rooftop,
          obstacles: state.rooftop.obstacles.map((o) =>
            o.id === action.payload ? { ...o, status: 'rejected' as const, updatedAt: new Date().toISOString() } : o
          ),
        },
        isDirty: true,
        saveStatus: 'unsaved',
      };

    case 'ACCEPT_ALL_OBSTACLES':
      if (!state.rooftop) return state;
      return {
        ...state,
        rooftop: {
          ...state.rooftop,
          obstacles: state.rooftop.obstacles.map((o) =>
            o.status === 'pending' ? { ...o, status: 'accepted' as const, updatedAt: new Date().toISOString() } : o
          ),
        },
        isDirty: true,
        saveStatus: 'unsaved',
      };

    case 'SELECT_OBSTACLE':
      return { ...state, selectedObstacleId: action.payload, selectedSectionId: null };

    case 'ADD_SECTION':
      if (!state.rooftop) return state;
      return {
        ...state,
        rooftop: {
          ...state.rooftop,
          sections: [...state.rooftop.sections, action.payload],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
        saveStatus: 'unsaved',
      };

    case 'DELETE_SECTION':
      if (!state.rooftop) return state;
      return {
        ...state,
        rooftop: {
          ...state.rooftop,
          sections: state.rooftop.sections.filter((s) => s.id !== action.payload),
          updatedAt: new Date().toISOString(),
        },
        selectedSectionId: state.selectedSectionId === action.payload ? null : state.selectedSectionId,
        isDirty: true,
        saveStatus: 'unsaved',
      };

    case 'SELECT_SECTION':
      return { ...state, selectedSectionId: action.payload, selectedObstacleId: null };

    case 'SET_UNIT':
      return { ...state, activeUnit: action.payload };

    case 'TOGGLE_LAYER':
      return { ...state, [action.payload]: !state[action.payload] };

    case 'SET_AI_STATUS':
      return {
        ...state,
        aiDetectionStatus: action.payload.status,
        aiDetectionError: action.payload.error ?? null,
      };

    case 'MARK_SAVED':
      return { ...state, isDirty: false, saveStatus: 'saved' };

    case 'DISMISS_GUIDE':
      localStorage.setItem('solarroof-rooftop-guide-dismissed', 'true');
      return { ...state, showFirstTimeGuide: false };

    default:
      return state;
  }
}

// --- Context ---

interface RooftopContextValue {
  state: RooftopWorkspaceState;
  dispatch: React.Dispatch<RooftopAction>;
}

const RooftopContext = createContext<RooftopContextValue | null>(null);

// --- Provider ---

export function RooftopProvider({
  children,
  initialRooftop,
}: {
  children: React.ReactNode;
  initialRooftop: Rooftop | null;
}) {
  const guideAlreadyDismissed = typeof window !== 'undefined' && localStorage.getItem('solarroof-rooftop-guide-dismissed') === 'true';

  const [state, dispatch] = useReducer(rooftopReducer, {
    ...initialState,
    rooftop: initialRooftop,
    showFirstTimeGuide: !guideAlreadyDismissed,
  });

  // --- Auto-save (debounced) ---
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!state.isDirty || !state.rooftop) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      if (state.rooftop) {
        saveRooftop(state.rooftop);
        dispatch({ type: 'MARK_SAVED' });
      }
    }, 1200);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state.isDirty, state.rooftop]);

  return (
    <RooftopContext.Provider value={{ state, dispatch }}>
      {children}
    </RooftopContext.Provider>
  );
}

// --- Hook ---

export function useRooftop() {
  const ctx = useContext(RooftopContext);
  if (!ctx) throw new Error('useRooftop must be used within a RooftopProvider');
  return ctx;
}
