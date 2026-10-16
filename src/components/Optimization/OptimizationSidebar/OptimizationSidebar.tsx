import { useState, useMemo } from 'react';
import { useOptimization } from '@/context/OptimizationContext';
import { DEFAULT_PANEL_LIBRARY } from '@/data/panelLibrary';
import { formatArea } from '@/utils/geoUtils';
import { calculateRequiredPanelCount } from '@/utils/consumptionUtils';
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
    consumption,
    monthlyBillAmountInr,
    tariffRateInr,
    setMonthlyConsumption,
    setMonthlyBillAmount,
    clearConsumption,
    placeMaxCapacityLayout,
    maxPanelCount,
    maxPotentialAnnualEnergyKwh,
    solarResourceKwhPerKwp,
    estimatedAnnualEnergyKwh,
    isPlacing,
  } = useOptimization();

  const [activeTab, setActiveTab] = useState<'design' | 'metrics' | 'inspector'>('design');
  const [consumptionInput, setConsumptionInput] = useState<string>('');
  const [consumptionError, setConsumptionError] = useState<string | null>(null);

  // Calculate the dynamic panel requirement from the current monthly bill
  const panelAnalysis = useMemo(() => {
    if (!consumption || !consumption.annualKwh) {
      return null;
    }

    const rate = tariffRateInr || 8.0;
    const billInr = consumption.monthlyBillAmountInr ?? Math.round((consumption.annualKwh / 12) * rate);
    const monthlyKwh = Math.round(consumption.annualKwh / 12);
    const requiredPanels = calculateRequiredPanelCount(consumption, panelSpec, solarResourceKwhPerKwp) ?? 0;
    const maxCapacityKWp = Math.round(((maxPanelCount * panelSpec.ratedPowerW) / 1000) * 100) / 100;
    const requiredCapacityKWp = Math.round(((requiredPanels * panelSpec.ratedPowerW) / 1000) * 100) / 100;
    const canFitAll = requiredPanels <= maxPanelCount;
    const estimatedMonthlyKwh = Math.round(estimatedAnnualEnergyKwh / 12);
    const monthlySavingsInr = Math.min(billInr, Math.round(estimatedMonthlyKwh * rate));

    return {
      billInr,
      monthlyKwh,
      requiredPanels,
      maxCapacityKWp,
      requiredCapacityKWp,
      canFitAll,
      monthlySavingsInr,
    };
  }, [consumption, panelSpec, maxPanelCount, solarResourceKwhPerKwp, tariffRateInr, estimatedAnnualEnergyKwh]);

  const handleConsumptionSubmit = () => {
    const value = parseFloat(consumptionInput);
    if (isNaN(value) || value < 1000) {
      setConsumptionError('Minimum monthly bill is ₹1,000');
      return;
    }
    setConsumptionError(null);
    setMonthlyBillAmount(value);
  };

  const handleConsumptionReset = () => {
    setConsumptionInput('');
    setConsumptionError(null);
    clearConsumption();
  };

  // If no layout is active yet (waiting for bill entry)
  if (!activeLayout) {
    const liveBill = parseFloat(consumptionInput);
    const rate = tariffRateInr || 8.0;
    const liveMonthlyKwh = !isNaN(liveBill) && liveBill > 0 ? Math.round(liveBill / rate) : 0;
    const liveAnnualKwh = liveMonthlyKwh * 12;
    const panelKWp = panelSpec.ratedPowerW / 1000;
    const annualEnergyPerPanel = panelKWp * solarResourceKwhPerKwp * 0.78;
    const liveRequired = liveAnnualKwh > 0 ? Math.ceil(liveAnnualKwh / annualEnergyPerPanel) : 0;
    const livePlacingCount = Math.min(liveRequired, maxPanelCount > 0 ? maxPanelCount : liveRequired);
    const liveCapacityKWp = Math.round(((livePlacingCount * panelSpec.ratedPowerW) / 1000) * 100) / 100;
    const liveEstEnergy = Math.round(liveCapacityKWp * solarResourceKwhPerKwp * 0.78);
    const liveSavings = Math.min(liveBill || 0, Math.round((liveEstEnergy / 12) * rate));

    return (
      <aside className={styles.sidebar} aria-label="Panel Optimization & Array Design Controls">
        <div className={styles.content}>
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>⚡ Solar Sizing Setup</span>
            </div>
            <p className={styles.consumptionDescription}>
              Enter your monthly electricity bill in Rupees (min. ₹1,000/month) to calculate and place the optimal solar array on your rooftop.
            </p>

            {/* Area Recommendation */}
            <div className={styles.capacityGrid} style={{ marginBottom: '14px' }}>
              <div className={styles.capacityItem}>
                <span className={styles.capacityLabel}>Max Panels</span>
                <strong className={styles.capacityValue}>{maxPanelCount}</strong>
              </div>
              <div className={styles.capacityItem}>
                <span className={styles.capacityLabel}>Max Annual Energy</span>
                <strong className={styles.capacityValueGreen}>
                  {maxPotentialAnnualEnergyKwh.toLocaleString()} kWh
                </strong>
              </div>
            </div>

            {/* Bill Input */}
            <div className={styles.consumptionInputGroup}>
              <div className={styles.inputWrapper}>
                <input
                  type="number"
                  className={styles.consumptionInput}
                  placeholder="e.g. 1000"
                  min="1000"
                  step="100"
                  value={consumptionInput}
                  onChange={(e) => {
                    setConsumptionInput(e.target.value);
                    setConsumptionError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConsumptionSubmit();
                  }}
                />
                <span className={styles.inputUnit}>₹ / mo</span>
              </div>
              <button
                className={styles.consumptionSubmitBtn}
                onClick={handleConsumptionSubmit}
                disabled={!consumptionInput || isPlacing}
              >
                {isPlacing ? 'Placing Panels...' : `Place ${livePlacingCount > 0 ? livePlacingCount : ''} Panels on Rooftop`}
              </button>
            </div>

            <span className={styles.inputHint}>Minimum requirement: ₹1,000/month bill</span>

            {consumptionError && (
              <div className={styles.consumptionError}>
                ⚠️ {consumptionError}
              </div>
            )}

            {/* Live calculations when user types */}
            {liveBill >= 1000 && (
              <div className={styles.energyProduction} style={{ marginTop: '12px' }}>
                <div className={styles.energyRow}>
                  <span>Panels to Place:</span>
                  <strong className={styles.energyValueGreen}>{livePlacingCount} panels</strong>
                </div>
                <div className={styles.energyRow}>
                  <span>System Capacity:</span>
                  <strong className={styles.energyValue}>{liveCapacityKWp} kWp</strong>
                </div>
                <div className={styles.energyRow}>
                  <span>Est. Monthly Savings:</span>
                  <strong className={styles.energyValueGreen}>₹{liveSavings.toLocaleString()} / mo</strong>
                </div>
                <div className={styles.energyDivider} />
                <div className={styles.energyRow}>
                  <span>Est. Units Offset:</span>
                  <strong className={styles.energyValue}>~{liveMonthlyKwh} units/mo</strong>
                </div>
              </div>
            )}

            <button
              type="button"
              className={styles.placeMaxBtn}
              onClick={placeMaxCapacityLayout}
              style={{ marginTop: '14px', width: '100%', padding: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              Or Place Maximum Physical Capacity ({maxPanelCount} panels)
            </button>
          </div>
        </div>
      </aside>
    );
  }

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
        {/* TAB 1: ARRAY DESIGN (Consumption, Objective, Panel Hardware, Constraints) */}
        {activeTab === 'design' && (
          <div className={styles.tabPane}>
            {/* Monthly Consumption Input Section */}
            <div className={styles.sectionCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>⚡ Monthly Electricity Bill</span>
              </div>

              {!consumption ? (
                <>
                  <p className={styles.consumptionDescription}>
                    Enter your average monthly electricity bill in Rupees (min. ₹1,000/mo) to calculate the optimal number of solar panels.
                  </p>

                  <div className={styles.consumptionInputGroup}>
                    <div className={styles.inputWrapper}>
                      <input
                        type="number"
                        className={styles.consumptionInput}
                        placeholder="e.g. 1000"
                        min="1000"
                        step="100"
                        value={consumptionInput}
                        onChange={(e) => {
                          setConsumptionInput(e.target.value);
                          setConsumptionError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConsumptionSubmit();
                        }}
                      />
                      <span className={styles.inputUnit}>₹ / month</span>
                    </div>
                    <button
                      className={styles.consumptionSubmitBtn}
                      onClick={handleConsumptionSubmit}
                      disabled={!consumptionInput}
                    >
                      Calculate & Place Panels
                    </button>
                  </div>

                  <span className={styles.inputHint}>
                    Minimum: ₹1,000/month bill
                  </span>

                  {consumptionError && (
                    <div className={styles.consumptionError}>
                      ⚠️ {consumptionError}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.consumptionSummary}>
                  {/* Consumption Entry Display */}
                  <div className={styles.consumptionHeader}>
                    <span className={styles.consumptionIcon}>✅</span>
                    <div className={styles.consumptionInfo}>
                      <strong>Monthly Bill Target</strong>
                      <span className={styles.consumptionMeta}>
                        ₹{panelAnalysis?.billInr.toLocaleString()}/month • ~{panelAnalysis?.monthlyKwh} units/mo
                      </span>
                    </div>
                    <button
                      className={styles.clearConsumptionBtn}
                      onClick={handleConsumptionReset}
                      title="Clear bill and recalculate"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Dynamic Panel Calculation Results */}
                  <div className={styles.panelCalcGrid}>
                    <div className={styles.panelCalcItem}>
                      <span className={styles.panelCalcLabel}>Panels Required</span>
                      <strong className={styles.panelCalcValuePrimary}>
                        {panelAnalysis?.requiredPanels ?? 0}
                      </strong>
                      <span className={styles.panelCalcSub}>
                        {panelAnalysis?.requiredCapacityKWp ?? 0} kWp needed
                      </span>
                    </div>
                    <div className={styles.panelCalcItem}>
                      <span className={styles.panelCalcLabel}>Max Panels (Area)</span>
                      <strong className={styles.panelCalcValueSecondary}>
                        {maxPanelCount}
                      </strong>
                      <span className={styles.panelCalcSub}>
                        {panelAnalysis?.maxCapacityKWp ?? 0} kWp max
                      </span>
                    </div>
                  </div>

                  {/* Fit Status */}
                  {panelAnalysis && (
                    <div className={panelAnalysis.canFitAll ? styles.fitStatusGood : styles.fitStatusWarning}>
                      {panelAnalysis.canFitAll ? (
                        <>
                          <span className={styles.fitIcon}>✓</span>
                          <span>
                            Rooftop fits your ₹{panelAnalysis.billInr.toLocaleString()} bill: placed {activeLayout.activePanelCount} of {maxPanelCount} max panels
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={styles.fitIcon}>⚠️</span>
                          <span>
                            Area supports max {maxPanelCount} panels but bill needs {panelAnalysis.requiredPanels} — placed {activeLayout.activePanelCount} panels
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Energy & Bill Production Estimate */}
                  <div className={styles.energyProduction}>
                    <div className={styles.energyRow}>
                      <span>Est. Monthly Savings</span>
                      <strong className={styles.energyValueGreen}>
                        ₹{panelAnalysis?.monthlySavingsInr.toLocaleString()} / mo
                      </strong>
                    </div>
                    <div className={styles.energyRow}>
                      <span>Est. Annual Generation</span>
                      <strong className={styles.energyValue}>
                        {estimatedAnnualEnergyKwh.toLocaleString()} kWh
                      </strong>
                    </div>
                    <div className={styles.energyRow}>
                      <span>Monthly Energy Output</span>
                      <strong className={styles.energyValue}>
                        ~{Math.round(estimatedAnnualEnergyKwh / 12).toLocaleString()} units/mo
                      </strong>
                    </div>
                    <div className={styles.energyDivider} />
                    <div className={styles.energyRow}>
                      <span>Bill Offset Ratio</span>
                      <strong className={
                        estimatedAnnualEnergyKwh >= (consumption.annualKwh ?? 0)
                          ? styles.energyValueGreen
                          : styles.energyValueWarn
                      }>
                        {consumption.annualKwh && consumption.annualKwh > 0
                          ? `${Math.round((estimatedAnnualEnergyKwh / consumption.annualKwh) * 100)}%`
                          : '—'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rooftop Capacity Recommendation (always visible) */}
            <div className={styles.sectionCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>📊 Rooftop Capacity</span>
              </div>
              <div className={styles.capacityGrid}>
                <div className={styles.capacityItem}>
                  <span className={styles.capacityLabel}>Max Panels</span>
                  <strong className={styles.capacityValue}>{maxPanelCount}</strong>
                </div>
                <div className={styles.capacityItem}>
                  <span className={styles.capacityLabel}>Active Panels</span>
                  <strong className={styles.capacityValueActive}>{activeLayout.activePanelCount}</strong>
                </div>
                <div className={styles.capacityItem}>
                  <span className={styles.capacityLabel}>Max Capacity</span>
                  <strong className={styles.capacityValue}>
                    {Math.round(((maxPanelCount * panelSpec.ratedPowerW) / 1000) * 100) / 100} kWp
                  </strong>
                </div>
                <div className={styles.capacityItem}>
                  <span className={styles.capacityLabel}>Est. Annual Energy</span>
                  <strong className={styles.capacityValueGreen}>
                    {estimatedAnnualEnergyKwh.toLocaleString()} kWh
                  </strong>
                </div>
              </div>
            </div>

            {/* Optimization Objective Selector */}
            <div className={styles.sectionCard}>
              <span className={styles.cardTitle}>Optimization Objective</span>
              <div className={styles.objectiveTabs}>
                {[
                  { id: 'max_generation', label: '☀️ Max Generation' },
                  { id: 'max_capacity', label: '⚡ Max Capacity' },
                  { id: 'balanced', label: '⚖️ Balanced' },
                  ...(consumption && consumption.annualKwh 
                    ? [{ id: 'consumption_optimized', label: '💡 Match Consumption' }] 
                    : []
                  ),
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
          📊 Compare ({state.layouts.length})
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
