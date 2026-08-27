import { useState } from 'react';
import styles from './SolarLegend.module.css';

interface SolarLegendProps {
  showHeatmap: boolean;
  showShadows: boolean;
  showSelectedArea: boolean;
  showObstacles: boolean;
  onToggleLayer: (layer: 'showHeatmap' | 'showShadows' | 'showSelectedArea' | 'showObstacles') => void;
}

export function SolarLegend({
  showHeatmap,
  showShadows,
  showSelectedArea,
  showObstacles,
  onToggleLayer,
}: SolarLegendProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`${styles.legend} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.header} onClick={() => setCollapsed(!collapsed)}>
        <span className={styles.title}>Solar & Shading Layers</span>
        <button className={styles.collapseBtn} aria-label="Toggle legend" title="Toggle legend">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {!collapsed && (
        <div className={styles.content}>
          {/* Heatmap Gradient Scale */}
          <div className={styles.scaleSection}>
            <span className={styles.subTitle}>Solar Potential Gradient</span>
            <div className={styles.gradientBar} />
            <div className={styles.scaleLabels}>
              <span className={styles.highLabel}>High (≥80%)</span>
              <span className={styles.medLabel}>Med (60-80%)</span>
              <span className={styles.lowLabel}>Low (&lt;60%)</span>
            </div>
          </div>

          {/* Layer Checkboxes */}
          <div className={styles.layers}>
            <label className={styles.layerItem}>
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={() => onToggleLayer('showHeatmap')}
              />
              <span className={styles.colorSwatch} style={{ background: '#10b981' }} />
              <span>Solar Irradiance Heatmap</span>
            </label>

            <label className={styles.layerItem}>
              <input
                type="checkbox"
                checked={showShadows}
                onChange={() => onToggleLayer('showShadows')}
              />
              <span className={styles.colorSwatch} style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid #38bdf8' }} />
              <span>Ray-Traced Shadows</span>
            </label>

            <label className={styles.layerItem}>
              <input
                type="checkbox"
                checked={showSelectedArea}
                onChange={() => onToggleLayer('showSelectedArea')}
              />
              <span className={styles.colorSwatch} style={{ background: 'rgba(6, 182, 212, 0.35)', border: '1.5px dashed #06b6d4' }} />
              <span>User-Selected Solar Area</span>
            </label>

            <label className={styles.layerItem}>
              <input
                type="checkbox"
                checked={showObstacles}
                onChange={() => onToggleLayer('showObstacles')}
              />
              <span className={styles.colorSwatch} style={{ background: '#ef4444' }} />
              <span>Rooftop Obstacles</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
