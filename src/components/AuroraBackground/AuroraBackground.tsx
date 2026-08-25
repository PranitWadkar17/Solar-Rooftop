import type { ReactNode } from 'react';
import type { ThemeName } from '../../types/index.js';
import styles from './AuroraBackground.module.css';

export interface AuroraBackgroundProps {
  className?: string;
  children?: ReactNode;
  variant?: ThemeName;
}

export function AuroraBackground({
  className = '',
  children,
  variant = 'night',
}: AuroraBackgroundProps) {
  return (
    <div
      role="img"
      aria-label="Animated aurora background"
      className={`${styles.aurora} ${styles[variant] ?? styles.night} ${className}`}
    >
      {/* Background GPU layers (isolated from document layout) */}
      <div className={styles.layers} aria-hidden="true">
        {/* Pulsing radial atmosphere */}
        <div className={styles.pulseGradient} />

        {/* Dynamic aurora glow streaks */}
        <div className={styles.auroraBlobs}>
          <div className={`${styles.blob} ${styles.blob1}`} />
          <div className={`${styles.blob} ${styles.blob2}`} />
          <div className={`${styles.blob} ${styles.blob3}`} />
        </div>

        {/* Subtle climate-tech noise overlay */}
        <div className={styles.noiseOverlay} />
      </div>

      {/* Foreground Content */}
      <div className={styles.content}>{children}</div>
    </div>
  );
}
