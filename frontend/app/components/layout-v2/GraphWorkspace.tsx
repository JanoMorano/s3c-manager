'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useT } from '@/app/i18n/useI18n';
import styles from './GraphWorkspace.module.css';

export interface GraphWorkspaceProps {
  title?: string;
  /** One short sentence about the view; shown as the title's tooltip. */
  purpose?: string;
  /** Short facts next to the title (counts, badges). */
  meta?: ReactNode;
  /** Compact controls in the bar above the canvas (filters, view switch, options). */
  toolbar?: ReactNode;
  /** Right-aligned actions in the bar (e.g. export). */
  actions?: ReactNode;
  canvas: ReactNode;
  detail?: ReactNode;
  detailPanelContent?: ReactNode;
  /** Heading of the detail panel. */
  detailTitle?: string;
  /** The detail panel is shown only while open; the canvas uses the full width otherwise. */
  detailOpen?: boolean;
  /** Shows a close button in the detail panel. */
  onDetailPanelClose?: () => void;
}

/**
 * Graph page shell: a one-row header with title and compact toolbar above a
 * full-width canvas, and a detail panel that opens beside the canvas on demand.
 */
export default function GraphWorkspace({
  title: titleProp,
  purpose,
  meta,
  toolbar,
  actions,
  canvas,
  detail,
  detailPanelContent,
  detailTitle,
  detailOpen: detailOpenProp,
  onDetailPanelClose,
}: GraphWorkspaceProps) {
  const t = useT();
  const title = titleProp ?? t('layout.graph_workspace.title');
  const detailContent = detailPanelContent ?? detail;
  const detailOpen = (detailOpenProp ?? Boolean(detailContent)) && Boolean(detailContent);

  return (
    <section
      className={`${styles.workspace} ${detailOpen ? styles.workspaceDetailOpen : ''}`}
      aria-label={title}
    >
      <header className={styles.bar}>
        <div className={styles.heading}>
          <h1 className={styles.title} title={purpose}>{title}</h1>
          {meta ? <div className={styles.meta}>{meta}</div> : null}
        </div>
        {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      <div className={styles.canvas}>
        {canvas}
      </div>
      {detailOpen && (
        <aside className={styles.detail} aria-label={detailTitle ?? t('layout.graph_workspace.detail')}>
          <div className={styles.detailHeader}>
            <h2 className={styles.detailTitle}>{detailTitle ?? t('layout.graph_workspace.detail')}</h2>
            {onDetailPanelClose ? (
              <button
                type="button"
                className={styles.closeButton}
                onClick={onDetailPanelClose}
                aria-label={t('layout.graph_workspace.close_detail')}
                title={t('layout.graph_workspace.close_detail')}
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className={styles.detailBody}>{detailContent}</div>
        </aside>
      )}
    </section>
  );
}
