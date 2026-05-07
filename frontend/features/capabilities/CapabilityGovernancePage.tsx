'use client';

import useSWR from 'swr';
import Link from '@/app/components/AppLink';
import { useSearchParams } from 'next/navigation';
import { Badge, EmptyState, KpiCard, ProgressBar } from '@/design-system/controls';
import { apiFetch } from '@/features/services/api/services.api';
import styles from './capabilities.module.css';

type GovernanceMode = 'coverage' | 'gaps' | 'overlaps';
type NavigationMode = 'route' | 'query';

interface CapabilityService {
  service_id: string;
  title: string;
  normalized_role?: string;
  readiness_state?: string;
}

interface CapabilityGovernanceItem {
  capability_uuid: string;
  capability_code?: string | null;
  capability_title: string;
  slug?: string | null;
  domain?: string | null;
  spiral_code?: string | null;
  coverage_percent: number;
  total_requirements?: number;
  covered_requirement_count?: number;
  gap_count?: number;
  service_count: number;
  primary_service_count?: number;
  ready_service_count?: number;
  blocked_service_count?: number;
  readiness_state?: string;
  governance_state?: string;
  gap_type?: string;
  overlap_score?: number;
  recommended_action?: string;
  services?: CapabilityService[];
}

interface CapabilityGovernanceResponse {
  items: CapabilityGovernanceItem[];
  counts: {
    total: number;
    uncovered?: number;
    over_covered?: number;
    not_ready?: number;
    ready?: number;
  };
}

const MODE_COPY: Record<GovernanceMode, { title: string; lead: string; endpoint: string; empty: string }> = {
  coverage: {
    title: 'Capability Coverage',
    lead: 'Coverage matrix across C3 capabilities, mapped services, readiness, and FMN spiral evidence.',
    endpoint: '/api/v1/capabilities/coverage',
    empty: 'No capability coverage rows.',
  },
  gaps: {
    title: 'Capability Gaps',
    lead: 'Uncovered or not-ready capabilities with recommended next actions.',
    endpoint: '/api/v1/capabilities/gaps',
    empty: 'No capability gaps detected.',
  },
  overlaps: {
    title: 'Capability Overlaps',
    lead: 'Capabilities with duplicate service support or consolidation candidates.',
    endpoint: '/api/v1/capabilities/overlaps',
    empty: 'No capability overlaps detected.',
  },
};

function buildQuery(search: URLSearchParams | null) {
  const params = new URLSearchParams();
  for (const key of ['spiral', 'domain', 'lifecycle', 'owner', 'readiness']) {
    const value = search?.get(key)?.trim();
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toneForCoverage(value: number): 'success' | 'warning' | 'danger' {
  if (value >= 80) return 'success';
  if (value >= 50) return 'warning';
  return 'danger';
}

function readinessVariant(value: string | undefined) {
  if (value === 'ready') return 'success';
  if (value === 'uncovered') return 'warning';
  return 'danger';
}

function capabilityHref(item: CapabilityGovernanceItem) {
  return item.slug ? `/capabilities/${item.slug}` : `/c3/${item.capability_uuid}`;
}

function ServicesCell({ services }: { services: CapabilityService[] }) {
  if (services.length === 0) return <span className={styles.mutedText}>No mapped services</span>;
  return (
    <div className={styles.serviceChipList}>
      {services.slice(0, 4).map((service) => (
        <Link key={service.service_id} href={`/services/${service.service_id}`} className={styles.serviceChip}>
          <strong>{service.title}</strong>
          <span>{service.service_id} · {service.normalized_role ?? 'mapped'} · {service.readiness_state ?? 'unknown'}</span>
        </Link>
      ))}
      {services.length > 4 ? <span className={styles.moreChip}>+{services.length - 4}</span> : null}
    </div>
  );
}

function modeHref(mode: GovernanceMode, navigationMode: NavigationMode) {
  return navigationMode === 'query' ? `/capabilities?view=${mode}` : `/capabilities/${mode}`;
}

function FilterBar({ mode, navigationMode }: { mode: GovernanceMode; navigationMode: NavigationMode }) {
  return (
    <form className={styles.filterBar} method="get">
      <label>
        <span>Spiral</span>
        <select name="spiral" defaultValue="">
          <option value="">All</option>
          <option value="Spiral_7">Spiral 7</option>
          <option value="Spiral_6">Spiral 6</option>
          <option value="Spiral_5">Spiral 5</option>
          <option value="Spiral_4">Spiral 4</option>
        </select>
      </label>
      <label>
        <span>Domain</span>
        <input name="domain" type="search" placeholder="BMC, CIS..." />
      </label>
      <label>
        <span>Readiness</span>
        <select name="readiness" defaultValue="">
          <option value="">All</option>
          <option value="ready">Ready</option>
          <option value="blocked">Blocked</option>
        </select>
      </label>
      <button type="submit">Apply filters</button>
      {mode !== 'coverage' ? <Link href={modeHref('coverage', navigationMode)} className={styles.inlineLink}>Coverage matrix</Link> : null}
    </form>
  );
}

function CapabilityTable({ mode, items }: { mode: GovernanceMode; items: CapabilityGovernanceItem[] }) {
  if (items.length === 0) return <EmptyState title={MODE_COPY[mode].empty} />;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Capability</th>
          <th>Spiral</th>
          <th>Coverage</th>
          <th>Services</th>
          <th>{mode === 'overlaps' ? 'Overlap' : mode === 'gaps' ? 'Next action' : 'Readiness'}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={`${item.capability_uuid}-${item.spiral_code ?? 'all'}-${mode}`}>
            <td>
              <Link href={capabilityHref(item)} className={styles.capabilityLink}>
                <strong>{item.capability_title}</strong>
                <span>{item.capability_code ?? item.capability_uuid} · {item.domain ?? 'No domain'}</span>
              </Link>
            </td>
            <td>{item.spiral_code ?? 'Unassigned'}</td>
            <td>
              <div className={styles.coverageCell}>
                <ProgressBar value={item.coverage_percent} tone={toneForCoverage(item.coverage_percent)} label={`${item.capability_title} coverage`} />
                <span>{item.coverage_percent}% · {item.gap_count ?? 0} gaps</span>
              </div>
            </td>
            <td><ServicesCell services={item.services ?? []} /></td>
            <td>
              {mode === 'overlaps' ? (
                <span className={styles.scoreText}>
                  {item.overlap_score ?? item.service_count * 25} overlap score
                  <br />
                  {item.recommended_action ?? 'Review duplicate service support.'}
                </span>
              ) : mode === 'gaps' ? (
                <span className={styles.actionText}>{item.recommended_action ?? 'Review capability mapping.'}</span>
              ) : (
                <Badge variant={readinessVariant(item.readiness_state)}>{item.readiness_state ?? item.governance_state ?? 'unknown'}</Badge>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CapabilityGovernancePage({
  mode,
  embedded = false,
  navigationMode = 'route',
}: {
  mode: GovernanceMode;
  embedded?: boolean;
  navigationMode?: NavigationMode;
}) {
  const search = useSearchParams();
  const copy = MODE_COPY[mode];
  const query = buildQuery(search);
  const { data, isLoading, error } = useSWR<CapabilityGovernanceResponse>(`${copy.endpoint}${query}`, apiFetch, { revalidateOnFocus: false });

  if (isLoading) return <div className={styles.state}>Loading capability governance...</div>;
  if (error || !data) return <div className={styles.state}>Capability governance is unavailable.</div>;

  const content = (
    <>
      {!embedded && (
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Capability governance</span>
            <h1 className={styles.title}>{copy.title}</h1>
            <p className={styles.lead}>{copy.lead}</p>
          </div>
          <div className={styles.pills}>
            <Link href="/capabilities" className={styles.pill}>Capability hub</Link>
            <Link href="/c3/capability-map-spiral7" className={styles.pill}>Spiral 7 map</Link>
          </div>
        </header>
      )}

      {embedded && (
        <section className={styles.panel}>
          <span className={styles.eyebrow}>Capability governance</span>
          <h2 className={styles.panelTitle}>{copy.title}</h2>
          <p className={styles.bodyText}>{copy.lead}</p>
        </section>
      )}

      <section className={styles.kpiGrid} aria-label="Capability governance KPIs">
        <KpiCard label="Total" value={data.counts.total} hint="Capabilities in scope" />
        <KpiCard label="Not ready" value={data.counts.not_ready ?? 0} hint="Blocked or uncovered" />
        <KpiCard label="Over-covered" value={data.counts.over_covered ?? 0} hint="Duplicate service support" />
      </section>

      <nav className={styles.tabs} aria-label="Capability governance sections">
        <Link href={modeHref('coverage', navigationMode)} className={`${styles.tab} ${mode === 'coverage' ? styles.tabActive : ''}`}>Coverage</Link>
        <Link href={modeHref('gaps', navigationMode)} className={`${styles.tab} ${mode === 'gaps' ? styles.tabActive : ''}`}>Gaps</Link>
        <Link href={modeHref('overlaps', navigationMode)} className={`${styles.tab} ${mode === 'overlaps' ? styles.tabActive : ''}`}>Overlaps</Link>
      </nav>

      <FilterBar mode={mode} navigationMode={navigationMode} />

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Spiral readiness summary</h2>
            <p className={styles.bodyText}>Use filters to narrow by spiral, domain, lifecycle, owner, or readiness state.</p>
          </div>
          <Badge variant="info">{data.items.length} rows</Badge>
        </div>
        <CapabilityTable mode={mode} items={data.items} />
      </section>
    </>
  );

  if (embedded) return <section className={styles.governanceEmbedded}>{content}</section>;

  return (
    <main className={styles.shell}>
      {content}
    </main>
  );
}
