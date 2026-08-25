import { useNavigate } from 'react-router-dom';
import styles from './AssessmentPage.module.css';

export function AssessmentPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Logo */}
        <div className={styles.logo}>
          <svg width="32" height="32" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <path d="M8 18L14 8L20 18" stroke="var(--color-solar)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 15H18" stroke="var(--color-solar)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
            <circle cx="14" cy="6" r="1.5" fill="var(--color-solar)"/>
          </svg>
          <span className={styles.logoText}>
            SolarRoof <span className={styles.logoAccent}>Intelligence</span>
          </span>
        </div>

        {/* Status badge */}
        <div className={styles.statusBadge}>
          <span className={styles.statusDot} aria-hidden="true" />
          Phase 2 — In Development
        </div>

        <h1 className={styles.title}>Rooftop Analysis Workspace</h1>

        <p className={styles.description}>
          The interactive rooftop assessment workspace is under active development.
          This module will integrate geospatial mapping, AI-powered rooftop detection,
          solar analysis, and financial modelling into a unified analysis experience.
        </p>

        {/* Feature preview */}
        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>◎</span>
            <span>Interactive map-based rooftop selection</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>⬡</span>
            <span>AI boundary detection and obstacle mapping</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>☀</span>
            <span>Real-time solar and shading simulation</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>◈</span>
            <span>Panel placement optimization</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>₹</span>
            <span>Financial projection and what-if analysis</span>
          </div>
        </div>

        <button className={styles.backButton} onClick={() => navigate('/')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Home
        </button>
      </div>
    </div>
  );
}
