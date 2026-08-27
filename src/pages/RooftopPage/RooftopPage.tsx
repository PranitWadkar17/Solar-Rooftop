import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAssessment } from '@/services/assessmentService';
import { loadRooftop, deriveRooftopFromAssessment, saveRooftop } from '@/services/rooftopService';
import { RooftopProvider, useRooftop } from '@/context/RooftopContext';
import { RooftopHeader } from '@/components/Rooftop/RooftopHeader/RooftopHeader';
import { RooftopSidebar } from '@/components/Rooftop/RooftopSidebar/RooftopSidebar';
import { RooftopMap, type ActiveObstacleConfig } from '@/components/Rooftop/RooftopMap/RooftopMap';
import { AddObstacleModal } from '@/components/Rooftop/AddObstacleModal/AddObstacleModal';
import { FirstTimeGuidance } from '@/components/Rooftop/FirstTimeGuidance/FirstTimeGuidance';
import { UnsavedChangesModal } from '@/components/Rooftop/UnsavedChangesModal/UnsavedChangesModal';
import type { ObstacleType, ObstacleGeometryKind, Rooftop } from '@/types/rooftop.js';
import styles from './RooftopPage.module.css';

function RooftopWorkspaceInner() {
  const navigate = useNavigate();
  const { state, dispatch } = useRooftop();
  const { rooftop, isDirty, saveStatus, showFirstTimeGuide } = state;

  const [showAddObstacleModal, setShowAddObstacleModal] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [activeObstacleConfig, setActiveObstacleConfig] = useState<ActiveObstacleConfig | null>(null);

  // Handle Back Navigation with unsaved changes protection
  const handleBackClick = useCallback(() => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      navigate('/assessment');
    }
  }, [isDirty, navigate]);

  const handleSaveAndLeave = useCallback(() => {
    if (rooftop) {
      saveRooftop(rooftop);
    }
    setShowUnsavedModal(false);
    navigate('/assessment');
  }, [rooftop, navigate]);

  const handleDiscardAndLeave = useCallback(() => {
    setShowUnsavedModal(false);
    navigate('/assessment');
  }, [navigate]);

  // Handle Redraw Boundary
  const handleRedrawBoundary = useCallback(() => {
    dispatch({ type: 'CLEAR_DRAWING_POINTS' });
    dispatch({ type: 'SET_TOOL_MODE', payload: 'draw_roof' });
  }, [dispatch]);

  // Handle Add Obstacle modal submit -> trigger drawing tool
  const handleStartDrawingObstacle = useCallback(
    (type: ObstacleType, geometryKind: ObstacleGeometryKind, clearance: number, height: number | null) => {
      setShowAddObstacleModal(false);
      setActiveObstacleConfig({ type, geometryKind, clearance, height });
      dispatch({ type: 'CLEAR_DRAWING_POINTS' });

      if (geometryKind === 'point') {
        dispatch({ type: 'SET_TOOL_MODE', payload: 'draw_obstacle_point' });
      } else if (geometryKind === 'rectangle') {
        dispatch({ type: 'SET_TOOL_MODE', payload: 'draw_obstacle_rect' });
      } else {
        dispatch({ type: 'SET_TOOL_MODE', payload: 'draw_obstacle_polygon' });
      }
    },
    [dispatch]
  );

  // Proceed to Phase 4
  const handleProceedToSolar = useCallback(() => {
    if (rooftop) {
      saveRooftop(rooftop);
    }
    navigate('/assessment/solar');
  }, [rooftop, navigate]);

  return (
    <div className={styles.workspace}>
      <RooftopHeader
        assessmentId={rooftop?.assessmentId ?? null}
        saveStatus={saveStatus}
        onBackClick={handleBackClick}
      />

      <main className={styles.mainArea}>
        {/* Left Sidebar */}
        <RooftopSidebar
          onOpenAddObstacle={() => setShowAddObstacleModal(true)}
          onRedrawBoundary={handleRedrawBoundary}
          onProceedToSolar={handleProceedToSolar}
        />

        {/* Right Map View */}
        <div className={styles.mapWrapper}>
          <RooftopMap
            onOpenAddObstacleModal={() => setShowAddObstacleModal(true)}
            activeObstacleConfig={activeObstacleConfig}
            setActiveObstacleConfig={setActiveObstacleConfig}
          />
        </div>
      </main>

      {/* Add Obstacle Modal */}
      {showAddObstacleModal && (
        <AddObstacleModal
          onStartDrawing={handleStartDrawingObstacle}
          onCancel={() => setShowAddObstacleModal(false)}
        />
      )}

      {/* First Time Guidance Modal */}
      {showFirstTimeGuide && (
        <FirstTimeGuidance onDismiss={() => dispatch({ type: 'DISMISS_GUIDE' })} />
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <UnsavedChangesModal
          onSaveAndLeave={handleSaveAndLeave}
          onDiscardAndLeave={handleDiscardAndLeave}
          onCancel={() => setShowUnsavedModal(false)}
        />
      )}
    </div>
  );
}

export function RooftopPage() {
  const navigate = useNavigate();
  const assessment = loadAssessment();

  // Load or derive initial rooftop
  const initialRooftop: Rooftop | null = useMemo(() => {
    if (!assessment || !assessment.assessmentId) return null;
    const existing = loadRooftop(assessment.assessmentId);
    if (existing) return existing;
    return deriveRooftopFromAssessment(assessment);
  }, [assessment]);

  // If no valid assessment or site not chosen
  if (!assessment || !assessment.assessmentId || (!assessment.selectedBuildingGeometry && assessment.selectedLatitude === null)) {
    return (
      <div className={styles.notFoundPage}>
        <div className={styles.notFoundCard}>
          <div className={styles.notFoundIcon}>📍</div>
          <h2 className={styles.notFoundTitle}>Assessment Not Found</h2>
          <p className={styles.notFoundText}>
            No confirmed location or rooftop building was found in your active session. Please start by searching and selecting your site on the map.
          </p>
          <button className={styles.returnBtn} onClick={() => navigate('/assessment')}>
            Return to Location Selection
          </button>
        </div>
      </div>
    );
  }

  return (
    <RooftopProvider initialRooftop={initialRooftop}>
      <RooftopWorkspaceInner />
    </RooftopProvider>
  );
}
