import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import styles from './Differentiation.module.css';

const typicalApproach = [
  { title: 'Flat 2D Estimation', desc: 'Over-simplified area multiplication that ignores pitch, tilt, and multiple roof facets.' },
  { title: 'Static Sunshine Tables', desc: 'Uses city-level averages without calculating micro-shadows from trees or water tanks.' },
  { title: 'Arbitrary Panel Sizing', desc: 'Random or max-fill layouts completely disconnected from your real monthly electricity bill.' },
  { title: 'Black-Box Binary Output', desc: 'Provides vague "Good / Bad" scores with no breakdown of structural or solar constraints.' },
  { title: 'Costly Physical Surveys', desc: 'Requires manual ladder inspections, drone pilots, and weeks of waiting for proposals.' },
];

const ourApproach = [
  { title: 'True 3D Geospatial Mesh', desc: 'Millimeter-level plane detection, automated azimuth, slope, and structural setback zones.' },
  { title: 'Dynamic 365-Day Raytracing', desc: 'Physics-based solar vector calculation simulating seasonal tree canopy and skyline shadows.' },
  { title: 'Bill-Driven Intelligent Sizing', desc: 'Dynamically computes the exact number of panels needed to offset your actual tariff.' },
  { title: 'Transparent Multi-Factor HUD', desc: 'Detailed factor-by-factor breakdown: Solar Yield, Usable Space, Financial Payback, and Grid Policy.' },
  { title: 'Autonomous Instant CAD', desc: 'Complete production-grade solar layout and financial blueprint in under 60 seconds.' },
];

export function Differentiation() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.15 });

  return (
    <section className={`${styles.section} section`} aria-label="What Makes This Different">
      <div className="container" ref={ref}>
        <SectionHeading
          label="The Competitive Advantage"
          title="Not Just a Solar Calculator."
          subtitle="Moving beyond flat 2D guesswork to autonomous 3D geospatial intelligence."
        />

        <div className={`${styles.comparison} ${isVisible ? styles.visible : ''}`}>
          {/* Typical */}
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              <span className={styles.columnLabel} style={{ color: '#94a3b8' }}>Conventional 2D Estimators</span>
            </div>
            <div className={styles.columnBody}>
              {typicalApproach.map((item) => (
                <div key={item.title} className={styles.questionRow} style={{ marginBottom: '16px' }}>
                  <span className={styles.questionIcon} style={{ color: '#ef4444' }} aria-hidden="true">✕</span>
                  <div>
                    <strong style={{ display: 'block', color: '#cbd5e1', fontSize: '0.95rem' }}>{item.title}</strong>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className={styles.divider} aria-hidden="true">
            <span className={styles.dividerLabel}>VS</span>
          </div>

          {/* Ours */}
          <div className={`${styles.column} ${styles.columnHighlight}`}>
            <div className={styles.columnHeader}>
              <span className={styles.columnLabel} style={{ color: '#38bdf8' }}>SolarRoof 3D Intelligence</span>
            </div>
            <div className={styles.columnBody}>
              {ourApproach.map((item) => (
                <div key={item.title} className={styles.questionRow} style={{ marginBottom: '16px' }}>
                  <span className={`${styles.questionIcon} ${styles.questionIconAccent}`} style={{ color: '#10b981' }} aria-hidden="true">✓</span>
                  <div>
                    <strong style={{ display: 'block', color: '#ffffff', fontSize: '0.95rem', textShadow: '0 0 10px rgba(56, 189, 248, 0.4)' }}>
                      {item.title}
                    </strong>
                    <span style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.85)' }}>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
