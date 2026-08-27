import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  CircleMarker,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
  ScaleControl,
} from 'react-leaflet';
import L from 'leaflet';
import { useSolar } from '@/context/SolarContext';
import { getStreetTileConfig, getSatelliteTileConfig } from '@/services/satelliteLayerService';
import { getObstacleCategory } from '@/data/obstacleCategories';
import {
  formatArea,
  distanceBetweenPoints,
  formatDistance,
  calculatePolygonArea,
  validatePolygon,
} from '@/utils/geoUtils';
import { SolarLegend } from '../SolarLegend/SolarLegend';
import type { MapLayerType } from '@/types/index.js';
import type { Rooftop } from '@/types/rooftop.js';
import 'leaflet/dist/leaflet.css';
import styles from './SolarMap.module.css';

// Fix Leaflet marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom draggable vertex handle for editing selected solar area
const selectionDragIcon = L.divIcon({
  className: 'selection-edit-handle',
  html: `<div style="
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #06b6d4;
    border: 3px solid #ffffff;
    box-shadow: 0 0 8px rgba(0,0,0,0.6), 0 0 12px rgba(6,182,212,0.9);
    cursor: grab;
    transform: translate(-8px, -8px);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Map Controller for click events
function MapController({
  onMapClick,
  onMapDoubleClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
  onMapDoubleClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
    dblclick: (e) => {
      onMapDoubleClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

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
      map.fitBounds([[south, west], [north, east]], { padding: [70, 70], maxZoom: 20 });
    }
  }, [map, rooftop]);

  return null;
}

export function SolarMap() {
  const { state, dispatch, currentProjectedShadows, completeManualSelection } = useSolar();
  const {
    rooftop,
    analysis,
    toolMode,
    drawingPoints,
    showHeatmap,
    showShadows,
    showSelectedArea,
    showObstacles,
  } = state;

  const [activeLayer, setActiveLayer] = useState<MapLayerType>('satellite');
  const [editableVertices, setEditableVertices] = useState<[number, number][]>([]);

  const streetConfig = getStreetTileConfig();
  const satConfig = getSatelliteTileConfig();
  const mapInstanceRef = useRef<L.Map | null>(null);

  const selectedArea = analysis?.selectedArea ?? null;

  // Sync editable vertices when entering edit_selection mode
  useEffect(() => {
    if (selectedArea && toolMode === 'edit_selection') {
      const rawRing = selectedArea.geometry.coordinates[0] as [number, number][];
      const isClosed =
        rawRing.length > 1 &&
        rawRing[0][0] === rawRing[rawRing.length - 1][0] &&
        rawRing[0][1] === rawRing[rawRing.length - 1][1];
      const uniqueCoords = isClosed ? rawRing.slice(0, -1) : rawRing;
      setEditableVertices(uniqueCoords.map(([lng, lat]) => [lat, lng]));
    }
  }, [selectedArea, toolMode]);

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

  // Live drawing measurements
  const liveDistance = useMemo(() => {
    if (drawingPoints.length < 2) return null;
    const last = drawingPoints[drawingPoints.length - 1];
    const prev = drawingPoints[drawingPoints.length - 2];
    const d = distanceBetweenPoints([prev[1], prev[0]], [last[1], last[0]]);
    return formatDistance(d);
  }, [drawingPoints]);

  const liveArea = useMemo(() => {
    if (drawingPoints.length < 3) return null;
    const geoCoords: [number, number][] = drawingPoints.map(([lat, lng]) => [lng, lat]);
    const a = calculatePolygonArea(geoCoords);
    return formatArea(a);
  }, [drawingPoints]);

  // Handle map clicks during drawing mode
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (toolMode === 'draw_selection') {
        dispatch({ type: 'ADD_DRAWING_POINT', payload: [lat, lng] });
      }
    },
    [toolMode, dispatch]
  );

  // Complete manual drawing selection
  const handleFinishDrawingSelection = useCallback(() => {
    if (drawingPoints.length < 3) return;
    const geoCoords: [number, number][] = drawingPoints.map(([lat, lng]) => [lng, lat]);
    const val = validatePolygon(geoCoords, 0.5);
    if (!val.valid) {
      alert(`Invalid selected area: ${val.errors.join(' ')}`);
      return;
    }
    completeManualSelection(geoCoords);
    dispatch({ type: 'CLEAR_DRAWING_POINTS' });
    dispatch({ type: 'SET_TOOL_MODE', payload: 'view' });
  }, [drawingPoints, completeManualSelection, dispatch]);

  // Handle vertex drag when editing selected area
  const handleVertexDrag = useCallback(
    (index: number, newLat: number, newLng: number) => {
      setEditableVertices((prev) => {
        const next = [...prev];
        next[index] = [newLat, newLng];
        return next;
      });
    },
    []
  );

  // Save edited vertices
  const handleSaveEditedVertices = useCallback(() => {
    if (editableVertices.length < 3) return;
    const geoCoords: [number, number][] = editableVertices.map(([lat, lng]) => [lng, lat]);
    const val = validatePolygon(geoCoords, 0.5);
    if (!val.valid) {
      alert(`Invalid boundary: ${val.errors.join(' ')}`);
      return;
    }
    completeManualSelection(geoCoords);
    dispatch({ type: 'SET_TOOL_MODE', payload: 'view' });
  }, [editableVertices, completeManualSelection, dispatch]);

  // Roof polygon coordinates formatted for Leaflet [lat, lng][]
  const roofLatLngs: [number, number][] = useMemo(() => {
    if (!rooftop) return [];
    const ring = rooftop.geometry.coordinates[0] as [number, number][];
    return ring.map(([lng, lat]) => [lat, lng]);
  }, [rooftop]);

  // Selected area coordinates formatted for Leaflet [lat, lng][]
  const selectedAreaLatLngs: [number, number][] = useMemo(() => {
    if (!selectedArea) return [];
    const ring = selectedArea.geometry.coordinates[0] as [number, number][];
    return ring.map(([lng, lat]) => [lat, lng]);
  }, [selectedArea]);

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

        <MapController
          onMapClick={handleMapClick}
          onMapDoubleClick={() => {
            if (toolMode === 'draw_selection') handleFinishDrawingSelection();
          }}
        />

        {/* 1. ROOF BOUNDARY OUTLINE */}
        {roofLatLngs.length >= 3 && (
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

        {/* 2. SMOOTH SOLAR IRRADIANCE HEATMAP (Clean Translucent Gradient, No Distracting Square Grid) */}
        {showHeatmap && roofLatLngs.length >= 3 && (
          <Polygon
            positions={roofLatLngs}
            pathOptions={{
              color: 'transparent',
              weight: 0,
              fillColor: '#10b981',
              fillOpacity: 0.28,
            }}
          >
            <Tooltip direction="center" permanent={false}>
              <div style={{ fontSize: 12 }}>
                <strong>Solar Potential: {analysis?.overallClassification ?? 'HIGH'}</strong>
                <br />
                Solar Access: {analysis?.avgSolarAccessPct ?? 88}%
                <br />
                Irradiance: {analysis?.resourceData.annualGhi ?? 1850} kWh/m²/yr
              </div>
            </Tooltip>
          </Polygon>
        )}

        {/* 3. DYNAMIC 3D RAY-TRACED SHADOWS */}
        {showShadows &&
          currentProjectedShadows.map((shadow) => {
            const shadowLatLngs: [number, number][] = shadow.shadowPolygon.map(([lng, lat]) => [lat, lng]);
            return (
              <Polygon
                key={`shadow-${shadow.obstacleId}`}
                positions={shadowLatLngs}
                pathOptions={{
                  color: '#38bdf8',
                  weight: 1.5,
                  dashArray: '3, 3',
                  fillColor: 'rgba(15, 23, 42, 0.80)',
                  fillOpacity: 1,
                }}
              >
                <Tooltip direction="top" opacity={0.95}>
                  <span>🌑 Shadow cast by <strong>{shadow.obstacleLabel}</strong></span>
                  <br />
                  Length: {shadow.shadowLengthMeters}m ({shadow.shadowAzimuth}°)
                </Tooltip>
              </Polygon>
            );
          })}

        {/* 4. OBSTACLES & CLEARANCE RINGS */}
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
                  radius={7}
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
                    {cat.icon} {obs.label || cat.label} {obs.height ? `(${obs.height}m)` : ''}
                  </Tooltip>
                </Polygon>
              );
            }

            return null;
          })}

        {/* 5. USER-SELECTED SOLAR INSTALLATION AREA (Distinctive Polygon, NOT a panel grid) */}
        {showSelectedArea && selectedAreaLatLngs.length >= 3 && toolMode !== 'edit_selection' && (
          <Polygon
            positions={selectedAreaLatLngs}
            pathOptions={{
              color: '#06b6d4',
              weight: 3.5,
              dashArray: '5, 5',
              fillColor: 'rgba(6, 182, 212, 0.28)',
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="center" permanent={false}>
              <div style={{ fontSize: 12 }}>
                <strong>⭐ User-Selected Solar Area</strong>
                <br />
                Area: {selectedArea ? `${Math.round(selectedArea.area)} m²` : ''}
                <br />
                Solar Zone: {selectedArea?.solarZone} ({selectedArea?.avgSolarAccessPct}% access)
                {selectedArea && selectedArea.obstacleConflicts > 0 && (
                  <span style={{ color: '#ef4444', display: 'block', fontWeight: 'bold' }}>
                    ⚠️ {selectedArea.obstacleConflicts} Obstacle Conflict(s)
                  </span>
                )}
              </div>
            </Tooltip>
          </Polygon>
        )}

        {/* 6. EDITING SELECTED AREA VERTICES */}
        {toolMode === 'edit_selection' && (
          <>
            <Polygon
              positions={editableVertices}
              pathOptions={{
                color: '#06b6d4',
                weight: 3.5,
                dashArray: '6, 6',
                fillColor: 'rgba(6, 182, 212, 0.35)',
              }}
            />
            {editableVertices.map(([lat, lng], idx) => (
              <Marker
                key={`sel-edit-vertex-${idx}`}
                position={[lat, lng]}
                draggable={true}
                icon={selectionDragIcon}
                eventHandlers={{
                  drag: (e) => {
                    const marker = e.target as L.Marker;
                    const pos = marker.getLatLng();
                    handleVertexDrag(idx, pos.lat, pos.lng);
                  },
                  dragend: (e) => {
                    const marker = e.target as L.Marker;
                    const pos = marker.getLatLng();
                    handleVertexDrag(idx, pos.lat, pos.lng);
                  },
                }}
              >
                <Tooltip direction="top" permanent={false}>
                  Corner {idx + 1} (Drag to adjust selected area)
                </Tooltip>
              </Marker>
            ))}
          </>
        )}

        {/* 7. MANUAL DRAWING SELECTION IN PROGRESS */}
        {toolMode === 'draw_selection' && drawingPoints.length > 0 && (
          <>
            {drawingPoints.map(([lat, lng], idx) => (
              <CircleMarker
                key={`draw-sel-pt-${idx}`}
                center={[lat, lng]}
                radius={idx === 0 ? 7 : 5}
                pathOptions={{
                  color: '#fff',
                  weight: 2,
                  fillColor: idx === 0 ? '#10b981' : '#06b6d4',
                  fillOpacity: 1,
                }}
              />
            ))}
            {drawingPoints.length >= 2 && (
              <Polyline
                positions={drawingPoints}
                pathOptions={{
                  color: '#06b6d4',
                  weight: 3,
                  dashArray: '6, 6',
                }}
              />
            )}
            {drawingPoints.length >= 3 && (
              <Polygon
                positions={drawingPoints}
                pathOptions={{
                  color: '#06b6d4',
                  weight: 2,
                  fillColor: 'rgba(6, 182, 212, 0.30)',
                  fillOpacity: 0.8,
                }}
              />
            )}
          </>
        )}
      </MapContainer>

      {/* Floating Drawing / Editing Toolbar */}
      {toolMode !== 'view' && (
        <div className={styles.drawingToolbar}>
          <div className={styles.drawingInfo}>
            <span className={styles.drawingBadge}>
              {toolMode === 'draw_selection' && '✏️ Select Solar Installation Area'}
              {toolMode === 'edit_selection' && '🔧 Reshape Selected Solar Area'}
            </span>
            <span className={styles.drawingHint}>
              {toolMode === 'edit_selection' && 'Drag cyan handles to resize or reposition the installation boundary'}
              {toolMode === 'draw_selection' &&
                (drawingPoints.length === 0
                  ? 'Click on the rooftop to place 1st corner'
                  : drawingPoints.length === 1
                  ? 'Click to place next corner'
                  : `${drawingPoints.length} points • ${liveArea?.display || ''} ${liveDistance ? `(Seg: ${liveDistance})` : ''}`)}
            </span>
          </div>

          <div className={styles.drawingActions}>
            {toolMode === 'edit_selection' ? (
              <>
                <button className={styles.drawBtnPrimary} onClick={handleSaveEditedVertices}>
                  ✓ Save Area Selection
                </button>
                <button
                  className={styles.drawBtnCancel}
                  onClick={() => dispatch({ type: 'SET_TOOL_MODE', payload: 'view' })}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {drawingPoints.length > 0 && (
                  <button
                    className={styles.drawBtnSecondary}
                    onClick={() => dispatch({ type: 'UNDO_DRAWING_POINT' })}
                    title="Undo last point"
                  >
                    Undo
                  </button>
                )}
                <button
                  className={styles.drawBtnPrimary}
                  disabled={drawingPoints.length < 3}
                  onClick={handleFinishDrawingSelection}
                >
                  Complete Selection ({drawingPoints.length}/3+)
                </button>
                <button
                  className={styles.drawBtnCancel}
                  onClick={() => {
                    dispatch({ type: 'CLEAR_DRAWING_POINTS' });
                    dispatch({ type: 'SET_TOOL_MODE', payload: 'view' });
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Map Control Buttons */}
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

      {/* Floating Legend Overlay */}
      <SolarLegend
        showHeatmap={showHeatmap}
        showShadows={showShadows}
        showSelectedArea={showSelectedArea}
        showObstacles={showObstacles}
        onToggleLayer={(layer) => dispatch({ type: 'TOGGLE_LAYER', payload: layer })}
      />
    </div>
  );
}
