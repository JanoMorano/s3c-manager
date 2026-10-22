'use client';

import Link from '@/app/components/AppLink';
import styles from './PageHeader.module.css';

export interface PageHeaderAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  title: string;
  /** One short sentence; longer explanations belong in help. */
  purpose: string;
  primaryAction?: PageHeaderAction | null;
}

// Status counts are shown once, in the page's KPI tiles — the header carries
// only the title, a one-line purpose and the page's single primary action.
export default function PageHeader({ title, purpose, primaryAction }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.purpose}>{purpose}</p>
      </div>
      {primaryAction && (
        <div className={styles.actions}>
          {primaryAction.href ? (
            <Link href={primaryAction.href} className={styles.primaryAction}>
              {primaryAction.label}
            </Link>
          ) : (
            <button type="button" className={styles.primaryAction} onClick={primaryAction.onClick}>
              {primaryAction.label}
            </button>
          )}
        </div>
      )}
    </header>
  );
}
