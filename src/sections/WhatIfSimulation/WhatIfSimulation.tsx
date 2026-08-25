import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import { IllustrativeBadge } from '../../components/IllustrativeBadge/IllustrativeBadge';
import { scenarios } from '../../data/scenarios';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import styles from './WhatIfSimulation.module.css';

export function WhatIfSimulation() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section className={`${styles.section} section`} aria-label="What-If Simulation Preview">
      <div className="container" ref={ref}>
        <SectionHeading
          label="Simulation"
          title="Explore What's Possible"
          subtitle="Understand how changes to a rooftop can improve solar potential and financial outcomes."
        />

        <div className={`${styles.simulation} ${isVisible ? styles.visible : ''}`}>
          <IllustrativeBadge className={styles.badge} />

          {/* Current baseline */}
          <div className={styles.baseline}>
            <div className={styles.baselineLabel}>Current Configuration</div>
            <div className={styles.baselineValue}>
              <span className={styles.baselineNumber}>8.2</span>
              <span className={styles.baselineUnit}>kW</span>
            </div>
            <div className={styles.baselineCaption}>System capacity based on current rooftop conditions</div>
          </div>

          {/* Scenarios */}
          <div className={styles.arrow} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M19 12l-7 7-7-7" stroke="var(--color-solar)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Explore Scenarios</span>
          </div>

          <div className={styles.scenarios}>
            {scenarios.map((scenario, i) => (
              <div
                key={scenario.id}
                className={styles.scenario}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className={styles.scenarioHeader}>
                  <span className={styles.scenarioLabel}>{scenario.label}</span>
                  <span className={styles.scenarioDelta}>{scenario.delta}</span>
                </div>
                <p className={styles.scenarioChange}>{scenario.change}</p>
                <div className={styles.scenarioResult}>
                  <div className={styles.scenarioBar}>
                    <div
                      className={styles.scenarioBarFill}
                      style={{ width: `${(parseFloat(scenario.newValue) / 12) * 100}%` }}
                    />
                  </div>
                  <span className={styles.scenarioValue}>{scenario.newValue}</span>
                </div>
              </div>
            ))}
          </div>

          <p className={styles.message}>
            "Understand how a rooftop can become better."
          </p>
        </div>
      </div>
    </section>
  );
}
