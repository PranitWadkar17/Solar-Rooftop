import styles from './ThemeToggle.module.css';
import type { Theme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'night';

  return (
    <button
      className={styles.toggle}
      onClick={onToggle}
      aria-label={isDark ? 'Switch to day mode' : 'Switch to night mode'}
      title={isDark ? 'Switch to Day mode' : 'Switch to Night mode'}
    >
      <div className={styles.track}>
        <span className={`${styles.iconSlot} ${!isDark ? styles.active : ''}`} aria-hidden="true">
          ☀️
        </span>
        <span className={`${styles.iconSlot} ${isDark ? styles.active : ''}`} aria-hidden="true">
          🌙
        </span>
        <span
          className={styles.thumb}
          style={{ transform: isDark ? 'translateX(100%)' : 'translateX(0)' }}
        />
      </div>
    </button>
  );
}
