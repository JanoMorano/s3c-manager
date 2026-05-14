'use client';

import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { KpiCard } from '@/design-system/controls';
import type { ReactNode } from 'react';
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'bez data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'bez data';
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
  const inbox = useDashboardInbox();
  const completeness = useCompleteness();
  const decisionSummary = useDashboardSummary();
  const operations = useOperationsDashboard();
  const dashboard = useDashboard();
  const totalServicesQuery = useServices({ limit: 1 });
  const readyServicesQuery = useServices({ limit: 1, readiness: 'ready' });
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
  const readyServices = readyServicesQuery.data?.total ?? completenessItems.filter((item) => (item.completeness_score ?? 0) >= 80).length;
  const blockedServices = blockedServicesQuery.data?.total ?? completenessItems.filter((item) => (item.completeness_score ?? 0) < 50).length;
  const overdueReviews = overdueReviewsQuery.data?.total ?? 0;
  const capabilityGaps = capabilityGapsQuery.data?.total
    ?? completenessItems.filter((item) => !hasC3Mapping(item)).length;
  const capabilityOverlaps = decisionSummary.data?.summary?.over_covered_capabilities ?? 0;

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

  if (isLoading) return <div className={styles.state}>Načítám cockpit...</div>;
  if (hasError) return <div className={styles.stateError}>Cockpit se nepodařilo načíst. Zkontrolujte middleware spojení.</div>;

  return (
    <main className={styles.shell}>
      <PageHeader
        title="Přehled řízení"
        purpose="Stav portfolia, rizik a rozhodnutí v jednom pohledu."
        chips={[
          { label: `Services: ${formatNumber(totalServices)}`, tone: 'info' },
          { label: `Ready: ${formatNumber(readyServices)}`, tone: 'ok' },
          { label: `Blocked: ${formatNumber(blockedServices)}`, tone: blockedServices ? 'bad' : 'ok' },
          { label: `Gaps: ${formatNumber(capabilityGaps)}`, tone: capabilityGaps ? 'warn' : 'ok' },
        ]}
      />

      <section className={styles.kpiGrid} aria-label="Portfolio governance KPIs">
        <KpiLinkCard href="/services/list" ariaLabel="Otevřít všechny služby v seznamu">
          <KpiCard label="Services total" value={formatNumber(totalServices)} tone="info" trendLabel={`${dashboardSummary?.active_services ?? readyServices} aktivních`} />
        </KpiLinkCard>
        <KpiLinkCard href="/services/list?readiness=ready" ariaLabel="Otevřít služby filtrované jako připravené">
          <KpiCard label="Ready" value={formatNumber(readyServices)} tone="success" trendLabel={`${totalServices ? Math.round((readyServices / totalServices) * 100) : 0} % portfolia`} />
        </KpiLinkCard>
        <KpiLinkCard href="/services/list?readiness=blocked" ariaLabel="Otevřít služby blokované readiness kontrolou">
          <KpiCard label="Blocked" value={formatNumber(blockedServices)} tone={blockedServices ? 'danger' : 'success'} trend={blockedServices ? 'up' : undefined} trendLabel={blockedServices ? 'vyžaduje zásah' : 'bez blokace'} />
        </KpiLinkCard>
        <KpiLinkCard href="/services/list?review_due=overdue" ariaLabel="Otevřít služby s prošlým termínem revize">
          <KpiCard label="Reviews overdue" value={formatNumber(overdueReviews)} tone={overdueReviews ? 'warning' : 'neutral'} trendLabel={overdueReviews ? 'otevřít review queue' : 'bez prodlení'} />
        </KpiLinkCard>
        <KpiLinkCard href="/services/list?readiness=missing_capability" ariaLabel="Otevřít služby bez capability mapování">
          <KpiCard label="Capability gaps" value={formatNumber(capabilityGaps)} tone={capabilityGaps ? 'warning' : 'success'} trendLabel={capabilityOverlaps ? `${formatNumber(capabilityOverlaps)} overlaps` : 'coverage stabilní'} />
        </KpiLinkCard>
      </section>

      <section className={styles.decisionGrid} aria-label="Personal work cockpit">
        <DecisionPanel
          title="My owned services"
          href="/operations#owner-load"
          linkLabel="Owner load"
        >
          {myOwnedServices.length ? (
            <div className={styles.signalList}>
              {myOwnedServices.slice(0, 4).map((item) => (
                <SignalRow
                  key={item.service_id}
                  title={item.title}
                  meta={`${item.lifecycle_stage_code ?? item.service_status ?? 'bez lifecycle'} · review ${formatDateTime(item.next_review_due_at)}`}
                  pill={`${item.completeness_score ?? 0}%`}
                  tone={(item.completeness_score ?? 0) < 60 ? 'warn' : 'ok'}
                  href={`/services/${item.service_id}`}
                />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>Nemáte přiřazené služby v service_role_assignment.</p>
          )}
        </DecisionPanel>

        <DecisionPanel
          title="My reviews"
          href="/operations/reviews"
          linkLabel="Review queue"
        >
          {myReviews.length ? (
            <div className={styles.signalList}>
              {myReviews.slice(0, 4).map((item) => (
                <SignalRow
                  key={item.id}
                  title={item.service_title}
                  meta={`${item.review_type} · ${item.status} · due ${formatDateTime(item.due_at)}`}
                  pill="review"
                  tone={item.due_at && new Date(item.due_at).getTime() < HOME_REFERENCE_TIME ? 'bad' : 'info'}
                  href={`/operations/reviews?service_id=${encodeURIComponent(item.service_id)}`}
                />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>Žádné review není přiřazené vašemu účtu.</p>
          )}
        </DecisionPanel>

        <DecisionPanel
          title="My blockers"
          href="/operations/readiness"
          linkLabel="Readiness gate"
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
            <p className={styles.empty}>Žádný osobní blocker v aktuální frontě.</p>
          )}
        </DecisionPanel>

        <DecisionPanel
          title="My decisions"
          href="/operations/decisions"
          linkLabel="Decision log"
        >
          <div className={styles.signalList}>
            {myDecisions.slice(0, 2).map((item) => (
              <SignalRow
                key={`decision-${item.id}`}
                title={item.service_title}
                meta={`${item.decision_type} · ${item.decision} · ${formatDateTime(item.decided_at)}`}
                pill="decision"
                tone={item.decision === 'rejected' ? 'bad' : item.decision === 'deferred' ? 'warn' : 'ok'}
                href={`/services/${item.service_id}`}
              />
            ))}
            {myDecisions.length === 0 && (
              <p className={styles.empty}>Zatím nemáte evidované rozhodnutí.</p>
            )}
          </div>
        </DecisionPanel>
      </section>

      <details className={styles.secondaryDetails}>
        <summary>Další portfolio signály</summary>
        <section className={styles.decisionGrid} aria-label="Decision strip">
          <DecisionPanel
            title="Needs decision"
            lead="Review a výjimky s governance dopadem."
            href="/operations/reviews"
            linkLabel="Otevřít queue"
          >
            {inboxItems.length === 0 ? (
              <p className={styles.empty}>Žádné položky nečekají na rozhodnutí.</p>
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
            title="Operational blockers"
            lead="Co chybí pro srozumitelnou a provozovatelnou službu."
            href="/operations/readiness"
            linkLabel="Readiness gate"
          >
            <div className={styles.signalList}>
              <SignalRow title={`${missingOwners.length} služeb bez ownera`} meta="Bez ownera neexistuje eskalace ani odpovědnost." pill="missing owner" tone="bad" href="/operations#owner-load" />
              <SignalRow title={`${missingSla.length} služeb bez SLA`} meta={missingSla[0]?.title ?? 'SLA je nutné pro service design a support model.'} pill="missing SLA" tone={missingSla.length ? 'warn' : 'ok'} href="/services/list?missing=sla" />
              <SignalRow title={`${missingCapability.length} služeb bez capability mappingu`} meta={missingCapability[0]?.title ?? 'Capability mapování umožní coverage a dopadové rozhodování.'} pill="missing capability" tone={missingCapability.length ? 'warn' : 'ok'} href="/capabilities?view=gaps" />
            </div>
          </DecisionPanel>

          <DecisionPanel
            title="Capability coverage"
            lead="Mezery, překryvy a slabé mapování."
            href="/capabilities?view=coverage"
            linkLabel="Coverage"
          >
            <div className={styles.signalList}>
              <SignalRow title={`${formatNumber(capabilityGaps)} capability gaps`} meta={missingCapability[0]?.title ?? 'Žádná významná mezera v aktuálním výběru.'} pill="gap" tone={capabilityGaps ? 'warn' : 'ok'} href="/capabilities?view=gaps" />
              <SignalRow title={`${formatNumber(capabilityOverlaps)} overlaps`} meta="Více služeb může pokrývat stejnou schopnost podobným způsobem." pill="overlap" tone={capabilityOverlaps ? 'warn' : 'ok'} href="/capabilities?view=overlaps" />
              <SignalRow title={`${staleRecords.length} stale records`} meta={staleRecords[0]?.title ?? 'Záznamy mají aktuální datum změny.'} pill="freshness" tone={staleRecords.length ? 'warn' : 'ok'} href="/services/list?sort=updated_at&order=ASC" />
            </div>
          </DecisionPanel>

          <DecisionPanel
            title="Service relationships"
            lead="Vazby důležité před změnou nebo vyřazením jsou dostupné z detailu služby."
            href="/services/list"
            linkLabel="Vybrat službu"
          >
            <div className={styles.signalList}>
              <SignalRow title={`${formatNumber(dashboardSummary?.total_relations ?? 0)} evidovaných vazeb`} meta="Každá významná změna služby má začít kontrolou vztahů na detailu konkrétní služby." pill="dependencies" tone="info" href="/services/list" />
              <SignalRow title={`${attentionItems.length} služeb s attention signálem`} meta={attentionItems[0]?.title ?? 'Aktuálně nejsou vidět služby vyžadující opravu.'} pill="attention" tone={attentionItems.length ? 'warn' : 'ok'} href="/services/list" />
              <SignalRow title={`${formatNumber(dashboardSummary?.deprecated_services ?? 0)} deprecated services`} meta="Dosluhující služby potřebují náhradu, výjimku nebo retirement plán." pill="lifecycle" tone={dashboardSummary?.deprecated_services ? 'warn' : 'ok'} href="/services/list?lifecycle=deprecated" />
            </div>
          </DecisionPanel>
        </section>

        <section className={styles.widePanel} aria-label="Audit and shortcuts">
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Recent decisions</h2>
                <p className={styles.panelLead}>Nejbližší auditní stopa.</p>
              </div>
              <Link href="/operations/decisions" className={styles.panelLink}>Decision log</Link>
            </div>
            <div className={styles.timeline}>
              {inboxItems.slice(0, 3).map((item) => (
                <Link key={`timeline-${item.id}`} href={item.href} className={styles.timelineItem}>
                  <span className={styles.timelineTime}>{formatDateTime(item.created_at)}</span>
                  <span className={styles.timelineTitle}>{item.title}</span>
                  <span className={inboxTone(item)}>{item.severity}</span>
                </Link>
              ))}
              {attentionItems.slice(0, 3).map((item) => (
                <Link key={`attention-${item.service_id}`} href={`/services/${item.service_id}`} className={styles.timelineItem}>
                  <span className={styles.timelineTime}>{formatDateTime(item.updated_at)}</span>
                  <span className={styles.timelineTitle}>{item.title}</span>
                  <span className={scoreTone(item.completeness_score)}>{item.completeness_score ?? 0}%</span>
                </Link>
              ))}
              {inboxItems.length === 0 && attentionItems.length === 0 && (
                <p className={styles.empty}>Žádný auditní nebo attention signál pro dnešní cockpit.</p>
              )}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Rychlé vstupy</h2>
                <p className={styles.panelLead}>Nejkratší cesty k časté práci.</p>
              </div>
            </div>
            <div className={styles.quickGrid}>
              <Link href="/catalogue" className={styles.quickLink}><span>Katalog služeb</span><span>Browse</span></Link>
              <Link href="/services/list" className={styles.quickLink}><span>Service list</span><span>Správa</span></Link>
              <Link href="/operations/readiness" className={styles.quickLink}><span>Readiness gate</span><span>Blokery</span></Link>
              <Link href="/services/list" className={styles.quickLink}><span>Service relationships</span><span>Detail služby</span></Link>
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
