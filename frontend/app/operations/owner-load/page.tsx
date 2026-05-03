'use client';

import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import { useOwnerAssignments, useOwnerLoad } from '@/features/governance/hooks/useGovernance';
import type { OwnerLoadRow, OwnerAssignmentRow } from '@/features/governance/types';
import { useT } from '@/app/i18n/useI18n';
import styles from '../../dashboard/dashboard.module.css';
import govStyles from '../governance.module.css';
import ownerStyles from './owner-load.module.css';

function serviceEditHref(item: OwnerAssignmentRow) {
  return `/services/${encodeURIComponent(item.service_id)}/edit#ownership`;
}

function formatRole(item: OwnerAssignmentRow) {
  return item.role_name || item.role_code.replace(/_/g, ' ');
}

// ─── Workload stacked-bar chart ──────────────────────────────────────────────

interface WorkloadBarProps {
  row: OwnerLoadRow;
  maxScore: number;
}

function WorkloadBar({ row, maxScore }: WorkloadBarProps) {
  const total = maxScore || 1;
  const live = (row.live_services / total) * 100;
  const critical = (row.critical_services / total) * 100;
  const blockers = (row.readiness_blockers / total) * 100;
  const overdue = (row.overdue_reviews / total) * 100;

  return (
    <div className={ownerStyles.barWrap} title={`Score: ${row.owner_load_score}`}>
      <div className={ownerStyles.barTrack}>
        <div className={ownerStyles.segLive} style={{ width: `${live}%` }} />
        <div className={ownerStyles.segCritical} style={{ width: `${critical}%` }} />
        <div className={ownerStyles.segBlockers} style={{ width: `${blockers}%` }} />
        <div className={ownerStyles.segOverdue} style={{ width: `${overdue}%` }} />
      </div>
    </div>
  );
}

// ─── Owner picker (no ?owner= param) ────────────────────────────────────────

function OwnerPicker() {
  const router = useRouter();
  const [inputVal, setInputVal] = useState('');
  const topOwners = useOwnerLoad({ limit: 10 });
  const rows = topOwners.data?.items ?? [];
  const maxScore = Math.max(...rows.map((r) => r.owner_load_score), 1);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (trimmed) router.push(`/operations/owner-load?owner=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className={ownerStyles.pickerWrap}>
      <form className={ownerStyles.pickerForm} onSubmit={handleSubmit}>
        <input
          className={ownerStyles.pickerInput}
          type="text"
          placeholder="Zadej jméno nebo e-mail vlastníka…"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
        />
        <button type="submit" className={ownerStyles.pickerBtn}>Zobrazit</button>
      </form>

      {topOwners.isLoading ? (
        <div className={govStyles.stateLine}>Načítám top vlastníky…</div>
      ) : rows.length > 0 ? (
        <div className={ownerStyles.topList}>
          <div className={ownerStyles.topListHeader}>
            <span>Top 10 vlastníků dle load score</span>
            <span className={ownerStyles.barLegend}>
              <span className={ownerStyles.legLive}>live</span>
              <span className={ownerStyles.legCritical}>critical</span>
              <span className={ownerStyles.legBlockers}>blockers</span>
              <span className={ownerStyles.legOverdue}>overdue</span>
            </span>
          </div>
          {rows.map((row) => (
            <Link
              key={row.owner_key}
              href={`/operations/owner-load?owner=${encodeURIComponent(row.owner_key)}`}
              className={ownerStyles.topRow}
            >
              <span className={ownerStyles.topName}>{row.owner_name || row.owner_key}</span>
              <WorkloadBar row={row} maxScore={maxScore} />
              <span className={ownerStyles.topScore}>{row.owner_load_score}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function OwnerLoadDetailPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const owner = searchParams?.get('owner') ?? '';
  const ownerLoad = useOwnerLoad(owner ? { owner, limit: 1 } : {});
  const assignments = useOwnerAssignments(owner ? { owner, limit: 250 } : {});

  const ownerSummary = owner ? (ownerLoad.data?.items?.[0] ?? null) : null;
  const rows = assignments.data?.items ?? [];
  const displayName = ownerSummary?.owner_name || rows[0]?.display_name || owner;

  if (!owner) {
    return (
      <div className={styles.shell}>
        <PageHeader
          title="Owner Load"
          purpose="Přehled zátěže vlastníků — počty přiřazených služeb, live provoz, blokátory připravenosti a opožděné reviews."
          chips={[{ label: 'Vybrat vlastníka', tone: 'neutral' }]}
        />
        <OwnerPicker />
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <PageHeader
        title={displayName || t('operations.governance.owner.title')}
        purpose={ownerSummary?.owner_email || rows[0]?.email || owner}
        chips={[
          { label: 'Owner load', tone: 'neutral' },
          ownerSummary?.owner_load_score != null
            ? { label: `Score ${ownerSummary.owner_load_score}`, tone: ownerSummary.owner_load_score > 10 ? 'bad' : 'info' }
            : null,
        ].filter(Boolean) as import('@/app/components/PageHeader').PageHeaderChip[]}
        primaryAction={{ label: '← Zpět na přehled', href: '/operations/owner-load' }}
      />

      <section className={styles.kpiThree} aria-label="Owner load KPIs">
        <KpiCard label="Owned services" value={ownerSummary?.owned_services ?? rows.length} hint="active assignments" />
        <KpiCard label="Live services" value={ownerSummary?.live_services ?? rows.filter((r) => r.lifecycle_state === 'live').length} hint="daily load" />
        <KpiCard label="Load score" value={ownerSummary?.owner_load_score ?? 0} hint="governance pressure" />
      </section>

      {ownerSummary && (
        <section className={govStyles.governancePanel}>
          <div className={govStyles.panelHeader}>
            <div>
              <h2 className={govStyles.panelTitle}>Workload distribution</h2>
              <p className={govStyles.panelHint}>Podíl live, critical, blokerů a opožděných reviews na celkovém score.</p>
            </div>
          </div>
          <div className={ownerStyles.chartWrap}>
            <div className={ownerStyles.chartRow}>
              <span className={ownerStyles.chartLabel}>Live services</span>
              <div className={ownerStyles.chartTrack}>
                <div
                  className={ownerStyles.chartBarLive}
                  style={{ width: `${Math.min((ownerSummary.live_services / Math.max(ownerSummary.owned_services, 1)) * 100, 100)}%` }}
                />
              </div>
              <span className={ownerStyles.chartVal}>{ownerSummary.live_services}</span>
            </div>
            <div className={ownerStyles.chartRow}>
              <span className={ownerStyles.chartLabel}>Critical</span>
              <div className={ownerStyles.chartTrack}>
                <div
                  className={ownerStyles.chartBarCritical}
                  style={{ width: `${Math.min((ownerSummary.critical_services / Math.max(ownerSummary.owned_services, 1)) * 100, 100)}%` }}
                />
              </div>
              <span className={ownerStyles.chartVal}>{ownerSummary.critical_services}</span>
            </div>
            <div className={ownerStyles.chartRow}>
              <span className={ownerStyles.chartLabel}>Readiness blockers</span>
              <div className={ownerStyles.chartTrack}>
                <div
                  className={ownerStyles.chartBarBlockers}
                  style={{ width: `${Math.min((ownerSummary.readiness_blockers / Math.max(ownerSummary.owner_load_score || 1, 1)) * 100, 100)}%` }}
                />
              </div>
              <span className={ownerStyles.chartVal}>{ownerSummary.readiness_blockers}</span>
            </div>
            <div className={ownerStyles.chartRow}>
              <span className={ownerStyles.chartLabel}>Overdue reviews</span>
              <div className={ownerStyles.chartTrack}>
                <div
                  className={ownerStyles.chartBarOverdue}
                  style={{ width: `${Math.min((ownerSummary.overdue_reviews / Math.max(ownerSummary.owner_load_score || 1, 1)) * 100, 100)}%` }}
                />
              </div>
              <span className={ownerStyles.chartVal}>{ownerSummary.overdue_reviews}</span>
            </div>
          </div>
        </section>
      )}

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
    </div>
  );
}
