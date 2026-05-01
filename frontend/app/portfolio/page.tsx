'use client';

import { useMemo, useState } from 'react';
import Link from '@/app/components/AppLink';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import { usePortfolioList } from '@/features/services/hooks/useServices';
import styles from './portfolio.module.css';

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('en');
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'active') return 'success';
  if (normalized === 'planning' || normalized === 'draft' || normalized === 'design') return 'warning';
  if (normalized === 'retired' || normalized === 'inactive') return 'neutral';
  return 'info';
}

export default function PortfolioPage() {
  const { data, isLoading, error } = usePortfolioList();
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');

  const portfolios = data?.items ?? [];
  const statusOptions = useMemo(
    () => Array.from(new Set(portfolios.map((item) => item.status_code).filter(Boolean))).sort(),
    [portfolios],
  );

  const filtered = portfolios.filter((portfolio) => {
    const statusMatches = !statusFilter || portfolio.status_code === statusFilter;
    const ownerMatches = !ownerFilter || (portfolio.owner_group_name ?? '').toLowerCase().includes(ownerFilter.toLowerCase());
    return statusMatches && ownerMatches;
  });

  const totals = portfolios.reduce(
    (acc, portfolio) => {
      acc.services += Number(portfolio.service_count ?? 0);
      acc.active += Number(portfolio.active_service_count ?? 0);
      acc.overdue += Number(portfolio.overdue_review_count ?? 0);
      return acc;
    },
    { services: 0, active: 0, overdue: 0 },
  );

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Service portfolio</span>
          <h1 className={styles.title}>Portfolio Cockpit</h1>
          <p className={styles.lead}>
            Govern service portfolios by lifecycle, owner load, review deadlines, and requestable service coverage.
          </p>
        </div>
        <Badge variant="info">{formatNumber(data?.count ?? portfolios.length)} portfolios</Badge>
      </header>

      <section className={styles.kpiGrid} aria-label="Portfolio headline KPIs">
        <KpiCard label="Services" value={formatNumber(totals.services)} hint="in governed portfolios" />
        <KpiCard label="Active" value={formatNumber(totals.active)} hint="portfolio services" />
        <KpiCard label="Overdue reviews" value={formatNumber(totals.overdue)} hint="owner action needed" />
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
        <label>
          <span>Owner group</span>
          <input
            aria-label="Owner group"
            type="search"
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            placeholder="Filter by owner"
          />
        </label>
      </section>

      {isLoading ? (
        <div className={styles.state}>Loading portfolio cockpit...</div>
      ) : error ? (
        <div className={styles.state}>Portfolio cockpit is unavailable.</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No portfolios match the current filters." />
      ) : (
        <section className={styles.grid} aria-label="Portfolio list">
          {filtered.map((portfolio) => {
            const serviceHref = `/services/list?portfolio=${encodeURIComponent(portfolio.portfolio_code)}`;
            return (
              <article key={portfolio.portfolio_code} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <small>{portfolio.portfolio_code}</small>
                    <h2>{portfolio.title}</h2>
                  </div>
                  <Badge variant={statusTone(portfolio.status_code)}>{portfolio.status_code}</Badge>
                </div>
                <p>{portfolio.description || 'No portfolio description yet.'}</p>
                <dl className={styles.metrics}>
                  <div>
                    <dt>Services</dt>
                    <dd>{formatNumber(portfolio.service_count)}</dd>
                  </div>
                  <div>
                    <dt>Active</dt>
                    <dd>{formatNumber(portfolio.active_service_count)}</dd>
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
                  href={serviceHref}
                  className={styles.serviceLink}
                  aria-label={`Open filtered services for ${portfolio.title}`}
                >
                  Open filtered services
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
