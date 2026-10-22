'use client';

import { useT } from '@/app/i18n/useI18n';
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

const STATE_LABEL_KEYS: Record<SaveState, string> = {
  clean: 'layout.save_bar.state.clean',
  dirty: 'layout.save_bar.state.dirty',
  saving: 'layout.save_bar.state.saving',
  saved: 'layout.save_bar.state.saved',
  error: 'layout.save_bar.state.error',
};

export default function StickySaveBar({
  state,
  message,
  primaryLabel,
  secondaryLabel,
  publishLabel,
  disabled = false,
  publishDisabled = false,
  onSave,
  onPublish,
  onDiscard,
}: StickySaveBarProps) {
  const t = useT();
  return (
    <div className={styles.wrap} role="region" aria-label={t('layout.save_bar.region_label')}>
      <div className={styles.panel}>
        <div className={styles.status}>
          <span className={`${styles.dot} ${styles[`state_${state}`]}`} aria-hidden="true" />
          <strong>{t(STATE_LABEL_KEYS[state])}</strong>
          {message ? <span>{message}</span> : null}
        </div>
        <div className={styles.actions}>
          {onDiscard ? (
            <button type="button" className={styles.secondary} onClick={onDiscard} disabled={state === 'saving'}>
              {secondaryLabel ?? t('layout.save_bar.discard')}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.primary}
            onClick={onSave}
            disabled={disabled || state === 'saving' || state === 'clean'}
          >
            {state === 'saving' ? t('layout.save_bar.saving_button') : primaryLabel ?? t('layout.save_bar.save_changes')}
          </button>
          {onPublish ? (
            <button
              type="button"
              className={styles.publish}
              onClick={onPublish}
              disabled={publishDisabled || state === 'saving'}
            >
              {publishLabel ?? t('layout.save_bar.publish')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
