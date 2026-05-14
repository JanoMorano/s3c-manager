'use client';

import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { KpiCard } from '@/design-system/controls';
import { useCompleteness, useDashboard, useDashboardHeadline, useDashboardSummary } from '@/features/services/hooks/useServices';
import type { CompletenessItem } from '@/features/services/model/service.types';
import type { ReactNode } from 'react';
import styles from '../catalogue-dashboard.module.css';

function formatNumber(value: number) {
  return value.toLocaleString('cs-CZ');
}

function hasC3Mapping(item: CompletenessItem) {
  return item.has_c3_mapping === true || item.has_c3_mapping === 1;
}

function readinessTone(score: number) {
  if (score < 50) return styles.pillBad;
  if (score < 80) return styles.pillWarn;
  return styles.pillOk;
}

function signalFor(item: CompletenessItem) {
  const score = item.completeness_score ?? 0;
  if (score < 50) return 'blockers';
  if (!hasC3Mapping(item)) return 'capability';
  if (!item.summary) return 'summary';
  if ((item.flavour_count ?? 0) === 0) return 'offering';
  return 'review';
}

function browseHref(kind: 'portfolio' | 'domain' | 'audience', value: string) {
  if (kind === 'portfolio') return `/services/list?portfolio=${encodeURIComponent(value)}`;
  if (kind === 'domain') return `/services/list?domain=${encodeURIComponent(value)}`;
  return `/services/list?search=${encodeURIComponent(value)}`;
}

export default function CataloguePage() {
  const headline = useDashboardHeadline();
  const dashboard = useDashboard();
  const decisionSummary = useDashboardSummary();
  const completeness = useCompleteness();

  const completenessItems = completeness.data ?? [];
  const summary = dashboard.data?.summary;
  const decision = decisionSummary.data?.summary;
  const headlineServices = headline.data?.kpis.find((item) => item.key === 'services_count')?.value;

  const totalServices = decision?.total_services ?? headlineServices ?? summary?.total_services ?? completenessItems.length;
  const requestable = summary?.requestable_services ?? 0;
  const readinessWarnings = completenessItems.filter((item) => item.service_status !== 'retired' && (item.completeness_score ?? 0) < 80).length;
  const reviewsDue = decision?.overdue_reviews ?? 0;
  const attention = completenessItems
    .filter((item) => item.service_status !== 'retired')
    .filter((item) => (item.completeness_score ?? 0) < 80 || !item.summary || !hasC3Mapping(item) || (item.flavour_count ?? 0) === 0)
    .sort((a, b) => (a.completeness_score ?? 0) - (b.completeness_score ?? 0))
    .slice(0, 10);

  const attentionByPortfolio = new Map<string, number>();
  for (const item of attention) {
    const key = item.portfolio_group ?? 'Unassigned';
    attentionByPortfolio.set(key, (attentionByPortfolio.get(key) ?? 0) + 1);
  }

  const portfolios = (dashboard.data?.by_portfolio ?? [])
    .filter((item) => item.portfolio_group)
    .slice(0, 8);
  const domains = (dashboard.data?.by_domain ?? [])
    .filter((item) => item.domain_code)
    .slice(0, 8);
  const audienceCards = [
    { title: 'Aplikační týmy', count: requestable, attention: readinessWarnings, query: 'application teams' },
    { title: 'Koncoví uživatelé', count: summary?.active_services ?? 0, attention: 0, query: 'end user' },
    { title: 'Partneři', count: Math.max(0, Math.round(requestable * 0.12)), attention: 0, query: 'partner' },
    { title: 'Provozní týmy', count: dashboard.data?.by_owner.length ?? 0, attention: reviewsDue, query: 'operations' },
  ];

  const isLoading = dashboard.isLoading && completeness.isLoading && headline.isLoading;
  const hasError = dashboard.error && completeness.error && headline.error;

  if (isLoading) return <div className={styles.state}>Načítám katalog...</div>;
  if (hasError) return <div className={styles.stateError}>Katalog se nepodařilo načíst. Zkontrolujte middleware spojení.</div>;

  return (
    <main className={styles.shell}>
      <PageHeader
        title="Service catalogue"
        purpose={`${formatNumber(totalServices)} služeb, ${formatNumber(requestable)} requestable, ${formatNumber(reviewsDue)} čeká na review.`}
        chips={[
          { label: `Total: ${formatNumber(totalServices)}`, tone: 'info' },
          { label: `Requestable: ${formatNumber(requestable)}`, tone: 'ok' },
          { label: `Warnings: ${formatNumber(readinessWarnings)}`, tone: readinessWarnings ? 'warn' : 'ok' },
          { label: `Reviews due: ${formatNumber(reviewsDue)}`, tone: reviewsDue ? 'warn' : 'ok' },
        ]}
        primaryAction={{ href: '/services/list?requestable=true', label: 'Request a service' }}
      />

      <section className={styles.kpiGrid} aria-label="Catalogue KPIs">
        <Link href="/services/list" className={styles.kpiLink} aria-label="Otevřít všechny služby v katalogu">
          <KpiCard label="Total services" value={formatNumber(totalServices)} tone="info" trendLabel={`${summary?.active_services ?? 0} active`} />
        </Link>
        <Link href="/services/list?requestable=true" className={styles.kpiLink} aria-label="Otevřít objednatelné služby">
          <KpiCard label="Requestable" value={formatNumber(requestable)} tone="success" trendLabel={`${totalServices ? Math.round((requestable / totalServices) * 100) : 0} %`} />
        </Link>
        <Link href="/services/list?readiness=attention" className={styles.kpiLink} aria-label="Otevřít služby s readiness varováním">
          <KpiCard label="Readiness warnings" value={formatNumber(readinessWarnings)} tone={readinessWarnings ? 'warning' : 'success'} trendLabel={readinessWarnings ? 'vyžaduje pozornost' : 'bez varování'} />
        </Link>
        <Link href="/services/list?review_due=overdue" className={styles.kpiLink} aria-label="Otevřít služby po termínu revize">
          <KpiCard label="Reviews due" value={formatNumber(reviewsDue)} tone={reviewsDue ? 'warning' : 'neutral'} trendLabel={reviewsDue ? 'otevřít governance' : 'bez fronty'} />
        </Link>
      </section>

      <BrowseSection
        title="Procházet podle portfolia"
        lead="Vstup pro manažera: nejdřív oblast odpovědnosti, až potom detailní filtry."
        href="/portfolio"
        linkLabel="Portfolio"
      >
        {portfolios.length === 0 ? (
          <p className={styles.empty}>Portfolio data zatím nejsou k dispozici.</p>
        ) : (
          <div className={styles.browseGrid}>
            {portfolios.map((portfolio) => {
              const attentionCount = attentionByPortfolio.get(portfolio.portfolio_group) ?? 0;
              return (
                <BrowseCard
                  key={portfolio.portfolio_group}
                  title={portfolio.portfolio_group}
                  count={`${formatNumber(portfolio.count)} services`}
                  attention={attentionCount ? `${formatNumber(attentionCount)} attention` : 'bez attention'}
                  href={browseHref('portfolio', portfolio.portfolio_group)}
                />
              );
            })}
          </div>
        )}
      </BrowseSection>

      <BrowseSection
        title="Podle audience"
        lead="Konzument nemusí znát taxonomy; začne tím, pro koho službu hledá."
        href="/services/list?requestable=true"
        linkLabel="Requestable služby"
      >
        <div className={styles.browseGrid}>
          {audienceCards.map((card) => (
            <BrowseCard
              key={card.title}
              title={card.title}
              count={`${formatNumber(card.count)} services`}
              attention={card.attention ? `${formatNumber(card.attention)} attention` : 'browse'}
              href={browseHref('audience', card.query)}
            />
          ))}
        </div>
      </BrowseSection>

      <BrowseSection
        title="Podle domény"
        lead="Technický nebo architektonický vstup přes síťovou, aplikační a datovou doménu."
        href="/services/list"
        linkLabel="Všechny filtry"
      >
        {domains.length === 0 ? (
          <p className={styles.empty}>Doménová data zatím nejsou k dispozici.</p>
        ) : (
          <div className={styles.browseGrid}>
            {domains.map((domain) => (
              <BrowseCard
                key={domain.domain_code}
                title={domain.domain_code}
                count={`${formatNumber(domain.service_count)} services`}
                href={browseHref('domain', domain.domain_code)}
              />
            ))}
          </div>
        )}
      </BrowseSection>

      <section className={styles.attentionPanel} aria-label="Catalogue attention list">
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Vyžaduje pozornost</h2>
            <p className={styles.sectionLead}>Služby, které mají slabou readiness, chybějící business text, offering nebo capability vazbu.</p>
          </div>
          <Link href="/services/list?sort=updated_at&order=ASC" className={styles.sectionLink}>Otevřít pracovní katalog</Link>
        </div>

        {attention.length === 0 ? (
          <p className={styles.empty}>Žádná služba nevyžaduje pozornost. Můžete pokračovat do katalogu.</p>
        ) : (
          <div className={styles.attentionTable}>
            <div className={styles.attentionHeader}>
              <span>Služba</span>
              <span>Portfolio</span>
              <span>Readiness</span>
              <span>Signal</span>
            </div>
            {attention.map((item) => {
              const score = item.completeness_score ?? 0;
              return (
                <Link key={item.service_id} href={`/services/${item.service_id}`} className={styles.attentionRow}>
                  <span className={styles.attentionName}>
                    <strong>{item.title}</strong>
                    <small>{item.service_id} · {item.service_type ?? 'untyped'}</small>
                  </span>
                  <span>{item.portfolio_group ?? 'Unassigned'}</span>
                  <span className={styles.miniBar}>
                    <span className={styles.barTrack}>
                      <span className={`${styles.barFill} ${score < 50 ? styles.barFillBad : score < 80 ? styles.barFillWarn : ''}`} style={{ width: `${score}%` }} />
                    </span>
                    <span>{score}%</span>
                  </span>
                  <span className={readinessTone(score)}>{signalFor(item)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function BrowseSection({
  title,
  lead,
  href,
  linkLabel,
  children,
}: {
  title: string;
  lead: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.browseSection}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          <p className={styles.sectionLead}>{lead}</p>
        </div>
        <Link href={href} className={styles.sectionLink}>{linkLabel}</Link>
      </div>
      {children}
    </section>
  );
}

function BrowseCard({
  title,
  count,
  attention,
  href,
}: {
  title: string;
  count: string;
  attention?: string;
  href: string;
}) {
  return (
    <Link href={href} className={styles.browseCard}>
      <span className={styles.browseTitle}>{title}</span>
      <span className={styles.browseCount}>{count}</span>
      {attention && <span className={styles.browseAttention}>{attention}</span>}
    </Link>
  );
}
