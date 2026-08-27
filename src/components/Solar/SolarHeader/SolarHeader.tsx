import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '@/App';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { ProgressStepper } from '@/components/Assessment/ProgressStepper/ProgressStepper';
import type { SolarAnalysisStatus } from '@/types/solar.js';
import styles from './SolarHeader.module.css';

interface SolarHeaderProps {
  assessmentId: string | null;
  status: SolarAnalysisStatus;
  onBackClick: () => void;
  onRecalculate?: () => void;
}

export function SolarHeader({ assessmentId, status, onBackClick, onRecalculate }: SolarHeaderProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button className={styles.backBtn} onClick={onBackClick} title="Back to Rooftop Workspace">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back to Rooftop</span>
        </button>

        <button className={styles.logoBtn} onClick={() => navigate('/')} title="Back to Home">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <path d="M8 18L14 8L20 18" stroke="var(--color-solar)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 15H18" stroke="var(--color-solar)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
            <circle cx="14" cy="6" r="1.5" fill="var(--color-solar)"/>
          </svg>
          <span className={styles.logoText}>
            SolarRoof <span className={styles.logoAccent}>Intelligence</span>
          </span>
        </button>
      </div>

      <div className={styles.center}>
        <ProgressStepper currentStep={3} />
      </div>

      <div className={styles.right}>
        {/* Status Badge */}
        {status === 'analyzing' && (
          <div className={`${styles.statusBadge} ${styles.analyzing}`}>
            <span className={styles.spinner} />
            <span>Analyzing Solar Mesh...</span>
          </div>
        )}

        {status === 'outdated' && (
          <button className={`${styles.statusBadge} ${styles.outdated}`} onClick={onRecalculate} title="Rooftop geometry was updated in Phase 3. Click to re-run analysis.">
            <span>⚠️ Rooftop Updated • Recalculate</span>
          </button>
        )}

        {status === 'completed' && (
          <div className={`${styles.statusBadge} ${styles.completed}`}>
            <span className={styles.completedDot} />
            <span>Solar Model Active</span>
          </div>
        )}

        {assessmentId && (
          <div className={styles.assessmentBadge} title="Assessment Reference ID">
            <span className={styles.badgeDot} />
            {assessmentId}
          </div>
        )}

        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
    </header>
  );
}
