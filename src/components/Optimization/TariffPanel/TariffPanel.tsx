// TariffPanel.tsx – UI for selecting or editing a tariff plan
import { useState, useMemo } from 'react';
import { useOptimization } from '@/context/OptimizationContext';
import {
  STANDARD_TARIFF_PLANS,
  type TariffPlan,

} from '@/services/tariffService';
import styles from './TariffPanel.module.css';

/**
 * Simple modal that lets the user pick a tariff plan.
 * – Preset plans are listed in a <select>.
 * – The "Custom" option opens a very minimal JSON editor (textarea).
 *   Heavy editing is out of scope – the user can paste a JSON representation of a TariffPlan.
 *   The JSON is parsed and, if valid, becomes the active plan.
 * The selected plan is stored via `setTariffPlan` from the optimization context.
 */
export function TariffPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { tariffPlan, setTariffPlan } = useOptimization();
  const [selectedId, setSelectedId] = useState<string>(tariffPlan?.id ?? STANDARD_TARIFF_PLANS[0].id);
  const [customJson, setCustomJson] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = useMemo(() => {
    if (selectedId === 'custom') {
      try {
        const parsed = JSON.parse(customJson) as TariffPlan;
        return parsed;
      } catch {
        return null;
      }
    }
    return STANDARD_TARIFF_PLANS.find((p) => p.id === selectedId) ?? null;
  }, [selectedId, customJson]);

  const applyPlan = () => {
    if (selectedId === 'custom') {
      try {
        const parsed: TariffPlan = JSON.parse(customJson);
        setTariffPlan(parsed);
        setError(null);
        onClose();
      } catch (e) {
        setError('Invalid JSON for custom tariff plan');
      }
    } else if (selectedPlan) {
      setTariffPlan(selectedPlan);
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="tariff-panel-title">
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <h2 id="tariff-panel-title" className={styles.title}>⚡ Tariff Selection</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close Tariff Panel">✕</button>
        </div>
        <div className={styles.body}>
          <label className={styles.fieldLabel}>Select a preset plan</label>
          <select
            className={styles.select}
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setError(null);
            }}
          >
            {STANDARD_TARIFF_PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.source})
              </option>
            ))}
            <option value="custom">Custom (JSON)</option>
          </select>

          {selectedId === 'custom' && (
            <textarea
              className={styles.textarea}
              placeholder="Paste a JSON representation of a TariffPlan…"
              value={customJson}
              onChange={(e) => setCustomJson(e.target.value)}
            />
          )}

          {error && <div className={styles.error}>⚠️ {error}</div>}
        </div>
        <div className={styles.footer}>
          <button className={styles.applyBtn} onClick={applyPlan} disabled={selectedId === 'custom' && !customJson}>
            Apply Plan
          </button>
        </div>
      </div>
    </div>
  );
}
