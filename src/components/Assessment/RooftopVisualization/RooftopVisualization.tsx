import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import type { Rooftop } from '@/types/rooftop';
import type { SolarAnalysis } from '@/types/solar';
import type { PanelLayout } from '@/types/optimization';
import { getSatelliteTileConfig } from '@/services/satelliteLayerService';
import styles from './RooftopVisualization.module.css';

export interface RooftopVisualizationRef {
  getImageDataUrl: () => string | null;
  prepareImage: () => Promise<string | null>;
}

interface RooftopVisualizationProps {
  rooftop: Rooftop | null;
  solarAnalysis: SolarAnalysis | null;
  layout: PanelLayout | null;
  className?: string;
}

interface GeoBounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

function lngLatToTile(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

function loadTileImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export const RooftopVisualization = forwardRef<RooftopVisualizationRef, RooftopVisualizationProps>(
  ({ rooftop, solarAnalysis, layout, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawTokenRef = useRef(0);
    const readyPromiseRef = useRef<Promise<void>>(Promise.resolve());

    const getImageDataUrl = useCallback((): string | null => {
      if (!canvasRef.current) return null;
      try {
        return canvasRef.current.toDataURL('image/png');
      } catch (err) {
        console.warn('Failed to export rooftop canvas to data URL:', err);
        return null;
      }
    }, []);

    const collectCoords = useCallback((): [number, number][] => {
      const allCoords: [number, number][] = [];
      const selectedRing = solarAnalysis?.selectedArea?.geometry?.coordinates?.[0] as
        | [number, number][]
        | undefined;
      if (selectedRing) selectedRing.forEach((pt) => allCoords.push(pt));
      if (allCoords.length === 0 && rooftop?.geometry?.coordinates?.[0]) {
        (rooftop.geometry.coordinates[0] as [number, number][]).forEach((pt) => allCoords.push(pt));
      }
      if (layout?.panels) {
        layout.panels.forEach((p) => {
          if (!p.isDeleted && p.geometry?.coordinates?.[0]) {
            (p.geometry.coordinates[0] as [number, number][]).forEach((pt) => allCoords.push(pt));
          }
        });
      }
      return allCoords;
    }, [rooftop, solarAnalysis, layout]);

    const drawVisualization = useCallback(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const token = ++drawTokenRef.current;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#1a2332';
      ctx.fillRect(0, 0, width, height);

      const allCoords = collectCoords();
      if (allCoords.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Rooftop Geometry Loading...', width / 2, height / 2);
        return;
      }

      let minLng = Infinity;
      let maxLng = -Infinity;
      let minLat = Infinity;
      let maxLat = -Infinity;
      allCoords.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });
      if (minLng === maxLng) {
        minLng -= 0.00008;
        maxLng += 0.00008;
      }
      if (minLat === maxLat) {
        minLat -= 0.00008;
        maxLat += 0.00008;
      }

      // Pad the crop so the selected rooftop fills the frame without clipping the orange box.
      const padFrac = 0.12;
      const lngPad = (maxLng - minLng) * padFrac;
      const latPad = (maxLat - minLat) * padFrac;
      const bounds: GeoBounds = {
        minLng: minLng - lngPad,
        maxLng: maxLng + lngPad,
        minLat: minLat - latPad,
        maxLat: maxLat + latPad,
      };

      const centerLat = (bounds.minLat + bounds.maxLat) / 2;
      const cosLat = Math.cos((centerLat * Math.PI) / 180);
      const geoWidth = Math.max((bounds.maxLng - bounds.minLng) * cosLat, 1e-7);
      const geoHeight = Math.max(bounds.maxLat - bounds.minLat, 1e-7);
      const padX = 36;
      const padY = 48;
      const drawW = width - padX * 2;
      const drawH = height - padY * 2;
      const scale = Math.min(drawW / geoWidth, drawH / geoHeight);

      const projectX = (lng: number) => {
        const scaledLng = (lng - bounds.minLng) * cosLat;
        return padX + (drawW - geoWidth * scale) / 2 + scaledLng * scale;
      };
      const projectY = (lat: number) => {
        const scaledLat = bounds.maxLat - lat;
        return padY + (drawH - geoHeight * scale) / 2 + scaledLat * scale;
      };

      const metersPerPx = (geoWidth * 111320) / (geoWidth * scale);
      let zoom = Math.round(Math.log2(156543.03392 * Math.cos((centerLat * Math.PI) / 180) / metersPerPx));
      zoom = Math.max(17, Math.min(20, zoom));

      const tileCfg = getSatelliteTileConfig();
      const nw = lngLatToTile(bounds.minLng, bounds.maxLat, zoom);
      const se = lngLatToTile(bounds.maxLng, bounds.minLat, zoom);
      const minTx = Math.floor(nw.x);
      const maxTx = Math.floor(se.x);
      const minTy = Math.floor(nw.y);
      const maxTy = Math.floor(se.y);
      const nTiles = 2 ** zoom;

      const tileJobs: Promise<{ img: HTMLImageElement; tx: number; ty: number } | null>[] = [];
      for (let tx = minTx; tx <= maxTx; tx++) {
        for (let ty = minTy; ty <= maxTy; ty++) {
          const wrappedX = ((tx % nTiles) + nTiles) % nTiles;
          const url = tileCfg.url
            .replace('{z}', String(zoom))
            .replace('{x}', String(wrappedX))
            .replace('{y}', String(ty));
          tileJobs.push(
            loadTileImage(url).then((img) => (img ? { img, tx: wrappedX, ty } : null)),
          );
        }
      }

      const loaded = await Promise.all(tileJobs);
      if (token !== drawTokenRef.current) return;

      let anyTile = false;
      loaded.forEach((tile) => {
        if (!tile) return;
        anyTile = true;
        const west = (tile.tx / nTiles) * 360 - 180;
        const east = ((tile.tx + 1) / nTiles) * 360 - 180;
        const n1 = Math.PI - (2 * Math.PI * tile.ty) / nTiles;
        const n2 = Math.PI - (2 * Math.PI * (tile.ty + 1)) / nTiles;
        const north = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n1) - Math.exp(-n1)));
        const south = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n2) - Math.exp(-n2)));
        const x1 = projectX(west);
        const x2 = projectX(east);
        const y1 = projectY(north);
        const y2 = projectY(south);
        ctx.drawImage(tile.img, x1, y1, x2 - x1, y2 - y1);
      });

      if (!anyTile) {
        ctx.fillStyle = '#3f5d4a';
        ctx.fillRect(0, 0, width, height);
      }

      const drawRing = (ring: [number, number][]) => {
        ctx.beginPath();
        ring.forEach(([lng, lat], i) => {
          const x = projectX(lng);
          const y = projectY(lat);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      };

      if (rooftop?.geometry?.coordinates?.[0]) {
        const roofRing = rooftop.geometry.coordinates[0] as [number, number][];
        if (roofRing.length >= 3) {
          drawRing(roofRing);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }

      const selectedRing = solarAnalysis?.selectedArea?.geometry?.coordinates?.[0] as
        | [number, number][]
        | undefined;
      if (selectedRing && selectedRing.length >= 3) {
        // Orange crop box around the selected rooftop area
        let sMinX = Infinity;
        let sMaxX = -Infinity;
        let sMinY = Infinity;
        let sMaxY = -Infinity;
        selectedRing.forEach(([lng, lat]) => {
          const x = projectX(lng);
          const y = projectY(lat);
          if (x < sMinX) sMinX = x;
          if (x > sMaxX) sMaxX = x;
          if (y < sMinY) sMinY = y;
          if (y > sMaxY) sMaxY = y;
        });
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.strokeRect(sMinX - 8, sMinY - 8, sMaxX - sMinX + 16, sMaxY - sMinY + 16);

        drawRing(selectedRing);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
        ctx.fill();
        ctx.setLineDash([8, 5]);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }

      if (rooftop?.obstacles) {
        rooftop.obstacles.forEach((obs) => {
          if (obs.status === 'rejected') return;
          if (obs.geometry?.type === 'Polygon' && obs.geometry.coordinates?.[0]) {
            const ring = obs.geometry.coordinates[0] as [number, number][];
            drawRing(ring);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
            ctx.fill();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (obs.geometry?.type === 'Point' && obs.geometry.coordinates) {
            const [lng, lat] = obs.geometry.coordinates;
            ctx.beginPath();
            ctx.arc(projectX(lng), projectY(lat), 7, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        });
      }

      const panels = layout?.panels || [];
      const activePanels = panels.filter((p) => !p.isDeleted);

      activePanels.forEach((panel) => {
        if (!panel.geometry?.coordinates?.[0]) return;
        const ring = panel.geometry.coordinates[0] as [number, number][];
        if (ring.length < 4) return;
        const pts = ring.slice(0, 4).map(([lng, lat]) => ({
          x: projectX(lng),
          y: projectY(lat),
        }));

        ctx.beginPath();
        ctx.moveTo(pts[0].x + 2, pts[0].y + 2);
        ctx.lineTo(pts[1].x + 2, pts[1].y + 2);
        ctx.lineTo(pts[2].x + 2, pts[2].y + 2);
        ctx.lineTo(pts[3].x + 2, pts[3].y + 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.lineTo(pts[3].x, pts[3].y);
        ctx.closePath();
        ctx.fillStyle = '#1e3a8a';
        ctx.fill();
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        const midX1 = (pts[0].x + pts[1].x) / 2;
        const midY1 = (pts[0].y + pts[1].y) / 2;
        const midX2 = (pts[3].x + pts[2].x) / 2;
        const midY2 = (pts[3].y + pts[2].y) / 2;
        ctx.beginPath();
        ctx.moveTo(midX1, midY1);
        ctx.lineTo(midX2, midY2);
        ctx.strokeStyle = 'rgba(191, 219, 254, 0.45)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
      });

      const compassX = width - 45;
      const compassY = 45;
      ctx.save();
      ctx.beginPath();
      ctx.arc(compassX, compassY, 20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(compassX, compassY - 14);
      ctx.lineTo(compassX - 5, compassY);
      ctx.lineTo(compassX + 5, compassY);
      ctx.closePath();
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(compassX, compassY + 14);
      ctx.lineTo(compassX - 5, compassY);
      ctx.lineTo(compassX + 5, compassY);
      ctx.closePath();
      ctx.fillStyle = '#cbd5e1';
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('N', compassX, compassY - 14);
      ctx.restore();

      const selectedAreaM2 = solarAnalysis?.selectedArea?.area ?? rooftop?.area ?? 0;
      const panelCount = activePanels.length;
      const capacityKWp =
        layout?.systemCapacityKWp ??
        (panelCount * (layout?.panelSpec?.ratedPowerW ?? 540)) / 1000;
      const badgeText = `Selected Area: ${selectedAreaM2.toFixed(1)} m²  |  Arrangement: ${panelCount} Solar Panels (${capacityKWp.toFixed(2)} kWp)`;

      ctx.save();
      ctx.font = '600 13px sans-serif';
      const textWidth = ctx.measureText(badgeText).width;
      const badgeW = textWidth + 24;
      const badgeH = 28;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(20, 20, badgeW, badgeH, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, 32, 20 + badgeH / 2);
      ctx.restore();

      const legendItems = [
        { label: 'Rooftop Boundary', color: '#f59e0b', type: 'solid' },
        { label: 'Selected Scope', color: '#38bdf8', type: 'dashed' },
        { label: `PV Modules (${panelCount})`, color: '#1e3a8a', type: 'box' },
      ];
      if (rooftop?.obstacles && rooftop.obstacles.some((o) => o.status !== 'rejected')) {
        legendItems.push({ label: 'Obstacles', color: '#ef4444', type: 'box' });
      }

      ctx.save();
      const legendY = height - 26;
      let currLegendX = 24;
      ctx.font = '500 11.5px sans-serif';
      ctx.textBaseline = 'middle';
      legendItems.forEach((item) => {
        if (item.type === 'box') {
          ctx.fillStyle = item.color;
          ctx.fillRect(currLegendX, legendY - 5, 12, 10);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(currLegendX, legendY - 5, 12, 10);
        } else if (item.type === 'solid') {
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(currLegendX, legendY);
          ctx.lineTo(currLegendX + 16, legendY);
          ctx.stroke();
        } else {
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(currLegendX, legendY);
          ctx.lineTo(currLegendX + 16, legendY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'left';
        ctx.fillText(item.label, currLegendX + 22, legendY);
        currLegendX += 22 + ctx.measureText(item.label).width + 18;
      });
      ctx.restore();
    }, [collectCoords, rooftop, solarAnalysis, layout]);

    const prepareImage = useCallback(async (): Promise<string | null> => {
      await readyPromiseRef.current;
      return getImageDataUrl();
    }, [getImageDataUrl]);

    useImperativeHandle(
      ref,
      () => ({
        getImageDataUrl,
        prepareImage,
      }),
      [getImageDataUrl, prepareImage],
    );

    useEffect(() => {
      readyPromiseRef.current = drawVisualization().then(() => undefined);
    }, [drawVisualization]);

    return (
      <div className={`${styles.wrapper} ${className || ''}`}>
        <div className={styles.canvasContainer}>
          <canvas ref={canvasRef} width={900} height={520} className={styles.canvas} />
        </div>
      </div>
    );
  },
);

RooftopVisualization.displayName = 'RooftopVisualization';
