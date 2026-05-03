'use client';

import type { ReactNode } from 'react';
import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { useSearchParams } from 'next/navigation';
import { Badge, EmptyState, KpiCard, ProgressBar } from '@/design-system/controls';
import type { BadgeVariant } from '@/design-system/controls';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ScatterChart, Scatter,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useDashboardSummary, useOperationsDashboard, useCompleteness } from '@/features/services/hooks/useServices';
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
import cockpitStyles from './operations.module.css';
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
  { key: 'governance', labelKey: 'operations.tabs.governance', href: '/operations' },
  { key: 'health', labelKey: 'common.health', href: '/operations?tab=health' },
  { key: 'pricing', labelKey: 'operations.tabs.pricing', href: '/operations?tab=pricing' },
  { key: 'owners', labelKey: 'operations.tabs.owners', href: '/operations?tab=owners' },
  { key: 'c3', labelKey: 'operations.tabs.c3', href: '/operations?tab=c3' },
];

const DEFAULT_SUMMARY_LINKS = {
  governance_health: '/operations?tab=health',
  readiness_queue: '/operations/readiness',
  capability_coverage: '/capabilities/coverage',
  review_deadlines: '/operations/reviews',
  owner_load: '/operations/owner-load',
  recent_decisions: '/operations/decisions',
};

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

// ── Chart colour constants (no CSS vars — recharts / SVG need hex) ─────────
const CHART_COLORS = {
  active:     '#1D9E75',
  draft:      '#378ADD',
  deprecated: '#EF9F27',
  retired:    '#888780',
  success:    '#1D9E75',
  warning:    '#EF9F27',
  danger:     '#E24B4A',
  info:       '#378ADD',
  neutral:    '#B4B2A9',
};

const STATUS_COLORS: Record<string, string> = {
  active:     CHART_COLORS.active,
  live:       CHART_COLORS.active,
  draft:      CHART_COLORS.draft,
  deprecated: CHART_COLORS.deprecated,
  retired:    CHART_COLORS.retired,
  planned:    CHART_COLORS.info,
};

const RECORD_AGE_REFERENCE_TIME = Date.now();
const RECORD_AGE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// ── Catalogue health gauge — custom SVG arc ──────────────────────────────
function CatalogueHealthGauge({ services }: { services: CompletenessItem[] }) {
  if (services.length === 0) return null;

  const ready      = services.filter(s => (s.completeness_score ?? 0) >= 80).length;
  const incomplete = services.filter(s => { const sc = s.completeness_score ?? 0; return sc >= 50 && sc < 80; }).length;
  const blocked    = services.filter(s => (s.completeness_score ?? 0) < 50).length;
  const total      = services.length;

  const cx = 100, cy = 100, r = 68, sw = 13;
  const START_DEG = 198, TOTAL_DEG = 144, GAP_DEG = 3;

  function toXY(deg: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcD(startDeg: number, endDeg: number): string {
    const s = toXY(startDeg);
    const e = toXY(endDeg);
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${(endDeg - startDeg) > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  }

  const segs = [
    { value: ready,      color: CHART_COLORS.active    },
    { value: incomplete, color: CHART_COLORS.deprecated },
    { value: blocked,    color: CHART_COLORS.danger     },
  ];

  const healthPct = Math.round((ready / total) * 100);
  let rawDeg = START_DEG;

  const arcPaths = segs.map((seg, i) => {
    const sweep = (seg.value / total) * TOTAL_DEG;
    const s = rawDeg + (i === 0 ? 0 : GAP_DEG / 2);
    const e = rawDeg + sweep - (i === segs.length - 1 ? 0 : GAP_DEG / 2);
    rawDeg += sweep;
    if (seg.value === 0 || e - s < 1) return null;
    return <path key={i} d={arcD(s, e)} fill="none" stroke={seg.color} strokeWidth={sw} strokeLinecap="round" />;
  });

  return (
    <svg viewBox="15 25 170 135" style={{ width: '100%', height: '100%' }} role="img"
      aria-label={`Catalogue health: ${healthPct}% of services are ready`}>
      <path d={arcD(START_DEG, START_DEG + TOTAL_DEG)} fill="none"
        stroke="rgba(128,128,128,0.15)" strokeWidth={sw} strokeLinecap="round" />
      {arcPaths}
      <text x={cx} y={cy + 10} textAnchor="middle"
        style={{ fontSize: 28, fontWeight: 500, fill: 'var(--color-text-primary)' } as React.CSSProperties}>
        {healthPct}%
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle"
        style={{ fontSize: 10, fill: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' } as React.CSSProperties}>
        health score
      </text>
    </svg>
  );
}

// ── Completeness vs. record age — scatter ────────────────────────────────
interface ScatterPoint { x: number; y: number; name: string }

function CompletenessScatterChart({ services }: { services: CompletenessItem[] }) {
  if (services.length === 0) return null;

  const groups: Record<string, ScatterPoint[]> = {};

  services.forEach(s => {
    const ageMonths = Math.round((RECORD_AGE_REFERENCE_TIME - new Date(s.updated_at).getTime()) / RECORD_AGE_MONTH_MS);
    const key = s.service_status ?? 'draft';
    if (!groups[key]) groups[key] = [];
    groups[key].push({ x: Math.min(ageMonths, 60), y: s.completeness_score ?? 0, name: s.title });
  });

  const entries = Object.entries(groups);
  if (entries.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart margin={{ top: 8, right: 8, left: -12, bottom: 22 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,.1)" />
        <XAxis dataKey="x" type="number" name="Stáří (měs.)" domain={[0, 60]}
          tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
          label={{ value: 'Stáří záznamu (měsíce)', position: 'insideBottom', offset: -12,
            style: { fontSize: 10, fill: 'rgba(128,128,128,.7)' } }} />
        <YAxis dataKey="y" type="number" name="Completeness %" domain={[0, 100]}
          tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid rgba(128,128,128,.2)' }}
          cursor={{ strokeDasharray: '3 3' }} />
        {entries.map(([status, pts]) => (
          <Scatter key={status} name={status} data={pts}
            fill={STATUS_COLORS[status] ?? CHART_COLORS.neutral} fillOpacity={0.75} r={4} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function C3CoverageBarChart({ rows }: { rows: Array<{ label: string; value: number; total: number }> }) {
  const data = rows.map(r => ({
    name: r.label.length > 14 ? `${r.label.slice(0, 14)}…` : r.label,
    mapped: r.value,
    gap: Math.max(0, r.total - r.value),
  }));

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36 + 60)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,.12)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
        <Bar dataKey="mapped" fill={CHART_COLORS.active} radius={[0, 2, 2, 0]} stackId="a" />
        <Bar dataKey="gap"    fill={CHART_COLORS.deprecated} radius={[0, 2, 2, 0]} stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  );
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

function formatCount(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('en-US');
}

function CockpitSignal({
  title,
  value,
  detail,
  href,
  tone = 'neutral',
}: {
  title: string;
  value: string;
  detail: string;
  href: string;
  tone?: 'neutral' | 'good' | 'warn' | 'danger';
}) {
  return (
    <Link href={href} className={`${cockpitStyles.signalCard} ${cockpitStyles[`signal_${tone}`]}`}>
      <span className={cockpitStyles.signalLabel}>{title}</span>
      <strong>{value}</strong>
      <span>{detail}</span>
    </Link>
  );
}

export default function OperationsPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const cockpit = useDashboardSummary();
  const { data, isLoading, error } = useOperationsDashboard();
  const riskRadar = useServiceRiskRadar({ limit: 5 });
  const ownerLoad = useOwnerLoad({ limit: 5 });
  const contractOverlap = useContractOverlap({ limit: 5 });
  const renewalCalendar = useRenewalCalendar({ limit: 5 });
  const advisor = useGovernanceAdvisor({ limit: 5 });
  const completenessData = useCompleteness();

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
  const summary = cockpit.data?.summary;
  const summaryLinks = cockpit.data?.links ?? DEFAULT_SUMMARY_LINKS;
  const governanceError = riskRadar.error || ownerLoad.error || contractOverlap.error || renewalCalendar.error || advisor.error;
  const requestedTab = searchParams?.get('tab') as OperationsTab | null;
  const activeTab = OPERATIONS_TABS.some((tab) => tab.key === requestedTab) ? requestedTab! : 'governance';
  // Chart data — derived from completeness endpoint (service_status, lifecycle_state)
  const allServices = Array.isArray(completenessData.data) ? completenessData.data : [];
  // Unique statuses with counts for legend
  const statusCounts = allServices.reduce<Record<string, number>>((acc, s) => {
    const k = s.service_status ?? 'draft';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
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
      <PageHeader
        title={t('operations.title')}
        purpose={t('operations.lead')}
        chips={[
          { label: t('operations.badge.governance'), tone: 'neutral' },
          { label: t('operations.badge.evidence'),   tone: 'neutral' },
        ]}
        primaryAction={{ label: 'Readiness', href: '/operations/readiness' }}
      />

      <section className={cockpitStyles.cockpitSummary} aria-label="Decision cockpit summary">
        <div className={cockpitStyles.cockpitIntro}>
          <span className={styles.pageEyebrow}>Governance state</span>
          <h2>Governance signals</h2>
          <p>Ownership, readiness, capability coverage, review pressure, and decision activity in one operational view.</p>
        </div>
        <div className={cockpitStyles.signalGrid}>
          <CockpitSignal
            title="Governance Health"
            value={`${formatCount(summary?.services_ready_for_publish)}/${formatCount(summary?.total_services)}`}
            detail="services ready for publish"
            href={summaryLinks.governance_health}
            tone={summary?.services_blocked_by_readiness ? 'warn' : 'good'}
          />
          <CockpitSignal
            title="Readiness Queue"
            value={formatCount(summary?.services_blocked_by_readiness)}
            detail="services blocked by readiness"
            href={summaryLinks.readiness_queue}
            tone={summary?.services_blocked_by_readiness ? 'danger' : 'good'}
          />
          <CockpitSignal
            title="Capability Coverage"
            value={`${formatCount(summary?.uncovered_capabilities)} / ${formatCount(summary?.over_covered_capabilities)}`}
            detail="uncovered / over-covered capabilities"
            href={summaryLinks.capability_coverage}
            tone={(summary?.uncovered_capabilities ?? 0) > 0 ? 'warn' : 'good'}
          />
          <CockpitSignal
            title="Review Deadlines"
            value={`${formatCount(summary?.overdue_reviews)} / ${formatCount(summary?.active_governance_reviews)}`}
            detail="overdue / active reviews"
            href={summaryLinks.review_deadlines}
            tone={(summary?.overdue_reviews ?? 0) > 0 ? 'danger' : 'neutral'}
          />
          <CockpitSignal
            title="Owner Load"
            value={formatCount(ownerItems.length)}
            detail="owners with load signals"
            href={summaryLinks.owner_load}
            tone={ownerItems.some((item) => item.owner_load_score >= 80) ? 'danger' : ownerItems.length ? 'warn' : 'good'}
          />
          <CockpitSignal
            title="Recent Decisions"
            value={formatCount(summary?.recent_decisions)}
            detail="latest governance decisions"
            href={summaryLinks.recent_decisions}
            tone={(summary?.recent_decisions ?? 0) > 0 ? 'neutral' : 'warn'}
          />
        </div>
      </section>

      <section className={styles.kpiThree} aria-label="Operations headline KPIs">
        <KpiCard
          label={t('operations.kpi.metadata')}
          value={incomplete.length}
          tone={incomplete.length ? 'warning' : 'success'}
          trend={incomplete.length ? 'down' : 'neutral'}
          hint={<span className={styles.kpiHint}><Badge variant={incomplete.length ? 'warning' : 'success'}>{incomplete.length ? t('common.action') : t('common.clean')}</Badge><span>{t('operations.kpi.metadata_hint')}</span></span>}
        />
        <KpiCard
          label={t('operations.kpi.owner_gaps')}
          value={missingOwners.length}
          tone={missingOwners.length ? 'danger' : 'success'}
          trend={missingOwners.length ? 'down' : 'neutral'}
          hint={<span className={styles.kpiHint}><Badge variant={missingOwners.length ? 'warning' : 'success'}>{missingOwners.length ? t('operations.assign') : t('operations.covered')}</Badge><span>{t('operations.kpi.owner_hint')}</span></span>}
        />
        <KpiCard
          label={t('operations.kpi.c3_gaps')}
          value={c3GapTotal}
          tone={c3GapTotal ? 'warning' : 'success'}
          hint={<span className={styles.kpiHint}><Badge variant={c3GapTotal ? 'warning' : 'success'}>{c3GapTotal ? t('operations.map') : t('operations.covered')}</Badge><span>{t('operations.kpi.c3_hint')}</span></span>}
        />
      </section>

      {/* ── Chart overview row — catalogue health gauge + completeness scatter ─ */}
      {allServices.length > 0 && (
        <section className={cockpitStyles.chartsRow} aria-label="Catalogue health overview">
          <div className={cockpitStyles.chartCard}>
            <h2 className={cockpitStyles.chartTitle}>Catalogue health</h2>
            <p className={cockpitStyles.chartHint}>Podíl služeb dle completeness score (ready / incomplete / blocked)</p>
            <div className={cockpitStyles.chartWrap}>
              <CatalogueHealthGauge services={allServices} />
            </div>
            <div className={cockpitStyles.chartLegend}>
              <span className={cockpitStyles.chartLegendItem}>
                <span className={cockpitStyles.chartLegendDot} style={{ background: CHART_COLORS.active }} />
                Ready (≥80%) {allServices.filter(s => (s.completeness_score ?? 0) >= 80).length}
              </span>
              <span className={cockpitStyles.chartLegendItem}>
                <span className={cockpitStyles.chartLegendDot} style={{ background: CHART_COLORS.deprecated }} />
                Incomplete (50–79%) {allServices.filter(s => { const sc = s.completeness_score ?? 0; return sc >= 50 && sc < 80; }).length}
              </span>
              <span className={cockpitStyles.chartLegendItem}>
                <span className={cockpitStyles.chartLegendDot} style={{ background: CHART_COLORS.danger }} />
                Blocked (&lt;50%) {allServices.filter(s => (s.completeness_score ?? 0) < 50).length}
              </span>
            </div>
          </div>
          <div className={cockpitStyles.chartCard}>
            <h2 className={cockpitStyles.chartTitle}>Completeness vs. stáří záznamu</h2>
            <p className={cockpitStyles.chartHint}>Outliers: staré záznamy s nízkým skóre potřebují pozornost</p>
            <div className={cockpitStyles.chartWrap}>
              <CompletenessScatterChart services={allServices} />
            </div>
            <div className={cockpitStyles.chartLegend}>
              {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([status, count]) => (
                <span key={status} className={cockpitStyles.chartLegendItem}>
                  <span className={cockpitStyles.chartLegendDot} style={{ background: STATUS_COLORS[status] ?? CHART_COLORS.neutral }} />
                  {status} {count}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

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
            <div className={cockpitStyles.grid3} style={{ marginBottom: 0 }}>
              <KpiCard
                label={t('operations.insight.pricing')}
                value={`${pricing.coverage_percent}%`}
                tone={pricing.coverage_percent >= 80 ? 'success' : pricing.coverage_percent >= 50 ? 'warning' : 'danger'}
                hint={`${pricing.with_pricing} / ${pricing.total_services} services`}
              />
              <KpiCard
                label={t('operations.insight.references')}
                value={data.sections.top_completeness.length}
                tone="info"
                hint="Services with high completeness"
              />
              <KpiCard
                label={t('operations.insight.lifecycle')}
                value={data.sections.deprecated_retired.length}
                tone={data.sections.deprecated_retired.length ? 'warning' : 'success'}
                hint="Deprecated or retired services"
              />
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
            {c3CoverageRows.length > 0 ? (
              <>
                <C3CoverageBarChart rows={c3CoverageRows.slice(0, 6)} />
                <div className={cockpitStyles.chartLegend} style={{ marginTop: 'var(--space-2)' }}>
                  <span className={cockpitStyles.chartLegendItem}>
                    <span className={cockpitStyles.chartLegendDot} style={{ background: CHART_COLORS.active }} />
                    Mapped
                  </span>
                  <span className={cockpitStyles.chartLegendItem}>
                    <span className={cockpitStyles.chartLegendDot} style={{ background: CHART_COLORS.deprecated }} />
                    Gap
                  </span>
                </div>
              </>
            ) : (
              <CoverageMetricRows rows={c3CoverageRows.slice(0, 5)} empty={t('operations.c3_gap.empty')} />
            )}
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
