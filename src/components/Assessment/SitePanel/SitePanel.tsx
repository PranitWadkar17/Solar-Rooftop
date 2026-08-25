import styles from './SitePanel.module.css';
import type { AssessmentState } from '@/types/index.js';
import { formatArea } from '@/utils/geoUtils';

interface SitePanelProps {
  state: AssessmentState;
  onChangeLocation: () => void;
  onConfirmSite: () => void;
  onDeselectBuilding: () => void;
  buildingCount: number;
  isDrawingMode: boolean;
  onToggleDrawingMode: () => void;
}

export function SitePanel({
  state,
  onChangeLocation,
  onConfirmSite,
  onDeselectBuilding,
  buildingCount,
  isDrawingMode,
  onToggleDrawingMode,
}: SitePanelProps) {
  const hasLocation = state.selectedLatitude !== null && state.selectedLongitude !== null;
  const hasBuilding = state.selectedBuildingId !== null;
  const isConfirmed = state.locationConfirmed;

  if (!hasLocation) return null;

  const areaFormatted = state.selectedBuildingArea ? formatArea(state.selectedBuildingArea) : null;

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-solar)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Site & Rooftop Assessment
        </h3>
        {isConfirmed && (
          <span className={styles.confirmedBadge}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Confirmed
          </span>
        )}
      </div>

      {/* Location Details Section */}
      <div className={styles.sectionCard}>
        <span className={styles.sectionHeader}>📍 Location Parameters</span>
        <div className={styles.infoGroup}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Address</span>
            <span className={styles.infoValue}>
              {state.selectedAddress || 'Custom Location'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Coordinates</span>
            <span className={`${styles.infoValue} ${styles.mono}`}>
              {state.selectedLatitude?.toFixed(6)}, {state.selectedLongitude?.toFixed(6)}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Source</span>
            <span className={styles.infoValue}>
              {state.locationSource === 'search' ? '🔍 Search Query' :
               state.locationSource === 'geolocation' ? '📍 GPS Position' : '🗺️ Map Pin'}
            </span>
          </div>
        </div>
      </div>

      {/* Building Footprint & Rooftop Section */}
      <div className={`${styles.sectionCard} ${hasBuilding ? styles.buildingActiveCard : styles.buildingPendingCard}`}>
        <div className={styles.buildingSectionHeader}>
          <span className={styles.sectionHeader}>🏠 Rooftop Footprint</span>
          {hasBuilding ? (
            <span className={styles.statusSelectedBadge}>
              {state.selectedBuildingIsManual ? '✏️ Custom Polygon' : '✓ Selected'}
            </span>
          ) : (
            <span className={styles.statusPendingBadge}>⚪ Selection Required</span>
          )}
        </div>

        {hasBuilding ? (
          <div className={styles.infoGroup}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Building Name</span>
              <span className={styles.infoValue}>
                {state.selectedBuildingName || 'Building Structure'}
              </span>
            </div>

            {areaFormatted && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Footprint Area</span>
                <span className={`${styles.infoValue} ${styles.areaHighlight}`}>
                  <strong>{areaFormatted.sqMeters}</strong>
                  <span className={styles.subArea}>({areaFormatted.sqFeet})</span>
                </span>
              </div>
            )}

            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Boundary Type</span>
              <span className={styles.infoValue}>
                {state.selectedBuildingIsManual ? 'Manual Polygon' : 'OSM Footprint Mesh'}
              </span>
            </div>

            {state.selectedBuildingId && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Footprint ID</span>
                <span className={`${styles.infoValue} ${styles.mono} ${styles.subtleMono}`}>
                  {state.selectedBuildingId}
                </span>
              </div>
            )}

            <div className={styles.selectionActionsRow}>
              <button className={styles.changeSelectionBtn} onClick={onDeselectBuilding}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
                Change Selection
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.noBuildingContent}>
            <p className={styles.noBuildingPrompt}>
              {buildingCount > 0
                ? `${buildingCount} building polygons detected. Hover and click your building on the map to select it.`
                : 'No automatic building footprints found in this area. You can draw your rooftop boundary manually.'}
            </p>

            <button
              className={`${styles.manualDrawBtn} ${isDrawingMode ? styles.manualDrawActive : ''}`}
              onClick={onToggleDrawingMode}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              {isDrawingMode ? 'Exit Drawing Mode' : '✏️ Draw Custom Rooftop Polygon'}
            </button>
          </div>
        )}
      </div>

      {/* Assessment Reference ID */}
      {state.assessmentId && (
        <div className={styles.refRow}>
          <span className={styles.refLabel}>Session Reference:</span>
          <span className={`${styles.mono} ${styles.assessmentId}`}>
            {state.assessmentId}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.changeBtn}
          onClick={onChangeLocation}
          title="Search or select a different site location"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Change Location
        </button>

        <button
          className={`${styles.confirmBtn} ${isConfirmed ? styles.confirmedBtn : ''}`}
          onClick={onConfirmSite}
          disabled={isConfirmed}
        >
          {isConfirmed ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Rooftop Confirmed
            </>
          ) : (
            <>
              {hasBuilding ? 'Analyze This Rooftop' : 'Confirm Site & Continue'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
