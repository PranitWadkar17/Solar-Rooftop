import styles from './UnsavedChangesModal.module.css';

interface UnsavedChangesModalProps {
  onSaveAndLeave: () => void;
  onDiscardAndLeave: () => void;
  onCancel: () => void;
}

export function UnsavedChangesModal({
  onSaveAndLeave,
  onDiscardAndLeave,
  onCancel,
}: UnsavedChangesModalProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
      <div className={styles.modal}>
        <div className={styles.iconWrapper}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h3 id="unsaved-title" className={styles.title}>Unsaved Rooftop Edits</h3>
        <p className={styles.text}>
          You have unsaved changes to your rooftop boundary or obstacle configurations. How would you like to proceed?
        </p>

        <div className={styles.actions}>
          <button className={styles.saveBtn} onClick={onSaveAndLeave}>
            Save & Continue
          </button>
          <button className={styles.discardBtn} onClick={onDiscardAndLeave}>
            Discard Changes
          </button>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
