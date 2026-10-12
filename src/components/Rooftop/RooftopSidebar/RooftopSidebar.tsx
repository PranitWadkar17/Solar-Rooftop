import { useState } from 'react';
import { useRooftop } from '@/context/RooftopContext';
import { ROOF_CLASSIFICATION_LABELS, type RoofClassification } from '@/types/rooftop.js';
import { getObstacleCategory } from '@/data/obstacleCategories';
import { formatArea, formatDistance, calculateUsableAreaBreakdown } from '@/utils/geoUtils';
import { detectObstacles, candidateToObstacle } from '@/services/obstacleDetectionService';
import styles from './RooftopSidebar.module.css';

interface RooftopSidebarProps {
  onOpenAddObstacle: () => void;
  onRedrawBoundary: () => void;
  onProceedToSolar: () => void;
}

export function RooftopSidebar({
  onOpenAddObstacle,
  onRedrawBoundary,
  onProceedToSolar,
}: RooftopSidebarProps) {
  const { state, dispatch } = useRooftop();
  const { rooftop, activeUnit, selectedObstacleId, aiDetectionStatus, aiDetectionError } = state;

  const [activeTab, setActiveTab] = useState<'overview' | 'obstacles' | 'usable'>('overview');

  if (!rooftop) return null;

  const areaFormatted = formatArea(rooftop.area);
  const usableBreakdown = calculateUsableAreaBreakdown(rooftop.area, rooftop.obstacles);
  const usableFormatted = formatArea(usableBreakdown.physicalUsableArea);
  const obstacleAreaFormatted = formatArea(usableBreakdown.obstacleArea);
  const clearanceAreaFormatted = formatArea(usableBreakdown.clearanceArea);
  const walkwayAreaFormatted = formatArea(usableBreakdown.walkwayArea);

  const pendingObstacles = rooftop.obstacles.filter((o) => o.status === 'pending');
  const activeObstacles = rooftop.obstacles.filter((o) => o.status !== 'rejected');

  // Trigger AI Detection
  const handleRunAiDetection = async () => {
    dispatch({ type: 'SET_AI_STATUS', payload: { status: 'detecting' } });
    try {
      const res = await detectObstacles(rooftop.geometry);
      if (res.success && res.candidates.length > 0) {
        res.candidates.forEach((cand) => {
          const obs = candidateToObstacle(cand, rooftop.id);
          dispatch({ type: 'ADD_OBSTACLE', payload: obs });
        });
        dispatch({ type: 'SET_AI_STATUS', payload: { status: 'done' } });
      } else {
        dispatch({
          type: 'SET_AI_STATUS',
          payload: {
            status: 'error',
            error: res.error || 'No obstacles detected automatically.',
          },
        });
      }
    } catch {
      dispatch({
        type: 'SET_AI_STATUS',
        payload: {
          status: 'error',
          error: 'AI detection service unreachable. Please mark obstacles manually.',
        },
      });
    }
  };

  return (
    <aside className={styles.sidebar} aria-label="Rooftop Analysis Sidebar">
      {/* Tab Navigation */}
      <div className={styles.tabs} role="tablist">
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('overview')}
          role="tab"
          aria-selected={activeTab === 'overview'}
        >
          Roof Info
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'obstacles' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('obstacles')}
          role="tab"
          aria-selected={activeTab === 'obstacles'}
        >
          Obstacles
          {activeObstacles.length > 0 && (
            <span className={styles.tabBadge}>{activeObstacles.length}</span>
          )}
          {pendingObstacles.length > 0 && (
            <span className={styles.tabAlertDot} title={`${pendingObstacles.length} AI detections pending review`} />
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'usable' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('usable')}
          role="tab"
          aria-selected={activeTab === 'usable'}
        >
          Usable Area
        </button>
      </div>

      <div className={styles.content}>
        {/* TAB 1: OVERVIEW & ROOF GEOMETRY */}
        {activeTab === 'overview' && (
          <div className={styles.tabPane}>
            <div className={styles.sectionCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Rooftop Boundary</span>
                <button className={styles.smallBtn} onClick={onRedrawBoundary} title="Redraw polygon on map">
                  ✏️ Redraw
                </button>
              </div>

              <div className={styles.statGrid}>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Total Roof Area</span>
                  <span className={`${styles.statValue} ${styles.statHighlight}`}>
                    {activeUnit === 'metric' ? areaFormatted.sqMeters : areaFormatted.sqFeet}
                  </span>
                  <span className={styles.statSub}>
                    {activeUnit === 'metric' ? areaFormatted.sqFeet : areaFormatted.sqMeters}
                  </span>
                </div>

                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Perimeter</span>
                  <span className={styles.statValue}>
                    {formatDistance(rooftop.perimeter)}
                  </span>
                  <span className={styles.statSub}>Geodesic boundary</span>
                </div>

                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Dimensions</span>
                  <span className={styles.statValue}>
                    {rooftop.approxDimensions
                      ? `${Math.round(rooftop.approxDimensions.length)}m × ${Math.round(rooftop.approxDimensions.width)}m`
                      : 'Derived'}
                  </span>
                  <span className={styles.statSub}>Approx Length × Width</span>
                </div>

                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Orientation</span>
                  <span className={styles.statValue}>
                    {rooftop.orientation !== null ? `${rooftop.orientation}° ${rooftop.orientationCardinal || ''}` : 'Unknown'}
                  </span>
                  <span className={styles.statSub}>Primary Ridge Azimuth</span>
                </div>
              </div>

              {/* Unit Toggle */}
              <div className={styles.unitRow}>
                <span className={styles.unitLabel}>Display Units:</span>
                <div className={styles.unitToggle}>
                  <button
                    className={`${styles.unitBtn} ${activeUnit === 'metric' ? styles.unitBtnActive : ''}`}
                    onClick={() => dispatch({ type: 'SET_UNIT', payload: 'metric' })}
                  >
                    m² / Meters
                  </button>
                  <button
                    className={`${styles.unitBtn} ${activeUnit === 'imperial' ? styles.unitBtnActive : ''}`}
                    onClick={() => dispatch({ type: 'SET_UNIT', payload: 'imperial' })}
                  >
                    sq ft / Feet
                  </button>
                </div>
              </div>
            </div>

            {/* Classification */}
            <div className={styles.sectionCard}>
              <span className={styles.cardTitle}>Roof Classification</span>
              <p className={styles.cardDesc}>
                Classify the roof shape to improve upcoming solar panel array layouts.
              </p>

              <div className={styles.selectWrapper}>
                <select
                  className={styles.select}
                  value={rooftop.roofType}
                  onChange={(e) => dispatch({ type: 'SET_ROOF_TYPE', payload: e.target.value as RoofClassification })}
                >
                  {(Object.keys(ROOF_CLASSIFICATION_LABELS) as RoofClassification[]).map((type) => (
                    <option key={type} value={type}>
                      {ROOF_CLASSIFICATION_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OBSTACLES */}
        {activeTab === 'obstacles' && (
          <div className={styles.tabPane}>
            {/* AI Trigger Bar */}
            <div className={styles.aiBox}>
              <div className={styles.aiHeader}>
                <div>
                  <span className={styles.aiTitle}>🤖 AI Obstacle Detection</span>
                  <span className={styles.aiDesc}>Scan high-res aerial imagery for vents, tanks & shadows</span>
                </div>
                <button
                  className={styles.aiBtn}
                  onClick={handleRunAiDetection}
                  disabled={aiDetectionStatus === 'detecting'}
                >
                  {aiDetectionStatus === 'detecting' ? (
                    <>
                      <span className={styles.spinner} />
                      Scanning...
                    </>
                  ) : (
                    'Run AI Scan'
                  )}
                </button>
              </div>

              {aiDetectionError && (
                <div className={styles.aiErrorNotice}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{aiDetectionError}</span>
                </div>
              )}
            </div>

            {/* Pending AI Review banner */}
            {pendingObstacles.length > 0 && (
              <div className={styles.pendingBanner}>
                <div className={styles.pendingInfo}>
                  <strong>{pendingObstacles.length} AI Detection(s) Pending</strong>
                  <span>Verify or correct detected objects below.</span>
                </div>
                <button
                  className={styles.acceptAllBtn}
                  onClick={() => dispatch({ type: 'ACCEPT_ALL_OBSTACLES' })}
                >
                  Accept All
                </button>
              </div>
            )}

            {/* Add Obstacle Button */}
            <button className={styles.addObsBtn} onClick={onOpenAddObstacle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Rooftop Obstacle
            </button>

            {/* Obstacle List */}
            {activeObstacles.length === 0 ? (
              <div className={styles.emptyObstacles}>
                <span className={styles.emptyIcon}>🛡️</span>
                <strong>No Obstacles Added</strong>
                <p>No rooftop obstructions marked yet. Add AC units, water tanks, trees, or existing solar panels to calculate usable area.</p>
              </div>
            ) : (
              <div className={styles.obstacleList}>
                {activeObstacles.map((obs) => {
                  const cat = getObstacleCategory(obs.type);
                  const isSelected = selectedObstacleId === obs.id;
                  const isPending = obs.status === 'pending';

                  return (
                    <div
                      key={obs.id}
                      className={`${styles.obstacleItem} ${isSelected ? styles.obsSelected : ''} ${isPending ? styles.obsPending : ''}`}
                      onClick={() => dispatch({ type: 'SELECT_OBSTACLE', payload: obs.id })}
                    >
                      <div className={styles.obsHeader}>
                        <div className={styles.obsCategory}>
                          <span className={styles.obsIcon}>{cat.icon}</span>
                          <div>
                            <span className={styles.obsName}>{obs.label || cat.label}</span>
                            <span className={styles.obsSub}>
                              {obs.geometryKind.toUpperCase()}
                              {obs.area ? ` • ${Math.round(obs.area)} m²` : ''}
                              {obs.height ? ` • ${obs.height}m high` : ''}
                            </span>
                          </div>
                        </div>

                        {/* Confidence badge if AI */}
                        {obs.confidence !== null && (
                          <span className={`${styles.confBadge} ${styles[obs.confidenceLevel || 'medium']}`}>
                            {obs.confidence}% AI
                          </span>
                        )}

                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch({ type: 'DELETE_OBSTACLE', payload: obs.id });
                          }}
                          title="Delete obstacle"
                          aria-label="Delete obstacle"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>

                      {/* Clearance slider */}
                      <div className={styles.clearanceControl} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.clearanceLabel}>
                          <span>Safety Clearance Buffer:</span>
                          <strong>{obs.clearance} m</strong>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="3"
                          step="0.1"
                          value={obs.clearance}
                          className={styles.slider}
                          onChange={(e) =>
                            dispatch({
                              type: 'UPDATE_OBSTACLE',
                              payload: { id: obs.id, changes: { clearance: parseFloat(e.target.value) } },
                            })
                          }
                        />
                      </div>

                      {/* Verification buttons if pending */}
                      {isPending && (
                        <div className={styles.verifyRow} onClick={(e) => e.stopPropagation()}>
                          <button
                            className={styles.acceptBtn}
                            onClick={() => dispatch({ type: 'ACCEPT_OBSTACLE', payload: obs.id })}
                          >
                            ✓ Accept AI Detection
                          </button>
                          <button
                            className={styles.rejectBtn}
                            onClick={() => dispatch({ type: 'REJECT_OBSTACLE', payload: obs.id })}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {/* TAB 4: USABLE AREA BREAKDOWN */}
        {activeTab === 'usable' && (
          <div className={styles.tabPane}>
            <div className={styles.sectionCard}>
              <span className={styles.cardTitle}>Physical Usable Area Breakdown</span>
              <p className={styles.cardDesc}>
                Programmatic calculation deducting physical obstructions, clearance buffers, and maintenance pathways.
              </p>

              <div className={styles.breakdownTable}>
                <div className={styles.breakdownRow}>
                  <span>Total Roof Boundary</span>
                  <strong>{activeUnit === 'metric' ? areaFormatted.sqMeters : areaFormatted.sqFeet}</strong>
                </div>

                <div className={`${styles.breakdownRow} ${styles.deductionRow}`}>
                  <span>Obstacle Footprints ({activeObstacles.length})</span>
                  <span className={styles.minusVal}>
                    − {activeUnit === 'metric' ? obstacleAreaFormatted.sqMeters : obstacleAreaFormatted.sqFeet}
                  </span>
                </div>

                <div className={`${styles.breakdownRow} ${styles.deductionRow}`}>
                  <span>Clearance & Buffer Zones</span>
                  <span className={styles.minusVal}>
                    − {activeUnit === 'metric' ? clearanceAreaFormatted.sqMeters : clearanceAreaFormatted.sqFeet}
                  </span>
                </div>

                <div className={`${styles.breakdownRow} ${styles.deductionRow}`}>
                  <span>Maintenance Walkways (5% standard)</span>
                  <span className={styles.minusVal}>
                    − {activeUnit === 'metric' ? walkwayAreaFormatted.sqMeters : walkwayAreaFormatted.sqFeet}
                  </span>
                </div>

                <div className={`${styles.breakdownRow} ${styles.totalUsableRow}`}>
                  <div>
                    <strong>Physical Usable Area</strong>
                    <span className={styles.subNote}>For new solar PV modules</span>
                  </div>
                  <strong className={styles.usableNumber}>
                    {activeUnit === 'metric' ? usableFormatted.sqMeters : usableFormatted.sqFeet}
                  </strong>
                </div>
              </div>

              <div className={styles.planningNotice}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                </svg>
                <span>
                  <strong>Planning Assumption:</strong> Full solar-effective irradiance factoring sun angles and dynamic tree/structure shadows will be analyzed in Phase 4.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className={styles.footer}>
        <button
          className={styles.proceedBtn}
          onClick={onProceedToSolar}
          disabled={!rooftop || rooftop.area <= 0}
        >
          <span>Continue to Solar Analysis</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
