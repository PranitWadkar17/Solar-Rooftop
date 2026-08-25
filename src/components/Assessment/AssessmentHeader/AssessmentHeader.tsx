import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '../../../App';
import { ThemeToggle } from '../../ThemeToggle/ThemeToggle';
import { ProgressStepper } from '../ProgressStepper/ProgressStepper';
import styles from './AssessmentHeader.module.css';

interface AssessmentHeaderProps {
  currentStep: number;
  assessmentId: string | null;
}

export function AssessmentHeader({ currentStep, assessmentId }: AssessmentHeaderProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button className={styles.logoBtn} onClick={() => navigate('/')} title="Back to Home">
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <path d="M8 18L14 8L20 18" stroke="var(--color-solar)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 15H18" stroke="var(--color-solar)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
            <circle cx="14" cy="6" r="1.5" fill="var(--color-solar)"/>
          </svg>
          <span className={styles.logoText}>
            SolarRoof <span className={styles.logoAccent}>Intelligence</span>
          </span>
        </button>

        <div className={styles.breadcrumb}>
          <span className={styles.breadcrumbLink} onClick={() => navigate('/')}>Home</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className={styles.breadcrumbCurrent}>
            Rooftop Assessment
          </span>
        </div>
      </div>

      <div className={styles.center}>
        <ProgressStepper currentStep={currentStep} />
      </div>

      <div className={styles.right}>
        {assessmentId && (
          <div className={styles.assessmentBadge}>
            <span className={styles.badgeDot} />
            {assessmentId}
          </div>
        )}
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
    </header>
  );
}
