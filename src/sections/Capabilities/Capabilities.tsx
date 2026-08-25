import React from 'react';
import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import { capabilities } from '../../data/capabilities';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import styles from './Capabilities.module.css';

const capabilityIcons: Record<string, React.ReactNode> = {
  rooftop: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M4 21V10l8-6 8 6v11"/><rect x="9" y="13" width="6" height="8" rx="1"/></svg>,
  obstacle: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,
  sun: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>,
  panels: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 12h20M12 4v16M7 4v16M17 4v16"/></svg>,
  energy: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  meter: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>,
  finance: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/></svg>,
  policy: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
  explain: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8M8 14h4"/></svg>,
  whatif: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
};

export function Capabilities() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.05 });

  return (
    <section className={`${styles.section} section`} id="capabilities" aria-label="Core Capabilities">
      <div className="container" ref={ref}>
        <SectionHeading
          label="Capabilities"
          title="What the Platform Does"
          subtitle="An integrated suite of geospatial, solar, and financial intelligence capabilities."
        />

        <div className={`${styles.grid} ${isVisible ? styles.visible : ''}`}>
          {capabilities.map((cap, i) => (
            <div
              key={cap.id}
              className={`${styles.card} ${styles[cap.accent]}`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className={styles.cardIcon}>
                {capabilityIcons[cap.icon]}
              </div>
              <h3 className={styles.cardTitle}>{cap.title}</h3>
              <p className={styles.cardDesc}>{cap.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
