import { useState } from 'react';
import { useOptimization } from '@/context/OptimizationContext';
import { DEFAULT_PANEL_LIBRARY } from '@/data/panelLibrary';
import { formatArea } from '@/utils/geoUtils';
import type { PanelOrientation, OptimizationObjective } from '@/types/optimization.js';
import styles from './OptimizationSidebar.module.css';

interface OptimizationSidebarProps {
  onProceedToEnergy: () => void;
  onOpenComparison: () => void;
}

export function OptimizationSidebar({ onProceedToEnergy, onOpenComparison }: OptimizationSidebarProps) {
  const {
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
  } = useOptimization();

  const [activeTab, setActiveTab] = useState<'design' | 'metrics' | 'inspector'>('design');

  if (!activeLayout) return null;

  const occupiedFormatted = formatArea(activeLayout.occupiedAreaSqM);
  const selectedFormatted = formatArea(activeLayout.selectedAreaSqM);

  return (
    <aside className={styles.sidebar} aria-label="Panel Optimization & Array Design Controls">
      {/* Tabs */}
      <div className={styles.tabs} role="tablist">
        <button
          className={`${styles.tab} ${activeTab === 'design' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('design')}
          role="tab"
          aria-selected={activeTab === 'design'}
        >
          Array Design
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'metrics' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('metrics')}
          role="tab"
          aria-selected={activeTab === 'metrics'}
        >
          Validation & Score
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'inspector' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('inspector')}
          role="tab"
          aria-selected={activeTab === 'inspector'}
        >
          Inspector
          {selectedPanel && <span className={styles.tabDot} />}
        </button>
      </div>

      <div className={styles.content}>
        {/* TAB 1: ARRAY DESIGN (Objective, Panel Hardware, Constraints) */}
        {activeTab === 'design' && (
          <div className={styles.tabPane}>
            {/* Optimization Objective Selector */}
            <div className={styles.sectionCard}>
              <span className={styles.cardTitle}>Optimization Objective</span>
              <div className={styles.objectiveTabs}>
                {[
                  { id: 'max_generation', label: '☀️ Max Generation' },
                  { id: 'max_capacity', label: '⚡ Max Capacity' },
                  { id: 'balanced', label: '⚖️ Balanced' },
                ].map((obj) => (
                  <button
                    key={obj.id}
                    className={`${styles.objectiveBtn} ${activeLayout.objective === obj.id ? styles.objectiveActive : ''}`}
                    onClick={() => reoptimize(obj.id as OptimizationObjective)}
                  >
                    {obj.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hardware Module Catalog Picker */}
            <div className={styles.sectionCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>PV Module Specification</span>
                <span className={styles.hardwareBadge}>{panelSpec.efficiencyPct}% Eff</span>
              </div>

              <div className={styles.panelSelectWrapper}>
                <select
                  className={styles.panelSelect}
                  value={panelSpec.id}
                  onChange={(e) => {
                    const selected = DEFAULT_PANEL_LIBRARY.find((p) => p.id === e.target.value);
                    if (selected) changePanelSpec(selected);
                  }}
                >
                  {DEFAULT_PANEL_LIBRARY.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.manufacturer} {p.model} ({p.ratedPowerW}W • {p.lengthM}m × {p.widthM}m)
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.specDetailsGrid}>
                <div>Rated Power: <strong>{panelSpec.ratedPowerW} W</strong></div>
                <div>Technology: <strong>{panelSpec.technology}</strong></div>
                <div>Dimensions: <strong>{panelSpec.lengthM}m × {panelSpec.widthM}m</strong></div>
                <div>Temp Coeff: <strong>{panelSpec.tempCoeffPmax}%/°C</strong></div>
              </div>
            </div>

            {/* Orientation & Placement Constraints */}
            <div className={styles.sectionCard}>
              <span className={styles.cardTitle}>Mounting & Spacing Constraints</span>

              {/* Orientation Toggle */}
              <div className={styles.constraintRow}>
                <span className={styles.constraintLabel}>Module Orientation</span>
                <div className={styles.toggleGroup}>
                  {(['portrait', 'landscape'] as PanelOrientation[]).map((orient) => (
                    <button
                      key={orient}
                      className={`${styles.toggleBtn} ${constraints.orientation === orient ? styles.toggleActive : ''}`}
                      onClick={() => updateConstraints({ orientation: orient })}
                    >
                      {orient === 'portrait' ? 'Vertical (Portrait)' : 'Horizontal (Landscape)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tilt Slider */}
              <div className={styles.sliderControl}>
                <div className={styles.sliderHeader}>
                  <span className={styles.constraintLabel}>Mount Tilt Angle</span>
                  <strong className={styles.sliderVal}>{constraints.tiltDeg}°</strong>
                </div>
                <input
                  type="range"
                  min="10"
                  max="35"
                  step="1"
                  value={constraints.tiltDeg}
                  className={styles.rangeInput}
                  onChange={(e) => updateConstraints({ tiltDeg: parseInt(e.target.value, 10) })}
                />
              </div>

              {/* Row Spacing Pitch */}
              <div className={styles.sliderControl}>
                <div className={styles.sliderHeader}>
                  <span className={styles.constraintLabel}>Inter-Row Pitch Spacing</span>
                  <strong className={styles.sliderVal}>{constraints.rowSpacingM} m</strong>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="1.5"
                  step="0.1"
                  value={constraints.rowSpacingM}
                  className={styles.rangeInput}
                  onChange={(e) => updateConstraints({ rowSpacingM: parseFloat(e.target.value) })}
                />
              </div>

              {/* Edge Setback Clearance */}
              <div className={styles.sliderControl}>
                <div className={styles.sliderHeader}>
                  <span className={styles.constraintLabel}>Parapet Edge Setback</span>
                  <strong className={styles.sliderVal}>{constraints.edgeClearanceM} m</strong>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1.2"
                  step="0.1"
                  value={constraints.edgeClearanceM}
                  className={styles.rangeInput}
                  onChange={(e) => updateConstraints({ edgeClearanceM: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: VALIDATION & SCORE */}
        {activeTab === 'metrics' && (
          <div className={styles.tabPane}>
            {/* Live Metrics Grid */}
            <div className={styles.sectionCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Array Sizing Summary</span>
                <span className={styles.scoreBadge}>{activeLayout.layoutScore}/100 SCORE</span>
              </div>

              <div className={styles.statGrid}>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>DC Peak Capacity</span>
                  <strong className={styles.statGreen}>{activeLayout.systemCapacityKWp} kWp</strong>
                  <span className={styles.statSub}>Total System Output</span>
                </div>

                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Active Modules</span>
                  <strong className={styles.statValue}>{activeLayout.activePanelCount}</strong>
                  <span className={styles.statSub}>{panelSpec.ratedPowerW}W Modules</span>
                </div>

                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Occupied Area</span>
                  <strong className={styles.statValue}>{occupiedFormatted.sqMeters}</strong>
                  <span className={styles.statSub}>{occupiedFormatted.sqFeet}</span>
                </div>

                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Selected Scope</span>
                  <strong className={styles.statValue}>{selectedFormatted.sqMeters}</strong>
                  <span className={styles.statSub}>{activeLayout.utilizationPct}% Utilization</span>
                </div>
              </div>
            </div>

            {/* Constraint Verification Checklist */}
            <div className={styles.sectionCard}>
              <span className={styles.cardTitle}>Constraint Compliance</span>
              <div className={styles.checklist}>
                <div className={styles.checkItem}>
                  <span className={styles.checkIcon}>✓</span>
                  <span>Inside user-selected solar installation area</span>
                </div>
                <div className={styles.checkItem}>
                  <span className={styles.checkIcon}>✓</span>
                  <span>Avoided all marked rooftop obstacles & clearance zones</span>
                </div>
                <div className={styles.checkItem}>
                  <span className={styles.checkIcon}>✓</span>
                  <span>Zero panel-on-panel overlap</span>
                </div>
                <div className={styles.checkItem}>
                  <span className={styles.checkIcon}>✓</span>
                  <span>Maintained minimum {constraints.edgeClearanceM}m parapet setback</span>
                </div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className={styles.sectionCard}>
              <span className={styles.cardTitle}>Score Factor Breakdown</span>
              <div className={styles.scoreFactors}>
                <div className={styles.scoreRow}>
                  <span>Solar Exposure Quality</span>
                  <strong>{activeLayout.scoreBreakdown.solarQuality}%</strong>
                </div>
                <div className={styles.scoreRow}>
                  <span>Spatial Packing Density</span>
                  <strong>{activeLayout.scoreBreakdown.spatialEfficiency}%</strong>
                </div>
                <div className={styles.scoreRow}>
                  <span>Constraint Compliance</span>
                  <strong>{activeLayout.scoreBreakdown.compliance}%</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MODULE INSPECTOR & EDITING */}
        {activeTab === 'inspector' && (
          <div className={styles.tabPane}>
            <div className={styles.sectionCard}>
              <span className={styles.cardTitle}>Individual Module Inspector</span>
              {selectedPanel ? (
                <div className={styles.inspectorCard}>
                  <div className={styles.inspectHeader}>
                    <strong>Module #{selectedPanel.index}</strong>
                    <span className={styles.panelPowerTag}>{selectedPanel.ratedPowerW} W</span>
                  </div>

                  <div className={styles.inspectGrid}>
                    <div>Orientation: <strong>{selectedPanel.orientation}</strong></div>
                    <div>Tilt: <strong>{selectedPanel.tiltDeg}°</strong></div>
                    <div>Azimuth: <strong>{selectedPanel.azimuthDeg}° S</strong></div>
                    <div>Solar Zone: <strong>{selectedPanel.solarZone}</strong></div>
                    <div>Solar Access: <strong>{selectedPanel.solarAccessPct}%</strong></div>
                    <div>Status: <strong>{selectedPanel.isDeleted ? 'Deleted' : 'Active'}</strong></div>
                  </div>

                  <div className={styles.inspectActions}>
                    {!selectedPanel.isDeleted ? (
                      <button
                        className={styles.deletePanelBtn}
                        onClick={() => dispatch({ type: 'DELETE_PANEL', payload: selectedPanel.id })}
                      >
                        🗑️ Delete This Module
                      </button>
                    ) : (
                      <button
                        className={styles.restorePanelBtn}
                        onClick={() => dispatch({ type: 'RESTORE_PANEL', payload: selectedPanel.id })}
                      >
                        ↩️ Restore Module
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.noPanelPrompt}>
                  <span>🔍</span>
                  <p>Click any PV module on the map to inspect its electrical ratings, solar access, and position properties.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toolbar for Undo, Redo, Compare */}
      <div className={styles.toolbar}>
        <button
          className={styles.toolBtn}
          disabled={state.undoStack.length === 0}
          onClick={() => dispatch({ type: 'UNDO' })}
          title="Undo last change"
        >
          ↩ Undo
        </button>
        <button
          className={styles.toolBtn}
          disabled={state.redoStack.length === 0}
          onClick={() => dispatch({ type: 'REDO' })}
          title="Redo change"
        >
          ↪ Redo
        </button>
        <button className={styles.compareBtn} onClick={onOpenComparison} title="Compare Candidate Layouts">
          📊 Compare (3)
        </button>
      </div>

      {/* Action Footer */}
      <div className={styles.footer}>
        <button
          className={styles.proceedBtn}
          onClick={() => {
            finalizeLayout();
            onProceedToEnergy();
          }}
        >
          <span>Save & Continue to Energy Analysis</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
