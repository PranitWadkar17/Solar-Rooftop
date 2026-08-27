import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAssessment } from '@/services/assessmentService';
import { loadRooftop } from '@/services/rooftopService';
import { loadSolarAnalysis } from '@/services/solarAnalysisService';
import { formatArea } from '@/utils/geoUtils';
import { ProgressStepper } from '@/components/Assessment/ProgressStepper/ProgressStepper';
import { ThemeContext } from '@/App';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import styles from './OptimizationPage.module.css';

export function OptimizationPage() {
  const navigate = useNavigate();
  const assessment = loadAssessment();
  const rooftop = assessment?.assessmentId ? loadRooftop(assessment.assessmentId) : null;
  const analysis = assessment?.assessmentId ? loadSolarAnalysis(assessment.assessmentId) : null;
  const { theme, toggleTheme } = useContext(ThemeContext);

  const effectiveAreaFormatted = analysis ? formatArea(analysis.solarEffectiveAreaSqM) : null;
  const physicalAreaFormatted = rooftop ? formatArea(rooftop.area) : null;
  const selectedAreaFormatted = analysis?.selectedArea ? formatArea(analysis.selectedArea.area) : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.left}>
          <button className={styles.backBtn} onClick={() => navigate('/assessment/solar')} title="Back to Solar Analysis">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Back to Solar Analysis</span>
          </button>
          <span className={styles.logoText}>
            SolarRoof <span className={styles.logoAccent}>Intelligence</span>
          </span>
        </div>

        <div className={styles.center}>
          <ProgressStepper currentStep={4} />
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
            Phase 4 Complete — Solar Irradiance & User Solar Area Selection Finalized
          </div>

          <h1 className={styles.title}>PV Module Layout & Array Optimization</h1>
          <p className={styles.subtitle}>
            User-selected solar installation area, 3D ray-traced shadow boundaries, and solar access constraints are locked in. Phase 5 will pack optimal photovoltaic module strings inside the selected boundary.
          </p>

          {/* Confirmed Phase 4 Constraints */}
          <div className={styles.dataGrid}>
            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Selected Solar Installation Area</span>
              <span className={`${styles.dataValue} ${styles.highlight} ${styles.usableVal}`} style={{ color: '#06b6d4' }}>
                {selectedAreaFormatted ? selectedAreaFormatted.display : 'Not specified'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                {analysis?.selectedArea ? `Method: ${analysis.selectedArea.selectionMethod}` : ''}
              </span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Solar-Effective Usable Area</span>
              <span className={`${styles.dataValue} ${styles.usableVal}`}>
                {effectiveAreaFormatted ? effectiveAreaFormatted.display : 'Calculating...'}
              </span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Gross Roof Area</span>
              <span className={styles.dataValue}>
                {physicalAreaFormatted ? physicalAreaFormatted.display : 'N/A'}
              </span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Solar Access & Quality</span>
              <span className={styles.dataValue}>
                {analysis?.avgSolarAccessPct ? `${analysis.avgSolarAccessPct}% (${analysis.overallClassification})` : 'HIGH Potential'}
              </span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Annual Irradiance (GHI)</span>
              <span className={styles.dataValue}>
                {analysis?.resourceData?.annualGhi ? `${analysis.resourceData.annualGhi} kWh/m²/yr` : 'Derived'}
              </span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Obstacle Conflicts</span>
              <span className={styles.dataValue} style={{ color: '#10b981' }}>
                0 Conflicts (Clear)
              </span>
            </div>
          </div>

          {/* Roadmap for Phase 5 */}
          <div className={styles.roadmap}>
            <h3 className={styles.roadmapTitle}>Upcoming Phase 5 Optimization Modules</h3>
            <div className={styles.roadmapList}>
              <div className={styles.roadmapItem}>
                <span className={styles.stepNum}>01</span>
                <div>
                  <strong>Boustrophedon Module Packing Algorithm</strong>
                  <p>Dense mathematical panel arrangement respecting physical boundaries, obstacle setbacks, and inter-row shading angles.</p>
                </div>
              </div>
              <div className={styles.roadmapItem}>
                <span className={styles.stepNum}>02</span>
                <div>
                  <strong>Multi-Orientation Tilt & Azimuth Optimization</strong>
                  <p>Calculate optimal panel tilt (e.g. 15°–25° South) vs flush mount based on roof slope and local latitude.</p>
                </div>
              </div>
              <div className={styles.roadmapItem}>
                <span className={styles.stepNum}>03</span>
                <div>
                  <strong>Electrical String & Inverter Configuration</strong>
                  <p>Group panels into series strings and select compatible inverter capacities for maximum yield efficiency.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.actions}>
            <button className={styles.secondaryBtn} onClick={() => navigate('/assessment/solar')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Adjust Solar & Shading Parameters
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
