import styles from './SectionHeading.module.css';

interface SectionHeadingProps {
  label?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  dark?: boolean;
}

export function SectionHeading({
  label,
  title,
  subtitle,
  align = 'center',
  dark = false,
}: SectionHeadingProps) {
  return (
    <div
      className={`${styles.heading} ${styles[align]} ${dark ? styles.dark : ''}`}
    >
      {label && <span className={styles.label}>{label}</span>}
      <h2 className={styles.title}>{title}</h2>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
