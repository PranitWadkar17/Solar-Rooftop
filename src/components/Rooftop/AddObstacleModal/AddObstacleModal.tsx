import { useState } from 'react';
import { OBSTACLE_CATEGORIES } from '@/data/obstacleCategories';
import type { ObstacleType, ObstacleGeometryKind } from '@/types/rooftop.js';
import styles from './AddObstacleModal.module.css';

interface AddObstacleModalProps {
  onStartDrawing: (type: ObstacleType, geometryKind: ObstacleGeometryKind, clearance: number, height: number | null) => void;
  onCancel: () => void;
}

export function AddObstacleModal({ onStartDrawing, onCancel }: AddObstacleModalProps) {
  const [selectedType, setSelectedType] = useState<ObstacleType>('water_tank');
  const [selectedShape, setSelectedShape] = useState<ObstacleGeometryKind>('rectangle');
  const [clearance, setClearance] = useState<number>(0.5);
  const [height, setHeight] = useState<number | ''>(1.5);

  const currentCategory = OBSTACLE_CATEGORIES.find((c) => c.type === selectedType) ?? OBSTACLE_CATEGORIES[0];

  const handleSelectType = (type: ObstacleType) => {
    setSelectedType(type);
    const cat = OBSTACLE_CATEGORIES.find((c) => c.type === type);
    if (cat) {
      setClearance(cat.defaultClearance);
      setHeight(cat.defaultHeight ?? '');
      if (!cat.supportedGeometries.includes(selectedShape)) {
        setSelectedShape(cat.supportedGeometries[0]);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartDrawing(
      selectedType,
      selectedShape,
      clearance,
      height === '' ? null : Number(height)
    );
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="add-obs-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h3 id="add-obs-title" className={styles.title}>Add Rooftop Obstacle</h3>
            <p className={styles.subtitle}>Select the obstacle category and drawing mode.</p>
          </div>
          <button className={styles.closeBtn} onClick={onCancel} aria-label="Close modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Category Grid */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Obstacle Category</label>
            <div className={styles.categoryGrid}>
              {OBSTACLE_CATEGORIES.map((cat) => {
                const isSelected = cat.type === selectedType;
                return (
                  <button
                    type="button"
                    key={cat.type}
                    className={`${styles.categoryCard} ${isSelected ? styles.categoryActive : ''}`}
                    onClick={() => handleSelectType(cat.type)}
                  >
                    <span className={styles.categoryIcon}>{cat.icon}</span>
                    <span className={styles.categoryLabel}>{cat.label}</span>
                  </button>
                );
              })}
            </div>
            <p className={styles.categoryDesc}>{currentCategory.description}</p>
          </div>

          {/* Geometry Mode */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Drawing Geometry</label>
            <div className={styles.shapeSelector}>
              {(['rectangle', 'polygon', 'point'] as ObstacleGeometryKind[]).map((shape) => {
                const isSupported = currentCategory.supportedGeometries.includes(shape);
                const isSelected = selectedShape === shape;
                return (
                  <button
                    type="button"
                    key={shape}
                    disabled={!isSupported}
                    className={`${styles.shapeBtn} ${isSelected ? styles.shapeActive : ''}`}
                    onClick={() => setSelectedShape(shape)}
                  >
                    {shape === 'rectangle' && '📐 Rectangle / Box'}
                    {shape === 'polygon' && '⬡ Custom Polygon'}
                    {shape === 'point' && '📍 Point / Marker'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clearance & Height Parameters */}
          <div className={styles.paramRow}>
            <div className={styles.paramField}>
              <label className={styles.fieldLabel}>
                Clearance Buffer (m)
                <span className={styles.hint}>Planning assumption</span>
              </label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                className={styles.input}
                value={clearance}
                onChange={(e) => setClearance(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className={styles.paramField}>
              <label className={styles.fieldLabel}>
                Obstacle Height (m)
                <span className={styles.hint}>Optional shadow ref</span>
              </label>
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                placeholder="Optional"
                className={styles.input}
                value={height}
                onChange={(e) => setHeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Actions */}
          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className={styles.drawBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Draw on Map
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
