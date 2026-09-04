// ============================================
// Optimization Context — State Management for Phase 5
// ============================================

import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import type { Rooftop } from '@/types/rooftop.js';
import type { SolarAnalysis } from '@/types/solar.js';
import type {
  PanelLayout,
  PanelSpecification,
  DesignConstraints,
  OptimizationObjective,
  OptimizationToolMode,
  OptimizationWorkspaceState,
  PanelInstance,
} from '@/types/optimization.js';
import {
  generateCandidateLayouts,
  DEFAULT_DESIGN_CONSTRAINTS,
} from '@/services/panelOptimizationService';
import { savePanelLayout, isLayoutOutdated } from '@/services/optimizationService';
import { DEFAULT_PANEL_LIBRARY } from '@/data/panelLibrary';

// --- Actions ---

type OptimizationAction =
  | { type: 'INIT_LAYOUTS'; payload: PanelLayout[] }
  | { type: 'SET_STATUS'; payload: OptimizationWorkspaceState['status'] }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SELECT_LAYOUT'; payload: string }
  | { type: 'SELECT_PANEL'; payload: string | null }
  | { type: 'SET_TOOL_MODE'; payload: OptimizationToolMode }
  | { type: 'SET_SHOW_COMPARISON'; payload: boolean }
  | { type: 'UPDATE_ACTIVE_LAYOUT'; payload: PanelLayout }
  | { type: 'DELETE_PANEL'; payload: string }
  | { type: 'RESTORE_PANEL'; payload: string }
  | { type: 'TOGGLE_LOCK' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'TOGGLE_LAYER'; payload: keyof Pick<OptimizationWorkspaceState, 'showPanels' | 'showRoofBoundary' | 'showObstacles' | 'showSolarLayer' | 'showSelectedArea'> };

// --- Initial State ---

const initialState: OptimizationWorkspaceState = {
  layouts: [],
  activeLayoutId: null,
  selectedPanelId: null,
  toolMode: 'select',
  isOptimizing: false,
  showComparison: false,
  status: 'idle',
  errorMessage: null,
  undoStack: [],
  redoStack: [],
  showPanels: true,
  showRoofBoundary: true,
  showObstacles: true,
  showSolarLayer: true,
  showSelectedArea: true,
};

// --- Reducer ---

function optimizationReducer(
  state: OptimizationWorkspaceState,
  action: OptimizationAction,
): OptimizationWorkspaceState {
  switch (action.type) {
    case 'INIT_LAYOUTS': {
      const activeId = action.payload.length > 0 ? action.payload[0].id : null;
      return {
        ...state,
        layouts: action.payload,
        activeLayoutId: activeId,
        status: 'completed',
        errorMessage: null,
      };
    }

    case 'SET_STATUS':
      return { ...state, status: action.payload };

    case 'SET_ERROR':
      return { ...state, errorMessage: action.payload, status: 'error' };

    case 'SELECT_LAYOUT':
      return { ...state, activeLayoutId: action.payload, selectedPanelId: null };

    case 'SELECT_PANEL':
      return { ...state, selectedPanelId: action.payload };

    case 'SET_TOOL_MODE':
      return { ...state, toolMode: action.payload };

    case 'SET_SHOW_COMPARISON':
      return { ...state, showComparison: action.payload };

    case 'UPDATE_ACTIVE_LAYOUT': {
      const updated = state.layouts.map((l) =>
        l.id === action.payload.id ? action.payload : l
      );
      savePanelLayout(action.payload);
      return {
        ...state,
        layouts: updated,
        undoStack: [
          ...state.undoStack,
          state.layouts.find((l) => l.id === state.activeLayoutId)!,
        ],
        redoStack: [],
      };
    }

    case 'DELETE_PANEL': {
      const current = state.layouts.find((l) => l.id === state.activeLayoutId);
      if (!current || current.isLocked) return state;

      const newPanels = current.panels.map((p) =>
        p.id === action.payload ? { ...p, isDeleted: true } : p
      );
      const activeCount = newPanels.filter((p) => !p.isDeleted).length;
      const updatedLayout: PanelLayout = {
        ...current,
        panels: newPanels,
        activePanelCount: activeCount,
        systemCapacityKWp: Math.round(((activeCount * current.panelSpec.ratedPowerW) / 1000) * 100) / 100,
        occupiedAreaSqM: Math.round(activeCount * (current.panelSpec.lengthM * current.panelSpec.widthM) * 10) / 10,
        updatedAt: new Date().toISOString(),
      };

      savePanelLayout(updatedLayout);
      return {
        ...state,
        layouts: state.layouts.map((l) => (l.id === current.id ? updatedLayout : l)),
        undoStack: [...state.undoStack, current],
        redoStack: [],
        selectedPanelId: null,
      };
    }

    case 'RESTORE_PANEL': {
      const current = state.layouts.find((l) => l.id === state.activeLayoutId);
      if (!current) return state;

      const newPanels = current.panels.map((p) =>
        p.id === action.payload ? { ...p, isDeleted: false } : p
      );
      const activeCount = newPanels.filter((p) => !p.isDeleted).length;
      const updatedLayout: PanelLayout = {
        ...current,
        panels: newPanels,
        activePanelCount: activeCount,
        systemCapacityKWp: Math.round(((activeCount * current.panelSpec.ratedPowerW) / 1000) * 100) / 100,
        occupiedAreaSqM: Math.round(activeCount * (current.panelSpec.lengthM * current.panelSpec.widthM) * 10) / 10,
        updatedAt: new Date().toISOString(),
      };

      savePanelLayout(updatedLayout);
      return {
        ...state,
        layouts: state.layouts.map((l) => (l.id === current.id ? updatedLayout : l)),
        undoStack: [...state.undoStack, current],
        redoStack: [],
      };
    }

    case 'TOGGLE_LOCK': {
      const current = state.layouts.find((l) => l.id === state.activeLayoutId);
      if (!current) return state;
      const updated: PanelLayout = { ...current, isLocked: !current.isLocked };
      savePanelLayout(updated);
      return {
        ...state,
        layouts: state.layouts.map((l) => (l.id === current.id ? updated : l)),
      };
    }

    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const previous = state.undoStack[state.undoStack.length - 1];
      const current = state.layouts.find((l) => l.id === state.activeLayoutId);
      if (!current) return state;

      savePanelLayout(previous);
      return {
        ...state,
        layouts: state.layouts.map((l) => (l.id === previous.id ? previous : l)),
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, current],
      };
    }

    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      const current = state.layouts.find((l) => l.id === state.activeLayoutId);
      if (!current) return state;

      savePanelLayout(next);
      return {
        ...state,
        layouts: state.layouts.map((l) => (l.id === next.id ? next : l)),
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, current],
      };
    }

    case 'TOGGLE_LAYER':
      return { ...state, [action.payload]: !state[action.payload] };

    default:
      return state;
  }
}

// --- Context Value Interface ---

interface OptimizationContextValue {
  state: OptimizationWorkspaceState;
  dispatch: React.Dispatch<OptimizationAction>;
  activeLayout: PanelLayout | null;
  selectedPanel: PanelInstance | null;
  panelSpec: PanelSpecification;
  constraints: DesignConstraints;
  changePanelSpec: (spec: PanelSpecification) => void;
  updateConstraints: (newConstraints: Partial<DesignConstraints>) => void;
  reoptimize: (objective?: OptimizationObjective) => void;
  finalizeLayout: () => void;
}

const OptimizationContext = createContext<OptimizationContextValue | null>(null);

// --- Provider ---

export function OptimizationProvider({
  children,
  rooftop,
  solarAnalysis,
  initialSavedLayout,
}: {
  children: React.ReactNode;
  rooftop: Rooftop | null;
  solarAnalysis: SolarAnalysis | null;
  initialSavedLayout: PanelLayout | null;
}) {
  const initialStatus: OptimizationWorkspaceState['status'] = isLayoutOutdated(
    initialSavedLayout,
    rooftop,
    solarAnalysis
  )
    ? 'outdated'
    : initialSavedLayout
    ? 'completed'
    : 'idle';

  const [state, dispatch] = useReducer(optimizationReducer, {
    ...initialState,
    status: initialStatus,
  });

  const [panelSpec, setPanelSpec] = React.useState<PanelSpecification>(
    initialSavedLayout?.panelSpec ?? DEFAULT_PANEL_LIBRARY[0]
  );
  const [constraints, setConstraints] = React.useState<DesignConstraints>(
    initialSavedLayout?.constraints ?? DEFAULT_DESIGN_CONSTRAINTS
  );

  // Active Layout getter
  const activeLayout = useMemo<PanelLayout | null>(() => {
    if (!state.activeLayoutId) return state.layouts[0] ?? null;
    return state.layouts.find((l) => l.id === state.activeLayoutId) ?? null;
  }, [state.layouts, state.activeLayoutId]);

  // Selected Panel getter
  const selectedPanel = useMemo<PanelInstance | null>(() => {
    if (!activeLayout || !state.selectedPanelId) return null;
    return activeLayout.panels.find((p) => p.id === state.selectedPanelId) ?? null;
  }, [activeLayout, state.selectedPanelId]);

  // Re-optimize candidate layouts
  const reoptimize = useCallback(
    (objective?: OptimizationObjective) => {
      if (!rooftop || !solarAnalysis || !solarAnalysis.selectedArea) return;
      dispatch({ type: 'SET_STATUS', payload: 'optimizing' });

      try {
        const candidateLayouts = generateCandidateLayouts(
          rooftop,
          solarAnalysis.selectedArea,
          panelSpec,
          constraints,
          solarAnalysis
        );
        dispatch({ type: 'INIT_LAYOUTS', payload: candidateLayouts });

        if (objective) {
          const matched = candidateLayouts.find((l) => l.objective === objective);
          if (matched) dispatch({ type: 'SELECT_LAYOUT', payload: matched.id });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Layout optimization failed';
        dispatch({ type: 'SET_ERROR', payload: msg });
      }
    },
    [rooftop, solarAnalysis, panelSpec, constraints]
  );

  // Initial layout generation on mount
  useEffect(() => {
    if (rooftop && solarAnalysis?.selectedArea && state.layouts.length === 0 && state.status !== 'error') {
      if (initialSavedLayout && !isLayoutOutdated(initialSavedLayout, rooftop, solarAnalysis)) {
        dispatch({ type: 'INIT_LAYOUTS', payload: [initialSavedLayout] });
      } else {
        reoptimize();
      }
    }
  }, [rooftop, solarAnalysis, initialSavedLayout, state.layouts.length, state.status, reoptimize]);

  // Change hardware panel spec
  const changePanelSpec = useCallback(
    (newSpec: PanelSpecification) => {
      setPanelSpec(newSpec);
      if (!rooftop || !solarAnalysis?.selectedArea) return;

      const candidateLayouts = generateCandidateLayouts(
        rooftop,
        solarAnalysis.selectedArea,
        newSpec,
        constraints,
        solarAnalysis
      );
      dispatch({ type: 'INIT_LAYOUTS', payload: candidateLayouts });
    },
    [rooftop, solarAnalysis, constraints]
  );

  // Update design constraints
  const updateConstraints = useCallback(
    (newPartial: Partial<DesignConstraints>) => {
      const merged = { ...constraints, ...newPartial };
      setConstraints(merged);
      if (!rooftop || !solarAnalysis?.selectedArea) return;

      const candidateLayouts = generateCandidateLayouts(
        rooftop,
        solarAnalysis.selectedArea,
        panelSpec,
        merged,
        solarAnalysis
      );
      dispatch({ type: 'INIT_LAYOUTS', payload: candidateLayouts });
    },
    [constraints, rooftop, solarAnalysis, panelSpec]
  );

  // Finalize layout
  const finalizeLayout = useCallback(() => {
    if (!activeLayout) return;
    const finalized: PanelLayout = {
      ...activeLayout,
      isFinal: true,
      updatedAt: new Date().toISOString(),
    };
    savePanelLayout(finalized);
  }, [activeLayout]);

  return (
    <OptimizationContext.Provider
      value={{
        state,
        dispatch,
        activeLayout,
        selectedPanel,
        panelSpec,
        constraints,
        changePanelSpec,
        updateConstraints,
        reoptimize,
        finalizeLayout,
      }}
    >
      {children}
    </OptimizationContext.Provider>
  );
}

// --- Hook ---

export function useOptimization() {
  const ctx = useContext(OptimizationContext);
  if (!ctx) throw new Error('useOptimization must be used within an OptimizationProvider');
  return ctx;
}
