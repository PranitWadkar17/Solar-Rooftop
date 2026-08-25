import React from 'react';
import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import { techCategories } from '../../data/technology';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import styles from './Technology.module.css';

const categoryIcons: Record<string, React.ReactNode> = {
  gis: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  vision: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  solar: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>,
  optimization: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  threed: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
  platform: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
};

export function Technology() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section className={`${styles.section} section`} id="technology" aria-label="Technology Stack">
      <div className="container" ref={ref}>
        <SectionHeading
          label="Technology"
          title="Built on Modern Infrastructure"
          subtitle="A technology stack designed for geospatial intelligence, computer vision, and scalable solar modelling."
        />

        <div className={`${styles.grid} ${isVisible ? styles.visible : ''}`}>
          {techCategories.map((cat, i) => (
            <div
              key={cat.category}
              className={styles.category}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <div className={styles.categoryHeader}>
                <div className={styles.categoryIcon}>
                  {categoryIcons[cat.icon]}
                </div>
                <h3 className={styles.categoryTitle}>{cat.category}</h3>
              </div>
              <div className={styles.tags}>
                {cat.technologies.map((tech) => (
                  <span key={tech} className={styles.tag}>{tech}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
