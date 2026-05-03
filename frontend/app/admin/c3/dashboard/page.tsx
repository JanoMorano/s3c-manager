/**
 * C3 Dashboard — capability/data governance cockpit aligned with Catalogue + Operations.
 */
'use client';

import Link from '@/app/components/AppLink';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Badge, EmptyState, KpiCard, ProgressBar } from '@/design-system/controls';
import { useLocale, useT, type I18nContextValue } from '@/app/i18n/useI18n';
import { apiFetch } from '@/features/services/api/services.api';
import dashboardStyles from '../../../dashboard/dashboard.module.css';
import C3Breadcrumbs from '../../../components/C3Breadcrumbs';

interface CountRow { name: string; value: number }
interface CoverageRow extends CountRow { mapped: number }
interface SpiralCoverageRow extends CountRow { mapped: number; unmapped: number }
interface ItemRow { uuid: string; title: string | null; item_type?: string | null; mapping_count?: number }
interface BoardLaneRow {
  board_state: 'imported' | 'validated' | 'mapped' | 'used' | 'reviewed' | string;
  value: number;
  cards: Array<{ uuid: string; title: string | null; item_type?: string | null; validation_status?: string | null }>;
}
interface CapabilityMapHealth { total_nodes: number; mapped_nodes: number; unmapped_nodes: number }
interface ImportSyncDrift {
  latest_import_target: string | null;
  latest_import_source: string | null;
  latest_import_at: string | null;
  latest_import_row_count: number;
  latest_import_change_count: number;
  latest_sync_at: string | null;
  stale_mapping_count: number;
  unsynced_mapping_count: number;
}
interface C3DashboardResponse {
  summary: { total_items: number; mapped_items: number; unmapped_items: number; total_mappings: number; item_type_count: number; application_count: number };
  by_status: CountRow[];
  by_type: CountRow[];
  by_application: CountRow[];
  top_parents: CountRow[];
  needs_mapping: ItemRow[];
  most_mapped: ItemRow[];
  coverage_by_application: CoverageRow[];
  by_sync_status: CountRow[];
  capability_map_health: CapabilityMapHealth;
  spiral_coverage: SpiralCoverageRow[];
  import_sync_drift: ImportSyncDrift;
  link_health: CountRow[];
  review_validation: CountRow[];
  board_lanes?: BoardLaneRow[];
}
interface ExportManifestResponse { contract_version: string; schema_version: string }

type DashboardTab = 'overview' | 'health' | 'mappings' | 'imports' | 'review';
type TFunction = I18nContextValue['t'];

const TABS: Array<{ key: DashboardTab; labelKey: string }> = [
  { key: 'overview', labelKey: 'c3.dashboard.tabs.overview' },
  { key: 'health', labelKey: 'c3.dashboard.tabs.health' },
  { key: 'mappings', labelKey: 'c3.dashboard.tabs.mappings' },
  { key: 'imports', labelKey: 'c3.dashboard.tabs.imports' },
  { key: 'review', labelKey: 'c3.dashboard.tabs.review' },
];

const TYPE_COLORS: Record<string, string> = {
  BP: 'var(--color-warning)', BR: 'var(--color-danger)', CI: 'var(--color-success)',
  CO: 'var(--color-warning)', CR: 'var(--color-domain-relay)', UA: 'var(--color-domain-relay)',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'var(--color-success)', archived: 'var(--color-text-secondary)', draft: 'var(--color-text-muted)',
  pending: 'var(--color-warning)', published: 'var(--color-info)', retired: 'var(--color-text-secondary)', unknown: 'var(--color-text-muted)',
};

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(locale);
}

function formatTargetLabel(value: string | null | undefined) {
  switch (value) {
    case 'applications': return 'Applications';
    case 'data-objects': return 'Data Objects';
    case 'services': return 'Services';
    case 'technology-interactions': return 'Technology Interactions';
    case 'c3-capability-builder': return 'Capability Map';
    case 'capabilities': return 'Capabilities';
    case 'business-processes': return 'Business Processes';
    case 'business-roles': return 'Business Roles';
    case 'information-products': return 'Information Products';
    case 'user-applications': return 'User Applications';
    case 'coi-services': return 'COI Services';
    case 'communications-services': return 'Communications Services';
    case 'core-services': return 'Core Services';
    default: return value || '—';
  }
}

function mappingPercent(data: C3DashboardResponse) {
  return data.summary.total_items > 0 ? Math.round((data.summary.mapped_items / data.summary.total_items) * 100) : 0;
}

function coveragePercent(row: CoverageRow | SpiralCoverageRow) {
  return row.value > 0 ? Math.round((row.mapped / row.value) * 100) : 0;
}

function tabHref(tab: DashboardTab) {
  return tab === 'overview' ? '/c3/dashboard' : `/c3/dashboard?tab=${tab}`;
}

export default function C3DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT();
  const locale = useLocale();
  const activeTab = (searchParams?.get('tab') ?? 'overview') as DashboardTab;
  const [selectedParent, setSelectedParent] = useState<CountRow | null>(null);
  const { data, isLoading, error } = useSWR<C3DashboardResponse>('/api/v1/taxonomy/c3/dashboard', apiFetch, { revalidateOnFocus: false });
  const { data: manifest } = useSWR<ExportManifestResponse>('/api/v1/export/manifest?scope=c3', apiFetch, { revalidateOnFocus: false });

  if (isLoading) return <div className={dashboardStyles.state}>{t('c3.dashboard.loading')}</div>;
  if (error) return <div className={dashboardStyles.stateError}>{t('c3.dashboard.unavailable')}</div>;
  if (!data) return null;

  return (
    <main className={dashboardStyles.shell}>
      <C3Breadcrumbs />
      <div className={dashboardStyles.pageHeader}>
        <div>
          <span className={dashboardStyles.pageEyebrow}>{t('c3.dashboard.eyebrow')}</span>
          <h1 className={dashboardStyles.pageTitle}>{t('c3.dashboard.title')}</h1>
          <p className={dashboardStyles.pageLead}>{t('c3.dashboard.lead')}</p>
        </div>
        <div className={dashboardStyles.headerActions}>
          {manifest?.contract_version && <span className={dashboardStyles.cachedBadge}>{t('c3.dashboard.contract')} {manifest.contract_version}</span>}
          {manifest?.schema_version && <span className={dashboardStyles.cachedBadge}>{t('c3.dashboard.schema')} {manifest.schema_version}</span>}
          <Link href="/api/v1/export/manifest" className={dashboardStyles.secondaryLink}>{t('c3.dashboard.export_manifest')}</Link>
        </div>
      </div>

      <C3RelationshipBoard data={data} locale={locale} />
      <C3BoardKanban data={data} locale={locale} />

      <section className={dashboardStyles.kpiThree} aria-label="C3 headline KPIs">
        <KpiCard label={t('c3.dashboard.kpi.items')} value={data.summary.total_items.toLocaleString(locale)} hint={t('c3.dashboard.kpi.item_types', { count: data.summary.item_type_count })} />
        <KpiCard label={t('c3.dashboard.kpi.mapped')} value={`${mappingPercent(data)}%`} hint={<span className={dashboardStyles.kpiHint}><Badge variant="success">{data.summary.mapped_items}</Badge><span>{t('c3.dashboard.kpi.mappings', { count: data.summary.total_mappings })}</span></span>} />
        <KpiCard label={t('c3.dashboard.kpi.needs_mapping')} value={data.summary.unmapped_items.toLocaleString(locale)} hint={<span className={dashboardStyles.kpiHint}><Badge variant={data.summary.unmapped_items ? 'warning' : 'success'}>{data.summary.unmapped_items ? t('common.action') : t('common.clean')}</Badge><span>{t('c3.dashboard.kpi.queued', { count: data.needs_mapping.length })}</span></span>} />
      </section>

      <nav className={dashboardStyles.tabs} aria-label="C3 dashboard sections">
        {TABS.map((tab) => <Link key={tab.key} href={tabHref(tab.key)} className={`${dashboardStyles.tab} ${activeTab === tab.key ? dashboardStyles.tabActive : ''}`}>{t(tab.labelKey)}</Link>)}
      </nav>

      {activeTab === 'overview' && (
        <>
          <Overview data={data} router={router} t={t} onSelectParent={setSelectedParent} />
          <GraphConcepts data={data} t={t} />
        </>
      )}
      {activeTab === 'health' && <Health data={data} router={router} t={t} />}
      {activeTab === 'mappings' && <Mappings data={data} t={t} />}
      {activeTab === 'imports' && <Imports data={data} t={t} locale={locale} />}
      {activeTab === 'review' && <Review data={data} t={t} />}
      {selectedParent && <ParentCapabilityDialog parent={selectedParent} onClose={() => setSelectedParent(null)} />}
    </main>
  );
}

function C3RelationshipBoard({ data, locale }: { data: C3DashboardResponse; locale: string }) {
  const mappedPercent = mappingPercent(data);
  const drift = data.import_sync_drift;
  const reviewFindings = data.review_validation.reduce((sum, row) => sum + row.value, 0);
  const linkFindings = data.link_health.reduce((sum, row) => sum + row.value, 0);
  const syncFindings = drift.stale_mapping_count + drift.unsynced_mapping_count;
  const taskRows = [
    {
      tone: mappedPercent >= 80 ? 'success' : mappedPercent >= 50 ? 'warning' : 'danger',
      title: 'Map coverage',
      detail: `${data.summary.mapped_items.toLocaleString(locale)} of ${data.summary.total_items.toLocaleString(locale)} C3 items are connected to evidence.`,
      href: '/c3/list',
      label: 'Open C3 list',
    },
    {
      tone: data.summary.unmapped_items ? 'warning' : 'success',
      title: data.summary.unmapped_items ? 'Unmapped items need an owner' : 'No unmapped queue',
      detail: data.summary.unmapped_items
        ? `${data.summary.unmapped_items.toLocaleString(locale)} items still need service, application, or data evidence.`
        : 'Every imported item has at least one visible mapping.',
      href: '/c3/list',
      label: 'Triage',
    },
    {
      tone: syncFindings ? 'warning' : 'success',
      title: syncFindings ? 'Import sync drift' : 'Import and sync are aligned',
      detail: syncFindings
        ? `${drift.stale_mapping_count} stale and ${drift.unsynced_mapping_count} unsynced mapping records need review.`
        : `Latest import: ${formatDateTime(drift.latest_import_at, locale)}.`,
      href: '/c3/dashboard?tab=imports',
      label: 'Review import',
    },
    {
      tone: reviewFindings + linkFindings ? 'warning' : 'success',
      title: reviewFindings + linkFindings ? 'Validation findings' : 'Validation clean',
      detail: `${reviewFindings} review findings and ${linkFindings} link findings are visible to managers.`,
      href: '/c3/dashboard?tab=review',
      label: 'Open review',
    },
  ];
  const flowNodes = [
    { label: 'Imported item', value: data.needs_mapping[0]?.title ?? data.most_mapped[0]?.title ?? 'C3 item' },
    { label: 'Capability parent', value: data.top_parents[0]?.name ?? 'Capability group' },
    { label: 'Evidence', value: data.most_mapped[0]?.title ?? data.coverage_by_application[0]?.name ?? 'Service or application' },
    { label: 'Spiral', value: data.spiral_coverage[0]?.name ?? 'FMN spiral' },
  ];

  return (
    <section className={dashboardStyles.relationshipBoard} aria-label="C3 relationship board">
      <div className={dashboardStyles.relationshipSummary}>
        <span className={dashboardStyles.pageEyebrow}>C3 board</span>
        <h2>One place to understand what C3 covers and what still needs evidence.</h2>
        <p>
          This board translates imported C3 taxonomy into admin work: map missing items,
          check stale links, and show managers where capabilities are backed by services,
          applications, and data.
        </p>
        <div className={dashboardStyles.relationshipMetricGrid}>
          <BoardMetric value={`${mappedPercent}%`} label="Mapped" detail={`${data.summary.total_mappings.toLocaleString(locale)} mappings`} tone={mappedPercent >= 80 ? 'success' : mappedPercent >= 50 ? 'warning' : 'danger'} />
          <BoardMetric value={data.summary.unmapped_items.toLocaleString(locale)} label="Needs evidence" detail={`${data.needs_mapping.length} queued examples`} tone={data.summary.unmapped_items ? 'warning' : 'success'} />
          <BoardMetric value={syncFindings.toLocaleString(locale)} label="Sync issues" detail={formatTargetLabel(drift.latest_import_target)} tone={syncFindings ? 'warning' : 'success'} />
        </div>
      </div>

      <div className={dashboardStyles.relationshipQueue}>
        <div className={dashboardStyles.relationshipPanelHeader}>
          <div>
            <span className={dashboardStyles.pageEyebrow}>Admin decisions</span>
            <h3>Do this next</h3>
          </div>
          <Badge variant={data.summary.unmapped_items ? 'warning' : 'success'}>{data.summary.unmapped_items ? 'Action' : 'Clean'}</Badge>
        </div>
        <div className={dashboardStyles.relationshipTaskList}>
          {taskRows.map((task) => (
            <Link key={task.title} href={task.href} className={dashboardStyles.relationshipTask}>
              <span className={`${dashboardStyles.relationshipDot} ${dashboardStyles[`relationshipDot_${task.tone}`]}`} />
              <span>
                <strong>{task.title}</strong>
                <small>{task.detail}</small>
              </span>
              <em>{task.label}</em>
            </Link>
          ))}
        </div>
      </div>

      <div className={dashboardStyles.relationshipFlow}>
        <div className={dashboardStyles.relationshipPanelHeader}>
          <div>
            <span className={dashboardStyles.pageEyebrow}>Manager story</span>
            <h3>From taxonomy to impact</h3>
          </div>
          <span className={dashboardStyles.cachedBadge}>{data.summary.application_count.toLocaleString(locale)} apps</span>
        </div>
        <div className={dashboardStyles.relationshipFlowGrid}>
          {flowNodes.map((node) => (
            <div key={node.label} className={dashboardStyles.relationshipFlowNode}>
              <span>{node.label}</span>
              <strong>{node.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function C3BoardKanban({ data, locale }: { data: C3DashboardResponse; locale: string }) {
  const boardLaneByState = new Map((data.board_lanes ?? []).map((lane) => [lane.board_state, lane]));
  const managedLanes = [
    { state: 'imported', title: 'Imported', fallbackCount: data.summary.total_items },
    { state: 'validated', title: 'Validated', fallbackCount: data.summary.total_items - data.import_sync_drift.unsynced_mapping_count },
    { state: 'mapped', title: 'Mapped', fallbackCount: data.summary.mapped_items },
    { state: 'used', title: 'Used by service', fallbackCount: data.coverage_by_application.reduce((sum, item) => sum + item.mapped, 0) },
    { state: 'reviewed', title: 'Reviewed', fallbackCount: data.review_validation.reduce((sum, item) => sum + item.value, 0) },
  ];
  const lanes = data.board_lanes?.length ? managedLanes.map((lane) => {
    const source = boardLaneByState.get(lane.state);
    return {
      title: lane.title,
      count: source?.value ?? lane.fallbackCount,
      cards: (source?.cards ?? []).map((item) => ({
        title: item.title ?? item.uuid,
        meta: `${item.item_type ?? 'C3'} · ${item.validation_status ?? lane.state}`,
        href: `/c3/${item.uuid}`,
      })),
    };
  }) : [
    {
      title: 'Imported',
      count: data.summary.total_items,
      cards: data.needs_mapping.slice(0, 4).map((item) => ({
        title: item.title ?? item.uuid,
        meta: `${item.item_type ?? 'C3'} · needs mapping`,
        href: `/c3/${item.uuid}`,
      })),
    },
    {
      title: 'Validated',
      count: data.summary.total_items - data.import_sync_drift.unsynced_mapping_count,
      cards: data.by_status.slice(0, 4).map((item) => ({
        title: item.name,
        meta: `${item.value.toLocaleString(locale)} records by status`,
        href: `/c3/list?status=${encodeURIComponent(item.name)}`,
      })),
    },
    {
      title: 'Mapped',
      count: data.summary.mapped_items,
      cards: data.most_mapped.slice(0, 4).map((item) => ({
        title: item.title ?? item.uuid,
        meta: `${item.mapping_count ?? 0} mappings`,
        href: `/c3/${item.uuid}`,
      })),
    },
    {
      title: 'Used by service',
      count: data.coverage_by_application.reduce((sum, item) => sum + item.mapped, 0),
      cards: data.coverage_by_application.slice(0, 4).map((item) => ({
        title: item.name,
        meta: `${item.mapped}/${item.value} mapped`,
        href: `/c3/list?application=${encodeURIComponent(item.name)}`,
      })),
    },
    {
      title: 'Reviewed',
      count: data.review_validation.reduce((sum, item) => sum + item.value, 0),
      cards: data.review_validation.slice(0, 4).map((item) => ({
        title: item.name,
        meta: `${item.value.toLocaleString(locale)} validation findings`,
        href: '/c3/dashboard?tab=review',
      })),
    },
  ];

  return (
    <section className={dashboardStyles.c3KanbanSection} aria-label="C3 Board status lanes">
      <div className={dashboardStyles.decisionCardHeader}>
        <div>
          <h2 className={dashboardStyles.decisionTitle}>C3 Board</h2>
          <p className={dashboardStyles.decisionLead}>Imported to Validated to Mapped to Used by service to Reviewed.</p>
        </div>
        <Link href="/admin/new-c3" className={dashboardStyles.secondaryLink}>New C3 item</Link>
      </div>
      <div className={dashboardStyles.c3Kanban}>
        {lanes.map((lane) => (
          <article key={lane.title} className={dashboardStyles.c3Lane}>
            <h3>
              <span>{lane.title}</span>
              <strong>{lane.count.toLocaleString(locale)}</strong>
            </h3>
            <div className={dashboardStyles.c3LaneCards}>
              {lane.cards.length ? lane.cards.map((card) => (
                <Link key={`${lane.title}-${card.title}`} href={card.href} className={dashboardStyles.c3LaneCard}>
                  <strong>{card.title}</strong>
                  <span>{card.meta}</span>
                </Link>
              )) : (
                <p className={dashboardStyles.c3LaneEmpty}>No items in this lane.</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function BoardMetric({ value, label, detail, tone }: { value: string; label: string; detail: string; tone: 'success' | 'warning' | 'danger' }) {
  return (
    <div className={`${dashboardStyles.relationshipMetric} ${dashboardStyles[`relationshipMetric_${tone}`]}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}

function GraphConcepts({ data, t }: { data: C3DashboardResponse; t: TFunction }) {
  const services = (data.coverage_by_application.length ? data.coverage_by_application : data.by_application)
    .slice(0, 4)
    .map((row) => row.name);
  const matrixServices = services.length ? services : [t('c3.dashboard.graph.no_data')];
  const coverageRows = data.coverage_by_application.slice(0, 3);
  const coverageValue = coverageRows.length
    ? Math.round(coverageRows.reduce((sum, row) => sum + coveragePercent(row), 0) / coverageRows.length)
    : mappingPercent(data);
  const flowNodes = [
    { label: t('c3.dashboard.graph.need'), value: data.needs_mapping[0]?.title ?? t('c3.dashboard.graph.mapped_evidence') },
    { label: t('c3.dashboard.graph.business'), value: data.top_parents[0]?.name ?? t('c3.dashboard.graph.capability_group') },
    { label: t('c3.dashboard.graph.service'), value: data.most_mapped[0]?.title ?? services[0] ?? t('c3.dashboard.graph.service_evidence') },
    { label: 'C3 CP', value: data.by_type.find((row) => row.name === 'CP')?.name ?? 'CP' },
    { label: t('c3.dashboard.graph.fmn'), value: data.spiral_coverage[0]?.name ?? t('c3.dashboard.graph.spiral_evidence') },
  ];
  return (
    <section className={dashboardStyles.decisionCard} aria-label="Graph concept previews">
      <div className={dashboardStyles.decisionCardHeader}>
        <div>
          <h2 className={dashboardStyles.decisionTitle}>{t('c3.dashboard.graph.title')}</h2>
          <p className={dashboardStyles.decisionLead}>{t('c3.dashboard.graph.lead')}</p>
        </div>
        <Badge variant="info">{t('c3.dashboard.graph.badge')}</Badge>
      </div>
      <div className={dashboardStyles.dashboardGrid}>
        <article className={dashboardStyles.insightTile}>
          <strong>{t('c3.dashboard.graph.coverage')}</strong>
          <div className={dashboardStyles.graphPreviewGrid}>
            <div className={dashboardStyles.coverageRing}><span className={dashboardStyles.coverageRingInner}>{coverageValue}%</span></div>
            <div className={dashboardStyles.auditList}>
              {coverageRows.length ? coverageRows.map((row) => {
                const value = coveragePercent(row);
                return <CoverageLine key={row.name} label={row.name} value={value} detail={`${row.mapped}/${row.value}`} />;
              }) : <CoverageLine label={t('c3.dashboard.graph.mapped_evidence')} value={mappingPercent(data)} detail={`${data.summary.mapped_items}/${data.summary.total_items}`} />}
            </div>
          </div>
        </article>
        <article className={dashboardStyles.insightTile}>
          <strong>{t('c3.dashboard.graph.flow')}</strong>
          <div className={dashboardStyles.flowPreview}>
            {flowNodes.map((node) => <div key={node.label} className={dashboardStyles.flowNode}>{node.label}<small>{node.value}</small></div>)}
          </div>
        </article>
        <article className={dashboardStyles.insightTile}>
          <strong>{t('c3.dashboard.graph.matrix')}</strong>
          <div className={dashboardStyles.matrixPreview}>
            <div className={dashboardStyles.matrixRow}>
              <span className={dashboardStyles.matrixHeaderCell}>svc</span>
              {matrixServices.map((service) => <span key={service} className={dashboardStyles.matrixHeaderCell}>{service}</span>)}
            </div>
            {matrixServices.map((row, rowIndex) => (
              <div key={row} className={dashboardStyles.matrixRow}>
                <span className={dashboardStyles.matrixHeaderCell}>{row}</span>
                {matrixServices.map((col, colIndex) => {
                  const rowValue = data.coverage_by_application[rowIndex]?.mapped ?? 0;
                  const colValue = data.coverage_by_application[colIndex]?.mapped ?? 0;
                  const sharedSignal = Math.min(rowValue, colValue);
                  const signal = rowIndex === colIndex ? null : sharedSignal > 10 ? 'high' : sharedSignal > 3 ? 'medium' : sharedSignal > 0 ? 'low' : null;
                  return (
                    <span key={col} className={dashboardStyles.matrixCell}>
                      {signal === 'high' && <i className={dashboardStyles.signalHigh} />}
                      {signal === 'medium' && <i className={dashboardStyles.signalMedium} />}
                      {signal === 'low' && <i className={dashboardStyles.signalLow} />}
                      {!signal && '—'}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function Overview({ data, router, t, onSelectParent }: { data: C3DashboardResponse; router: ReturnType<typeof useRouter>; t: TFunction; onSelectParent: (parent: CountRow) => void }) {
  return (
    <section className={dashboardStyles.dashboardGrid}>
      <ChartCard title={t('c3.dashboard.by_item_type')} hint={t('c3.dashboard.by_item_type_hint')}>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data.by_type} layout="vertical" margin={{ left: 16 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={48} />
            <Tooltip />
            <Bar
              dataKey="value"
              radius={[0, 3, 3, 0]}
              onClick={(entry) => {
                if (entry.name) router.push(`/c3/list?item_type=${encodeURIComponent(entry.name)}`);
              }}
            >
              {data.by_type.map((entry) => <Cell key={entry.name} fill={TYPE_COLORS[entry.name] ?? 'var(--color-text-muted)'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title={t('c3.dashboard.top_parents')} hint={t('c3.dashboard.top_parents_hint')}>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data.top_parents.slice(0, 8)} layout="vertical" margin={{ left: 8 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
            <Tooltip />
            <Bar
              dataKey="value"
              fill="var(--color-domain-zenith)"
              radius={[0, 3, 3, 0]}
              onClick={(entry) => {
                if (entry.name) onSelectParent({ name: entry.name, value: Number(entry.value ?? 0) });
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <QueueCard title={t('c3.dashboard.kpi.needs_mapping')} actionHref="/c3/list" actionLabel={t('c3.dashboard.open_c3_list')}>
        <ItemRows items={data.needs_mapping.slice(0, 8)} empty={t('c3.dashboard.empty.all_mapped')} badge="item_type" />
      </QueueCard>
    </section>
  );
}

function ParentCapabilityDialog({ parent, onClose }: { parent: CountRow; onClose: () => void }) {
  const isRoot = parent.name === '(Kořenové schopnosti)';
  const listHref = `/c3/list?parent=${encodeURIComponent(parent.name)}`;

  return (
    <div className={dashboardStyles.modalBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={dashboardStyles.modalDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-capability-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={dashboardStyles.modalHeader}>
          <div>
            <span className={dashboardStyles.pageEyebrow}>C3 parent drilldown</span>
            <h2 id="parent-capability-dialog-title" className={dashboardStyles.cardTitle}>{parent.name}</h2>
          </div>
          <button type="button" className={dashboardStyles.iconButton} onClick={onClose} aria-label="Zavřít">×</button>
        </div>
        <div className={dashboardStyles.modalBody}>
          <p className={dashboardStyles.sectionHint}>
            {isRoot
              ? 'Kořenové schopnosti jsou položky bez nadřazené capability. Tvoří horní úroveň stromu a často určují hlavní oblasti, podle kterých se dál člení služby.'
              : 'Tato nadřazená schopnost sdružuje podřízené C3 položky. Použij filtr, pokud chceš vidět navazující položky a jejich mapování na služby.'}
          </p>
          <MetricLine label="Počet navázaných položek" value={parent.value} />
        </div>
        <div className={dashboardStyles.modalActions}>
          <Link href={listHref} className={dashboardStyles.secondaryLink} onClick={onClose}>
            Otevřít vyfiltrovaný C3 katalog
          </Link>
          <button type="button" className={dashboardStyles.ghostButton} onClick={onClose}>Zavřít</button>
        </div>
      </section>
    </div>
  );
}

function Health({ data, router, t }: { data: C3DashboardResponse; router: ReturnType<typeof useRouter>; t: TFunction }) {
  return (
    <section className={dashboardStyles.dashboardGrid}>
      <ChartCard title={t('c3.dashboard.by_status')} hint={t('c3.dashboard.by_status_hint')}>
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie
              data={data.by_status}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={82}
              onClick={(entry) => {
                if (entry.name) router.push(`/c3/list?status=${encodeURIComponent(entry.name)}`);
              }}
            >
              {data.by_status.map((entry) => <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? 'var(--color-text-muted)'} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <QueueCard title={t('c3.dashboard.sync_status')}>
        <CountRows rows={data.by_sync_status} empty={t('c3.dashboard.no_sync_rows')} />
      </QueueCard>
      <QueueCard title={t('c3.dashboard.capability_map_health')}>
        <MetricLine label={t('c3.dashboard.mapped_nodes')} value={data.capability_map_health.mapped_nodes} />
        <MetricLine label={t('c3.dashboard.unmapped_nodes')} value={data.capability_map_health.unmapped_nodes} />
        <MetricLine label={t('c3.dashboard.total_nodes')} value={data.capability_map_health.total_nodes} />
        {data.spiral_coverage.map((row) => <CoverageLine key={row.name} label={t('c3.dashboard.coverage', { name: row.name })} value={coveragePercent(row)} detail={`${row.mapped}/${row.value}`} />)}
      </QueueCard>
    </section>
  );
}

function Mappings({ data, t }: { data: C3DashboardResponse; t: TFunction }) {
  return (
    <section className={dashboardStyles.dashboardGrid}>
      <QueueCard title={t('c3.dashboard.application_coverage')}>
        {data.coverage_by_application.length ? data.coverage_by_application.slice(0, 10).map((row) => <CoverageLine key={row.name} label={row.name} value={coveragePercent(row)} detail={`${row.mapped}/${row.value}`} />) : <EmptyState title={t('c3.dashboard.no_application_coverage')} />}
      </QueueCard>
      <QueueCard title={t('c3.dashboard.most_mapped')}>
        <ItemRows items={data.most_mapped.slice(0, 8)} empty={t('c3.dashboard.no_mappings')} badge="mapping_count" />
      </QueueCard>
      <QueueCard title={t('c3.dashboard.kpi.needs_mapping')}>
        <ItemRows items={data.needs_mapping.slice(0, 8)} empty={t('c3.dashboard.no_queue')} badge="item_type" />
      </QueueCard>
    </section>
  );
}

function Imports({ data, t, locale }: { data: C3DashboardResponse; t: TFunction; locale: string }) {
  const drift = data.import_sync_drift;
  return (
    <section className={dashboardStyles.dashboardGrid}>
      <QueueCard title={t('c3.dashboard.latest_import')}>
        <MetricLine label={t('c3.dashboard.target')} value={formatTargetLabel(drift.latest_import_target)} />
        <MetricLine label={t('c3.dashboard.source')} value={drift.latest_import_source ?? '—'} />
        <MetricLine label={t('c3.dashboard.imported_at')} value={formatDateTime(drift.latest_import_at, locale)} />
        <MetricLine label={t('c3.dashboard.rows_changes')} value={`${drift.latest_import_row_count}/${drift.latest_import_change_count}`} />
      </QueueCard>
      <QueueCard title={t('c3.dashboard.sync_drift')}>
        <MetricLine label={t('c3.dashboard.latest_mapping_sync')} value={formatDateTime(drift.latest_sync_at, locale)} />
        <MetricLine label={t('c3.dashboard.stale_vs_baseline')} value={drift.stale_mapping_count} />
        <MetricLine label={t('c3.dashboard.missing_sync_timestamp')} value={drift.unsynced_mapping_count} />
      </QueueCard>
      <QueueCard title={t('c3.dashboard.exports')}>
        <div className={dashboardStyles.linkStack}>
          <Link href="/api/v1/export/manifest">{t('c3.dashboard.export_manifest')}</Link>
          <Link href="/api/v1/export/bundle">{t('c3.dashboard.export_bundle')}</Link>
          <Link href="/api/v1/export/capability-map-hierarchy">{t('c3.dashboard.export_hierarchy')}</Link>
        </div>
      </QueueCard>
    </section>
  );
}

function Review({ data, t }: { data: C3DashboardResponse; t: TFunction }) {
  return (
    <section className={dashboardStyles.dashboardGrid}>
      <QueueCard title={t('c3.dashboard.review_validation')}>
        <CountRows rows={data.review_validation} empty={t('c3.dashboard.no_validation_rows')} />
      </QueueCard>
      <QueueCard title={t('c3.dashboard.link_health')}>
        <CountRows rows={data.link_health} empty={t('c3.dashboard.no_capability_links')} />
      </QueueCard>
      <QueueCard title={t('c3.dashboard.decision_queues')}>
        <MetricLine label={t('c3.dashboard.mapping_queue')} value={data.needs_mapping.length} />
        <MetricLine label={t('c3.dashboard.review_findings')} value={data.review_validation.reduce((sum, row) => sum + row.value, 0)} />
        <MetricLine label={t('c3.dashboard.link_findings')} value={data.link_health.reduce((sum, row) => sum + row.value, 0)} />
      </QueueCard>
    </section>
  );
}

function QueueCard({ title, actionHref, actionLabel, children }: { title: string; actionHref?: string; actionLabel?: string; children: React.ReactNode }) {
  return (
    <article className={dashboardStyles.bottomCard}>
      <div className={dashboardStyles.sectionHeader}>
        <h2 className={dashboardStyles.cardTitle}>{title}</h2>
        {actionHref && actionLabel ? <Link href={actionHref} className={dashboardStyles.secondaryLink}>{actionLabel}</Link> : null}
      </div>
      {children}
    </article>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <article className={dashboardStyles.bottomCard}>
      <h2 className={dashboardStyles.cardTitle}>{title}</h2>
      {hint && <p className={dashboardStyles.sectionHint}>{hint}</p>}
      {children}
    </article>
  );
}

function ItemRows({ items, empty, badge }: { items: ItemRow[]; empty: string; badge: 'item_type' | 'mapping_count' }) {
  if (!items.length) return <EmptyState title={empty} />;
  return (
    <div className={dashboardStyles.auditList}>
      {items.map((item) => (
        <Link key={item.uuid} href={`/c3/${item.uuid}`} className={dashboardStyles.queueRowLink}>
          <span>
            <strong>{item.title ?? item.uuid}</strong>
            <small>{item.uuid}</small>
          </span>
          <Badge variant={badge === 'mapping_count' ? 'info' : 'warning'}>{badge === 'mapping_count' ? item.mapping_count ?? 0 : item.item_type ?? 'C3'}</Badge>
        </Link>
      ))}
    </div>
  );
}

function CountRows({ rows, empty }: { rows: CountRow[]; empty: string }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return <div className={dashboardStyles.auditList}>{rows.map((row) => <MetricLine key={row.name} label={row.name} value={row.value} />)}</div>;
}

function MetricLine({ label, value }: { label: string; value: number | string }) {
  return <div className={dashboardStyles.metricLine}><span>{label}</span><strong>{typeof value === 'number' ? value.toLocaleString('cs-CZ') : value}</strong></div>;
}

function CoverageLine({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className={dashboardStyles.coverageMiniRow}>
      <span>{label}</span>
      <ProgressBar value={value} tone={value >= 80 ? 'success' : value >= 50 ? 'warning' : 'danger'} label={label} />
      <strong>{detail}</strong>
    </div>
  );
}
