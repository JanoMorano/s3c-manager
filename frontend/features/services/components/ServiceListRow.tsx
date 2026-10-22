/**
 * §6.2 ServiceListRow — main catalogue list.
 * Columns: Service | Lifecycle | Owner | Readiness | Capability | Next action
 */
import Link from '@/app/components/AppLink';
import { StatusPill } from './StatusPill';
import { ProgressBar } from '@/design-system/controls';
import { cn } from '@/shared/utils/cn';
import type { ServiceListItem } from '../model/service.types';
import type { SortField, SortOrder } from '../api/services.api';
import { useT } from '@/app/i18n/useI18n';
import styles from './ServiceListRow.module.css';

function hasC3Mapping(service: ServiceListItem) {
  if (service.has_c3_mapping != null) return service.has_c3_mapping === true || service.has_c3_mapping === 1;
  return (service.c3_mapping_count ?? 0) > 0;
}

type ReadinessTone = 'success' | 'warning' | 'danger';

// Colour and label follow the readiness rules (the readiness gate); the bar
// shows completeness. Older payloads without readiness_state fall back to
// completeness bands.
function readinessTone(score: number, state: ServiceListItem['readiness_state']): ReadinessTone {
  if (state === 'blocked') return 'danger';
  if (state === 'warning') return 'warning';
  if (state === 'ready') return 'success';
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

function readinessStateKey(service: ServiceListItem) {
  if (service.readiness_state === 'blocked') return 'service_list.row.state.blocked';
  if (service.readiness_state === 'warning') return 'service_list.row.state.warning';
  if (service.readiness_state === 'ready') return 'service_list.row.state.ready';
  return null;
}

function ownerLabel(service: ServiceListItem) {
  return service.service_owner ?? service.vlastnik ?? service.manager ?? null;
}

function capabilityLabel(service: ServiceListItem) {
  return service.primary_capability_title ?? service.primary_capability_code ?? null;
}

function nextActionKey(service: ServiceListItem) {
  const score = service.completeness_score ?? 0;
  if (!ownerLabel(service)) return 'service_list.row.action.assign_owner';
  if (!hasC3Mapping(service)) return 'service_list.row.action.map_capability';
  if (service.readiness_state === 'blocked') return 'service_list.row.action.fix_readiness';
  if (service.readiness_state === 'warning' || score < 80) return 'service_list.row.action.start_review';
  if (service.lifecycle_state === 'deprecated') return 'service_list.row.action.verify_replacement';
  return 'service_list.row.action.open';
}

interface ServiceListRowProps {
  service: ServiceListItem;
  selected?: boolean;
}

export function ServiceListRow({ service, selected }: ServiceListRowProps) {
  const t = useT();
  const score = service.completeness_score ?? 0;
  const owner = ownerLabel(service);
  const stateKey = readinessStateKey(service);
  const capabilityMapped = hasC3Mapping(service);
  const issueCount = service.readiness_state === 'blocked'
    ? service.readiness_blocker_count ?? 0
    : service.readiness_state === 'warning'
      ? service.readiness_warning_count ?? 0
      : 0;
  const capability = capabilityLabel(service) ?? (capabilityMapped ? t('service_list.row.mapped_capability') : null);

  return (
    <Link
      href={`/services/${service.service_id}`}
      className={cn(styles.row, selected && styles.selected)}
    >
      <div className={styles.colService}>
        <span className={styles.titleLine}>
          <span className={styles.title}>{service.title}</span>
          {service.requestable && <span className={styles.requestableChip}>{t('service_list.row.requestable')}</span>}
        </span>
        <span className={styles.serviceMeta}>{service.service_id} · {service.service_type ?? t('service_list.row.untyped')} · {service.portfolio_group ?? t('service_list.row.no_portfolio')}</span>
        {service.short_description && <span className={styles.desc}>{service.short_description}</span>}
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
          <span className={styles.ownerMissing}>— {t('service_list.row.no_owner')}</span>
        )}
      </div>

      <div className={styles.colReadiness}>
        <ProgressBar value={score} tone={readinessTone(score, service.readiness_state)} label={t('service_list.row.completeness_aria', { title: service.title })} />
        <span className={styles.readinessText} title={t('service_list.row.readiness_title')}>
          {score} %
          {stateKey && <> · <span className={styles[`readiness_${service.readiness_state}`]}>{t(stateKey)}</span></>}
          {issueCount > 0 && <> ({issueCount})</>}
        </span>
      </div>

      <div className={styles.colCapability}>
        {capability ? (
          <span className={styles.capability}>{capability}</span>
        ) : (
          <span className={styles.capabilityMissing}>— {t('service_list.row.not_mapped')}</span>
        )}
      </div>

      <div className={styles.colNextAction}>
        <span>{t(nextActionKey(service))} →</span>
      </div>
    </Link>
  );
}

// ── Header row ────────────────────────────────────────────────────────────────
export function ServiceListHeader({
  sort,
  order,
  onSort,
}: {
  sort: SortField;
  order: SortOrder;
  onSort: (field: SortField) => void;
}) {
  const t = useT();
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
    <div className={cn(styles.row, styles.header)}>
      <div className={styles.colService}>{label('title', t('service_list.column.service'))}</div>
      <div className={styles.colLifecycle}>{label('service_status', t('service_list.column.lifecycle'))}</div>
      <div className={styles.colOwner}>{t('service_list.column.owner')}</div>
      <div className={styles.colReadiness}>{t('service_list.column.readiness')}</div>
      <div className={styles.colCapability}>{t('service_list.column.capability')}</div>
      <div className={styles.colNextAction}>{t('service_list.column.next_action')}</div>
    </div>
  );
}
