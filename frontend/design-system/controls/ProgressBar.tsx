import styles from './ProgressBar.module.css';

type ProgressTone = 'info' | 'success' | 'warning' | 'danger';

interface ProgressBarProps {
  value: number;
  tone?: ProgressTone;
  label?: string;
}

export function ProgressBar({ value, tone = 'info', label }: ProgressBarProps) {
  const normalized = Math.min(100, Math.max(0, value));
  const toneClass = tone === 'info' ? '' : styles[tone];

  return (
    <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalized} aria-label={label}>
      <span className={`${styles.bar} ${toneClass}`} style={{ width: `${normalized}%` }} />
    </div>
  );
}
