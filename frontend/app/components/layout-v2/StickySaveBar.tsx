import styles from './StickySaveBar.module.css';

export type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

interface StickySaveBarProps {
  state: SaveState;
  message?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  publishLabel?: string;
  disabled?: boolean;
  publishDisabled?: boolean;
  onSave: () => void;
  onPublish?: () => void;
  onDiscard?: () => void;
}

const STATE_LABELS: Record<SaveState, string> = {
  clean: 'Beze změn',
  dirty: 'Neuložené změny',
  saving: 'Ukládám',
  saved: 'Uloženo',
  error: 'Chyba uložení',
};

export default function StickySaveBar({
  state,
  message,
  primaryLabel = 'Uložit změny',
  secondaryLabel = 'Zahodit',
  publishLabel = 'Publikovat',
  disabled = false,
  publishDisabled = false,
  onSave,
  onPublish,
  onDiscard,
}: StickySaveBarProps) {
  return (
    <div className={styles.wrap} role="region" aria-label="Save status">
      <div className={styles.panel}>
        <div className={styles.status}>
          <span className={`${styles.dot} ${styles[`state_${state}`]}`} aria-hidden="true" />
          <strong>{STATE_LABELS[state]}</strong>
          {message ? <span>{message}</span> : null}
        </div>
        <div className={styles.actions}>
          {onDiscard ? (
            <button type="button" className={styles.secondary} onClick={onDiscard} disabled={state === 'saving'}>
              {secondaryLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.primary}
            onClick={onSave}
            disabled={disabled || state === 'saving' || state === 'clean'}
          >
            {state === 'saving' ? 'Ukládám...' : primaryLabel}
          </button>
          {onPublish ? (
            <button
              type="button"
              className={styles.publish}
              onClick={onPublish}
              disabled={publishDisabled || state === 'saving'}
            >
              {publishLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
