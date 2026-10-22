'use client';

import { useMemo, useState } from 'react';
import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { Badge, EmptyState } from '@/design-system/controls';
import type { BadgeVariant } from '@/design-system/controls';
import { usePortfolioCapabilities, usePortfolioList, usePortfolioServiceScope } from '@/features/services/hooks/useServices';
import type { ServicePortfolioLevel3Capability, ServicePortfolioService } from '@/features/services/model/service.types';
import { useT } from '@/app/i18n/useI18n';
import { resolveCountForm } from '@/app/lib/counts';
import styles from './portfolio.module.css';

type PortfolioServiceFilter =
  | 'all'
  | 'active'
  | 'planned'
  | 'retiring'
  | 'requestable'
  | 'overdue'
  | 'due_soon'
  | 'missing_owner'
  | 'readiness_blocked';

type Translate = ReturnType<typeof useT>;

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('en');
}

function countKey(base: string, value: number) {
  return `${base}.${resolveCountForm(value, { one: 'one', few: 'few', many: 'many' })}`;
}

function statusTone(status: string | null | undefined): BadgeVariant {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'active') return 'success';
  if (normalized === 'planning' || normalized === 'draft' || normalized === 'design') return 'warning';
  if (normalized === 'retired' || normalized === 'inactive') return 'neutral';
  return 'info';
}

function statusSortValue(status: string | null | undefined) {
  const normalized = String(status ?? '').toLowerCase();
  const order: Record<string, number> = {
    active: 10,
    planning: 20,
    planned: 20,
    design: 30,
    draft: 40,
    retiring: 50,
    deprecated: 60,
    retired: 70,
    inactive: 80,
  };
  return order[normalized] ?? 90;
}

function spiralLabel(value: string | null | undefined, t: Translate) {
  return value ? value.replace('_', ' ') : t('portfolio.spiral_missing');
}

function spiralSortValue(value: string | null | undefined) {
  const parsed = String(value ?? '').match(/(\d+)/)?.[1];
  return parsed ? Number(parsed) : Number.MAX_SAFE_INTEGER;
}

function isReviewOverdue(value: string | null | undefined) {
  if (!value) return false;
  const due = new Date(value);
  return Number.isFinite(due.getTime()) && due.getTime() < Date.now();
}

function formatDate(value: string | null | undefined, t: Translate) {
  if (!value) return t('portfolio.due_missing');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return t('portfolio.due_missing');
  return date.toLocaleDateString('cs-CZ');
}

// Completeness is a data-quality score. Whether a service blocks publishing
// comes from the readiness rules (readiness_blocked), as on the readiness gate.
function completenessTone(score: number | null | undefined): BadgeVariant {
  const value = Number(score ?? 0);
  if (value >= 80) return 'success';
  if (value >= 50) return 'warning';
  return 'danger';
}

function completenessLabel(score: number | null | undefined, t: Translate) {
  return t('portfolio.completeness', { score: Math.round(Number(score ?? 0)) });
}

function serviceOwner(service: ServicePortfolioService) {
  return service.service_owner ?? service.manager ?? service.vlastnik ?? null;
}

function serviceHasMissingOwner(service: ServicePortfolioService) {
  return Boolean(service.owner_missing) || !serviceOwner(service);
}

function serviceMeta(service: ServicePortfolioService, t: Translate) {
  const tags = [
    service.service_id,
    service.service_type ?? t('portfolio.type_missing'),
    service.primary_capability_title ?? service.primary_capability_code ?? t('portfolio.capability_missing'),
  ];
  return tags.filter(Boolean).join(' · ');
}

function capabilityServices(capability: ServicePortfolioLevel3Capability) {
  return capability.services ?? [];
}

function capabilityAction(capability: ServicePortfolioLevel3Capability, t: Translate): { label: string; detail: string; tone: BadgeVariant } {
  if (Number(capability.service_count ?? 0) === 0) {
    return {
      label: t('portfolio.action.empty.label'),
      detail: t('portfolio.action.empty.detail'),
      tone: 'warning',
    };
  }
  if (Number(capability.readiness_blocker_count ?? 0) > 0) {
    return {
      label: t('portfolio.action.readiness.label'),
      detail: t('portfolio.action.readiness.detail'),
      tone: 'danger',
    };
  }
  if (Number(capability.missing_owner_count ?? 0) > 0) {
    return {
      label: t('portfolio.action.owner.label'),
      detail: t('portfolio.action.owner.detail'),
      tone: 'warning',
    };
  }
  if (Number(capability.overdue_review_count ?? 0) > 0) {
    return {
      label: t('portfolio.action.review.label'),
      detail: t('portfolio.action.review.detail'),
      tone: 'danger',
    };
  }
  return {
    label: t('portfolio.action.covered.label'),
    detail: t('portfolio.action.covered.detail'),
    tone: 'success',
  };
}

function compareCapabilities(left: ServicePortfolioLevel3Capability, right: ServicePortfolioLevel3Capability) {
  return (
    statusSortValue(left.status_code) - statusSortValue(right.status_code)
    || spiralSortValue(left.spiral_code) - spiralSortValue(right.spiral_code)
    || String(left.parent_portfolio_title ?? '').localeCompare(String(right.parent_portfolio_title ?? ''), 'cs', { sensitivity: 'base' })
    || String(left.capability_title ?? '').localeCompare(String(right.capability_title ?? ''), 'cs', { sensitivity: 'base' })
    || String(left.capability_code ?? '').localeCompare(String(right.capability_code ?? ''), 'cs', { sensitivity: 'base' })
  );
}

function KpiFilterButton({
  label,
  value,
  hint,
  active,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  active: boolean;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.kpiFilterButton} ${styles[`kpiFilter_${tone}`]} ${active ? styles.kpiFilterButtonActive : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
      <small>{hint}</small>
    </button>
  );
}

export default function PortfolioPage() {
  const t = useT();
  const { data, isLoading, error } = usePortfolioList();
  const {
    data: capabilitiesData,
    isLoading: capabilitiesLoading,
    error: capabilitiesError,
  } = usePortfolioCapabilities();
  const [capabilityStatusFilter, setCapabilityStatusFilter] = useState('');
  const [spiralFilter, setSpiralFilter] = useState('');
  const [level2Filter, setLevel2Filter] = useState('');
  const [serviceFilter, setServiceFilter] = useState<PortfolioServiceFilter | null>(null);
  const { data: serviceScopeData, isLoading: servicesLoading, error: servicesError } = usePortfolioServiceScope(serviceFilter ?? 'all');

  const portfolios = useMemo(() => data?.items ?? [], [data?.items]);
  const capabilities = useMemo(() => capabilitiesData?.items ?? [], [capabilitiesData?.items]);

  const capabilityStatusOptions = useMemo(
    () => Array.from(new Set(capabilities.map((item) => item.status_code).filter((status): status is string => Boolean(status)))).sort(),
    [capabilities],
  );
  const spiralOptions = useMemo(
    () => Array.from(new Set(capabilities.map((item) => item.spiral_code).filter((spiral): spiral is string => Boolean(spiral))))
      .sort((left, right) => spiralSortValue(left) - spiralSortValue(right)),
    [capabilities],
  );
  const level2Options = useMemo(
    () => Array.from(new Map(capabilities.map((item) => [item.parent_portfolio_code, item.parent_portfolio_title])).entries())
      .filter((entry): entry is [string, string] => Boolean(entry[0]) && Boolean(entry[1]))
      .sort((left, right) => String(left[1]).localeCompare(String(right[1]), 'cs', { sensitivity: 'base' })),
    [capabilities],
  );

  const filteredCapabilities = useMemo(
    () => capabilities
      .filter((capability) => !capabilityStatusFilter || capability.status_code === capabilityStatusFilter)
      .filter((capability) => !spiralFilter || capability.spiral_code === spiralFilter)
      .filter((capability) => !level2Filter || capability.parent_portfolio_code === level2Filter)
      .slice()
      .sort(compareCapabilities),
    [capabilities, capabilityStatusFilter, level2Filter, spiralFilter],
  );

  const capabilityTotals = capabilities.reduce(
    (acc, capability) => {
      acc.level3 += 1;
      acc.empty += Number(capability.service_count ?? 0) === 0 ? 1 : 0;
      acc.services += Number(capability.service_count ?? 0);
      acc.active += Number(capability.active_service_count ?? 0);
      acc.requestable += Number(capability.requestable_service_count ?? 0);
      acc.overdue += Number(capability.overdue_review_count ?? 0);
      acc.dueSoon += Number(capability.due_soon_review_count ?? 0);
      acc.missingOwner += Number(capability.missing_owner_count ?? 0);
      acc.readinessBlocked += Number(capability.readiness_blocker_count ?? 0);
      return acc;
    },
    { level3: 0, empty: 0, services: 0, active: 0, requestable: 0, overdue: 0, dueSoon: 0, missingOwner: 0, readinessBlocked: 0 },
  );

  const portfolioTotals = portfolios.reduce(
    (acc, portfolio) => {
      acc.planned += Number(portfolio.draft_service_count ?? 0);
      acc.retiring += Number(portfolio.retiring_service_count ?? 0) + Number(portfolio.retired_service_count ?? 0);
      acc.activeReviews += Number(portfolio.active_governance_review_count ?? 0);
      return acc;
    },
    { planned: 0, retiring: 0, activeReviews: 0 },
  );

  const serviceTotals = {
    services: Number(serviceScopeData?.totals?.service_count ?? capabilityTotals.services),
    active: Number(serviceScopeData?.totals?.active_service_count ?? capabilityTotals.active),
    planned: Number(serviceScopeData?.totals?.planned_service_count ?? portfolioTotals.planned),
    retiring: Number(serviceScopeData?.totals?.retiring_service_count ?? portfolioTotals.retiring),
    requestable: Number(serviceScopeData?.totals?.requestable_service_count ?? capabilityTotals.requestable),
    overdue: Number(serviceScopeData?.totals?.overdue_review_count ?? capabilityTotals.overdue),
    dueSoon: Number(serviceScopeData?.totals?.due_soon_review_count ?? capabilityTotals.dueSoon),
    missingOwner: Number(serviceScopeData?.totals?.missing_owner_count ?? capabilityTotals.missingOwner),
    readinessBlocked: Number(serviceScopeData?.totals?.readiness_blocker_count ?? capabilityTotals.readinessBlocked),
    activeReviews: Number(serviceScopeData?.totals?.active_governance_review_count ?? portfolioTotals.activeReviews),
  };
  const serviceFilterOptions: Array<{
    id: PortfolioServiceFilter;
    label: string;
    value: number;
    hint: string;
    tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  }> = [
    { id: 'all', label: t('portfolio.filter.all.label'), value: serviceTotals.services, hint: t('portfolio.filter.all.hint'), tone: 'info' },
    { id: 'active', label: t('common.active'), value: serviceTotals.active, hint: t('portfolio.filter.active.hint'), tone: 'success' },
    { id: 'planned', label: t('portfolio.filter.planned.label'), value: serviceTotals.planned, hint: t('portfolio.filter.planned.hint'), tone: 'warning' },
    { id: 'retiring', label: t('portfolio.filter.retiring.label'), value: serviceTotals.retiring, hint: t('portfolio.filter.retiring.hint'), tone: 'neutral' },
    { id: 'requestable', label: t('service_list.row.requestable'), value: serviceTotals.requestable, hint: t('portfolio.filter.requestable.hint'), tone: 'neutral' },
    { id: 'overdue', label: t('portfolio.filter.overdue.label'), value: serviceTotals.overdue, hint: t('portfolio.filter.overdue.hint'), tone: serviceTotals.overdue > 0 ? 'danger' : 'success' },
    { id: 'due_soon', label: t('portfolio.filter.due_soon.label'), value: serviceTotals.dueSoon, hint: t('portfolio.filter.due_soon.hint'), tone: serviceTotals.dueSoon > 0 ? 'warning' : 'success' },
    { id: 'missing_owner', label: t('service_list.readiness_option.missing_owner'), value: serviceTotals.missingOwner, hint: t('service_list.quick_filter.missing_owner.hint'), tone: serviceTotals.missingOwner > 0 ? 'danger' : 'success' },
    { id: 'readiness_blocked', label: t('portfolio.filter.readiness_blocked.label'), value: serviceTotals.readinessBlocked, hint: t('portfolio.filter.readiness_blocked.hint'), tone: serviceTotals.readinessBlocked > 0 ? 'danger' : 'success' },
  ];
  const selectedFilter = serviceFilterOptions.find((option) => option.id === serviceFilter);
  const filteredServices = serviceFilter ? serviceScopeData?.items ?? [] : [];

  return (
    <main className={styles.shell}>
      <PageHeader
        title={t('portfolio.title')}
        purpose={t('portfolio.purpose')}
        primaryAction={{ label: t('nav.sidebar.service_catalogue'), href: '/catalogue' }}
      />

      <section className={styles.kpiGrid} aria-label={t('portfolio.kpi.aria')}>
        {serviceFilterOptions.map((option) => (
          <KpiFilterButton
            key={option.id}
            label={option.label}
            value={option.value}
            hint={option.hint}
            tone={option.tone}
            active={serviceFilter === option.id}
            onClick={() => setServiceFilter((current) => (current === option.id ? null : option.id))}
          />
        ))}
      </section>

      {serviceFilter && (
        <section className={styles.card} aria-live="polite" aria-label={t('portfolio.filtered.aria')}>
          <div className={styles.cardHeader}>
            <div>
              <small>{t('portfolio.filtered.eyebrow')}</small>
              <h2>{t('portfolio.filtered.title', { filter: selectedFilter?.label ?? t('portfolio.filter.all.label') })}</h2>
            </div>
            <Badge variant={serviceFilter === 'overdue' && filteredServices.length > 0 ? 'danger' : 'neutral'}>
              {t(countKey('portfolio.services_count', filteredServices.length), { count: formatNumber(filteredServices.length) })}
            </Badge>
          </div>
          {servicesLoading ? (
            <div className={styles.state}>{t('service_list.state.loading')}</div>
          ) : servicesError ? (
            <div className={styles.state}>{t('portfolio.filtered.error')}</div>
          ) : filteredServices.length === 0 ? (
            <EmptyState title={t('portfolio.filtered.empty')} />
          ) : (
            <div className={styles.serviceRows}>
              {filteredServices.map((service) => (
                <Link key={service.service_id} href={`/services/${service.service_id}`} className={styles.serviceRow}>
                  <span>
                    <strong>{service.title}</strong>
                    <small>{serviceMeta(service, t)}</small>
                    <small>
                      {t('portfolio.service_row.owner_review', { owner: serviceOwner(service) ?? t('portfolio.owner_missing'), date: formatDate(service.review_due_at, t) })}
                    </small>
                  </span>
                  <span className={styles.rowBadges}>
                    {service.requestable ? <Badge variant="info">{t('service_list.row.requestable')}</Badge> : null}
                    <Badge variant={completenessTone(service.completeness_score)}>
                      {completenessLabel(service.completeness_score, t)}
                    </Badge>
                    {serviceHasMissingOwner(service) ? <Badge variant="danger">{t('service_list.readiness_option.missing_owner')}</Badge> : null}
                    {service.readiness_blocked ? <Badge variant="danger">{t('portfolio.badge.blocks_readiness')}</Badge> : null}
                    {service.review_due_soon ? <Badge variant="warning">{t('portfolio.filter.due_soon.label')}</Badge> : null}
                    {isReviewOverdue(service.review_due_at) ? <Badge variant="danger">{t('portfolio.badge.overdue')}</Badge> : null}
                    {Number(service.active_review_count ?? 0) > 0 ? <Badge variant="info">{t(countKey('portfolio.badge.reviews', Number(service.active_review_count)), { count: formatNumber(service.active_review_count) })}</Badge> : null}
                    <Badge variant={statusTone(service.service_status)}>{service.service_status ?? t('portfolio.unknown_status')}</Badge>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section className={styles.toolbar} aria-label={t('portfolio.toolbar.aria')}>
        <label>
          <span>{t('common.status')}</span>
          <select aria-label={t('common.status')} value={capabilityStatusFilter} onChange={(event) => setCapabilityStatusFilter(event.target.value)}>
            <option value="">{t('portfolio.toolbar.all_statuses')}</option>
            {capabilityStatusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('portfolio.toolbar.spiral')}</span>
          <select aria-label={t('portfolio.toolbar.spiral')} value={spiralFilter} onChange={(event) => setSpiralFilter(event.target.value)}>
            <option value="">{t('portfolio.toolbar.all_spirals')}</option>
            {spiralOptions.map((spiral) => (
              <option key={spiral} value={spiral}>{spiralLabel(spiral, t)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('portfolio.toolbar.level2')}</span>
          <select aria-label={t('portfolio.toolbar.level2')} value={level2Filter} onChange={(event) => setLevel2Filter(event.target.value)}>
            <option value="">{t('portfolio.toolbar.all_level2')}</option>
            {level2Options.map(([code, title]) => (
              <option key={code} value={code}>{title}</option>
            ))}
          </select>
        </label>
        <span className={styles.sortHint}>{t('portfolio.toolbar.sort_hint')}</span>
      </section>

      {isLoading || capabilitiesLoading ? (
        <div className={styles.state}>{t('portfolio.state.loading')}</div>
      ) : error || capabilitiesError ? (
        <div className={styles.state}>{t('portfolio.state.error')}</div>
      ) : filteredCapabilities.length === 0 ? (
        <EmptyState title={t('portfolio.state.empty')} />
      ) : (
        <section className={styles.grid} aria-label={t('portfolio.grid.aria')}>
          {filteredCapabilities.map((capability) => {
            const action = capabilityAction(capability, t);
            const services = capabilityServices(capability);
            return (
              <article key={capability.capability_uuid} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <small>{capability.capability_code}</small>
                    <h2>{capability.capability_title}</h2>
                  </div>
                  <Badge variant={statusTone(capability.status_code)}>{capability.status_code ?? t('portfolio.unknown_status')}</Badge>
                </div>
                <p>
                  {t('portfolio.card.meta', { spiral: spiralLabel(capability.spiral_code, t), parent: capability.parent_portfolio_title })}
                </p>
                <div className={styles.actionHint}>
                  <Badge variant={action.tone}>{action.label}</Badge>
                  <span>{action.detail}</span>
                </div>
                <dl className={styles.metrics}>
                  <div>
                    <dt>{t('portfolio.filter.all.label')}</dt>
                    <dd>{formatNumber(capability.service_count)}</dd>
                  </div>
                  <div>
                    <dt>{t('common.active')}</dt>
                    <dd>{formatNumber(capability.active_service_count)}</dd>
                  </div>
                  <div>
                    <dt>{t('service_list.row.requestable')}</dt>
                    <dd>{formatNumber(capability.requestable_service_count)}</dd>
                  </div>
                  <div>
                    <dt>{t('portfolio.filter.overdue.label')}</dt>
                    <dd>{formatNumber(capability.overdue_review_count)}</dd>
                  </div>
                  <div>
                    <dt>{t('service_list.readiness_option.missing_owner')}</dt>
                    <dd>{formatNumber(capability.missing_owner_count)}</dd>
                  </div>
                  <div>
                    <dt>{t('portfolio.filter.readiness_blocked.label')}</dt>
                    <dd>{formatNumber(capability.readiness_blocker_count)}</dd>
                  </div>
                </dl>
                <div className={styles.ownerLine}>
                  <span>{t('portfolio.card.parent')}</span>
                  <strong>{capability.parent_portfolio_title}</strong>
                </div>
                {services.length === 0 ? (
                  <div className={styles.emptyCapability}>
                    {t('portfolio.card.empty')}
                  </div>
                ) : (
                  <div className={styles.serviceRows}>
                    {services.slice(0, 4).map((service) => (
                      <Link key={service.service_id} href={`/services/${service.service_id}`} className={styles.serviceRow}>
                        <span>
                          <strong>{service.title}</strong>
                          <small>
                            {t('portfolio.service_row.meta', { id: service.service_id, type: service.service_type ?? t('portfolio.type_missing'), owner: serviceOwner(service) ?? t('portfolio.owner_missing') })}
                          </small>
                        </span>
                        <span className={styles.rowBadges}>
                          {service.requestable ? <Badge variant="info">{t('service_list.row.requestable')}</Badge> : null}
                          <Badge variant={completenessTone(service.completeness_score)}>
                            {completenessLabel(service.completeness_score, t)}
                          </Badge>
                          {service.readiness_blocked ? <Badge variant="danger">{t('portfolio.badge.blocks_readiness')}</Badge> : null}
                          <Badge variant={statusTone(service.service_status)}>{service.service_status ?? t('portfolio.unknown_status')}</Badge>
                        </span>
                      </Link>
                    ))}
                    {services.length > 4 ? (
                      <span className={styles.moreServices}>{t(countKey('portfolio.card.more', services.length - 4), { count: formatNumber(services.length - 4) })}</span>
                    ) : null}
                  </div>
                )}
                <Link
                  href={`/c3/${encodeURIComponent(capability.capability_uuid)}`}
                  className={styles.serviceLink}
                  aria-label={t('portfolio.card.open_capability_aria', { title: capability.capability_title })}
                >
                  {t('portfolio.card.open_capability')}
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
