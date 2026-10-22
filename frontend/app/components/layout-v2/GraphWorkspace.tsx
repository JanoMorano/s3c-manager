'use client';

import { useState, type ReactNode } from 'react';
import { useT } from '@/app/i18n/useI18n';
import styles from './GraphWorkspace.module.css';

export interface GraphWorkspaceProps {
  title?: string;
  purpose?: string;
  toolbar: ReactNode;
  canvas: ReactNode;
  detail?: ReactNode;
  detailPanelContent?: ReactNode;
  onDetailPanelClose?: () => void;
  detailOpen?: boolean;
  onDetailOpenChange?: (open: boolean) => void;
  canvasOnly?: boolean;
  canvasOnlyLabel?: string;
  restoreWorkspaceLabel?: string;
  onCanvasOnlyChange?: (canvasOnly: boolean) => void;
  showWorkspaceActions?: boolean;
}

export default function GraphWorkspace({
  title: titleProp,
  purpose,
  toolbar,
  canvas,
  detail,
  detailPanelContent,
  onDetailPanelClose,
  detailOpen: controlledDetailOpen,
  onDetailOpenChange,
  canvasOnly = false,
  canvasOnlyLabel: canvasOnlyLabelProp,
  restoreWorkspaceLabel: restoreWorkspaceLabelProp,
  onCanvasOnlyChange,
  showWorkspaceActions = true,
}: GraphWorkspaceProps) {
  const t = useT();
  const title = titleProp ?? t('layout.graph_workspace.title');
  const canvasOnlyLabel = canvasOnlyLabelProp ?? t('layout.graph_workspace.canvas_only');
  const restoreWorkspaceLabel = restoreWorkspaceLabelProp ?? t('layout.graph_workspace.restore_panels');
  const detailContent = detailPanelContent ?? detail;
  const [internalDetailOpen, setInternalDetailOpen] = useState(true);
  const detailOpen = controlledDetailOpen ?? internalDetailOpen;
  const canUseCanvasOnly = Boolean(onCanvasOnlyChange);

  function updateDetailOpen(open: boolean) {
    if (controlledDetailOpen == null) setInternalDetailOpen(open);
    onDetailOpenChange?.(open);
    if (!open) onDetailPanelClose?.();
  }

  return (
    <section
      className={`${styles.workspace} ${detailOpen ? '' : styles.workspaceDetailClosed} ${canvasOnly ? styles.workspaceCanvasOnly : ''}`}
      aria-label={title}
    >
      {!canvasOnly && (
      <aside className={styles.toolbar}>
        {(title || purpose) && (
          <div className={styles.toolbarHeader}>
            <div>
              {title ? <strong>{title}</strong> : null}
              {purpose ? <span>{purpose}</span> : null}
            </div>
            <div className={styles.toolbarActions}>
              {showWorkspaceActions && canUseCanvasOnly ? (
                <button
                  type="button"
                  className={styles.detailToggle}
                  aria-pressed={canvasOnly}
                  onClick={() => onCanvasOnlyChange?.(true)}
                >
                  {canvasOnlyLabel}
                </button>
              ) : null}
              {showWorkspaceActions ? (
                <button
                  type="button"
                  className={styles.detailToggle}
                  aria-expanded={detailOpen}
                  onClick={() => updateDetailOpen(!detailOpen)}
                >
                  {t('layout.graph_workspace.detail')}
                </button>
              ) : null}
            </div>
          </div>
        )}
        {toolbar}
      </aside>
      )}
      <div className={styles.canvas}>
        {showWorkspaceActions && canvasOnly ? (
          <button type="button" className={styles.floatingDetailToggle} onClick={() => onCanvasOnlyChange?.(false)}>
            {restoreWorkspaceLabel}
          </button>
        ) : null}
        {showWorkspaceActions && !canvasOnly && !detailOpen && (
          <button type="button" className={styles.floatingDetailToggle} onClick={() => updateDetailOpen(true)}>
            {t('layout.graph_workspace.detail_panel')}
          </button>
        )}
        {canvas}
      </div>
      {!canvasOnly && detailOpen && (
        <aside className={styles.detail}>
          {showWorkspaceActions ? (
            <button type="button" className={styles.closeButton} onClick={() => updateDetailOpen(false)}>
              {t('layout.graph_workspace.collapse')}
            </button>
          ) : null}
          {detailContent}
        </aside>
      )}
    </section>
  );
}
