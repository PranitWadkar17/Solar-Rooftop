import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAssessment } from '@/services/assessmentService';
import { loadRooftop } from '@/services/rooftopService';
import { loadSolarAnalysis } from '@/services/solarAnalysisService';
import { SolarProvider, useSolar } from '@/context/SolarContext';
import { SolarHeader } from '@/components/Solar/SolarHeader/SolarHeader';
import { SolarSidebar } from '@/components/Solar/SolarSidebar/SolarSidebar';
import { SolarMap } from '@/components/Solar/SolarMap/SolarMap';
import { SolarTimeline } from '@/components/Solar/SolarTimeline/SolarTimeline';
import styles from './SolarPage.module.css';

function SolarWorkspaceInner() {
  const navigate = useNavigate();
  const { state, triggerReanalysis } = useSolar();
  const { rooftop, status } = state;

  const handleBackClick = useCallback(() => {
    navigate('/assessment/rooftop');
  }, [navigate]);

  const handleProceedToOptimization = useCallback(() => {
    navigate('/assessment/optimization');
  }, [navigate]);

  return (
    <div className={styles.workspace}>
      <SolarHeader
        assessmentId={rooftop?.assessmentId ?? null}
        status={status}
        onBackClick={handleBackClick}
        onRecalculate={triggerReanalysis}
      />

      <main className={styles.mainArea}>
        {/* Left Sidebar */}
        <SolarSidebar onProceedToOptimization={handleProceedToOptimization} />

        {/* Right Map Canvas & Bottom Timeline */}
        <div className={styles.mapAreaWrapper}>
          <div className={styles.mapCanvas}>
            <SolarMap />
          </div>
          <SolarTimeline />
        </div>
      </main>
    </div>
  );
}

export function SolarPage() {
  const navigate = useNavigate();
  const assessment = loadAssessment();
  const rooftop = assessment?.assessmentId ? loadRooftop(assessment.assessmentId) : null;
  const existingAnalysis = assessment?.assessmentId ? loadSolarAnalysis(assessment.assessmentId) : null;

  // If no valid assessment or rooftop boundary
  if (!assessment || !assessment.assessmentId || !rooftop || rooftop.area <= 0) {
    return (
      <div className={styles.missingPage}>
        <div className={styles.missingCard}>
          <div className={styles.missingIcon}>☀️</div>
          <h2 className={styles.missingTitle}>Solar Analysis Cannot Start</h2>
          <p className={styles.missingText}>
            Required rooftop information is missing or incomplete. Please confirm your rooftop boundary and obstacle layout in Phase 2 & 3 before running solar analysis.
          </p>
          <button className={styles.returnBtn} onClick={() => navigate('/assessment/rooftop')}>
            Return to Rooftop Analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <SolarProvider initialRooftop={rooftop} initialAnalysis={existingAnalysis}>
      <SolarWorkspaceInner />
    </SolarProvider>
  );
}
