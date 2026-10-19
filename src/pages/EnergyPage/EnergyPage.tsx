import { useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAssessment } from '@/services/assessmentService';
import { loadPanelLayout } from '@/services/optimizationService';
import { loadRooftop } from '@/services/rooftopService';
import { loadSolarAnalysis } from '@/services/solarAnalysisService';
import { buildConsumptionComparison } from '@/services/energyAnalysisService';
import { exportProjectAsJSON, exportAsGeoJSON, downloadJSON, downloadGeoJSON } from '@/services/dataExportService';
import { generateSolarReport } from '@/services/solarReportService';
import { SolarReportPanel } from '@/components/Optimization/SolarReportPanel/SolarReportPanel';
import { formatArea } from '@/utils/geoUtils';
import { ProgressStepper } from '@/components/Assessment/ProgressStepper/ProgressStepper';
import { ThemeContext } from '@/App';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import styles from './EnergyPage.module.css';

export function EnergyPage() {
  const navigate = useNavigate();
  const assessment = loadAssessment();
  const layout = assessment?.assessmentId ? loadPanelLayout(assessment.assessmentId) : null;
  const rooftop = assessment?.assessmentId ? loadRooftop(assessment.assessmentId) : null;
  const solarAnalysis = assessment?.assessmentId ? loadSolarAnalysis(assessment.assessmentId) : null;
  const { theme, toggleTheme } = useContext(ThemeContext);

  const occupiedFormatted = layout ? formatArea(layout.occupiedAreaSqM) : null;
  const comparison = buildConsumptionComparison(layout, assessment?.consumption ?? null);

  const solarReport = useMemo(() => {
    const consumptionData = assessment?.consumption;
    const monthlyList = consumptionData?.monthlyKwh?.map((m) => m.kwh) || [];
    const avgUnits = consumptionData?.annualKwh ? consumptionData.annualKwh / 12 : 250;

    return generateSolarReport({
      monthlyConsumptionKwh: monthlyList.length > 0 ? monthlyList : [avgUnits],
      maxPanelsFit: layout?.activePanelCount ?? null,
      panelWattage: layout?.panelSpec?.ratedPowerW ?? 540,
      panelAreaM2: layout?.panelSpec ? layout.panelSpec.lengthM * layout.panelSpec.widthM : 2.5,
      roofAreaM2: rooftop?.totalAreaSqM ?? solarAnalysis?.selectedArea?.area ?? null,
      sanctionedLoadKw: consumptionData?.billData?.sanctionedLoadKw ?? null,
      tariffContext: {
        confirmedBillData: consumptionData?.billData ?? null,
        discomName: consumptionData?.billData?.discomName ?? null,
      },
    });
  }, [assessment, layout, rooftop, solarAnalysis]);

  const handleDownloadJSON = () => {
    if (!assessment) return;
    const result = exportProjectAsJSON(assessment, rooftop, solarAnalysis, layout);
    downloadJSON(result.data, `solar-assessment-${assessment.assessmentId}.json`);
  };

  const handleDownloadGeoJSON = () => {
    if (!rooftop) return;
    const geoJSONData = exportAsGeoJSON(rooftop, layout, solarAnalysis);
    downloadGeoJSON(geoJSONData, `solar-rooftop-${assessment?.assessmentId}.geojson`);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.left}>
          <button className={styles.backBtn} onClick={() => navigate('/assessment/optimization')} title="Back to Panel Optimization">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Back to Panel Optimization</span>
          </button>
          <span className={styles.logoText}>
            SolarRoof <span className={styles.logoAccent}>Intelligence</span>
          </span>
        </div>

        <div className={styles.center}>
          <ProgressStepper currentStep={5} />
        </div>

        <div className={styles.right}>
          {assessment?.assessmentId && (
            <div className={styles.badge}>
              <span className={styles.badgeDot} />
              {assessment.assessmentId}
            </div>
          )}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <main className={styles.container}>
        <div className={styles.contentCard}>
          <div className={styles.statusBadge}>
            <span className={styles.statusDot} aria-hidden="true" />
            Phase 5 Complete — Solar Array Layout & Module Sizing Finalized
          </div>

          <h1 className={styles.title}>Energy Generation & Production Simulation</h1>
          <p className={styles.subtitle}>
            Photovoltaic module packing geometry, peak DC system capacity, and tilt orientation are locked in. Phase 6 will simulate hourly solar energy yield, annual AC kilowatt-hours (kWh), and system performance ratio.
          </p>

          {/* Confirmed Phase 5 Array Metrics */}
          <div className={styles.dataGrid}>
            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>DC Array Peak Capacity</span>
              <strong className={`${styles.dataValue} ${styles.capacityHighlight}`}>
                {layout ? `${layout.systemCapacityKWp} kWp` : 'Pending'}
              </strong>
              <span className={styles.dataSub}>System Nameplate DC</span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Active PV Modules</span>
              <strong className={styles.dataValue}>
                {layout ? `${layout.activePanelCount} Panels` : 'Pending'}
              </strong>
              <span className={styles.dataSub}>
                {layout ? `${layout.panelSpec.manufacturer} ${layout.panelSpec.model}` : ''}
              </span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Array Occupied Area</span>
              <strong className={styles.dataValue}>
                {occupiedFormatted ? occupiedFormatted.display : 'Pending'}
              </strong>
              <span className={styles.dataSub}>
                {layout ? `${layout.utilizationPct}% of selected area` : ''}
              </span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Mount Orientation & Tilt</span>
              <strong className={styles.dataValue}>
                {layout ? `${layout.constraints.orientation} • ${layout.constraints.tiltDeg}° Tilt` : '15° Tilt'}
              </strong>
              <span className={styles.dataSub}>South-facing Array</span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Optimization Objective</span>
              <strong className={styles.dataValue}>
                {layout ? layout.objective.replace(/_/g, ' ').toUpperCase() : 'Max Generation'}
              </strong>
              <span className={styles.dataSub}>Layout Strategy</span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Array Quality Score</span>
              <strong className={`${styles.dataValue} ${styles.scoreHighlight}`}>
                {layout ? `${layout.layoutScore}/100` : '92/100'}
              </strong>
              <span className={styles.dataSub}>Compliance & Yield Score</span>
            </div>
          </div>

          {comparison.annualConsumptionKwh !== null && (
            <>
              <div className={styles.consumptionNote}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span>
                  {assessment?.consumption?.source === 'bill_upload'
                    ? (assessment.consumption.billData?.monthlyKwhProfile && assessment.consumption.billData.monthlyKwhProfile.length > 1
                        ? `Based on your uploaded bill (${assessment.consumption.billData.discomName || 'Utility'} 12-month seasonal history).`
                        : `Based on your uploaded bill (${assessment.consumption.billFileName || 'bill photo'}).`)
                    : 'Based on the monthly electricity bill amount you entered manually.'}
                  {' '}Return to Optimization to modify consumption data.
                </span>
              </div>

              <div className={styles.comparisonPanel}>
              <div className={styles.comparisonHeader}>
                <div>
                  <span className={styles.billLabel}>Generation vs use</span>
                  <h3>Annual coverage analysis</h3>
                </div>
                <span className={`${styles.statusPill} ${styles[comparison.status]}`}>
                  {comparison.status}
                </span>
              </div>

              <div className={styles.comparisonGrid}>
                <div className={styles.comparisonCard}>
                  <span>Annual generation</span>
                  <strong>{comparison.annualGenerationKwh.toLocaleString()} kWh</strong>
                </div>
                <div className={styles.comparisonCard}>
                  <span>Annual consumption</span>
                  <strong>{comparison.annualConsumptionKwh.toLocaleString()} kWh</strong>
                </div>
                <div className={styles.comparisonCard}>
                  <span>Coverage</span>
                  <strong>{Math.round(comparison.coverageRatioPct ?? 0)}%</strong>
                </div>
                <div className={styles.comparisonCard}>
                  <span>Self-supply score</span>
                  <strong>{comparison.selfSupplyScore !== null ? `${Math.round(comparison.selfSupplyScore)}%` : 'N/A'}</strong>
                </div>
                <div className={styles.comparisonCard}>
                  <span>{comparison.status === 'surplus' ? 'Surplus' : 'Shortfall'}</span>
                  <strong>
                    {comparison.status === 'surplus'
                      ? `${(comparison.surplusKwh ?? 0).toLocaleString()} kWh`
                      : `${(comparison.shortfallKwh ?? 0).toLocaleString()} kWh`}
                  </strong>
                </div>
              </div>

              <div className={styles.monthlySummary}>
                {comparison.monthlyComparison.map((entry) => {
                  const monthLabel = new Date(`${entry.month}-01T00:00:00`).toLocaleString('en-US', { month: 'short' });
                  const deltaText = `${entry.deltaKwh >= 0 ? '+' : '-'}${Math.abs(entry.deltaKwh).toLocaleString()} kWh`;

                  return (
                    <div key={entry.month} className={styles.monthRow}>
                      <span className={styles.monthLabel}>{monthLabel}</span>
                      <span>{entry.generationKwh.toLocaleString()} kWh</span>
                      <span>{entry.consumptionKwh.toLocaleString()} kWh</span>
                      <span className={entry.deltaKwh >= 0 ? styles.deltaPositive : styles.deltaNegative}>{deltaText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            </>
          )}

          {/* Comprehensive Solar Feasibility, Cost Breakdown, and Financial Report */}
          <div style={{ marginTop: '24px', marginBottom: '24px' }}>
            <SolarReportPanel
              report={solarReport}
              billData={assessment?.consumption?.billData ?? null}
              selectedRoofAreaM2={rooftop?.totalAreaSqM ?? solarAnalysis?.selectedArea?.area}
            />
          </div>

          {/* Phase 6 Roadmap */}
          <div className={styles.roadmap}>
            <h3 className={styles.roadmapTitle}>Upcoming Phase 6 Energy Simulation Modules</h3>
            <div className={styles.roadmapList}>
              <div className={styles.roadmapItem}>
                <span className={styles.stepNum}>01</span>
                <div>
                  <strong>PVWatts / Sandia 8,760-Hour Yield Modeling</strong>
                  <p>Hour-by-hour solar irradiance to AC electrical energy conversion factoring sun angles, diffuse radiation, and ambient temperatures.</p>
                </div>
              </div>
              <div className={styles.roadmapItem}>
                <span className={styles.stepNum}>02</span>
                <div>
                  <strong>System Loss Waterfall & Performance Ratio (PR)</strong>
                  <p>Quantify soiling losses, wiring DC drops, inverter clipping/efficiency, thermal derating, and snow/dust attenuation.</p>
                </div>
              </div>
              <div className={styles.roadmapItem}>
                <span className={styles.stepNum}>03</span>
                <div>
                  <strong>Monthly Generation & Seasonal Export Curves</strong>
                  <p>Interactive 12-month generation charts with grid-export and on-site self-consumption forecasting.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.actions}>
            <button className={styles.secondaryBtn} onClick={() => navigate('/assessment/optimization')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Adjust Module Layout & Hardware
            </button>
            
            <button className={styles.exportBtn} onClick={handleDownloadJSON} disabled={!assessment}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Report (JSON)
            </button>
            
            <button className={styles.exportBtn} onClick={handleDownloadGeoJSON} disabled={!rooftop}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download GeoJSON
            </button>
            
            <button className={styles.primaryBtn} onClick={() => navigate('/')}>
              Return to Landing Page
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
