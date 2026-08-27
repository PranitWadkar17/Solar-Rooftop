import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '@/App';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { ProgressStepper } from '@/components/Assessment/ProgressStepper/ProgressStepper';
import styles from './RooftopHeader.module.css';

interface RooftopHeaderProps {
  assessmentId: string | null;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  onBackClick: () => void;
}

export function RooftopHeader({ assessmentId, saveStatus, onBackClick }: RooftopHeaderProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button className={styles.backBtn} onClick={onBackClick} title="Back to Location Selection">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back to Location</span>
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
        <ProgressStepper currentStep={2} />
      </div>

      <div className={styles.right}>
        {/* Auto-save status badge */}
        <div className={`${styles.saveBadge} ${styles[saveStatus]}`} title={`Save status: ${saveStatus}`}>
          <span className={styles.saveDot} />
          <span className={styles.saveText}>
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'unsaved' && 'Unsaved changes'}
          </span>
        </div>

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
