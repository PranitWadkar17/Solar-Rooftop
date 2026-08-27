import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
  ScaleControl,
} from 'react-leaflet';
import L from 'leaflet';
import { useRooftop } from '@/context/RooftopContext';
import { getStreetTileConfig, getSatelliteTileConfig } from '@/services/satelliteLayerService';
import { getObstacleCategory } from '@/data/obstacleCategories';
import {
  calculatePolygonArea,
  formatArea,
  distanceBetweenPoints,
  formatDistance,
  generateObstacleBuffer,
  generatePointBuffer,
  validatePolygon,
} from '@/utils/geoUtils';
import { MapLegend } from '../MapLegend/MapLegend';
import type { MapLayerType } from '@/types/index.js';
import type { Obstacle, ObstacleType, ObstacleGeometryKind, Rooftop } from '@/types/rooftop.js';
import 'leaflet/dist/leaflet.css';
import styles from './RooftopMap.module.css';

// Fix Leaflet default icon issues
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom draggable vertex handle icon for roof editing
const vertexDragIcon = L.divIcon({
  className: 'vertex-edit-handle',
  html: `<div style="
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ffffff;
    border: 3.5px solid #f59e0b;
    box-shadow: 0 0 8px rgba(0,0,0,0.6), 0 0 14px rgba(245,158,11,0.9);
    cursor: grab;
    transform: translate(-9px, -9px);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Map Controller for click events and programmatic flyTo
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

// Map Bridge to reliably capture map instance and auto-fit to rooftop on mount
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
      map.fitBounds([[south, west], [north, east]], { padding: [80, 80], maxZoom: 20 });
    }
  }, [map, rooftop]);

  return null;
}

export interface ActiveObstacleConfig {
  type: ObstacleType;
  geometryKind: ObstacleGeometryKind;
  clearance: number;
  height: number | null;
}

interface RooftopMapProps {
  onOpenAddObstacleModal: () => void;
  activeObstacleConfig: ActiveObstacleConfig | null;
  setActiveObstacleConfig: (config: ActiveObstacleConfig | null) => void;
}

export function RooftopMap({
  onOpenAddObstacleModal,
  activeObstacleConfig,
  setActiveObstacleConfig,
}: RooftopMapProps) {
  const { state, dispatch } = useRooftop();
  const {
    rooftop,
    toolMode,
    selectedObstacleId,
    drawingPoints,
    showRoofBoundary,
    showObstacles,
    showClearance,
    showExistingSolar,
    showSections,
  } = state;

  const [activeLayer, setActiveLayer] = useState<MapLayerType>('satellite');
  const [editableVertices, setEditableVertices] = useState<[number, number][]>([]);

  const streetConfig = getStreetTileConfig();
  const satConfig = getSatelliteTileConfig();
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Sync editable vertices when entering edit_roof mode
  useEffect(() => {
    if (rooftop && toolMode === 'edit_roof') {
      const rawRing = rooftop.geometry.coordinates[0] as [number, number][];
      // Strip closing duplicate vertex for clean independent handle dragging
      const isClosed =
        rawRing.length > 1 &&
        rawRing[0][0] === rawRing[rawRing.length - 1][0] &&
        rawRing[0][1] === rawRing[rawRing.length - 1][1];
      const uniqueCoords = isClosed ? rawRing.slice(0, -1) : rawRing;
      // Convert [lng, lat] to [lat, lng]
      setEditableVertices(uniqueCoords.map(([lng, lat]) => [lat, lng]));
    }
  }, [rooftop, toolMode]);

  // Initial map center & zoom from rooftop centroid
  const mapCenter: [number, number] = rooftop
    ? [rooftop.centroid.lat, rooftop.centroid.lng]
    : [20, 0];
  const mapZoom = rooftop ? 19 : 2;

  // Fit bounds helper
  const handleFitToRoof = useCallback(() => {
    if (!rooftop || !mapInstanceRef.current) return;
    const [south, north, west, east] = rooftop.boundingBox;
    mapInstanceRef.current.fitBounds([[south, west], [north, east]], { padding: [70, 70], maxZoom: 21 });
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

  // Map Click Handler based on active toolMode
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (toolMode === 'draw_roof') {
        dispatch({ type: 'ADD_DRAWING_POINT', payload: [lat, lng] });
      } else if (toolMode === 'draw_obstacle_polygon' || toolMode === 'draw_obstacle_rect') {
        dispatch({ type: 'ADD_DRAWING_POINT', payload: [lat, lng] });
      } else if (toolMode === 'draw_obstacle_point') {
        // Direct creation of point obstacle
        if (rooftop && activeObstacleConfig) {
          const pointGeom: GeoJSON.Point = {
            type: 'Point',
            coordinates: [lng, lat],
          };
          const newObs: Obstacle = {
            id: `obs-${Math.random().toString(36).substring(2, 9)}`,
            rooftopId: rooftop.id,
            type: activeObstacleConfig.type,
            geometryKind: 'point',
            geometry: pointGeom,
            area: null,
            height: activeObstacleConfig.height,
            clearance: activeObstacleConfig.clearance,
            confidence: null,
            confidenceLevel: null,
            source: 'user_drawn',
            status: 'accepted',
            label: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          dispatch({ type: 'ADD_OBSTACLE', payload: newObs });
          dispatch({ type: 'SET_TOOL_MODE', payload: 'select' });
          setActiveObstacleConfig(null);
        }
      }
    },
    [toolMode, rooftop, activeObstacleConfig, dispatch, setActiveObstacleConfig]
  );

  // Complete roof polygon drawing
  const handleCompleteRoofDrawing = useCallback(() => {
    if (drawingPoints.length < 3) return;
    const geoCoords: [number, number][] = drawingPoints.map(([lat, lng]) => [lng, lat]);
    const closedCoords: [number, number][] = [...geoCoords, geoCoords[0]];
    const val = validatePolygon(closedCoords);
    if (!val.valid) {
      alert(`Invalid boundary: ${val.errors.join(' ')}`);
      return;
    }

    const updatedPoly: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [closedCoords],
    };
    dispatch({ type: 'UPDATE_ROOFTOP_GEOMETRY', payload: updatedPoly });
    dispatch({ type: 'CLEAR_DRAWING_POINTS' });
    dispatch({ type: 'SET_TOOL_MODE', payload: 'select' });
  }, [drawingPoints, dispatch]);

  // Complete obstacle polygon / rectangle drawing
  const handleCompleteObstacleDrawing = useCallback(() => {
    if (!rooftop || !activeObstacleConfig || drawingPoints.length < 3) return;
    const geoCoords: [number, number][] = drawingPoints.map(([lat, lng]) => [lng, lat]);
    const closedCoords: [number, number][] = [...geoCoords, geoCoords[0]];
    const val = validatePolygon(closedCoords, 0.2);
    if (!val.valid) {
      alert(`Invalid obstacle shape: ${val.errors.join(' ')}`);
      return;
    }

    const polyGeom: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [closedCoords],
    };
    const area = calculatePolygonArea(closedCoords);

    const newObs: Obstacle = {
      id: `obs-${Math.random().toString(36).substring(2, 9)}`,
      rooftopId: rooftop.id,
      type: activeObstacleConfig.type,
      geometryKind: activeObstacleConfig.geometryKind,
      geometry: polyGeom,
      area,
      height: activeObstacleConfig.height,
      clearance: activeObstacleConfig.clearance,
      confidence: null,
      confidenceLevel: null,
      source: 'user_drawn',
      status: 'accepted',
      label: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_OBSTACLE', payload: newObs });
    dispatch({ type: 'CLEAR_DRAWING_POINTS' });
    dispatch({ type: 'SET_TOOL_MODE', payload: 'select' });
    setActiveObstacleConfig(null);
  }, [rooftop, activeObstacleConfig, drawingPoints, dispatch, setActiveObstacleConfig]);

  // Handle vertex drag for roof editing
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
    // Append closing vertex
    const closedCoords: [number, number][] = [...geoCoords, geoCoords[0]];
    const val = validatePolygon(closedCoords);
    if (!val.valid) {
      alert(`Invalid boundary: ${val.errors.join(' ')}`);
      return;
    }
    const updatedPoly: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [closedCoords],
    };
    dispatch({ type: 'UPDATE_ROOFTOP_GEOMETRY', payload: updatedPoly });
    dispatch({ type: 'SET_TOOL_MODE', payload: 'select' });
  }, [editableVertices, dispatch]);

  // Roof polygon coordinates formatted for Leaflet [lat, lng][]
  const roofLatLngs: [number, number][] = useMemo(() => {
    if (!rooftop) return [];
    const ring = rooftop.geometry.coordinates[0] as [number, number][];
    return ring.map(([lng, lat]) => [lat, lng]);
  }, [rooftop]);

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

        {/* Bridges map instance and auto-fits on load */}
        <MapInstanceBridge
          rooftop={rooftop}
          onMapReady={(map) => {
            mapInstanceRef.current = map;
          }}
        />

        <MapController
          onMapClick={handleMapClick}
          onMapDoubleClick={() => {
            if (toolMode === 'draw_roof') handleCompleteRoofDrawing();
            if (toolMode.startsWith('draw_obstacle')) handleCompleteObstacleDrawing();
          }}
        />

        {/* 1. ROOF BOUNDARY POLYGON */}
        {showRoofBoundary && roofLatLngs.length >= 3 && toolMode !== 'draw_roof' && toolMode !== 'edit_roof' && (
          <Polygon
            positions={roofLatLngs}
            pathOptions={{
              color: 'var(--color-solar, #f59e0b)',
              weight: 3,
              fillColor: 'rgba(245, 158, 11, 0.22)',
              fillOpacity: 1,
            }}
          >
            <Tooltip permanent={false} direction="top">
              <strong>{rooftop?.source === 'user_drawn' ? 'User-Drawn Rooftop' : 'Rooftop Boundary'}</strong>
              <br />
              Area: {formatArea(rooftop?.area ?? 0).display}
            </Tooltip>
          </Polygon>
        )}

        {/* 2. ROOF EDITING VERTEX HANDLERS */}
        {toolMode === 'edit_roof' && (
          <>
            <Polygon
              positions={editableVertices}
              pathOptions={{
                color: 'var(--color-solar, #f59e0b)',
                weight: 3.5,
                dashArray: '6, 6',
                fillColor: 'rgba(245, 158, 11, 0.28)',
              }}
            />
            {editableVertices.map(([lat, lng], idx) => (
              <Marker
                key={`roof-edit-vertex-${idx}`}
                position={[lat, lng]}
                draggable={true}
                icon={vertexDragIcon}
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
                  Vertex {idx + 1} (Drag to adjust)
                </Tooltip>
              </Marker>
            ))}
          </>
        )}

        {/* 3. ROOF SECTIONS / PLANES */}
        {showSections &&
          rooftop?.sections.map((sec) => {
            const secRing = sec.geometry.coordinates[0] as [number, number][];
            const secLatLngs: [number, number][] = secRing.map(([lng, lat]) => [lat, lng]);
            return (
              <Polygon
                key={sec.id}
                positions={secLatLngs}
                pathOptions={{
                  color: '#38bdf8',
                  weight: 2,
                  fillColor: 'rgba(56, 189, 248, 0.18)',
                }}
              >
                <Tooltip direction="center" permanent>
                  {sec.label} ({formatArea(sec.area).sqMeters})
                </Tooltip>
              </Polygon>
            );
          })}

        {/* 4. OBSTACLES & CLEARANCE OVERLAYS */}
        {showObstacles &&
          rooftop?.obstacles.map((obs) => {
            if (obs.status === 'rejected') return null;
            const cat = getObstacleCategory(obs.type);
            const isSelected = selectedObstacleId === obs.id;
            const isExistingSolar = obs.type === 'existing_solar_panel';

            // Point Obstacle
            if (obs.geometryKind === 'point' && obs.geometry.type === 'Point') {
              const [lng, lat] = obs.geometry.coordinates;

              // Clearance buffer ring for point
              const clearanceBufferCoords = generatePointBuffer([lng, lat], obs.clearance);
              const clearanceLatLngs: [number, number][] = clearanceBufferCoords.map(([bLng, bLat]) => [bLat, bLng]);

              return (
                <div key={obs.id}>
                  {showClearance && obs.clearance > 0 && (
                    <Polygon
                      positions={clearanceLatLngs}
                      pathOptions={{
                        color: '#f97316',
                        weight: 1.5,
                        dashArray: '4, 4',
                        fillColor: 'rgba(249, 115, 22, 0.12)',
                        fillOpacity: 1,
                      }}
                    />
                  )}
                  <CircleMarker
                    center={[lat, lng]}
                    radius={isSelected ? 9 : 7}
                    pathOptions={{
                      color: isSelected ? '#fff' : cat.color,
                      weight: isSelected ? 3 : 2,
                      fillColor: cat.color,
                      fillOpacity: 0.9,
                    }}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e);
                        dispatch({ type: 'SELECT_OBSTACLE', payload: obs.id });
                      },
                    }}
                  >
                    <Tooltip direction="top" opacity={0.95}>
                      <span style={{ fontSize: 13 }}>{cat.icon} <strong>{obs.label || cat.label}</strong></span>
                      <br />
                      Clearance: {obs.clearance}m {obs.height ? `• Height: ${obs.height}m` : ''}
                    </Tooltip>
                  </CircleMarker>
                </div>
              );
            }

            // Polygon / Rectangle Obstacle
            if (obs.geometry.type === 'Polygon') {
              const ring = obs.geometry.coordinates[0] as [number, number][];
              const obsLatLngs: [number, number][] = ring.map(([lng, lat]) => [lat, lng]);

              // Clearance buffer polygon
              const bufferRing = generateObstacleBuffer(ring, obs.clearance);
              const bufferLatLngs: [number, number][] = bufferRing.map(([bLng, bLat]) => [bLat, bLng]);

              return (
                <div key={obs.id}>
                  {showClearance && obs.clearance > 0 && (
                    <Polygon
                      positions={bufferLatLngs}
                      pathOptions={{
                        color: '#f97316',
                        weight: 1.5,
                        dashArray: '4, 4',
                        fillColor: 'rgba(249, 115, 22, 0.12)',
                        fillOpacity: 1,
                      }}
                    />
                  )}
                  <Polygon
                    positions={obsLatLngs}
                    pathOptions={{
                      color: isSelected ? '#fff' : isExistingSolar && showExistingSolar ? '#eab308' : cat.color,
                      weight: isSelected ? 3 : 2,
                      fillColor: isExistingSolar ? 'rgba(234, 179, 8, 0.45)' : cat.color,
                      fillOpacity: 0.65,
                    }}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e);
                        dispatch({ type: 'SELECT_OBSTACLE', payload: obs.id });
                      },
                    }}
                  >
                    <Tooltip direction="top" opacity={0.95}>
                      <span style={{ fontSize: 13 }}>{cat.icon} <strong>{obs.label || cat.label}</strong></span>
                      <br />
                      Area: {obs.area ? `${Math.round(obs.area)} m²` : 'N/A'} • Clearance: {obs.clearance}m
                    </Tooltip>
                  </Polygon>
                </div>
              );
            }

            return null;
          })}

        {/* 5. ACTIVE DRAWING MODE ELEMENTS */}
        {drawingPoints.length > 0 && (
          <>
            {drawingPoints.map(([lat, lng], idx) => (
              <CircleMarker
                key={`draw-pt-${idx}`}
                center={[lat, lng]}
                radius={idx === 0 ? 7 : 5}
                pathOptions={{
                  color: '#fff',
                  weight: 2,
                  fillColor: idx === 0 ? 'var(--color-green)' : 'var(--color-solar)',
                  fillOpacity: 1,
                }}
              />
            ))}
            {drawingPoints.length >= 2 && (
              <Polyline
                positions={drawingPoints}
                pathOptions={{
                  color: 'var(--color-solar)',
                  weight: 3,
                  dashArray: '6, 6',
                }}
              />
            )}
            {drawingPoints.length >= 3 && (
              <Polygon
                positions={drawingPoints}
                pathOptions={{
                  color: 'var(--color-solar)',
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
      {toolMode !== 'select' && (
        <div className={styles.drawingToolbar}>
          <div className={styles.drawingInfo}>
            <span className={styles.drawingBadge}>
              {toolMode === 'draw_roof' && '✏️ Drawing Rooftop'}
              {toolMode === 'edit_roof' && '🔧 Drag Vertices to Edit'}
              {toolMode.startsWith('draw_obstacle') && '⚠️ Drawing Obstacle'}
            </span>
            <span className={styles.drawingHint}>
              {toolMode === 'edit_roof' && 'Drag any glowing white handle to reshape corners in real time'}
              {toolMode !== 'edit_roof' &&
                (drawingPoints.length === 0
                  ? 'Click on map to place 1st corner'
                  : drawingPoints.length === 1
                  ? 'Click to add next corner'
                  : `${drawingPoints.length} points • ${liveArea?.display || ''} ${liveDistance ? `(Seg: ${liveDistance})` : ''}`)}
            </span>
          </div>

          <div className={styles.drawingActions}>
            {toolMode === 'edit_roof' ? (
              <>
                <button className={styles.drawBtnPrimary} onClick={handleSaveEditedVertices}>
                  ✓ Save Boundary
                </button>
                <button
                  className={styles.drawBtnCancel}
                  onClick={() => dispatch({ type: 'SET_TOOL_MODE', payload: 'select' })}
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
                  onClick={() => {
                    if (toolMode === 'draw_roof') handleCompleteRoofDrawing();
                    if (toolMode.startsWith('draw_obstacle')) handleCompleteObstacleDrawing();
                  }}
                >
                  Complete ({drawingPoints.length}/3+)
                </button>
                <button
                  className={styles.drawBtnCancel}
                  onClick={() => {
                    dispatch({ type: 'CLEAR_DRAWING_POINTS' });
                    dispatch({ type: 'SET_TOOL_MODE', payload: 'select' });
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Map Control Buttons Overlay */}
      <div className={styles.controls}>
        {/* Layer Switcher */}
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

        {/* Map Tools */}
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
          <button
            className={`${styles.controlBtn} ${toolMode === 'edit_roof' ? styles.controlActive : ''}`}
            onClick={() =>
              dispatch({
                type: 'SET_TOOL_MODE',
                payload: toolMode === 'edit_roof' ? 'select' : 'edit_roof',
              })
            }
            title="Edit roof vertices"
            aria-label="Edit roof vertices"
          >
            🔧
          </button>
        </div>

        {/* Add Obstacle Quick Trigger */}
        <button
          className={`${styles.controlBtn} ${styles.singleControl}`}
          onClick={onOpenAddObstacleModal}
          title="Add rooftop obstacle"
          aria-label="Add obstacle"
        >
          ➕
        </button>
      </div>

      {/* Map Legend Overlay */}
      <MapLegend
        showRoof={showRoofBoundary}
        showSections={showSections}
        showObstacles={showObstacles}
        showClearance={showClearance}
        showExistingSolar={showExistingSolar}
        onToggleLayer={(layer) => dispatch({ type: 'TOGGLE_LAYER', payload: layer })}
      />
    </div>
  );
}
