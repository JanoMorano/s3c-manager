import styles from './WizardStepTracker.module.css';

export type WizardStepState = 'done' | 'active' | 'blocked' | 'todo';

export interface WizardStep {
  id: string;
  label: string;
  state?: WizardStepState;
  hint?: string;
}

interface WizardStepTrackerProps {
  steps: WizardStep[];
  activeId?: string;
}

export default function WizardStepTracker({ steps, activeId }: WizardStepTrackerProps) {
  return (
    <ol className={styles.steps} aria-label="Wizard steps">
      {steps.map((step, index) => {
        const state = step.id === activeId ? 'active' : step.state ?? 'todo';
        return (
          <li key={step.id} className={`${styles.step} ${styles[`state_${state}`]}`}>
            <span className={styles.index}>{index + 1}</span>
            <span className={styles.text}>
              <strong>{step.label}</strong>
              {step.hint ? <span>{step.hint}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
