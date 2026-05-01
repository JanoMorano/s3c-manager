'use client';

import { type FormEvent } from 'react';
import Link from '@/app/components/AppLink';
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

function DecisionRow({ item }: { item: GovernanceDecision }) {
  return (
    <article className={govStyles.workflowRow}>
      <div className={govStyles.workflowMain}>
        <Link href={`/services/${item.service_id}`} className={govStyles.workflowTitle}>
          <strong>{item.service_title}</strong>
          <span>{item.service_id} · {item.decision_type}</span>
        </Link>
        <div className={govStyles.workflowMeta}>
          <Badge variant={decisionVariant(item.decision)}>{item.decision}</Badge>
          <span>{formatDate(item.decided_at)}</span>
          <span>{item.decided_by ?? 'unknown'}</span>
        </div>
        {item.rationale ? <p className={govStyles.workflowRationale}>{item.rationale}</p> : null}
      </div>
    </article>
  );
}

export default function GovernanceDecisionsPage() {
  const { data, isLoading, error, mutate } = useGovernanceDecisions({ limit: 200 });
  const decisions = data?.items ?? [];
  const approved = decisions.filter((item) => item.decision === 'approved').length;
  const deferred = decisions.filter((item) => item.decision === 'deferred').length;

  async function recordDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const serviceId = String(formData.get('service_id') ?? '').trim();
    const decision = String(formData.get('decision') ?? '').trim();
    const rationale = String(formData.get('rationale') ?? '').trim();
    if (!serviceId || !decision) return;
    if ((decision === 'rejected' || decision === 'deferred') && !rationale) return;

    const response = await fetch('/api/v1/governance/decisions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        service_id: serviceId,
        decision_type: String(formData.get('decision_type') ?? 'publish_approval'),
        decision,
        rationale: rationale || null,
      }),
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    form.reset();
    await mutate();
  }

  if (isLoading) return <div className={styles.state}>Loading decision log...</div>;
  if (error || !data) return <div className={styles.stateError}>Decision log is not available.</div>;

  return (
    <main className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>Operations</span>
          <h1 className={styles.pageTitle}>Decision Log</h1>
          <p className={styles.pageLead}>Auditable approval, rejection, deferral, and cancellation decisions for governed services.</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/operations" className={styles.secondaryLink}>Operations</Link>
          <Link href="/operations/reviews" className={styles.secondaryLink}>Reviews</Link>
        </div>
      </header>

      <section className={styles.kpiThree} aria-label="Governance decision KPIs">
        <KpiCard label="Decisions" value={decisions.length} hint="Recorded decisions" />
        <KpiCard label="Approved" value={approved} hint="Ready decisions" />
        <KpiCard label="Deferred" value={deferred} hint="Accepted with follow-up" />
      </section>

      <section className={govStyles.workflowGrid}>
        <article className={govStyles.governancePanel}>
          <div className={govStyles.panelHeader}>
            <div>
              <h2 className={govStyles.panelTitle}>Decision history</h2>
              <p className={govStyles.panelHint}>Every decision stays linked to its service and rationale.</p>
            </div>
            <span className={govStyles.panelCount}>{decisions.length}</span>
          </div>
          {decisions.length === 0 ? <EmptyState title="No governance decisions." /> : (
            <div className={govStyles.governanceList}>
              {decisions.map((item) => <DecisionRow key={item.id} item={item} />)}
            </div>
          )}
        </article>

        <aside className={govStyles.governancePanel}>
          <h2 className={govStyles.panelTitle}>Record Decision</h2>
          <form className={govStyles.workflowForm} onSubmit={recordDecision}>
            <label>
              <span>Decision service ID</span>
              <input name="service_id" type="text" required placeholder="SVC-IAM" />
            </label>
            <label>
              <span>Decision type</span>
              <select name="decision_type" defaultValue="publish_approval">
                <option value="publish_approval">Publish approval</option>
                <option value="deferral">Deferral</option>
                <option value="risk_acceptance">Risk acceptance</option>
              </select>
            </label>
            <label>
              <span>Decision</span>
              <select name="decision" defaultValue="approved">
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
                <option value="deferred">deferred</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>
            <label>
              <span>Rationale</span>
              <textarea name="rationale" rows={4} placeholder="Required for rejected or deferred decisions" />
            </label>
            <button type="submit">Record decision</button>
          </form>
        </aside>
      </section>
    </main>
  );
}
