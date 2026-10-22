'use client';

import { use } from 'react';
import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import type { BadgeVariant } from '@/design-system/controls';
import { useGovernanceDecisions, useGovernanceReviews } from '@/features/governance/hooks/useGovernance';
import type { PortfolioDetailResponse, ServicePortfolio, ServicePortfolioService } from '@/features/services/model/service.types';
import useSWR from 'swr';
import { apiFetch } from '@/features/services/api/services.api';
import styles from '../portfolio.module.css';
import { useT } from '@/app/i18n/useI18n';
import { resolveCountForm } from '@/app/lib/counts';

type Translate = ReturnType<typeof useT>;

interface Props {
  params: Promise<{ code: string }>;
}

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

function readinessTone(score: number | null | undefined): BadgeVariant {
  const value = Number(score ?? 0);
  if (value >= 80) return 'success';
  if (value >= 50) return 'warning';
  return 'danger';
}

function readinessLabel(score: number | null | undefined, t: Translate) {
  const value = Math.round(Number(score ?? 0));
  if (value >= 80) return t('portfolio.detail.readiness.ok', { score: value });
  if (value >= 50) return t('portfolio.detail.readiness.partial', { score: value });
  return t('portfolio.detail.readiness.blocked', { score: value });
}

function serviceOwner(service: ServicePortfolioService) {
  return service.service_owner ?? service.manager ?? service.vlastnik ?? null;
}

function serviceHasMissingOwner(service: ServicePortfolioService) {
  return Boolean(service.owner_missing) || !serviceOwner(service);
}

function lifecycleTotal(portfolio: ServicePortfolio) {
  return Math.max(
    1,
    Number(portfolio.draft_service_count ?? 0)
      + Number(portfolio.active_service_count ?? 0)
      + Number(portfolio.retiring_service_count ?? 0)
      + Number(portfolio.retired_service_count ?? 0),
  );
}

function LifecycleBar({ portfolio }: { portfolio: ServicePortfolio }) {
  const t = useT();
  const total = lifecycleTotal(portfolio);
  const segments = [
    { label: t('lifecycle_stage.draft'), value: portfolio.draft_service_count, className: styles.stageDraft },
    { label: t('lifecycle_stage.active'), value: portfolio.active_service_count, className: styles.stageActive },
    { label: t('lifecycle_stage.retiring'), value: portfolio.retiring_service_count, className: styles.stageRetiring },
    { label: t('lifecycle_stage.retired'), value: portfolio.retired_service_count, className: styles.stageRetired },
  ];

  return (
    <div className={styles.lifecycleBlock}>
      <div className={styles.lifecycleBar} aria-label={t('portfolio.detail.lifecycle_aria')}>
        {segments.map((segment) => (
          <span
            key={segment.label}
            className={segment.className}
            style={{ width: `${Math.max(0, (Number(segment.value ?? 0) / total) * 100)}%` }}
            title={`${segment.label}: ${formatNumber(segment.value)}`}
          />
        ))}
      </div>
      <div className={styles.lifecycleLegend}>
        {segments.map((segment) => (
          <span key={segment.label}>{segment.label} {formatNumber(segment.value)}</span>
        ))}
      </div>
    </div>
  );
}

function capabilityMapHref(spiralCode: string | null | undefined) {
  const spiralNumber = String(spiralCode ?? '').match(/^Spiral_(\d+)$/)?.[1];
  return spiralNumber ? `/c3/capability-map-spiral${spiralNumber}` : '/c3/capability-map';
}

export default function PortfolioDetailPage({ params }: Props) {
  const t = useT();
  const { code } = use(params);
  const portfolioCode = decodeURIComponent(code);
  const {
    data: portfolioDetailData,
    isLoading: portfolioLoading,
    error: portfolioError,
  } = useSWR<PortfolioDetailResponse>(
    portfolioCode ? `/api/v1/portfolio/${encodeURIComponent(portfolioCode)}` : null,
    apiFetch,
    { revalidateOnFocus: false },
  );

  const { data: decisionsData } = useGovernanceDecisions({ limit: 10, scope: portfolioCode });
  const { data: reviewsData } = useGovernanceReviews({ limit: 50, scope: portfolioCode });

  const portfolio = portfolioDetailData?.item;
  const services = portfolio?.services ?? [];
  const active = Number(portfolio?.active_service_count ?? services.filter((service) => service.service_status === 'active').length);
  const missingOwner = Number(portfolio?.missing_owner_count ?? services.filter(serviceHasMissingOwner).length);
  const readinessBlocked = Number(portfolio?.readiness_blocker_count ?? services.filter((service) => service.readiness_blocked).length);
  const capabilityGaps = Number(portfolio?.capability_gap_count ?? 0);
  const dueSoon = Number(portfolio?.due_soon_review_count ?? services.filter((service) => service.review_due_soon).length);
  const activeReviews = Number(portfolio?.active_governance_review_count ?? 0);
  const portfolioServiceIds = new Set(services.map((service) => service.service_id));
  const decisions = (decisionsData?.items ?? []).filter((decision) => portfolioServiceIds.has(decision.service_id));
  const reviews = (reviewsData?.items ?? []).filter((review) => portfolioServiceIds.has(review.service_id));
  const coverageItems = portfolio?.capabilities ?? [];

  if (portfolioLoading) return <main className={styles.shell}><div className={styles.state}>{t('portfolio.detail.loading')}</div></main>;
  if (portfolioError || !portfolio) return <main className={styles.shell}><div className={styles.state}>{t('portfolio.detail.not_found')}</div></main>;

  return (
    <main className={styles.shell}>
      <PageHeader
        title={portfolio.title}
        purpose={portfolio.description || t('portfolio.detail.purpose_fallback')}
        chips={[
          { label: portfolio.portfolio_code, tone: 'info' },
          ...(portfolio.spiral_code ? [{ label: portfolio.spiral_code.replace('_', ' '), tone: 'neutral' as const }] : []),
          { label: portfolio.status_code, tone: statusTone(portfolio.status_code) === 'success' ? 'ok' : 'neutral' },
          { label: t('portfolio.chip.overdue', { count: formatNumber(portfolio.overdue_review_count) }), tone: portfolio.overdue_review_count > 0 ? 'bad' : 'ok' },
          { label: t('portfolio.detail.chip.gaps', { count: formatNumber(capabilityGaps) }), tone: capabilityGaps > 0 ? 'neutral' : 'ok' },
        ]}
        primaryAction={{ label: t('portfolio.detail.back'), href: '/portfolio' }}
      />

      <section className={styles.kpiGrid} aria-label={t('portfolio.detail.kpi.aria')}>
        <KpiCard label={t('portfolio.filter.all.label')} value={formatNumber(portfolio.service_count)} hint={t('portfolio.detail.kpi.services_hint')} tone="info" />
        <KpiCard label={t('common.active')} value={formatNumber(active || portfolio.active_service_count)} hint={t('portfolio.detail.kpi.active_hint')} tone="success" />
        <KpiCard label={t('service_list.row.requestable')} value={formatNumber(portfolio.requestable_service_count)} hint={t('portfolio.detail.kpi.requestable_hint')} />
        <KpiCard label={t('service_list.readiness_option.missing_owner')} value={formatNumber(missingOwner)} hint={t('portfolio.detail.kpi.missing_owner_hint')} tone={missingOwner > 0 ? 'warning' : 'success'} />
        <KpiCard label={t('portfolio.filter.readiness_blocked.label')} value={formatNumber(readinessBlocked)} hint={t('portfolio.detail.kpi.blocked_hint')} tone={readinessBlocked > 0 ? 'danger' : 'success'} />
        <KpiCard label={t('portfolio.detail.kpi.gaps')} value={formatNumber(capabilityGaps)} hint={t('portfolio.detail.kpi.gaps_hint')} tone={capabilityGaps > 0 ? 'warning' : 'success'} />
      </section>

      <section className={styles.detailGrid}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <small>{t('service_list.filter.lifecycle')}</small>
              <h2>{t('portfolio.detail.lifecycle.title')}</h2>
            </div>
            <Badge variant={statusTone(portfolio.status_code)}>{portfolio.status_code}</Badge>
          </div>
          <LifecycleBar portfolio={portfolio} />
          <div className={styles.ownerLine}>
            <span>{t('portfolio.detail.owner_group')}</span>
            <strong>{portfolio.owner_group_name || t('portfolio.detail.unassigned')}</strong>
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <small>{t('portfolio.detail.priority.eyebrow')}</small>
              <h2>{t('portfolio.detail.priority.title')}</h2>
            </div>
          </div>
          <div className={styles.actionList}>
            {readinessBlocked > 0 ? <span><strong>{formatNumber(readinessBlocked)}</strong> {t(countKey('portfolio.detail.priority.blocked', readinessBlocked))}</span> : null}
            {missingOwner > 0 ? <span><strong>{formatNumber(missingOwner)}</strong> {t(countKey('portfolio.detail.priority.missing_owner', missingOwner))}</span> : null}
            {capabilityGaps > 0 ? <span><strong>{formatNumber(capabilityGaps)}</strong> {t(countKey('portfolio.detail.priority.gaps', capabilityGaps))}</span> : null}
            {portfolio.overdue_review_count > 0 ? <span><strong>{formatNumber(portfolio.overdue_review_count)}</strong> {t(countKey('portfolio.detail.priority.overdue', portfolio.overdue_review_count))}</span> : null}
            {dueSoon > 0 ? <span><strong>{formatNumber(dueSoon)}</strong> {t(countKey('portfolio.detail.priority.due_soon', dueSoon))}</span> : null}
            {activeReviews > 0 ? <span><strong>{formatNumber(activeReviews)}</strong> {t(countKey('portfolio.detail.priority.active_reviews', activeReviews))}</span> : null}
            {readinessBlocked + missingOwner + capabilityGaps + Number(portfolio.overdue_review_count ?? 0) + dueSoon === 0 ? (
              <span>{t('portfolio.detail.priority.clear')}</span>
            ) : null}
          </div>
          <Link href="#portfolio-services" className={styles.inlineAction}>{t('portfolio.detail.link.services')}</Link>
          <Link href={capabilityMapHref(portfolio.spiral_code)} className={styles.inlineAction}>{t('portfolio.detail.link.capability_map')}</Link>
          <Link href="/operations/reviews" className={styles.inlineAction}>{t('portfolio.detail.link.reviews')}</Link>
          <Link href="/operations#owner-load" className={styles.inlineAction}>{t('nav.topbar.segment.owner_load')}</Link>
        </article>
      </section>

      <section id="portfolio-services" className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <small>{t('portfolio.filter.all.label')}</small>
            <h2>{t('portfolio.detail.services.title')}</h2>
          </div>
          <Badge variant="neutral">{t('portfolio.detail.services.loaded', { count: formatNumber(services.length) })}</Badge>
        </div>
        {services.length === 0 ? (
          <EmptyState title={t('portfolio.detail.services.empty')} />
        ) : (
          <div className={styles.serviceRows}>
            {services.map((service) => (
              <Link key={service.service_id} href={`/services/${service.service_id}`} className={styles.serviceRow}>
                <span>
                  <strong>{service.title}</strong>
                  <small>
                    {t('portfolio.detail.service_row.meta', {
                      id: service.service_id,
                      type: service.service_type ?? t('portfolio.type_missing'),
                      owner: serviceOwner(service) ?? t('portfolio.owner_missing'),
                      date: formatDate(service.review_due_at, t),
                    })}
                  </small>
                </span>
                <span className={styles.rowBadges}>
                  {service.requestable ? <Badge variant="info">{t('service_list.row.requestable')}</Badge> : null}
                  <Badge variant={readinessTone(service.completeness_score)}>
                    {readinessLabel(service.completeness_score, t)}
                  </Badge>
                  {serviceHasMissingOwner(service) ? <Badge variant="danger">{t('service_list.readiness_option.missing_owner')}</Badge> : null}
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

      {/* §5 Capability coverage filtered by portfolio */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <small>{t('nav.topbar.segment.coverage')}</small>
            <h2>{t('portfolio.detail.coverage.title')}</h2>
          </div>
          <Link href={capabilityMapHref(portfolio.spiral_code)} className={styles.inlineAction}>
            {t('portfolio.detail.link.capability_map')}
          </Link>
        </div>
        {coverageItems.length === 0 ? (
          <EmptyState title={t('portfolio.detail.coverage.empty')} />
        ) : (
          <div className={styles.serviceRows}>
            {coverageItems.map((item) => (
              <Link
                key={item.capability_code}
                href={`/c3/${encodeURIComponent(item.capability_uuid)}`}
                className={styles.serviceRow}
              >
                <span>
                  <strong>{item.capability_title}</strong>
                  <small>
                    {t('portfolio.detail.coverage.meta', {
                      code: item.capability_code,
                      level: item.capability_level,
                      services: formatNumber(item.service_count),
                      active: formatNumber(item.active_service_count),
                      requestable: formatNumber(item.requestable_service_count),
                      overdue: formatNumber(item.overdue_review_count),
                      blocked: formatNumber(item.readiness_blocker_count),
                      missing_owner: formatNumber(item.missing_owner_count),
                    })}
                  </small>
                </span>
                <Badge variant={item.service_count > 0 ? 'success' : 'warning'}>
                  {item.service_count > 0 ? t('portfolio.detail.coverage.mapped') : t('portfolio.detail.coverage.gap')}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* §6 Last 10 decisions */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <small>{t('nav.sidebar.decisions')}</small>
            <h2>{t('portfolio.detail.decisions.title')}</h2>
          </div>
          <Link href="/operations/decisions" className={styles.inlineAction}>
            {t('portfolio.detail.decisions.all')}
          </Link>
        </div>
        {decisions.length === 0 ? (
          <EmptyState title={t('portfolio.detail.decisions.empty')} />
        ) : (
          <div className={styles.serviceRows}>
            {decisions.map((decision) => (
              <Link key={decision.id} href={`/services/${decision.service_id}`} className={styles.serviceRow}>
                <span>
                  <strong>{decision.service_title}</strong>
                  <small>{decision.service_id} · {decision.decision_type} · {decision.decided_at ? new Date(decision.decided_at).toLocaleDateString('cs-CZ') : t('portfolio.detail.no_date')}</small>
                </span>
                <Badge variant={decision.decision === 'approved' ? 'success' : decision.decision === 'rejected' ? 'danger' : 'neutral'}>
                  {decision.decision}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* §7 Calendar of portfolio reviews */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <small>{t('nav.sidebar.reviews')}</small>
            <h2>{t('portfolio.detail.reviews.title')}</h2>
          </div>
          <Link href="/operations/reviews" className={styles.inlineAction}>
            {t('portfolio.detail.reviews.overview')}
          </Link>
        </div>
        {reviews.length === 0 ? (
          <EmptyState title={t('portfolio.detail.reviews.empty')} />
        ) : (
          <div className={styles.serviceRows}>
            {reviews.slice(0, 15).map((review) => (
              <Link key={review.id} href="/operations/reviews" className={styles.serviceRow}>
                <span>
                  <strong>{review.service_title}</strong>
                  <small>{t('portfolio.detail.reviews.meta', { id: review.service_id, type: review.review_type, date: review.due_at ? new Date(review.due_at).toLocaleDateString('cs-CZ') : '—' })}</small>
                </span>
                <Badge variant={review.overdue ? 'danger' : review.status === 'approved' ? 'success' : 'info'}>
                  {review.status}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
