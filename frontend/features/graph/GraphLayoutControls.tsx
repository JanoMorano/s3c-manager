'use client';

import { RotateCcw } from 'lucide-react';
import { useT } from '@/app/i18n/useI18n';
import styles from './GraphLegend.module.css';

interface GraphLayoutControlsProps {
  canSave: boolean;
  hasCustomLayout: boolean;
  saveError: boolean;
  onReset: () => void;
}

/** Status of the saved node layout of a graph view, with a reset to the automatic layout. */
export function GraphLayoutControls({ canSave, hasCustomLayout, saveError, onReset }: GraphLayoutControlsProps) {
  const t = useT();
  const status = saveError
    ? t('graph.layout.save_failed')
    : canSave
      ? t('graph.layout.drag_to_save')
      : t('graph.layout.drag_local');
  return (
    <div className={styles.layoutControls} role="group" aria-label={t('graph.layout.title')}>
      <span className={saveError ? styles.layoutError : styles.layoutHint}>{status}</span>
      {hasCustomLayout && (
        <button type="button" className={styles.layoutReset} onClick={onReset}>
          <RotateCcw size={12} aria-hidden="true" />
          {t('graph.layout.reset')}
        </button>
      )}
    </div>
  );
}
