import type { ReactNode } from 'react';
import styles from './KpiCard.module.css';

interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}

export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <article className={styles.card}>
      <span className={styles.label}>{label}</span>
      <strong className={styles.value}>{value}</strong>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </article>
  );
}
