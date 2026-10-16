import { useNavigate } from 'react-router-dom';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import styles from './FinalCTA.module.css';

export function FinalCTA() {
  const navigate = useNavigate();
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.15 });

  return (
    <section className={`${styles.section} section`} aria-label="Get Started" style={{ padding: '90px 0 100px' }}>
      <div className="container" ref={ref}>
        <div
          className={`${styles.content} ${isVisible ? styles.visible : ''}`}
          style={{
            background: 'rgba(7, 14, 28, 0.78)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '24px',
            padding: '50px 32px',
            maxWidth: '820px',
            margin: '0 auto',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(245, 158, 11, 0.15)',
            textAlign: 'center',
          }}
        >
          <span className={styles.label}>Start Rooftop Assessment</span>

          <h2 className={styles.headline} style={{ fontSize: '2.4rem', marginBottom: '16px' }}>
            Ready to Discover Your{' '}
            <span className={styles.headlineAccent} style={{ color: '#fbbf24', textShadow: '0 0 16px rgba(245, 158, 11, 0.5)' }}>
              Solar Potential?
            </span>
          </h2>

          <p className={styles.subtext} style={{ maxWidth: '620px', margin: '0 auto 32px', fontSize: '1.05rem', color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.6 }}>
            Locate your property on the interactive map, select your rooftop boundaries, enter your monthly consumption, 
            and generate an optimized solar panel layout in minutes.
          </p>

          <div className={styles.actions} style={{ justifyContent: 'center' }}>
            <button className={styles.primaryCta} onClick={() => navigate('/assessment')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
              Launch Solar Assessment
            </button>
            <a
              href="#platform"
              className={styles.secondaryCta}
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Back to Top
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
