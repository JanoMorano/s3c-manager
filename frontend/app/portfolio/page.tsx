'use client';

import { useMemo, useState } from 'react';
import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { Badge, EmptyState } from '@/design-system/controls';
import type { BadgeVariant } from '@/design-system/controls';
import { usePortfolioCapabilities, usePortfolioList, usePortfolioServiceScope } from '@/features/services/hooks/useServices';
import type { ServicePortfolioLevel3Capability, ServicePortfolioService } from '@/features/services/model/service.types';
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

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('en');
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

function spiralLabel(value: string | null | undefined) {
  return value ? value.replace('_', ' ') : 'Spirála chybí';
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

function formatDate(value: string | null | undefined) {
  if (!value) return 'termín chybí';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'termín chybí';
  return date.toLocaleDateString('cs-CZ');
}

function readinessTone(score: number | null | undefined): BadgeVariant {
  const value = Number(score ?? 0);
  if (value >= 80) return 'success';
  if (value >= 50) return 'warning';
  return 'danger';
}

function readinessLabel(score: number | null | undefined) {
  const value = Math.round(Number(score ?? 0));
  if (value >= 80) return `Připravenost ${value}%`;
  if (value >= 50) return `Doplnit připravenost ${value}%`;
  return `Blokuje připravenost ${value}%`;
}

function serviceOwner(service: ServicePortfolioService) {
  return service.service_owner ?? service.manager ?? service.vlastnik ?? null;
}

function serviceHasMissingOwner(service: ServicePortfolioService) {
  return Boolean(service.owner_missing) || !serviceOwner(service);
}

function serviceMeta(service: ServicePortfolioService) {
  const tags = [
    service.service_id,
    service.service_type ?? 'typ chybí',
    service.primary_capability_title ?? service.primary_capability_code ?? 'schopnost chybí',
  ];
  return tags.filter(Boolean).join(' · ');
}

function capabilityServices(capability: ServicePortfolioLevel3Capability) {
  return capability.services ?? [];
}

function capabilityAction(capability: ServicePortfolioLevel3Capability): { label: string; detail: string; tone: BadgeVariant } {
  if (Number(capability.service_count ?? 0) === 0) {
    return {
      label: 'Prázdná schopnost',
      detail: 'C3 level 3 schopnost je v portfoliu, ale zatím na ni není namapovaná žádná služba.',
      tone: 'warning',
    };
  }
  if (Number(capability.readiness_blocker_count ?? 0) > 0) {
    return {
      label: 'Řešit připravenost',
      detail: 'Některé mapované služby nejsou připravené na řízení nebo publikaci.',
      tone: 'danger',
    };
  }
  if (Number(capability.missing_owner_count ?? 0) > 0) {
    return {
      label: 'Doplnit vlastníka',
      detail: 'Některé mapované služby nemají aktivního vlastníka služby.',
      tone: 'warning',
    };
  }
  if (Number(capability.overdue_review_count ?? 0) > 0) {
    return {
      label: 'Revize po termínu',
      detail: 'Některé mapované služby potřebují aktualizovat termíny revizí.',
      tone: 'danger',
    };
  }
  return {
    label: 'Schopnost pokrytá',
    detail: 'C3 level 3 schopnost má mapované služby bez hlavních viditelných bloků.',
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
    { id: 'all', label: 'Služby', value: serviceTotals.services, hint: 'Všechny služby mapované na C3 level 3 schopnosti', tone: 'info' },
    { id: 'active', label: 'Aktivní', value: serviceTotals.active, hint: 'Služby v provozu, které tvoří současnou hodnotu', tone: 'success' },
    { id: 'planned', label: 'Návrh/design', value: serviceTotals.planned, hint: 'Služby ve vzniku nebo přípravě změny', tone: 'warning' },
    { id: 'retiring', label: 'Končící', value: serviceTotals.retiring, hint: 'Služby ve stavu ukončování, zastarání nebo ukončeno', tone: 'neutral' },
    { id: 'requestable', label: 'Objednatelné', value: serviceTotals.requestable, hint: 'Služby s katalogovým vstupem pro poptávku', tone: 'neutral' },
    { id: 'overdue', label: 'Po termínu revize', value: serviceTotals.overdue, hint: 'Služby čekající na governance revizi', tone: serviceTotals.overdue > 0 ? 'danger' : 'success' },
    { id: 'due_soon', label: 'Revize do 90 dnů', value: serviceTotals.dueSoon, hint: 'Služby, které bude potřeba brzy znovu potvrdit', tone: serviceTotals.dueSoon > 0 ? 'warning' : 'success' },
    { id: 'missing_owner', label: 'Chybí vlastník', value: serviceTotals.missingOwner, hint: 'Služby bez aktivního vlastníka služby', tone: serviceTotals.missingOwner > 0 ? 'danger' : 'success' },
    { id: 'readiness_blocked', label: 'Blokery připravenosti', value: serviceTotals.readinessBlocked, hint: 'Služby pod hranicí připravenosti pro publikaci', tone: serviceTotals.readinessBlocked > 0 ? 'danger' : 'success' },
  ];
  const selectedFilter = serviceFilterOptions.find((option) => option.id === serviceFilter);
  const filteredServices = serviceFilter ? serviceScopeData?.items ?? [] : [];

  return (
    <main className={styles.shell}>
      <PageHeader
        title="Portfolia schopností"
        purpose="Manažerský přehled C3 level 3 schopností, na které jsou mapované služby: co je pokryté, co je prázdné a kde je potřeba revize."
        chips={[
          { label: `${formatNumber(capabilityTotals.level3)} C3 level 3`, tone: 'info' },
          { label: `${formatNumber(capabilityTotals.empty)} prázdných`, tone: capabilityTotals.empty > 0 ? 'neutral' : 'ok' },
          { label: `${formatNumber(serviceTotals.overdue)} po termínu`, tone: serviceTotals.overdue > 0 ? 'bad' : 'ok' },
        ]}
        primaryAction={{ label: 'Katalog služeb', href: '/catalogue' }}
      />

      <section className={styles.kpiGrid} aria-label="Hlavní KPI portfolia služeb">
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
        <section className={styles.card} aria-live="polite" aria-label="Filtrovaný seznam služeb portfolia">
          <div className={styles.cardHeader}>
            <div>
              <small>Filtrovaný seznam</small>
              <h2>{selectedFilter?.label ?? 'Služby'} v portfoliu schopností</h2>
            </div>
            <Badge variant={serviceFilter === 'overdue' && filteredServices.length > 0 ? 'danger' : 'neutral'}>
              {formatNumber(filteredServices.length)} služeb
            </Badge>
          </div>
          {servicesLoading ? (
            <div className={styles.state}>Načítám služby...</div>
          ) : servicesError ? (
            <div className={styles.state}>Seznam služeb není dostupný.</div>
          ) : filteredServices.length === 0 ? (
            <EmptyState title="Žádné služby pro vybraný filtr." />
          ) : (
            <div className={styles.serviceRows}>
              {filteredServices.map((service) => (
                <Link key={service.service_id} href={`/services/${service.service_id}`} className={styles.serviceRow}>
                  <span>
                    <strong>{service.title}</strong>
                    <small>{serviceMeta(service)}</small>
                    <small>
                      Vlastník: {serviceOwner(service) ?? 'chybí'}
                      {' · '}Revize: {formatDate(service.review_due_at)}
                      {' · '}Připravenost: {Math.round(Number(service.completeness_score ?? 0))}%
                    </small>
                  </span>
                  <span className={styles.rowBadges}>
                    {service.requestable ? <Badge variant="info">Objednatelné</Badge> : null}
                    <Badge variant={readinessTone(service.completeness_score)}>
                      {readinessLabel(service.completeness_score)}
                    </Badge>
                    {serviceHasMissingOwner(service) ? <Badge variant="danger">Chybí vlastník</Badge> : null}
                    {service.readiness_blocked ? <Badge variant="danger">Blokuje připravenost</Badge> : null}
                    {service.review_due_soon ? <Badge variant="warning">Revize do 90 dnů</Badge> : null}
                    {isReviewOverdue(service.review_due_at) ? <Badge variant="danger">Po termínu</Badge> : null}
                    {Number(service.active_review_count ?? 0) > 0 ? <Badge variant="info">{formatNumber(service.active_review_count)} revize</Badge> : null}
                    <Badge variant={statusTone(service.service_status)}>{service.service_status ?? 'neznámý'}</Badge>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section className={styles.toolbar} aria-label="Filtry C3 level 3 portfolia">
        <label>
          <span>Status</span>
          <select aria-label="Status" value={capabilityStatusFilter} onChange={(event) => setCapabilityStatusFilter(event.target.value)}>
            <option value="">Všechny statusy</option>
            {capabilityStatusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Spirála</span>
          <select aria-label="Spirála" value={spiralFilter} onChange={(event) => setSpiralFilter(event.target.value)}>
            <option value="">Všechny spirály</option>
            {spiralOptions.map((spiral) => (
              <option key={spiral} value={spiral}>{spiralLabel(spiral)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>C3 level 2</span>
          <select aria-label="C3 level 2" value={level2Filter} onChange={(event) => setLevel2Filter(event.target.value)}>
            <option value="">Všechny C3 level 2</option>
            {level2Options.map(([code, title]) => (
              <option key={code} value={code}>{title}</option>
            ))}
          </select>
        </label>
        <span className={styles.sortHint}>Řazeno podle statusu, spirály a C3 levelu 2</span>
      </section>

      {isLoading || capabilitiesLoading ? (
        <div className={styles.state}>Načítám portfolio cockpit...</div>
      ) : error || capabilitiesError ? (
        <div className={styles.state}>Portfolio cockpit není dostupný.</div>
      ) : filteredCapabilities.length === 0 ? (
        <EmptyState title="Žádná C3 level 3 schopnost neodpovídá filtru." />
      ) : (
        <section className={styles.grid} aria-label="Seznam C3 level 3 schopností">
          {filteredCapabilities.map((capability) => {
            const action = capabilityAction(capability);
            const services = capabilityServices(capability);
            return (
              <article key={capability.capability_uuid} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <small>{capability.capability_code}</small>
                    <h2>{capability.capability_title}</h2>
                  </div>
                  <Badge variant={statusTone(capability.status_code)}>{capability.status_code ?? 'neznámý'}</Badge>
                </div>
                <p>
                  C3 level 3 · {spiralLabel(capability.spiral_code)} · C3 level 2: {capability.parent_portfolio_title}
                </p>
                <div className={styles.actionHint}>
                  <Badge variant={action.tone}>{action.label}</Badge>
                  <span>{action.detail}</span>
                </div>
                <dl className={styles.metrics}>
                  <div>
                    <dt>Služby</dt>
                    <dd>{formatNumber(capability.service_count)}</dd>
                  </div>
                  <div>
                    <dt>Aktivní</dt>
                    <dd>{formatNumber(capability.active_service_count)}</dd>
                  </div>
                  <div>
                    <dt>Objednatelné</dt>
                    <dd>{formatNumber(capability.requestable_service_count)}</dd>
                  </div>
                  <div>
                    <dt>Po termínu revize</dt>
                    <dd>{formatNumber(capability.overdue_review_count)}</dd>
                  </div>
                  <div>
                    <dt>Chybí vlastník</dt>
                    <dd>{formatNumber(capability.missing_owner_count)}</dd>
                  </div>
                  <div>
                    <dt>Blokery připravenosti</dt>
                    <dd>{formatNumber(capability.readiness_blocker_count)}</dd>
                  </div>
                </dl>
                <div className={styles.ownerLine}>
                  <span>Nadřazená C3 level 2</span>
                  <strong>{capability.parent_portfolio_title}</strong>
                </div>
                {services.length === 0 ? (
                  <div className={styles.emptyCapability}>
                    Tato C3 level 3 schopnost je v portfoliu prázdná. Zůstává viditelná kvůli řízení mezer v pokrytí.
                  </div>
                ) : (
                  <div className={styles.serviceRows}>
                    {services.slice(0, 4).map((service) => (
                      <Link key={service.service_id} href={`/services/${service.service_id}`} className={styles.serviceRow}>
                        <span>
                          <strong>{service.title}</strong>
                          <small>
                            {service.service_id} · {service.service_type ?? 'typ chybí'} · Vlastník: {serviceOwner(service) ?? 'chybí'}
                          </small>
                        </span>
                        <span className={styles.rowBadges}>
                          {service.requestable ? <Badge variant="info">Objednatelné</Badge> : null}
                          <Badge variant={readinessTone(service.completeness_score)}>
                            {readinessLabel(service.completeness_score)}
                          </Badge>
                          <Badge variant={statusTone(service.service_status)}>{service.service_status ?? 'neznámý'}</Badge>
                        </span>
                      </Link>
                    ))}
                    {services.length > 4 ? (
                      <span className={styles.moreServices}>+ {formatNumber(services.length - 4)} další služby</span>
                    ) : null}
                  </div>
                )}
                <Link
                  href={`/c3/${encodeURIComponent(capability.capability_uuid)}`}
                  className={styles.serviceLink}
                  aria-label={`Otevřít C3 schopnost ${capability.capability_title}`}
                >
                  Otevřít C3 schopnost
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
