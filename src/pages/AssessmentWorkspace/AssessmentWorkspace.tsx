import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssessmentProvider, useAssessment } from '@/context/AssessmentContext';
import { AssessmentHeader } from '@/components/Assessment/AssessmentHeader/AssessmentHeader';
import { LocationSearch } from '@/components/Assessment/LocationSearch/LocationSearch';
import { MapView } from '@/components/Assessment/MapView/MapView';
import { SitePanel } from '@/components/Assessment/SitePanel/SitePanel';
import { SiteConfirmation } from '@/components/Assessment/SiteConfirmation/SiteConfirmation';
import { findNearbyBuildings } from '@/services/buildingService';
import { reverseGeocode } from '@/services/geocodingService';
import type { GeocodingResult, BuildingFootprint, MapLayerType } from '@/types/index.js';
import '@/styles/leaflet-overrides.css';
import styles from './AssessmentWorkspace.module.css';

function AssessmentWorkspaceInner() {
  const navigate = useNavigate();
  const { state, dispatch, selectLocation, selectBuilding, confirmSite } = useAssessment();

  const [flyToTarget, setFlyToTarget] = useState<{
    lat: number;
    lng: number;
    zoom: number;
    boundingBox?: [number, number, number, number] | null;
  } | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch nearby buildings whenever a location is selected (do not auto-select any building)
  useEffect(() => {
    if (state.selectedLatitude !== null && state.selectedLongitude !== null) {
      let isCurrent = true;
      findNearbyBuildings(state.selectedLatitude, state.selectedLongitude, 120).then((buildings) => {
        if (isCurrent) {
          dispatch({ type: 'SET_NEARBY_BUILDINGS', payload: buildings });
        }
      });
      return () => {
        isCurrent = false;
      };
    }
  }, [state.selectedLatitude, state.selectedLongitude, dispatch]);

  // Handle Geocoding Search Selection
  const handleSelectSearchResult = useCallback(
    (result: GeocodingResult) => {
      setIsDrawingMode(false);
      selectLocation(
        result.latitude,
        result.longitude,
        result.displayName,
        result.boundingBox,
        'search'
      );
      setFlyToTarget({
        lat: result.latitude,
        lng: result.longitude,
        zoom: 18,
        boundingBox: result.boundingBox,
      });
    },
    [selectLocation]
  );

  // Handle Map Click (sets candidate location without assuming building)
  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      // Set tentative location immediately
      const approxAddress = `Latitude: ${lat.toFixed(5)}, Longitude: ${lng.toFixed(5)}`;
      selectLocation(lat, lng, approxAddress, null, 'map_click');

      // Reverse geocode in background
      try {
        const reverseResult = await reverseGeocode(lat, lng);
        if (reverseResult) {
          selectLocation(lat, lng, reverseResult.displayName, null, 'map_click');
        }
      } catch (e) {
        console.warn('Reverse geocode failed:', e);
      }
    },
    [selectLocation]
  );

  // Handle Use My Location
  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setIsDrawingMode(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setIsLocating(false);

        selectLocation(lat, lng, `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`, null, 'geolocation');
        setFlyToTarget({ lat, lng, zoom: 18 });

        try {
          const rev = await reverseGeocode(lat, lng);
          if (rev) {
            selectLocation(lat, lng, rev.displayName, null, 'geolocation');
          }
        } catch {
          // fallback stays
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        alert('Could not retrieve your location. Please check location permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [selectLocation]);

  // Handle Layer Toggle
  const handleLayerChange = useCallback(
    (layer: MapLayerType) => {
      dispatch({ type: 'SET_MAP_LAYER', payload: layer });
    },
    [dispatch]
  );

  // Handle building click (selects exactly one building)
  const handleBuildingClick = useCallback(
    (building: BuildingFootprint) => {
      setIsDrawingMode(false);
      selectBuilding(building);
    },
    [selectBuilding]
  );

  // Handle manual custom building creation
  const handleCustomBuildingCreated = useCallback(
    (customBuilding: BuildingFootprint) => {
      setIsDrawingMode(false);
      // Append to nearby buildings if not already present
      dispatch({
        type: 'SET_NEARBY_BUILDINGS',
        payload: [customBuilding, ...state.nearbyBuildings.filter((b) => b.id !== customBuilding.id)],
      });
      // Select the custom building
      selectBuilding(customBuilding);
    },
    [dispatch, state.nearbyBuildings, selectBuilding]
  );

  // Toggle drawing mode
  const handleToggleDrawingMode = useCallback(() => {
    setIsDrawingMode((prev) => !prev);
  }, []);

  // Handle Reset / Change Location
  const handleChangeLocation = useCallback(() => {
    setIsDrawingMode(false);
    dispatch({ type: 'UNCONFIRM_SITE' });
  }, [dispatch]);

  // Handle Final Confirmation
  const handleProceedToPhase3 = useCallback(() => {
    setIsSubmitting(true);
    confirmSite();
    setTimeout(() => {
      setIsSubmitting(false);
      setShowConfirmModal(false);
      navigate('/assessment/rooftop');
    }, 400);
  }, [confirmSite, navigate]);

  return (
    <div className={styles.workspace}>
      <AssessmentHeader currentStep={1} assessmentId={state.assessmentId} />

      <main className={styles.mainArea}>
        {/* Left Sidebar */}
        <aside className={styles.sidebar} aria-label="Location selection panel">
          <div className={styles.sidebarContent}>
            <LocationSearch
              onSelectResult={handleSelectSearchResult}
              onUseMyLocation={handleUseMyLocation}
              isLocating={isLocating}
            />

            {state.selectedLatitude !== null && (
              <SitePanel
                state={state}
                onChangeLocation={handleChangeLocation}
                onConfirmSite={() => setShowConfirmModal(true)}
                onDeselectBuilding={() => dispatch({ type: 'DESELECT_BUILDING' })}
                buildingCount={state.nearbyBuildings.length}
                isDrawingMode={isDrawingMode}
                onToggleDrawingMode={handleToggleDrawingMode}
              />
            )}
          </div>
        </aside>

        {/* Map View */}
        <div className={styles.mapWrapper}>
          <MapView
            selectedLat={state.selectedLatitude}
            selectedLng={state.selectedLongitude}
            selectedAddress={state.selectedAddress}
            flyToTarget={flyToTarget}
            activeLayer={state.mapLayer}
            onLayerChange={handleLayerChange}
            onMapClick={handleMapClick}
            buildings={state.nearbyBuildings}
            selectedBuildingId={state.selectedBuildingId}
            onBuildingClick={handleBuildingClick}
            isDrawingMode={isDrawingMode}
            onToggleDrawingMode={handleToggleDrawingMode}
            onCustomBuildingCreated={handleCustomBuildingCreated}
          />
        </div>
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <SiteConfirmation
          state={state}
          onConfirm={handleProceedToPhase3}
          onCancel={() => setShowConfirmModal(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}

export function AssessmentWorkspace() {
  return (
    <AssessmentProvider>
      <AssessmentWorkspaceInner />
    </AssessmentProvider>
  );
}
