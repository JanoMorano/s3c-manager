/**
 * §9.4 Dashboard — Pattern D: KPI tiles + distribution charts + due lists
 * useDashboard hook is ready; visualizations use Recharts.
 */
'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useInstallStatus } from '@/features/install/installStatus';
import { useDashboard, useCompleteness } from '@/features/services/hooks/useServices';
import { StatusPill } from '@/features/services/components/StatusPill';
import Link from '@/app/components/AppLink';
import { useRouter } from 'next/navigation';
import styles from '../../dashboard/dashboard.module.css';

// Domain colors for chart
const DOMAIN_COLORS: Record<string, string> = {
  RELAY:'#6554c0', CLOUD:'#0065ff', GRID:'#00b8d9', PRISM:'#36b37e',
  HELIX:'#ff5630', NEXUS:'#172b4d', VERTEX:'#42526e', ORBIT:'#6b778c',
  PULSE:'#8777d9', ZENITH:'#00c7e6', APEX:'#57d9a3', VORTEX:'#ffc400', MATRIX:'#ff7452',
};

const STATUS_COLORS: Record<string, string> = {
  active:'#36b37e', planned:'#0065ff', draft:'#97a0af',
  deprecated:'#ff8b00', retired:'#6b778c',
};

export default function DashboardPage() {
  const { c3Visible } = useInstallStatus();
  const { data, isLoading, error } = useDashboard();
  const { data: completeness } = useCompleteness();
  const router = useRouter();

  if (isLoading) return <div className={styles.state}>Loading dashboard…</div>;
  if (error)     return <div className={styles.stateError}>Dashboard unavailable — check middleware connection.</div>;
  if (!data)     return null;

  const {
    summary,
    by_type,
    by_portfolio,
    by_domain,
    by_owner,
    expensive_flavours: expensiveFlavours,
    c3_coverage: c3Coverage,
  } = data;

  // Build status data from summary — coerce nulls to 0 (SQL SUM returns NULL for empty table)
  const s = {
    total:      summary.total_services      ?? 0,
    active:     summary.active_services     ?? 0,
    draft:      summary.draft_services      ?? 0,
    deprecated: summary.deprecated_services ?? 0,
    retired:    summary.retired_services    ?? 0,
  };
  const statusData = [
    { name: 'Active',     value: s.active,                                                         status: 'active' },
    { name: 'Draft',      value: s.draft,                                                          status: 'draft' },
    { name: 'Deprecated', value: s.deprecated,                                                     status: 'deprecated' },
    { name: 'Retired',    value: s.retired,                                                        status: 'retired' },
    { name: 'Other',      value: Math.max(0, s.total - s.active - s.draft - s.deprecated - s.retired), status: 'planned' },
  ].filter(d => d.value > 0);
  const ownerMax = by_owner[0]?.service_count ?? 0;
  const c3Totals = c3Coverage.reduce((acc, row) => {
    acc.total += row.total_count ?? 0;
    acc.mapped += row.mapped_count ?? 0;
    return acc;
  }, { total: 0, mapped: 0 });

  return (
    <div className={styles.shell}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        {data._cached && <span className={styles.cachedBadge}>cached</span>}
      </div>

      {/* ── KPI row (§9.4 top row) ─────────────────────────────────── */}
      <div className={styles.kpiRow}>
        <KpiTile label="Total Services"   value={s.total}                         />
        <KpiTile label="Active"           value={s.active}           color="#36b37e" />
        <KpiTile label="Total Relations"  value={summary.total_relations ?? 0}   />
        <KpiTile label="Total Flavours"   value={summary.total_flavours  ?? 0}   />
        <KpiTile label="Draft"            value={s.draft}            color="#97a0af" />
        <KpiTile label="Deprecated"       value={s.deprecated}       color="#ff8b00" />
      </div>

      {/* ── Charts row (§9.4 middle row) ──────────────────────────── */}
      <div className={styles.chartsRow}>

        {/* Services by status (pie) — click → catalogue filter */}
        <ChartCard title="By Status" hint="Click segment to filter catalogue">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusData} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={80}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                style={{ cursor: 'pointer' }}
                onClick={(entry: { status: string }) => router.push(`/services/list?status=${entry.status}`)}
              >
                {statusData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#97a0af'} style={{ cursor: 'pointer' }} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Services by type (bar) — click → catalogue filter */}
        <ChartCard title="By Service Type" hint="Click bar to filter catalogue">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={by_type} layout="vertical" margin={{ left: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="service_type" tick={{ fontSize: 12 }} width={40} />
              <Tooltip />
              <Bar
                dataKey="count" fill="var(--color-action-primary)" radius={[0, 3, 3, 0]}
                style={{ cursor: 'pointer' }}
                onClick={(entry: { service_type: string }) => router.push(`/services/list?type=${entry.service_type}`)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Services by domain (bar) — click → catalogue filter */}
        <ChartCard title="By Domain" hint="Click bar to filter catalogue">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={by_domain} layout="vertical" margin={{ left: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="domain_code" tick={{ fontSize: 11 }} width={50} />
              <Tooltip />
              <Bar
                dataKey="service_count" radius={[0, 3, 3, 0]}
                style={{ cursor: 'pointer' }}
                onClick={(entry: { domain_code: string }) => router.push(`/services/list?domain=${entry.domain_code}`)}
              >
                {by_domain.map((entry) => (
                  <Cell key={entry.domain_code} fill={DOMAIN_COLORS[entry.domain_code] ?? '#97a0af'} style={{ cursor: 'pointer' }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Services by portfolio (bar) — click → catalogue filter */}
        <ChartCard title="By Portfolio" hint="Click bar to filter catalogue">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={by_portfolio} layout="vertical" margin={{ left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="portfolio_group" tick={{ fontSize: 10 }} width={80} />
              <Tooltip />
              <Bar
                dataKey="count" fill="#6554c0" radius={[0, 3, 3, 0]}
                style={{ cursor: 'pointer' }}
                onClick={(entry: { portfolio_group: string }) => router.push(`/services/list?portfolio=${entry.portfolio_group}`)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className={styles.insightsRow}>
        <div className={styles.bottomCard}>
          <h3 className={styles.cardTitle}>Nejdražší flavours</h3>
          {expensiveFlavours.length === 0 ? (
            <p className={styles.emptyNote}>V databázi zatím nejsou pricing data.</p>
          ) : (
            <div className={styles.richTable}>
              <div className={styles.richTableHead}>
                <span>Flavour</span>
                <span>Service</span>
                <span>Name</span>
                <span>Unit</span>
                <span style={{ textAlign: 'right' }}>Rate</span>
              </div>
              {expensiveFlavours.map((flavour) => (
                <div key={`${flavour.service_id}-${flavour.flavour_code}`} className={styles.richTableRow}>
                  <span className={styles.richMono}>{flavour.flavour_code}</span>
                  <span className={styles.richMono}>
                    <Link href={`/services/${flavour.service_id}/edit#flavours`}>{flavour.service_id}</Link>
                  </span>
                  <span>{flavour.flavour_title}</span>
                  <span>{flavour.service_unit ?? '—'}</span>
                  <span className={styles.richValue}>{formatMoney(flavour.price_value, flavour.currency_code)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.bottomCard}>
          <h3 className={styles.cardTitle}>Počet služeb podle Service Owner</h3>
          {by_owner && by_owner.length > 0 ? (
            <div className={styles.ownerList}>
              {by_owner.slice(0, 10).map((owner, index) => (
                <div key={owner.display_name + index} className={styles.ownerRow}>
                  <span className={styles.ownerRank}>{index + 1}</span>
                  <span className={styles.ownerName} title={owner.email ?? undefined}>{owner.display_name}</span>
                  <span className={styles.ownerBar}>
                    <span
                      className={styles.ownerBarFill}
                      style={{ width: `${ownerMax > 0 ? (owner.service_count / ownerMax) * 100 : 0}%` }}
                    />
                  </span>
                  <span className={styles.ownerCount}>{owner.service_count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyNote}>Žádní service owneři v DB.</p>
          )}
        </div>
      </div>

      {/* ── Bottom row (§9.4 — due/review/problem lists) ─────────── */}
      <div className={styles.bottomRow}>

        {/* Status Breakdown */}
        <div className={styles.bottomCard}>
          <h3 className={styles.cardTitle}>Status Breakdown</h3>
          <div className={styles.statusTable}>
            {statusData.map(row => (
              <div key={row.status} className={styles.statusRow}>
                <StatusPill status={row.status} size="sm" />
                <span className={styles.statusCount}>{row.value}</span>
                <div className={styles.statusBar}>
                  <div
                    className={styles.statusBarFill}
                    style={{ width: `${s.total > 0 ? (row.value / s.total * 100).toFixed(1) : 0}%`, background: STATUS_COLORS[row.status] ?? '#97a0af' }}
                  />
                </div>
                <span className={styles.statusPct}>{s.total > 0 ? (row.value / s.total * 100).toFixed(0) : 0}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Incomplete Metadata — services with completeness_score < 70 */}
        <div className={styles.bottomCard}>
          <h3 className={styles.cardTitle}>Incomplete Metadata</h3>
          {completeness ? (() => {
            const incomplete = completeness
              .filter(s => (s.completeness_score ?? 0) < 70)
              .sort((a, b) => (a.completeness_score ?? 0) - (b.completeness_score ?? 0))
              .slice(0, 10);
            return incomplete.length === 0
              ? <p className={styles.emptyNote}>All services above threshold.</p>
              : (
                <div className={styles.auditList}>
                  {incomplete.map(s => (
                    <div key={s.service_id} className={styles.auditRow}>
                      <Link href={`/services/${s.service_id}`} className={styles.auditLink}>{s.title}</Link>
                      <span className={styles.auditScore} style={{ color: (s.completeness_score ?? 0) < 40 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                        {s.completeness_score ?? 0}%
                      </span>
                    </div>
                  ))}
                </div>
              );
          })() : <p className={styles.emptyNote}>Loading…</p>}
        </div>

        {/* Missing Owners — services without service_owner */}
        <div className={styles.bottomCard}>
          <h3 className={styles.cardTitle}>Missing Owners</h3>
          {completeness ? (() => {
            const noOwner = completeness
              .filter(s => !s.summary || s.completeness_score === 0)
              .slice(0, 10);
            // We infer missing owner from completeness_score=0 or no summary
            // Full owner info isn't in completeness endpoint — show low-score items without description
            const missingDesc = completeness
              .filter(s => !s.summary)
              .slice(0, 10);
            return missingDesc.length === 0
              ? <p className={styles.emptyNote}>All active services have descriptions.</p>
              : (
                <div className={styles.auditList}>
                  {missingDesc.map(s => (
                    <div key={s.service_id} className={styles.auditRow}>
                      <Link href={`/services/${s.service_id}/edit`} className={styles.auditLink}>{s.title}</Link>
                      <span className={styles.auditBadge}>no description</span>
                    </div>
                  ))}
                </div>
              );
          })() : <p className={styles.emptyNote}>Loading…</p>}
        </div>

        {c3Visible && (
          <div className={styles.bottomCard}>
            <h3 className={styles.cardTitle}>Pokrytí C3 taxonomie</h3>
            {c3Coverage.length === 0 ? (
              <p className={styles.emptyNote}>Žádné C3 taxonomy položky v DB.</p>
            ) : (
              <div className={styles.coverageList}>
                <div className={styles.coverageSummary}>
                  <span>Mapped {c3Totals.mapped}</span>
                  <span>Total {c3Totals.total}</span>
                </div>
                {c3Coverage.map((row) => {
                  const pct = row.total_count > 0 ? (row.mapped_count / row.total_count) * 100 : 0;
                  return (
                    <div
                      key={row.item_type}
                      className={styles.coverageRow}
                      onClick={() => router.push(`/c3/list?item_type=${encodeURIComponent(row.item_type)}`)}
                    >
                      <span className={styles.coverageLabel}>{row.item_type}</span>
                      <span className={styles.coverageBar}>
                        <span className={styles.coverageBarFill} style={{ width: `${pct}%` }} />
                      </span>
                      <span className={styles.coverageValue}>{row.mapped_count}/{row.total_count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Row 5 — governance insights ───────────────────────────── */}
      <div className={styles.row5}>

        {/* Top Completeness — services with highest metadata score */}
        <div className={styles.bottomCard}>
          <h3 className={styles.cardTitle}>Top Completeness</h3>
          {completeness ? (() => {
            const top = [...completeness]
              .filter(s => s.service_status !== 'retired')
              .sort((a, b) => (b.completeness_score ?? 0) - (a.completeness_score ?? 0))
              .slice(0, 8);
            const maxScore = top[0]?.completeness_score ?? 100;
            return top.length === 0
              ? <p className={styles.emptyNote}>Žádná data.</p>
              : (
                <div className={styles.topList}>
                  {top.map((s, i) => {
                    const score = s.completeness_score ?? 0;
                    const color = score >= 80 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
                    return (
                      <div key={s.service_id} className={styles.topRow}>
                        <span className={styles.topRank}>{i + 1}</span>
                        <Link href={`/services/${s.service_id}`} className={styles.auditLink}>{s.title}</Link>
                        <span className={styles.topScore} style={{ color }}>{score}%</span>
                        <div className={styles.topBar}>
                          <div className={styles.topBarFill} style={{ width: `${maxScore > 0 ? (score / maxScore) * 100 : 0}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
          })() : <p className={styles.emptyNote}>Loading…</p>}
        </div>

        {/* Deprecated & Retired — lifecycle management */}
        <div className={styles.bottomCard}>
          <h3 className={styles.cardTitle}>Deprecated & Retired</h3>
          {completeness ? (() => {
            const sunset = completeness
              .filter(s => s.service_status === 'deprecated' || s.service_status === 'retired')
              .slice(0, 10);
            return sunset.length === 0
              ? <p className={styles.emptyNote}>Žádné deprecated / retired služby.</p>
              : (
                <div className={styles.auditList}>
                  {sunset.map(s => (
                    <div key={s.service_id} className={styles.auditRow}>
                      <Link href={`/services/${s.service_id}`} className={styles.auditLink}>{s.title}</Link>
                      <StatusPill status={s.service_status ?? 'draft'} size="sm" />
                    </div>
                  ))}
                </div>
              );
          })() : <p className={styles.emptyNote}>Loading…</p>}
        </div>

        {/* Pricing coverage — % services with at least 1 flavour */}
        <div className={styles.bottomCard}>
          <h3 className={styles.cardTitle}>Pricing pokrytí</h3>
          {completeness ? (() => {
            const active = completeness.filter(s => s.service_status !== 'retired');
            const withPricing  = active.filter(s => (s.flavour_count ?? 0) > 0);
            const noPricing    = active.filter(s => (s.flavour_count ?? 0) === 0);
            const pct = active.length > 0 ? Math.round((withPricing.length / active.length) * 100) : 0;
            return (
              <div className={styles.pricingStats}>
                <div className={styles.pricingStat}>
                  <div className={styles.pricingStatRow}>
                    <span className={styles.pricingStatLabel}>Se službou pricing</span>
                    <span className={styles.pricingStatValue}>{withPricing.length} / {active.length}</span>
                  </div>
                  <div className={styles.pricingBar}>
                    <div className={styles.pricingBarFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{pct}% pokrytí</span>
                </div>
                <div className={styles.pricingStat}>
                  <div className={styles.pricingStatRow}>
                    <span className={styles.pricingStatLabel}>Bez pricing varianty</span>
                    <span className={styles.pricingStatValue} style={{ color: noPricing.length > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                      {noPricing.length}
                    </span>
                  </div>
                  <div className={styles.pricingBar}>
                    <div className={styles.pricingBarFillWarning} style={{ width: active.length > 0 ? `${(noPricing.length / active.length) * 100}%` : '0%' }} />
                  </div>
                </div>
                {noPricing.length > 0 && (
                  <div className={styles.auditList} style={{ marginTop: 'var(--space-2)' }}>
                    {noPricing.slice(0, 5).map(s => (
                      <div key={s.service_id} className={styles.auditRow}>
                        <Link href={`/services/${s.service_id}/edit#flavours`} className={styles.auditLink}>{s.title}</Link>
                        <StatusPill status={s.service_status ?? 'draft'} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })() : <p className={styles.emptyNote}>Loading…</p>}
        </div>

        {/* C3 Mapping gap — unmapped items per taxonomy type */}
        {c3Visible && (
          <div className={styles.bottomCard}>
            <h3 className={styles.cardTitle}>C3 Mapping gap</h3>
            {c3Coverage.length === 0 ? (
              <p className={styles.emptyNote}>Žádné C3 taxonomy položky.</p>
            ) : (
              <div className={styles.auditList}>
                {c3Coverage
                  .map(row => ({ ...row, gap: (row.total_count ?? 0) - (row.mapped_count ?? 0) }))
                  .sort((a, b) => b.gap - a.gap)
                  .map(row => (
                    <div key={row.item_type} className={styles.auditRow}>
                      <span
                        className={styles.auditLink}
                        style={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/c3/list?item_type=${encodeURIComponent(row.item_type)}`)}
                      >
                        {row.item_type}
                      </span>
                      <span
                        className={styles.auditScore}
                        style={{ color: row.gap > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}
                      >
                        {row.gap > 0 ? `−${row.gap}` : '✓'}
                      </span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Local components ──────────────────────────────────────────────────────────
function KpiTile({ label, value, color }: { label: string; value: number | null | undefined; color?: string }) {
  return (
    <div className={styles.kpiTile}>
      <div className={styles.kpiValue} style={{ color: color ?? 'var(--color-text-primary)' }}>
        {(value ?? 0).toLocaleString()}
      </div>
      <div className={styles.kpiLabel}>{label}</div>
    </div>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={styles.chartCard}>
      <h3 className={styles.cardTitle}>{title}</h3>
      {hint && <p className={styles.chartHint}>{hint}</p>}
      {children}
    </div>
  );
}

function formatMoney(value: number | null, currencyCode: string | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: currencyCode ?? 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}
