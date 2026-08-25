import { SectionHeading } from '../../components/SectionHeading/SectionHeading';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import styles from './Differentiation.module.css';

const typicalApproach = [
  'Is this roof suitable for solar?',
];

const ourApproach = [
  'Why is it suitable — or not?',
  'What physical factors limit it?',
  'What is the best panel configuration?',
  'What happens if we change the roof?',
  'What is the expected financial outcome?',
  'How confident are we in this assessment?',
];

export function Differentiation() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.15 });

  return (
    <section className={`${styles.section} section`} aria-label="What Makes This Different">
      <div className="container" ref={ref}>
        <SectionHeading
          label="Approach"
          title="Not Just a Solar Calculator."
          subtitle="Moving from a binary verdict to a comprehensive decision-support framework."
        />

        <div className={`${styles.comparison} ${isVisible ? styles.visible : ''}`}>
          {/* Typical */}
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              <span className={styles.columnLabel}>Typical Approach</span>
            </div>
            <div className={styles.columnBody}>
              {typicalApproach.map((q) => (
                <div key={q} className={styles.questionRow}>
                  <span className={styles.questionIcon} aria-hidden="true">→</span>
                  <span className={styles.questionText}>{q}</span>
                </div>
              ))}
              <div className={styles.answerBox}>
                <span className={styles.answerIcon} aria-hidden="true">●</span>
                <span>Yes / No</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className={styles.divider} aria-hidden="true">
            <span className={styles.dividerLabel}>vs</span>
          </div>

          {/* Ours */}
          <div className={`${styles.column} ${styles.columnHighlight}`}>
            <div className={styles.columnHeader}>
              <span className={styles.columnLabel}>SolarRoof Intelligence</span>
            </div>
            <div className={styles.columnBody}>
              {ourApproach.map((q) => (
                <div key={q} className={styles.questionRow}>
                  <span className={`${styles.questionIcon} ${styles.questionIconAccent}`} aria-hidden="true">◈</span>
                  <span className={styles.questionText}>{q}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className={styles.note}>
          Positioned as an integrated assessment and decision-support workflow — not a competitive comparison.
        </p>
      </div>
    </section>
  );
}
