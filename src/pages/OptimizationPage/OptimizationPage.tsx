import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAssessment } from '@/services/assessmentService';
import { loadRooftop } from '@/services/rooftopService';
import { loadSolarAnalysis } from '@/services/solarAnalysisService';
import { loadPanelLayout } from '@/services/optimizationService';
import { OptimizationProvider } from '@/context/OptimizationContext';
import { OptimizationHeader } from '@/components/Optimization/OptimizationHeader/OptimizationHeader';
import { OptimizationSidebar } from '@/components/Optimization/OptimizationSidebar/OptimizationSidebar';
import { OptimizationMap } from '@/components/Optimization/OptimizationMap/OptimizationMap';
import { LayoutComparisonModal } from '@/components/Optimization/LayoutComparisonModal/LayoutComparisonModal';
import { ConsumptionModal } from '@/components/Optimization/ConsumptionModal/ConsumptionModal';
import { useOptimization } from '@/context/OptimizationContext';
import styles from './OptimizationPage.module.css';

function OptimizationWorkspaceInner({
  rooftop,
  solarAnalysis,
}: {
  rooftop: ReturnType<typeof loadRooftop>;
  solarAnalysis: ReturnType<typeof loadSolarAnalysis>;
}) {
  const navigate = useNavigate();
  const { consumption, activeLayout } = useOptimization();
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(
    !consumption && !activeLayout
  );

  const handleBackClick = useCallback(() => {
    navigate('/assessment/solar');
  }, [navigate]);

  const handleProceedToEnergy = useCallback(() => {
    navigate('/assessment/energy');
  }, [navigate]);

  return (
    <div className={styles.workspace}>
      <OptimizationHeader
        assessmentId={rooftop?.assessmentId ?? null}
        onBackClick={handleBackClick}
      />

      <main className={styles.mainArea}>
        {/* Left Sidebar Controls */}
        <OptimizationSidebar
          onProceedToEnergy={handleProceedToEnergy}
          onOpenComparison={() => setIsCompareOpen(true)}
        />

        {/* Right Photovoltaic Map Canvas */}
        <div className={styles.mapCanvas}>
          <OptimizationMap rooftop={rooftop} solarAnalysis={solarAnalysis} />
        </div>
      </main>

      {/* Side-by-Side Layout Comparison Modal */}
      <LayoutComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
      />

      {/* Monthly Electricity Consumption Prompt & Placement Modal */}
      <ConsumptionModal
        isOpen={isConsumptionModalOpen}
        onClose={() => setIsConsumptionModalOpen(false)}
        solarAnalysis={solarAnalysis}
      />
    </div>
  );
}

export function OptimizationPage() {
  const navigate = useNavigate();
  const assessment = loadAssessment();
  const rooftop = assessment?.assessmentId ? loadRooftop(assessment.assessmentId) : null;
  const solarAnalysis = assessment?.assessmentId ? loadSolarAnalysis(assessment.assessmentId) : null;
  const savedLayout = assessment?.assessmentId ? loadPanelLayout(assessment.assessmentId) : null;

  // Validation: Check that rooftop and Phase 4 selected solar area exist
  if (!assessment || !assessment.assessmentId || !rooftop || !solarAnalysis?.selectedArea) {
    return (
      <div className={styles.missingPage}>
        <div className={styles.missingCard}>
          <div className={styles.missingIcon}>📐</div>
          <h2 className={styles.missingTitle}>Panel Optimization Cannot Start</h2>
          <p className={styles.missingText}>
            Required solar installation area is missing or incomplete. Please complete your rooftop boundary and select your solar installation scope in Phase 4 first.
          </p>
          <button className={styles.returnBtn} onClick={() => navigate('/assessment/solar')}>
            Return to Solar Analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <OptimizationProvider
      rooftop={rooftop}
      solarAnalysis={solarAnalysis}
      initialSavedLayout={savedLayout}
      initialConsumption={assessment.consumption ?? null}
    >
      <OptimizationWorkspaceInner rooftop={rooftop} solarAnalysis={solarAnalysis} />
    </OptimizationProvider>
  );
}
