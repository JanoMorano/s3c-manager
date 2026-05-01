'use client';

import { type FormEvent } from 'react';
import Link from '@/app/components/AppLink';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import { authHeaders } from '@/features/services/api/services.api';
import { useGovernanceReviews } from '@/features/governance/hooks/useGovernance';
import type { GovernanceReview } from '@/features/governance/types';
import styles from '../../dashboard/dashboard.module.css';
import govStyles from '../governance.module.css';

function statusVariant(status: string) {
  if (status === 'approved') return 'success';
  if (status === 'rejected' || status === 'cancelled') return 'danger';
  if (status === 'deferred') return 'warning';
  return 'info';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No due date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

async function patchReview(id: number, body: Record<string, unknown>) {
  const response = await fetch(`/api/v1/governance/reviews/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
}

function ReviewRow({ item, onSaved }: { item: GovernanceReview; onSaved: () => Promise<void> }) {
  async function transition(status: GovernanceReview['status']) {
    await patchReview(item.id, { status });
    await onSaved();
  }

  return (
    <article className={govStyles.workflowRow}>
      <div className={govStyles.workflowMain}>
        <Link href={`/services/${item.service_id}`} className={govStyles.workflowTitle}>
          <strong>{item.service_title}</strong>
          <span>{item.service_id} · {item.review_type}</span>
        </Link>
        <div className={govStyles.workflowMeta}>
          <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
          {item.overdue ? <Badge variant="danger">Overdue</Badge> : <Badge variant="neutral">{formatDate(item.due_at)}</Badge>}
          <span>{item.assigned_to ?? 'Unassigned'}</span>
        </div>
      </div>
      <div className={govStyles.workflowActions}>
        <button type="button" onClick={() => transition('in_review')}>Start review</button>
        <button type="button" onClick={() => transition('approved')}>Approve</button>
        <button type="button" onClick={() => transition('rejected')}>Reject</button>
        <button type="button" onClick={() => transition('deferred')}>Defer</button>
      </div>
    </article>
  );
}

export default function GovernanceReviewsPage() {
  const { data, isLoading, error, mutate } = useGovernanceReviews({ limit: 200 });
  const reviews = data?.items ?? [];
  const overdue = reviews.filter((item) => item.overdue).length;
  const inReview = reviews.filter((item) => item.status === 'in_review').length;

  async function requestReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const serviceId = String(data.get('service_id') ?? '').trim();
    if (!serviceId) return;
    const response = await fetch('/api/v1/governance/reviews', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        service_id: serviceId,
        review_type: String(data.get('review_type') ?? 'publish'),
        assigned_to: String(data.get('assigned_to') ?? '').trim() || null,
        due_at: String(data.get('due_at') ?? '').trim() ? `${data.get('due_at')}T00:00:00Z` : null,
      }),
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    form.reset();
    await mutate();
  }

  if (isLoading) return <div className={styles.state}>Loading governance reviews...</div>;
  if (error || !data) return <div className={styles.stateError}>Governance reviews are not available.</div>;

  return (
    <main className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>Operations</span>
          <h1 className={styles.pageTitle}>Governance Reviews</h1>
          <p className={styles.pageLead}>Move services through requested, in-review, approved, rejected, and deferred states.</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/operations" className={styles.secondaryLink}>Operations</Link>
          <Link href="/operations/decisions" className={styles.secondaryLink}>Decision log</Link>
        </div>
      </header>

      <section className={styles.kpiThree} aria-label="Governance review KPIs">
        <KpiCard label="Open reviews" value={reviews.length} hint="Reviews in queue" />
        <KpiCard label="In review" value={inReview} hint="Started workflow" />
        <KpiCard label="Overdue" value={overdue} hint="Past due without completion" />
      </section>

      <section className={govStyles.workflowGrid}>
        <article className={govStyles.governancePanel}>
          <div className={govStyles.panelHeader}>
            <div>
              <h2 className={govStyles.panelTitle}>Review Queue</h2>
              <p className={govStyles.panelHint}>Due dates, owners, and review transitions.</p>
            </div>
            <span className={govStyles.panelCount}>{reviews.length}</span>
          </div>
          {reviews.length === 0 ? <EmptyState title="No governance reviews." /> : (
            <div className={govStyles.governanceList}>
              {reviews.map((item) => <ReviewRow key={item.id} item={item} onSaved={async () => { await mutate(); }} />)}
            </div>
          )}
        </article>

        <aside className={govStyles.governancePanel}>
          <h2 className={govStyles.panelTitle}>Request Review</h2>
          <form className={govStyles.workflowForm} onSubmit={requestReview}>
            <label>
              <span>Service ID</span>
              <input name="service_id" type="text" required placeholder="SVC-IAM" />
            </label>
            <label>
              <span>Review type</span>
              <select name="review_type" defaultValue="publish">
                <option value="publish">Publish</option>
                <option value="owner_review">Owner review</option>
                <option value="coverage_review">Coverage review</option>
              </select>
            </label>
            <label>
              <span>Assigned to</span>
              <input name="assigned_to" type="email" placeholder="owner@example.com" />
            </label>
            <label>
              <span>Due date</span>
              <input name="due_at" type="date" />
            </label>
            <button type="submit">Request review</button>
          </form>
        </aside>
      </section>
    </main>
  );
}
