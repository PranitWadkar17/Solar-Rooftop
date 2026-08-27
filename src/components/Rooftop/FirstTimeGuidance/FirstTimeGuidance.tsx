import { useState } from 'react';
import styles from './FirstTimeGuidance.module.css';

interface FirstTimeGuidanceProps {
  onDismiss: () => void;
}

export function FirstTimeGuidance({ onDismiss }: FirstTimeGuidanceProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('solarroof-rooftop-guide-dismissed', 'true');
    }
    onDismiss();
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <div className={styles.modal}>
        <div className={styles.badge}>
          <span>💡 Quick Guide</span>
        </div>

        <h2 id="guide-title" className={styles.title}>Rooftop & Obstacle Intelligence</h2>
        <p className={styles.subtitle}>
          Verify your building's exact roof boundary and mark any obstructions before solar yield simulation.
        </p>

        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNum}>1</div>
            <div className={styles.stepContent}>
              <strong>Confirm Rooftop Boundary</strong>
              <p>Review the derived boundary or use the polygon drawing tool to adjust corners accurately.</p>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNum}>2</div>
            <div className={styles.stepContent}>
              <strong>Detect or Mark Obstacles</strong>
              <p>Identify water tanks, AC units, vents, or tree overhangs that reduce usable area.</p>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNum}>3</div>
            <div className={styles.stepContent}>
              <strong>Inspect Usable Rooftop Area</strong>
              <p>Review the automated deduction of obstacles, clearance buffers, and maintenance walkways.</p>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNum}>4</div>
            <div className={styles.stepContent}>
              <strong>Proceed to Solar Analysis</strong>
              <p>Continue to Phase 4 for 3D irradiance vectors, sun path analysis, and shadow modeling.</p>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span>Don't show this again</span>
          </label>

          <button className={styles.startBtn} onClick={handleClose}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
