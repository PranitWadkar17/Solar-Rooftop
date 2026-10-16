import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '../../App';
import styles from './Hero.module.css';

export function Hero() {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);

  return (
    <section id="platform" aria-label="Hero" className={styles.heroSection} data-theme={theme}>
      <div className={styles.heroInner}>
        <div className={`${styles.inner} container`}>
          <div className={styles.content}>
            <div className={styles.badge}>
              <span className={styles.badgeDot} aria-hidden="true" />
              AI + Geospatial Intelligence Platform
            </div>

            <h1 className={styles.headline}>
              Turn Every Rooftop Into a{' '}
              <span className={styles.headlineAccent}>Solar Decision</span>.
            </h1>

            <p className={styles.subtext}>
              An AI and geospatial intelligence platform that transforms rooftop imagery
              into actionable solar potential, energy, financial, and deployment insights.
            </p>

            <div className={styles.actions}>
              <button
                className={styles.primaryCta}
                onClick={() => navigate('/assessment')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                Assess My Rooftop
              </button>
              <a
                href="#how-it-works"
                className={styles.secondaryCta}
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Explore How It Works
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className={styles.scrollIndicator} aria-hidden="true">
          <div className={styles.scrollMouse}>
            <div className={styles.scrollDot} />
          </div>
          <span className={styles.scrollLabel}>Scroll to explore</span>
        </div>
      </div>
    </section>
  );
}
