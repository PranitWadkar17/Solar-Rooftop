import { useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAssessment } from '@/services/assessmentService';
import { loadPanelLayout } from '@/services/optimizationService';
import { loadRooftop } from '@/services/rooftopService';
import { loadSolarAnalysis } from '@/services/solarAnalysisService';
import { generateSolarReport } from '@/services/solarReportService';
import { DEFAULT_DESIGN_CONSTRAINTS, ensurePlacedLayout } from '@/services/panelOptimizationService';
import { calculateAccurateSolarMetrics } from '@/services/energyPredictionService';
import { DEFAULT_PANEL_LIBRARY } from '@/data/panelLibrary';
import { SolarReportPanel } from '@/components/Optimization/SolarReportPanel/SolarReportPanel';
import { ProgressStepper } from '@/components/Assessment/ProgressStepper/ProgressStepper';
import { ThemeContext } from '@/App';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import styles from './EnergyPage.module.css';

export function EnergyPage() {
  const navigate = useNavigate();
  const assessment = loadAssessment();
  const savedLayout = assessment?.assessmentId ? loadPanelLayout(assessment.assessmentId) : null;
  const rooftop = assessment?.assessmentId ? loadRooftop(assessment.assessmentId) : null;
  const solarAnalysis = assessment?.assessmentId ? loadSolarAnalysis(assessment.assessmentId) : null;
  const { theme, toggleTheme } = useContext(ThemeContext);

  const layout = useMemo(
    () =>
      ensurePlacedLayout(
        rooftop,
        solarAnalysis,
        savedLayout,
        savedLayout?.panelSpec ?? DEFAULT_PANEL_LIBRARY[0],
        savedLayout?.constraints ?? DEFAULT_DESIGN_CONSTRAINTS,
      ),
    [rooftop, solarAnalysis, savedLayout],
  );

  const solarReport = useMemo(() => {
    const consumptionData = assessment?.consumption;
    const monthlyList = consumptionData?.monthlyKwh?.map((m) => m.kwh) || [];
    const avgUnits = consumptionData?.annualKwh ? consumptionData.annualKwh / 12 : 250;
    const panelSpec = layout?.panelSpec ?? DEFAULT_PANEL_LIBRARY[0];
    const panelCount = layout?.activePanelCount ?? 0;
    const metrics = calculateAccurateSolarMetrics(
      panelCount,
      panelSpec,
      solarAnalysis,
      panelCount,
      layout?.constraints?.tiltDeg ?? 15,
    );

    return generateSolarReport({
      monthlyConsumptionKwh: monthlyList.length > 0 ? monthlyList : [avgUnits],
      maxPanelsFit: panelCount > 0 ? panelCount : null,
      panelWattage: panelSpec.ratedPowerW,
      panelAreaM2: panelSpec.lengthM * panelSpec.widthM,
      roofAreaM2: solarAnalysis?.selectedArea?.area ?? rooftop?.area ?? null,
      sanctionedLoadKw: consumptionData?.billData?.sanctionedLoadKw ?? null,
      annualYieldKwhPerKw: metrics.specificYieldKwhPerKwp,
      tariffContext: {
        confirmedBillData: consumptionData?.billData ?? null,
        discomName: consumptionData?.billData?.discomName ?? null,
      },
    });
  }, [assessment, layout, rooftop, solarAnalysis]);

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
        <SolarReportPanel
          report={solarReport}
          billData={assessment?.consumption?.billData ?? null}
          extractedDetails={null}
          selectedRoofAreaM2={solarAnalysis?.selectedArea?.area ?? rooftop?.area}
          layout={layout}
          rooftop={rooftop}
          solarAnalysis={solarAnalysis}
          optimizationConfig={layout ? {
            manufacturer: layout.panelSpec.manufacturer,
            panelModel: layout.panelSpec.model,
            panelWattage: layout.panelSpec.ratedPowerW,
            panelDimensions: `${layout.panelSpec.lengthM}m × ${layout.panelSpec.widthM}m`,
            panelSize: `${layout.panelSpec.ratedPowerW} W`,
            panelShape: `${layout.panelSpec.lengthM}m × ${layout.panelSpec.widthM}m`,
            technology: layout.panelSpec.technology,
            objective: layout.objective,
          } : undefined}
        />

        {/* Secondary Navigation Actions */}
        <div className={styles.bottomNavActions}>
          <button className={styles.secondaryBtn} onClick={() => navigate('/assessment/optimization')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Adjust Module Layout & Hardware
          </button>
          
          <button className={styles.secondaryBtn} onClick={() => navigate('/')}>
            Return to Landing Page
          </button>
        </div>
      </main>
    </div>
  );
}
