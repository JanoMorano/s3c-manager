'use client';

import { use } from 'react';
import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import type { BadgeVariant } from '@/design-system/controls';
import { useGovernanceDecisions, useGovernanceReviews } from '@/features/governance/hooks/useGovernance';
import type { PortfolioDetailResponse, ServicePortfolio, ServicePortfolioService } from '@/features/services/model/service.types';
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

function isReviewOverdue(value: string | null | undefined) {
  if (!value) return false;
  const due = new Date(value);
  return Number.isFinite(due.getTime()) && due.getTime() < Date.now();
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'termín chybí';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'termín chybí';
  return date.toLocaleDateString('cs-CZ');
}

function readinessTone(score: number | null | undefined): BadgeVariant {
  const value = Number(score ?? 0);
  if (value >= 80) return 'success';
  if (value >= 50) return 'warning';
  return 'danger';
}

function readinessLabel(score: number | null | undefined) {
  const value = Math.round(Number(score ?? 0));
  if (value >= 80) return `Připravenost ${value}%`;
  if (value >= 50) return `Doplnit připravenost ${value}%`;
  return `Blokuje připravenost ${value}%`;
}

function serviceOwner(service: ServicePortfolioService) {
  return service.service_owner ?? service.manager ?? service.vlastnik ?? null;
}

function serviceHasMissingOwner(service: ServicePortfolioService) {
  return Boolean(service.owner_missing) || !serviceOwner(service);
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
    { label: 'Návrh', value: portfolio.draft_service_count, className: styles.stageDraft },
    { label: 'Aktivní', value: portfolio.active_service_count, className: styles.stageActive },
    { label: 'Ukončování', value: portfolio.retiring_service_count, className: styles.stageRetiring },
    { label: 'Ukončeno', value: portfolio.retired_service_count, className: styles.stageRetired },
  ];

  return (
    <div className={styles.lifecycleBlock}>
      <div className={styles.lifecycleBar} aria-label="Rozložení životního cyklu služeb">
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

function capabilityMapHref(spiralCode: string | null | undefined) {
  const spiralNumber = String(spiralCode ?? '').match(/^Spiral_(\d+)$/)?.[1];
  return spiralNumber ? `/c3/capability-map-spiral${spiralNumber}` : '/c3/capability-map';
}

export default function PortfolioDetailPage({ params }: Props) {
  const { code } = use(params);
  const portfolioCode = decodeURIComponent(code);
  const {
    data: portfolioDetailData,
    isLoading: portfolioLoading,
    error: portfolioError,
  } = useSWR<PortfolioDetailResponse>(
    portfolioCode ? `/api/v1/portfolio/${encodeURIComponent(portfolioCode)}` : null,
    apiFetch,
    { revalidateOnFocus: false },
  );

  const { data: decisionsData } = useGovernanceDecisions({ limit: 10, scope: portfolioCode });
  const { data: reviewsData } = useGovernanceReviews({ limit: 50, scope: portfolioCode });

  const portfolio = portfolioDetailData?.item;
  const services = portfolio?.services ?? [];
  const active = Number(portfolio?.active_service_count ?? services.filter((service) => service.service_status === 'active').length);
  const missingOwner = Number(portfolio?.missing_owner_count ?? services.filter(serviceHasMissingOwner).length);
  const readinessBlocked = Number(portfolio?.readiness_blocker_count ?? services.filter((service) => service.readiness_blocked).length);
  const capabilityGaps = Number(portfolio?.capability_gap_count ?? 0);
  const dueSoon = Number(portfolio?.due_soon_review_count ?? services.filter((service) => service.review_due_soon).length);
  const activeReviews = Number(portfolio?.active_governance_review_count ?? 0);
  const portfolioServiceIds = new Set(services.map((service) => service.service_id));
  const decisions = (decisionsData?.items ?? []).filter((decision) => portfolioServiceIds.has(decision.service_id));
  const reviews = (reviewsData?.items ?? []).filter((review) => portfolioServiceIds.has(review.service_id));
  const coverageItems = portfolio?.capabilities ?? [];

  if (portfolioLoading) return <main className={styles.shell}><div className={styles.state}>Načítám portfolio...</div></main>;
  if (portfolioError || !portfolio) return <main className={styles.shell}><div className={styles.state}>Portfolio nebylo nalezeno.</div></main>;

  return (
    <main className={styles.shell}>
      <PageHeader
        title={portfolio.title}
        purpose={portfolio.description || 'Portfolio C3 schopnosti úrovně 2 pro manažerský pohled na životní cyklus, služby, vlastnictví a rizika revizí.'}
        chips={[
          { label: portfolio.portfolio_code, tone: 'info' },
          ...(portfolio.spiral_code ? [{ label: portfolio.spiral_code.replace('_', ' '), tone: 'neutral' as const }] : []),
          { label: portfolio.status_code, tone: statusTone(portfolio.status_code) === 'success' ? 'ok' : 'neutral' },
          { label: `${formatNumber(portfolio.overdue_review_count)} po termínu`, tone: portfolio.overdue_review_count > 0 ? 'bad' : 'ok' },
          { label: `${formatNumber(capabilityGaps)} mezer`, tone: capabilityGaps > 0 ? 'neutral' : 'ok' },
        ]}
        primaryAction={{ label: 'Zpět na portfolia', href: '/portfolio' }}
      />

      <section className={styles.kpiGrid} aria-label="KPI detailu portfolia">
        <KpiCard label="Služby" value={formatNumber(portfolio.service_count)} hint="Celkem v portfoliu" tone="info" />
        <KpiCard label="Aktivní" value={formatNumber(active || portfolio.active_service_count)} hint="Služby v provozu" tone="success" />
        <KpiCard label="Objednatelné" value={formatNumber(portfolio.requestable_service_count)} hint="Služby dostupné pro poptávku" />
        <KpiCard label="Chybí vlastník" value={formatNumber(missingOwner)} hint="Potřebuje přiřazení odpovědnosti" tone={missingOwner > 0 ? 'warning' : 'success'} />
        <KpiCard label="Blokery připravenosti" value={formatNumber(readinessBlocked)} hint="Brání publikaci nebo řídicímu rozhodnutí" tone={readinessBlocked > 0 ? 'danger' : 'success'} />
        <KpiCard label="Mezery schopností" value={formatNumber(capabilityGaps)} hint="Schopnosti bez namapované služby" tone={capabilityGaps > 0 ? 'warning' : 'success'} />
      </section>

      <section className={styles.detailGrid}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <small>Životní cyklus</small>
              <h2>Rozložení služeb podle stavu</h2>
            </div>
            <Badge variant={statusTone(portfolio.status_code)}>{portfolio.status_code}</Badge>
          </div>
          <LifecycleBar portfolio={portfolio} />
          <div className={styles.ownerLine}>
            <span>Vlastnická skupina</span>
            <strong>{portfolio.owner_group_name || 'nepřiřazeno'}</strong>
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <small>Prioritní kroky</small>
              <h2>Co má správce řešit jako první</h2>
            </div>
          </div>
          <div className={styles.actionList}>
            {readinessBlocked > 0 ? <span><strong>{formatNumber(readinessBlocked)}</strong> služeb má blokery připravenosti.</span> : null}
            {missingOwner > 0 ? <span><strong>{formatNumber(missingOwner)}</strong> služeb nemá vlastníka.</span> : null}
            {capabilityGaps > 0 ? <span><strong>{formatNumber(capabilityGaps)}</strong> schopností nemá pokrytí službou.</span> : null}
            {portfolio.overdue_review_count > 0 ? <span><strong>{formatNumber(portfolio.overdue_review_count)}</strong> služeb je po termínu revize.</span> : null}
            {dueSoon > 0 ? <span><strong>{formatNumber(dueSoon)}</strong> služeb čeká revize do 90 dnů.</span> : null}
            {activeReviews > 0 ? <span><strong>{formatNumber(activeReviews)}</strong> aktivních governance revizí.</span> : null}
            {readinessBlocked + missingOwner + capabilityGaps + Number(portfolio.overdue_review_count ?? 0) + dueSoon === 0 ? (
              <span>Portfolio nemá viditelné blokery vlastníka, připravenosti, pokrytí ani revizí.</span>
            ) : null}
          </div>
          <Link href="#portfolio-services" className={styles.inlineAction}>Služby portfolia</Link>
          <Link href={capabilityMapHref(portfolio.spiral_code)} className={styles.inlineAction}>Mapa schopností</Link>
          <Link href="/operations/reviews" className={styles.inlineAction}>Governance revize</Link>
          <Link href="/operations#owner-load" className={styles.inlineAction}>Zátěž vlastníků</Link>
        </article>
      </section>

      <section id="portfolio-services" className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <small>Služby</small>
            <h2>Služby namapované na toto C3 portfolio</h2>
          </div>
          <Badge variant="neutral">{formatNumber(services.length)} načteno</Badge>
        </div>
        {services.length === 0 ? (
          <EmptyState title="V tomto portfoliu nejsou namapované žádné služby." />
        ) : (
          <div className={styles.serviceRows}>
            {services.map((service) => (
              <Link key={service.service_id} href={`/services/${service.service_id}`} className={styles.serviceRow}>
                <span>
                  <strong>{service.title}</strong>
                  <small>
                    {service.service_id} · {service.service_type ?? 'typ chybí'}
                    {' · '}Vlastník: {serviceOwner(service) ?? 'chybí'}
                    {' · '}Revize: {formatDate(service.review_due_at)}
                  </small>
                </span>
                <span className={styles.rowBadges}>
                  {service.requestable ? <Badge variant="info">Objednatelné</Badge> : null}
                  <Badge variant={readinessTone(service.completeness_score)}>
                    {readinessLabel(service.completeness_score)}
                  </Badge>
                  {serviceHasMissingOwner(service) ? <Badge variant="danger">Chybí vlastník</Badge> : null}
                  {service.review_due_soon ? <Badge variant="warning">Revize do 90 dnů</Badge> : null}
                  {isReviewOverdue(service.review_due_at) ? <Badge variant="danger">Po termínu</Badge> : null}
                  {Number(service.active_review_count ?? 0) > 0 ? <Badge variant="info">{formatNumber(service.active_review_count)} revize</Badge> : null}
                  <Badge variant={statusTone(service.service_status)}>{service.service_status ?? 'neznámý'}</Badge>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* §5 Capability coverage filtered by portfolio */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <small>Pokrytí</small>
            <h2>Navazující schopnosti</h2>
          </div>
          <Link href={capabilityMapHref(portfolio.spiral_code)} className={styles.inlineAction}>
            Mapa schopností
          </Link>
        </div>
        {coverageItems.length === 0 ? (
          <EmptyState title="Žádné navazující schopnosti pro toto C3 portfolio." />
        ) : (
          <div className={styles.serviceRows}>
            {coverageItems.map((item) => (
              <Link
                key={item.capability_code}
                href={`/c3/${encodeURIComponent(item.capability_uuid)}`}
                className={styles.serviceRow}
              >
                <span>
                  <strong>{item.capability_title}</strong>
                  <small>
                    {item.capability_code} · Úroveň {item.capability_level}
                    {' · '}{formatNumber(item.service_count)} služeb
                    {' · '}{formatNumber(item.active_service_count)} aktivních
                    {' · '}{formatNumber(item.requestable_service_count)} objednatelných
                    {' · '}{formatNumber(item.overdue_review_count)} po termínu revize
                    {' · '}{formatNumber(item.readiness_blocker_count)} blokery připravenosti
                    {' · '}{formatNumber(item.missing_owner_count)} bez vlastníka
                  </small>
                </span>
                <Badge variant={item.service_count > 0 ? 'success' : 'warning'}>
                  {item.service_count > 0 ? 'Namapováno' : 'Mezera'}
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
            <small>Rozhodnutí</small>
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

      {/* §7 Calendar of portfolio reviews */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <small>Revize</small>
            <h2>Kalendář revizí</h2>
          </div>
          <Link href="/operations/reviews" className={styles.inlineAction}>
            Přehled revizí
          </Link>
        </div>
        {reviews.length === 0 ? (
          <EmptyState title="Žádné naplánované revize pro toto portfolio." />
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
