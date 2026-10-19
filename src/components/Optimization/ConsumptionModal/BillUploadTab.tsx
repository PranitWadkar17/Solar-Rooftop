import React, { useRef, useState } from 'react';
import type { OcrProgressStatus } from '@/services/billExtractionService';
import styles from './BillUploadTab.module.css';

interface BillUploadTabProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  ocrProgress: OcrProgressStatus | null;
  onCancel: () => void;
  error: string | null;
}

export const BillUploadTab: React.FC<BillUploadTabProps> = ({
  onFileSelected,
  isLoading,
  ocrProgress,
  onCancel,
  error,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isLoading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div className={styles.uploadContainer}>
      {/* Privacy Guarantee Banner */}
      <div className={styles.privacyBanner} role="note">
        <span className={styles.privacyIcon} aria-hidden="true">🔒</span>
        <div className={styles.privacyText}>
          <strong>100% Private & In-Browser Processing:</strong> Your bill is scanned locally on your device. No photo, consumer data, or personal details are uploaded to any server or third-party service.
        </div>
      </div>

      {isLoading ? (
        <div className={styles.progressCard} aria-live="polite">
          <div className={styles.spinner} />
          <h4 className={styles.progressTitle}>Reading & Analyzing Electricity Bill</h4>
          <p className={styles.progressMessage}>{ocrProgress?.message || 'Processing image...'}</p>
          
          <div className={styles.progressBarWrapper}>
            <div
              className={styles.progressBar}
              style={{ width: `${ocrProgress?.progressPct || 10}%` }}
              role="progressbar"
              aria-valuenow={ocrProgress?.progressPct || 10}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <span className={styles.progressPercentage}>{ocrProgress?.progressPct || 10}% Complete</span>

          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
          >
            Cancel Scanning
          </button>
        </div>
      ) : (
        <>
          {/* Drag & Drop Upload Zone */}
          <div
            className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
            aria-label="Upload electricity bill photo or scan"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/bmp"
              className={styles.hiddenInput}
              onChange={handleFileChange}
            />
            {/* Direct Camera capture for Mobile */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className={styles.hiddenInput}
              onChange={handleFileChange}
            />

            <div className={styles.uploadIconCircle}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>

            <h4 className={styles.dropTitle}>Upload your Electricity Bill Image</h4>
            <p className={styles.dropSubtitle}>
              Drag and drop your bill photo here, or <span className={styles.browseLink}>browse files</span>
            </p>
            <span className={styles.formatBadge}>Supports JPG, PNG, WEBP (Max 10 MB)</span>
          </div>

          {/* Mobile Camera Fast-Action Button */}
          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.cameraBtn}
              onClick={() => cameraInputRef.current?.click()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span>Take Photo with Camera</span>
            </button>
          </div>

          {error && (
            <div className={styles.errorMessage} role="alert">
              ⚠️ {error}
            </div>
          )}

          {/* Helpful Tips Card */}
          <div className={styles.tipsCard}>
            <span className={styles.tipsHeading}>📸 Tips for 100% Accurate OCR:</span>
            <ul className={styles.tipsList}>
              <li>Ensure good lighting and avoid reflections or heavy shadows on the paper.</li>
              <li>Include the <strong>Units Consumed / Consumption History table</strong> in the frame.</li>
              <li>Keep the bill as flat and uncreased as possible.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};
