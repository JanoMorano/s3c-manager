/**
 * Catalogue List: filter rail + list rows
 * Priority: 1) find a service 2) compare it 3) open the detail
 * URL-persisted filters: all state lives in search params so URLs are shareable.
 */
'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import Link from '@/app/components/AppLink';
import { useSearchParams, useRouter } from 'next/navigation';
import { useServices, usePortfolioGroups, useNetworkDomains, useCatalogQualitySummary } from '@/features/services/hooks/useServices';
import { ServiceListRow, ServiceListHeader } from '@/features/services/components/ServiceListRow';
import { Button } from '@/design-system/controls/Button';
import { Select } from '@/design-system/controls/Select';
import { Checkbox } from '@/design-system/controls/Checkbox';
import { authHeaders, buildListCsvExportUrl } from '@/features/services/api/services.api';
import type { SortField, SortOrder } from '@/features/services/api/services.api';
import { AUTH_STATE_EVENT, restoreAuthSession } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { COUNT_LABELS, formatCountLabel } from '../../lib/counts';
import styles from '../../catalogue.module.css';

const LIFECYCLE_OPTIONS = ['draft', 'live', 'deprecated', 'retired'] as const;
type LifecycleOption = typeof LIFECYCLE_OPTIONS[number];
type QuickFilterState = { readiness: string; reviewDue: string; lifecycles: LifecycleOption[] };
type QuickFilter = {
  id: string;
  label: string;
  hint: string;
  updates: Record<string, string | readonly string[] | undefined>;
  isActive: (state: QuickFilterState) => boolean;
};
const READINESS_OPTIONS = [
  { value: 'blocked', label: 'Blocked (<50%)' },
  { value: 'warning', label: 'Warning (50-79%)' },
  { value: 'ready', label: 'Ready (80%+)' },
  { value: 'missing_owner', label: 'Missing owner' },
  { value: 'missing_request', label: 'Missing request channel' },
  { value: 'missing_capability', label: 'Missing capability' },
];

const QUICK_FILTERS: QuickFilter[] = [
  {
    id: 'missing-owner',
    label: 'Missing owner',
    hint: 'Services without an active service owner',
    updates: { readiness: 'missing_owner', review_due: undefined, lifecycle: undefined },
    isActive: ({ readiness }) => readiness === 'missing_owner',
  },
  {
    id: 'blocked',
    label: 'Readiness blocked',
    hint: 'Completeness under 50%',
    updates: { readiness: 'blocked', review_due: undefined, lifecycle: undefined },
    isActive: ({ readiness }) => readiness === 'blocked',
  },
  {
    id: 'missing-request',
    label: 'Missing request channel',
    hint: 'Requestable services with no ordering path',
    updates: { readiness: 'missing_request', review_due: undefined, lifecycle: undefined },
    isActive: ({ readiness }) => readiness === 'missing_request',
  },
  {
    id: 'reviews-due',
    label: 'Reviews due',
    hint: 'Reviews past their due date',
    updates: { review_due: 'overdue', readiness: undefined, lifecycle: undefined },
    isActive: ({ reviewDue }) => reviewDue === 'overdue',
  },
  {
    id: 'deprecated-retired',
    label: 'Deprecated/retired services',
    hint: 'Services outside the live catalogue path',
    updates: { lifecycle: ['deprecated', 'retired'], readiness: undefined, review_due: undefined },
    isActive: ({ lifecycles }) => lifecycles.includes('deprecated') && lifecycles.includes('retired'),
  },
];

const LIFECYCLE_LABEL: Record<LifecycleOption, string> = {
  draft: 'Draft', live: 'Live', deprecated: 'Deprecated', retired: 'Retired',
};

const LIFECYCLE_DOT: Record<LifecycleOption, string> = {
  draft: 'var(--color-text-muted)', live: 'var(--color-success)', deprecated: 'var(--color-warning)', retired: 'var(--color-danger)',
};

function isLifecycleOption(value: string): value is LifecycleOption {
  return LIFECYCLE_OPTIONS.includes(value as LifecycleOption);
}

function normalizeLifecycleFilter(value: string) {
  const normalized = value.trim().toLowerCase();
  if (['draft', 'planned', 'design', 'under_review', 'approved'].includes(normalized)) return 'draft';
  if (['live', 'active', 'published', 'production'].includes(normalized)) return 'live';
  if (['deprecated', 'retiring'].includes(normalized)) return 'deprecated';
  if (normalized === 'retired') return 'retired';
  return '';
}

// ── Inner component (needs Suspense boundary for useSearchParams) ─────────────
function CatalogueInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { data: networkDomains }  = useNetworkDomains();
  const domainOptions = networkDomains?.map(d => d.code) ?? ['NEXUS','VERTEX','ORBIT','PULSE','RELAY','CLOUD','GRID','PRISM','HELIX','ZENITH','APEX','VORTEX','MATRIX'];
  const getSearchParam = (key: string) => searchParams?.get(key) ?? null;

  // Read all filter state from URL params
  const search     = getSearchParam('search')    ?? '';
  const domainParam = getSearchParam('domain');
  const domains    = useMemo(() => domainParam ? domainParam.split(',') : [], [domainParam]);
  const owner      = getSearchParam('owner')     ?? '';
  const portfolio  = getSearchParam('portfolio') ?? '';
  const lifecycleParam = getSearchParam('lifecycle');
  const lifecycles = useMemo(() => Array.from(new Set(
    (lifecycleParam ? lifecycleParam.split(',') : [])
      .map(normalizeLifecycleFilter)
      .filter(isLifecycleOption),
  )), [lifecycleParam]);
  const readiness  = getSearchParam('readiness') ?? '';
  const reviewDue  = getSearchParam('review_due') ?? '';
  const sort      = (getSearchParam('sort')    ?? 'service_id') as SortField;
  const order     = (getSearchParam('order')   ?? 'ASC') as SortOrder;
  const page      = Math.max(1, Number(getSearchParam('page') ?? '1') || 1);
  const limit     = Math.min(200, Math.max(25, Number(getSearchParam('limit') ?? '50') || 50));

  const { data: portfolioGroups } = usePortfolioGroups();
  const domainColorMap = useMemo(
    () => new Map((networkDomains ?? []).map((domain) => [domain.code, domain.color_hex ?? undefined])),
    [networkDomains],
  );

  // Helper: push updated URL params
  const pushParams = useCallback((updates: Record<string, string | readonly string[] | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [key, value] of Object.entries(updates)) {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else {
        params.set(key, Array.isArray(value) ? value.join(',') : String(value));
      }
    }
    router.push(`/services/list?${params.toString()}`);
  }, [searchParams, router]);

  const toggleMulti = useCallback((val: string, arr: string[], key: string) => {
    const next = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
    pushParams({ [key]: next, page: undefined });
  }, [pushParams]);

  const clearAll = useCallback(() => {
    router.push('/services/list');
  }, [router]);

  // Build filter params for hook
  const params = useMemo(() => ({
    search:      search || undefined,
    domain:      domains.length    ? domains.join(',')    : undefined,
    owner:       owner || undefined,
    portfolio:   portfolio || undefined,
    lifecycle:   lifecycles.length ? lifecycles.join(',') : undefined,
    readiness:   readiness || undefined,
    reviewDue:   reviewDue || undefined,
    page,
    limit,
    sort,
    order,
  }), [domains, lifecycles, limit, order, owner, page, portfolio, readiness, reviewDue, search, sort]);

  const { data, isLoading, error } = useServices(params);
  const { data: qualityData } = useCatalogQualitySummary();
  const hasFilters = !!(domains.length || owner || portfolio || search || lifecycles.length || readiness || reviewDue);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));
  const [role, setRole] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const canExport = hasRoleAccess(role, 'editor');

  useEffect(() => {
    let cancelled = false;
    const syncRole = async () => {
      const snapshot = await restoreAuthSession();
      if (!cancelled) setRole(snapshot?.role ?? null);
    };

    void syncRole();
    window.addEventListener(AUTH_STATE_EVENT, syncRole);
    window.addEventListener('focus', syncRole);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_STATE_EVENT, syncRole);
      window.removeEventListener('focus', syncRole);
    };
  }, []);

  const exportFilteredCsv = useCallback(async () => {
    if (!canExport) {
      setExportError('CSV export vyžaduje roli Content Admin nebo Admin.');
      return;
    }
    setExportError(null);
    try {
      const response = await fetch(buildListCsvExportUrl(params), { credentials: 'include', headers: authHeaders() });
      if (!response.ok) {
        const requestId = response.headers.get('x-request-id');
        throw new Error(`CSV export selhal: ${response.status}${requestId ? ` (request ${requestId})` : ''}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `service-catalogue-filtered-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'CSV export selhal.');
    }
  }, [canExport, params]);

  const quality = qualityData?.item;

  return (
    <div className={styles.shell}>

      {/* ── Filter rail ──────────────────────────────────────────────── */}
      <aside className={styles.rail} aria-label="Filters">
        <div className={styles.railSection}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Search services…"
            value={search}
            onChange={e => pushParams({ search: e.target.value || undefined, page: undefined })}
            aria-label="Search services"
          />
        </div>

        <FilterGroup label="Portfolio">
          <Select
            value={portfolio}
            onChange={e => pushParams({ portfolio: e.target.value || undefined, page: undefined })}
            placeholder="All portfolios"
            options={portfolioGroups?.map(pg => ({ value: pg.code, label: pg.name })) ?? []}
          />
        </FilterGroup>

        <FilterGroup label="Owner">
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Exact service owner"
            value={owner}
            onChange={e => pushParams({ owner: e.target.value || undefined, page: undefined })}
            aria-label="Filter by owner"
          />
        </FilterGroup>

        <FilterGroup label="Lifecycle">
          {LIFECYCLE_OPTIONS.map(lc => (
            <div key={lc} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: LIFECYCLE_DOT[lc], display: 'inline-block', flexShrink: 0 }} />
              <Checkbox
                label={LIFECYCLE_LABEL[lc]}
                checked={lifecycles.includes(lc)}
                onChange={() => toggleMulti(lc, lifecycles, 'lifecycle')}
              />
            </div>
          ))}
        </FilterGroup>

        <FilterGroup label="Readiness">
          <Select
            value={readiness}
            onChange={e => pushParams({ readiness: e.target.value || undefined, page: undefined })}
            placeholder="Any readiness state"
            options={READINESS_OPTIONS}
          />
        </FilterGroup>

        <FilterGroup label="Domains">
          <div className={styles.domainFilterGrid}>
            {domainOptions.map(d => {
              const active = domains.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={`${styles.domainFilterChip} ${active ? styles.domainFilterChipActive : ''}`}
                  style={{
                    borderColor: domainColorMap.get(d) ?? undefined,
                    background: active ? (domainColorMap.get(d) ?? 'var(--color-bg-canvas)') : undefined,
                  }}
                  onClick={() => toggleMulti(d, domains, 'domain')}
                  title={d}
                >
                  <span>{d}</span>
                </button>
              );
            })}
          </div>
        </FilterGroup>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>Clear filters</Button>
        )}

      </aside>

      {/* ── List area ────────────────────────────────────────────────── */}
      <main className={styles.content} aria-label="Service list">
        <header className={styles.listPageHeader}>
          <div>
            <h1 className={styles.listPageTitle}>Services</h1>
            <p className={styles.listPagePurpose}>Pracovní katalog služeb pro správu, review a export.</p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/services/graph" className={styles.headerSecondaryAction}>Graph view</Link>
            <Link href="/management/new-service" className={styles.headerPrimaryAction}>New service</Link>
          </div>
        </header>

        <div className={styles.quickFilterBar} aria-label="Quick service filters">
          <span className={styles.quickFilterLabel}>Quick filters</span>
          {QUICK_FILTERS.map((filter) => {
            const active = filter.isActive({ readiness, reviewDue, lifecycles });
            return (
              <button
                key={filter.id}
                type="button"
                className={`${styles.quickFilterChip} ${active ? styles.quickFilterChipActive : ''}`}
                aria-pressed={active}
                title={filter.hint}
                onClick={() => pushParams({ ...filter.updates, page: undefined })}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {quality && (
          <section className={styles.qualityStrip} aria-label="Catalog data quality">
            <div className={styles.qualityIntro}>
              <strong>Catalog quality</strong>
              <span>{quality.total_services} services checked</span>
            </div>
            <Link href="/services/list?readiness=missing_owner" className={styles.qualityCard}>
              <strong>{quality.missing_owner_count}</strong>
              <span>without owner</span>
            </Link>
            <Link href="/services/list?readiness=missing_request" className={styles.qualityCard}>
              <strong>{quality.missing_request_channel_count}</strong>
              <span>missing request path</span>
            </Link>
            <Link href="/services/list?review_due=overdue" className={styles.qualityCard}>
              <strong>{quality.overdue_review_count}</strong>
              <span>reviews overdue</span>
            </Link>
            <Link href="/services/list?readiness=missing_capability" className={styles.qualityCard}>
              <strong>{quality.missing_capability_count}</strong>
              <span>without capability</span>
            </Link>
            <Link href="/services/graph" className={styles.qualityCard}>
              <strong>{quality.unverified_relation_count}</strong>
              <span>unverified relations</span>
            </Link>
          </section>
        )}

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <span className={styles.resultCount} aria-live="polite">
            {isLoading ? 'Načítám…' : error ? 'Načtení služeb selhalo' : formatCountLabel(data?.total ?? 0, COUNT_LABELS.services)}
          </span>
          <div className={styles.toolbarRight}>
            <select
              className={styles.pageSizeSelect}
              value={String(limit)}
              onChange={(event) => pushParams({ limit: event.target.value, page: '1' })}
              aria-label="Page size"
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { void exportFilteredCsv(); }}
              disabled={!data?.total || !canExport}
              title={canExport ? 'Export filtered services as CSV' : 'CSV export vyžaduje roli Content Admin nebo Admin'}
            >
              Export CSV
            </Button>
          </div>
        </div>
        {exportError && <div className={styles.inlineAlert} role="alert">{exportError}</div>}

        {/* List */}
        <div className={styles.list}>
          {!isLoading && !error && (data?.items?.length ?? 0) > 0 && (
            <ServiceListHeader
              sort={sort}
              order={order}
              onSort={(field) => {
                if (field === sort) {
                  pushParams({ order: order === 'ASC' ? 'DESC' : 'ASC', page: undefined });
                  return;
                }
                pushParams({ sort: field, order: 'ASC', page: undefined });
              }}
            />
          )}

          {isLoading && <div className={styles.state}>Loading services…</div>}

          {error && (
            <div className={styles.stateError}>
              Failed to load services. Check middleware connection.
            </div>
          )}

          {!isLoading && !error && (data?.items?.length ?? 0) === 0 && (
            <div className={styles.state}>No services match the current filters.</div>
          )}

          {data?.items?.map(svc => (
            <ServiceListRow key={svc.service_id} service={svc} />
          ))}
        </div>

        {!isLoading && !error && (data?.total ?? 0) > 0 && (
          <div className={styles.paginationBar}>
            <span className={styles.paginationMeta}>
              Strana {page} z {totalPages}
            </span>
            <div className={styles.paginationButtons}>
              <Button variant="ghost" size="sm" onClick={() => pushParams({ page: String(page - 1) })} disabled={page <= 1}>
                Předchozí
              </Button>
              <Button variant="ghost" size="sm" onClick={() => pushParams({ page: String(page + 1) })} disabled={page >= totalPages}>
                Další
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CataloguePage() {
  return (
    <Suspense fallback={<div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>}>
      <CatalogueInner />
    </Suspense>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.railSection}>
      <div className={styles.filterLabel}>{label}</div>
      <div className={styles.filterOptions}>{children}</div>
    </div>
  );
}
