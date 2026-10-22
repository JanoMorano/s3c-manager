'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { ControlButton } from '@xyflow/react';
import { Info, RotateCcw, X } from 'lucide-react';
import { useT } from '@/app/i18n/useI18n';
import styles from './GraphLegend.module.css';

const NOTE_STORAGE_KEY = 's3c.graph.layoutNoteDismissed';
const NOTE_EVENT = 's3c:graph-layout-note';

function readNoteDismissed(): boolean {
  try {
    return window.localStorage.getItem(NOTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeNoteDismissed(dismissed: boolean) {
  try {
    if (dismissed) window.localStorage.setItem(NOTE_STORAGE_KEY, '1');
    else window.localStorage.removeItem(NOTE_STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode); the note then shows each visit.
  }
  window.dispatchEvent(new Event(NOTE_EVENT));
}

function subscribeNote(onChange: () => void) {
  window.addEventListener(NOTE_EVENT, onChange);
  return () => window.removeEventListener(NOTE_EVENT, onChange);
}

/** Whether the one-line drag hint is hidden; shared by the note and the info control. */
function useNoteDismissed() {
  return useSyncExternalStore(subscribeNote, readNoteDismissed, () => true);
}

function useLayoutHint(canSave: boolean) {
  const t = useT();
  return canSave ? t('graph.layout.drag_to_save') : t('graph.layout.drag_local');
}

interface GraphLayoutControlButtonsProps {
  hasCustomLayout: boolean;
  onReset: () => void;
}

/** Extra buttons in the zoom controls: show the drag hint, reset to the automatic layout. */
export function GraphLayoutControlButtons({ hasCustomLayout, onReset }: GraphLayoutControlButtonsProps) {
  const t = useT();
  const dismissed = useNoteDismissed();
  const toggleNote = useCallback(() => writeNoteDismissed(!dismissed), [dismissed]);
  return (
    <>
      <ControlButton
        onClick={toggleNote}
        title={t('graph.layout.hint_toggle')}
        aria-label={t('graph.layout.hint_toggle')}
        aria-pressed={!dismissed}
      >
        <Info aria-hidden="true" />
      </ControlButton>
      {hasCustomLayout && (
        <ControlButton onClick={onReset} title={t('graph.layout.reset')} aria-label={t('graph.layout.reset')}>
          <RotateCcw aria-hidden="true" />
        </ControlButton>
      )}
    </>
  );
}

interface GraphLayoutNoteProps {
  canSave: boolean;
  saveError: boolean;
}

/** One-line, dismissible note about dragging nodes; a save error always shows. */
export function GraphLayoutNote({ canSave, saveError }: GraphLayoutNoteProps) {
  const t = useT();
  const dismissed = useNoteDismissed();
  const hint = useLayoutHint(canSave);
  if (saveError) {
    return <div className={`${styles.note} ${styles.layoutError}`} role="status">{t('graph.layout.save_failed')}</div>;
  }
  if (dismissed) return null;
  return (
    <div className={styles.note} role="note">
      <span className={styles.layoutHint}>{hint}</span>
      <button
        type="button"
        className={styles.noteClose}
        onClick={() => writeNoteDismissed(true)}
        aria-label={t('graph.layout.hint_dismiss')}
        title={t('graph.layout.hint_dismiss')}
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  );
}
