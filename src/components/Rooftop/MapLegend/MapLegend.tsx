import { useState } from 'react';
import styles from './MapLegend.module.css';

interface MapLegendProps {
  showRoof: boolean;
  showSections: boolean;
  showObstacles: boolean;
  showClearance: boolean;
  showExistingSolar: boolean;
  onToggleLayer: (layer: 'showRoofBoundary' | 'showSections' | 'showObstacles' | 'showClearance' | 'showExistingSolar') => void;
}

export function MapLegend({
  showRoof,
  showSections,
  showObstacles,
  showClearance,
  showExistingSolar,
  onToggleLayer,
}: MapLegendProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`${styles.legend} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.header} onClick={() => setCollapsed(!collapsed)}>
        <span className={styles.title}>Map Overlays</span>
        <button className={styles.collapseBtn} aria-label="Toggle legend" title="Toggle legend">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {!collapsed && (
        <div className={styles.items}>
          <label className={styles.item}>
            <input
              type="checkbox"
              checked={showRoof}
              onChange={() => onToggleLayer('showRoofBoundary')}
            />
            <span className={styles.swatch} style={{ borderColor: 'var(--color-solar, #f59e0b)', backgroundColor: 'rgba(245, 158, 11, 0.2)' }} />
            <span className={styles.label}>Roof Boundary</span>
          </label>

          <label className={styles.item}>
            <input
              type="checkbox"
              checked={showSections}
              onChange={() => onToggleLayer('showSections')}
            />
            <span className={styles.swatch} style={{ borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.15)' }} />
            <span className={styles.label}>Roof Sections</span>
          </label>

          <label className={styles.item}>
            <input
              type="checkbox"
              checked={showObstacles}
              onChange={() => onToggleLayer('showObstacles')}
            />
            <span className={styles.swatch} style={{ borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.35)' }} />
            <span className={styles.label}>Obstacles</span>
          </label>

          <label className={styles.item}>
            <input
              type="checkbox"
              checked={showClearance}
              onChange={() => onToggleLayer('showClearance')}
            />
            <span className={`${styles.swatch} ${styles.dashedSwatch}`} style={{ borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.12)' }} />
            <span className={styles.label}>Clearance Buffer</span>
          </label>

          <label className={styles.item}>
            <input
              type="checkbox"
              checked={showExistingSolar}
              onChange={() => onToggleLayer('showExistingSolar')}
            />
            <span className={styles.swatch} style={{ borderColor: '#eab308', backgroundColor: 'rgba(234, 179, 8, 0.4)' }} />
            <span className={styles.label}>Existing Solar PV</span>
          </label>
        </div>
      )}
    </div>
  );
}
