import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  CircleMarker,
  Tooltip,
  useMap,
  ScaleControl,
} from 'react-leaflet';
import L from 'leaflet';
import { useOptimization } from '@/context/OptimizationContext';
import { getStreetTileConfig, getSatelliteTileConfig } from '@/services/satelliteLayerService';
import { getObstacleCategory } from '@/data/obstacleCategories';
import type { MapLayerType } from '@/types/index.js';
import type { Rooftop } from '@/types/rooftop.js';
import type { SolarAnalysis } from '@/types/solar.js';
import 'leaflet/dist/leaflet.css';
import styles from './OptimizationMap.module.css';

// Fix Leaflet default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Map Bridge to auto-fit bounds on mount
function MapInstanceBridge({
  rooftop,
  onMapReady,
}: {
  rooftop: Rooftop | null;
  onMapReady: (map: L.Map) => void;
}) {
  const map = useMap();
  const initialFittedRef = useRef(false);

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  useEffect(() => {
    if (rooftop && !initialFittedRef.current) {
      initialFittedRef.current = true;
      const [south, north, west, east] = rooftop.boundingBox;
      map.fitBounds([[south, west], [north, east]], { padding: [70, 70], maxZoom: 21 });
    }
  }, [map, rooftop]);

  return null;
}

export function OptimizationMap({
  rooftop,
  solarAnalysis,
}: {
  rooftop: Rooftop | null;
  solarAnalysis: SolarAnalysis | null;
}) {
  const { state, dispatch, activeLayout } = useOptimization();
  const {
    selectedPanelId,
    toolMode,
    showPanels,
    showRoofBoundary,
    showObstacles,
    showSolarLayer,
    showSelectedArea,
  } = state;

  const [activeLayer, setActiveLayer] = useState<MapLayerType>('satellite');
  const streetConfig = getStreetTileConfig();
  const satConfig = getSatelliteTileConfig();
  const mapInstanceRef = useRef<L.Map | null>(null);

  const mapCenter: [number, number] = rooftop
    ? [rooftop.centroid.lat, rooftop.centroid.lng]
    : [20, 0];
  const mapZoom = rooftop ? 19 : 2;

  // Fit bounds helper
  const handleFitToRoof = useCallback(() => {
    if (!rooftop || !mapInstanceRef.current) return;
    const [south, north, west, east] = rooftop.boundingBox;
    mapInstanceRef.current.fitBounds([[south, west], [north, east]], { padding: [60, 60], maxZoom: 21 });
  }, [rooftop]);

  // Recenter helper
  const handleRecenter = useCallback(() => {
    if (!rooftop || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([rooftop.centroid.lat, rooftop.centroid.lng], 20, { duration: 0.8 });
  }, [rooftop]);

  // Roof polygon coordinates formatted for Leaflet [lat, lng][]
  const roofLatLngs: [number, number][] = useMemo(() => {
    if (!rooftop) return [];
    const ring = rooftop.geometry.coordinates[0] as [number, number][];
    return ring.map(([lng, lat]) => [lat, lng]);
  }, [rooftop]);

  // Selected area coordinates formatted for Leaflet [lat, lng][]
  const selectedAreaLatLngs: [number, number][] = useMemo(() => {
    if (!solarAnalysis?.selectedArea) return [];
    const ring = solarAnalysis.selectedArea.geometry.coordinates[0] as [number, number][];
    return ring.map(([lng, lat]) => [lat, lng]);
  }, [solarAnalysis]);

  return (
    <div className={styles.mapContainer}>
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        maxZoom={22}
        className={styles.map}
        zoomControl={false}
        attributionControl={true}
      >
        {/* Tile Layers */}
        {activeLayer === 'street' && (
          <TileLayer
            url={streetConfig.url}
            attribution={streetConfig.attribution}
            maxZoom={streetConfig.maxZoom}
            maxNativeZoom={streetConfig.maxNativeZoom}
          />
        )}
        {activeLayer === 'satellite' && satConfig.available && (
          <TileLayer
            url={satConfig.url}
            attribution={satConfig.attribution}
            maxZoom={satConfig.maxZoom}
            maxNativeZoom={satConfig.maxNativeZoom}
          />
        )}
        {activeLayer === 'satellite' && !satConfig.available && (
          <TileLayer
            url={streetConfig.url}
            attribution={streetConfig.attribution}
            maxZoom={streetConfig.maxZoom}
            maxNativeZoom={streetConfig.maxNativeZoom}
          />
        )}

        <ScaleControl position="bottomleft" />

        <MapInstanceBridge
          rooftop={rooftop}
          onMapReady={(map) => {
            mapInstanceRef.current = map;
          }}
        />

        {/* 1. ROOF BOUNDARY OUTLINE */}
        {showRoofBoundary && roofLatLngs.length >= 3 && (
          <Polygon
            positions={roofLatLngs}
            pathOptions={{
              color: 'var(--color-solar, #f59e0b)',
              weight: 3,
              fillColor: 'transparent',
              fillOpacity: 0,
            }}
          />
        )}

        {/* 2. SUBTLE SOLAR EFFECTIVE ZONE */}
        {showSolarLayer && roofLatLngs.length >= 3 && (
          <Polygon
            positions={roofLatLngs}
            pathOptions={{
              color: 'transparent',
              weight: 0,
              fillColor: '#10b981',
              fillOpacity: 0.15,
            }}
          />
        )}

        {/* 3. PHASE 4 SELECTED SOLAR INSTALLATION AREA */}
        {showSelectedArea && selectedAreaLatLngs.length >= 3 && (
          <Polygon
            positions={selectedAreaLatLngs}
            pathOptions={{
              color: '#06b6d4',
              weight: 2,
              dashArray: '5, 5',
              fillColor: 'rgba(6, 182, 212, 0.12)',
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="top" opacity={0.9}>
              <span>Selected Installation Scope</span>
            </Tooltip>
          </Polygon>
        )}

        {/* 4. OBSTACLES */}
        {showObstacles &&
          rooftop?.obstacles.map((obs) => {
            if (obs.status === 'rejected') return null;
            const cat = getObstacleCategory(obs.type);

            if (obs.geometryKind === 'point' && obs.geometry.type === 'Point') {
              const [lng, lat] = obs.geometry.coordinates;
              return (
                <CircleMarker
                  key={`obs-${obs.id}`}
                  center={[lat, lng]}
                  radius={6}
                  pathOptions={{
                    color: '#fff',
                    weight: 2,
                    fillColor: cat.color,
                    fillOpacity: 0.9,
                  }}
                >
                  <Tooltip direction="top">
                    {cat.icon} {obs.label || cat.label} {obs.height ? `(${obs.height}m)` : ''}
                  </Tooltip>
                </CircleMarker>
              );
            }

            if (obs.geometry.type === 'Polygon') {
              const ring = obs.geometry.coordinates[0] as [number, number][];
              const obsLatLngs: [number, number][] = ring.map(([lng, lat]) => [lat, lng]);
              return (
                <Polygon
                  key={`obs-${obs.id}`}
                  positions={obsLatLngs}
                  pathOptions={{
                    color: cat.color,
                    weight: 2,
                    fillColor: cat.color,
                    fillOpacity: 0.70,
                  }}
                >
                  <Tooltip direction="top">
                    {cat.icon} {obs.label || cat.label}
                  </Tooltip>
                </Polygon>
              );
            }

            return null;
          })}

        {/* 5. PHOTOVOLTAIC MODULE INSTANCES */}
        {showPanels &&
          activeLayout?.panels.map((panel) => {
            if (panel.isDeleted) return null;
            const isSelected = selectedPanelId === panel.id;
            const rawRing = panel.geometry.coordinates[0] as [number, number][];
            const panelLatLngs: [number, number][] = rawRing.map(([lng, lat]) => [lat, lng]);

            return (
              <Polygon
                key={panel.id}
                positions={panelLatLngs}
                pathOptions={{
                  color: isSelected ? '#38bdf8' : '#94a3b8',
                  weight: isSelected ? 3 : 1.2,
                  fillColor: isSelected ? '#1e40af' : '#0f172a',
                  fillOpacity: 0.92,
                }}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (toolMode === 'delete') {
                      dispatch({ type: 'DELETE_PANEL', payload: panel.id });
                    } else {
                      dispatch({ type: 'SELECT_PANEL', payload: panel.id });
                    }
                  },
                }}
              >
                <Tooltip direction="top" opacity={0.95}>
                  <div style={{ fontSize: 11.5 }}>
                    <strong>Module #{panel.index}</strong> ({panel.ratedPowerW}W)
                    <br />
                    Orientation: {panel.orientation} • Tilt: {panel.tiltDeg}°
                    <br />
                    Solar Access: {panel.solarAccessPct}% ({panel.solarZone})
                  </div>
                </Tooltip>
              </Polygon>
            );
          })}
      </MapContainer>

      {/* Floating Map Controls */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <button
            className={`${styles.controlBtn} ${activeLayer === 'satellite' ? styles.controlActive : ''}`}
            onClick={() => setActiveLayer('satellite')}
            title="Satellite view"
            aria-label="Satellite view"
          >
            🛰️
          </button>
          <button
            className={`${styles.controlBtn} ${activeLayer === 'street' ? styles.controlActive : ''}`}
            onClick={() => setActiveLayer('street')}
            title="Street view"
            aria-label="Street view"
          >
            🗺️
          </button>
        </div>

        <div className={styles.controlGroup}>
          <button className={styles.controlBtn} onClick={handleFitToRoof} title="Fit to roof bounds" aria-label="Fit to roof">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
          <button className={styles.controlBtn} onClick={handleRecenter} title="Recenter on roof" aria-label="Recenter on roof">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Map Array Legend / Quick Stats HUD */}
      {activeLayout && (
        <div className={styles.hudOverlay}>
          <div className={styles.hudModuleInfo}>
            <span className={styles.hudTitle}>{activeLayout.panelSpec.manufacturer}</span>
            <strong className={styles.hudModel}>{activeLayout.panelSpec.model}</strong>
          </div>
          <div className={styles.hudMetrics}>
            <div>Panels: <strong>{activeLayout.activePanelCount}</strong></div>
            <div>DC Capacity: <strong className={styles.hudGreen}>{activeLayout.systemCapacityKWp} kWp</strong></div>
            <div>Coverage: <strong>{activeLayout.occupiedAreaSqM} m² ({activeLayout.utilizationPct}%)</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}
