import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '@/App';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { ProgressStepper } from '@/components/Assessment/ProgressStepper/ProgressStepper';
import { useOptimization } from '@/context/OptimizationContext';
import styles from './OptimizationHeader.module.css';

interface OptimizationHeaderProps {
  assessmentId: string | null;
  onBackClick: () => void;
}

export function OptimizationHeader({ assessmentId, onBackClick }: OptimizationHeaderProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { dispatch, activeLayout } = useOptimization();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button className={styles.backBtn} onClick={onBackClick} title="Back to Solar & Shading Workspace">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back to Solar Analysis</span>
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
        <ProgressStepper currentStep={4} />
      </div>

      <div className={styles.right}>
        {/* Active System Capacity Badge */}
        {activeLayout && (
          <div className={styles.capacityBadge} title="Total DC Array Peak Capacity">
            <span className={styles.capacityIcon}>⚡</span>
            <strong>{activeLayout.systemCapacityKWp} kWp</strong>
            <span className={styles.panelCountText}>({activeLayout.activePanelCount} Modules)</span>
          </div>
        )}

        {/* Lock Layout Button */}
        {activeLayout && (
          <button
            className={`${styles.lockBtn} ${activeLayout.isLocked ? styles.lockedActive : ''}`}
            onClick={() => dispatch({ type: 'TOGGLE_LOCK' })}
            title={activeLayout.isLocked ? 'Layout Locked (Click to Unlock for Edits)' : 'Lock Layout (Prevent accidental changes)'}
          >
            {activeLayout.isLocked ? '🔒 Locked' : '🔓 Unlocked'}
          </button>
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
