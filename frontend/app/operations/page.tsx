'use client';

import type { ReactNode } from 'react';
import Link from '@/app/components/AppLink';
import { useSearchParams } from 'next/navigation';
import { Badge, EmptyState, KpiCard, ProgressBar } from '@/design-system/controls';
import type { BadgeVariant } from '@/design-system/controls';
import { useOperationsDashboard } from '@/features/services/hooks/useServices';
import type { CompletenessItem } from '@/features/services/hooks/useServices';
import {
  useContractOverlap,
  useGovernanceAdvisor,
  useOwnerLoad,
  useRenewalCalendar,
  useServiceRiskRadar,
} from '@/features/governance/hooks/useGovernance';
import type {
  AdvisorFinding,
  ContractOverlapRow,
  GovernanceSeverity,
  OwnerLoadRow,
  RenewalRiskRow,
  ServiceRiskFinding,
} from '@/features/governance/types';
import { useT } from '@/app/i18n/useI18n';
import styles from '../dashboard/dashboard.module.css';
import govStyles from './governance.module.css';

function readinessTone(score: number) {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

function severityTone(severity: GovernanceSeverity): BadgeVariant {
  if (severity === 'P0') return 'danger';
  if (severity === 'P1') return 'warning';
  if (severity === 'P2') return 'info';
  return 'neutral';
}

type OperationsTab = 'health' | 'governance' | 'pricing' | 'owners' | 'c3';

const OPERATIONS_TABS: Array<{ key: OperationsTab; labelKey: string; href: string }> = [
  { key: 'health', labelKey: 'common.health', href: '/operations' },
  { key: 'governance', labelKey: 'operations.tabs.governance', href: '/operations?tab=governance' },
  { key: 'pricing', labelKey: 'operations.tabs.pricing', href: '/operations?tab=pricing' },
  { key: 'owners', labelKey: 'operations.tabs.owners', href: '/operations?tab=owners' },
  { key: 'c3', labelKey: 'operations.tabs.c3', href: '/operations?tab=c3' },
];

function safeInternalHref(href: string | null | undefined, fallback: string) {
  if (href?.startsWith('/')) return href;
  return fallback;
}

function isUuidLike(value: string | null | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}

function c3EntityHref(sourceType: string | null | undefined, sourceId: string | null | undefined) {
  const normalizedType = String(sourceType ?? '').toLowerCase();
  if (!isUuidLike(sourceId)) return null;
  if (normalizedType === 'c3_capability' || normalizedType === 'capability' || normalizedType === 'c3') {
    return `/c3/${sourceId}`;
  }
  return null;
}

function governanceHref(
  item: Pick<ServiceRiskFinding | AdvisorFinding, 'source_entity_type' | 'source_entity_id' | 'target_url'>,
  fallback: string,
) {
  return c3EntityHref(item.source_entity_type, item.source_entity_id) ?? safeInternalHref(item.target_url, fallback);
}

function ServiceRows({ items, empty }: { items: CompletenessItem[]; empty: string }) {
  if (items.length === 0) return <EmptyState title={empty} />;
  return (
    <div className={styles.auditList}>
      {items.map((service) => {
        const score = service.completeness_score ?? 0;
        return (
          <Link key={service.service_id} href={`/services/${service.service_id}/edit`} className={styles.queueRowLink}>
            <span>
              <strong>{service.title}</strong>
              <small>{service.service_id} · {service.service_status ?? 'unknown'}</small>
            </span>
            <span className={styles.workProgress}>
              <ProgressBar value={score} tone={readinessTone(score)} label={`${service.title} readiness`} />
              <small>{score}%</small>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function PanelState({ label }: { label: string }) {
  return <div className={govStyles.stateLine}>{label}</div>;
}

function GovernancePanel({
  title,
  hint,
  count,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <article className={govStyles.governancePanel}>
      <div className={govStyles.panelHeader}>
        <div>
          <h2 className={govStyles.panelTitle}>{title}</h2>
          <p className={govStyles.panelHint}>{hint}</p>
        </div>
        <span className={govStyles.panelCount}>{count}</span>
      </div>
      {children}
    </article>
  );
}

function RiskRows({ items, empty }: { items: ServiceRiskFinding[]; empty: string }) {
  if (items.length === 0) return <PanelState label={empty} />;
  return (
    <div className={govStyles.governanceList}>
      {items.map((item) => (
        <Link
          key={item.finding_key}
          href={governanceHref(item, `/services/${item.service_id}/edit`)}
          className={govStyles.governanceRow}
        >
          <Badge variant={severityTone(item.severity)}>{item.severity}</Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.title}</strong>
            <span>{item.reason}</span>
          </span>
          <span className={govStyles.rowMetric}>{Math.round(Number(item.score ?? 0))}</span>
        </Link>
      ))}
    </div>
  );
}

function OwnerRows({ items, empty }: { items: OwnerLoadRow[]; empty: string }) {
  if (items.length === 0) return <PanelState label={empty} />;
  return (
    <div className={govStyles.governanceList}>
      {items.map((item) => (
        <Link
          key={item.owner_key}
          href={`/operations/owner-load?owner=${encodeURIComponent(item.owner_key)}`}
          className={govStyles.governanceRow}
        >
          <Badge variant={item.owner_load_score >= 80 ? 'danger' : item.owner_load_score >= 40 ? 'warning' : 'info'}>
            {item.owner_load_score}
          </Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.owner_name}</strong>
            <span>{item.owned_services} services · {item.readiness_blockers} blockers · {item.live_services} live</span>
          </span>
          <span className={govStyles.rowMetric}>{item.contract_gaps + item.c3_gaps} gaps</span>
        </Link>
      ))}
    </div>
  );
}

function ContractRows({ items, empty }: { items: ContractOverlapRow[]; empty: string }) {
  if (items.length === 0) return <PanelState label={empty} />;
  return (
    <div className={govStyles.governanceList}>
      {items.map((item) => (
        <Link
          key={`${item.overlap_scope}:${item.overlap_key}`}
          href={`/operations/contracts?overlap=${encodeURIComponent(item.overlap_key)}`}
          className={govStyles.governanceRow}
        >
          <Badge variant={severityTone(item.severity)}>{item.severity}</Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.overlap_title}</strong>
            <span>{item.overlap_scope} · {item.contract_count} contracts · {item.vendor_count} vendors</span>
          </span>
          <span className={govStyles.rowMetric}>{item.contract_count}×</span>
        </Link>
      ))}
    </div>
  );
}

function AdvisorRows({ items, empty }: { items: AdvisorFinding[]; empty: string }) {
  if (items.length === 0) return <PanelState label={empty} />;
  return (
    <div className={govStyles.governanceList}>
      {items.map((item) => (
        <Link
          key={item.finding_key}
          href={governanceHref(item, '/operations/advisor')}
          className={govStyles.governanceRow}
        >
          <Badge variant={severityTone(item.severity)}>{item.severity}</Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.title}</strong>
            <span>{item.suggested_action || item.reason}</span>
          </span>
          <span className={govStyles.rowMetric}>{item.finding_type}</span>
        </Link>
      ))}
    </div>
  );
}

function RenewalRows({ items, empty }: { items: RenewalRiskRow[]; empty: string }) {
  if (items.length === 0) return <PanelState label={empty} />;
  return (
    <div className={govStyles.governanceList}>
      {items.map((item) => (
        <Link
          key={item.contract_id}
          href={safeInternalHref(item.target_url, `/operations/contracts?contract=${item.contract_id}`)}
          className={govStyles.governanceRow}
        >
          <Badge variant={severityTone(item.severity)}>{item.severity}</Badge>
          <span className={govStyles.rowMain}>
            <strong>{item.title}</strong>
            <span>{item.vendor_name || item.vendor_code || item.contract_code}</span>
          </span>
          <span className={govStyles.rowMetric}>{item.days_to_renewal} d</span>
        </Link>
      ))}
    </div>
  );
}

function CoverageMetricRows({
  rows,
  empty,
}: {
  rows: Array<{ label: string; value: number; total: number; href?: string }>;
  empty: string;
}) {
  if (rows.length === 0) return <EmptyState title={empty} />;
  return (
    <div className={styles.auditList}>
      {rows.map((row) => {
        const percent = row.total > 0 ? Math.round((row.value / row.total) * 100) : 0;
        const content = (
          <>
            <span>
              <strong>{row.label}</strong>
              <small>{row.value}/{row.total}</small>
            </span>
            <span className={styles.workProgress}>
              <ProgressBar value={percent} tone={readinessTone(percent)} label={`${row.label} coverage`} />
              <small>{percent}%</small>
            </span>
          </>
        );
        return row.href ? (
          <Link key={row.label} href={row.href} className={styles.queueRowLink}>{content}</Link>
        ) : (
          <div key={row.label} className={styles.queueRowLink}>{content}</div>
        );
      })}
    </div>
  );
}

export default function OperationsPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const { data, isLoading, error } = useOperationsDashboard();
  const riskRadar = useServiceRiskRadar({ limit: 5 });
  const ownerLoad = useOwnerLoad({ limit: 5 });
  const contractOverlap = useContractOverlap({ limit: 5 });
  const renewalCalendar = useRenewalCalendar({ limit: 5 });
  const advisor = useGovernanceAdvisor({ limit: 5 });

  if (isLoading) return <div className={styles.state}>{t('operations.loading')}</div>;
  if (error || !data) return <div className={styles.stateError}>{t('operations.unavailable')}</div>;

  const pricing = data.sections.pricing_patrol;
  const incomplete = data.sections.incomplete_metadata;
  const missingOwners = data.sections.missing_owners;
  const c3GapTotal = data.sections.c3_mapping_gap.reduce((sum, row) => sum + row.gap_count, 0);
  const riskItems = riskRadar.data?.items ?? [];
  const ownerItems = ownerLoad.data?.items ?? [];
  const contractItems = contractOverlap.data?.items ?? [];
  const renewalItems = renewalCalendar.data?.items ?? [];
  const advisorItems = advisor.data?.items ?? [];
  const governanceError = riskRadar.error || ownerLoad.error || contractOverlap.error || renewalCalendar.error || advisor.error;
  const requestedTab = searchParams?.get('tab') as OperationsTab | null;
  const activeTab = OPERATIONS_TABS.some((tab) => tab.key === requestedTab) ? requestedTab! : 'health';
  const c3CoverageRows = data.sections.c3_mapping_gap.map((row) => ({
    label: row.item_type,
    value: row.mapped_count,
    total: row.total_count,
    href: `/c3/list?item_type=${encodeURIComponent(row.item_type)}`,
  }));
  const pricingCoverageRows = [
    {
      label: t('operations.pricing.coverage'),
      value: pricing.with_pricing,
      total: pricing.total_services,
      href: '/services/list',
    },
  ];

  return (
    <main className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>{t('operations.eyebrow')}</span>
          <h1 className={styles.pageTitle}>{t('operations.title')}</h1>
          <p className={styles.pageLead}>{t('operations.lead')}</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.cachedBadge}>{t('operations.badge.governance')}</span>
          <span className={styles.cachedBadge}>{t('operations.badge.evidence')}</span>
          <Link href="/catalogue" className={styles.secondaryLink}>{t('operations.link.catalogue')}</Link>
        </div>
      </header>

      <section className={styles.kpiThree} aria-label="Operations headline KPIs">
        <KpiCard label={t('operations.kpi.metadata')} value={incomplete.length} hint={<span className={styles.kpiHint}><Badge variant={incomplete.length ? 'warning' : 'success'}>{incomplete.length ? t('common.action') : t('common.clean')}</Badge><span>{t('operations.kpi.metadata_hint')}</span></span>} />
        <KpiCard label={t('operations.kpi.owner_gaps')} value={missingOwners.length} hint={<span className={styles.kpiHint}><Badge variant={missingOwners.length ? 'warning' : 'success'}>{missingOwners.length ? t('operations.assign') : t('operations.covered')}</Badge><span>{t('operations.kpi.owner_hint')}</span></span>} />
        <KpiCard label={t('operations.kpi.c3_gaps')} value={c3GapTotal} hint={<span className={styles.kpiHint}><Badge variant={c3GapTotal ? 'warning' : 'success'}>{c3GapTotal ? t('operations.map') : t('operations.covered')}</Badge><span>{t('operations.kpi.c3_hint')}</span></span>} />
      </section>

      <nav className={styles.tabs} aria-label="Operations sections">
        {OPERATIONS_TABS.map((tab) => (
          <Link key={tab.key} href={tab.href} className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}>
            {t(tab.labelKey)}
          </Link>
        ))}
      </nav>

      {activeTab === 'governance' && <section className={govStyles.governanceSection} aria-label={t('operations.governance.title')}>
        <div className={govStyles.governanceHeader}>
          <div>
            <h2 className={govStyles.governanceTitle}>{t('operations.governance.title')}</h2>
            <p className={govStyles.governanceLead}>{t('operations.governance.lead')}</p>
          </div>
          {governanceError ? <Badge variant="warning">{t('operations.governance.partial')}</Badge> : <Badge variant="info">{t('operations.governance.live')}</Badge>}
        </div>
        <div className={govStyles.governanceGrid}>
          <GovernancePanel title={t('operations.governance.risk.title')} hint={t('operations.governance.risk.hint')} count={riskItems.length}>
            {riskRadar.isLoading && riskItems.length === 0 ? <PanelState label={t('operations.governance.loading')} /> : <RiskRows items={riskItems} empty={t('operations.governance.risk.empty')} />}
          </GovernancePanel>
          <GovernancePanel title={t('operations.governance.owner.title')} hint={t('operations.governance.owner.hint')} count={ownerItems.length}>
            {ownerLoad.isLoading && ownerItems.length === 0 ? <PanelState label={t('operations.governance.loading')} /> : <OwnerRows items={ownerItems} empty={t('operations.governance.owner.empty')} />}
          </GovernancePanel>
          <GovernancePanel title={t('operations.governance.contract.title')} hint={t('operations.governance.contract.hint')} count={contractItems.length}>
            {contractOverlap.isLoading && contractItems.length === 0 ? <PanelState label={t('operations.governance.loading')} /> : <ContractRows items={contractItems} empty={t('operations.governance.contract.empty')} />}
          </GovernancePanel>
          <GovernancePanel title={t('operations.governance.advisor.title')} hint={t('operations.governance.advisor.hint')} count={advisorItems.length + renewalItems.length}>
            {advisor.isLoading && renewalCalendar.isLoading && advisorItems.length === 0 && renewalItems.length === 0 ? (
              <PanelState label={t('operations.governance.loading')} />
            ) : (
              <>
                <AdvisorRows items={advisorItems} empty={t('operations.governance.advisor.empty')} />
                {renewalItems.length > 0 ? <RenewalRows items={renewalItems} empty={t('operations.governance.renewal.empty')} /> : null}
              </>
            )}
          </GovernancePanel>
        </div>
      </section>}

      {activeTab === 'health' && <section className={styles.decisionLayout}>
        <div className={styles.decisionMain}>
          <article className={styles.decisionCard}>
            <div className={styles.decisionCardHeader}>
              <div>
                <h2 className={styles.decisionTitle}>{t('operations.board.title')}</h2>
                <p className={styles.decisionLead}>{t('operations.board.lead')}</p>
              </div>
              <Link href="/services/list" className={styles.secondaryLink}>{t('operations.open_service_list')}</Link>
            </div>
            <div className={styles.insightGrid}>
              <div className={styles.insightTile}>
                <strong>{pricing.coverage_percent}%</strong>
                <span>{t('operations.insight.pricing')}</span>
              </div>
              <div className={styles.insightTile}>
                <strong>{data.sections.top_completeness.length}</strong>
                <span>{t('operations.insight.references')}</span>
              </div>
              <div className={styles.insightTile}>
                <strong>{data.sections.deprecated_retired.length}</strong>
                <span>{t('operations.insight.lifecycle')}</span>
              </div>
            </div>
          </article>

          <article className={styles.decisionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.cardTitle}>{t('operations.incomplete.title')}</h2>
                <p className={styles.sectionHint}>{t('operations.incomplete.hint')}</p>
              </div>
            </div>
            <ServiceRows items={incomplete} empty={t('operations.incomplete.empty')} />
          </article>
        </div>

        <aside className={styles.decisionRail}>
          <article className={styles.railCard}>
            <h2 className={styles.railTitle}>{t('operations.top_completeness.title')}</h2>
            <ServiceRows items={data.sections.top_completeness} empty={t('operations.no_data')} />
          </article>

          <article className={styles.railCard}>
            <h2 className={styles.railTitle}>{t('operations.lifecycle.title')}</h2>
            <ServiceRows items={data.sections.deprecated_retired} empty={t('operations.lifecycle.empty')} />
          </article>

          <article className={styles.railCard}>
            <h2 className={styles.railTitle}>{t('operations.c3_gap.title')}</h2>
            <CoverageMetricRows rows={c3CoverageRows.slice(0, 5)} empty={t('operations.c3_gap.empty')} />
          </article>
        </aside>
      </section>}

      {activeTab === 'pricing' && <section className={styles.decisionLayout}>
        <div className={styles.decisionMain}>
          <article className={styles.decisionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.cardTitle}>{t('operations.pricing.title')}</h2>
                <p className={styles.sectionHint}>{t('operations.pricing.hint')}</p>
              </div>
            </div>
            <div className={styles.kpiThree}>
              <KpiCard label={t('operations.pricing.coverage')} value={`${pricing.coverage_percent}%`} hint={`${pricing.with_pricing}/${pricing.total_services} ${t('operations.services')}`} />
              <KpiCard label={t('operations.pricing.missing')} value={pricing.missing.length} hint={t('operations.pricing.missing_hint')} />
              <KpiCard label={t('operations.pricing.decision')} value={pricing.missing.length ? t('operations.review') : t('operations.clean')} hint={t('operations.pricing.decision_hint')} />
            </div>
            <CoverageMetricRows rows={pricingCoverageRows} empty={t('operations.pricing.empty')} />
            <ServiceRows items={pricing.missing} empty={t('operations.pricing.empty')} />
          </article>
        </div>
        <aside className={styles.decisionRail}>
          <GovernancePanel title={t('operations.governance.contract.title')} hint={t('operations.governance.contract.hint')} count={contractItems.length}>
            {contractOverlap.isLoading && contractItems.length === 0 ? <PanelState label={t('operations.governance.loading')} /> : <ContractRows items={contractItems} empty={t('operations.governance.contract.empty')} />}
          </GovernancePanel>
          <GovernancePanel title={t('operations.governance.renewal.title')} hint={t('operations.governance.renewal.hint')} count={renewalItems.length}>
            {renewalCalendar.isLoading && renewalItems.length === 0 ? <PanelState label={t('operations.governance.loading')} /> : <RenewalRows items={renewalItems} empty={t('operations.governance.renewal.empty')} />}
          </GovernancePanel>
        </aside>
      </section>}

      {activeTab === 'owners' && <section className={styles.decisionLayout}>
        <div className={styles.decisionMain}>
          <article className={styles.decisionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.cardTitle}>{t('operations.owners.title')}</h2>
                <p className={styles.sectionHint}>{t('operations.kpi.owner_hint')}</p>
              </div>
            </div>
            {missingOwners.length === 0 ? (
              <EmptyState title={t('operations.owners.empty')} />
            ) : (
              <div className={styles.auditList}>
                {missingOwners.map((service) => (
                  <Link key={service.service_id} href={`/services/${service.service_id}/edit`} className={styles.queueRowLink}>
                    <span>
                      <strong>{service.title}</strong>
                      <small>{service.service_id}</small>
                    </span>
                    <Badge variant="warning">{t('operations.owner_missing')}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </div>
        <aside className={styles.decisionRail}>
          <GovernancePanel title={t('operations.governance.owner.title')} hint={t('operations.governance.owner.hint')} count={ownerItems.length}>
            {ownerLoad.isLoading && ownerItems.length === 0 ? <PanelState label={t('operations.governance.loading')} /> : <OwnerRows items={ownerItems} empty={t('operations.governance.owner.empty')} />}
          </GovernancePanel>
        </aside>
      </section>}

      {activeTab === 'c3' && <section className={styles.decisionLayout}>
        <div className={styles.decisionMain}>
          <article className={styles.decisionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.cardTitle}>{t('operations.c3_gap.title')}</h2>
                <p className={styles.sectionHint}>{t('operations.kpi.c3_hint')}</p>
              </div>
              <Link href="/c3/dashboard" className={styles.secondaryLink}>C3 dashboard</Link>
            </div>
            <CoverageMetricRows rows={c3CoverageRows} empty={t('operations.c3_gap.empty')} />
          </article>
        </div>
        <aside className={styles.decisionRail}>
          <GovernancePanel title={t('operations.governance.risk.title')} hint={t('operations.governance.risk.hint')} count={riskItems.length}>
            {riskRadar.isLoading && riskItems.length === 0 ? <PanelState label={t('operations.governance.loading')} /> : <RiskRows items={riskItems} empty={t('operations.governance.risk.empty')} />}
          </GovernancePanel>
          <GovernancePanel title={t('operations.governance.advisor.title')} hint={t('operations.governance.advisor.hint')} count={advisorItems.length}>
            {advisor.isLoading && advisorItems.length === 0 ? <PanelState label={t('operations.governance.loading')} /> : <AdvisorRows items={advisorItems} empty={t('operations.governance.advisor.empty')} />}
          </GovernancePanel>
        </aside>
      </section>}
    </main>
  );
}
