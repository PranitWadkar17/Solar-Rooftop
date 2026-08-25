import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import styles from './Problem.module.css';

const factors = [
  { icon: '⬡', label: 'Roof Geometry' },
  { icon: '◎', label: 'Orientation' },
  { icon: '△', label: 'Tilt Angle' },
  { icon: '⊞', label: 'Usable Area' },
  { icon: '⊘', label: 'Obstacles' },
  { icon: '⚘', label: 'Trees' },
  { icon: '▨', label: 'Nearby Buildings' },
  { icon: '◐', label: 'Shading' },
  { icon: '☀', label: 'Solar Resource' },
  { icon: '⚡', label: 'Consumption' },
  { icon: '₹', label: 'Economics' },
  { icon: '⚙', label: 'Deployment' },
];

const pipeline = [
  { label: 'Raw Rooftop', desc: 'Satellite imagery', color: 'var(--color-gray-500)' },
  { label: 'Geospatial Analysis', desc: 'Geometry & context extraction', color: 'var(--color-blue)' },
  { label: 'Solar Intelligence', desc: 'Energy & financial modelling', color: 'var(--color-solar)' },
  { label: 'Actionable Decision', desc: 'Suitability & recommendations', color: 'var(--color-green)' },
];

export function Problem() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section className={`${styles.section} section`} id="problem" aria-label="The Problem">
      <div className="container" ref={ref}>
        <div className={`${styles.content} ${isVisible ? styles.visible : ''}`}>
          <SectionHeading
            label="The Challenge"
            title="Solar Potential Is More Than Roof Area."
            subtitle="Rooftop solar decisions depend on a complex interplay of physical, environmental, and economic factors that cannot be reduced to a single measurement."
          />

          {/* Factor Grid */}
          <div className={styles.factorGrid}>
            {factors.map((factor) => (
              <div key={factor.label} className={styles.factor}>
                <span className={styles.factorIcon} aria-hidden="true">{factor.icon}</span>
                <span className={styles.factorLabel}>{factor.label}</span>
              </div>
            ))}
          </div>

          {/* Pipeline */}
          <div className={styles.pipeline}>
            {pipeline.map((step, i) => (
              <div key={step.label} className={styles.pipelineStep}>
                <div
                  className={styles.pipelineDot}
                  style={{ borderColor: step.color, boxShadow: `0 0 12px ${step.color}33` }}
                />
                <div className={styles.pipelineContent}>
                  <span className={styles.pipelineLabel} style={{ color: step.color }}>
                    {step.label}
                  </span>
                  <span className={styles.pipelineDesc}>{step.desc}</span>
                </div>
                {i < pipeline.length - 1 && (
                  <div className={styles.pipelineArrow} aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14M13 6l6 6-6 6" stroke="var(--color-gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
