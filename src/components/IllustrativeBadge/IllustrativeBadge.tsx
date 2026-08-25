import styles from './IllustrativeBadge.module.css';

interface IllustrativeBadgeProps {
  className?: string;
}

export function IllustrativeBadge({ className = '' }: IllustrativeBadgeProps) {
  return (
    <span className={`${styles.badge} ${className}`} aria-label="Values shown are illustrative only">
      ◈ Illustrative
    </span>
  );
}
