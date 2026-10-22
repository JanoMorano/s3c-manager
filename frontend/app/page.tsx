'use client';

import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { KpiCard } from '@/design-system/controls';
import type { ReactNode } from 'react';
import { useT } from '@/app/i18n/useI18n';
import { resolveCountForm } from '@/app/lib/counts';
import {
  useCompleteness,
  useDashboard,
  useDashboardInbox,
  useDashboardSummary,
  useOperationsDashboard,
  useServices,
} from '@/features/services/hooks/useServices';
import type { CompletenessItem, DashboardInboxItem } from '@/features/services/model/service.types';
import styles from './home.module.css';

const HOME_REFERENCE_TIME = Date.now();
const STALE_RECORD_MS = 180 * 24 * 60 * 60 * 1000;

function formatNumber(value: number) {
  return value.toLocaleString('cs-CZ');
}

function hasC3Mapping(item: CompletenessItem) {
  return item.has_c3_mapping === true || item.has_c3_mapping === 1;
}

function isStale(item: CompletenessItem) {
  const updatedAt = new Date(item.updated_at).getTime();
  if (Number.isNaN(updatedAt)) return false;
  return HOME_REFERENCE_TIME - updatedAt > STALE_RECORD_MS;
}

function countKey(base: string, value: number) {
  return `${base}.${resolveCountForm(value, { one: 'one', few: 'few', many: 'many' })}`;
}

function formatDateTime(value: string | null | undefined, emptyLabel: string) {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function inboxTone(item: DashboardInboxItem): string {
  if (item.severity === 'danger') return styles.pillBad;
  if (item.severity === 'warning') return styles.pillWarn;
  return styles.pillInfo;
}

function scoreTone(score: number | null | undefined) {
  if ((score ?? 0) < 50) return styles.pillBad;
  if ((score ?? 0) < 80) return styles.pillWarn;
  return styles.pillOk;
}

export default function HomePage() {
  const t = useT();
  const noDate = t('home.no_date');
  const inbox = useDashboardInbox();
  const completeness = useCompleteness();
  const decisionSummary = useDashboardSummary();
  const operations = useOperationsDashboard();
  const dashboard = useDashboard();
  const totalServicesQuery = useServices({ limit: 1 });
  // Readiness counts use the readiness rules (same as the readiness gate and
  // Operations); "ready" here means no blocking failure, i.e. publishable.
  const readyServicesQuery = useServices({ limit: 1, readiness: 'publishable' });
  const blockedServicesQuery = useServices({ limit: 1, readiness: 'blocked' });
  const overdueReviewsQuery = useServices({ limit: 1, reviewDue: 'overdue' });
  const capabilityGapsQuery = useServices({ limit: 1, readiness: 'missing_capability' });

  const completenessItems = completeness.data ?? [];
  const inboxItems = inbox.data?.items ?? [];
  const myOwnedServices = inbox.data?.my_owned_services ?? [];
  const myReviews = inbox.data?.my_reviews ?? [];
  const myBlockers = inbox.data?.my_blockers ?? inboxItems;
  const myDecisions = inbox.data?.my_decisions ?? [];
  const dashboardSummary = dashboard.data?.summary;
  const operationSections = operations.data?.sections;

  const totalServices = totalServicesQuery.data?.total ?? dashboardSummary?.total_services ?? completenessItems.length;
  const readyServices = readyServicesQuery.data?.total ?? decisionSummary.data?.summary?.services_ready_for_publish ?? 0;
  const blockedServices = blockedServicesQuery.data?.total ?? decisionSummary.data?.summary?.services_blocked_by_readiness ?? 0;
  const overdueReviews = overdueReviewsQuery.data?.total ?? 0;
  const capabilityGaps = capabilityGapsQuery.data?.total
    ?? completenessItems.filter((item) => !hasC3Mapping(item)).length;
  const capabilityOverlaps = decisionSummary.data?.summary?.over_covered_capabilities ?? 0;
  const uncoveredCapabilities = decisionSummary.data?.summary?.uncovered_capabilities ?? 0;

  const missingOwners = operationSections?.missing_owners ?? [];
  const missingSla = completenessItems
    .filter((item) => item.service_status !== 'retired')
    .filter((item) => item.sla_availability == null)
    .slice(0, 4);
  const missingCapability = completenessItems
    .filter((item) => item.service_status !== 'retired')
    .filter((item) => !hasC3Mapping(item))
    .slice(0, 4);
  const staleRecords = completenessItems.filter(isStale).slice(0, 4);
  const attentionItems = completenessItems
    .filter((item) => item.service_status !== 'retired')
    .filter((item) => (item.completeness_score ?? 0) < 80 || !item.summary || !hasC3Mapping(item))
    .sort((a, b) => (a.completeness_score ?? 0) - (b.completeness_score ?? 0))
    .slice(0, 4);

  const kpiQueries = [totalServicesQuery, readyServicesQuery, blockedServicesQuery, overdueReviewsQuery, capabilityGapsQuery];
  const isLoading = kpiQueries.some((query) => query.isLoading && !query.data) && !completeness.data;
  const hasError = kpiQueries.every((query) => query.error) && completeness.error && decisionSummary.error;

  if (isLoading) return <div className={styles.state}>{t('home.state.loading')}</div>;
  if (hasError) return <div className={styles.stateError}>{t('home.state.error')}</div>;

  return (
    <main className={styles.shell}>
      <PageHeader
        title={t('nav.topbar.governance_overview')}
        purpose={t('home.header.purpose')}
        chips={[
          { label: t('home.chip.services', { count: formatNumber(totalServices) }), tone: 'info' },
          { label: t('home.chip.ready', { count: formatNumber(readyServices) }), tone: 'ok' },
          { label: t('home.chip.blocked', { count: formatNumber(blockedServices) }), tone: blockedServices ? 'bad' : 'ok' },
          { label: t('home.chip.without_capability', { count: formatNumber(capabilityGaps) }), tone: capabilityGaps ? 'warn' : 'ok' },
        ]}
      />

      <section className={styles.kpiGrid} aria-label={t('home.kpi.aria')}>
        <KpiLinkCard href="/services/list" ariaLabel={t('home.kpi.total.aria')}>
          <KpiCard label={t('home.kpi.total.label')} value={formatNumber(totalServices)} tone="info" trendLabel={dashboardSummary?.active_services != null ? t(countKey('home.kpi.total.trend', dashboardSummary.active_services), { count: dashboardSummary.active_services }) : undefined} />
        </KpiLinkCard>
        <KpiLinkCard href="/services/list?readiness=publishable" ariaLabel={t('home.kpi.ready.aria')}>
          <KpiCard label={t('service_list.readiness_option.publishable')} value={formatNumber(readyServices)} tone="success" trendLabel={t('home.kpi.ready.trend', { percent: totalServices ? Math.round((readyServices / totalServices) * 100) : 0 })} />
        </KpiLinkCard>
        <KpiLinkCard href="/services/list?readiness=blocked" ariaLabel={t('home.kpi.blocked.aria')}>
          <KpiCard label={t('home.kpi.blocked.label')} value={formatNumber(blockedServices)} tone={blockedServices ? 'danger' : 'success'} trendLabel={blockedServices ? t('home.kpi.blocked.trend_action') : t('home.kpi.blocked.trend_clear')} />
        </KpiLinkCard>
        <KpiLinkCard href="/services/list?review_due=overdue" ariaLabel={t('home.kpi.overdue.aria')}>
          <KpiCard label={t('home.kpi.overdue.label')} value={formatNumber(overdueReviews)} tone={overdueReviews ? 'warning' : 'neutral'} trendLabel={overdueReviews ? t('home.kpi.overdue.trend') : t('home.kpi.overdue.trend_clear')} />
        </KpiLinkCard>
        <KpiLinkCard href="/services/list?readiness=missing_capability" ariaLabel={t('home.kpi.capability.aria')}>
          <KpiCard label={t('home.kpi.capability.label')} value={formatNumber(capabilityGaps)} tone={capabilityGaps ? 'warning' : 'success'} trendLabel={t('home.kpi.capability.trend', { uncovered: formatNumber(uncoveredCapabilities), overlaps: formatNumber(capabilityOverlaps) })} />
        </KpiLinkCard>
      </section>

      <section className={styles.decisionGrid} aria-label={t('home.personal.aria')}>
        <DecisionPanel
          title={t('home.my_owned.title')}
          href="/operations#owner-load"
          linkLabel={t('nav.topbar.segment.owner_load')}
        >
          {myOwnedServices.length ? (
            <div className={styles.signalList}>
              {myOwnedServices.slice(0, 4).map((item) => (
                <SignalRow
                  key={item.service_id}
                  title={item.title}
                  meta={t('home.my_owned.meta', { lifecycle: item.lifecycle_stage_code ?? item.service_status ?? t('home.my_owned.no_lifecycle'), date: formatDateTime(item.review_due_at, noDate) })}
                  pill={`${item.completeness_score ?? 0}%`}
                  tone={(item.completeness_score ?? 0) < 60 ? 'warn' : 'ok'}
                  href={`/services/${item.service_id}`}
                />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>{t('home.my_owned.empty')}</p>
          )}
        </DecisionPanel>

        <DecisionPanel
          title={t('home.my_reviews.title')}
          href="/operations/reviews"
          linkLabel={t('home.my_reviews.link')}
        >
          {myReviews.length ? (
            <div className={styles.signalList}>
              {myReviews.slice(0, 4).map((item) => (
                <SignalRow
                  key={item.id}
                  title={item.service_title}
                  meta={t('home.my_reviews.meta', { type: item.review_type, status: item.status, date: formatDateTime(item.due_at, noDate) })}
                  pill={t('home.my_reviews.pill')}
                  tone={item.due_at && new Date(item.due_at).getTime() < HOME_REFERENCE_TIME ? 'bad' : 'info'}
                  href={`/operations/reviews?service_id=${encodeURIComponent(item.service_id)}`}
                />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>{t('home.my_reviews.empty')}</p>
          )}
        </DecisionPanel>

        <DecisionPanel
          title={t('home.my_blockers.title')}
          href="/operations/readiness"
          linkLabel={t('nav.sidebar.readiness_gate')}
        >
          {myBlockers.length ? (
            <div className={styles.signalList}>
              {myBlockers.slice(0, 4).map((item) => (
                <Link key={`mine-${item.id}`} href={item.href} className={styles.signalRow}>
                  <span className={styles.signalMain}>
                    <span className={styles.signalTitle}>{item.title}</span>
                    <span className={styles.signalMeta}>{item.description}</span>
                  </span>
                  <span className={inboxTone(item)}>{item.type.replaceAll('_', ' ')}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>{t('home.my_blockers.empty')}</p>
          )}
        </DecisionPanel>

        <DecisionPanel
          title={t('home.my_decisions.title')}
          href="/operations/decisions"
          linkLabel={t('nav.topbar.segment.decisions')}
        >
          <div className={styles.signalList}>
            {myDecisions.slice(0, 2).map((item) => (
              <SignalRow
                key={`decision-${item.id}`}
                title={item.service_title}
                meta={`${item.decision_type} · ${item.decision} · ${formatDateTime(item.decided_at, noDate)}`}
                pill={t('home.my_decisions.pill')}
                tone={item.decision === 'rejected' ? 'bad' : item.decision === 'deferred' ? 'warn' : 'ok'}
                href={`/services/${item.service_id}`}
              />
            ))}
            {myDecisions.length === 0 && (
              <p className={styles.empty}>{t('home.my_decisions.empty')}</p>
            )}
          </div>
        </DecisionPanel>
      </section>

      <details className={styles.secondaryDetails}>
        <summary>{t('home.more_signals')}</summary>
        <section className={styles.decisionGrid} aria-label={t('home.decision_strip.aria')}>
          <DecisionPanel
            title={t('home.needs_decision.title')}
            lead={t('home.needs_decision.lead')}
            href="/operations/reviews"
            linkLabel={t('home.needs_decision.link')}
          >
            {inboxItems.length === 0 ? (
              <p className={styles.empty}>{t('home.needs_decision.empty')}</p>
            ) : (
              <div className={styles.signalList}>
                {inboxItems.slice(0, 4).map((item) => (
                  <Link key={item.id} href={item.href} className={styles.signalRow}>
                    <span className={styles.signalMain}>
                      <span className={styles.signalTitle}>{item.title}</span>
                      <span className={styles.signalMeta}>{item.description}</span>
                    </span>
                    <span className={inboxTone(item)}>{item.type.replaceAll('_', ' ')}</span>
                  </Link>
                ))}
              </div>
            )}
          </DecisionPanel>

          <DecisionPanel
            title={t('home.op_blockers.title')}
            lead={t('home.op_blockers.lead')}
            href="/operations/readiness"
            linkLabel={t('nav.sidebar.readiness_gate')}
          >
            <div className={styles.signalList}>
              <SignalRow title={t(countKey('home.op_blockers.missing_owner', missingOwners.length), { count: missingOwners.length })} meta={t('home.op_blockers.missing_owner.meta')} pill={t('home.op_blockers.missing_owner.pill')} tone="bad" href="/operations#owner-load" />
              <SignalRow title={t(countKey('home.op_blockers.missing_sla', missingSla.length), { count: missingSla.length })} meta={missingSla[0]?.title ?? t('home.op_blockers.missing_sla.meta')} pill={t('home.op_blockers.missing_sla.pill')} tone={missingSla.length ? 'warn' : 'ok'} href="/services/list?missing=sla" />
              <SignalRow title={t(countKey('home.op_blockers.missing_capability', missingCapability.length), { count: missingCapability.length })} meta={missingCapability[0]?.title ?? t('home.op_blockers.missing_capability.meta')} pill={t('home.op_blockers.missing_capability.pill')} tone={missingCapability.length ? 'warn' : 'ok'} href="/capabilities?view=gaps" />
            </div>
          </DecisionPanel>

          <DecisionPanel
            title={t('nav.c3_capability_coverage')}
            lead={t('home.coverage.lead')}
            href="/capabilities?view=coverage"
            linkLabel={t('nav.topbar.segment.coverage')}
          >
            <div className={styles.signalList}>
              <SignalRow title={t(countKey('home.coverage.gaps', capabilityGaps), { count: formatNumber(capabilityGaps) })} meta={missingCapability[0]?.title ?? t('home.coverage.gaps.meta')} pill={t('operations.c3_gap.gap')} tone={capabilityGaps ? 'warn' : 'ok'} href="/capabilities?view=gaps" />
              <SignalRow title={t(countKey('home.coverage.overlaps', capabilityOverlaps), { count: formatNumber(capabilityOverlaps) })} meta={t('home.coverage.overlaps.meta')} pill={t('home.coverage.overlaps.pill')} tone={capabilityOverlaps ? 'warn' : 'ok'} href="/capabilities?view=overlaps" />
              <SignalRow title={t(countKey('home.coverage.stale', staleRecords.length), { count: staleRecords.length })} meta={staleRecords[0]?.title ?? t('home.coverage.stale.meta')} pill={t('home.coverage.stale.pill')} tone={staleRecords.length ? 'warn' : 'ok'} href="/services/list?sort=updated_at&order=ASC" />
            </div>
          </DecisionPanel>

          <DecisionPanel
            title={t('nav.topbar.segment.impact')}
            lead={t('home.relations.lead')}
            href="/services/list"
            linkLabel={t('home.relations.link')}
          >
            <div className={styles.signalList}>
              <SignalRow title={t(countKey('home.relations.total', dashboardSummary?.total_relations ?? 0), { count: formatNumber(dashboardSummary?.total_relations ?? 0) })} meta={t('home.relations.total.meta')} pill={t('home.relations.total.pill')} tone="info" href="/services/list" />
              <SignalRow title={t(countKey('home.relations.attention', attentionItems.length), { count: attentionItems.length })} meta={attentionItems[0]?.title ?? t('home.relations.attention.meta')} pill={t('home.relations.attention.pill')} tone={attentionItems.length ? 'warn' : 'ok'} href="/services/list" />
              <SignalRow title={t(countKey('home.relations.deprecated', dashboardSummary?.deprecated_services ?? 0), { count: formatNumber(dashboardSummary?.deprecated_services ?? 0) })} meta={t('home.relations.deprecated.meta')} pill={t('home.relations.deprecated.pill')} tone={dashboardSummary?.deprecated_services ? 'warn' : 'ok'} href="/services/list?lifecycle=deprecated" />
            </div>
          </DecisionPanel>
        </section>

        <section className={styles.widePanel} aria-label={t('home.audit.aria')}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>{t('home.audit.title')}</h2>
                <p className={styles.panelLead}>{t('home.audit.lead')}</p>
              </div>
              <Link href="/operations/decisions" className={styles.panelLink}>{t('nav.topbar.segment.decisions')}</Link>
            </div>
            <div className={styles.timeline}>
              {inboxItems.slice(0, 3).map((item) => (
                <Link key={`timeline-${item.id}`} href={item.href} className={styles.timelineItem}>
                  <span className={styles.timelineTime}>{formatDateTime(item.created_at, noDate)}</span>
                  <span className={styles.timelineTitle}>{item.title}</span>
                  <span className={inboxTone(item)}>{item.severity}</span>
                </Link>
              ))}
              {attentionItems.slice(0, 3).map((item) => (
                <Link key={`attention-${item.service_id}`} href={`/services/${item.service_id}`} className={styles.timelineItem}>
                  <span className={styles.timelineTime}>{formatDateTime(item.updated_at, noDate)}</span>
                  <span className={styles.timelineTitle}>{item.title}</span>
                  <span className={scoreTone(item.completeness_score)}>{item.completeness_score ?? 0}%</span>
                </Link>
              ))}
              {inboxItems.length === 0 && attentionItems.length === 0 && (
                <p className={styles.empty}>{t('home.audit.empty')}</p>
              )}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>{t('home.quick.title')}</h2>
                <p className={styles.panelLead}>{t('home.quick.lead')}</p>
              </div>
            </div>
            <div className={styles.quickGrid}>
              <Link href="/catalogue" className={styles.quickLink}><span>{t('nav.sidebar.service_catalogue')}</span><span>{t('home.quick.browse')}</span></Link>
              <Link href="/services/list" className={styles.quickLink}><span>{t('nav.sidebar.service_list')}</span><span>{t('home.quick.manage')}</span></Link>
              <Link href="/operations/readiness" className={styles.quickLink}><span>{t('nav.sidebar.readiness_gate')}</span><span>{t('home.quick.blockers')}</span></Link>
              <Link href="/services/list" className={styles.quickLink}><span>{t('nav.topbar.segment.impact')}</span><span>{t('home.quick.service_detail')}</span></Link>
            </div>
          </article>
        </section>
      </details>
    </main>
  );
}

function DecisionPanel({
  title,
  lead,
  href,
  linkLabel,
  children,
}: {
  title: string;
  lead?: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>{title}</h2>
          {lead && <p className={styles.panelLead}>{lead}</p>}
        </div>
        <Link href={href} className={styles.panelLink}>{linkLabel}</Link>
      </div>
      {children}
    </article>
  );
}

function KpiLinkCard({
  href,
  ariaLabel,
  children,
}: {
  href: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={styles.kpiLink} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

function SignalRow({
  title,
  meta,
  pill,
  tone,
  href,
}: {
  title: string;
  meta: string;
  pill: string;
  tone: 'bad' | 'warn' | 'ok' | 'info';
  href: string;
}) {
  const pillClass = tone === 'bad' ? styles.pillBad : tone === 'warn' ? styles.pillWarn : tone === 'ok' ? styles.pillOk : styles.pillInfo;
  return (
    <Link href={href} className={styles.signalRow}>
      <span className={styles.signalMain}>
        <span className={styles.signalTitle}>{title}</span>
        <span className={styles.signalMeta}>{meta}</span>
      </span>
      <span className={pillClass}>{pill}</span>
    </Link>
  );
}
