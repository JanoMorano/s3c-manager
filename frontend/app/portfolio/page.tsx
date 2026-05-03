'use client';

import { useMemo, useState } from 'react';
import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import type { BadgeVariant } from '@/design-system/controls';
import { usePortfolioList } from '@/features/services/hooks/useServices';
import type { ServicePortfolio } from '@/features/services/model/service.types';
import styles from './portfolio.module.css';

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('en');
}

function statusTone(status: string): BadgeVariant {
  const normalized = status.toLowerCase();
  if (normalized === 'active') return 'success';
  if (normalized === 'planning' || normalized === 'draft' || normalized === 'design') return 'warning';
  if (normalized === 'retired' || normalized === 'inactive') return 'neutral';
  return 'info';
}

function lifecycleTotal(portfolio: ServicePortfolio) {
  return Math.max(
    1,
    Number(portfolio.draft_service_count ?? 0)
      + Number(portfolio.active_service_count ?? 0)
      + Number(portfolio.retiring_service_count ?? 0)
      + Number(portfolio.retired_service_count ?? 0),
  );
}

function PortfolioLifecycleBar({ portfolio }: { portfolio: ServicePortfolio }) {
  const total = lifecycleTotal(portfolio);
  const segments = [
    { label: 'Draft', value: portfolio.draft_service_count, className: styles.stageDraft },
    { label: 'Active', value: portfolio.active_service_count, className: styles.stageActive },
    { label: 'Retiring', value: portfolio.retiring_service_count, className: styles.stageRetiring },
    { label: 'Retired', value: portfolio.retired_service_count, className: styles.stageRetired },
  ];

  return (
    <div className={styles.lifecycleBlock}>
      <div className={styles.lifecycleBar} aria-label="Lifecycle distribution">
        {segments.map((segment) => (
          <span
            key={segment.label}
            className={segment.className}
            style={{ width: `${Math.max(0, (Number(segment.value ?? 0) / total) * 100)}%` }}
            title={`${segment.label}: ${formatNumber(segment.value)}`}
          />
        ))}
      </div>
      <div className={styles.lifecycleLegend}>
        {segments.map((segment) => (
          <span key={segment.label}>{segment.label} {formatNumber(segment.value)}</span>
        ))}
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const { data, isLoading, error } = usePortfolioList();
  const [statusFilter, setStatusFilter] = useState('');

  const portfolios = data?.items ?? [];
  const statusOptions = useMemo(
    () => Array.from(new Set(portfolios.map((item) => item.status_code).filter(Boolean))).sort(),
    [portfolios],
  );

  const filtered = portfolios.filter((portfolio) => !statusFilter || portfolio.status_code === statusFilter);

  const totals = portfolios.reduce(
    (acc, portfolio) => {
      acc.services += Number(portfolio.service_count ?? 0);
      acc.active += Number(portfolio.active_service_count ?? 0);
      acc.requestable += Number(portfolio.requestable_service_count ?? 0);
      acc.overdue += Number(portfolio.overdue_review_count ?? 0);
      return acc;
    },
    { services: 0, active: 0, requestable: 0, overdue: 0 },
  );

  return (
    <main className={styles.shell}>
      <PageHeader
        title="Portfolios"
        purpose="Manažerský přehled portfolií služeb: co je aktivní, co dozrává, co končí a kde je potřeba review."
        chips={[
          { label: `${formatNumber(data?.count ?? portfolios.length)} portfolios`, tone: 'info' },
          { label: `${formatNumber(totals.overdue)} overdue`, tone: totals.overdue > 0 ? 'bad' : 'ok' },
        ]}
        primaryAction={{ label: 'Catalogue', href: '/catalogue' }}
      />

      <section className={styles.kpiGrid} aria-label="Portfolio headline KPIs">
        <KpiCard label="Services" value={formatNumber(totals.services)} hint="Governed portfolio services" />
        <KpiCard label="Active" value={formatNumber(totals.active)} hint="Currently live" />
        <KpiCard label="Requestable" value={formatNumber(totals.requestable)} hint="Visible demand channel" />
        <KpiCard label="Overdue reviews" value={formatNumber(totals.overdue)} hint="Owner action needed" tone={totals.overdue > 0 ? 'danger' : 'success'} />
      </section>

      <section className={styles.toolbar} aria-label="Portfolio filters">
        <label>
          <span>Status</span>
          <select aria-label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <Link href="/cockpit/my-tasks" className={styles.inlineAction}>My tasks</Link>
      </section>

      {isLoading ? (
        <div className={styles.state}>Loading portfolio cockpit...</div>
      ) : error ? (
        <div className={styles.state}>Portfolio cockpit is unavailable.</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No portfolios match the current filters." />
      ) : (
        <section className={styles.grid} aria-label="Portfolio list">
          {filtered.map((portfolio) => (
            <article key={portfolio.portfolio_code} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <small>{portfolio.portfolio_code}</small>
                  <h2>{portfolio.title}</h2>
                </div>
                <Badge variant={statusTone(portfolio.status_code)}>{portfolio.status_code}</Badge>
              </div>
              <PortfolioLifecycleBar portfolio={portfolio} />
              <dl className={styles.metrics}>
                <div>
                  <dt>Services</dt>
                  <dd>{formatNumber(portfolio.service_count)}</dd>
                </div>
                <div>
                  <dt>Requestable</dt>
                  <dd>{formatNumber(portfolio.requestable_service_count)}</dd>
                </div>
                <div>
                  <dt>Review</dt>
                  <dd>{formatNumber(portfolio.overdue_review_count)} overdue</dd>
                </div>
              </dl>
              <div className={styles.ownerLine}>
                <span>Owner</span>
                <strong>{portfolio.owner_group_name || 'Unassigned'}</strong>
              </div>
              <Link
                href={`/portfolio/${encodeURIComponent(portfolio.portfolio_code)}`}
                className={styles.serviceLink}
                aria-label={`Open ${portfolio.title} portfolio detail`}
              >
                Open portfolio
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
