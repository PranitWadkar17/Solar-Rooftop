import styles from './ProgressStepper.module.css';

interface Step {
  number: number;
  label: string;
}

const STEPS: Step[] = [
  { number: 1, label: 'Location' },
  { number: 2, label: 'Rooftop' },
  { number: 3, label: 'Solar' },
  { number: 4, label: 'Optimization' },
  { number: 5, label: 'Results' },
];

interface ProgressStepperProps {
  currentStep: number;
}

export function ProgressStepper({ currentStep }: ProgressStepperProps) {
  return (
    <div className={styles.stepper} role="navigation" aria-label="Assessment progress">
      {STEPS.map((step, i) => {
        const isActive = step.number === currentStep;
        const isCompleted = step.number < currentStep;
        const stateClass = isActive
          ? styles.active
          : isCompleted
          ? styles.completed
          : styles.upcoming;

        return (
          <div key={step.number} className={`${styles.step} ${stateClass}`}>
            <div className={styles.circle}>
              {isCompleted ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span>{String(step.number).padStart(2, '0')}</span>
              )}
            </div>
            <span className={styles.label}>{step.label}</span>
            {i < STEPS.length - 1 && <div className={styles.connector} />}
          </div>
        );
      })}
    </div>
  );
}
