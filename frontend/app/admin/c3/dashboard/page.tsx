/**
 * C3 Dashboard — same layout as /dashboard, but with aggregated C3 data.
 */
'use client';

import Link from '@/app/components/AppLink';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { apiFetch } from '@/features/services/api/services.api';
import dashboardStyles from '../../../dashboard/dashboard.module.css';
import C3Breadcrumbs from '../../../components/C3Breadcrumbs';

interface CountRow {
  name: string;
  value: number;
}

interface CoverageRow extends CountRow {
  mapped: number;
}

interface SpiralCoverageRow extends CountRow {
  mapped: number;
  unmapped: number;
}

interface ItemRow {
  uuid: string;
  title: string | null;
  item_type?: string | null;
  mapping_count?: number;
}

interface CapabilityMapHealth {
  total_nodes: number;
  mapped_nodes: number;
  unmapped_nodes: number;
}

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
  summary: {
    total_items: number;
    mapped_items: number;
    unmapped_items: number;
    total_mappings: number;
    item_type_count: number;
    application_count: number;
  };
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
}

interface ExportManifestResponse {
  contract_version: string;
  schema_version: string;
}

const TYPE_COLORS: Record<string, string> = {
  BP: '#e65c00',
  BR: '#c2185b',
  CI: '#1b8f52',
  CO: '#f57f17',
  CR: '#283593',
  UA: '#7b1fa2',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#36b37e',
  archived: '#6b778c',
  draft: '#97a0af',
  pending: '#ff8b00',
  published: '#0065ff',
  retired: '#42526e',
  unknown: '#97a0af',
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('cs-CZ');
}

function formatTargetLabel(value: string | null | undefined) {
  switch (value) {
    case 'applications':
      return 'Applications';
    case 'data-objects':
      return 'Data Objects';
    case 'services':
      return 'Services';
    case 'technology-interactions':
      return 'Technology Interactions';
    case 'c3-capability-builder':
      return 'Capability Map';
    case 'capabilities':
      return 'Capabilities';
    case 'business-processes':
      return 'Business Processes';
    case 'business-roles':
      return 'Business Roles';
    case 'information-products':
      return 'Information Products';
    case 'user-applications':
      return 'User Applications';
    case 'coi-services':
      return 'COI Services';
    case 'communications-services':
      return 'Communications Services';
    case 'core-services':
      return 'Core Services';
    default:
      return value || '—';
  }
}

export default function C3DashboardPage() {
  const router = useRouter();
  const { data, isLoading, error } = useSWR<C3DashboardResponse>(
    '/api/v1/taxonomy/c3/dashboard',
    apiFetch,
    { revalidateOnFocus: false },
  );
  const { data: manifest } = useSWR<ExportManifestResponse>(
    '/api/v1/export/manifest?scope=c3',
    apiFetch,
    { revalidateOnFocus: false },
  );

  if (isLoading) return <div className={dashboardStyles.state}>Loading dashboard…</div>;
  if (error) return <div className={dashboardStyles.stateError}>Dashboard unavailable — check middleware connection.</div>;
  if (!data) return null;

  const summary = data.summary;

  return (
    <div className={dashboardStyles.shell}>
      <C3Breadcrumbs />
      <div className={dashboardStyles.pageHeader}>
        <h1 className={dashboardStyles.pageTitle}>C3 Dashboard</h1>
        {manifest?.contract_version && <span className={dashboardStyles.cachedBadge}>contract {manifest.contract_version}</span>}
        {manifest?.schema_version && <span className={dashboardStyles.cachedBadge}>schema {manifest.schema_version}</span>}
        <Link href="/api/v1/export/manifest" className={dashboardStyles.cachedBadge}>export manifest</Link>
        <Link href="/api/v1/export/bundle" className={dashboardStyles.cachedBadge}>export bundle</Link>
        <Link href="/api/v1/export/capability-map-hierarchy" className={dashboardStyles.cachedBadge}>export hierarchy</Link>
      </div>

      <div className={dashboardStyles.kpiRow}>
        <KpiTile label="Total C3 Items" value={summary.total_items} />
        <KpiTile label="Mapped" value={summary.mapped_items} color="#36b37e" />
        <KpiTile label="Unmapped" value={summary.unmapped_items} color="#ff8b00" />
        <KpiTile label="Total Mappings" value={summary.total_mappings} color="#0065ff" />
        <KpiTile label="Item Types" value={summary.item_type_count} />
        <KpiTile label="Applications" value={summary.application_count} />
      </div>

      <div className={dashboardStyles.chartsRow}>
        <ChartCard title="By Item Status" hint="Click segment to filter C3 list">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.by_status}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                style={{ cursor: 'pointer' }}
                onClick={(entry: CountRow) => router.push(`/c3/list?status=${encodeURIComponent(entry.name)}`)}
              >
                {data.by_status.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#97a0af'} style={{ cursor: 'pointer' }} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By Item Type" hint="Click bar to filter C3 list">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.by_type} layout="vertical" margin={{ left: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={40} />
              <Tooltip />
              <Bar
                dataKey="value"
                radius={[0, 3, 3, 0]}
                style={{ cursor: 'pointer' }}
                onClick={(entry: CountRow) => router.push(`/c3/list?item_type=${encodeURIComponent(entry.name)}`)}
              >
                {data.by_type.map((entry) => (
                  <Cell key={entry.name} fill={TYPE_COLORS[entry.name] ?? '#97a0af'} style={{ cursor: 'pointer' }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By Application" hint="Click bar to filter C3 list">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.by_application} layout="vertical" margin={{ left: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip />
              <Bar
                dataKey="value"
                fill="#6554c0"
                radius={[0, 3, 3, 0]}
                style={{ cursor: 'pointer' }}
                onClick={(entry: CountRow) => router.push(`/c3/list?application=${encodeURIComponent(entry.name)}`)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By Parent Capability" hint="Top parent groups">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.top_parents} layout="vertical" margin={{ left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
              <Tooltip />
              <Bar dataKey="value" fill="#00b8d9" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className={dashboardStyles.bottomRow}>
        <div className={dashboardStyles.bottomCard}>
          <h3 className={dashboardStyles.cardTitle}>Status Breakdown</h3>
          <div className={dashboardStyles.statusTable}>
            {data.by_status.map((row) => (
              <div key={row.name} className={dashboardStyles.statusRow}>
                <span className={dashboardStyles.auditBadge} style={{ borderColor: STATUS_COLORS[row.name] ?? '#97a0af', color: STATUS_COLORS[row.name] ?? '#42526e', background: 'var(--color-bg-canvas)' }}>
                  {row.name}
                </span>
                <span className={dashboardStyles.statusCount}>{row.value}</span>
                <div className={dashboardStyles.statusBar}>
                  <div
                    className={dashboardStyles.statusBarFill}
                    style={{ width: `${summary.total_items > 0 ? (row.value / summary.total_items) * 100 : 0}%`, background: STATUS_COLORS[row.name] ?? '#97a0af' }}
                  />
                </div>
                <span className={dashboardStyles.statusPct}>{summary.total_items > 0 ? Math.round((row.value / summary.total_items) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className={dashboardStyles.bottomCard}>
          <h3 className={dashboardStyles.cardTitle}>Needs Mapping</h3>
          <div className={dashboardStyles.auditList}>
            {data.needs_mapping.length === 0 ? (
              <p className={dashboardStyles.emptyNote}>Všechny C3 položky jsou namapované.</p>
            ) : data.needs_mapping.map((item) => (
              <div key={item.uuid} className={dashboardStyles.auditRow}>
                <Link href={`/c3/${item.uuid}`} className={dashboardStyles.auditLink}>{item.title ?? item.uuid}</Link>
                <span className={dashboardStyles.auditBadge}>{item.item_type ?? 'C3'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={dashboardStyles.bottomCard}>
          <h3 className={dashboardStyles.cardTitle}>Most Mapped Items</h3>
          <div className={dashboardStyles.auditList}>
            {data.most_mapped.length === 0 ? (
              <p className={dashboardStyles.emptyNote}>Žádná mapování.</p>
            ) : data.most_mapped.map((item) => (
              <div key={item.uuid} className={dashboardStyles.auditRow}>
                <Link href={`/c3/${item.uuid}`} className={dashboardStyles.auditLink}>{item.title ?? item.uuid}</Link>
                <span className={dashboardStyles.auditScore}>{item.mapping_count ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={dashboardStyles.bottomCard}>
          <h3 className={dashboardStyles.cardTitle}>Coverage by Application</h3>
          <div className={dashboardStyles.auditList}>
            {data.coverage_by_application.length === 0 ? (
              <p className={dashboardStyles.emptyNote}>Žádná data.</p>
            ) : data.coverage_by_application.map((row) => (
              <div key={row.name} className={dashboardStyles.auditRow}>
                <span className={dashboardStyles.auditLink}>{row.name}</span>
                <span className={dashboardStyles.auditScore}>{row.mapped}/{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={dashboardStyles.bottomCard}>
          <h3 className={dashboardStyles.cardTitle}>Sync Status</h3>
          <div className={dashboardStyles.auditList}>
            {data.by_sync_status.length === 0 ? (
              <p className={dashboardStyles.emptyNote}>Žádné sync záznamy.</p>
            ) : data.by_sync_status.map((row) => (
              <div key={row.name} className={dashboardStyles.auditRow}>
                <span className={dashboardStyles.auditLink}>{row.name}</span>
                <span className={dashboardStyles.auditScore}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={dashboardStyles.row5}>
        <div className={dashboardStyles.bottomCard}>
          <h3 className={dashboardStyles.cardTitle}>Capability Map Health</h3>
          <div className={dashboardStyles.auditList}>
            <div className={dashboardStyles.auditRow}>
              <span className={dashboardStyles.auditLink}>Se service mappingem</span>
              <span className={dashboardStyles.auditScore}>{data.capability_map_health.mapped_nodes}</span>
            </div>
            <div className={dashboardStyles.auditRow}>
              <span className={dashboardStyles.auditLink}>Bez service mappingu</span>
              <span className={dashboardStyles.auditScore}>{data.capability_map_health.unmapped_nodes}</span>
            </div>
            <div className={dashboardStyles.auditRow}>
              <span className={dashboardStyles.auditLink}>Celkem capability nodes</span>
              <span className={dashboardStyles.auditScore}>{data.capability_map_health.total_nodes}</span>
            </div>
            {data.spiral_coverage.map((row) => (
              <div key={row.name} className={dashboardStyles.auditRow}>
                <span className={dashboardStyles.auditLink}>{row.name} coverage</span>
                <span className={dashboardStyles.auditScore}>{row.mapped}/{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={dashboardStyles.bottomCard}>
          <h3 className={dashboardStyles.cardTitle}>Import &amp; Sync Drift</h3>
          <div className={dashboardStyles.auditList}>
            <div className={dashboardStyles.auditRow}>
              <span className={dashboardStyles.auditLink}>Poslední import</span>
              <span className={dashboardStyles.auditScore}>{formatTargetLabel(data.import_sync_drift.latest_import_target)}</span>
            </div>
            {data.import_sync_drift.latest_import_source ? (
              <div className={dashboardStyles.auditRow}>
                <span className={dashboardStyles.auditLink}>Zdroj importu</span>
                <span className={dashboardStyles.auditScore}>{data.import_sync_drift.latest_import_source}</span>
              </div>
            ) : null}
            <div className={dashboardStyles.auditRow}>
              <span className={dashboardStyles.auditLink}>Import timestamp</span>
              <span className={dashboardStyles.auditScore}>{formatDateTime(data.import_sync_drift.latest_import_at)}</span>
            </div>
            <div className={dashboardStyles.auditRow}>
              <span className={dashboardStyles.auditLink}>Import rows / changes</span>
              <span className={dashboardStyles.auditScore}>{data.import_sync_drift.latest_import_row_count}/{data.import_sync_drift.latest_import_change_count}</span>
            </div>
            <div className={dashboardStyles.auditRow}>
              <span className={dashboardStyles.auditLink}>Poslední mapping sync</span>
              <span className={dashboardStyles.auditScore}>{formatDateTime(data.import_sync_drift.latest_sync_at)}</span>
            </div>
            <div className={dashboardStyles.auditRow}>
              <span className={dashboardStyles.auditLink}>Stale vůči baseline</span>
              <span className={dashboardStyles.auditScore}>{data.import_sync_drift.stale_mapping_count}</span>
            </div>
            <div className={dashboardStyles.auditRow}>
              <span className={dashboardStyles.auditLink}>Bez sync timestampu</span>
              <span className={dashboardStyles.auditScore}>{data.import_sync_drift.unsynced_mapping_count}</span>
            </div>
          </div>
        </div>

        <div className={dashboardStyles.bottomCard}>
          <h3 className={dashboardStyles.cardTitle}>Link Health</h3>
          <div className={dashboardStyles.auditList}>
            {data.link_health.length === 0 ? (
              <p className={dashboardStyles.emptyNote}>Žádné capability linky.</p>
            ) : data.link_health.map((row) => (
              <div key={row.name} className={dashboardStyles.auditRow}>
                <span className={dashboardStyles.auditLink}>{row.name}</span>
                <span className={dashboardStyles.auditScore}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={dashboardStyles.bottomCard}>
          <h3 className={dashboardStyles.cardTitle}>Review / Validation</h3>
          <div className={dashboardStyles.auditList}>
            {data.review_validation.length === 0 ? (
              <p className={dashboardStyles.emptyNote}>Žádná validační data.</p>
            ) : data.review_validation.map((row) => (
              <div key={row.name} className={dashboardStyles.auditRow}>
                <span className={dashboardStyles.auditLink}>{row.name}</span>
                <span className={dashboardStyles.auditScore}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, color }: { label: string; value: number | null | undefined; color?: string }) {
  return (
    <div className={dashboardStyles.kpiTile}>
      <div className={dashboardStyles.kpiValue} style={{ color: color ?? 'var(--color-text-primary)' }}>
        {(value ?? 0).toLocaleString()}
      </div>
      <div className={dashboardStyles.kpiLabel}>{label}</div>
    </div>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={dashboardStyles.chartCard}>
      <h3 className={dashboardStyles.cardTitle}>{title}</h3>
      {hint && <p className={dashboardStyles.chartHint}>{hint}</p>}
      {children}
    </div>
  );
}
