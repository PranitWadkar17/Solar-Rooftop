// ============================================
// Optimization Context — State Management for Phase 5
// ============================================

import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import type { Rooftop } from '@/types/rooftop.js';
import type { SolarAnalysis } from '@/types/solar.js';
import type { ElectricityConsumptionProfile } from '@/types/index.js';
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
  generateArrayPlacement,
  DEFAULT_DESIGN_CONSTRAINTS,
} from '@/services/panelOptimizationService';
import { savePanelLayout, isLayoutOutdated } from '@/services/optimizationService';
import { DEFAULT_PANEL_LIBRARY } from '@/data/panelLibrary';
import { convertBillAmountToKwh, DEFAULT_TARIFF_RATE_INR } from '@/utils/consumptionUtils';


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
  | { type: 'TOGGLE_LAYER'; payload: keyof Pick<OptimizationWorkspaceState, 'showPanels' | 'showRoofBoundary' | 'showObstacles' | 'showSolarLayer' | 'showSelectedArea'> }
  | { type: 'SET_CONSUMPTION'; payload: ElectricityConsumptionProfile | null };

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
  consumption: null,
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

    case 'SET_CONSUMPTION':
      return { ...state, consumption: action.payload };

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
  consumption: ElectricityConsumptionProfile | null;
  monthlyBillAmountInr: number | null;
  tariffRateInr: number;
  changePanelSpec: (spec: PanelSpecification) => void;
  updateConstraints: (newConstraints: Partial<DesignConstraints>) => void;
  reoptimize: (objective?: OptimizationObjective) => void;
  finalizeLayout: () => void;
  setMonthlyConsumption: (monthlyKwh: number) => void;
  setMonthlyBillAmount: (billAmountInr: number) => void;
  clearConsumption: () => void;
  placeMaxCapacityLayout: () => void;
  maxPanelCount: number;
  maxPotentialAnnualEnergyKwh: number;
  solarResourceKwhPerKwp: number;
  estimatedAnnualEnergyKwh: number;
  isPlacing: boolean;
  placingMessage: string | null;
}

const OptimizationContext = createContext<OptimizationContextValue | null>(null);

// --- Provider ---

export function OptimizationProvider({
  children,
  rooftop,
  solarAnalysis,
  initialSavedLayout,
  initialConsumption = null,
}: {
  children: React.ReactNode;
  rooftop: Rooftop | null;
  solarAnalysis: SolarAnalysis | null;
  initialSavedLayout: PanelLayout | null;
  initialConsumption?: ElectricityConsumptionProfile | null;
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
    consumption: initialConsumption,
  });

  const [panelSpec, setPanelSpec] = React.useState<PanelSpecification>(
    initialSavedLayout?.panelSpec ?? DEFAULT_PANEL_LIBRARY[0]
  );
  const [constraints, setConstraints] = React.useState<DesignConstraints>(
    initialSavedLayout?.constraints ?? DEFAULT_DESIGN_CONSTRAINTS
  );

  const [isPlacing, setIsPlacing] = React.useState<boolean>(false);
  const [placingMessage, setPlacingMessage] = React.useState<string | null>(null);

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

  // Dynamic annual solar resource in kWh/kWp
  const solarResourceKwhPerKwp = useMemo(() => {
    return solarAnalysis?.peakSunHoursAnnual
      ? solarAnalysis.peakSunHoursAnnual * 365
      : 1450;
  }, [solarAnalysis]);

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
          solarAnalysis,
          state.consumption
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
    [rooftop, solarAnalysis, panelSpec, constraints, state.consumption]
  );

  // Initial layout generation on mount
  useEffect(() => {
    if (rooftop && solarAnalysis?.selectedArea && state.layouts.length === 0 && state.status !== 'error') {
      if (initialSavedLayout && !isLayoutOutdated(initialSavedLayout, rooftop, solarAnalysis)) {
        dispatch({ type: 'INIT_LAYOUTS', payload: [initialSavedLayout] });
      } else if (initialConsumption && initialConsumption.annualKwh) {
        // If saved/initial consumption profile exists, generate consumption-optimized layout
        const candidateLayouts = generateCandidateLayouts(
          rooftop,
          solarAnalysis.selectedArea,
          panelSpec,
          constraints,
          solarAnalysis,
          initialConsumption
        );
        dispatch({ type: 'INIT_LAYOUTS', payload: candidateLayouts });
      }
      // Note: If no consumption or saved layout exists, we intentionally wait for user input
      // so that panels are sized and placed on the basis of monthly consumption, not randomly!
    }
  }, [rooftop, solarAnalysis, initialSavedLayout, initialConsumption, state.layouts.length, state.status, panelSpec, constraints]);

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

  // Calculate max panels that can fit in the area (from the max_capacity layout)
  const maxPanelCount = useMemo(() => {
    if (!rooftop || !solarAnalysis?.selectedArea) return 0;
    // Generate a max-capacity placement to find the theoretical maximum
    const maxPanels = generateArrayPlacement(
      rooftop,
      solarAnalysis.selectedArea,
      panelSpec,
      { ...constraints, maxPanelCount: null },
      solarAnalysis
    );
    return maxPanels.length;
  }, [rooftop, solarAnalysis, panelSpec, constraints]);

  // Maximum potential energy if roof is fully populated with panels
  const maxPotentialAnnualEnergyKwh = useMemo(() => {
    if (maxPanelCount === 0) return 0;
    const maxCapacityKWp = (maxPanelCount * panelSpec.ratedPowerW) / 1000;
    const performanceRatio = 0.78;
    return Math.round(maxCapacityKWp * solarResourceKwhPerKwp * performanceRatio);
  }, [maxPanelCount, panelSpec, solarResourceKwhPerKwp]);

  // Dynamically calculate estimated annual energy production from the active layout
  const estimatedAnnualEnergyKwh = useMemo(() => {
    if (!activeLayout) return 0;
    const performanceRatio = 0.78;
    return Math.round(activeLayout.systemCapacityKWp * solarResourceKwhPerKwp * performanceRatio);
  }, [activeLayout, solarResourceKwhPerKwp]);

  // Set monthly consumption and regenerate layouts with consumption-optimized placement
  const setMonthlyConsumption = useCallback((monthlyKwh: number) => {
    const annualKwh = monthlyKwh * 12;
    const consumptionProfile: ElectricityConsumptionProfile = {
      annualKwh,
      monthlyKwh: Array.from({ length: 12 }, (_, i) => ({
        month: `2026-${String(i + 1).padStart(2, '0')}`,
        kwh: monthlyKwh,
      })),
      source: 'manual',
      confidence: 1.0,
      billFileName: null,
      uploadedAt: null,
    };

    // Calculate how many panels will be placed
    const panelKWp = panelSpec.ratedPowerW / 1000;
    const performanceRatio = 0.78;
    const annualEnergyPerPanel = panelKWp * solarResourceKwhPerKwp * performanceRatio;
    const calculatedNeeded = Math.ceil(annualKwh / annualEnergyPerPanel);
    const actualPlacingCount = Math.min(calculatedNeeded, maxPanelCount > 0 ? maxPanelCount : calculatedNeeded);

    // Dynamic placing feedback
    setIsPlacing(true);
    setPlacingMessage(
      `Placing ${actualPlacingCount} panels for ${monthlyKwh.toLocaleString()} kWh/month consumption in optimal solar zones...`
    );

    dispatch({ type: 'SET_CONSUMPTION', payload: consumptionProfile });

    try {
      const assessmentData = sessionStorage.getItem('solarroof-assessment');
      if (assessmentData) {
        const parsed = JSON.parse(assessmentData);
        parsed.consumption = consumptionProfile;
        sessionStorage.setItem('solarroof-assessment', JSON.stringify(parsed));
      }
    } catch {
      // Ignore
    }

    // Regenerate layouts with consumption-aware option
    if (rooftop && solarAnalysis?.selectedArea) {
      const candidateLayouts = generateCandidateLayouts(
        rooftop,
        solarAnalysis.selectedArea,
        panelSpec,
        constraints,
        solarAnalysis,
        consumptionProfile
      );
      dispatch({ type: 'INIT_LAYOUTS', payload: candidateLayouts });

      // Auto-select the consumption-optimized layout if it exists
      const consumptionLayout = candidateLayouts.find(l => l.objective === 'consumption_optimized');
      if (consumptionLayout) {
        dispatch({ type: 'SELECT_LAYOUT', payload: consumptionLayout.id });
      }
    }

    setTimeout(() => {
      setIsPlacing(false);
      setPlacingMessage(null);
    }, 600);
  }, [rooftop, solarAnalysis, panelSpec, constraints, solarResourceKwhPerKwp, maxPanelCount]);

  // Place maximum capacity layout on demand
  const placeMaxCapacityLayout = useCallback(() => {
    if (!rooftop || !solarAnalysis?.selectedArea) return;

    setIsPlacing(true);
    setPlacingMessage(`Placing maximum capacity (${maxPanelCount} panels) across selected solar area...`);

    const candidateLayouts = generateCandidateLayouts(
      rooftop,
      solarAnalysis.selectedArea,
      panelSpec,
      constraints,
      solarAnalysis,
      null
    );
    dispatch({ type: 'INIT_LAYOUTS', payload: candidateLayouts });

    const maxCapLayout = candidateLayouts.find(l => l.objective === 'max_capacity') ?? candidateLayouts[0];
    if (maxCapLayout) {
      dispatch({ type: 'SELECT_LAYOUT', payload: maxCapLayout.id });
    }

    setTimeout(() => {
      setIsPlacing(false);
      setPlacingMessage(null);
    }, 600);
  }, [rooftop, solarAnalysis, panelSpec, constraints, maxPanelCount]);

  // Clear consumption and regenerate layouts without consumption
  const clearConsumption = useCallback(() => {
    dispatch({ type: 'SET_CONSUMPTION', payload: null });

    try {
      const assessmentData = sessionStorage.getItem('solarroof-assessment');
      if (assessmentData) {
        const parsed = JSON.parse(assessmentData);
        parsed.consumption = null;
        sessionStorage.setItem('solarroof-assessment', JSON.stringify(parsed));
      }
    } catch {
      // Ignore
    }

    if (rooftop && solarAnalysis?.selectedArea) {
      const candidateLayouts = generateCandidateLayouts(
        rooftop,
        solarAnalysis.selectedArea,
        panelSpec,
        constraints,
        solarAnalysis,
        null
      );
      dispatch({ type: 'INIT_LAYOUTS', payload: candidateLayouts });
    }
  }, [rooftop, solarAnalysis, panelSpec, constraints]);

  const tariffRateInr = DEFAULT_TARIFF_RATE_INR; // ₹8.0 per kWh
  const monthlyBillAmountInr = useMemo(() => {
    if (state.consumption?.monthlyBillAmountInr) return state.consumption.monthlyBillAmountInr;
    if (state.consumption?.annualKwh) {
      return Math.round((state.consumption.annualKwh / 12) * tariffRateInr);
    }
    return null;
  }, [state.consumption, tariffRateInr]);

  // Set monthly bill amount in INR and place panels accordingly
  const setMonthlyBillAmount = useCallback((billAmountInr: number) => {
    const { monthlyKwh, annualKwh } = convertBillAmountToKwh(billAmountInr, tariffRateInr);
    const consumptionProfile: ElectricityConsumptionProfile = {
      annualKwh,
      monthlyKwh: Array.from({ length: 12 }, (_, i) => ({
        month: `2026-${String(i + 1).padStart(2, '0')}`,
        kwh: monthlyKwh,
      })),
      source: 'manual',
      confidence: 1.0,
      billFileName: null,
      uploadedAt: null,
      monthlyBillAmountInr: billAmountInr,
      tariffRateInr,
    };

    // Calculate how many panels will be placed
    const panelKWp = panelSpec.ratedPowerW / 1000;
    const performanceRatio = 0.78;
    const annualEnergyPerPanel = panelKWp * solarResourceKwhPerKwp * performanceRatio;
    const calculatedNeeded = Math.ceil(annualKwh / annualEnergyPerPanel);
    const actualPlacingCount = Math.min(calculatedNeeded, maxPanelCount > 0 ? maxPanelCount : calculatedNeeded);

    // Dynamic placing feedback
    setIsPlacing(true);
    setPlacingMessage(
      `Placing ${actualPlacingCount} panels for ₹${billAmountInr.toLocaleString()}/month bill (${monthlyKwh} units) in optimal solar zones...`
    );

    dispatch({ type: 'SET_CONSUMPTION', payload: consumptionProfile });

    try {
      const assessmentData = sessionStorage.getItem('solarroof-assessment');
      if (assessmentData) {
        const parsed = JSON.parse(assessmentData);
        parsed.consumption = consumptionProfile;
        sessionStorage.setItem('solarroof-assessment', JSON.stringify(parsed));
      }
    } catch {
      // Ignore
    }

    if (rooftop && solarAnalysis?.selectedArea) {
      const candidateLayouts = generateCandidateLayouts(
        rooftop,
        solarAnalysis.selectedArea,
        panelSpec,
        constraints,
        solarAnalysis,
        consumptionProfile
      );
      dispatch({ type: 'INIT_LAYOUTS', payload: candidateLayouts });

      const consumptionLayout = candidateLayouts.find(l => l.objective === 'consumption_optimized');
      if (consumptionLayout) {
        dispatch({ type: 'SELECT_LAYOUT', payload: consumptionLayout.id });
      }
    }

    setTimeout(() => {
      setIsPlacing(false);
      setPlacingMessage(null);
    }, 600);
  }, [rooftop, solarAnalysis, panelSpec, constraints, solarResourceKwhPerKwp, maxPanelCount, tariffRateInr]);

  return (
    <OptimizationContext.Provider
      value={{
        state,
        dispatch,
        activeLayout,
        selectedPanel,
        panelSpec,
        constraints,
        consumption: state.consumption,
        monthlyBillAmountInr,
        tariffRateInr,
        changePanelSpec,
        updateConstraints,
        reoptimize,
        finalizeLayout,
        setMonthlyConsumption,
        setMonthlyBillAmount,
        clearConsumption,
        placeMaxCapacityLayout,
        maxPanelCount,
        maxPotentialAnnualEnergyKwh,
        solarResourceKwhPerKwp,
        estimatedAnnualEnergyKwh,
        isPlacing,
        placingMessage,
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
