import React from 'react';
import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import { useCases } from '../../data/useCases';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import styles from './UseCases.module.css';

const useCaseIcons: Record<string, React.ReactNode> = {
  home: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  installer: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  institution: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/>
    </svg>
  ),
  government: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7h20L12 2z"/><rect x="4" y="10" width="16" height="10"/><path d="M8 10v10M12 10v10M16 10v10M2 20h20"/>
    </svg>
  ),
};

export function UseCases() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section className={`${styles.section} section`} id="applications" aria-label="Use Cases">
      <div className="container" ref={ref}>
        <SectionHeading
          label="Applications"
          title="Who Uses This Platform"
          subtitle="Serving the full spectrum of stakeholders in rooftop solar adoption."
        />

        <div className={`${styles.grid} ${isVisible ? styles.visible : ''}`}>
          {useCases.map((uc, i) => (
            <div
              key={uc.id}
              className={styles.card}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className={styles.cardIcon}>
                {useCaseIcons[uc.icon]}
              </div>
              <h3 className={styles.cardTitle}>{uc.title}</h3>
              <p className={styles.cardDesc}>{uc.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
