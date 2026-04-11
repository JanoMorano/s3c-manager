/**
 * §6.2 StatusPill — §2.2: status = pill. One pattern, no exceptions.
 * props: status — maps to SC service_status_code values
 */
import { cn } from '@/shared/utils/cn';
import styles from './StatusPill.module.css';

type Status = 'active' | 'planned' | 'retired' | 'deprecated' | 'draft' | string;

const LABELS: Record<string, string> = {
  active:     'Active',
  planned:    'Planned',
  retired:    'Retired',
  deprecated: 'Deprecated',
  draft:      'Draft',
};

interface StatusPillProps {
  status: Status;
  size?: 'sm' | 'md';
}

export function StatusPill({ status, size = 'md' }: StatusPillProps) {
  const key = (status ?? '').toLowerCase();
  return (
    <span className={cn(styles.pill, styles[key], size === 'sm' && styles.sm)}>
      {LABELS[key] ?? status}
    </span>
  );
}
