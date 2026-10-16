import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import styles from './Problem.module.css';

const factors = [
  { icon: '⬡', label: 'Roof Geometry', detail: 'Slope & Plane Detection' },
  { icon: '◎', label: 'Azimuth & Facing', detail: 'Optimal Sun Orientation' },
  { icon: '△', label: 'Tilt Angle', detail: 'Photovoltaic Angle' },
  { icon: '⊞', label: 'Usable Space', detail: 'Setbacks & Walkways' },
  { icon: '⊘', label: 'HVAC & Vents', detail: 'Obstacle Avoidance' },
  { icon: '⚘', label: 'Tree Shadows', detail: 'Canopy Raytracing' },
  { icon: '▨', label: 'Nearby Buildings', detail: 'Horizon Obstruction' },
  { icon: '◐', label: 'Seasonal Irradiance', detail: '365-Day Sun Vector' },
  { icon: '☀', label: 'Solar Resource (GHI)', detail: 'Direct + Diffuse Light' },
  { icon: '⚡', label: 'Bill Consumption', detail: 'Dynamic Sizing Engine' },
  { icon: '₹', label: 'Payback Economics', detail: 'Tariff & Subsidies' },
  { icon: '⚙', label: 'CAD Deployment', detail: 'Electrical Wiring Grid' },
];

const pipeline = [
  { label: 'Raw Satellite Scan', desc: 'Millimeter-accurate 3D aerial ingestion', color: '#38bdf8' },
  { label: 'Geospatial AI Modeling', desc: 'Obstacle & roof facet segmentation', color: '#60a5fa' },
  { label: 'Physics-Based Raytracing', desc: 'Hour-by-hour shadow & yield simulation', color: '#f59e0b' },
  { label: 'Optimized Solar Deployment', desc: 'Maximized ROI & consumption matching', color: '#10b981' },
];

export function Problem() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section className={`${styles.section} section`} id="problem" aria-label="The Problem">
      <div className="container" ref={ref}>
        <div className={`${styles.content} ${isVisible ? styles.visible : ''}`}>
          <SectionHeading
            label="Multi-Factor Intelligence"
            title="Solar Potential Is More Than Roof Area."
            subtitle="Accurate rooftop solar decisions depend on an intricate interplay of 3D geometry, solar raytracing, shadow kinematics, and consumption economics."
          />

          {/* Factor Grid */}
          <div className={styles.factorGrid}>
            {factors.map((factor) => (
              <div key={factor.label} className={styles.factor}>
                <span className={styles.factorIcon} aria-hidden="true">{factor.icon}</span>
                <span className={styles.factorLabel}>{factor.label}</span>
                <span style={{ fontSize: '0.65rem', color: 'rgba(56, 189, 248, 0.85)', textAlign: 'center', marginTop: '2px' }}>
                  {factor.detail}
                </span>
              </div>
            ))}
          </div>

          {/* Pipeline */}
          <div className={styles.pipeline}>
            {pipeline.map((step, i) => (
              <div key={step.label} className={styles.pipelineStep}>
                <div
                  className={styles.pipelineDot}
                  style={{ borderColor: step.color, boxShadow: `0 0 16px ${step.color}66` }}
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
                      <path d="M5 12h14M13 6l6 6-6 6" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
