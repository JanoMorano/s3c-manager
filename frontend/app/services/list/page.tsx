/**
 * §9.1 Catalogue List — Pattern A: filter rail + list rows
 * Priority: 1) find a service 2) compare it 3) open the detail
 * URL-persisted filters: all state lives in search params so URLs are shareable.
 */
'use client';

import { useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useServices, usePortfolioGroups, useServiceTypes, useNetworkDomains } from '@/features/services/hooks/useServices';
import { ServiceListRow, ServiceListHeader } from '@/features/services/components/ServiceListRow';
import { Button } from '@/design-system/controls/Button';
import { Select } from '@/design-system/controls/Select';
import { Checkbox } from '@/design-system/controls/Checkbox';
import { authHeaders, buildListCsvExportUrl } from '@/features/services/api/services.api';
import type { SortField, SortOrder } from '@/features/services/api/services.api';
import { COUNT_LABELS, formatCountLabel } from '../../lib/counts';
import styles from '../../catalogue.module.css';

const STATUS_OPTIONS  = ['active', 'retired', 'deprecated', 'draft'];

// ── Inner component (needs Suspense boundary for useSearchParams) ─────────────
function CatalogueInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { data: networkDomains }  = useNetworkDomains();
  const domainOptions = networkDomains?.map(d => d.code) ?? ['NEXUS','VERTEX','ORBIT','PULSE','RELAY','CLOUD','GRID','PRISM','HELIX','ZENITH','APEX','VORTEX','MATRIX'];
  const getSearchParam = (key: string) => searchParams?.get(key) ?? null;

  // Read all filter state from URL params
  const search    = getSearchParam('search')   ?? '';
  const statuses  = getSearchParam('status')   ? getSearchParam('status')!.split(',') : [];
  const domains   = getSearchParam('domain')   ? getSearchParam('domain')!.split(',') : [];
  const portfolio = getSearchParam('portfolio') ?? '';
  const type      = getSearchParam('type')      ?? '';
  const density   = (getSearchParam('density') ?? 'comfortable') as 'comfortable' | 'compact';
  const sort      = (getSearchParam('sort')    ?? 'service_id') as SortField;
  const order     = (getSearchParam('order')   ?? 'ASC') as SortOrder;
  const page      = Math.max(1, Number(getSearchParam('page') ?? '1') || 1);
  const limit     = Math.min(200, Math.max(25, Number(getSearchParam('limit') ?? '50') || 50));

  const { data: portfolioGroups } = usePortfolioGroups();
  const { data: serviceTypes }    = useServiceTypes();
  const domainColorMap = useMemo(
    () => new Map((networkDomains ?? []).map((domain) => [domain.code, domain.color_hex ?? undefined])),
    [networkDomains],
  );

  // Helper: push updated URL params
  const pushParams = useCallback((updates: Record<string, string | string[] | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [key, value] of Object.entries(updates)) {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else {
        params.set(key, Array.isArray(value) ? value.join(',') : value);
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

  // Saved views from localStorage
  const saveCurrentView = useCallback(() => {
    const name = prompt('Save current view as:');
    if (!name) return;
    const saved = JSON.parse(localStorage.getItem('sc_saved_views') ?? '{}');
    saved[name] = searchParams?.toString() ?? '';
    localStorage.setItem('sc_saved_views', JSON.stringify(saved));
  }, [searchParams]);

  const getSavedViews = useCallback(() => {
    try { return JSON.parse(localStorage.getItem('sc_saved_views') ?? '{}') as Record<string, string>; }
    catch { return {}; }
  }, []);
  const savedViews = getSavedViews();
  const hasSavedViews = Object.keys(savedViews).length > 0;

  // Build filter params for hook
  const params = {
    search:    search || undefined,
    status:    statuses.length  ? statuses.join(',')  : undefined,
    domain:    domains.length   ? domains.join(',')   : undefined,
    portfolio: portfolio || undefined,
    type:      type || undefined,
    page,
    limit,
    sort,
    order,
  };

  const { data, isLoading, error } = useServices(params);
  const hasFilters = !!(statuses.length || domains.length || portfolio || type || search);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  const exportFilteredCsv = useCallback(async () => {
    const response = await fetch(buildListCsvExportUrl(params), { headers: authHeaders() });
    if (!response.ok) {
      throw new Error(`CSV export selhal: ${response.status}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `service-catalogue-filtered-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [params]);

  return (
    <div className={styles.shell}>

      {/* ── Filter rail (Pattern A left) ─────────────────────────────── */}
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

        <FilterGroup label="Status">
          {STATUS_OPTIONS.map(s => (
            <Checkbox
              key={s}
              label={s.charAt(0).toUpperCase() + s.slice(1)}
              checked={statuses.includes(s)}
              onChange={() => toggleMulti(s, statuses, 'status')}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Portfolio">
          <Select
            value={portfolio}
            onChange={e => pushParams({ portfolio: e.target.value || undefined, page: undefined })}
            placeholder="All portfolios"
            options={portfolioGroups?.map(pg => ({ value: pg.code, label: pg.name })) ?? []}
          />
        </FilterGroup>

        <FilterGroup label="Type">
          <Select
            value={type}
            onChange={e => pushParams({ type: e.target.value || undefined, page: undefined })}
            placeholder="All types"
            options={serviceTypes?.map(t => ({ value: t.code, label: `${t.code} — ${t.name}` })) ?? []}
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

        {/* ── Saved Views ─────────────────────────────────────────────── */}
        <div className={styles.railSection}>
          <div className={styles.filterLabel}>Saved Views</div>
          {hasSavedViews && (
            <div className={styles.savedViewsList}>
              {Object.entries(savedViews).map(([name, qs]) => (
                <button
                  key={name}
                  className={styles.savedViewBtn}
                  onClick={() => router.push(`/services/list?${qs}`)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={saveCurrentView}>
            + Save current view
          </Button>
        </div>
      </aside>

      {/* ── List area (Pattern A right) ───────────────────────────────── */}
      <main className={styles.content} aria-label="Service list">

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <span className={styles.resultCount}>
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
            <Button variant="ghost" size="sm" onClick={() => { void exportFilteredCsv(); }} disabled={!data?.total}>
              Export CSV
            </Button>
            <DensityToggle
              value={density}
              onChange={d => pushParams({ density: d })}
            />
          </div>
        </div>

        {/* List */}
        <div className={styles.list}>
          {!isLoading && !error && (data?.items?.length ?? 0) > 0 && (
            <ServiceListHeader
              density={density}
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
            <ServiceListRow key={svc.service_id} service={svc} density={density} />
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


function DensityToggle({ value, onChange }: { value: 'comfortable' | 'compact'; onChange: (v: 'comfortable' | 'compact') => void }) {
  return (
    <div className={styles.densityToggle}>
      <Button variant={value === 'comfortable' ? 'secondary' : 'ghost'} size="sm" onClick={() => onChange('comfortable')} title="Comfortable">≡</Button>
      <Button variant={value === 'compact'     ? 'secondary' : 'ghost'} size="sm" onClick={() => onChange('compact')}     title="Compact">☰</Button>
    </div>
  );
}
