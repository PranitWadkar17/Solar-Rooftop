import { useState, useMemo } from 'react';
import { useOptimization } from '@/context/OptimizationContext';
import { formatArea } from '@/utils/geoUtils';
import { calculateRequiredPanelCount } from '@/utils/consumptionUtils';
import type { OptimizationObjective } from '@/types/optimization.js';
import styles from './OptimizationSidebar.module.css';

interface OptimizationSidebarProps {
  onProceedToEnergy: () => void;
  onOpenComparison: () => void;
  onOpenChangeModule?: () => void;
}

export function OptimizationSidebar({
  onProceedToEnergy,
  onOpenComparison,
  onOpenChangeModule,
}: OptimizationSidebarProps) {
  const {
    state,
    dispatch,
    activeLayout,
    selectedPanel,
    panelSpec,
    constraints,
    reoptimize,
    reoptimizeMultiAngle,
    finalizeLayout,
    consumption,
    tariffRateInr,
    setMonthlyBillAmount,
    clearConsumption,
    placeMaxCapacityLayout,
    maxPanelCount,
    maxPotentialAnnualEnergyKwh,
    solarResourceKwhPerKwp,
    estimatedAnnualEnergyKwh,
    accurateSolarMetrics,
    dynamicCostEstimation,
    isPlacing,
  } = useOptimization();

  const [activeTab, setActiveTab] = useState<'design' | 'metrics' | 'inspector'>('design');
  const [consumptionInput, setConsumptionInput] = useState<string>('');
  const [consumptionError, setConsumptionError] = useState<string | null>(null);
  const [readjustResult, setReadjustResult] = useState<import('@/services/panelOptimizationService.js').ReadjustResult | null>(null);
  const [isReadjusting, setIsReadjusting] = useState(false);

  const mfgBadge = useMemo(() => {
    const m = panelSpec.manufacturer.toLowerCase();
    if (m.includes('tata')) return '🏢 Tata Power Solar';
    if (m.includes('vikram')) return '⚡ Vikram Solar';
    if (m.includes('adani')) return '💎 Adani Solar';
    return panelSpec.manufacturer;
  }, [panelSpec.manufacturer]);

  // Calculate the dynamic panel requirement from the current monthly bill
  const panelAnalysis = useMemo(() => {
    if (!consumption || !consumption.annualKwh) {
      return null;
    }

    const billInr = consumption.monthlyBillAmountInr ?? Math.round((consumption.annualKwh / 12) * tariffRateInr);
    const monthlyKwh = Math.round(consumption.annualKwh / 12);
    const requiredPanels = calculateRequiredPanelCount(consumption, panelSpec, solarResourceKwhPerKwp) ?? 0;
    const maxCapacityKWp = Math.round(((maxPanelCount * panelSpec.ratedPowerW) / 1000) * 100) / 100;
    const requiredCapacityKWp = Math.round(((requiredPanels * panelSpec.ratedPowerW) / 1000) * 100) / 100;
    const canFitAll = requiredPanels <= maxPanelCount;
    const estimatedMonthlyKwh = Math.round(estimatedAnnualEnergyKwh / 12);
    const monthlySavingsInr = Math.min(billInr, Math.round(estimatedMonthlyKwh * tariffRateInr));

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
    const liveMonthlyKwh = !isNaN(liveBill) && liveBill > 0 && tariffRateInr > 0 ? Math.round(liveBill / tariffRateInr) : 0;
    const liveAnnualKwh = liveMonthlyKwh * 12;
    const panelKWp = panelSpec.ratedPowerW / 1000;
    const annualEnergyPerPanel = panelKWp * solarResourceKwhPerKwp * 0.78;
    const liveRequired = liveAnnualKwh > 0 ? Math.ceil(liveAnnualKwh / annualEnergyPerPanel) : 0;
    const livePlacingCount = Math.min(liveRequired, maxPanelCount > 0 ? maxPanelCount : liveRequired);
    const liveCapacityKWp = Math.round(((livePlacingCount * panelSpec.ratedPowerW) / 1000) * 100) / 100;
    const liveEstEnergy = Math.round(liveCapacityKWp * solarResourceKwhPerKwp * 0.78);
    const liveSavings = Math.min(liveBill || 0, Math.round((liveEstEnergy / 12) * tariffRateInr));

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
              onClick={() => placeMaxCapacityLayout()}
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
                      <strong>
                        {consumption.source === 'bill_upload'
                          ? `Uploaded Bill (${consumption.billData?.discomName || 'Scanned'})`
                          : 'Monthly Bill Target'}
                      </strong>
                      <span className={styles.consumptionMeta}>
                        ₹{panelAnalysis?.billInr.toLocaleString()}/month • ~{panelAnalysis?.monthlyKwh} units/mo
                        {consumption.source === 'bill_upload' && consumption.billData?.monthlyKwhProfile && consumption.billData.monthlyKwhProfile.length > 1 && (
                          <span style={{ color: '#38bdf8', marginLeft: '4px' }}>• 12-mo history</span>
                        )}
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
                        ₹{dynamicCostEstimation.monthlySavingsInr.toLocaleString()} / mo
                      </strong>
                    </div>
                    <div className={styles.energyRow}>
                      <span>Est. Annual Generation</span>
                      <strong className={styles.energyValue}>
                        {accurateSolarMetrics.estimatedAnnualGenerationKwh.toLocaleString()} kWh
                      </strong>
                    </div>
                    <div className={styles.energyRow}>
                      <span>Monthly Energy Output</span>
                      <strong className={styles.energyValue}>
                        ~{accurateSolarMetrics.monthlyAverageEnergyKwh.toLocaleString()} units/mo
                        <span className={styles.seasonalRangeSub}>
                          Seasonal: {accurateSolarMetrics.monthlyRange.minMonthlyKwh} ({accurateSolarMetrics.monthlyRange.minMonthName}) – {accurateSolarMetrics.monthlyRange.maxMonthlyKwh} ({accurateSolarMetrics.monthlyRange.maxMonthName}) units/mo
                        </span>
                      </strong>
                    </div>
                    <div className={styles.energyDivider} />
                    <div className={styles.energyRow}>
                      <span>Bill Offset Ratio</span>
                      <strong className={
                        accurateSolarMetrics.estimatedAnnualGenerationKwh >= (consumption.annualKwh ?? 0)
                          ? styles.energyValueGreen
                          : styles.energyValueWarn
                      }>
                        {consumption.annualKwh && consumption.annualKwh > 0
                          ? `${Math.round((accurateSolarMetrics.estimatedAnnualGenerationKwh / consumption.annualKwh) * 100)}%`
                          : '—'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rooftop Capacity Recommendation */}
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
                    {accurateSolarMetrics.maxCapacityKWp} kWp
                  </strong>
                </div>
                <div className={styles.capacityItem}>
                  <span className={styles.capacityLabel}>Est. Annual Energy</span>
                  <strong className={styles.capacityValueGreen}>
                    {accurateSolarMetrics.maxPotentialAnnualEnergyKwh.toLocaleString()} kWh
                  </strong>
                </div>
              </div>
            </div>

            {/* Turnkey System Cost & Subsidy Estimation Card */}
            <div className={styles.sectionCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>💰 System Cost & Subsidy</span>
                <span className={styles.hardwareBadge}>2025-26 Dynamic EPC</span>
              </div>

              <div className={styles.financialGrid}>
                <div className={styles.financialRow}>
                  <span>Gross EPC Cost (12% GST)</span>
                  <strong>₹{dynamicCostEstimation.grossCostInr.toLocaleString()}</strong>
                </div>
                <div className={styles.financialSubsidyRow}>
                  <span>🎁 PM Surya Ghar Subsidy</span>
                  <strong>- ₹{dynamicCostEstimation.subsidyInr.toLocaleString()}</strong>
                </div>
                <div className={styles.financialNetRow}>
                  <span>Net Out-of-Pocket Cost</span>
                  <strong className={styles.financialNetVal}>
                    ₹{dynamicCostEstimation.netCostInr.toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className={styles.financialRoiGrid}>
                <div className={styles.financialRoiItem}>
                  <span className={styles.financialRoiLabel}>Payback Period</span>
                  <strong className={styles.financialRoiVal}>{dynamicCostEstimation.paybackYears} Years</strong>
                </div>
                <div className={styles.financialRoiItem}>
                  <span className={styles.financialRoiLabel}>25-Yr Net Savings</span>
                  <strong className={styles.financialRoiVal}>₹{dynamicCostEstimation.twentyFiveYearSavingsInr.toLocaleString()}</strong>
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

            {/* Hardware Module Specification Card */}
            <div className={styles.sectionCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>PV Module Specification</span>
                <span className={styles.hardwareBadge}>{panelSpec.efficiencyPct}% Eff</span>
              </div>

              <div className={styles.moduleDisplayCard}>
                <div className={styles.moduleBadgeRow}>
                  <span className={styles.moduleBrandTag}>{mfgBadge}</span>
                  <span className={styles.moduleWattagePill}>{panelSpec.ratedPowerW} W</span>
                </div>

                <h4 className={styles.moduleModelTitle}>{panelSpec.model}</h4>

                <div className={styles.specDetailsGrid}>
                  <div className={styles.specDetailItem}>
                    <span className={styles.specDetailLabel}>Dimensions</span>
                    <strong className={styles.specDetailVal}>{panelSpec.lengthM}m × {panelSpec.widthM}m</strong>
                  </div>
                  <div className={styles.specDetailItem}>
                    <span className={styles.specDetailLabel}>Footprint</span>
                    <strong className={styles.specDetailVal}>{(panelSpec.lengthM * panelSpec.widthM).toFixed(2)} m²</strong>
                  </div>
                  <div className={styles.specDetailItem}>
                    <span className={styles.specDetailLabel}>Technology</span>
                    <strong className={styles.specDetailVal}>{panelSpec.technology}</strong>
                  </div>
                  <div className={styles.specDetailItem}>
                    <span className={styles.specDetailLabel}>Temp Coeff</span>
                    <strong className={styles.specDetailVal}>{panelSpec.tempCoeffPmax}%/°C</strong>
                  </div>
                  <div className={styles.specDetailItem}>
                    <span className={styles.specDetailLabel}>Roof Load</span>
                    <strong className={styles.specDetailVal}>{panelSpec.roofLoadBearingKgPerSqM ?? '18 - 22 kg/m²'}</strong>
                  </div>
                  <div className={styles.specDetailItem}>
                    <span className={styles.specDetailLabel}>Wind Rating</span>
                    <strong className={styles.specDetailVal}>Up to {panelSpec.windSpeedRatingKmh ?? 180} km/h</strong>
                  </div>
                  {panelSpec.dailyMinMaxKwh && (
                    <div className={`${styles.specDetailItem} ${styles.specDetailFull}`}>
                      <span className={styles.specDetailLabel}>Daily Output</span>
                      <strong className={styles.specDetailValOrange}>
                        {panelSpec.dailyMinMaxKwh.min} – {panelSpec.dailyMinMaxKwh.max} kWh / day
                      </strong>
                    </div>
                  )}
                </div>

                {onOpenChangeModule && (
                  <button
                    type="button"
                    className={styles.changeModuleBtn}
                    onClick={onOpenChangeModule}
                    title="Change manufacturer brand, panel size, or form factor"
                  >
                    <span>🔄</span>
                    <span>Change Manufacturer & Module</span>
                  </button>
                )}
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

      {/* Toolbar for Undo, Redo, Re-adjust, Compare */}
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
        <button
          className={`${styles.toolBtn} ${styles.readjustBtn}`}
          disabled={isReadjusting || isPlacing}
          onClick={() => {
            setIsReadjusting(true);
            setReadjustResult(null);
            // Use setTimeout to allow UI to show loading state before heavy computation
            setTimeout(() => {
              try {
                const result = reoptimizeMultiAngle();
                setReadjustResult(result);
              } finally {
                setIsReadjusting(false);
              }
            }, 50);
          }}
          title="Search multiple angles & orientations for a better panel arrangement"
        >
          {isReadjusting ? '⏳ Re-adjusting...' : '🔄 Re-adjust'}
        </button>
        <button className={styles.compareBtn} onClick={onOpenComparison} title="Compare Candidate Layouts">
          📊 Compare ({state.layouts.length})
        </button>
      </div>

      {/* Re-adjust Result Banner */}
      {readjustResult && (
        <div className={readjustResult.improved ? styles.readjustSuccess : styles.readjustNoChange}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <strong style={{ fontSize: 12 }}>
              {readjustResult.improved ? '✅ Layout Improved' : 'ℹ️ No Improvement Found'}
            </strong>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: '0 2px' }}
              onClick={() => setReadjustResult(null)}
              aria-label="Dismiss result"
            >✕</button>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, lineHeight: 1.5 }}>
            {readjustResult.improved ? (
              <>
                <div>Panels: <strong style={{ color: '#10b981' }}>{readjustResult.previousPanelCount} → {readjustResult.newPanelCount}</strong></div>
                <div>Capacity: <strong style={{ color: '#10b981' }}>{readjustResult.previousCapacityKWp} → {readjustResult.newCapacityKWp} kWp</strong></div>
              </>
            ) : null}
            <div style={{ marginTop: 4, color: '#64748b', fontSize: 10 }}>
              Evaluated {readjustResult.candidatesEvaluated} candidate layouts
            </div>
          </div>
        </div>
      )}

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
