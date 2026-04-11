/**
 * §6.2 MetadataItem — key-value pair. §2.2: metadata = key-value pair.
 * kind: text | link | badge | person | date
 */
import { format } from 'date-fns';
import styles from './MetadataItem.module.css';

type Kind = 'text' | 'link' | 'badge' | 'person' | 'date';

interface MetadataItemProps {
  label: string;
  value: string | number | null | undefined;
  kind?: Kind;
  href?: string;
}

export function MetadataItem({ label, value, kind = 'text', href }: MetadataItemProps) {
  const empty = value == null || value === '';

  function renderValue() {
    if (empty) return <span className={styles.empty}>—</span>;
    switch (kind) {
      case 'link':
        return <a href={href ?? String(value)} target="_blank" rel="noreferrer" className={styles.link}>{String(value)}</a>;
      case 'date':
        try {
          return <span>{format(new Date(String(value)), 'dd MMM yyyy')}</span>;
        } catch {
          return <span>{String(value)}</span>;
        }
      case 'person':
        return <span className={styles.person}>{String(value)}</span>;
      default:
        return <span>{String(value)}</span>;
    }
  }

  return (
    <div className={styles.item}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{renderValue()}</dd>
    </div>
  );
}

// ── MetadataGrid — wraps multiple MetadataItems ──────────────────────────────
interface MetadataGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}
export function MetadataGrid({ children, columns = 3 }: MetadataGridProps) {
  return (
    <dl className={styles.grid} style={{ '--cols': columns } as React.CSSProperties}>
      {children}
    </dl>
  );
}
