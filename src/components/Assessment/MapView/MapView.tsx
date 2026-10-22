import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
  Polyline,
  Polygon,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
  ScaleControl,
} from 'react-leaflet';
import L from 'leaflet';
import type { MapLayerType, BuildingFootprint } from '@/types/index.js';
import { getStreetTileConfig, getSatelliteTileConfig, getDefaultMapCenter } from '@/services/satelliteLayerService';
import { createCustomFootprint } from '@/services/buildingService';
import { calculatePolygonArea, formatArea } from '@/utils/geoUtils';
import 'leaflet/dist/leaflet.css';
import styles from './MapView.module.css';

// Fix Leaflet default icon issue with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom Solar marker icon
const solarMarkerIcon = L.divIcon({
  className: 'solar-marker',
  html: `<div style="
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--color-solar, #f59e0b);
    border: 3px solid #fff;
    box-shadow: 0 0 16px rgba(245, 158, 11, 0.6), 0 2px 8px rgba(0,0,0,0.3);
    position: relative;
  "><div style="
    position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%);
    width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent;
    border-top: 8px solid var(--color-solar, #f59e0b);
  "></div></div>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -36],
});

// --- Map controller component ---
function MapController({
  flyToTarget,
  onMapClick,
  isDrawingMode,
  onAddVertex,
}: {
  flyToTarget: { lat: number; lng: number; zoom: number; boundingBox?: [number, number, number, number] | null } | null;
  onMapClick: (lat: number, lng: number) => void;
  isDrawingMode: boolean;
  onAddVertex: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const lastFlyRef = useRef<string>('');

  useEffect(() => {
    if (!flyToTarget) return;
    const key = `${flyToTarget.lat},${flyToTarget.lng},${flyToTarget.zoom}`;
    if (key === lastFlyRef.current) return;
    lastFlyRef.current = key;

    if (flyToTarget.boundingBox) {
      const [south, north, west, east] = flyToTarget.boundingBox;
      map.flyToBounds(
        [[south, west], [north, east]],
        { padding: [50, 50], duration: 1.5, maxZoom: 18 }
      );
    } else {
      map.flyTo([flyToTarget.lat, flyToTarget.lng], flyToTarget.zoom, { duration: 1.5 });
    }
  }, [map, flyToTarget]);

  useMapEvents({
    click: (e) => {
      if (isDrawingMode) {
        onAddVertex(e.latlng.lat, e.latlng.lng);
      } else {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  return null;
}

// --- Map controls bridge: listens for custom events and controls the map ---
function MapControls() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    const handleZoomIn = () => map.zoomIn();
    const handleZoomOut = () => map.zoomOut();
    const handleRecenter = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.lat != null && detail?.lng != null) {
        map.flyTo([detail.lat, detail.lng], detail.zoom ?? 18, { duration: 1 });
      }
    };

    container.addEventListener('map:zoomIn', handleZoomIn);
    container.addEventListener('map:zoomOut', handleZoomOut);
    container.addEventListener('map:recenter', handleRecenter);

    return () => {
      container.removeEventListener('map:zoomIn', handleZoomIn);
      container.removeEventListener('map:zoomOut', handleZoomOut);
      container.removeEventListener('map:recenter', handleRecenter);
    };
  }, [map]);

  return null;
}

// --- Main MapView ---
interface MapViewProps {
  selectedLat: number | null;
  selectedLng: number | null;
  selectedAddress: string | null;
  flyToTarget: { lat: number; lng: number; zoom: number; boundingBox?: [number, number, number, number] | null } | null;
  activeLayer: MapLayerType;
  onLayerChange: (layer: MapLayerType) => void;
  onMapClick: (lat: number, lng: number) => void;
  buildings: BuildingFootprint[];
  selectedBuildingId: string | null;
  onBuildingClick: (building: BuildingFootprint) => void;
  isDrawingMode: boolean;
  onToggleDrawingMode: () => void;
  onCustomBuildingCreated: (building: BuildingFootprint) => void;
}

export function MapView({
  selectedLat,
  selectedLng,
  selectedAddress,
  flyToTarget,
  activeLayer,
  onLayerChange,
  onMapClick,
  buildings,
  selectedBuildingId,
  onBuildingClick,
  isDrawingMode,
  onToggleDrawingMode,
  onCustomBuildingCreated,
}: MapViewProps) {
  const defaults = getDefaultMapCenter();
  const streetConfig = getStreetTileConfig();
  const satConfig = getSatelliteTileConfig();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Helper to dispatch custom events to the Leaflet map container
  const dispatchMapEvent = useCallback((eventName: string, detail?: Record<string, unknown>) => {
    const leafletEl = mapContainerRef.current?.querySelector('.leaflet-container');
    if (leafletEl) {
      leafletEl.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
  }, []);

  // Manual polygon vertices in [lat, lng]
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);

  // Handle vertex addition
  const handleAddVertex = useCallback((lat: number, lng: number) => {
    setDrawingPoints((prev) => [...prev, [lat, lng]]);
  }, []);

  // Handle undo vertex
  const handleUndoVertex = useCallback(() => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  }, []);

  // Handle complete custom polygon
  const handleCompleteDrawing = useCallback(() => {
    if (drawingPoints.length < 3) return;
    try {
      // Convert [lat, lng] to GeoJSON format [lng, lat]
      const geoCoords: [number, number][] = drawingPoints.map(([lat, lng]) => [lng, lat]);
      const customBuilding = createCustomFootprint(geoCoords);
      onCustomBuildingCreated(customBuilding);
      setDrawingPoints([]);
    } catch (e) {
      console.error('Error finalizing custom polygon:', e);
    }
  }, [drawingPoints, onCustomBuildingCreated]);

  const handleCancelDrawing = useCallback(() => {
    setDrawingPoints([]);
    onToggleDrawingMode();
  }, [onToggleDrawingMode]);

  // Live area calculation for drawn points
  const liveDrawnArea = useMemo(() => {
    if (!isDrawingMode || drawingPoints.length < 3) return null;
    const geoCoords: [number, number][] = drawingPoints.map(([lat, lng]) => [lng, lat]);
    const area = calculatePolygonArea(geoCoords);
    return formatArea(area);
  }, [isDrawingMode, drawingPoints]);

  // GeoJSON style for building footprints
  const buildingStyle = useCallback(
    (feature: GeoJSON.Feature | undefined) => {
      if (!feature) return {};
      const isSelected = feature.properties?.id === selectedBuildingId;
      return {
        color: isSelected ? 'var(--color-solar, #f59e0b)' : '#38bdf8',
        weight: isSelected ? 3.5 : 1.5,
        fillColor: isSelected ? 'rgba(245, 158, 11, 0.45)' : 'rgba(56, 189, 248, 0.18)',
        fillOpacity: 1,
        className: styles.buildingPath,
      };
    },
    [selectedBuildingId]
  );

  // Convert buildings to GeoJSON FeatureCollection
  const buildingsGeoJson = useMemo(() => {
    if (buildings.length === 0) return null;
    return {
      type: 'FeatureCollection' as const,
      features: buildings.map((b) => ({
        type: 'Feature' as const,
        properties: {
          id: b.id,
          name: b.properties.name,
          buildingType: b.properties.buildingType,
          area: b.properties.area,
          levels: b.properties.levels,
        },
        geometry: b.geometry,
      })),
    };
  }, [buildings]);

  // Handle interactive events on each building polygon (hover + click)
  const onEachBuilding = useCallback(
    (feature: GeoJSON.Feature, layer: L.Layer) => {
      const building = buildings.find((b) => b.id === feature.properties?.id);
      if (!building) return;

      const pathLayer = layer as L.Path;

      // Tooltip on hover
      const areaDisplay = building.properties.area ? formatArea(building.properties.area).display : 'Area calculating...';
      const buildingTitle = building.properties.name || building.properties.buildingType || 'Building Footprint';

      pathLayer.bindTooltip(
        `<div style="font-family: inherit; padding: 2px;">
          <strong style="color: #f59e0b; display: block; font-size: 12px; margin-bottom: 2px;">${buildingTitle}</strong>
          <span style="font-size: 11px; color: #e2e8f0; font-weight: 500;">📐 ${areaDisplay}</span>
          ${building.properties.levels ? `<span style="font-size: 10px; color: #94a3b8; display: block; margin-top: 2px;">Floors: ${building.properties.levels}</span>` : ''}
          <span style="font-size: 10px; color: #38bdf8; display: block; margin-top: 4px;">Click to select rooftop</span>
        </div>`,
        {
          sticky: true,
          direction: 'top',
          className: styles.customTooltip,
          opacity: 0.95,
        }
      );

      // Mouseover highlight
      pathLayer.on('mouseover', () => {
        if (building.id !== selectedBuildingId) {
          pathLayer.setStyle({
            color: '#f59e0b',
            weight: 2.5,
            fillColor: 'rgba(245, 158, 11, 0.3)',
            fillOpacity: 0.9,
          });
        }
      });

      // Mouseout reset
      pathLayer.on('mouseout', () => {
        if (building.id !== selectedBuildingId) {
          pathLayer.setStyle({
            color: '#38bdf8',
            weight: 1.5,
            fillColor: 'rgba(56, 189, 248, 0.18)',
            fillOpacity: 1,
          });
        }
      });

      // Click selection
      pathLayer.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (!isDrawingMode) {
          onBuildingClick(building);
        }
      });
    },
    [buildings, selectedBuildingId, onBuildingClick, isDrawingMode]
  );

  return (
    <div ref={mapContainerRef} className={`${styles.mapContainer} ${isDrawingMode ? styles.drawingActive : ''}`}>
      <MapContainer
        center={[defaults.lat, defaults.lng]}
        zoom={defaults.zoom}
        maxZoom={22}
        className={styles.map}
        zoomControl={false}
        attributionControl={true}
      >
        {/* Tile layers */}
        {activeLayer === 'street' && (
          <TileLayer url={streetConfig.url} attribution={streetConfig.attribution} maxZoom={streetConfig.maxZoom} maxNativeZoom={streetConfig.maxNativeZoom} />
        )}
        {activeLayer === 'satellite' && satConfig.available && (
          <TileLayer url={satConfig.url} attribution={satConfig.attribution} maxZoom={satConfig.maxZoom} maxNativeZoom={satConfig.maxNativeZoom} />
        )}
        {activeLayer === 'satellite' && !satConfig.available && (
          <TileLayer url={streetConfig.url} attribution={streetConfig.attribution} maxZoom={streetConfig.maxZoom} maxNativeZoom={streetConfig.maxNativeZoom} />
        )}

        {/* Controls */}
        <ScaleControl position="bottomleft" />

        {/* Map event handler */}
        <MapController
          flyToTarget={flyToTarget}
          onMapClick={onMapClick}
          isDrawingMode={isDrawingMode}
          onAddVertex={handleAddVertex}
        />

        {/* Map controls bridge (zoom/recenter via custom events) */}
        <MapControls />

        {/* Selected location marker */}
        {selectedLat !== null && selectedLng !== null && !isDrawingMode && (
          <Marker position={[selectedLat, selectedLng]} icon={solarMarkerIcon}>
            <Popup>
              <div style={{ minWidth: 140 }}>
                <strong style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                  {selectedAddress || 'Selected Location'}
                </strong>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
                  {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Building footprints */}
        {buildingsGeoJson && (
          <GeoJSON
            key={JSON.stringify(buildingsGeoJson).substring(0, 100) + '-' + selectedBuildingId}
            data={buildingsGeoJson}
            style={buildingStyle}
            onEachFeature={onEachBuilding}
          />
        )}

        {/* Manual drawing elements */}
        {isDrawingMode && (
          <>
            {/* Drawn vertices */}
            {drawingPoints.map(([lat, lng], idx) => (
              <CircleMarker
                key={`vertex-${idx}-${lat}-${lng}`}
                center={[lat, lng]}
                radius={idx === 0 ? 7 : 5}
                pathOptions={{
                  color: '#fff',
                  weight: 2,
                  fillColor: idx === 0 ? 'var(--color-green, #10b981)' : 'var(--color-solar, #f59e0b)',
                  fillOpacity: 1,
                }}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    // Clicking on the first vertex with >=3 points completes polygon
                    if (idx === 0 && drawingPoints.length >= 3) {
                      handleCompleteDrawing();
                    }
                  },
                }}
              >
                {idx === 0 && drawingPoints.length >= 3 && (
                  <Tooltip permanent direction="top" className={styles.vertexTooltip}>
                    Click to close
                  </Tooltip>
                )}
              </CircleMarker>
            ))}

            {/* Polyline connecting vertices */}
            {drawingPoints.length >= 2 && (
              <Polyline
                positions={drawingPoints}
                pathOptions={{
                  color: 'var(--color-solar, #f59e0b)',
                  weight: 3,
                  dashArray: '6, 6',
                }}
              />
            )}

            {/* Preview polygon when >= 3 points */}
            {drawingPoints.length >= 3 && (
              <Polygon
                positions={drawingPoints}
                pathOptions={{
                  color: 'var(--color-solar, #f59e0b)',
                  weight: 2,
                  fillColor: 'rgba(245, 158, 11, 0.35)',
                  fillOpacity: 0.8,
                }}
              />
            )}
          </>
        )}
      </MapContainer>

      {/* Floating Drawing Tool Bar */}
      {isDrawingMode && (
        <div className={styles.drawingToolbar}>
          <div className={styles.drawingInfo}>
            <span className={styles.drawingBadge}>✏️ Drawing Rooftop</span>
            <span className={styles.drawingHint}>
              {drawingPoints.length === 0 && 'Click on rooftop corners on the map to add boundary points'}
              {drawingPoints.length === 1 && 'Click next corner of the rooftop'}
              {drawingPoints.length === 2 && 'Click 3rd point to form a polygon'}
              {drawingPoints.length >= 3 && `${drawingPoints.length} points placed • ${liveDrawnArea?.display || ''}`}
            </span>
          </div>

          <div className={styles.drawingActions}>
            {drawingPoints.length > 0 && (
              <button
                className={styles.drawBtnSecondary}
                onClick={handleUndoVertex}
                title="Undo last point"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
                Undo
              </button>
            )}

            <button
              className={styles.drawBtnPrimary}
              onClick={handleCompleteDrawing}
              disabled={drawingPoints.length < 3}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Complete Boundary ({drawingPoints.length}/3+)
            </button>

            <button
              className={styles.drawBtnCancel}
              onClick={handleCancelDrawing}
              title="Cancel drawing"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Custom map controls overlay */}
      <div className={styles.controls}>
        {/* Zoom controls */}
        <div className={styles.controlGroup}>
          <button
            className={styles.controlBtn}
            onClick={() => dispatchMapEvent('map:zoomIn')}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            className={styles.controlBtn}
            onClick={() => dispatchMapEvent('map:zoomOut')}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* Manual Rooftop Drawing Tool Button */}
        <button
          className={`${styles.controlBtn} ${styles.singleControl} ${isDrawingMode ? styles.controlActive : ''}`}
          onClick={onToggleDrawingMode}
          title={isDrawingMode ? 'Exit drawing mode' : 'Draw custom rooftop boundary'}
          aria-label="Draw rooftop polygon"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>

        {/* Layer switcher */}
        <div className={styles.controlGroup}>
          <button
            className={`${styles.controlBtn} ${activeLayer === 'street' ? styles.controlActive : ''}`}
            onClick={() => onLayerChange('street')}
            title="Street view"
            aria-label="Street map"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          </button>
          <button
            className={`${styles.controlBtn} ${activeLayer === 'satellite' ? styles.controlActive : ''}`}
            onClick={() => onLayerChange(satConfig.available ? 'satellite' : 'street')}
            title={satConfig.available ? 'Satellite view' : 'Satellite unavailable'}
            aria-label="Satellite view"
            disabled={!satConfig.available}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>
        </div>

        {/* Recenter button */}
        {selectedLat !== null && selectedLng !== null && (
          <button
            className={`${styles.controlBtn} ${styles.singleControl}`}
            onClick={() => dispatchMapEvent('map:recenter', { lat: selectedLat, lng: selectedLng, zoom: 18 })}
            title="Recenter to selected location"
            aria-label="Recenter map"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {/* Satellite unavailable notice */}
      {activeLayer === 'satellite' && !satConfig.available && (
        <div className={styles.layerNotice}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          Satellite imagery unavailable. Displaying street map.
        </div>
      )}

      {/* Click hint when nothing is selected and not drawing */}
      {selectedLat === null && !isDrawingMode && (
        <div className={styles.clickHint}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="m13 13 6 6" />
          </svg>
          Click anywhere on the map to select a site location
        </div>
      )}

      {/* Rooftop Selection Prompt when location is chosen but no building selected */}
      {selectedLat !== null && selectedBuildingId === null && !isDrawingMode && (
        <div className={styles.buildingSelectPrompt}>
          <span className={styles.promptDot} />
          <span>
            {buildings.length > 0
              ? `Hover & click any of the ${buildings.length} rooftop polygons to select, or use Draw tool.`
              : 'No auto-detected footprints. Click "Draw Custom Rooftop" to outline your roof.'}
          </span>
        </div>
      )}
    </div>
  );
}
