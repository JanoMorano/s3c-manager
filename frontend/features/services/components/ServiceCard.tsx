/**
 * ServiceCard — grid-view card for the service catalogue list.
 * Shows: status dot, title, short description, lifecycle badge,
 * requestable chip, domain tags, owner avatar and readiness progress bar.
 */
import Link from '@/app/components/AppLink';
import { ProgressBar } from '@/design-system/controls';
import type { ServiceListItem } from '../model/service.types';
import styles from './ServiceCard.module.css';

const STATUS_COLOR: Record<string, string> = {
  active:     'var(--color-success)',
  live:       'var(--color-success)',
  deprecated: 'var(--color-warning)',
  retired:    'var(--color-text-muted)',
  draft:      'var(--color-info)',
  planned:    'var(--color-info)',
};

const LIFECYCLE_COLOR: Record<string, string> = {
  draft:        'neutral',
  under_review: 'info',
  approved:     'success',
  live:         'success',
  deprecated:   'warning',
  retired:      'danger',
};

function readinessTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface ServiceCardProps {
  service: ServiceListItem;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const statusColor = STATUS_COLOR[service.service_status ?? 'draft'] ?? 'var(--color-text-muted)';
  const lifecycleVariant = LIFECYCLE_COLOR[service.lifecycle_state ?? ''] ?? 'neutral';
  const completeness = service.completeness_score ?? 0;
  const ownerName = service.service_owner ?? service.vlastnik ?? null;
  const domains = service.available_on
    ? service.available_on.split(',').map(d => d.trim()).filter(Boolean)
    : [];

  return (
    <Link href={`/services/${service.service_id}`} className={styles.card}>
      {/* Top row: status dot + title + lifecycle badge */}
      <div className={styles.top}>
        <span
          className={styles.statusDot}
          style={{ background: statusColor }}
          title={service.service_status ?? 'unknown'}
        />
        <span className={styles.title}>{service.title}</span>
        {service.lifecycle_state && (
          <span className={`${styles.lifecycleBadge} ${styles[`lc_${lifecycleVariant}`]}`}>
            {service.lifecycle_state.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Description */}
      {service.short_description && (
        <p className={styles.desc}>{service.short_description}</p>
      )}

      {/* Chips row */}
      <div className={styles.chips}>
        {service.service_type && (
          <span className={styles.chip}>{service.service_type}</span>
        )}
        {service.requestable && (
          <span className={`${styles.chip} ${styles.chipRequestable}`}>Requestable</span>
        )}
        {service.portfolio_group && (
          <span className={styles.chip}>{service.portfolio_group}</span>
        )}
        {domains.slice(0, 3).map(d => (
          <span key={d} className={styles.domainChip}>{d}</span>
        ))}
        {domains.length > 3 && (
          <span className={styles.chip}>+{domains.length - 3}</span>
        )}
      </div>

      {/* Bottom row: owner + readiness score */}
      <div className={styles.bottom}>
        <div className={styles.ownerRow}>
          {ownerName ? (
            <>
              <span className={styles.avatar}>{initials(ownerName)}</span>
              <span className={styles.ownerName}>{ownerName}</span>
            </>
          ) : (
            <span className={styles.ownerMissing}>No owner</span>
          )}
        </div>
        <div className={styles.readiness}>
          <ProgressBar
            value={completeness}
            tone={readinessTone(completeness)}
            label={`${service.title} readiness`}
          />
          <span className={styles.readinessScore}>{completeness}%</span>
        </div>
      </div>
    </Link>
  );
}
