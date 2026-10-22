/**
 * Catalogue List: filter rail + list rows
 * Priority: 1) find a service 2) compare it 3) open the detail
 * URL-persisted filters: all state lives in search params so URLs are shareable.
 */
'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import Link from '@/app/components/AppLink';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDebouncedInput } from '@/hooks/useDebouncedInput';
import { useStoredToggle } from '@/hooks/useStoredToggle';
import { useServices, usePortfolioGroups, useNetworkDomains, useCatalogQualitySummary } from '@/features/services/hooks/useServices';
import { ServiceListRow, ServiceListHeader } from '@/features/services/components/ServiceListRow';
import { Button } from '@/design-system/controls/Button';
import { Select } from '@/design-system/controls/Select';
import { Checkbox } from '@/design-system/controls/Checkbox';
import { authHeaders, buildListCsvExportUrl } from '@/features/services/api/services.api';
import type { SortField, SortOrder } from '@/features/services/api/services.api';
import { AUTH_STATE_EVENT, restoreAuthSession } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { formatCountLabel } from '../../lib/counts';
import { useT } from '@/app/i18n/useI18n';
import styles from '../../catalogue.module.css';

const LIFECYCLE_OPTIONS = ['draft', 'live', 'deprecated', 'retired'] as const;
type LifecycleOption = typeof LIFECYCLE_OPTIONS[number];
type QuickFilterState = { readiness: string; reviewDue: string; lifecycles: LifecycleOption[] };
type QuickFilter = {
  id: string;
  labelKey: string;
  hintKey: string;
  updates: Record<string, string | readonly string[] | undefined>;
  isActive: (state: QuickFilterState) => boolean;
};
// blocked / warning / ready follow the readiness rules (readiness gate);
// completeness bands are a separate, data-quality view.
const READINESS_OPTIONS = [
  { value: 'blocked', labelKey: 'service_list.readiness_option.blocked' },
  { value: 'warning', labelKey: 'service_list.readiness_option.warning' },
  { value: 'attention', labelKey: 'service_list.readiness_option.attention' },
  { value: 'publishable', labelKey: 'service_list.readiness_option.publishable' },
  { value: 'ready', labelKey: 'service_list.readiness_option.ready' },
  { value: 'completeness_low', labelKey: 'service_list.readiness_option.completeness_low' },
  { value: 'completeness_medium', labelKey: 'service_list.readiness_option.completeness_medium' },
  { value: 'missing_owner', labelKey: 'service_list.readiness_option.missing_owner' },
  { value: 'missing_request', labelKey: 'service_list.readiness_option.missing_request' },
  { value: 'missing_capability', labelKey: 'service_list.readiness_option.missing_capability' },
];

const QUICK_FILTERS: QuickFilter[] = [
  {
    id: 'missing-owner',
    labelKey: 'service_list.quick_filter.missing_owner.label',
    hintKey: 'service_list.quick_filter.missing_owner.hint',
    updates: { readiness: 'missing_owner', review_due: undefined, lifecycle: undefined },
    isActive: ({ readiness }) => readiness === 'missing_owner',
  },
  {
    id: 'blocked',
    labelKey: 'service_list.quick_filter.blocked.label',
    hintKey: 'service_list.quick_filter.blocked.hint',
    updates: { readiness: 'blocked', review_due: undefined, lifecycle: undefined },
    isActive: ({ readiness }) => readiness === 'blocked',
  },
  {
    id: 'missing-request',
    labelKey: 'service_list.quick_filter.missing_request.label',
    hintKey: 'service_list.quick_filter.missing_request.hint',
    updates: { readiness: 'missing_request', review_due: undefined, lifecycle: undefined },
    isActive: ({ readiness }) => readiness === 'missing_request',
  },
  {
    id: 'reviews-due',
    labelKey: 'service_list.quick_filter.reviews_due.label',
    hintKey: 'service_list.quick_filter.reviews_due.hint',
    updates: { review_due: 'overdue', readiness: undefined, lifecycle: undefined },
    isActive: ({ reviewDue }) => reviewDue === 'overdue',
  },
  {
    id: 'deprecated-retired',
    labelKey: 'service_list.quick_filter.deprecated_retired.label',
    hintKey: 'service_list.quick_filter.deprecated_retired.hint',
    updates: { lifecycle: ['deprecated', 'retired'], readiness: undefined, review_due: undefined },
    isActive: ({ lifecycles }) => lifecycles.includes('deprecated') && lifecycles.includes('retired'),
  },
];

const LIFECYCLE_LABEL_KEY: Record<LifecycleOption, string> = {
  draft: 'service_list.lifecycle.draft', live: 'service_list.lifecycle.live', deprecated: 'service_list.lifecycle.deprecated', retired: 'service_list.lifecycle.retired',
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
  const t            = useT();
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
  const requestableParam = getSearchParam('requestable') ?? '';
  const requestable = requestableParam === 'true' ? true : requestableParam === 'false' ? false : undefined;
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
  const pushParams = useCallback((updates: Record<string, string | readonly string[] | undefined>, options?: { replace?: boolean }) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [key, value] of Object.entries(updates)) {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else {
        params.set(key, Array.isArray(value) ? value.join(',') : String(value));
      }
    }
    const href = `/services/list?${params.toString()}`;
    if (options?.replace) router.replace(href);
    else router.push(href);
  }, [searchParams, router]);

  // Text filters commit to the URL after a typing pause and replace the
  // history entry, so Back still leaves the page instead of undoing keystrokes.
  const commitSearch = useCallback((value: string) => pushParams({ search: value || undefined, page: undefined }, { replace: true }), [pushParams]);
  const commitOwner = useCallback((value: string) => pushParams({ owner: value || undefined, page: undefined }, { replace: true }), [pushParams]);
  const [searchDraft, setSearchDraft, cancelSearchDraft] = useDebouncedInput(search, commitSearch);
  const [ownerDraft, setOwnerDraft, cancelOwnerDraft] = useDebouncedInput(owner, commitOwner);

  const toggleMulti = useCallback((val: string, arr: string[], key: string) => {
    const next = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
    pushParams({ [key]: next, page: undefined });
  }, [pushParams]);

  const clearAll = useCallback(() => {
    cancelSearchDraft();
    cancelOwnerDraft();
    router.push('/services/list');
  }, [cancelOwnerDraft, cancelSearchDraft, router]);

  // Build filter params for hook
  const params = useMemo(() => ({
    search:      search || undefined,
    domain:      domains.length    ? domains.join(',')    : undefined,
    owner:       owner || undefined,
    portfolio:   portfolio || undefined,
    lifecycle:   lifecycles.length ? lifecycles.join(',') : undefined,
    readiness:   readiness || undefined,
    reviewDue:   reviewDue || undefined,
    requestable,
    page,
    limit,
    sort,
    order,
  }), [domains, lifecycles, limit, order, owner, page, portfolio, readiness, requestable, reviewDue, search, sort]);

  const { data, isLoading, error } = useServices(params);
  const { data: qualityData } = useCatalogQualitySummary();
  const hasFilters = !!(domains.length || owner || portfolio || search || lifecycles.length || readiness || reviewDue || requestableParam);
  const activeFilterCount = [owner, portfolio, search, readiness, reviewDue, requestableParam].filter(Boolean).length
    + (domains.length ? 1 : 0) + (lifecycles.length ? 1 : 0);
  const [railCollapsed, toggleRail] = useStoredToggle('s3c_services_filters_collapsed');
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
      setExportError(t('service_list.export.role_required'));
      return;
    }
    setExportError(null);
    try {
      const response = await fetch(buildListCsvExportUrl(params), { credentials: 'include', headers: authHeaders() });
      if (!response.ok) {
        const requestId = response.headers.get('x-request-id');
        throw new Error(t('service_list.export.failed_status', { status: response.status, request: requestId ? ` (request ${requestId})` : '' }));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `service-catalogue-filtered-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('service_list.export.failed'));
    }
  }, [canExport, params, t]);

  const quality = qualityData?.item;

  return (
    <div className={`${styles.shell} ${railCollapsed ? styles.shellRailCollapsed : ''}`}>

      {/* ── Filter rail ──────────────────────────────────────────────── */}
      <aside id="service-filter-rail" className={styles.rail} aria-label={t('service_list.filters_aria')}>
        <div className={styles.railSection}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder={t('service_list.search_placeholder')}
            value={searchDraft}
            onChange={e => setSearchDraft(e.target.value)}
            aria-label={t('service_list.search_aria')}
          />
        </div>

        <FilterGroup label={t('service_list.filter.portfolio')}>
          <Select
            value={portfolio}
            onChange={e => pushParams({ portfolio: e.target.value || undefined, page: undefined })}
            placeholder={t('service_list.all_portfolios')}
            options={portfolioGroups?.map(pg => ({ value: pg.code, label: pg.name })) ?? []}
          />
        </FilterGroup>

        <FilterGroup label={t('service_list.filter.owner')}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder={t('service_list.owner_placeholder')}
            value={ownerDraft}
            onChange={e => setOwnerDraft(e.target.value)}
            aria-label={t('service_list.owner_aria')}
          />
        </FilterGroup>

        <FilterGroup label={t('service_list.filter.lifecycle')}>
          {LIFECYCLE_OPTIONS.map(lc => (
            <div key={lc} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: LIFECYCLE_DOT[lc], display: 'inline-block', flexShrink: 0 }} />
              <Checkbox
                label={t(LIFECYCLE_LABEL_KEY[lc])}
                checked={lifecycles.includes(lc)}
                onChange={() => toggleMulti(lc, lifecycles, 'lifecycle')}
              />
            </div>
          ))}
        </FilterGroup>

        <FilterGroup label={t('service_list.filter.readiness')}>
          <Select
            value={readiness}
            onChange={e => pushParams({ readiness: e.target.value || undefined, page: undefined })}
            placeholder={t('service_list.any_readiness')}
            options={READINESS_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
          />
        </FilterGroup>

        <FilterGroup label={t('service_list.filter.domains')}>
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
          <Button variant="ghost" size="sm" onClick={clearAll}>{t('service_list.clear_filters')}</Button>
        )}

      </aside>

      {/* ── List area ────────────────────────────────────────────────── */}
      <main className={styles.content} aria-label={t('service_list.list_aria')}>
        <header className={styles.listPageHeader}>
          <div>
            <h1 className={styles.listPageTitle}>{t('service_list.title')}</h1>
            <p className={styles.listPagePurpose}>{t('service_list.purpose')}</p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/services/graph" className={styles.headerSecondaryAction}>{t('service_list.graph_view')}</Link>
            <Link href="/management/new-service" className={styles.headerPrimaryAction}>{t('service_list.new_service')}</Link>
          </div>
        </header>

        <div className={styles.quickFilterBar} aria-label={t('service_list.quick_filters_aria')}>
          <span className={styles.quickFilterLabel}>{t('service_list.quick_filters')}</span>
          {QUICK_FILTERS.map((filter) => {
            const active = filter.isActive({ readiness, reviewDue, lifecycles });
            return (
              <button
                key={filter.id}
                type="button"
                className={`${styles.quickFilterChip} ${active ? styles.quickFilterChipActive : ''}`}
                aria-pressed={active}
                title={t(filter.hintKey)}
                onClick={() => pushParams({ ...filter.updates, page: undefined })}
              >
                {t(filter.labelKey)}
              </button>
            );
          })}
        </div>

        {quality && (
          <section className={styles.qualityStrip} aria-label={t('service_list.quality.aria')}>
            <div className={styles.qualityIntro}>
              <strong>{t('service_list.quality.title')}</strong>
              <span>{formatCountLabel(quality.total_services, {
                one: t('service_list.quality.checked.one'),
                few: t('service_list.quality.checked.few'),
                many: t('service_list.quality.checked.many'),
              })}</span>
            </div>
            <Link href="/services/list?readiness=missing_owner" className={styles.qualityCard}>
              <strong>{quality.missing_owner_count}</strong>
              <span>{t('service_list.quality.without_owner')}</span>
            </Link>
            <Link href="/services/list?readiness=missing_request" className={styles.qualityCard}>
              <strong>{quality.missing_request_channel_count}</strong>
              <span>{t('service_list.quality.missing_request_path')}</span>
            </Link>
            <Link href="/services/list?review_due=overdue" className={styles.qualityCard}>
              <strong>{quality.overdue_review_count}</strong>
              <span>{t('service_list.quality.reviews_overdue')}</span>
            </Link>
            <Link href="/services/list?readiness=missing_capability" className={styles.qualityCard}>
              <strong>{quality.missing_capability_count}</strong>
              <span>{t('service_list.quality.without_capability')}</span>
            </Link>
            <Link href="/services/graph" className={styles.qualityCard}>
              <strong>{quality.unverified_relation_count}</strong>
              <span>{t('service_list.quality.unverified_relations')}</span>
            </Link>
          </section>
        )}

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <button
              type="button"
              className={styles.railToggle}
              onClick={toggleRail}
              aria-expanded={!railCollapsed}
              aria-controls="service-filter-rail"
            >
              {railCollapsed
                ? <span key="show">{t('service_list.show_filters')}</span>
                : <span key="hide">{t('service_list.hide_filters')}</span>}
              {railCollapsed && activeFilterCount > 0 && (
                <span className={styles.railToggleCount} aria-label={t('service_list.active_filters', { count: activeFilterCount })}>{activeFilterCount}</span>
              )}
            </button>
            <span className={styles.resultCount} aria-live="polite">
              {isLoading ? t('common.loading') : error ? t('service_list.state.error_short') : formatCountLabel(data?.total ?? 0, {
                one: t('service_list.count.one'),
                few: t('service_list.count.few'),
                many: t('service_list.count.many'),
              })}
            </span>
          </div>
          <div className={styles.toolbarRight}>
            <select
              className={styles.pageSizeSelect}
              value={String(limit)}
              onChange={(event) => pushParams({ limit: event.target.value, page: '1' })}
              aria-label={t('service_list.page_size_aria')}
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>{t('service_list.page_size_option', { size })}</option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { void exportFilteredCsv(); }}
              disabled={!data?.total || !canExport}
              title={canExport ? t('service_list.export.title') : t('service_list.export.role_required')}
            >
              {t('service_list.export.button')}
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

          {isLoading && <div className={styles.state}>{t('service_list.state.loading')}</div>}

          {error && (
            <div className={styles.stateError}>
              {t('service_list.state.error')}
            </div>
          )}

          {!isLoading && !error && (data?.items?.length ?? 0) === 0 && (
            <div className={styles.state}>{t('service_list.state.empty')}</div>
          )}

          {data?.items?.map(svc => (
            <ServiceListRow key={svc.service_id} service={svc} />
          ))}
        </div>

        {!isLoading && !error && (data?.total ?? 0) > 0 && (
          <div className={styles.paginationBar}>
            <span className={styles.paginationMeta}>
              {t('service_list.pagination.page_of', { page, total: totalPages })}
            </span>
            <div className={styles.paginationButtons}>
              <Button variant="ghost" size="sm" onClick={() => pushParams({ page: String(page - 1) })} disabled={page <= 1}>
                {t('service_list.pagination.previous')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => pushParams({ page: String(page + 1) })} disabled={page >= totalPages}>
                {t('service_list.pagination.next')}
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
    <Suspense fallback={<LoadingFallback />}>
      <CatalogueInner />
    </Suspense>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function LoadingFallback() {
  const t = useT();
  return <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>;
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.railSection}>
      <div className={styles.filterLabel}>{label}</div>
      <div className={styles.filterOptions}>{children}</div>
    </div>
  );
}
