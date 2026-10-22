'use client';

import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import type { BadgeVariant } from '@/design-system/controls';
import { useDashboardInbox } from '@/features/services/hooks/useServices';
import type {
  DashboardInboxItem,
  DashboardReviewAssignment,
  DashboardDecisionItem,
  DashboardOwnedService,
} from '@/features/services/model/service.types';
import { getAuthSnapshot, restoreAuthSession, type AuthSnapshot } from '@/features/auth/authStore';
import { useState, useCallback, useEffect } from 'react';
import { useT } from '@/app/i18n/useI18n';
import styles from '../../dashboard/dashboard.module.css';
import govStyles from '../../operations/governance.module.css';
import taskStyles from './my-tasks.module.css';

function formatDate(value: string | null | undefined, emptyLabel: string) {
  if (!value) return emptyLabel;
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

const OPEN_REVIEW_STATUS_FILTER = 'pending,in_review,deferred';

function preferredIdentity(snapshot: AuthSnapshot | null): string {
  return snapshot?.display_name?.trim() || snapshot?.username?.trim() || '';
}

function ownerFilteredHref(path: string, owner: string) {
  return owner ? `${path}?owner=${encodeURIComponent(owner)}` : path;
}

function serviceReviewHref(serviceId: string) {
  return `/operations/reviews?service_id=${encodeURIComponent(serviceId)}`;
}

// ─── Collapsible section ─────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  title: string;
  count: number;
  badge?: BadgeVariant;
  defaultOpen?: boolean;
  listHref?: string;
  listLabel?: string;
  children: React.ReactNode;
}

function CollapsibleSection({ title, count, badge, defaultOpen = true, listHref, listLabel, children }: CollapsibleSectionProps) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={taskStyles.section}>
      <div className={taskStyles.sectionHeader}>
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
        {listHref ? <Link href={listHref} className={taskStyles.sectionListLink}>{listLabel ?? t('my_tasks.open_filtered_list')}</Link> : null}
      </div>
      {open && <div className={taskStyles.sectionBody}>{children}</div>}
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const t = useT();
  const inbox = useDashboardInbox();
  const [refreshing, setRefreshing] = useState(false);
  const [authSnapshot, setAuthSnapshot] = useState<AuthSnapshot | null>(() => getAuthSnapshot());

  useEffect(() => {
    let cancelled = false;
    void restoreAuthSession().then((snapshot) => {
      if (!cancelled) setAuthSnapshot(snapshot);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await inbox.mutate?.();
    setRefreshing(false);
  }, [inbox]);

  const data = inbox.data;
  const myOwnedServices: DashboardOwnedService[] = data?.my_owned_services ?? [];
  const myReviews: DashboardReviewAssignment[] = data?.my_reviews ?? [];
  const myBlockers: DashboardInboxItem[] = data?.my_blockers ?? data?.items ?? [];
  const myDecisions: DashboardDecisionItem[] = data?.my_decisions ?? [];
  const openCount = myReviews.length + myBlockers.length;
  const ownerIdentity = preferredIdentity(authSnapshot);
  const myReviewsHref = `/operations/reviews?mine=1&status=${encodeURIComponent(OPEN_REVIEW_STATUS_FILTER)}`;
  const myBlockersHref = ownerFilteredHref('/operations/readiness', ownerIdentity);
  const ownedServicesHref = ownerFilteredHref('/services/list', ownerIdentity);
  const noDate = t('my_tasks.no_date');

  if (inbox.isLoading) return <div className={styles.state}>{t('my_tasks.loading')}</div>;
  if (inbox.error) return <div className={styles.stateError}>{t('my_tasks.error')}</div>;

  return (
    <div className={styles.shell}>
      <PageHeader
        title={t('nav.sidebar.my_tasks')}
        purpose={t('my_tasks.purpose')}
        chips={[
          { label: t('my_tasks.chip.open', { count: openCount }), tone: openCount > 0 ? 'warn' : 'ok' },
          { label: t('my_tasks.chip.owned', { count: myOwnedServices.length }), tone: 'info' },
        ]}
        primaryAction={{ label: t('my_tasks.review_board'), href: '/operations/reviews' }}
      />

      <section className={styles.kpiThree} aria-label={t('my_tasks.kpi.aria')}>
        <Link href={myReviewsHref} className={taskStyles.kpiLink} aria-label={t('my_tasks.kpi.reviews.aria')}>
          <KpiCard label={t('my_tasks.kpi.reviews.label')} value={myReviews.length} hint={t('my_tasks.kpi.reviews.hint')} tone={myReviews.length ? 'warning' : 'success'} />
        </Link>
        <Link href={myBlockersHref} className={taskStyles.kpiLink} aria-label={t('my_tasks.kpi.blockers.aria')}>
          <KpiCard label={t('my_tasks.kpi.blockers.label')} value={myBlockers.length} hint={t('my_tasks.kpi.blockers.hint')} tone={myBlockers.length ? 'danger' : 'success'} />
        </Link>
        <Link href={ownedServicesHref} className={taskStyles.kpiLink} aria-label={t('my_tasks.kpi.owned.aria')}>
          <KpiCard label={t('my_tasks.kpi.owned.label')} value={myOwnedServices.length} hint={t('my_tasks.kpi.owned.hint')} />
        </Link>
      </section>

      <div className={taskStyles.refreshBar}>
        <button
          type="button"
          className={taskStyles.refreshBtn}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? t('my_tasks.refreshing') : t('my_tasks.refresh')}
        </button>
        {inbox.data && <span className={taskStyles.refreshHint}>{t('my_tasks.last_loaded', { time: new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) })}</span>}
      </div>

      <div className={taskStyles.sections}>
        {/* 1. Reviews */}
        <CollapsibleSection title={t('my_tasks.section.reviews')} count={myReviews.length} badge={myReviews.length > 0 ? 'warning' : undefined} defaultOpen listHref={myReviewsHref}>
          {myReviews.length === 0 ? <EmptyState title={t('my_tasks.section.reviews_empty')} /> : (
            <div className={govStyles.governanceList}>
              {myReviews.map((review) => {
                const over = isOverdue(review.due_at);
                const soon = !over && isDueSoon(review.due_at);
                return (
                  <Link key={review.id} href={serviceReviewHref(review.service_id)} className={govStyles.governanceRow}>
                    <Badge variant={over ? 'danger' : soon ? 'warning' : 'info'}>{review.status}</Badge>
                    <span className={govStyles.rowMain}>
                      <strong>{review.service_title}</strong>
                      <span>{review.service_id} · {review.review_type}</span>
                    </span>
                    <span className={`${govStyles.rowMetric} ${over ? taskStyles.dueOverdue : soon ? taskStyles.dueSoon : ''}`}>
                      {over ? '⚠ ' : ''}{formatDate(review.due_at, noDate)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CollapsibleSection>

        {/* 2. Blockers / Exceptions */}
        <CollapsibleSection title={t('my_tasks.section.blockers')} count={myBlockers.length} badge={myBlockers.length > 0 ? 'danger' : undefined} defaultOpen listHref={myBlockersHref}>
          {myBlockers.length === 0 ? <EmptyState title={t('my_tasks.section.blockers_empty')} /> : (
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
        <CollapsibleSection title={t('my_tasks.section.owned')} count={myOwnedServices.length} defaultOpen={false} listHref={ownedServicesHref}>
          {myOwnedServices.length === 0 ? <EmptyState title={t('my_tasks.section.owned_empty')} /> : (
            <div className={govStyles.governanceList}>
              {myOwnedServices.map((service) => {
                const over = isOverdue(service.review_due_at);
                const soon = !over && isDueSoon(service.review_due_at);
                return (
                  <Link key={service.service_id} href={`/services/${service.service_id}`} className={govStyles.governanceRow}>
                    <span aria-hidden="true">•</span>
                    <span className={govStyles.rowMain}>
                      <strong>{service.title}</strong>
                      <span>{service.service_id} · {service.lifecycle_stage_code ?? service.service_status ?? t('my_tasks.no_lifecycle')}</span>
                    </span>
                    <span className={`${govStyles.rowMetric} ${over ? taskStyles.dueOverdue : soon ? taskStyles.dueSoon : ''}`}>
                      {over ? '⚠ ' : ''}{formatDate(service.review_due_at, noDate)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CollapsibleSection>

        {/* 4. Recent decisions */}
        <CollapsibleSection title={t('my_tasks.section.decisions')} count={myDecisions.length} defaultOpen={false}>
          {myDecisions.length === 0 ? <EmptyState title={t('my_tasks.section.decisions_empty')} /> : (
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
                  <span className={govStyles.rowMetric}>{formatDate(decision.decided_at, noDate)}</span>
                </Link>
              ))}
            </div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}
