import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAssessment } from '@/services/assessmentService';
import { loadPanelLayout } from '@/services/optimizationService';
import { formatArea } from '@/utils/geoUtils';
import { ProgressStepper } from '@/components/Assessment/ProgressStepper/ProgressStepper';
import { ThemeContext } from '@/App';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import styles from './EnergyPage.module.css';

export function EnergyPage() {
  const navigate = useNavigate();
  const assessment = loadAssessment();
  const layout = assessment?.assessmentId ? loadPanelLayout(assessment.assessmentId) : null;
  const { theme, toggleTheme } = useContext(ThemeContext);

  const occupiedFormatted = layout ? formatArea(layout.occupiedAreaSqM) : null;

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
            <button className={styles.primaryBtn} onClick={() => navigate('/')}>
              Return to Landing Page
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
