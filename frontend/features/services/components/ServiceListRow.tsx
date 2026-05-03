/**
 * §6.2 ServiceListRow — main catalogue list.
 * Columns: Service | Lifecycle | Owner | Readiness | Capability | C3 | Deps | Next action
 * Variants: density="compact" | "comfortable"
 */
import Link from '@/app/components/AppLink';
import { StatusPill } from './StatusPill';
import { ProgressBar } from '@/design-system/controls';
import { cn } from '@/shared/utils/cn';
import type { ServiceListItem } from '../model/service.types';
import type { SortField, SortOrder } from '../api/services.api';
import styles from './ServiceListRow.module.css';

function hasC3Mapping(service: ServiceListItem) {
  return service.has_c3_mapping === true || service.has_c3_mapping === 1 || (service.c3_mapping_count ?? 0) > 0;
}

function readinessTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

function readinessLabel(score: number, service: ServiceListItem) {
  if (score < 50) return `${score}% · blocker`;
  if (score < 80) return `${score}% · warning`;
  if (!service.short_description) return `${score}% · summary`;
  return `${score}% · ready`;
}

function ownerLabel(service: ServiceListItem) {
  return service.service_owner ?? service.vlastnik ?? service.manager ?? null;
}

function capabilityLabel(service: ServiceListItem) {
  return service.primary_capability_title ?? service.primary_capability_code ?? (hasC3Mapping(service) ? 'Mapped capability' : null);
}

function c3Count(service: ServiceListItem) {
  if (service.c3_mapping_count != null) return service.c3_mapping_count;
  return hasC3Mapping(service) ? 1 : 0;
}

function nextAction(service: ServiceListItem) {
  const score = service.completeness_score ?? 0;
  if (!ownerLabel(service)) return 'Přiřadit ownera';
  if (!hasC3Mapping(service)) return 'Doplnit capability';
  if (score < 50) return 'Doplnit readiness';
  if (score < 80) return 'Spustit review';
  if (service.lifecycle_state === 'under_review') return 'Schválit review';
  if (service.lifecycle_state === 'deprecated') return 'Ověřit náhradu';
  return 'Otevřít';
}

interface ServiceListRowProps {
  service: ServiceListItem;
  density?: 'compact' | 'comfortable';
  selected?: boolean;
}

export function ServiceListRow({ service, density = 'comfortable', selected }: ServiceListRowProps) {
  const score = service.completeness_score ?? 0;
  const owner = ownerLabel(service);
  const capability = capabilityLabel(service);
  const mappingCount = c3Count(service);
  const downstream = service.relation_count ?? 0;

  return (
    <Link
      href={`/services/${service.service_id}`}
      className={cn(styles.row, styles[density], selected && styles.selected)}
    >
      <div className={styles.colService}>
        <span className={styles.titleLine}>
          <span className={styles.title}>{service.title}</span>
          {service.requestable && <span className={styles.requestableChip}>Requestable</span>}
        </span>
        <span className={styles.serviceMeta}>{service.service_id} · {service.service_type ?? 'untyped'} · {service.portfolio_group ?? 'no portfolio'}</span>
        {density === 'comfortable' && service.short_description && <span className={styles.desc}>{service.short_description}</span>}
      </div>

      <div className={styles.colLifecycle}>
        <StatusPill status={service.lifecycle_state ?? service.service_status ?? 'draft'} size="sm" />
      </div>

      <div className={styles.colOwner}>
        {owner ? (
          <>
            <span className={styles.owner}>{owner}</span>
            {service.manager && service.manager !== owner && <span className={styles.ownerOrg}>{service.manager}</span>}
          </>
        ) : (
          <span className={styles.ownerMissing}>— bez ownera</span>
        )}
      </div>

      <div className={styles.colReadiness}>
        <ProgressBar value={score} tone={readinessTone(score)} label={`${service.title} readiness`} />
        <span className={styles.readinessText}>{readinessLabel(score, service)}</span>
      </div>

      <div className={styles.colCapability}>
        {capability ? (
          <span className={styles.capability}>{capability}</span>
        ) : (
          <span className={styles.capabilityMissing}>— nemapováno</span>
        )}
      </div>

      <div className={styles.colC3}>
        {mappingCount ? <span className={styles.counter}>{mappingCount}</span> : <span className={styles.muted}>—</span>}
      </div>

      <div className={styles.colDeps}>
        <span className={styles.dependencyCount}>{downstream} ↓</span>
        <span className={styles.muted}>/ {service.flavour_count ?? 0} offers</span>
      </div>

      <div className={styles.colNextAction}>
        <span>{nextAction(service)} →</span>
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
      <div className={styles.colService}>{label('title', 'Service')}</div>
      <div className={styles.colLifecycle}>{label('service_status', 'Lifecycle')}</div>
      <div className={styles.colOwner}>Owner</div>
      <div className={styles.colReadiness}>Readiness</div>
      <div className={styles.colCapability}>Capability</div>
      <div className={styles.colC3}>C3</div>
      <div className={styles.colDeps}>Deps</div>
      <div className={styles.colNextAction}>Next action</div>
    </div>
  );
}
