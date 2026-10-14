import { useOptimization } from '@/context/OptimizationContext';
import styles from './LayoutComparisonModal.module.css';

interface LayoutComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LayoutComparisonModal({ isOpen, onClose }: LayoutComparisonModalProps) {
  const { state, dispatch, consumption } = useOptimization();
  const { layouts, activeLayoutId } = state;

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Compare Candidate Array Layouts</h2>
            <p className={styles.subtitle}>
              Evaluate trade-offs between solar yield generation, peak DC capacity, roof space utilization, and consumption matching.
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className={styles.grid}>
          {layouts.map((layout) => {
            const isCurrent = layout.id === activeLayoutId;
            const isConsumptionOptimized = layout.objective === 'consumption_optimized';
            
            return (
              <div
                key={layout.id}
                className={`${styles.card} ${isCurrent ? styles.cardActive : ''} ${isConsumptionOptimized ? styles.cardConsumption : ''}`}
              >
                <div className={styles.cardHeader}>
                  <div>
                    <strong className={styles.cardName}>{layout.name}</strong>
                    <span className={`${styles.objectiveTag} ${isConsumptionOptimized ? styles.objectiveConsumption : ''}`}>
                      {layout.objective.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  {isCurrent && <span className={styles.activeBadge}>Current Layout</span>}
                </div>

                {isConsumptionOptimized && consumption && (
                  <div className={styles.consumptionBanner}>
                    <span className={styles.consumptionIcon}>💡</span>
                    <div className={styles.consumptionInfo}>
                      <strong>Matched to Your Consumption</strong>
                      <span>{consumption.annualKwh?.toLocaleString()} kWh/year target</span>
                    </div>
                  </div>
                )}

                <div className={styles.metricsList}>
                  <div className={styles.metricRow}>
                    <span>System Capacity</span>
                    <strong className={styles.capacityVal}>{layout.systemCapacityKWp} kWp</strong>
                  </div>
                  <div className={styles.metricRow}>
                    <span>Active Modules</span>
                    <strong>{layout.activePanelCount} panels</strong>
                  </div>
                  <div className={styles.metricRow}>
                    <span>Occupied Area</span>
                    <strong>{layout.occupiedAreaSqM} m²</strong>
                  </div>
                  <div className={styles.metricRow}>
                    <span>Roof Utilization</span>
                    <strong>{layout.utilizationPct}%</strong>
                  </div>
                  <div className={styles.metricRow}>
                    <span>Orientation & Tilt</span>
                    <strong>
                      {layout.constraints.orientation} ({layout.constraints.tiltDeg}°)
                    </strong>
                  </div>
                  <div className={styles.metricRow}>
                    <span>Layout Score</span>
                    <strong className={styles.scoreVal}>{layout.layoutScore}/100</strong>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <button
                    className={isCurrent ? styles.currentBtn : styles.selectBtn}
                    onClick={() => {
                      dispatch({ type: 'SELECT_LAYOUT', payload: layout.id });
                      onClose();
                    }}
                  >
                    {isCurrent ? 'Active Selection' : 'Choose This Layout'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
