import { useNavigate } from 'react-router-dom';
import { loadAssessment } from '@/services/assessmentService';
import { formatArea } from '@/utils/geoUtils';
import { AssessmentHeader } from '@/components/Assessment/AssessmentHeader/AssessmentHeader';
import styles from './RooftopPage.module.css';

export function RooftopPage() {
  const navigate = useNavigate();
  const assessment = loadAssessment();

  const areaFormatted = assessment?.selectedBuildingArea ? formatArea(assessment.selectedBuildingArea) : null;

  return (
    <div className={styles.page}>
      <AssessmentHeader currentStep={2} assessmentId={assessment?.assessmentId ?? null} />

      <main className={styles.container}>
        <div className={styles.contentCard}>
          <div className={styles.statusBadge}>
            <span className={styles.statusDot} aria-hidden="true" />
            Phase 2 Complete — Site & Rooftop Confirmed
          </div>

          <h1 className={styles.title}>Rooftop Segmentation & Solar Analysis</h1>
          <p className={styles.subtitle}>
            Your rooftop boundary and site metadata have been verified. The 3D surface mesh and irradiance engines will be activated in Phase 3.
          </p>

          {/* Confirmed Data Display */}
          <div className={styles.dataGrid}>
            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Assessment Reference</span>
              <span className={`${styles.dataValue} ${styles.mono} ${styles.highlight}`}>
                {assessment?.assessmentId || 'Not Generated'}
              </span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Selected Coordinates</span>
              <span className={`${styles.dataValue} ${styles.mono}`}>
                {assessment?.selectedLatitude !== null && assessment?.selectedLongitude !== null
                  ? `${assessment?.selectedLatitude?.toFixed(6)}, ${assessment?.selectedLongitude?.toFixed(6)}`
                  : 'None Selected'}
              </span>
            </div>

            <div className={`${styles.dataCard} ${styles.fullWidth}`}>
              <span className={styles.dataLabel}>Site Address</span>
              <span className={styles.dataValue}>
                {assessment?.selectedAddress || 'Custom Selected Point'}
              </span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Building Identification</span>
              <span className={`${styles.dataValue} ${assessment?.selectedBuildingId ? styles.success : ''}`}>
                {assessment?.selectedBuildingId
                  ? (assessment.selectedBuildingIsManual
                      ? '✏️ User-Drawn Custom Polygon'
                      : `✓ ${assessment.selectedBuildingName || 'OSM Footprint Mesh'}`)
                  : 'Point Centroid Selected'}
              </span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Rooftop Footprint Area</span>
              <span className={`${styles.dataValue} ${styles.highlight}`}>
                {areaFormatted ? `${areaFormatted.sqMeters} (${areaFormatted.sqFeet})` : 'Area Estimation Pending'}
              </span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Map Tile Layer</span>
              <span className={styles.dataValue}>
                {assessment?.mapLayer === 'satellite' ? '🛰️ Satellite Imagery' : '🗺️ OpenStreetMap Standard'}
              </span>
            </div>

            <div className={styles.dataCard}>
              <span className={styles.dataLabel}>Boundary Status</span>
              <span className={`${styles.dataValue} ${styles.success}`}>
                {assessment?.selectedBuildingGeometry ? '✓ GeoJSON Boundary Stored' : 'Point Location Registered'}
              </span>
            </div>
          </div>

          {/* Feature Roadmap */}
          <div className={styles.roadmap}>
            <h3 className={styles.roadmapTitle}>Upcoming Phase 3 Modules</h3>
            <div className={styles.roadmapList}>
              <div className={styles.roadmapItem}>
                <span className={styles.stepNum}>01</span>
                <div>
                  <strong>AI Rooftop Obstacle Detection</strong>
                  <p>Automatic detection of chimneys, HVAC units, skylights, and parapet shadows on your confirmed footprint.</p>
                </div>
              </div>
              <div className={styles.roadmapItem}>
                <span className={styles.stepNum}>02</span>
                <div>
                  <strong>3D Surface Mesh & Tilt Modeling</strong>
                  <p>Azimuth, slope calculation, and sun path irradiance vectoring across the {areaFormatted?.sqMeters || 'rooftop'} area.</p>
                </div>
              </div>
              <div className={styles.roadmapItem}>
                <span className={styles.stepNum}>03</span>
                <div>
                  <strong>Financial & Energy Yield Simulations</strong>
                  <p>Hourly solar generation projections, DISCOM tariffs, and ROI analysis.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.actions}>
            <button className={styles.secondaryBtn} onClick={() => navigate('/assessment')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Adjust Rooftop Boundary
            </button>
            <button className={styles.primaryBtn} onClick={() => navigate('/')}>
              Return to Landing Page
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
