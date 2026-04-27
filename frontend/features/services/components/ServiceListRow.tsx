/**
 * §6.2 ServiceListRow — main catalogue list.
 * Columns: ID+Type | Title+ShortDesc | Portfolio | Domains | Availability | Status | Owner
 * Variants: density="compact" | "comfortable"
 */
import Link from '@/app/components/AppLink';
import { StatusPill } from './StatusPill';
import { AvailabilityBadge } from './AvailabilityBadge';
import { DomainDotGroup } from './DomainDotGroup';
import { cn } from '@/shared/utils/cn';
import type { ServiceListItem } from '../model/service.types';
import type { SortField, SortOrder } from '../api/services.api';
import styles from './ServiceListRow.module.css';

const LIFECYCLE_DOT_COLOR: Record<string, string> = {
  draft:        'var(--color-text-muted)',
  under_review: 'var(--color-info)',
  approved:     'var(--color-success)',
  live:         'var(--color-success)',
  deprecated:   'var(--color-warning)',
  retired:      'var(--color-danger)',
};

function LifecycleDot({ state }: { state: string }) {
  const color = LIFECYCLE_DOT_COLOR[state] ?? 'var(--color-text-muted)';
  const label = state.replace('_', ' ');
  return (
    <span
      className={styles.lifecycleDot}
      style={{ background: color }}
      title={`Lifecycle: ${label}`}
      aria-label={`Lifecycle: ${label}`}
    />
  );
}

function formatCost(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—';
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${Math.round(value / 1_000)}k`;
  return `€${value.toLocaleString('cs-CZ')}`;
}

interface ServiceListRowProps {
  service: ServiceListItem;
  density?: 'compact' | 'comfortable';
  selected?: boolean;
}

export function ServiceListRow({ service, density = 'comfortable', selected }: ServiceListRowProps) {
  return (
    <Link
      href={`/services/${service.service_id}`}
      className={cn(styles.row, styles[density], selected && styles.selected)}
    >
      {/* Col 1: ID + Type */}
      <div className={styles.colId}>
        <span className={styles.serviceId}>{service.service_id}</span>
        {service.service_type && (
          <span className={styles.typeChip}>{service.service_type}</span>
        )}
      </div>

      <div className={styles.colTitle}>
        <span className={styles.titleLine}>
          <span className={styles.title}>{service.title}</span>
          {service.requestable && <span className={styles.requestableChip}>Requestable</span>}
        </span>
        {density === 'comfortable' && service.short_description && (
          <span className={styles.desc}>{service.short_description}</span>
        )}
      </div>

      {/* Col 3: Portfolio group */}
      <div className={styles.colPortfolio}>
        <span className={styles.portfolio}>{service.portfolio_group ?? '—'}</span>
      </div>

      {/* Col 4: Domains */}
      <div className={styles.colDomains}>
        <DomainDotGroup domains={service.available_on} />
      </div>

      {/* Col 5: Availability */}
      <div className={styles.colAvail}>
        <AvailabilityBadge pct={service.sla_availability} />
      </div>

      <div className={styles.colStatus}>
        <StatusPill status={service.service_status ?? 'draft'} size="sm" />
        {service.lifecycle_state && (
          <LifecycleDot state={service.lifecycle_state} />
        )}
      </div>

      <div className={styles.colSignals}>
        <span>{service.flavour_count ?? 0} flavours</span>
        <span>{service.relation_count ?? 0} links</span>
        <strong>{formatCost(service.in_service_eur)}</strong>
      </div>

      <div className={styles.colOwner}>
        <span className={styles.owner}>{service.service_owner ?? '—'}</span>
      </div>
    </Link>
  );
}

// ── Header row ────────────────────────────────────────────────────────────────
export function ServiceListHeader({
  density = 'comfortable',
  sort,
  order,
  onSort,
}: {
  density?: 'compact' | 'comfortable';
  sort: SortField;
  order: SortOrder;
  onSort: (field: SortField) => void;
}) {
  const label = (field: SortField, text: string) => {
    const active = sort === field;
    const suffix = active ? (order === 'ASC' ? ' ↑' : ' ↓') : '';
    return (
      <button
        type="button"
        className={cn(styles.headerButton, active && styles.headerButtonActive)}
        onClick={() => onSort(field)}
      >
        {text}{suffix}
      </button>
    );
  };

  return (
    <div className={cn(styles.row, styles.header, styles[density])}>
      <div className={styles.colId}>{label('service_id', 'ID / Type')}</div>
      <div className={styles.colTitle}>{label('title', 'Title')}</div>
      <div className={styles.colPortfolio}>{label('portfolio_group', 'Portfolio')}</div>
      <div className={styles.colDomains}>Domains</div>
      <div className={styles.colAvail}>Availability</div>
      <div className={styles.colStatus}>{label('service_status', 'Status')}</div>
      <div className={styles.colSignals}>Signals</div>
      <div className={styles.colOwner}>Owner</div>
    </div>
  );
}
