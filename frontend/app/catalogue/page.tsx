'use client';

import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { KpiCard } from '@/design-system/controls';
import { useCompleteness, useDashboard, useDashboardHeadline, useDashboardSummary, useServices } from '@/features/services/hooks/useServices';
import type { CompletenessItem } from '@/features/services/model/service.types';
import type { ReactNode } from 'react';
import { useT } from '@/app/i18n/useI18n';
import { resolveCountForm } from '@/app/lib/counts';
import styles from '../catalogue-dashboard.module.css';

function formatNumber(value: number) {
  return value.toLocaleString('cs-CZ');
}

function countKey(base: string, value: number) {
  return `${base}.${resolveCountForm(value, { one: 'one', few: 'few', many: 'many' })}`;
}

function hasC3Mapping(item: CompletenessItem) {
  return item.has_c3_mapping === true || item.has_c3_mapping === 1;
}

function readinessTone(score: number) {
  if (score < 50) return styles.pillBad;
  if (score < 80) return styles.pillWarn;
  return styles.pillOk;
}

function signalFor(item: CompletenessItem) {
  const score = item.completeness_score ?? 0;
  if (score < 50) return 'blockers';
  if (!hasC3Mapping(item)) return 'capability';
  if (!item.summary) return 'summary';
  if ((item.flavour_count ?? 0) === 0) return 'offering';
  return 'review';
}

function browseHref(kind: 'portfolio' | 'domain' | 'audience', value: string) {
  if (kind === 'portfolio') return `/services/list?portfolio=${encodeURIComponent(value)}`;
  if (kind === 'domain') return `/services/list?domain=${encodeURIComponent(value)}`;
  return `/services/list?search=${encodeURIComponent(value)}`;
}

export default function CataloguePage() {
  const t = useT();
  const headline = useDashboardHeadline();
  const dashboard = useDashboard();
  const decisionSummary = useDashboardSummary();
  const completeness = useCompleteness();
  // Counted with the same list filters the KPI links open.
  const attentionQuery = useServices({ limit: 1, readiness: 'attention' });
  const overdueServiceReviewsQuery = useServices({ limit: 1, reviewDue: 'overdue' });

  const completenessItems = completeness.data ?? [];
  const summary = dashboard.data?.summary;
  const decision = decisionSummary.data?.summary;
  const headlineServices = headline.data?.kpis.find((item) => item.key === 'services_count')?.value;

  const totalServices = decision?.total_services ?? headlineServices ?? summary?.total_services ?? completenessItems.length;
  const requestable = summary?.requestable_services ?? 0;
  const readinessWarnings = attentionQuery.data?.total ?? 0;
  const reviewsDue = overdueServiceReviewsQuery.data?.total ?? 0;
  const attention = completenessItems
    .filter((item) => item.service_status !== 'retired')
    .filter((item) => (item.completeness_score ?? 0) < 80 || !item.summary || !hasC3Mapping(item) || (item.flavour_count ?? 0) === 0)
    .sort((a, b) => (a.completeness_score ?? 0) - (b.completeness_score ?? 0))
    .slice(0, 10);

  const attentionByPortfolio = new Map<string, number>();
  for (const item of attention) {
    const key = item.portfolio_group ?? t('catalogue.unassigned');
    attentionByPortfolio.set(key, (attentionByPortfolio.get(key) ?? 0) + 1);
  }

  const portfolios = (dashboard.data?.by_portfolio ?? [])
    .filter((item) => item.portfolio_group)
    .slice(0, 8);
  const domains = (dashboard.data?.by_domain ?? [])
    .filter((item) => item.domain_code)
    .slice(0, 8);
  const audienceCards = [
    { title: t('catalogue.browse.audience.application_teams'), count: requestable, attention: readinessWarnings, query: 'application teams' },
    { title: t('catalogue.browse.audience.end_users'), count: summary?.active_services ?? 0, attention: 0, query: 'end user' },
    { title: t('catalogue.browse.audience.partners'), count: Math.max(0, Math.round(requestable * 0.12)), attention: 0, query: 'partner' },
    { title: t('catalogue.browse.audience.operations_teams'), count: dashboard.data?.by_owner.length ?? 0, attention: reviewsDue, query: 'operations' },
  ];

  const isLoading = dashboard.isLoading && completeness.isLoading && headline.isLoading;
  const hasError = dashboard.error && completeness.error && headline.error;

  if (isLoading) return <div className={styles.state}>{t('catalogue.loading')}</div>;
  if (hasError) return <div className={styles.stateError}>{t('catalogue.unavailable')}</div>;

  return (
    <main className={styles.shell}>
      <PageHeader
        title={t('nav.sidebar.service_catalogue')}
        purpose={t('catalogue.header.purpose', { total: formatNumber(totalServices), requestable: formatNumber(requestable), due: formatNumber(reviewsDue) })}
        chips={[
          { label: t('catalogue.chip.total', { count: formatNumber(totalServices) }), tone: 'info' },
          { label: t('catalogue.chip.requestable', { count: formatNumber(requestable) }), tone: 'ok' },
          { label: t('catalogue.chip.warnings', { count: formatNumber(readinessWarnings) }), tone: readinessWarnings ? 'warn' : 'ok' },
          { label: t('catalogue.chip.review_passed', { count: formatNumber(reviewsDue) }), tone: reviewsDue ? 'warn' : 'ok' },
        ]}
        primaryAction={{ href: '/services/list?requestable=true', label: t('catalogue.request_service') }}
      />

      <section className={styles.kpiGrid} aria-label={t('catalogue.kpi.aria')}>
        <Link href="/services/list" className={styles.kpiLink} aria-label={t('catalogue.kpi.total.aria')}>
          <KpiCard label={t('catalogue.kpi.total.label')} value={formatNumber(totalServices)} tone="info" trendLabel={t(countKey('home.kpi.total.trend', summary?.active_services ?? 0), { count: summary?.active_services ?? 0 })} />
        </Link>
        <Link href="/services/list?requestable=true" className={styles.kpiLink} aria-label={t('catalogue.kpi.requestable.aria')}>
          <KpiCard label={t('service_list.row.requestable')} value={formatNumber(requestable)} tone="success" trendLabel={`${totalServices ? Math.round((requestable / totalServices) * 100) : 0} %`} />
        </Link>
        <Link href="/services/list?readiness=attention" className={styles.kpiLink} aria-label={t('catalogue.kpi.readiness.aria')}>
          <KpiCard label={t('catalogue.kpi.readiness.label')} value={formatNumber(readinessWarnings)} tone={readinessWarnings ? 'warning' : 'success'} trendLabel={readinessWarnings ? t('catalogue.kpi.readiness.trend') : t('catalogue.kpi.readiness.trend_clear')} />
        </Link>
        <Link href="/services/list?review_due=overdue" className={styles.kpiLink} aria-label={t('catalogue.kpi.overdue.aria')}>
          <KpiCard label={t('home.kpi.overdue.label')} value={formatNumber(reviewsDue)} tone={reviewsDue ? 'warning' : 'neutral'} trendLabel={reviewsDue ? t('home.kpi.overdue.trend') : t('home.kpi.overdue.trend_clear')} />
        </Link>
      </section>

      <BrowseSection
        title={t('catalogue.browse.portfolio.title')}
        lead={t('catalogue.browse.portfolio.lead')}
        href="/portfolio"
        linkLabel={t('nav.portfolio')}
      >
        {portfolios.length === 0 ? (
          <p className={styles.empty}>{t('catalogue.browse.portfolio.empty')}</p>
        ) : (
          <div className={styles.browseGrid}>
            {portfolios.map((portfolio) => {
              const attentionCount = attentionByPortfolio.get(portfolio.portfolio_group) ?? 0;
              return (
                <BrowseCard
                  key={portfolio.portfolio_group}
                  title={portfolio.portfolio_group}
                  count={t(countKey('catalogue.browse.services', portfolio.count), { count: formatNumber(portfolio.count) })}
                  attention={attentionCount ? t('catalogue.browse.attention', { count: formatNumber(attentionCount) }) : t('catalogue.browse.no_attention')}
                  href={browseHref('portfolio', portfolio.portfolio_group)}
                />
              );
            })}
          </div>
        )}
      </BrowseSection>

      <BrowseSection
        title={t('catalogue.browse.audience.title')}
        lead={t('catalogue.browse.audience.lead')}
        href="/services/list?requestable=true"
        linkLabel={t('catalogue.browse.audience.link')}
      >
        <div className={styles.browseGrid}>
          {audienceCards.map((card) => (
            <BrowseCard
              key={card.title}
              title={card.title}
              count={t(countKey('catalogue.browse.services', card.count), { count: formatNumber(card.count) })}
              attention={card.attention ? t('catalogue.browse.attention', { count: formatNumber(card.attention) }) : t('catalogue.browse.browse')}
              href={browseHref('audience', card.query)}
            />
          ))}
        </div>
      </BrowseSection>

      <BrowseSection
        title={t('catalogue.browse.domain.title')}
        lead={t('catalogue.browse.domain.lead')}
        href="/services/list"
        linkLabel={t('catalogue.browse.domain.link')}
      >
        {domains.length === 0 ? (
          <p className={styles.empty}>{t('catalogue.browse.domain.empty')}</p>
        ) : (
          <div className={styles.browseGrid}>
            {domains.map((domain) => (
              <BrowseCard
                key={domain.domain_code}
                title={domain.domain_code}
                count={t(countKey('catalogue.browse.services', domain.service_count), { count: formatNumber(domain.service_count) })}
                href={browseHref('domain', domain.domain_code)}
              />
            ))}
          </div>
        )}
      </BrowseSection>

      <section className={styles.attentionPanel} aria-label={t('catalogue.needs_attention.aria')}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>{t('catalogue.needs_attention.title')}</h2>
            <p className={styles.sectionLead}>{t('catalogue.needs_attention.lead')}</p>
          </div>
          <Link href="/services/list?sort=updated_at&order=ASC" className={styles.sectionLink}>{t('catalogue.needs_attention.link')}</Link>
        </div>

        {attention.length === 0 ? (
          <p className={styles.empty}>{t('catalogue.needs_attention.empty')}</p>
        ) : (
          <div className={styles.attentionTable}>
            <div className={styles.attentionHeader}>
              <span>{t('catalogue.table.service')}</span>
              <span>{t('nav.portfolio')}</span>
              <span>{t('catalogue.table.readiness')}</span>
              <span>{t('catalogue.table.signal')}</span>
            </div>
            {attention.map((item) => {
              const score = item.completeness_score ?? 0;
              return (
                <Link key={item.service_id} href={`/services/${item.service_id}`} className={styles.attentionRow}>
                  <span className={styles.attentionName}>
                    <strong>{item.title}</strong>
                    <small>{item.service_id} · {item.service_type ?? t('service_list.row.untyped')}</small>
                  </span>
                  <span>{item.portfolio_group ?? t('catalogue.unassigned')}</span>
                  <span className={styles.miniBar}>
                    <span className={styles.barTrack}>
                      <span className={`${styles.barFill} ${score < 50 ? styles.barFillBad : score < 80 ? styles.barFillWarn : ''}`} style={{ width: `${score}%` }} />
                    </span>
                    <span>{score}%</span>
                  </span>
                  <span className={readinessTone(score)}>{t(`catalogue.attention_signal.${signalFor(item)}`)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function BrowseSection({
  title,
  lead,
  href,
  linkLabel,
  children,
}: {
  title: string;
  lead: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.browseSection}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          <p className={styles.sectionLead}>{lead}</p>
        </div>
        <Link href={href} className={styles.sectionLink}>{linkLabel}</Link>
      </div>
      {children}
    </section>
  );
}

function BrowseCard({
  title,
  count,
  attention,
  href,
}: {
  title: string;
  count: string;
  attention?: string;
  href: string;
}) {
  return (
    <Link href={href} className={styles.browseCard}>
      <span className={styles.browseTitle}>{title}</span>
      <span className={styles.browseCount}>{count}</span>
      {attention && <span className={styles.browseAttention}>{attention}</span>}
    </Link>
  );
}
