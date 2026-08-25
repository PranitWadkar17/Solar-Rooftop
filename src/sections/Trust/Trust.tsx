import React from 'react';
import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import { trustPillars } from '../../data/trustPillars';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import styles from './Trust.module.css';

const trustIcons: Record<string, React.ReactNode> = {
  chart: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  confidence: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  imagery: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
  transparency: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  edit: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  verify: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
};

export function Trust() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section className={`${styles.section} section`} aria-label="Trust and Transparency">
      <div className="container" ref={ref}>
        <SectionHeading
          label="Trust"
          title="Built to Explain the Decision."
          subtitle="Transparency and explainability are core to every assessment."
        />

        <div className={`${styles.grid} ${isVisible ? styles.visible : ''}`}>
          {trustPillars.map((pillar, i) => (
            <div
              key={pillar.id}
              className={styles.pillar}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <div className={styles.pillarIcon}>
                {trustIcons[pillar.icon]}
              </div>
              <h3 className={styles.pillarTitle}>{pillar.title}</h3>
              <p className={styles.pillarDesc}>{pillar.description}</p>
            </div>
          ))}
        </div>

        <div className={`${styles.disclaimer} ${isVisible ? styles.visible : ''}`}>
          <div className={styles.disclaimerIcon} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
          </div>
          <p>
            Remote analysis supports decisions. Final installation requires physical site verification
            by qualified professionals and relevant regulatory authorities.
          </p>
        </div>
      </div>
    </section>
  );
}
