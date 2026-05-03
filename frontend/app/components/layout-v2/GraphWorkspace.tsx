'use client';

import { useState, type ReactNode } from 'react';
import styles from './GraphWorkspace.module.css';

export interface GraphWorkspaceProps {
  title?: string;
  purpose?: string;
  toolbar: ReactNode;
  canvas: ReactNode;
  detail?: ReactNode;
  detailPanelContent?: ReactNode;
  onDetailPanelClose?: () => void;
}

export default function GraphWorkspace({
  title = 'Graph workspace',
  purpose,
  toolbar,
  canvas,
  detail,
  detailPanelContent,
  onDetailPanelClose,
}: GraphWorkspaceProps) {
  const detailContent = detailPanelContent ?? detail;
  const [detailOpen, setDetailOpen] = useState(true);

  function collapseDetail() {
    setDetailOpen(false);
    onDetailPanelClose?.();
  }

  return (
    <section className={`${styles.workspace} ${detailOpen ? '' : styles.workspaceDetailClosed}`} aria-label={title}>
      <aside className={styles.toolbar}>
        {(title || purpose) && (
          <div className={styles.toolbarHeader}>
            <div>
              {title ? <strong>{title}</strong> : null}
              {purpose ? <span>{purpose}</span> : null}
            </div>
            <button
              type="button"
              className={styles.detailToggle}
              aria-expanded={detailOpen}
              onClick={() => setDetailOpen((open) => !open)}
            >
              Detail
            </button>
          </div>
        )}
        {toolbar}
      </aside>
      <div className={styles.canvas}>
        {!detailOpen && (
          <button type="button" className={styles.floatingDetailToggle} onClick={() => setDetailOpen(true)}>
            Detail panel
          </button>
        )}
        {canvas}
      </div>
      {detailOpen && (
        <aside className={styles.detail}>
          <button type="button" className={styles.closeButton} onClick={collapseDetail}>
            Collapse
          </button>
          {detailContent}
        </aside>
      )}
    </section>
  );
}
