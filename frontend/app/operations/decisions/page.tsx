'use client';

import { useState } from 'react';
import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { DecisionRecordModal, type DecisionRecordValue } from '@/app/components/layout-v2';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import { authHeaders } from '@/features/services/api/services.api';
import { useGovernanceDecisions } from '@/features/governance/hooks/useGovernance';
import type { GovernanceDecision } from '@/features/governance/types';
import styles from '../../dashboard/dashboard.module.css';
import govStyles from '../governance.module.css';

function decisionVariant(decision: string) {
  if (decision === 'approved') return 'success';
  if (decision === 'rejected' || decision === 'cancelled') return 'danger';
  if (decision === 'deferred') return 'warning';
  return 'neutral';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

function optionalDecisionField(item: GovernanceDecision, key: 'evidence' | 'expires_at' | 'affected_summary') {
  return (item as GovernanceDecision & Partial<Record<typeof key, string | null>>)[key] ?? null;
}

function DecisionCard({ item }: { item: GovernanceDecision }) {
  const evidence = optionalDecisionField(item, 'evidence');
  const expiresAt = optionalDecisionField(item, 'expires_at');
  const affectedSummary = optionalDecisionField(item, 'affected_summary') ?? `Service ${item.service_id}`;

  return (
    <article className={govStyles.decisionCard}>
      <div className={govStyles.decisionCardHeader}>
        <Link href={`/services/${item.service_id}`} className={govStyles.decisionCardTitle}>
          <strong>{item.service_title}</strong>
          <span>{item.service_id} · {item.decision_type} · {formatDate(item.decided_at)}</span>
        </Link>
        <Badge variant={decisionVariant(item.decision)}>{item.decision}</Badge>
      </div>
      <div className={govStyles.decisionFactGrid}>
        <div className={govStyles.decisionFact}>
          <span>What</span>
          <strong>{item.decision_type.replace(/_/g, ' ')}</strong>
        </div>
        <div className={govStyles.decisionFact}>
          <span>Why</span>
          <strong>{item.rationale || 'Bez odůvodnění v záznamu.'}</strong>
        </div>
        <div className={govStyles.decisionFact}>
          <span>Affects</span>
          <strong>{affectedSummary}</strong>
        </div>
        <div className={govStyles.decisionFact}>
          <span>Expires</span>
          <strong>{formatDate(expiresAt)}</strong>
        </div>
      </div>
      <div className={govStyles.workflowMeta}>
        <span>Evidence: {evidence || 'not provided'}</span>
        <span>Recorded by {item.decided_by ?? 'unknown'}</span>
      </div>
    </article>
  );
}

export default function GovernanceDecisionsPage() {
  const { data, isLoading, error, mutate } = useGovernanceDecisions({ limit: 200 });
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordBusy, setRecordBusy] = useState(false);
  const decisions = data?.items ?? [];
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
      setRecordError(err instanceof Error ? err.message : 'Decision could not be recorded');
    } finally {
      setRecordBusy(false);
    }
  }

  if (isLoading) return <div className={styles.state}>Loading decision log...</div>;
  if (error || !data) return <div className={styles.stateError}>Decision log is not available.</div>;

  return (
    <main className={styles.shell}>
      <PageHeader
        title="Decision Log"
        purpose="Auditní znalostní báze rozhodnutí: co bylo schváleno, proč, čeho se to týká, kdy končí a jaký existuje důkaz."
        chips={[
          { label: `${decisions.length} decisions`, tone: 'info' },
          { label: `${approved} approved`, tone: 'ok' },
          { label: `${deferred} deferred`, tone: deferred ? 'warn' : 'neutral' },
        ]}
        primaryAction={{ label: 'Record decision', onClick: () => setRecordOpen(true) }}
      />

      <section className={govStyles.decisionKpiGrid} aria-label="Governance decision KPIs">
        <KpiCard label="Decisions" value={decisions.length} hint="Recorded governance decisions" tone="info" />
        <KpiCard label="Approved" value={approved} hint="Accepted decisions" tone="success" />
        <KpiCard label="Deferred" value={deferred} hint="Accepted with follow-up" tone={deferred ? 'warning' : 'neutral'} />
        <KpiCard label="Rejected" value={rejected} hint="Rejected or cancelled" tone={rejected ? 'danger' : 'neutral'} />
      </section>

      <div className={govStyles.decisionFilters} aria-label="Decision filters">
        <span className={govStyles.decisionFilterChip}>All decisions</span>
        <span className={govStyles.decisionFilterChip}>Publish approval</span>
        <span className={govStyles.decisionFilterChip}>Risk acceptance</span>
        <span className={govStyles.decisionFilterChip}>Exceptions</span>
      </div>

      <section className={govStyles.workflowGrid}>
        <article className={govStyles.governancePanel}>
          <div className={govStyles.panelHeader}>
            <div>
              <h2 className={govStyles.panelTitle}>Decision history</h2>
              <p className={govStyles.panelHint}>Každá karta ukazuje What, Why, Affects, Expires a Evidence jako v review modalu.</p>
            </div>
            <span className={govStyles.panelCount}>{decisions.length}</span>
          </div>
          {decisions.length === 0 ? <EmptyState title="No governance decisions." /> : (
            <div className={govStyles.decisionCardGrid}>
              {decisions.map((item) => <DecisionCard key={item.id} item={item} />)}
            </div>
          )}
        </article>

        <aside className={govStyles.governancePanel}>
          <h2 className={govStyles.panelTitle}>Record Decision</h2>
          <p className={govStyles.panelHint}>
            Decisions are recorded through the shared modal so the same What, Why, Affects, Expires and Evidence pattern is used in reviews and standalone governance work.
          </p>
          <button type="button" className={govStyles.primaryAction} onClick={() => setRecordOpen(true)}>Record decision</button>
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
