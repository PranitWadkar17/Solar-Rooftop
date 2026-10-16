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
            {/* Project Badge */}
            <div className={styles.badge}>
              <span className={styles.badgeDot} aria-hidden="true" />
              Rooftop Solar Intelligence Platform
            </div>

            {/* Main Headline */}
            <h1 className={styles.headline}>
              Turn Every Rooftop Into a{' '}
              <span className={styles.headlineAccent}>Solar Decision</span>.
            </h1>

            {/* Subtitle directly describing the actual project */}
            <p className={styles.subtext}>
              Analyze your rooftop from satellite imagery, detect obstacles, model seasonal solar shading, 
              and automatically place the optimal panel layout based on your monthly electricity consumption.
            </p>

            {/* Actions */}
            <div className={styles.actions}>
              <button
                className={styles.primaryCta}
                onClick={() => navigate('/assessment')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                Assess My Rooftop
              </button>
              <a
                href="#workflow"
                className={styles.secondaryCta}
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector('#workflow')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Explore Assessment Steps
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
