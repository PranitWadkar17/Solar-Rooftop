import type { AssessmentState } from '@/types/index.js';
import { formatArea } from '@/utils/geoUtils';
import styles from './SiteConfirmation.module.css';

interface SiteConfirmationProps {
  state: AssessmentState;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function SiteConfirmation({
  state,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: SiteConfirmationProps) {
  const areaFormatted = state.selectedBuildingArea ? formatArea(state.selectedBuildingArea) : null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-solar)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div>
            <h3 id="confirm-title" className={styles.title}>Confirm Analysis Rooftop</h3>
            <p className={styles.subtitle}>Please verify your selected site & rooftop footprint before proceeding to Phase 3.</p>
          </div>
        </div>

        <div className={styles.detailsCard}>
          <div className={styles.detailRow}>
            <span className={styles.label}>Location Address</span>
            <span className={styles.value}>{state.selectedAddress || 'Custom Location'}</span>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.label}>Geo Coordinates</span>
            <span className={`${styles.value} ${styles.mono}`}>
              {state.selectedLatitude?.toFixed(6)}, {state.selectedLongitude?.toFixed(6)}
            </span>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.label}>Rooftop Selection</span>
            <span className={`${styles.value} ${styles.buildingStatus}`}>
              {state.selectedBuildingId ? (
                state.selectedBuildingIsManual ? '✏️ Custom Drawn Polygon' : `✓ ${state.selectedBuildingName || 'OSM Building Footprint'}`
              ) : 'Point Centroid Selected'}
            </span>
          </div>

          {areaFormatted && (
            <div className={styles.detailRow}>
              <span className={styles.label}>Rooftop Area</span>
              <span className={`${styles.value} ${styles.areaVal}`}>
                <strong>{areaFormatted.sqMeters}</strong> ({areaFormatted.sqFeet})
              </span>
            </div>
          )}

          <div className={styles.detailRow}>
            <span className={styles.label}>Assessment Reference</span>
            <span className={`${styles.value} ${styles.mono} ${styles.refId}`}>
              {state.assessmentId}
            </span>
          </div>
        </div>

        <div className={styles.note}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>All location parameters, rooftop boundary vertices, and footprint metadata will be safely preserved for subsequent rooftop modeling.</span>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={isSubmitting}>
            Modify Selection
          </button>
          <button className={styles.confirmBtn} onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? (
              <span className={styles.spinner} />
            ) : (
              <>
                Proceed to Rooftop Analysis
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
