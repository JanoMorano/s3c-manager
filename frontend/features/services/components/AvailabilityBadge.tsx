/**
 * §6.2 AvailabilityBadge — §2.2: availability = badge. One pattern.
 * Accepts numeric SLA % or string level (high/medium/low).
 */
import { cn } from '@/shared/utils/cn';
import styles from './AvailabilityBadge.module.css';

type Level = 'high' | 'medium' | 'low';

function pctToLevel(pct: number | null | undefined): Level {
  if (pct == null) return 'low';
  if (pct >= 99)   return 'high';
  if (pct >= 95)   return 'medium';
  return 'low';
}

interface AvailabilityBadgeProps {
  level?: Level;
  pct?: number | null;
  showLabel?: boolean;
}

export function AvailabilityBadge({ level, pct, showLabel = true }: AvailabilityBadgeProps) {
  const resolved: Level = level ?? pctToLevel(pct);
  const LABELS: Record<Level, string> = {
    high:   pct != null ? `${pct}%` : 'High',
    medium: pct != null ? `${pct}%` : 'Medium',
    low:    pct != null ? `${pct}%` : 'Low',
  };
  return (
    <span className={cn(styles.badge, styles[resolved])}>
      <span className={styles.dot} />
      {showLabel && <span>{LABELS[resolved]}</span>}
    </span>
  );
}
