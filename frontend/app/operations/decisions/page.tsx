'use client';

import { useState } from 'react';
import Link from '@/app/components/AppLink';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/app/components/PageHeader';
import { DecisionRecordModal, type DecisionRecordValue } from '@/app/components/layout-v2';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import { authHeaders } from '@/features/services/api/services.api';
import { useT } from '@/app/i18n/useI18n';
import { formatCountLabel } from '@/app/lib/counts';
import { useGovernanceDecisions } from '@/features/governance/hooks/useGovernance';
import type { GovernanceDecision } from '@/features/governance/types';
import styles from '../../dashboard/dashboard.module.css';
import govStyles from '../governance.module.css';

type DecisionFilter = 'all' | 'approved' | 'deferred' | 'rejected';
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

function decisionLabel(t: Translate, decision: string) {
  const key = DECISION_LABEL_KEYS[decision];
  return key ? t(key) : decision;
}

function decisionTypeLabel(t: Translate, decisionType: string) {
  const key = DECISION_TYPE_LABEL_KEYS[decisionType];
  return key ? t(key) : decisionType.replace(/_/g, ' ');
}

function decisionVariant(decision: string) {
  if (decision === 'approved') return 'success';
  if (decision === 'rejected' || decision === 'cancelled') return 'danger';
  if (decision === 'deferred') return 'warning';
  return 'neutral';
}

function formatDate(value: string | null | undefined, emptyLabel: string) {
  if (!value) return emptyLabel;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

function optionalDecisionField(item: GovernanceDecision, key: 'evidence' | 'expires_at' | 'affected_summary') {
  return (item as GovernanceDecision & Partial<Record<typeof key, string | null>>)[key] ?? null;
}

function resolveDecisionFilter(value: string | null | undefined): DecisionFilter {
  if (value === 'approved' || value === 'deferred') return value;
  if (value === 'rejected' || value === 'cancelled' || value === 'rejected,cancelled') return 'rejected';
  return 'all';
}

function decisionFilterHref(filter: DecisionFilter, serviceFilter: string) {
  const params = new URLSearchParams();
  if (serviceFilter) params.set('service_id', serviceFilter);
  if (filter === 'approved' || filter === 'deferred') params.set('decision', filter);
  if (filter === 'rejected') params.set('decision', 'rejected,cancelled');
  const qs = params.toString();
  return `/operations/decisions${qs ? `?${qs}` : ''}`;
}

function DecisionCard({ item }: { item: GovernanceDecision }) {
  const t = useT();
  const noDate = t('operations.decisions.no_date');
  const evidence = optionalDecisionField(item, 'evidence');
  const expiresAt = optionalDecisionField(item, 'expires_at');
  const affectedSummary = optionalDecisionField(item, 'affected_summary') ?? t('layout.decision_record_modal.affects_service', { id: item.service_id });

  return (
    <article className={govStyles.decisionCard}>
      <div className={govStyles.decisionCardHeader}>
        <Link href={`/services/${item.service_id}`} className={govStyles.decisionCardTitle}>
          <strong>{item.service_title}</strong>
          <span>{item.service_id} · {decisionTypeLabel(t, item.decision_type)} · {formatDate(item.decided_at, noDate)}</span>
        </Link>
        <Badge variant={decisionVariant(item.decision)}>{decisionLabel(t, item.decision)}</Badge>
      </div>
      <div className={govStyles.decisionFactGrid}>
        <div className={govStyles.decisionFact}>
          <span>{t('operations.decisions.fact.what')}</span>
          <strong>{decisionTypeLabel(t, item.decision_type)}</strong>
        </div>
        <div className={govStyles.decisionFact}>
          <span>{t('operations.decisions.fact.why')}</span>
          <strong>{item.rationale || t('operations.decisions.no_rationale')}</strong>
        </div>
        <div className={govStyles.decisionFact}>
          <span>{t('operations.decisions.fact.affects')}</span>
          <strong>{affectedSummary}</strong>
        </div>
        <div className={govStyles.decisionFact}>
          <span>{t('operations.decisions.fact.expires')}</span>
          <strong>{formatDate(expiresAt, noDate)}</strong>
        </div>
      </div>
      <div className={govStyles.workflowMeta}>
        <span>{t('operations.decisions.evidence', { value: evidence || t('operations.decisions.evidence_missing') })}</span>
        <span>{t('operations.decisions.recorded_by', { name: item.decided_by ?? t('operations.decisions.recorded_by_unknown') })}</span>
      </div>
    </article>
  );
}

export default function GovernanceDecisionsPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const serviceFilter = searchParams?.get('service_id') ?? '';
  const decisionFilter = resolveDecisionFilter(searchParams?.get('decision') ?? searchParams?.get('filter'));
  const { data, isLoading, error, mutate } = useGovernanceDecisions({ limit: 200, serviceId: serviceFilter || undefined });
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordBusy, setRecordBusy] = useState(false);
  const decisions = data?.items ?? [];
  const visibleDecisions = decisions.filter((item) => {
    if (decisionFilter === 'all') return true;
    if (decisionFilter === 'rejected') return item.decision === 'rejected' || item.decision === 'cancelled';
    return item.decision === decisionFilter;
  });
  const approved = decisions.filter((item) => item.decision === 'approved').length;
  const deferred = decisions.filter((item) => item.decision === 'deferred').length;
  const rejected = decisions.filter((item) => item.decision === 'rejected' || item.decision === 'cancelled').length;

  async function recordDecision(value: DecisionRecordValue) {
    setRecordBusy(true);
    setRecordError(null);
    try {
      const response = await fetch('/api/v1/governance/decisions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          service_id: value.service_id,
          decision_type: value.decision_type,
          decision: value.decision,
          rationale: value.rationale || null,
          evidence: value.evidence || null,
          expires_at: value.expires_at ? `${value.expires_at}T00:00:00Z` : null,
        }),
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      setRecordOpen(false);
      await mutate();
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : t('operations.decisions.record_failed'));
    } finally {
      setRecordBusy(false);
    }
  }

  if (isLoading) return <div className={styles.state}>{t('operations.decisions.loading')}</div>;
  if (error || !data) return <div className={styles.stateError}>{t('operations.decisions.unavailable')}</div>;

  return (
    <main className={styles.shell}>
      <PageHeader
        title={t('operations.decisions.title')}
        purpose={t('operations.decisions.purpose')}
        chips={[
          { label: formatCountLabel(decisions.length, { one: t('operations.decisions.count.decision.one'), few: t('operations.decisions.count.decision.few'), many: t('operations.decisions.count.decision.many') }), tone: 'info' },
          { label: formatCountLabel(approved, { one: t('operations.decisions.count.approved.one'), few: t('operations.decisions.count.approved.few'), many: t('operations.decisions.count.approved.many') }), tone: 'ok' },
          { label: formatCountLabel(deferred, { one: t('operations.decisions.count.deferred.one'), few: t('operations.decisions.count.deferred.few'), many: t('operations.decisions.count.deferred.many') }), tone: deferred ? 'warn' : 'neutral' },
          ...(decisionFilter !== 'all' ? [{ label: t('operations.decisions.chip.filter', { value: decisionLabel(t, decisionFilter) }), tone: 'info' as const }] : []),
          ...(serviceFilter ? [{ label: t('layout.decision_record_modal.affects_service', { id: serviceFilter }), tone: 'info' as const }] : []),
        ]}
        primaryAction={{ label: t('operations.decisions.record'), onClick: () => setRecordOpen(true) }}
      />

      <section className={govStyles.decisionKpiGrid} aria-label={t('operations.decisions.kpi_aria')}>
        <Link href={decisionFilterHref('all', serviceFilter)} className={`${govStyles.kpiLink} ${decisionFilter === 'all' ? govStyles.kpiLinkActive : ''}`} aria-label={t('operations.decisions.filter_aria.all')}>
          <KpiCard label={t('operations.decisions.kpi.decisions')} value={decisions.length} hint={t('operations.decisions.kpi.decisions_hint')} tone="info" />
        </Link>
        <Link href={decisionFilterHref('approved', serviceFilter)} className={`${govStyles.kpiLink} ${decisionFilter === 'approved' ? govStyles.kpiLinkActive : ''}`} aria-label={t('operations.decisions.filter_aria.approved')}>
          <KpiCard label={t('layout.decision_record_modal.decision.approved')} value={approved} hint={t('operations.decisions.kpi.approved_hint')} tone="success" />
        </Link>
        <Link href={decisionFilterHref('deferred', serviceFilter)} className={`${govStyles.kpiLink} ${decisionFilter === 'deferred' ? govStyles.kpiLinkActive : ''}`} aria-label={t('operations.decisions.filter_aria.deferred')}>
          <KpiCard label={t('layout.decision_record_modal.decision.deferred')} value={deferred} hint={t('operations.decisions.kpi.deferred_hint')} tone={deferred ? 'warning' : 'neutral'} />
        </Link>
        <Link href={decisionFilterHref('rejected', serviceFilter)} className={`${govStyles.kpiLink} ${decisionFilter === 'rejected' ? govStyles.kpiLinkActive : ''}`} aria-label={t('operations.decisions.filter_aria.rejected')}>
          <KpiCard label={t('layout.decision_record_modal.decision.rejected')} value={rejected} hint={t('operations.decisions.kpi.rejected_hint')} tone={rejected ? 'danger' : 'neutral'} />
        </Link>
      </section>

      <section className={govStyles.workflowGrid}>
        <article className={govStyles.governancePanel}>
          <div className={govStyles.panelHeader}>
            <div>
              <h2 className={govStyles.panelTitle}>{t('operations.decisions.history_title')}</h2>
              <p className={govStyles.panelHint}>{t('operations.decisions.history_hint')}</p>
            </div>
            <span className={govStyles.panelCount}>{visibleDecisions.length}</span>
          </div>
          {visibleDecisions.length === 0 ? <EmptyState title={t('operations.decisions.empty')} /> : (
            <div className={govStyles.decisionCardGrid}>
              {visibleDecisions.map((item) => <DecisionCard key={item.id} item={item} />)}
            </div>
          )}
        </article>

        <aside className={govStyles.governancePanel}>
          <h2 className={govStyles.panelTitle}>{t('operations.decisions.record_title')}</h2>
          <p className={govStyles.panelHint}>
            {t('operations.decisions.record_hint')}
          </p>
          <button type="button" className={govStyles.primaryAction} onClick={() => setRecordOpen(true)}>{t('operations.decisions.record')}</button>
        </aside>
      </section>

      {recordOpen && (
        <DecisionRecordModal
          requireService
          busy={recordBusy}
          error={recordError}
          onClose={() => setRecordOpen(false)}
          onSubmit={recordDecision}
        />
      )}
    </main>
  );
}
