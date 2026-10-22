'use client';

import useSWR from 'swr';
import Link from '@/app/components/AppLink';
import { useSearchParams } from 'next/navigation';
import { Badge, EmptyState, KpiCard, ProgressBar } from '@/design-system/controls';
import { apiFetch } from '@/features/services/api/services.api';
import { useT } from '@/app/i18n/useI18n';
import { resolveCountForm } from '@/app/lib/counts';
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

// Copy fields hold i18n keys; they are translated at render time.
const MODE_COPY: Record<GovernanceMode, { titleKey: string; leadKey: string; endpoint: string; emptyKey: string }> = {
  coverage: {
    titleKey: 'capabilities.governance.coverage.title',
    leadKey: 'capabilities.governance.coverage.lead',
    endpoint: '/api/v1/capabilities/coverage',
    emptyKey: 'capabilities.governance.coverage.empty',
  },
  gaps: {
    titleKey: 'capabilities.governance.gaps.title',
    leadKey: 'capabilities.governance.gaps.lead',
    endpoint: '/api/v1/capabilities/gaps',
    emptyKey: 'capabilities.governance.gaps.empty',
  },
  overlaps: {
    titleKey: 'capabilities.governance.overlaps.title',
    leadKey: 'capabilities.governance.overlaps.lead',
    endpoint: '/api/v1/capabilities/overlaps',
    emptyKey: 'capabilities.governance.overlaps.empty',
  },
};

const READINESS_LABEL_KEYS: Record<string, string> = {
  ready: 'capabilities.governance.readiness.ready',
  blocked: 'capabilities.governance.readiness.blocked',
  uncovered: 'capabilities.governance.readiness.uncovered',
  not_ready: 'capabilities.governance.readiness.not_ready',
  unknown: 'capabilities.governance.readiness.unknown',
};

function stateLabel(t: (key: string) => string, value: string | undefined) {
  const code = value ?? 'unknown';
  return READINESS_LABEL_KEYS[code] ? t(READINESS_LABEL_KEYS[code]) : code;
}

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

function gapCountKey(count: number) {
  return resolveCountForm(count, { one: 'spirals.detail.gap_count.one', few: 'spirals.detail.gap_count.few', many: 'spirals.detail.gap_count.many' });
}

function rowCountKey(count: number) {
  return resolveCountForm(count, { one: 'capabilities.governance.row_count.one', few: 'capabilities.governance.row_count.few', many: 'capabilities.governance.row_count.many' });
}

function capabilityHref(item: CapabilityGovernanceItem) {
  return item.slug ? `/capabilities/${item.slug}` : `/c3/${item.capability_uuid}`;
}

function ServicesCell({ services }: { services: CapabilityService[] }) {
  const t = useT();
  if (services.length === 0) return <span className={styles.mutedText}>{t('capabilities.governance.no_mapped_services')}</span>;
  return (
    <div className={styles.serviceChipList}>
      {services.slice(0, 4).map((service) => (
        <Link key={service.service_id} href={`/services/${service.service_id}`} className={styles.serviceChip}>
          <strong>{service.title}</strong>
          <span>{service.service_id} · {service.normalized_role ?? t('capabilities.governance.role_mapped')} · {stateLabel(t, service.readiness_state)}</span>
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
  const t = useT();
  return (
    <form className={styles.filterBar} method="get">
      <label>
        <span>{t('capabilities.governance.filter.spiral')}</span>
        <select name="spiral" defaultValue="">
          <option value="">{t('capabilities.governance.filter.all')}</option>
          {[7, 6, 5, 4].map((number) => (
            <option key={number} value={`Spiral_${number}`}>{t('capabilities.governance.filter.spiral_option', { number })}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{t('capabilities.governance.filter.domain')}</span>
        <input name="domain" type="search" placeholder={t('capabilities.governance.filter.domain_placeholder')} />
      </label>
      <label>
        <span>{t('capabilities.governance.filter.readiness')}</span>
        <select name="readiness" defaultValue="">
          <option value="">{t('capabilities.governance.filter.all')}</option>
          <option value="ready">{t('capabilities.governance.readiness.ready')}</option>
          <option value="blocked">{t('capabilities.governance.readiness.blocked')}</option>
        </select>
      </label>
      <button type="submit">{t('capabilities.governance.filter.apply')}</button>
      {mode !== 'coverage' ? <Link href={modeHref('coverage', navigationMode)} className={styles.inlineLink}>{t('capabilities.governance.coverage_matrix')}</Link> : null}
    </form>
  );
}

function CapabilityTable({ mode, items }: { mode: GovernanceMode; items: CapabilityGovernanceItem[] }) {
  const t = useT();
  if (items.length === 0) return <EmptyState title={t(MODE_COPY[mode].emptyKey)} />;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>{t('capabilities.governance.table.capability')}</th>
          <th>{t('capabilities.governance.filter.spiral')}</th>
          <th>{t('capabilities.view.coverage')}</th>
          <th>{t('capabilities.governance.table.services')}</th>
          <th>{mode === 'overlaps' ? t('capabilities.governance.table.overlap') : mode === 'gaps' ? t('capabilities.governance.table.next_action') : t('capabilities.governance.filter.readiness')}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={`${item.capability_uuid}-${item.spiral_code ?? 'all'}-${mode}`}>
            <td>
              <Link href={capabilityHref(item)} className={styles.capabilityLink}>
                <strong>{item.capability_title}</strong>
                <span>{item.capability_code ?? item.capability_uuid} · {item.domain ?? t('capabilities.governance.no_domain')}</span>
              </Link>
            </td>
            <td>{item.spiral_code ?? t('capabilities.governance.unassigned')}</td>
            <td>
              <div className={styles.coverageCell}>
                <ProgressBar value={item.coverage_percent} tone={toneForCoverage(item.coverage_percent)} label={t('capabilities.governance.coverage_aria', { title: item.capability_title })} />
                <span>{item.coverage_percent}% · {t(gapCountKey(item.gap_count ?? 0), { count: item.gap_count ?? 0 })}</span>
              </div>
            </td>
            <td><ServicesCell services={item.services ?? []} /></td>
            <td>
              {mode === 'overlaps' ? (
                <span className={styles.scoreText}>
                  {t('capabilities.governance.overlap_score', { score: item.overlap_score ?? item.service_count * 25 })}
                  <br />
                  {item.recommended_action ?? t('capabilities.governance.review_duplicates')}
                </span>
              ) : mode === 'gaps' ? (
                <span className={styles.actionText}>{item.recommended_action ?? t('capabilities.governance.review_mapping')}</span>
              ) : (
                <Badge variant={readinessVariant(item.readiness_state)}>{stateLabel(t, item.readiness_state ?? item.governance_state ?? undefined)}</Badge>
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
  const t = useT();
  const search = useSearchParams();
  const copy = MODE_COPY[mode];
  const query = buildQuery(search);
  const { data, isLoading, error } = useSWR<CapabilityGovernanceResponse>(`${copy.endpoint}${query}`, apiFetch, { revalidateOnFocus: false });

  if (isLoading) return <div className={styles.state}>{t('capabilities.governance.loading')}</div>;
  if (error || !data) return <div className={styles.state}>{t('capabilities.governance.unavailable')}</div>;

  const content = (
    <>
      {!embedded && (
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>{t('capabilities.governance.eyebrow')}</span>
            <h1 className={styles.title}>{t(copy.titleKey)}</h1>
            <p className={styles.lead}>{t(copy.leadKey)}</p>
          </div>
          <div className={styles.pills}>
            <Link href="/capabilities" className={styles.pill}>{t('capabilities.governance.hub_link')}</Link>
            <Link href="/c3/capability-map-spiral7" className={styles.pill}>{t('capabilities.hub.spiral7_map')}</Link>
          </div>
        </header>
      )}

      {embedded && (
        <section className={styles.panel}>
          <span className={styles.eyebrow}>{t('capabilities.governance.eyebrow')}</span>
          <h2 className={styles.panelTitle}>{t(copy.titleKey)}</h2>
          <p className={styles.bodyText}>{t(copy.leadKey)}</p>
        </section>
      )}

      <section className={styles.kpiGrid} aria-label={t('capabilities.governance.kpi_aria')}>
        <KpiCard label={t('capabilities.governance.kpi.total')} value={data.counts.total} hint={t('capabilities.governance.kpi.total_hint')} />
        <KpiCard label={t('capabilities.governance.kpi.not_ready')} value={data.counts.not_ready ?? 0} hint={t('capabilities.governance.kpi.not_ready_hint')} />
        <KpiCard label={t('capabilities.governance.kpi.over_covered')} value={data.counts.over_covered ?? 0} hint={t('capabilities.governance.kpi.over_covered_hint')} />
      </section>

      <nav className={styles.tabs} aria-label={t('capabilities.governance.sections_aria')}>
        <Link href={modeHref('coverage', navigationMode)} className={`${styles.tab} ${mode === 'coverage' ? styles.tabActive : ''}`}>{t('capabilities.view.coverage')}</Link>
        <Link href={modeHref('gaps', navigationMode)} className={`${styles.tab} ${mode === 'gaps' ? styles.tabActive : ''}`}>{t('capabilities.view.gaps')}</Link>
        <Link href={modeHref('overlaps', navigationMode)} className={`${styles.tab} ${mode === 'overlaps' ? styles.tabActive : ''}`}>{t('capabilities.view.overlaps')}</Link>
      </nav>

      <FilterBar mode={mode} navigationMode={navigationMode} />

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>{t('capabilities.governance.summary_title')}</h2>
            <p className={styles.bodyText}>{t('capabilities.governance.summary_hint')}</p>
          </div>
          <Badge variant="info">{t(rowCountKey(data.items.length), { count: data.items.length })}</Badge>
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
