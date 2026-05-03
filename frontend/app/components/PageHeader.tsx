'use client';

import Link from '@/app/components/AppLink';
import styles from './PageHeader.module.css';

type ChipTone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info';

export interface PageHeaderChip {
  label: string;
  tone?: ChipTone;
}

export interface PageHeaderAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  title: string;
  purpose: string;
  chips?: PageHeaderChip[];
  primaryAction?: PageHeaderAction | null;
}

export default function PageHeader({ title, purpose, chips = [], primaryAction }: PageHeaderProps) {
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
      {chips.length > 0 && (
        <div className={styles.chips} aria-label="Page signals">
          {chips.map((chip) => (
            <span key={chip.label} className={`${styles.chip} ${styles[`chip_${chip.tone ?? 'neutral'}`]}`}>
              {chip.label}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}
