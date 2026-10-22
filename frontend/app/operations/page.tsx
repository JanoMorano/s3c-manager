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
import { formatCountLabel, resolveCountForm, type CountForms } from '@/app/lib/counts';
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

type Translate = ReturnType<typeof useT>;

const DECISION_LABEL_KEYS: Record<string, string> = {
  approved: 'layout.decision_record_modal.decision.approved',
  rejected: 'layout.decision_record_modal.decision.rejected',
  deferred: 'layout.decision_record_modal.decision.deferred',
  cancelled: 'layout.decision_record_modal.decision.cancelled',
};

const DECISION_TYPE_LABEL_KEYS: Record<string, string> = {
  publish: 'layout.decision_record_modal.decision_type.publish',
  exception: 'layout.decision_record_modal.decision_type.exception',
  lifecycle: 'layout.decision_record_modal.decision_type.lifecycle',
  other: 'layout.decision_record_modal.decision_type.other',
};

const REVIEW_STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'operations.review_status.pending',
  in_review: 'operations.review_status.in_review',
  approved: 'operations.review_status.approved',
  rejected: 'operations.review_status.rejected',
  deferred: 'operations.review_status.deferred',
  cancelled: 'operations.review_status.cancelled',
};

function labelFromMap(t: Translate, map: Record<string, string>, value: string) {
  const key = map[value];
  return key ? t(key) : value;
}

function countLabel(t: Translate, count: number, prefix: string) {
  return formatCountLabel(count, { one: t(`${prefix}.one`), few: t(`${prefix}.few`), many: t(`${prefix}.many`) });
}

function countKey(count: number, prefix: string) {
  const forms: CountForms = { one: `${prefix}.one`, few: `${prefix}.few`, many: `${prefix}.many` };
  return resolveCountForm(count, forms);
}

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

function formatDate(value: string | null | undefined, emptyLabel: string) {
  if (!value) return emptyLabel;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

function ServiceRows({ items, empty }: { items: CompletenessItem[]; empty: string }) {
  const t = useT();
  if (items.length === 0) return <EmptyState title={empty} />;
  return (
    <div className={styles.auditList}>
      {items.slice(0, 6).map((service) => {
        const score = service.completeness_score ?? 0;
        return (
          <Link key={service.service_id} href={`/services/${service.service_id}/edit`} className={styles.queueRowLink}>
            <span>
              <strong>{service.title}</strong>
              <small>{service.service_id} · {service.service_status ?? t('operations.value.unknown')}</small>
            </span>
            <span className={styles.workProgress}>
              <ProgressBar value={score} tone={readinessTone(score)} label={t('operations.row.readiness_label', { title: service.title })} />
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
  const t = useT();
  if (items.length === 0) return <PanelState label={empty} />;
  return (
    <div className={govStyles.governanceList}>
      {items.slice(0, 6).map((item) => (
        <Link key={item.service_id} href={`/services/${item.service_id}/edit#readiness-governance`} className={govStyles.governanceRow}>
          <Badge variant={item.blockers.length > 0 ? 'danger' : item.warnings.length > 0 ? 'warning' : 'success'}>
            {t(item.blockers.length > 0 ? 'service_list.row.state.blocked' : item.warnings.length > 0 ? 'service_list.row.state.warning' : 'service_list.row.state.ready')}
          </Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.title}</strong>
            <span>{item.service_id} · {countLabel(t, item.blockers.length, 'layout.review_action_modal.blockers')} · {countLabel(t, item.warnings.length, 'layout.review_action_modal.warnings')}</span>
          </span>
          <span className={govStyles.rowMetric}>{item.service_status ?? t('operations.value.draft')}</span>
        </Link>
      ))}
    </div>
  );
}

function ReviewRows({ items, empty }: { items: GovernanceReview[]; empty: string }) {
  const t = useT();
  if (items.length === 0) return <PanelState label={empty} />;
  return (
    <div className={govStyles.governanceList}>
      {items.slice(0, 6).map((item) => (
        <Link key={item.id} href="/operations/reviews" className={govStyles.governanceRow}>
          <Badge variant={item.overdue ? 'danger' : item.status === 'in_review' ? 'info' : 'neutral'}>
            {item.overdue ? t('operations.review_status.overdue') : labelFromMap(t, REVIEW_STATUS_LABEL_KEYS, item.status)}
          </Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.service_title}</strong>
            <span>{item.service_id} · {item.review_type} · {t('operations.row.assigned', { name: item.assigned_to ?? t('operations.row.assigned_later') })}</span>
          </span>
          <span className={govStyles.rowMetric}>{formatDate(item.due_at, t('service_detail.text.no_due_date'))}</span>
        </Link>
      ))}
    </div>
  );
}

function DecisionRows({ items, empty }: { items: GovernanceDecision[]; empty: string }) {
  const t = useT();
  if (items.length === 0) return <PanelState label={empty} />;
  return (
    <div className={govStyles.governanceList}>
      {items.slice(0, 6).map((item) => (
        <Link key={item.id} href="/operations/decisions" className={govStyles.governanceRow}>
          <Badge variant={item.decision === 'approved' ? 'success' : item.decision === 'deferred' ? 'warning' : 'neutral'}>
            {labelFromMap(t, DECISION_LABEL_KEYS, item.decision)}
          </Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.service_title}</strong>
            <span>{labelFromMap(t, DECISION_TYPE_LABEL_KEYS, item.decision_type)} · {item.rationale || t('operations.decisions.no_rationale')}</span>
          </span>
          <span className={govStyles.rowMetric}>{formatDate(item.decided_at, t('operations.decisions.no_date'))}</span>
        </Link>
      ))}
    </div>
  );
}

function ownerPanelHref(ownerKey: string) {
  return `/operations?owner=${encodeURIComponent(ownerKey)}#owner-load`;
}

function OwnerRows({ items, empty }: { items: OwnerLoadRow[]; empty: string }) {
  const t = useT();
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
            <span>{countLabel(t, item.owned_services, 'operations.count.service')} · {countLabel(t, item.readiness_blockers, 'layout.review_action_modal.blockers')} · {countLabel(t, item.overdue_reviews, 'operations.count.overdue_review')}</span>
          </span>
          <span className={govStyles.rowMetric}>{t('operations.row.live_services', { count: item.live_services })}</span>
        </Link>
      ))}
    </div>
  );
}

function formatRole(item: OwnerAssignmentRow) {
  return item.role_name || item.role_code.replace(/_/g, ' ');
}

function OwnerAssignmentRows({ items, owner }: { items: OwnerAssignmentRow[]; owner: string }) {
  const t = useT();
  if (!owner) return null;
  if (items.length === 0) return <PanelState label={t('operations.owner_assignments.empty')} />;
  return (
    <div className={govStyles.governanceList}>
      {items.slice(0, 8).map((item) => (
        <Link key={item.assignment_id} href={`/services/${encodeURIComponent(item.service_id)}/edit#ownership`} className={govStyles.governanceRow}>
          <Badge variant={item.valid_to ? 'neutral' : 'info'}>{formatRole(item)}</Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.service_title}</strong>
            <span>{item.service_id} · {item.organization_name || t('operations.owner_assignments.no_organization')}</span>
          </span>
          <span className={govStyles.rowMetric}>{item.lifecycle_state || t('operations.value.draft')}</span>
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
  const t = useT();
  return (
    <div className={govStyles.governanceList}>
      {missingOwners.slice(0, 4).map((service) => (
        <Link key={`owner:${service.service_id}`} href={`/services/${service.service_id}/edit#ownership`} className={govStyles.governanceRow}>
          <Badge variant="warning">{t('operations.data_quality.badge.owner')}</Badge>
          <span className={govStyles.rowMain}>
            <strong>{service.title}</strong>
            <span>{service.service_id} · {t('operations.kpi.owner_hint')}</span>
          </span>
          <span className={govStyles.rowMetric}>{t('operations.data_quality.fix')}</span>
        </Link>
      ))}
      {incomplete.slice(0, 4).map((service) => (
        <Link key={`metadata:${service.service_id}`} href={`/services/${service.service_id}/edit`} className={govStyles.governanceRow}>
          <Badge variant="warning">{t('operations.data_quality.badge.metadata')}</Badge>
          <span className={govStyles.rowMain}>
            <strong>{service.title}</strong>
            <span>{service.service_id} · {t('operations.data_quality.readiness_score', { score: service.completeness_score ?? 0 })}</span>
          </span>
          <span className={govStyles.rowMetric}>{t('operations.data_quality.fix')}</span>
        </Link>
      ))}
      {c3GapTotal > 0 ? (
        <Link href="/capabilities?view=coverage" className={govStyles.governanceRow}>
          <Badge variant="info">{t('operations.data_quality.badge.coverage')}</Badge>
          <span className={govStyles.rowMain}>
            <strong>{t('operations.data_quality.capability_gaps')}</strong>
            <span>{t(countKey(c3GapTotal, 'operations.data_quality.coverage_gaps'), { count: c3GapTotal })}</span>
          </span>
          <span className={govStyles.rowMetric}>{t('operations.data_quality.review')}</span>
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
  // Server-side counts cover every review task; the item list is only the first page.
  const overdueReviewCount = summary?.overdue_reviews ?? reviewItems.filter((item) => item.overdue).length;
  const activeReviewCount = summary?.active_governance_reviews ?? reviewItems.length;
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
        primaryAction={{ label: t('operations.action.readiness'), href: '/operations/readiness' }}
      />

      <section className={cockpitStyles.cockpitSummary} aria-label={t('operations.summary.aria')}>
        <div className={cockpitStyles.cockpitIntro}>
          <span className={styles.pageEyebrow}>{t('operations.summary.eyebrow')}</span>
          <h2>{t('operations.summary.title')}</h2>
          <p>{t('operations.summary.lead')}</p>
        </div>
        <div className={cockpitStyles.signalGrid}>
          <CockpitSignal
            title={t('operations.signal.readiness.title')}
            value={formatCount(readinessBlockerCount)}
            detail={t('operations.signal.readiness.detail')}
            href={summaryLinks.readiness_queue}
            tone={readinessBlockerCount > 0 ? 'danger' : 'good'}
          />
          <CockpitSignal
            title={t('operations.signal.reviews.title')}
            value={`${formatCount(overdueReviewCount)} / ${formatCount(activeReviewCount)}`}
            detail={t('operations.signal.reviews.detail')}
            href={summaryLinks.review_deadlines}
            tone={overdueReviewCount > 0 ? 'danger' : 'neutral'}
          />
          <CockpitSignal
            title={t('operations.signal.decisions.title')}
            value={formatCount(decisionItems.length || summary?.recent_decisions)}
            detail={t('operations.signal.decisions.detail')}
            href={summaryLinks.recent_decisions}
            tone={(decisionItems.length || summary?.recent_decisions || 0) > 0 ? 'neutral' : 'warn'}
          />
          <CockpitSignal
            title={t('operations.signal.owner_load.title')}
            value={formatCount(ownerItems.length)}
            detail={t('operations.signal.owner_load.detail')}
            href={summaryLinks.owner_load}
            tone={ownerItems.some((item) => item.owner_load_score >= 80) ? 'danger' : ownerItems.length ? 'warn' : 'good'}
          />
          <CockpitSignal
            title={t('operations.signal.data_quality.title')}
            value={formatCount(dataQualityCount)}
            detail={t('operations.signal.data_quality.detail')}
            href="#data-quality"
            tone={dataQualityCount ? 'warn' : 'good'}
          />
          <CockpitSignal
            title={t('operations.signal.ready.title')}
            value={`${formatCount(summary?.services_ready_for_publish)}/${formatCount(summary?.total_services)}`}
            detail={t('operations.signal.ready.detail')}
            href={summaryLinks.governance_health}
            tone={summary?.services_blocked_by_readiness ? 'warn' : 'good'}
          />
        </div>
      </section>

      <section className={styles.kpiThree} aria-label={t('operations.kpi.aria')}>
        <Link href="/operations/readiness?filter=blocked" className={styles.kpiLink} aria-label={t('operations.kpi.blockers_aria')}>
          <KpiCard
            label={t('operations.kpi.blockers')}
            value={readinessBlockerCount}
            tone={readinessBlockerCount ? 'danger' : 'success'}
            hint={t('operations.kpi.blockers_hint')}
          />
        </Link>
        <Link href={`/operations/reviews?overdue=1&status=${encodeURIComponent(OPEN_REVIEW_STATUS_FILTER)}`} className={styles.kpiLink} aria-label={t('operations.kpi.overdue_aria')}>
          <KpiCard
            label={t('operations.kpi.overdue')}
            value={overdueReviewCount}
            tone={overdueReviewCount ? 'danger' : 'success'}
            hint={t('operations.kpi.overdue_hint')}
          />
        </Link>
        <Link href="/operations#data-quality" className={styles.kpiLink} aria-label={t('operations.kpi.data_quality_aria')}>
          <KpiCard
            label={t('operations.kpi.data_quality')}
            value={dataQualityCount}
            tone={dataQualityCount ? 'warning' : 'success'}
            hint={t('operations.kpi.data_quality_hint')}
          />
        </Link>
      </section>

      <section className={govStyles.governanceSection} aria-label={t('operations.queue.aria')}>
        <div className={govStyles.governanceHeader}>
          <div>
            <h2 className={govStyles.governanceTitle}>{t('operations.governance.title')}</h2>
            <p className={govStyles.governanceLead}>{t('operations.queue.lead')}</p>
          </div>
          {partialData ? <Badge variant="warning">{t('operations.governance.partial')}</Badge> : <Badge variant="info">{t('operations.governance.live')}</Badge>}
        </div>

        <div className={govStyles.governanceGrid}>
          <GovernancePanel title={t('operations.kpi.blockers')} hint={t('operations.panel.readiness.hint')} count={readinessBlockerCount || readinessItems.length}>
            {readiness.isLoading && readinessItems.length === 0 ? (
              <PanelState label={t('operations.panel.readiness.loading')} />
            ) : (
              <ReadinessRows items={readinessItems} empty={t('operations.panel.readiness.empty')} />
            )}
            <Link href="/operations/readiness" className={styles.secondaryLink}>{t('operations.panel.readiness.open')}</Link>
          </GovernancePanel>

          <GovernancePanel title={t('operations.signal.reviews.title')} hint={t('operations.panel.reviews.hint')} count={reviewItems.length}>
            {reviews.isLoading && reviewItems.length === 0 ? <PanelState label={t('operations.panel.reviews.loading')} /> : <ReviewRows items={reviewItems} empty={t('operations.panel.reviews.empty')} />}
            <Link href="/operations/reviews" className={styles.secondaryLink}>{t('operations.panel.reviews.open')}</Link>
          </GovernancePanel>

          <GovernancePanel title={t('operations.signal.decisions.title')} hint={t('operations.panel.decisions.hint')} count={decisionItems.length}>
            {decisions.isLoading && decisionItems.length === 0 ? <PanelState label={t('operations.panel.decisions.loading')} /> : <DecisionRows items={decisionItems} empty={t('operations.panel.decisions.empty')} />}
            <Link href="/operations/decisions" className={styles.secondaryLink}>{t('operations.panel.decisions.open')}</Link>
          </GovernancePanel>

          <GovernancePanel id="owner-load" title={t('operations.signal.owner_load.title')} hint={t('operations.panel.owner_load.hint')} count={ownerItems.length}>
            {ownerLoad.isLoading && ownerItems.length === 0 ? <PanelState label={t('operations.panel.owner_load.loading')} /> : <OwnerRows items={ownerItems} empty={t('operations.governance.owner.empty')} />}
            {selectedOwner ? (
              <div className={govStyles.governancePanel} aria-label={t('operations.owner_assignments.aria')}>
                <div className={govStyles.panelHeader}>
                  <div>
                    <h3 className={govStyles.panelTitle}>{t('operations.owner_assignments.title', { owner: selectedOwner })}</h3>
                    <p className={govStyles.panelHint}>{t('operations.owner_assignments.hint')}</p>
                  </div>
                  <span className={govStyles.panelCount}>{ownerAssignmentItems.length}</span>
                </div>
                {ownerAssignments.isLoading && ownerAssignmentItems.length === 0 ? (
                  <PanelState label={t('operations.owner_assignments.loading')} />
                ) : (
                  <OwnerAssignmentRows items={ownerAssignmentItems} owner={selectedOwner} />
                )}
              </div>
            ) : null}
          </GovernancePanel>

          <GovernancePanel id="data-quality" title={t('operations.panel.data_quality.title')} hint={t('operations.panel.data_quality.hint')} count={dataQualityCount}>
            {dataQualityCount === 0 ? (
              <PanelState label={t('operations.panel.data_quality.empty')} />
            ) : (
              <DataQualityRows incomplete={incomplete} missingOwners={missingOwners} c3GapTotal={c3GapTotal} />
            )}
            <div className={styles.headerActions}>
              <Link href="/import" className={styles.secondaryLink}>{t('operations.panel.data_quality.open_import')}</Link>
              <Link href="/services/list" className={styles.secondaryLink}>{t('operations.open_service_list')}</Link>
            </div>
          </GovernancePanel>

          <GovernancePanel title={t('operations.panel.lowest_readiness.title')} hint={t('operations.panel.lowest_readiness.hint')} count={incomplete.length}>
            <ServiceRows items={incomplete} empty={t('operations.incomplete.empty')} />
          </GovernancePanel>
        </div>
      </section>
    </main>
  );
}
