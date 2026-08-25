import React from 'react';
import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import { workflowSteps } from '../../data/workflow';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import styles from './HowItWorks.module.css';

const stepIcons: Record<string, React.ReactNode> = {
  locate: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 11.5 7.3 11.8a1 1 0 0 0 1.4 0C13 21.5 20 15.4 20 10a8 8 0 0 0-8-8Z"/>
    </svg>
  ),
  understand: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h4l3-9 4 18 3-9h6"/>
    </svg>
  ),
  model: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  ),
  optimize: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  decide: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
};

export function HowItWorks() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section className={`${styles.section} section`} id="how-it-works" aria-label="How It Works">
      <div className="container" ref={ref}>
        <SectionHeading
          label="Process"
          title="How It Works"
          subtitle="From location to decision in five structured steps."
        />

        <div className={`${styles.steps} ${isVisible ? styles.visible : ''}`}>
          {workflowSteps.map((step, index) => (
            <div
              key={step.number}
              className={styles.step}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {/* Connector */}
              {index < workflowSteps.length - 1 && (
                <div className={styles.connector} aria-hidden="true" />
              )}

              <div className={styles.stepNumber}>
                <span>{step.number}</span>
              </div>

              <div className={styles.stepIcon}>
                {stepIcons[step.icon]}
              </div>

              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
