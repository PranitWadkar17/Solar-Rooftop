import { useState } from 'react';
import { useSolar } from '@/context/SolarContext';
import { formatArea } from '@/utils/geoUtils';
import { DEFAULT_SOLAR_ASSUMPTIONS } from '@/services/irradianceService';
import styles from './SolarSidebar.module.css';

interface SolarSidebarProps {
  onProceedToOptimization: () => void;
}

export function SolarSidebar({ onProceedToOptimization }: SolarSidebarProps) {
  const { state, dispatch, triggerReanalysis } = useSolar();
  const { analysis, status, rooftop, toolMode } = state;
  const [activeTab, setActiveTab] = useState<'overview' | 'select_area' | 'assumptions'>('select_area');

  if (!analysis || !rooftop) return null;

  const grossAreaFormatted = formatArea(analysis.grossRoofAreaSqM);
  const physicalAreaFormatted = formatArea(analysis.physicalUsableAreaSqM);
  const effectiveAreaFormatted = formatArea(analysis.solarEffectiveAreaSqM);
  const selectedArea = analysis.selectedArea;
  const selectedAreaFormatted = selectedArea ? formatArea(selectedArea.area) : null;

  const isSelectionReady = Boolean(selectedArea && selectedArea.area > 0 && selectedArea.obstacleConflicts === 0);

  return (
    <aside className={styles.sidebar} aria-label="Solar Resource & Shading Analysis Sidebar">
      {/* Tabs */}
      <div className={styles.tabs} role="tablist">
        <button
          className={`${styles.tab} ${activeTab === 'select_area' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('select_area')}
          role="tab"
          aria-selected={activeTab === 'select_area'}
        >
          Select Area
          {selectedArea && <span className={styles.tabBadge}>Selected</span>}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('overview')}
          role="tab"
          aria-selected={activeTab === 'overview'}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'assumptions' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('assumptions')}
          role="tab"
          aria-selected={activeTab === 'assumptions'}
        >
          Assumptions
        </button>
      </div>

      {/* Outdated Warning Banner */}
      {status === 'outdated' && (
        <div className={styles.outdatedBanner}>
          <div>
            <strong>⚠️ Rooftop Geometry Changed</strong>
            <p>Phase 3 rooftop boundary or obstacles were modified. Recalculate to refresh solar metrics.</p>
          </div>
          <button className={styles.recalculateBtn} onClick={triggerReanalysis}>
            Recalculate
          </button>
        </div>
      )}

      <div className={styles.content}>
        {/* TAB 1: SELECT SOLAR INSTALLATION AREA (Primary Action) */}
        {activeTab === 'select_area' && (
          <div className={styles.tabPane}>
            <div className={styles.sectionCard}>
              <span className={styles.cardTitle}>Choose Solar Installation Area</span>
              <p className={styles.cardDesc}>
                Select the exact region of the roof to make available for solar panel layout in Phase 5.
              </p>

              {/* Selection Actions Buttons */}
              <div className={styles.selectionBtnGroup}>
                <button
                  className={`${styles.toolBtn} ${toolMode === 'draw_selection' ? styles.toolBtnActive : ''}`}
                  onClick={() =>
                    dispatch({
                      type: 'SET_TOOL_MODE',
                      payload: toolMode === 'draw_selection' ? 'view' : 'draw_selection',
                    })
                  }
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span>{toolMode === 'draw_selection' ? 'Exit Drawing' : 'Draw Custom Area'}</span>
                </button>

                <button
                  className={styles.recommendBtn}
                  onClick={() => dispatch({ type: 'RECOMMEND_BEST_AREA' })}
                  title="Generate best candidate area maximizing solar access and avoiding obstacles"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span>Recommend Best Area</span>
                </button>
              </div>

              {/* Active Selection Details Card */}
              {selectedArea ? (
                <div className={styles.selectedAreaCard}>
                  <div className={styles.selectedHeader}>
                    <div>
                      <strong className={styles.selectedTitle}>Selected Solar Installation Area</strong>
                      <span className={styles.selectionMethodBadge}>
                        {selectedArea.selectionMethod === 'recommended' && '✨ System Recommendation'}
                        {selectedArea.selectionMethod === 'manual' && '✏️ User-Drawn Boundary'}
                        {selectedArea.selectionMethod === 'manual-edited-recommendation' && '🔧 Custom Adjusted'}
                      </span>
                    </div>
                    <span className={`${styles.zoneBadge} ${styles[selectedArea.solarZone.toLowerCase()]}`}>
                      {selectedArea.solarZone} Solar Quality
                    </span>
                  </div>

                  <div className={styles.selectedStatsGrid}>
                    <div className={styles.selectedStatBox}>
                      <span className={styles.statLabel}>Available Area</span>
                      <strong className={styles.statHighlight}>{selectedAreaFormatted?.sqMeters}</strong>
                      <span className={styles.statSub}>{selectedAreaFormatted?.sqFeet}</span>
                    </div>

                    <div className={styles.selectedStatBox}>
                      <span className={styles.statLabel}>Avg Solar Access</span>
                      <strong className={styles.statGreen}>{selectedArea.avgSolarAccessPct}%</strong>
                      <span className={styles.statSub}>Sun Exposure</span>
                    </div>

                    <div className={styles.selectedStatBox}>
                      <span className={styles.statLabel}>Shading Impact</span>
                      <strong>{selectedArea.avgShadingLossPct}%</strong>
                      <span className={styles.statSub}>Obstacle Loss</span>
                    </div>

                    <div className={styles.selectedStatBox}>
                      <span className={styles.statLabel}>Obstacle Conflicts</span>
                      <strong className={selectedArea.obstacleConflicts > 0 ? styles.statRed : styles.statGreen}>
                        {selectedArea.obstacleConflicts}
                      </strong>
                      <span className={styles.statSub}>{selectedArea.obstacleConflicts === 0 ? 'Clear of Obstacles' : 'Overlaps Detected'}</span>
                    </div>
                  </div>

                  {/* Obstacle conflict alert */}
                  {selectedArea.obstacleConflicts > 0 && (
                    <div className={styles.conflictAlert}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>
                        The selected area overlaps {selectedArea.obstacleConflicts} rooftop obstacle(s). Please edit or reshape the boundary to clear obstructions before continuing to panel layout.
                      </span>
                    </div>
                  )}

                  {/* Edit / Clear Actions */}
                  <div className={styles.selectedActionsRow}>
                    <button
                      className={styles.editAreaBtn}
                      onClick={() =>
                        dispatch({
                          type: 'SET_TOOL_MODE',
                          payload: toolMode === 'edit_selection' ? 'view' : 'edit_selection',
                        })
                      }
                    >
                      {toolMode === 'edit_selection' ? 'Exit Editing' : '🔧 Reshape Area'}
                    </button>
                    <button
                      className={styles.clearAreaBtn}
                      onClick={() => dispatch({ type: 'CLEAR_SELECTED_AREA' })}
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.noSelectionPrompt}>
                  <span className={styles.promptIcon}>📐</span>
                  <strong>No Installation Area Selected</strong>
                  <p>
                    Draw your preferred solar area on the rooftop map, or click <strong>Recommend Best Area</strong> to generate an optimal obstacle-free zone.
                  </p>
                </div>
              )}
            </div>

            {/* Strict Area Hierarchy Validation Card */}
            <div className={styles.sectionCard}>
              <span className={styles.cardTitle}>Area Hierarchy & Suitability</span>
              <div className={styles.hierarchyList}>
                <div className={styles.hierarchyItem}>
                  <span>1. Gross Roof Boundary</span>
                  <strong>{grossAreaFormatted.sqMeters}</strong>
                </div>
                <div className={styles.hierarchyItem}>
                  <span>2. Physical Usable Area (Obstacles Deducted)</span>
                  <strong>{physicalAreaFormatted.sqMeters}</strong>
                </div>
                <div className={styles.hierarchyItem}>
                  <span>3. Solar-Effective Area (High/Med Sun)</span>
                  <strong className={styles.effectiveVal}>{effectiveAreaFormatted.sqMeters}</strong>
                </div>
                <div className={`${styles.hierarchyItem} ${styles.hierarchySelected}`}>
                  <span>4. Your Selected Solar Area</span>
                  <strong className={styles.selectedVal}>
                    {selectedArea ? selectedAreaFormatted?.sqMeters : 'None'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className={styles.tabPane}>
            {/* Key Metrics Grid */}
            <div className={styles.sectionCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Solar Resource & Access</span>
                <span className={`${styles.potentialBadge} ${styles[analysis.overallClassification.toLowerCase()]}`}>
                  {analysis.overallClassification} POTENTIAL
                </span>
              </div>

              <div className={styles.statGrid}>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Solar Access</span>
                  <span className={`${styles.statValue} ${styles.statSolar}`}>
                    {analysis.avgSolarAccessPct}%
                  </span>
                  <span className={styles.statSub}>Avg Daylight Exposure</span>
                </div>

                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Shading Losses</span>
                  <span className={`${styles.statValue} ${analysis.avgShadingImpactPct > 20 ? styles.statLossHigh : ''}`}>
                    {analysis.avgShadingImpactPct}%
                  </span>
                  <span className={styles.statSub}>Obstacle Occlusion</span>
                </div>

                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Annual Irradiance</span>
                  <span className={styles.statValue}>
                    {analysis.resourceData.annualGhi}
                  </span>
                  <span className={styles.statSub}>kWh/m²/year (GHI)</span>
                </div>

                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Peak Sun Hours</span>
                  <span className={styles.statValue}>
                    {analysis.peakSunHoursAnnual} hrs
                  </span>
                  <span className={styles.statSub}>Daily Average PSH</span>
                </div>
              </div>
            </div>

            {/* Analysis Confidence */}
            <div className={styles.sectionCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Analysis Confidence</span>
                <span className={`${styles.confidenceTag} ${styles[analysis.confidenceScore.toLowerCase()]}`}>
                  {analysis.confidenceScore} CONFIDENCE
                </span>
              </div>

              <div className={styles.confidenceList}>
                <div className={styles.factorItem}>
                  <span className={analysis.confidenceFactors.solarDataAvailable ? styles.checkIcon : styles.warnIcon}>
                    {analysis.confidenceFactors.solarDataAvailable ? '✓' : '⚠️'}
                  </span>
                  <span>Solar resource dataset active ({analysis.resourceData.provider})</span>
                </div>

                <div className={styles.factorItem}>
                  <span className={analysis.confidenceFactors.roofGeometryAccurate ? styles.checkIcon : styles.warnIcon}>
                    {analysis.confidenceFactors.roofGeometryAccurate ? '✓' : 'ℹ️'}
                  </span>
                  <span>Rooftop boundary validated ({rooftop.source.replace(/_/g, ' ')})</span>
                </div>

                <div className={styles.factorItem}>
                  <span className={analysis.confidenceFactors.obstacleHeightsKnown ? styles.checkIcon : styles.warnIcon}>
                    {analysis.confidenceFactors.obstacleHeightsKnown ? '✓' : '⚠️'}
                  </span>
                  <span>
                    {analysis.confidenceFactors.obstacleHeightsKnown
                      ? 'Obstacle 3D heights confirmed'
                      : 'Default height assumptions used (1.5m)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ASSUMPTIONS & PROVENANCE (DYNAMIC) */}
        {activeTab === 'assumptions' && (
          <div className={styles.tabPane}>
            <div className={styles.sectionCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Model Parameters & Assumptions</span>
                <button
                  className={styles.resetBtn}
                  onClick={() => dispatch({ type: 'UPDATE_ASSUMPTIONS', payload: DEFAULT_SOLAR_ASSUMPTIONS })}
                  title="Reset assumptions to default standards"
                >
                  Reset Defaults
                </button>
              </div>
              <p className={styles.cardDesc}>
                Adjust solar thresholds and physical loss assumptions. Metrics and effective area recalculate live.
              </p>

              <div className={styles.assumptionsTable}>
                <div className={styles.assumptionRow}>
                  <span>Data Provider</span>
                  <strong>{analysis.resourceData.provider}</strong>
                </div>
                <div className={styles.assumptionRow}>
                  <span>Satellite Dataset</span>
                  <strong>{analysis.resourceData.dataset}</strong>
                </div>
                <div className={styles.assumptionRow}>
                  <span>Geospatial Resolution</span>
                  <strong>{analysis.resourceData.resolution}</strong>
                </div>
                <div className={styles.assumptionRow}>
                  <label htmlFor="input-high-threshold">High Potential Threshold (%)</label>
                  <input
                    id="input-high-threshold"
                    type="number"
                    min="50"
                    max="95"
                    value={analysis.assumptions.highThresholdPct}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_ASSUMPTIONS',
                        payload: { highThresholdPct: Number(e.target.value) },
                      })
                    }
                    className={styles.numInput}
                  />
                </div>
                <div className={styles.assumptionRow}>
                  <label htmlFor="input-med-threshold">Medium Potential Threshold (%)</label>
                  <input
                    id="input-med-threshold"
                    type="number"
                    min="30"
                    max="80"
                    value={analysis.assumptions.mediumThresholdPct}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_ASSUMPTIONS',
                        payload: { mediumThresholdPct: Number(e.target.value) },
                      })
                    }
                    className={styles.numInput}
                  />
                </div>
                <div className={styles.assumptionRow}>
                  <label htmlFor="input-obstacle-height">Default Obstacle Height (m)</label>
                  <input
                    id="input-obstacle-height"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={analysis.assumptions.defaultObstacleHeightMeters}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_ASSUMPTIONS',
                        payload: { defaultObstacleHeightMeters: Number(e.target.value) },
                      })
                    }
                    className={styles.numInput}
                  />
                </div>
                <div className={styles.assumptionRow}>
                  <label htmlFor="input-ground-albedo">Ground Albedo (0.0 – 1.0)</label>
                  <input
                    id="input-ground-albedo"
                    type="number"
                    step="0.05"
                    min="0.05"
                    max="0.8"
                    value={analysis.assumptions.albedoGroundReflectance}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_ASSUMPTIONS',
                        payload: { albedoGroundReflectance: Number(e.target.value) },
                      })
                    }
                    className={styles.numInput}
                  />
                </div>
                <div className={styles.assumptionRow}>
                  <label htmlFor="input-soiling-loss">Soiling Loss (%)</label>
                  <input
                    id="input-soiling-loss"
                    type="number"
                    step="0.5"
                    min="0"
                    max="20"
                    value={analysis.assumptions.soilingLossAssumptionPct}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_ASSUMPTIONS',
                        payload: { soilingLossAssumptionPct: Number(e.target.value) },
                      })
                    }
                    className={styles.numInput}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className={styles.footer}>
        <button
          className={styles.proceedBtn}
          onClick={onProceedToOptimization}
          disabled={!isSelectionReady}
          title={isSelectionReady ? 'Proceed to Phase 5 PV Module Packing' : 'Please select a valid installation area to continue'}
        >
          <span>Continue to Panel Optimization</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
