'use client';

import { type FormEvent, useMemo, useState } from 'react';
import Link from '@/app/components/AppLink';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/app/components/PageHeader';
import { ReviewActionModal, ServicePicker, UserPicker, type ReviewActionValue } from '@/app/components/layout-v2';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import type { BadgeVariant } from '@/design-system/controls';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import { useGovernanceReviews } from '@/features/governance/hooks/useGovernance';
import type { GovernanceReview } from '@/features/governance/types';
import useSWR from 'swr';
import styles from '../../dashboard/dashboard.module.css';
import govStyles from '../governance.module.css';

type ReviewView = 'board' | 'list';
type ReviewActionStatus = 'in_review' | 'approved' | 'rejected' | 'deferred' | 'cancelled';

interface ReviewActionState {
  item: GovernanceReview;
  status: ReviewActionStatus;
}

const BOARD_COLUMNS = [
  { id: 'requested', label: 'Requested', statuses: ['pending', 'requested'] },
  { id: 'in_review', label: 'In review', statuses: ['in_review'] },
  { id: 'decision_needed', label: 'Decision needed', statuses: ['deferred'] },
  { id: 'closed', label: 'Closed', statuses: ['approved', 'rejected', 'cancelled'] },
];

function statusVariant(status: string): BadgeVariant {
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

function isTerminalStatus(status: ReviewActionStatus) {
  return ['approved', 'rejected', 'deferred', 'cancelled'].includes(status);
}

async function patchReview(id: number, body: Record<string, unknown>) {
  const response = await fetch(`/api/v1/governance/reviews/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Review update failed: API ${response.status}`);
}

async function createDecision(
  item: GovernanceReview,
  status: ReviewActionStatus,
  rationale: string,
  evidence?: string,
  deferExpiry?: string,
) {
  const body: Record<string, unknown> = {
    service_id: item.service_id,
    decision_type: item.review_type || 'governance_review',
    decision: status,
    rationale: rationale.trim() || `Decision recorded from review #${item.id}.`,
  };
  if (evidence?.trim()) body.evidence = evidence.trim();
  if (deferExpiry) body.defer_expires_at = `${deferExpiry}T00:00:00Z`;
  const response = await fetch('/api/v1/governance/decisions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Decision log failed: API ${response.status}`);
}

function ReviewCard({ item, onAction }: { item: GovernanceReview; onAction: (status: ReviewActionStatus, item: GovernanceReview) => void }) {
  return (
    <article className={govStyles.reviewCard}>
      <div className={govStyles.reviewCardHeader}>
        <Link href={`/services/${item.service_id}`} className={govStyles.workflowTitle}>
          <strong>{item.service_title}</strong>
          <span>{item.service_id} · {item.review_type}</span>
        </Link>
        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
      </div>
      <div className={govStyles.workflowMeta}>
        {item.overdue ? <Badge variant="danger">Overdue</Badge> : <Badge variant="neutral">{formatDate(item.due_at)}</Badge>}
        <span>{item.assigned_to ?? 'Unassigned'}</span>
      </div>
      <div className={govStyles.reviewActions}>
        <Link href={`/services/${encodeURIComponent(item.service_id)}`}>Open detail</Link>
        <Link href={`/services/${encodeURIComponent(item.service_id)}/edit#readiness-governance`}>Open editor on this rule</Link>
        <Link href={`/operations/decisions?service_id=${encodeURIComponent(item.service_id)}`}>Decision context</Link>
        {item.status !== 'in_review' && item.status !== 'approved' && item.status !== 'rejected' && (
          <button type="button" onClick={() => onAction('in_review', item)}>Start</button>
        )}
        <button type="button" onClick={() => onAction('approved', item)}>Approve</button>
        <button type="button" onClick={() => onAction('rejected', item)}>Reject</button>
        <button type="button" onClick={() => onAction('deferred', item)}>Defer</button>
      </div>
    </article>
  );
}

export default function GovernanceReviewsPage() {
  const searchParams = useSearchParams();
  const serviceFilter = searchParams?.get('service_id') ?? '';
  const { data, isLoading, error, mutate } = useGovernanceReviews({ limit: 200, serviceId: serviceFilter || undefined });
  const [view, setView] = useState<ReviewView>('board');
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestDraft, setRequestDraft] = useState({ service_id: '', review_type: 'publish', assigned_to: '', due_at: '' });
  const [action, setAction] = useState<ReviewActionState | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pre-flight: fetch readiness for service_id in request form
  const preflightServiceId = requestDraft.service_id.trim();
  const { data: preflightReadiness } = useSWR(
    preflightServiceId ? `/api/v1/readiness/summary?service_id=${encodeURIComponent(preflightServiceId)}&limit=1` : null,
    apiFetch,
    { revalidateOnFocus: false },
  );
  const actionServiceId = action?.item.service_id?.trim() ?? '';
  const { data: actionReadiness } = useSWR(
    actionServiceId ? `/api/v1/readiness/summary?service_id=${encodeURIComponent(actionServiceId)}&limit=1` : null,
    apiFetch,
    { revalidateOnFocus: false },
  );

  const reviews = useMemo(() => data?.items ?? [], [data?.items]);
  const overdue = reviews.filter((item) => item.overdue).length;
  const inReview = reviews.filter((item) => item.status === 'in_review').length;
  const closed = reviews.filter((item) => ['approved', 'rejected', 'cancelled'].includes(item.status)).length;

  const byColumn = useMemo(() => {
    return BOARD_COLUMNS.map((column) => ({
      ...column,
      items: reviews.filter((review) => column.statuses.includes(review.status)),
    }));
  }, [reviews]);

  async function requestReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setModalError(null);
    try {
      const serviceId = requestDraft.service_id.trim();
      if (!serviceId) return;
      const response = await fetch('/api/v1/governance/reviews', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          service_id: serviceId,
          review_type: requestDraft.review_type,
          assigned_to: requestDraft.assigned_to.trim() || null,
          due_at: requestDraft.due_at ? `${requestDraft.due_at}T00:00:00Z` : null,
        }),
      });
      if (!response.ok) throw new Error(`Request failed: API ${response.status}`);
      setRequestDraft({ service_id: '', review_type: 'publish', assigned_to: '', due_at: '' });
      setRequestOpen(false);
      await mutate();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Request review failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction(value: ReviewActionValue) {
    if (!action) return;
    setBusy(true);
    setModalError(null);
    try {
      const patchBody: Record<string, unknown> = { status: action.status };
      if (action.status === 'deferred' && value.defer_expires_at) patchBody.defer_expires_at = `${value.defer_expires_at}T00:00:00Z`;
      await patchReview(action.item.id, patchBody);
      if (isTerminalStatus(action.status)) {
        await createDecision(action.item, action.status, value.rationale, value.evidence, value.defer_expires_at);
      }
      setAction(null);
      await mutate();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Review action failed');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <div className={styles.state}>Loading governance reviews...</div>;
  if (error || !data) return <div className={styles.stateError}>Governance reviews are not available.</div>;

  return (
    <main className={styles.shell}>
      <PageHeader
        title="Governance Reviews"
        purpose="Review board pro publikaci, změny a výjimky. Stav se mění pouze přes akční modal s odůvodněním a náhledem zápisu do decision logu."
        chips={[
          { label: `${reviews.length} open`, tone: 'info' },
          { label: `${overdue} overdue`, tone: overdue > 0 ? 'bad' : 'ok' },
          { label: `${closed} closed`, tone: 'neutral' },
          ...(serviceFilter ? [{ label: `Service ${serviceFilter}`, tone: 'info' as const }] : []),
        ]}
        primaryAction={{ label: 'Decision log', href: '/operations/decisions' }}
      />

      <section className={styles.kpiThree} aria-label="Governance review KPIs">
        <KpiCard label="Open reviews" value={reviews.length} hint="Items in review queue" />
        <KpiCard label="In review" value={inReview} hint="Active workflow" />
        <KpiCard label="Overdue" value={overdue} hint="Needs attention" tone={overdue > 0 ? 'danger' : 'success'} />
      </section>

      <section className={govStyles.reviewToolbar} aria-label="Review controls">
        <div className={govStyles.segmented}>
          {(['board', 'list'] as ReviewView[]).map((nextView) => (
            <button
              key={nextView}
              type="button"
              className={view === nextView ? govStyles.segmentActive : ''}
              onClick={() => setView(nextView)}
            >
              {nextView === 'board' ? 'Board' : 'List'}
            </button>
          ))}
        </div>
        <button type="button" className={govStyles.primaryAction} onClick={() => setRequestOpen(true)}>
          Request review
        </button>
      </section>

      {view === 'board' && (
        <section className={govStyles.kanbanBoard} aria-label="Review board">
          {byColumn.map((column) => (
            <article key={column.id} className={govStyles.kanbanColumn}>
              <div className={govStyles.panelHeader}>
                <h2 className={govStyles.panelTitle}>{column.label}</h2>
                <span className={govStyles.panelCount}>{column.items.length}</span>
              </div>
              <div className={govStyles.governanceList}>
                {column.items.length === 0 ? (
                  <div className={govStyles.stateLine}>No reviews</div>
                ) : column.items.map((item) => (
                  <ReviewCard key={item.id} item={item} onAction={(status, review) => { setAction({ item: review, status }); setModalError(null); }} />
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {view === 'list' && (
        <section className={govStyles.governancePanel}>
          {reviews.length === 0 ? <EmptyState title="No governance reviews." /> : (
            <div className={govStyles.governanceList}>
              {reviews.map((item) => (
                <ReviewCard key={item.id} item={item} onAction={(status, review) => { setAction({ item: review, status }); setModalError(null); }} />
              ))}
            </div>
          )}
        </section>
      )}

      {requestOpen && (
        <div className={govStyles.modalBackdrop} role="presentation">
          <form className={govStyles.reviewModal} onSubmit={requestReview}>
            <div className={govStyles.panelHeader}>
              <div>
                <h2 className={govStyles.panelTitle}>Request review</h2>
                <p className={govStyles.panelHint}>Preflight kontroluje minimum pro založení review queue itemu.</p>
              </div>
              <button type="button" className={govStyles.iconButton} onClick={() => setRequestOpen(false)}>Close</button>
            </div>
            {modalError ? <div className={govStyles.modalError}>{modalError}</div> : null}
            <div className={govStyles.workflowForm}>
              <ServicePicker
                label="Service ID"
                value={requestDraft.service_id}
                onChange={(value) => setRequestDraft((draft) => ({ ...draft, service_id: value }))}
                required
              />
              <label>
                <span>Review type</span>
                <select value={requestDraft.review_type} onChange={(event) => setRequestDraft((draft) => ({ ...draft, review_type: event.target.value }))}>
                  <option value="publish">Publish</option>
                  <option value="owner_review">Owner review</option>
                  <option value="coverage_review">Coverage review</option>
                </select>
              </label>
              <UserPicker
                label="Assigned to"
                scope="reviewers"
                value={requestDraft.assigned_to}
                onChange={(value) => setRequestDraft((draft) => ({ ...draft, assigned_to: value }))}
              />
              <label>
                <span>Due date</span>
                <input type="date" value={requestDraft.due_at} onChange={(event) => setRequestDraft((draft) => ({ ...draft, due_at: event.target.value }))} />
              </label>
            </div>
            <div className={govStyles.decisionPreview}>
              <strong>Preflight</strong>
              {!preflightServiceId ? (
                <span className={govStyles.preflightWarn}>⚠ Zadej Service ID</span>
              ) : preflightReadiness === undefined ? (
                <span>Kontroluji připravenost…</span>
              ) : (preflightReadiness as { items?: Array<{ score?: number; blockers?: number }> })?.items?.length === 0 ? (
                <span className={govStyles.preflightWarn}>⚠ Služba nenalezena — zkontroluj Service ID</span>
              ) : (
                <>
                  <span className={govStyles.preflightOk}>✓ Služba nalezena</span>
                  {(() => {
                    const item = (preflightReadiness as { items?: Array<{ score?: number; blockers?: number }> })?.items?.[0];
                    if (!item) return null;
                    return item.blockers ? (
                      <span className={govStyles.preflightWarn}>⚠ {item.blockers} readiness blokátorů — review může selhat</span>
                    ) : (
                      <span className={govStyles.preflightOk}>✓ Readiness v pořádku — review lze vytvořit</span>
                    );
                  })()}
                </>
              )}
              <span>{requestDraft.assigned_to.trim() ? `✓ Reviewer: ${requestDraft.assigned_to}` : 'Reviewer může být přiřazen později'}</span>
            </div>
            <button type="submit" className={govStyles.primaryAction} disabled={busy}>Create review</button>
          </form>
        </div>
      )}

      {action && (
        <ReviewActionModal
          item={action.item}
          status={action.status}
          readiness={toReadinessPreview(actionReadiness)}
          busy={busy}
          error={modalError}
          onClose={() => setAction(null)}
          onSubmit={confirmAction}
        />
      )}
    </main>
  );
}

function toReadinessPreview(data: unknown) {
  const item = (data as { items?: Array<{ score?: number; blockers?: number; warnings?: number; readiness_score?: number }> } | undefined)?.items?.[0];
  if (!item) return null;
  return {
    score: item.score ?? item.readiness_score ?? null,
    blockers: item.blockers ?? null,
    warnings: item.warnings ?? null,
  };
}
