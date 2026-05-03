import type { ReactNode } from 'react';
import styles from './KpiCard.module.css';

export type KpiCardTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export type KpiTrend = 'up' | 'down' | 'neutral';

interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** Colored left-border accent */
  tone?: KpiCardTone;
  /** Optional trend arrow shown next to value */
  trend?: KpiTrend;
  /** Small text describing the trend, e.g. "+3 tento měsíc" */
  trendLabel?: string;
}

export function KpiCard({ label, value, hint, tone = 'neutral', trend, trendLabel }: KpiCardProps) {
  return (
    <article className={`${styles.card} ${styles[`tone_${tone}`]}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.valueRow}>
        <strong className={styles.value}>{value}</strong>
        {trend && trend !== 'neutral' && (
          <span className={`${styles.trendArrow} ${styles[`trend_${trend}`]}`} aria-hidden="true">
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </span>
      {trendLabel && (
        <span className={`${styles.trendLabel} ${trend ? styles[`trendLabel_${trend}`] : ''}`}>
          {trendLabel}
        </span>
      )}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </article>
  );
}
