import { useNavigate } from 'react-router-dom';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import styles from './FinalCTA.module.css';

export function FinalCTA() {
  const navigate = useNavigate();
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.15 });

  return (
    <section className={`${styles.section} section`} aria-label="Get Started">
      <div className="container" ref={ref}>
        <div className={`${styles.content} ${isVisible ? styles.visible : ''}`}>
          <span className={styles.label}>Get Started</span>

          <h2 className={styles.headline}>
            Your Rooftop Has More Data{' '}
            <span className={styles.headlineAccent}>Than You Think.</span>
          </h2>

          <p className={styles.subtext}>
            Start with a location. End with a solar decision.
          </p>

          <div className={styles.actions}>
            <button className={styles.primaryCta} onClick={() => navigate('/assessment')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
              Assess My Rooftop
            </button>
            <a
              href="#platform"
              className={styles.secondaryCta}
              onClick={(e) => {
                e.preventDefault();
                document.querySelector('#platform')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Explore the Platform
            </a>
          </div>
        </div>
      </div>

      {/* Background accent */}
      <div className={styles.bgGlow} aria-hidden="true" />
    </section>
  );
}
