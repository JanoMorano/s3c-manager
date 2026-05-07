'use client';

import { use } from 'react';
import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import type { BadgeVariant } from '@/design-system/controls';
import { usePortfolioList, useServices } from '@/features/services/hooks/useServices';
import { useGovernanceDecisions, useGovernanceReviews } from '@/features/governance/hooks/useGovernance';
import type { ServicePortfolio } from '@/features/services/model/service.types';
import useSWR from 'swr';
import { apiFetch } from '@/features/services/api/services.api';
import styles from '../portfolio.module.css';

interface Props {
  params: Promise<{ code: string }>;
}

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('en');
}

function statusTone(status: string | null | undefined): BadgeVariant {
  const normalized = String(status ?? '').toLowerCase();
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

function LifecycleBar({ portfolio }: { portfolio: ServicePortfolio }) {
  const total = lifecycleTotal(portfolio);
  const segments = [
    { label: 'Draft', value: portfolio.draft_service_count, className: styles.stageDraft },
    { label: 'Active', value: portfolio.active_service_count, className: styles.stageActive },
    { label: 'Retiring', value: portfolio.retiring_service_count, className: styles.stageRetiring },
    { label: 'Retired', value: portfolio.retired_service_count, className: styles.stageRetired },
  ];

  return (
    <div className={styles.lifecycleBlock}>
      <div className={styles.lifecycleBar}>
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

export default function PortfolioDetailPage({ params }: Props) {
  const { code } = use(params);
  const portfolioCode = decodeURIComponent(code);
  const { data: portfolioData, isLoading: portfolioLoading, error: portfolioError } = usePortfolioList();
  const { data: servicesData, isLoading: servicesLoading, error: servicesError } = useServices({ portfolio: portfolioCode, limit: 200, sort: 'title' });

  const { data: decisionsData } = useGovernanceDecisions({ limit: 10, scope: portfolioCode });
  const { data: reviewsData } = useGovernanceReviews({ limit: 50, scope: portfolioCode });
  const { data: coverageData } = useSWR(
    portfolioCode ? `/api/v1/capabilities/coverage?portfolio=${encodeURIComponent(portfolioCode)}&limit=20` : null,
    apiFetch,
    { revalidateOnFocus: false },
  );

  const portfolio = portfolioData?.items.find((item) => item.portfolio_code === portfolioCode);
  const services = servicesData?.items ?? [];
  const active = services.filter((service) => service.service_status === 'active').length;
  const missingOwner = services.filter((service) => !service.service_owner && !service.manager && !service.vlastnik).length;
  const decisions = decisionsData?.items ?? [];
  const reviews = reviewsData?.items ?? [];
  const coverageItems: Array<{ capability_name?: string; slug?: string; service_count?: number; gap_count?: number; coverage_score?: number }> = (coverageData as { items?: Array<{ capability_name?: string; slug?: string; service_count?: number; gap_count?: number; coverage_score?: number }> })?.items ?? [];

  if (portfolioLoading) return <main className={styles.shell}><div className={styles.state}>Loading portfolio...</div></main>;
  if (portfolioError || !portfolio) return <main className={styles.shell}><div className={styles.state}>Portfolio not found.</div></main>;

  return (
    <main className={styles.shell}>
      <PageHeader
        title={portfolio.title}
        purpose={portfolio.description || 'Portfolio detail pro manažerský pohled na lifecycle, služby, ownership a review rizika.'}
        chips={[
          { label: portfolio.portfolio_code, tone: 'info' },
          { label: portfolio.status_code, tone: statusTone(portfolio.status_code) === 'success' ? 'ok' : 'neutral' },
          { label: `${formatNumber(portfolio.overdue_review_count)} overdue`, tone: portfolio.overdue_review_count > 0 ? 'bad' : 'ok' },
        ]}
        primaryAction={{ label: 'Back to portfolios', href: '/portfolio' }}
      />

      <section className={styles.kpiGrid} aria-label="Portfolio detail KPIs">
        <KpiCard label="Services" value={formatNumber(portfolio.service_count)} hint="Total in portfolio" />
        <KpiCard label="Active" value={formatNumber(active || portfolio.active_service_count)} hint="Live services" />
        <KpiCard label="Requestable" value={formatNumber(portfolio.requestable_service_count)} hint="Demand enabled" />
        <KpiCard label="Missing owner" value={formatNumber(missingOwner)} hint="Needs assignment" tone={missingOwner > 0 ? 'warning' : 'success'} />
      </section>

      <section className={styles.detailGrid}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <small>Lifecycle</small>
              <h2>Stage distribution</h2>
            </div>
            <Badge variant={statusTone(portfolio.status_code)}>{portfolio.status_code}</Badge>
          </div>
          <LifecycleBar portfolio={portfolio} />
          <div className={styles.ownerLine}>
            <span>Owner group</span>
            <strong>{portfolio.owner_group_name || 'Unassigned'}</strong>
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <small>Actions</small>
              <h2>Useful views</h2>
            </div>
          </div>
          <Link href={`/services/list?portfolio=${encodeURIComponent(portfolio.portfolio_code)}`} className={styles.inlineAction}>Filtered services</Link>
          <Link href="/operations/reviews" className={styles.inlineAction}>Governance reviews</Link>
          <Link href="/operations#owner-load" className={styles.inlineAction}>Owner load</Link>
        </article>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <small>Services</small>
            <h2>Portfolio service list</h2>
          </div>
          <Badge variant="neutral">{formatNumber(services.length)} loaded</Badge>
        </div>
        {servicesLoading ? (
          <div className={styles.state}>Loading services...</div>
        ) : servicesError ? (
          <div className={styles.state}>Services are unavailable.</div>
        ) : services.length === 0 ? (
          <EmptyState title="No services in this portfolio." />
        ) : (
          <div className={styles.serviceRows}>
            {services.map((service) => (
              <Link key={service.service_id} href={`/services/${service.service_id}`} className={styles.serviceRow}>
                <span>
                  <strong>{service.title}</strong>
                  <small>{service.service_id} · {service.service_type ?? 'type missing'}</small>
                </span>
                <Badge variant={statusTone(service.service_status)}>{service.service_status ?? 'unknown'}</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* §5 Capability coverage filtered by portfolio */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <small>Coverage</small>
            <h2>Capability coverage</h2>
          </div>
          <Link href={`/capabilities?portfolio=${encodeURIComponent(portfolio.portfolio_code)}`} className={styles.inlineAction}>
            Zobrazit vše
          </Link>
        </div>
        {coverageItems.length === 0 ? (
          <EmptyState title="Žádná capability coverage data pro toto portfolio." />
        ) : (
          <div className={styles.serviceRows}>
            {coverageItems.map((item, idx) => (
              <Link
                key={item.slug ?? String(idx)}
                href={item.slug ? `/capabilities/${item.slug}` : '/capabilities'}
                className={styles.serviceRow}
              >
                <span>
                  <strong>{item.capability_name ?? item.slug ?? '—'}</strong>
                  <small>{item.service_count ?? 0} služeb · {item.gap_count ?? 0} mezer</small>
                </span>
                <Badge variant={item.gap_count ? 'warning' : 'success'}>
                  {item.coverage_score != null ? `${Math.round(item.coverage_score * 100)}%` : '—'}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* §6 Last 10 decisions */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <small>Decision log</small>
            <h2>Poslední rozhodnutí</h2>
          </div>
          <Link href="/operations/decisions" className={styles.inlineAction}>
            Všechna rozhodnutí
          </Link>
        </div>
        {decisions.length === 0 ? (
          <EmptyState title="Žádná rozhodnutí pro toto portfolio." />
        ) : (
          <div className={styles.serviceRows}>
            {decisions.map((decision) => (
              <Link key={decision.id} href={`/services/${decision.service_id}`} className={styles.serviceRow}>
                <span>
                  <strong>{decision.service_title}</strong>
                  <small>{decision.service_id} · {decision.decision_type} · {decision.decided_at ? new Date(decision.decided_at).toLocaleDateString('cs-CZ') : 'datum chybí'}</small>
                </span>
                <Badge variant={decision.decision === 'approved' ? 'success' : decision.decision === 'rejected' ? 'danger' : 'neutral'}>
                  {decision.decision}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* §7 Review calendar */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <small>Reviews</small>
            <h2>Review kalendář</h2>
          </div>
          <Link href="/operations/reviews" className={styles.inlineAction}>
            Review board
          </Link>
        </div>
        {reviews.length === 0 ? (
          <EmptyState title="Žádné naplánované reviews pro toto portfolio." />
        ) : (
          <div className={styles.serviceRows}>
            {reviews.slice(0, 15).map((review) => (
              <Link key={review.id} href="/operations/reviews" className={styles.serviceRow}>
                <span>
                  <strong>{review.service_title}</strong>
                  <small>{review.service_id} · {review.review_type} · splatnost {review.due_at ? new Date(review.due_at).toLocaleDateString('cs-CZ') : '—'}</small>
                </span>
                <Badge variant={review.overdue ? 'danger' : review.status === 'approved' ? 'success' : 'info'}>
                  {review.status}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
