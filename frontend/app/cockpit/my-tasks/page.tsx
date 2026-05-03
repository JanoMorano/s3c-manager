'use client';

import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import type { BadgeVariant } from '@/design-system/controls';
import { useDashboardInbox, useMyServiceRequests } from '@/features/services/hooks/useServices';
import type {
  DashboardInboxItem,
  DashboardReviewAssignment,
  DashboardDecisionItem,
  DashboardOwnedService,
} from '@/features/services/model/service.types';
import { useState, useCallback } from 'react';
import styles from '../../dashboard/dashboard.module.css';
import govStyles from '../../operations/governance.module.css';
import taskStyles from './my-tasks.module.css';

function formatDate(value: string | null | undefined) {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

function isDueSoon(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = new Date(value);
  const diff = date.getTime() - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000; // within 7 days
}

function isOverdue(value: string | null | undefined): boolean {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

function itemVariant(item: DashboardInboxItem): BadgeVariant {
  if (item.severity === 'danger') return 'danger';
  if (item.severity === 'warning') return 'warning';
  return 'info';
}

// ─── Collapsible section ─────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  title: string;
  count: number;
  badge?: BadgeVariant;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, count, badge, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={taskStyles.section}>
      <button
        type="button"
        className={taskStyles.sectionToggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={taskStyles.sectionChevron}>{open ? '▾' : '▸'}</span>
        <h2 className={taskStyles.sectionTitle}>{title}</h2>
        <span className={`${taskStyles.sectionCount} ${count > 0 && badge === 'danger' ? taskStyles.countDanger : count > 0 && badge === 'warning' ? taskStyles.countWarn : ''}`}>
          {count}
        </span>
      </button>
      {open && <div className={taskStyles.sectionBody}>{children}</div>}
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const inbox = useDashboardInbox();
  const requests = useMyServiceRequests();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([inbox.mutate?.(), requests.mutate?.()]);
    setRefreshing(false);
  }, [inbox, requests]);

  const data = inbox.data;
  const requestItems = requests.data?.items ?? [];
  const myOwnedServices: DashboardOwnedService[] = data?.my_owned_services ?? [];
  const myReviews: DashboardReviewAssignment[] = data?.my_reviews ?? [];
  const myBlockers: DashboardInboxItem[] = data?.my_blockers ?? data?.items ?? [];
  const myDecisions: DashboardDecisionItem[] = data?.my_decisions ?? [];
  const openCount = myReviews.length + myBlockers.length + requestItems.length;

  if (inbox.isLoading && requests.isLoading) return <div className={styles.state}>Loading my tasks...</div>;
  if (inbox.error && requests.error) return <div className={styles.stateError}>My tasks are not available.</div>;

  return (
    <div className={styles.shell}>
      <PageHeader
        title="My Tasks"
        purpose="Denní pracovní plocha pro vlastníka služby, reviewera a admina. Ukazuje jen moje reviews, blokátory, requesty a rozhodnutí."
        chips={[
          { label: `${openCount} open`, tone: openCount > 0 ? 'warn' : 'ok' },
          { label: `${myOwnedServices.length} owned`, tone: 'info' },
        ]}
        primaryAction={{ label: 'Review board', href: '/operations/reviews' }}
      />

      <section className={styles.kpiThree} aria-label="My task KPIs">
        <KpiCard label="My reviews" value={myReviews.length} hint="assigned governance reviews" tone={myReviews.length ? 'warning' : 'success'} />
        <KpiCard label="My blockers" value={myBlockers.length} hint="readiness and evidence gaps" tone={myBlockers.length ? 'danger' : 'success'} />
        <KpiCard label="Owned services" value={myOwnedServices.length} hint="active role assignments" />
      </section>

      <div className={taskStyles.refreshBar}>
        <button
          type="button"
          className={taskStyles.refreshBtn}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Aktualizuji…' : '↻ Obnovit'}
        </button>
        {inbox.data && <span className={taskStyles.refreshHint}>Naposledy načteno: {new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>

      <div className={taskStyles.sections}>
        {/* 1. Reviews */}
        <CollapsibleSection title="Moje reviews" count={myReviews.length} badge={myReviews.length > 0 ? 'warning' : undefined} defaultOpen>
          {myReviews.length === 0 ? <EmptyState title="Žádné přiřazené reviews." /> : (
            <div className={govStyles.governanceList}>
              {myReviews.map((review) => {
                const over = isOverdue(review.due_at);
                const soon = !over && isDueSoon(review.due_at);
                return (
                  <Link key={review.id} href="/operations/reviews" className={govStyles.governanceRow}>
                    <Badge variant={over ? 'danger' : soon ? 'warning' : 'info'}>{review.status}</Badge>
                    <span className={govStyles.rowMain}>
                      <strong>{review.service_title}</strong>
                      <span>{review.service_id} · {review.review_type}</span>
                    </span>
                    <span className={`${govStyles.rowMetric} ${over ? taskStyles.dueOverdue : soon ? taskStyles.dueSoon : ''}`}>
                      {over ? '⚠ ' : ''}{formatDate(review.due_at)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CollapsibleSection>

        {/* 2. Blockers / Exceptions */}
        <CollapsibleSection title="Readiness blokátory" count={myBlockers.length} badge={myBlockers.length > 0 ? 'danger' : undefined} defaultOpen>
          {myBlockers.length === 0 ? <EmptyState title="Žádné blokátory." /> : (
            <div className={govStyles.governanceList}>
              {myBlockers.map((item) => (
                <Link key={item.id} href={item.href || '/operations'} className={govStyles.governanceRow}>
                  <Badge variant={itemVariant(item)}>{item.severity}</Badge>
                  <span className={govStyles.rowMain}>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </span>
                  <span className={govStyles.rowMetric}>{item.type}</span>
                </Link>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* 3. Owned services (attestation) */}
        <CollapsibleSection title="Moje služby (attestation)" count={myOwnedServices.length} defaultOpen={false}>
          {myOwnedServices.length === 0 ? <EmptyState title="Žádné vlastněné služby." /> : (
            <div className={govStyles.governanceList}>
              {myOwnedServices.map((service) => {
                const over = isOverdue(service.next_review_due_at);
                const soon = !over && isDueSoon(service.next_review_due_at);
                return (
                  <Link key={service.service_id} href={`/services/${service.service_id}`} className={govStyles.governanceRow}>
                    <span aria-hidden="true">•</span>
                    <span className={govStyles.rowMain}>
                      <strong>{service.title}</strong>
                      <span>{service.service_id} · {service.lifecycle_stage_code ?? service.service_status ?? 'no lifecycle'}</span>
                    </span>
                    <span className={`${govStyles.rowMetric} ${over ? taskStyles.dueOverdue : soon ? taskStyles.dueSoon : ''}`}>
                      {over ? '⚠ ' : ''}{formatDate(service.next_review_due_at)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CollapsibleSection>

        {/* 4. Recent decisions */}
        <CollapsibleSection title="Poslední rozhodnutí" count={myDecisions.length} defaultOpen={false}>
          {myDecisions.length === 0 ? <EmptyState title="Žádná rozhodnutí." /> : (
            <div className={govStyles.governanceList}>
              {myDecisions.slice(0, 10).map((decision) => (
                <Link key={decision.id} href={`/services/${decision.service_id}`} className={govStyles.governanceRow}>
                  <Badge variant={decision.decision === 'approved' ? 'success' : decision.decision === 'rejected' ? 'danger' : 'neutral'}>
                    {decision.decision}
                  </Badge>
                  <span className={govStyles.rowMain}>
                    <strong>{decision.service_title}</strong>
                    <span>{decision.service_id} · {decision.decision_type}</span>
                  </span>
                  <span className={govStyles.rowMetric}>{formatDate(decision.decided_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* 5. Service requests */}
        {requestItems.length > 0 && (
          <CollapsibleSection title="Moje requesty" count={requestItems.length} defaultOpen={false}>
            <div className={govStyles.governanceList}>
              {requestItems.map((request) => (
                <Link key={request.id} href={request.service_id ? `/services/${request.service_id}` : '/catalogue'} className={govStyles.governanceRow}>
                  <Badge variant="neutral">{request.status}</Badge>
                  <span className={govStyles.rowMain}>
                    <strong>{request.service_title || request.service_id || request.request_number}</strong>
                    <span>{request.request_channel_type ?? 'internal'} · {formatDate(request.created_at)}</span>
                  </span>
                  <span className={govStyles.rowMetric}>Request</span>
                </Link>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
