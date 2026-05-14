'use client';

import type { ReactNode } from 'react';
import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { useSearchParams } from 'next/navigation';
import { Badge, EmptyState, KpiCard, ProgressBar } from '@/design-system/controls';
import { useDashboardSummary, useOperationsDashboard } from '@/features/services/hooks/useServices';
import type { CompletenessItem } from '@/features/services/hooks/useServices';
import {
  useGovernanceDecisions,
  useGovernanceReviews,
  useOwnerAssignments,
  useOwnerLoad,
  useReadinessSummary,
} from '@/features/governance/hooks/useGovernance';
import type {
  GovernanceDecision,
  GovernanceReview,
  OwnerAssignmentRow,
  OwnerLoadRow,
  ReadinessSummaryResponse,
} from '@/features/governance/types';
import { useT } from '@/app/i18n/useI18n';
import styles from '../dashboard/dashboard.module.css';
import cockpitStyles from './operations.module.css';
import govStyles from './governance.module.css';

const DEFAULT_SUMMARY_LINKS = {
  governance_health: '/operations',
  readiness_queue: '/operations/readiness',
  review_deadlines: '/operations/reviews',
  owner_load: '/operations#owner-load',
  recent_decisions: '/operations/decisions',
  import_data_quality: '/import',
};

const OPEN_REVIEW_STATUS_FILTER = 'pending,in_review,deferred';

type ReadinessItem = ReadinessSummaryResponse['items'][number];
type MissingOwnerItem = Pick<CompletenessItem, 'service_id' | 'title' | 'service_status' | 'updated_at'>;

function readinessTone(score: number) {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

function formatCount(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('en-US');
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No due date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

function ServiceRows({ items, empty }: { items: CompletenessItem[]; empty: string }) {
  if (items.length === 0) return <EmptyState title={empty} />;
  return (
    <div className={styles.auditList}>
      {items.slice(0, 6).map((service) => {
        const score = service.completeness_score ?? 0;
        return (
          <Link key={service.service_id} href={`/services/${service.service_id}/edit`} className={styles.queueRowLink}>
            <span>
              <strong>{service.title}</strong>
              <small>{service.service_id} · {service.service_status ?? 'unknown'}</small>
            </span>
            <span className={styles.workProgress}>
              <ProgressBar value={score} tone={readinessTone(score)} label={`${service.title} readiness`} />
              <small>{score}%</small>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function PanelState({ label }: { label: string }) {
  return <div className={govStyles.stateLine}>{label}</div>;
}

function GovernancePanel({
  id,
  title,
  hint,
  count,
  children,
}: {
  id?: string;
  title: string;
  hint: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <article id={id} className={govStyles.governancePanel}>
      <div className={govStyles.panelHeader}>
        <div>
          <h2 className={govStyles.panelTitle}>{title}</h2>
          <p className={govStyles.panelHint}>{hint}</p>
        </div>
        <span className={govStyles.panelCount}>{count}</span>
      </div>
      {children}
    </article>
  );
}

function CockpitSignal({
  title,
  value,
  detail,
  href,
  tone = 'neutral',
}: {
  title: string;
  value: string;
  detail: string;
  href: string;
  tone?: 'neutral' | 'good' | 'warn' | 'danger';
}) {
  return (
    <Link href={href} className={`${cockpitStyles.signalCard} ${cockpitStyles[`signal_${tone}`]}`}>
      <span className={cockpitStyles.signalLabel}>{title}</span>
      <strong>{value}</strong>
      <span>{detail}</span>
    </Link>
  );
}

function ReadinessRows({ items, empty }: { items: ReadinessItem[]; empty: string }) {
  if (items.length === 0) return <PanelState label={empty} />;
  return (
    <div className={govStyles.governanceList}>
      {items.slice(0, 6).map((item) => (
        <Link key={item.service_id} href={`/services/${item.service_id}/edit#readiness-governance`} className={govStyles.governanceRow}>
          <Badge variant={item.blockers.length > 0 ? 'danger' : item.warnings.length > 0 ? 'warning' : 'success'}>
            {item.blockers.length > 0 ? 'Blocked' : item.warnings.length > 0 ? 'Warning' : 'Ready'}
          </Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.title}</strong>
            <span>{item.service_id} · {item.blockers.length} blockers · {item.warnings.length} warnings</span>
          </span>
          <span className={govStyles.rowMetric}>{item.service_status ?? 'draft'}</span>
        </Link>
      ))}
    </div>
  );
}

function ReviewRows({ items, empty }: { items: GovernanceReview[]; empty: string }) {
  if (items.length === 0) return <PanelState label={empty} />;
  return (
    <div className={govStyles.governanceList}>
      {items.slice(0, 6).map((item) => (
        <Link key={item.id} href="/operations/reviews" className={govStyles.governanceRow}>
          <Badge variant={item.overdue ? 'danger' : item.status === 'in_review' ? 'info' : 'neutral'}>
            {item.overdue ? 'Overdue' : item.status}
          </Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.service_title}</strong>
            <span>{item.service_id} · {item.review_type} · assigned {item.assigned_to ?? 'later'}</span>
          </span>
          <span className={govStyles.rowMetric}>{formatDate(item.due_at)}</span>
        </Link>
      ))}
    </div>
  );
}

function DecisionRows({ items, empty }: { items: GovernanceDecision[]; empty: string }) {
  if (items.length === 0) return <PanelState label={empty} />;
  return (
    <div className={govStyles.governanceList}>
      {items.slice(0, 6).map((item) => (
        <Link key={item.id} href="/operations/decisions" className={govStyles.governanceRow}>
          <Badge variant={item.decision === 'approved' ? 'success' : item.decision === 'deferred' ? 'warning' : 'neutral'}>
            {item.decision}
          </Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.service_title}</strong>
            <span>{item.decision_type} · {item.rationale || 'No rationale recorded'}</span>
          </span>
          <span className={govStyles.rowMetric}>{formatDate(item.decided_at)}</span>
        </Link>
      ))}
    </div>
  );
}

function ownerPanelHref(ownerKey: string) {
  return `/operations?owner=${encodeURIComponent(ownerKey)}#owner-load`;
}

function OwnerRows({ items, empty }: { items: OwnerLoadRow[]; empty: string }) {
  if (items.length === 0) return <PanelState label={empty} />;
  return (
    <div className={govStyles.governanceList}>
      {items.slice(0, 8).map((item) => (
        <Link key={item.owner_key} href={ownerPanelHref(item.owner_key)} className={govStyles.governanceRow}>
          <Badge variant={item.owner_load_score >= 80 ? 'danger' : item.owner_load_score >= 40 ? 'warning' : 'info'}>
            {item.owner_load_score}
          </Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.owner_name || item.owner_key}</strong>
            <span>{item.owned_services} services · {item.readiness_blockers} blockers · {item.overdue_reviews} overdue reviews</span>
          </span>
          <span className={govStyles.rowMetric}>{item.live_services} live</span>
        </Link>
      ))}
    </div>
  );
}

function formatRole(item: OwnerAssignmentRow) {
  return item.role_name || item.role_code.replace(/_/g, ' ');
}

function OwnerAssignmentRows({ items, owner }: { items: OwnerAssignmentRow[]; owner: string }) {
  if (!owner) return null;
  if (items.length === 0) return <PanelState label="No role assignments found for this owner." />;
  return (
    <div className={govStyles.governanceList}>
      {items.slice(0, 8).map((item) => (
        <Link key={item.assignment_id} href={`/services/${encodeURIComponent(item.service_id)}/edit#ownership`} className={govStyles.governanceRow}>
          <Badge variant={item.valid_to ? 'neutral' : 'info'}>{formatRole(item)}</Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.service_title}</strong>
            <span>{item.service_id} · {item.organization_name || 'no organization'}</span>
          </span>
          <span className={govStyles.rowMetric}>{item.lifecycle_state || 'draft'}</span>
        </Link>
      ))}
    </div>
  );
}

function DataQualityRows({
  incomplete,
  missingOwners,
  c3GapTotal,
}: {
  incomplete: CompletenessItem[];
  missingOwners: MissingOwnerItem[];
  c3GapTotal: number;
}) {
  return (
    <div className={govStyles.governanceList}>
      {missingOwners.slice(0, 4).map((service) => (
        <Link key={`owner:${service.service_id}`} href={`/services/${service.service_id}/edit#ownership`} className={govStyles.governanceRow}>
          <Badge variant="warning">Owner</Badge>
          <span className={govStyles.rowMain}>
            <strong>{service.title}</strong>
            <span>{service.service_id} · missing accountability</span>
          </span>
          <span className={govStyles.rowMetric}>fix</span>
        </Link>
      ))}
      {incomplete.slice(0, 4).map((service) => (
        <Link key={`metadata:${service.service_id}`} href={`/services/${service.service_id}/edit`} className={govStyles.governanceRow}>
          <Badge variant="warning">Metadata</Badge>
          <span className={govStyles.rowMain}>
            <strong>{service.title}</strong>
            <span>{service.service_id} · readiness {service.completeness_score ?? 0}%</span>
          </span>
          <span className={govStyles.rowMetric}>fix</span>
        </Link>
      ))}
      {c3GapTotal > 0 ? (
        <Link href="/capabilities?view=coverage" className={govStyles.governanceRow}>
          <Badge variant="info">Coverage</Badge>
          <span className={govStyles.rowMain}>
            <strong>Capability mapping gaps</strong>
            <span>{c3GapTotal} coverage gaps need catalogue or import evidence.</span>
          </span>
          <span className={govStyles.rowMetric}>review</span>
        </Link>
      ) : null}
    </div>
  );
}

export default function OperationsPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const cockpit = useDashboardSummary();
  const { data, isLoading, error } = useOperationsDashboard();
  const readiness = useReadinessSummary({ limit: 20 });
  const reviews = useGovernanceReviews({ limit: 20 });
  const decisions = useGovernanceDecisions({ limit: 10 });
  const ownerLoad = useOwnerLoad({ limit: 8 });
  const selectedOwner = searchParams?.get('owner') ?? '';
  const ownerAssignments = useOwnerAssignments(selectedOwner ? { owner: selectedOwner, limit: 50 } : {});

  if (isLoading) return <div className={styles.state}>{t('operations.loading')}</div>;
  if (error || !data) return <div className={styles.stateError}>{t('operations.unavailable')}</div>;

  const incomplete = data.sections.incomplete_metadata;
  const missingOwners = data.sections.missing_owners;
  const c3GapTotal = data.sections.c3_mapping_gap.reduce((sum, row) => sum + row.gap_count, 0);
  const ownerItems = ownerLoad.data?.items ?? [];
  const summary = cockpit.data?.summary;
  const readinessItems = readiness.data?.groups?.blockers?.length
    ? readiness.data.groups.blockers
    : readiness.data?.groups?.warnings ?? [];
  const readinessBlockerCount = readiness.data?.counts?.blockers ?? summary?.services_blocked_by_readiness ?? 0;
  const reviewItems = reviews.data?.items ?? [];
  const overdueReviewCount = reviewItems.filter((item) => item.overdue).length;
  const decisionItems = decisions.data?.items ?? [];
  const ownerAssignmentItems = ownerAssignments.data?.items ?? [];
  const dataQualityCount = incomplete.length + missingOwners.length + c3GapTotal;
  const summaryLinks = {
    ...DEFAULT_SUMMARY_LINKS,
    ...(cockpit.data?.links ?? {}),
    owner_load: '/operations#owner-load',
    import_data_quality: '/import',
  };
  const partialData = Boolean(readiness.error || reviews.error || decisions.error || ownerLoad.error || ownerAssignments.error);

  return (
    <main className={styles.shell}>
      <PageHeader
        title={t('operations.title')}
        purpose={t('operations.lead')}
        chips={[
          { label: 'action queue', tone: 'neutral' },
          { label: 'audit evidence', tone: 'neutral' },
        ]}
        primaryAction={{ label: 'Readiness', href: '/operations/readiness' }}
      />

      <section className={cockpitStyles.cockpitSummary} aria-label="Operations action summary">
        <div className={cockpitStyles.cockpitIntro}>
          <span className={styles.pageEyebrow}>Daily work queue</span>
          <h2>What needs attention today</h2>
          <p>Start with publish blockers, review deadlines, decisions, owner concentration, and import/data quality evidence.</p>
        </div>
        <div className={cockpitStyles.signalGrid}>
          <CockpitSignal
            title="Readiness Queue"
            value={formatCount(readinessBlockerCount)}
            detail="services blocked by readiness"
            href={summaryLinks.readiness_queue}
            tone={readinessBlockerCount > 0 ? 'danger' : 'good'}
          />
          <CockpitSignal
            title="Reviews"
            value={`${formatCount(overdueReviewCount || summary?.overdue_reviews)} / ${formatCount(reviewItems.length || summary?.active_governance_reviews)}`}
            detail="overdue / active reviews"
            href={summaryLinks.review_deadlines}
            tone={(overdueReviewCount || summary?.overdue_reviews || 0) > 0 ? 'danger' : 'neutral'}
          />
          <CockpitSignal
            title="Decisions"
            value={formatCount(decisionItems.length || summary?.recent_decisions)}
            detail="recent governance decisions"
            href={summaryLinks.recent_decisions}
            tone={(decisionItems.length || summary?.recent_decisions || 0) > 0 ? 'neutral' : 'warn'}
          />
          <CockpitSignal
            title="Owner Load"
            value={formatCount(ownerItems.length)}
            detail="owners with concentrated blockers"
            href={summaryLinks.owner_load}
            tone={ownerItems.some((item) => item.owner_load_score >= 80) ? 'danger' : ownerItems.length ? 'warn' : 'good'}
          />
          <CockpitSignal
            title="Import / Data Quality"
            value={formatCount(dataQualityCount)}
            detail="metadata, owner, and coverage fixes"
            href="#data-quality"
            tone={dataQualityCount ? 'warn' : 'good'}
          />
          <CockpitSignal
            title="Ready For Publish"
            value={`${formatCount(summary?.services_ready_for_publish)}/${formatCount(summary?.total_services)}`}
            detail="catalogue records with enough evidence"
            href={summaryLinks.governance_health}
            tone={summary?.services_blocked_by_readiness ? 'warn' : 'good'}
          />
        </div>
      </section>

      <section className={styles.kpiThree} aria-label="Operations queue KPIs">
        <Link href="/operations/readiness?filter=blocked" className={styles.kpiLink} aria-label="Otevřít připravenost blokery">
          <KpiCard
            label="Readiness blockers"
            value={readinessBlockerCount}
            tone={readinessBlockerCount ? 'danger' : 'success'}
            hint="blocks publish until fixed or excepted"
          />
        </Link>
        <Link href={`/operations/reviews?overdue=1&status=${encodeURIComponent(OPEN_REVIEW_STATUS_FILTER)}`} className={styles.kpiLink} aria-label="Otevřít revize po termínu">
          <KpiCard
            label="Overdue reviews"
            value={overdueReviewCount || summary?.overdue_reviews || 0}
            tone={(overdueReviewCount || summary?.overdue_reviews || 0) ? 'danger' : 'success'}
            hint="needs owner or governance action"
          />
        </Link>
        <Link href="/operations#data-quality" className={styles.kpiLink} aria-label="Otevřít opravy kvality dat">
          <KpiCard
            label="Data quality fixes"
            value={dataQualityCount}
            tone={dataQualityCount ? 'warning' : 'success'}
            hint="metadata, owners, import evidence"
          />
        </Link>
      </section>

      <section className={govStyles.governanceSection} aria-label="Operations action queue">
        <div className={govStyles.governanceHeader}>
          <div>
            <h2 className={govStyles.governanceTitle}>Action queue</h2>
            <p className={govStyles.governanceLead}>Focused work queue for readiness, reviews, decisions, owner load, and import/data quality.</p>
          </div>
          {partialData ? <Badge variant="warning">partial data</Badge> : <Badge variant="info">live data</Badge>}
        </div>

        <div className={govStyles.governanceGrid}>
          <GovernancePanel title="Readiness blockers" hint="Services that cannot be published without a fix or exception." count={readinessBlockerCount || readinessItems.length}>
            {readiness.isLoading && readinessItems.length === 0 ? (
              <PanelState label="Loading readiness queue..." />
            ) : (
              <ReadinessRows items={readinessItems} empty="No readiness blockers." />
            )}
            <Link href="/operations/readiness" className={styles.secondaryLink}>Open readiness gate</Link>
          </GovernancePanel>

          <GovernancePanel title="Reviews" hint="Board/list workflow for publication, owner, and coverage reviews." count={reviewItems.length}>
            {reviews.isLoading && reviewItems.length === 0 ? <PanelState label="Loading reviews..." /> : <ReviewRows items={reviewItems} empty="No open reviews." />}
            <Link href="/operations/reviews" className={styles.secondaryLink}>Open review board</Link>
          </GovernancePanel>

          <GovernancePanel title="Decisions" hint="Recent governance decisions and deferrals with audit evidence." count={decisionItems.length}>
            {decisions.isLoading && decisionItems.length === 0 ? <PanelState label="Loading decisions..." /> : <DecisionRows items={decisionItems} empty="No recent decisions." />}
            <Link href="/operations/decisions" className={styles.secondaryLink}>Open decision log</Link>
          </GovernancePanel>

          <GovernancePanel id="owner-load" title="Owner load" hint="Owner concentration as an operations panel, not a separate application." count={ownerItems.length}>
            {ownerLoad.isLoading && ownerItems.length === 0 ? <PanelState label="Loading owner load..." /> : <OwnerRows items={ownerItems} empty="Owner load is balanced." />}
            {selectedOwner ? (
              <div className={govStyles.governancePanel} aria-label="Selected owner assignments">
                <div className={govStyles.panelHeader}>
                  <div>
                    <h3 className={govStyles.panelTitle}>Assignments for {selectedOwner}</h3>
                    <p className={govStyles.panelHint}>Services where this owner has an active role.</p>
                  </div>
                  <span className={govStyles.panelCount}>{ownerAssignmentItems.length}</span>
                </div>
                {ownerAssignments.isLoading && ownerAssignmentItems.length === 0 ? (
                  <PanelState label="Loading owner assignments..." />
                ) : (
                  <OwnerAssignmentRows items={ownerAssignmentItems} owner={selectedOwner} />
                )}
              </div>
            ) : null}
          </GovernancePanel>

          <GovernancePanel id="data-quality" title="Import and data quality" hint="Catalogue quality fixes plus the import workspace for controlled corrections." count={dataQualityCount}>
            {dataQualityCount === 0 ? (
              <PanelState label="No data quality fixes queued." />
            ) : (
              <DataQualityRows incomplete={incomplete} missingOwners={missingOwners} c3GapTotal={c3GapTotal} />
            )}
            <div className={styles.headerActions}>
              <Link href="/import" className={styles.secondaryLink}>Open import workspace</Link>
              <Link href="/services/list" className={styles.secondaryLink}>Open service list</Link>
            </div>
          </GovernancePanel>

          <GovernancePanel title="Lowest readiness services" hint="Catalogue records with weak evidence, shown as fix targets only." count={incomplete.length}>
            <ServiceRows items={incomplete} empty="All services are above the threshold." />
          </GovernancePanel>
        </div>
      </section>
    </main>
  );
}
