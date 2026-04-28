'use client';

import Link from '@/app/components/AppLink';
import { useSearchParams } from 'next/navigation';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import { useOwnerAssignments, useOwnerLoad } from '@/features/governance/hooks/useGovernance';
import type { OwnerAssignmentRow } from '@/features/governance/types';
import { useT } from '@/app/i18n/useI18n';
import styles from '../../dashboard/dashboard.module.css';
import govStyles from '../governance.module.css';

function serviceEditHref(item: OwnerAssignmentRow) {
  return `/services/${encodeURIComponent(item.service_id)}/edit#ownership`;
}

function formatRole(item: OwnerAssignmentRow) {
  return item.role_name || item.role_code.replace(/_/g, ' ');
}

export default function OwnerLoadDetailPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const owner = searchParams?.get('owner') ?? '';
  const ownerLoad = useOwnerLoad(owner ? { owner, limit: 1 } : {});
  const assignments = useOwnerAssignments(owner ? { owner, limit: 250 } : {});

  const ownerSummary = ownerLoad.data?.items?.[0] ?? null;
  const rows = assignments.data?.items ?? [];
  const displayName = ownerSummary?.owner_name || rows[0]?.display_name || owner;

  if (!owner) {
    return (
      <main className={styles.shell}>
        <EmptyState title="Select an owner from Owner Load Monitor." />
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>Operations · owner load</span>
          <h1 className={styles.pageTitle}>{t('operations.governance.owner.title')}</h1>
          <p className={styles.pageLead}>
            {displayName} · {ownerSummary?.owner_email || rows[0]?.email || owner}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/operations#governance" className={styles.secondaryLink}>Back to Operations</Link>
        </div>
      </header>

      <section className={styles.kpiThree} aria-label="Owner load KPIs">
        <KpiCard label="Owned services" value={ownerSummary?.owned_services ?? rows.length} hint="active assignments" />
        <KpiCard label="Live services" value={ownerSummary?.live_services ?? rows.filter((row) => row.lifecycle_state === 'live').length} hint="daily load" />
        <KpiCard label="Load score" value={ownerSummary?.owner_load_score ?? 0} hint="governance pressure" />
      </section>

      <section className={govStyles.governancePanel}>
        <div className={govStyles.panelHeader}>
          <div>
            <h2 className={govStyles.panelTitle}>Role assignments</h2>
            <p className={govStyles.panelHint}>Every service where this person is assigned and the role they hold.</p>
          </div>
          <span className={govStyles.panelCount}>{rows.length}</span>
        </div>

        {assignments.isLoading && rows.length === 0 ? (
          <div className={govStyles.stateLine}>Loading role assignments…</div>
        ) : rows.length === 0 ? (
          <EmptyState title="No role assignments found for this owner." />
        ) : (
          <div className={govStyles.governanceList}>
            {rows.map((item) => (
              <Link key={item.assignment_id} href={serviceEditHref(item)} className={govStyles.governanceRow}>
                <Badge variant={item.valid_to ? 'neutral' : 'info'}>{formatRole(item)}</Badge>
                <span className={govStyles.rowMain}>
                  <strong>{item.service_title}</strong>
                  <span>{item.service_id} · {item.service_status_code || 'unknown'} · {item.organization_name || 'no organization'}</span>
                </span>
                <span className={govStyles.rowMetric}>{item.lifecycle_state || '—'}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
