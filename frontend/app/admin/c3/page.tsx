'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from '@/app/components/AppLink';
import useSWR, { mutate as globalMutate } from 'swr';
import styles from './c3.module.css';
import catStyles from '../../catalogue.module.css';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import C3Breadcrumbs from '../../components/C3Breadcrumbs';
import { getAuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { compareText, formatDate } from '@/app/i18n/format';
import { useLocale, useT } from '@/app/i18n/useI18n';
import {
  C3_ROUTES,
  C3_TAXONOMY_TYPE_OPTIONS,
  buildC3TaxonomyListHref,
  getC3TaxonomyTypeLabel,
  readStoredC3TaxonomySort,
  storeC3TaxonomySort,
} from '../../lib/c3Routes';
import { COUNT_LABELS, formatFilteredCountLabel } from '../../lib/counts';

const BASE = '/api/v1/taxonomy';

const C3_TYPE_COLOR: Record<string, string> = {
  BP: 'var(--color-warning)',
  BR: 'var(--color-danger)',
  CP: 'var(--color-success)',
  CI: 'var(--color-warning)',
  CO: 'var(--color-text-primary)',
  CR: 'var(--color-domain-relay)',
  IP: 'var(--color-info)',
  UA: 'var(--color-domain-relay)',
};

interface C3Item {
  id: number;
  uuid: string;
  application: string | null;
  title: string;
  description: string | null;
  external_id: string | null;
  source_external_id?: string | null;
  data_source: string | null;
  item_status: string | null;
  order_num: number | null;
  level_num?: number | null;
  modification_date: string | null;
  item_type: string | null;
  parent_uuid: string | null;
  parent_code: string | null;
  parent_title: string | null;
  parent_external_id: string | null;
  datasets_raw: string | null;
  references_raw: string | null;
  mapping_count: number | null;
}

interface ResolvedLink {
  key: string;
  href: string;
  label: string;
  secondary?: string | null;
}

type SortDirection = 'asc' | 'desc';

const SORTABLE_COLUMNS = new Set([
  'external_id',
  'uuid',
  'title',
  'description',
  'parent_title',
  'datasets_raw',
  'source_external_id',
  'data_source',
  'references_raw',
  'order_num',
  'item_status',
  'level_num',
]);

function splitFilterValue(value: string | null) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

function statusClass(status: string | null): string {
  if (!status) return styles.status_default;
  const s = status.toLowerCase();
  if (s.includes('active') || s === 'published' || s === 'approved') return styles.status_active;
  if (s.includes('archive')) return styles.status_archived;
  if (s.includes('draft')) return styles.status_draft;
  if (s.includes('pending') || s.includes('review')) return styles.status_pending;
  return styles.status_default;
}

function parseCellTokens(value: string | null | undefined) {
  if (!value) return [];
  const seen = new Set<string>();
  return value
    .replace(/\r/g, '\n')
    .split(/[\n;,|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function compareValues(locale: string, left: string | number | null, right: string | number | null) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return compareText(locale, String(left), String(right), { sensitivity: 'base', numeric: true });
}

function resolveEntityHrefByCode(value: string) {
  const code = value.trim();
  if (/^APL-\d+/i.test(code)) return `${C3_ROUTES.applications}/${encodeURIComponent(code)}`;
  if (/^DOB-\d+/i.test(code)) return `${C3_ROUTES.dataObjects}/${encodeURIComponent(code)}`;
  if (/^SRV-\d+/i.test(code)) return `${C3_ROUTES.services}/${encodeURIComponent(code)}`;
  if (/^TIN-\d+/i.test(code)) return `${C3_ROUTES.technologyInteractions}/${encodeURIComponent(code)}`;
  return null;
}

function renderTokenLinks(tokens: string[], resolver: (token: string) => ResolvedLink | null) {
  if (tokens.length === 0) return '—';
  return (
    <div className={styles.cellStack}>
      {tokens.map((token) => {
        const resolved = resolver(token);
        if (!resolved) {
          return <span key={token} className={styles.cellText}>{token}</span>;
        }
        return (
          <Link key={resolved.key} href={resolved.href} className={styles.cellLink}>
            {resolved.label}
            {resolved.secondary ? <span className={styles.cellSecondary}> — {resolved.secondary}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}

function C3CatalogueInner() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useT();
  const search = searchParams?.get('search') ?? '';
  const exact = searchParams?.get('exact') ?? '';
  const itemTypeFilter = splitFilterValue(searchParams?.get('item_type') ?? null);
  const parentFilter = splitFilterValue(searchParams?.get('parent') ?? null);
  const statusFilter = splitFilterValue(searchParams?.get('status') ?? null);
  const [storedSort, setStoredSort] = useState<{ sort: string; dir: SortDirection } | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const sortParam = searchParams?.get('sort') ?? '';
  const dirParam = searchParams?.get('dir') ?? '';
  const sortKey = SORTABLE_COLUMNS.has(sortParam)
    ? sortParam
    : SORTABLE_COLUMNS.has(storedSort?.sort ?? '')
      ? String(storedSort?.sort)
      : 'order_num';
  const sortDirection: SortDirection = dirParam === 'desc'
    ? 'desc'
    : !dirParam && storedSort?.dir === 'desc'
      ? 'desc'
      : 'asc';
  const canEdit = hasRoleAccess(role, 'editor');
  const isAdmin = hasRoleAccess(role, 'admin');
  const isPublicC3Route = pathname.startsWith('/c3/');
  const showUuidColumn = !isPublicC3Route || isAdmin;
  // Hide the Edit button on the public /c3/list route; editing starts from the record detail.
  const showActionColumn = isPublicC3Route ? false : isAdmin;

  const { data, isLoading, error } = useSWR<C3Item[]>(`${BASE}/c3`, apiFetch, { revalidateOnFocus: false });
  const revalidate = () => globalMutate(`${BASE}/c3`);
  const [opErr, setOpErr] = useState<string | null>(null);

  const taxonomyByCode = useMemo(() => {
    const map = new Map<string, C3Item>();
    (data ?? []).forEach((item) => {
      const code = String(item.external_id ?? '').trim().toLowerCase();
      if (code) map.set(code, item);
    });
    return map;
  }, [data]);

  const taxonomyByUniqueTitle = useMemo(() => {
    const counts = new Map<string, number>();
    (data ?? []).forEach((item) => {
      const key = String(item.title ?? '').trim().toLowerCase();
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const map = new Map<string, C3Item>();
    (data ?? []).forEach((item) => {
      const key = String(item.title ?? '').trim().toLowerCase();
      if (!key || counts.get(key) !== 1) return;
      map.set(key, item);
    });
    return map;
  }, [data]);

  const parentOptionsKey = useMemo(() => {
    const params = new URLSearchParams();
    if (itemTypeFilter.length === 1) params.set('item_type', itemTypeFilter[0]);
    return `${BASE}/c3/parent-options${params.toString() ? `?${params.toString()}` : ''}`;
  }, [itemTypeFilter]);

  const { data: parentOptions = [] } = useSWR<string[]>(parentOptionsKey, apiFetch, { revalidateOnFocus: false });

  const statusOptions = useMemo(() => {
    const values = new Set((data ?? []).map((item) => item.item_status).filter(Boolean) as string[]);
    return [...values].sort((left, right) => compareText(locale, left, right));
  }, [data, locale]);

  const pushParams = useCallback((updates: Record<string, string | string[] | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [key, value] of Object.entries(updates)) {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else {
        params.set(key, Array.isArray(value) ? value.join(',') : value);
      }
    }
    router.push(`${C3_ROUTES.list}${params.toString() ? `?${params.toString()}` : ''}`);
  }, [router, searchParams]);

  const toggleMulti = useCallback((value: string, current: string[], key: string) => {
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    pushParams({ [key]: next });
  }, [pushParams]);

  const clearAll = useCallback(() => router.push(C3_ROUTES.list), [router]);
  const hasFilters = Boolean(search || exact || itemTypeFilter.length || parentFilter.length || statusFilter.length);

  useEffect(() => {
    setStoredSort(readStoredC3TaxonomySort());
    setRole(getAuthSnapshot()?.role ?? null);
  }, []);

  useEffect(() => {
    storeC3TaxonomySort(sortKey, sortDirection);
  }, [sortDirection, sortKey]);

  const filteredRows = useMemo(() => {
    const allRows = data ?? [];
    const query = search.trim().toLowerCase();
    const exactQuery = exact.trim().toLowerCase();
    const filtered = allRows.filter((row) => {
      if (exactQuery) {
        const exactMatches = [
          row.external_id,
          row.source_external_id,
          row.uuid,
          row.title,
        ].some((value) => String(value ?? '').trim().toLowerCase() === exactQuery);
        if (!exactMatches) return false;
      }

      if (query) {
        const haystack = [
          row.external_id,
          row.source_external_id,
          row.uuid,
          row.title,
          row.description,
          row.parent_code,
          row.parent_title,
          row.datasets_raw,
          row.references_raw,
          row.data_source,
          row.item_status,
        ].join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (itemTypeFilter.length > 0 && !itemTypeFilter.includes(String(row.item_type ?? ''))) return false;
      if (parentFilter.length > 0 && !parentFilter.includes(String(row.parent_title ?? ''))) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(String(row.item_status ?? ''))) return false;

      return true;
    });

    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((left, right) => {
      const leftValue = normalizeSortValue(left, sortKey);
      const rightValue = normalizeSortValue(right, sortKey);
      return compareValues(locale, leftValue, rightValue) * direction;
    });
  }, [data, exact, itemTypeFilter, locale, parentFilter, search, sortDirection, sortKey, statusFilter]);

  const toggleSort = useCallback((column: string) => {
    if (!SORTABLE_COLUMNS.has(column)) return;
    const nextDirection: SortDirection = sortKey === column && sortDirection === 'asc' ? 'desc' : 'asc';
    pushParams({ sort: column, dir: nextDirection });
  }, [pushParams, sortDirection, sortKey]);

  const resolveToken = useCallback((token: string): ResolvedLink | null => {
    const normalized = token.trim().toLowerCase();
    if (!normalized) return null;

    const taxonomyItem = taxonomyByCode.get(normalized) ?? taxonomyByUniqueTitle.get(normalized);
    if (taxonomyItem) {
      return {
        key: `taxonomy:${taxonomyItem.uuid}`,
        href: `/c3/${taxonomyItem.uuid}`,
        label: taxonomyItem.external_id ?? taxonomyItem.title,
        secondary: taxonomyItem.external_id ? taxonomyItem.title : null,
      };
    }

    const entityHref = resolveEntityHrefByCode(token);
    if (entityHref) {
      return {
        key: `entity:${token}`,
        href: entityHref,
        label: token,
      };
    }

    return null;
  }, [taxonomyByCode, taxonomyByUniqueTitle]);

  async function handleDelete(uuid: string, title: string) {
    if (!confirm(t('c3.list.delete_confirm', { title }))) return;
    setOpErr(null);
    try {
      const res = await fetch(`${BASE}/c3/${encodeURIComponent(uuid)}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || t('c3.list.delete_failed_status', { status: res.status }));
      }
      revalidate();
    } catch (deleteError: unknown) {
      setOpErr(deleteError instanceof Error ? deleteError.message : t('c3.list.delete_failed'));
    }
  }

  const pageTitle = itemTypeFilter.length === 1 ? (getC3TaxonomyTypeLabel(itemTypeFilter[0]) ?? t('c3.list.all_title')) : t('c3.list.all_title');

  const renderParentCell = (item: C3Item): ReactNode => {
    if (item.parent_uuid) {
      return (
        <Link href={`/c3/${item.parent_uuid}`} className={styles.cellLink}>
          {item.parent_external_id ?? item.parent_code ?? item.parent_title ?? item.parent_uuid}
          {item.parent_title && item.parent_external_id ? <span className={styles.cellSecondary}> — {item.parent_title}</span> : null}
        </Link>
      );
    }
    if (item.parent_code || item.parent_title) {
      return <span className={styles.cellText}>{item.parent_code ?? item.parent_title}</span>;
    }
    return '—';
  };

  return (
    <div className={catStyles.shell}>
      <aside className={catStyles.rail} aria-label={t('c3.list.filters_aria')}>
        <div className={catStyles.railSection}>
          <div style={{ marginBottom: 8 }}>
            <C3Breadcrumbs />
          </div>
          <Link
            href={C3_ROUTES.graph}
            style={{ display: 'block', marginBottom: 8, fontSize: '0.85em', color: 'var(--color-action-primary)', textDecoration: 'none' }}
          >
            {t('c3.list.open_graph')}
          </Link>
          <input
            className={catStyles.searchInput}
            type="search"
            placeholder={t('c3.list.search_placeholder')}
            value={search}
            onChange={(event) => pushParams({ search: event.target.value || undefined })}
            aria-label={t('c3.list.search_aria')}
          />
        </div>

        <FilterGroup label={t('c3.list.filter.type')}>
          {C3_TAXONOMY_TYPE_OPTIONS.map((option) => (
            <label key={option.code} className={styles.filterCheckLabel}>
              <input
                type="checkbox"
                checked={itemTypeFilter.includes(option.code)}
                onChange={() => toggleMulti(option.code, itemTypeFilter, 'item_type')}
              />
              <span
                className={styles.c3TypeBadge}
                style={{ marginLeft: 6, borderColor: C3_TYPE_COLOR[option.code], color: C3_TYPE_COLOR[option.code] }}
              >
                {option.code}
              </span>
              <span style={{ marginLeft: 6, fontSize: '0.82em' }}>{option.label}</span>
            </label>
          ))}
        </FilterGroup>

        {statusOptions.length > 0 && (
          <FilterGroup label={t('c3.list.filter.state')}>
            {statusOptions.map((status) => (
              <label key={status} className={styles.filterCheckLabel}>
                <input
                  type="checkbox"
                  checked={statusFilter.includes(status)}
                  onChange={() => toggleMulti(status, statusFilter, 'status')}
                />
                <span className={`${styles.statusPill} ${statusClass(status)}`} style={{ marginLeft: 6 }}>{status}</span>
              </label>
            ))}
          </FilterGroup>
        )}

        <div className={catStyles.railSection}>
          <div className={catStyles.filterLabel}>{t('c3.list.quick_views')}</div>
          <div className={styles.quickLinks}>
            {C3_TAXONOMY_TYPE_OPTIONS.map((option) => (
              <Link key={option.code} href={buildC3TaxonomyListHref(option.code)} className={styles.quickLink}>
                {option.label}
              </Link>
            ))}
          </div>
        </div>

        {parentOptions.length > 0 && (
          <FilterGroup label={t('c3.list.filter.parent')}>
            {parentOptions.map((title) => (
              <label key={title} className={styles.filterCheckLabel}>
                <input
                  type="checkbox"
                  checked={parentFilter.includes(title)}
                  onChange={() => toggleMulti(title, parentFilter, 'parent')}
                />
                <span style={{ marginLeft: 6, fontSize: '0.82em' }}>{title}</span>
              </label>
            ))}
          </FilterGroup>
        )}

        {hasFilters && (
          <div className={catStyles.railSection}>
            <button
              onClick={clearAll}
              className={styles.syncBtn}
              style={{ width: '100%' }}
            >
              {t('c3.list.clear_filters')}
            </button>
          </div>
        )}
      </aside>

      <main className={catStyles.content} aria-label="C3 taxonomy table">
        <nav className={styles.typeTabs} aria-label="C3 list type switcher">
          <Link href={C3_ROUTES.list} className={`${styles.typeTab} ${itemTypeFilter.length === 0 ? styles.typeTabActive : ''}`}>
            All
          </Link>
          {C3_TAXONOMY_TYPE_OPTIONS.map((option) => (
            <Link
              key={option.code}
              href={buildC3TaxonomyListHref(option.code)}
              className={`${styles.typeTab} ${itemTypeFilter.length === 1 && itemTypeFilter[0] === option.code ? styles.typeTabActive : ''}`}
            >
              <span className={styles.typeTabCode}>{option.code}</span>
              <span>{option.label.replace(/^C3\s+/, '')}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>{pageTitle}</h1>
            <p>{t('c3.list.lead')}</p>
          </div>
        </div>

        <div className={catStyles.toolbar}>
          <span className={catStyles.resultCount}>
            {isLoading
              ? t('common.loading')
              : error
                ? t('c3.list.load_error')
                : formatFilteredCountLabel(filteredRows.length, data?.length ?? 0, COUNT_LABELS.items)}
          </span>
        </div>

        {opErr && <div className={styles.errorMsg}>{opErr}</div>}
        {isLoading && <div className={catStyles.state}>{t('common.loading')}</div>}
        {error && <div className={catStyles.stateError}>{t('c3.list.error_prefix')}: {error.message}</div>}

        {!isLoading && !error && filteredRows.length === 0 && (
          <div className={catStyles.state}>{t('c3.list.empty')}</div>
        )}

        {!isLoading && !error && filteredRows.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{renderSortButton('external_id', t('c3.list.table.page'), sortKey, sortDirection, toggleSort)}</th>
                  {showUuidColumn && <th>{renderSortButton('uuid', 'UUID', sortKey, sortDirection, toggleSort)}</th>}
                  <th>{renderSortButton('title', t('c3.list.table.title'), sortKey, sortDirection, toggleSort)}</th>
                  <th>{renderSortButton('description', t('c3.list.table.description'), sortKey, sortDirection, toggleSort)}</th>
                  <th>{renderSortButton('parent_title', t('c3.list.table.parent'), sortKey, sortDirection, toggleSort)}</th>
                  <th>{renderSortButton('datasets_raw', t('c3.list.table.dataset'), sortKey, sortDirection, toggleSort)}</th>
                  <th>{renderSortButton('source_external_id', t('c3.list.table.external_id'), sortKey, sortDirection, toggleSort)}</th>
                  <th>{renderSortButton('data_source', t('c3.list.table.source'), sortKey, sortDirection, toggleSort)}</th>
                  <th>{renderSortButton('references_raw', t('c3.list.table.reference'), sortKey, sortDirection, toggleSort)}</th>
                  <th>{renderSortButton('order_num', t('c3.list.table.order'), sortKey, sortDirection, toggleSort)}</th>
                  <th>{renderSortButton('item_status', t('c3.list.table.state'), sortKey, sortDirection, toggleSort)}</th>
                  <th>{renderSortButton('level_num', t('c3.list.table.level'), sortKey, sortDirection, toggleSort)}</th>
                  {showActionColumn && <th>{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((item) => (
                  <tr key={item.uuid}>
                    <td className={styles.monoCell}>
                      <Link href={`/c3/${item.uuid}`} className={styles.cellLink}>
                        {item.external_id ?? '—'}
                      </Link>
                    </td>
                    {showUuidColumn && (
                      <td className={styles.monoCell}>
                        <Link href={`/c3/${item.uuid}`} className={styles.cellLink}>
                          {item.uuid}
                        </Link>
                      </td>
                    )}
                    <td>
                      <div className={styles.cellStack}>
                        <Link href={`/c3/${item.uuid}`} className={styles.cellLink}>
                          {item.title}
                        </Link>
                        <div className={styles.inlineMeta}>
                          {item.item_type && (
                            <span
                              className={styles.c3TypeBadge}
                              style={{ borderColor: C3_TYPE_COLOR[item.item_type] ?? 'var(--color-text-secondary)', color: C3_TYPE_COLOR[item.item_type] ?? 'var(--color-text-secondary)' }}
                            >
                              {item.item_type}
                            </span>
                          )}
                          <span className={styles.c3MetaPill}>{t('c3.list.mapping_count', { count: item.mapping_count ?? 0 })}</span>
                          {item.modification_date && <span className={styles.cellMuted}>{formatDate(locale, item.modification_date, { dateStyle: 'medium' })}</span>}
                        </div>
                      </div>
                    </td>
                    <td><span className={styles.cellText}>{item.description ?? '—'}</span></td>
                    <td>{renderParentCell(item)}</td>
                    <td>{renderTokenLinks(parseCellTokens(item.datasets_raw), resolveToken)}</td>
                    <td>{renderTokenLinks(parseCellTokens(item.source_external_id), resolveToken)}</td>
                    <td>{renderTokenLinks(parseCellTokens(item.data_source), resolveToken)}</td>
                    <td>{renderTokenLinks(parseCellTokens(item.references_raw), resolveToken)}</td>
                    <td className={styles.monoCell}>{item.order_num ?? '—'}</td>
                    <td>
                      <span className={`${styles.statusPill} ${statusClass(item.item_status)}`}>
                        {item.item_status ?? '—'}
                      </span>
                    </td>
                    <td className={styles.monoCell}>{item.level_num ?? '—'}</td>
                    {showActionColumn && (
                      <td>
                        <div className={styles.actionStack}>
                          <Link href={`/c3/${item.uuid}/edit`} className={styles.actionBtn} title="Editovat">
                            Edit
                          </Link>
                          {!isPublicC3Route && isAdmin && (
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.deleteBtn}`}
                              onClick={() => handleDelete(item.uuid, item.title)}
                              title={t('common.delete')}
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function normalizeSortValue(row: C3Item, key: string) {
  const value = row[key as keyof C3Item];
  if (value == null) return null;
  if (typeof value === 'number') return value;
  return String(value).trim().toLowerCase();
}

function renderSortButton(
  column: string,
  label: string,
  activeKey: string,
  direction: SortDirection,
  onToggle: (column: string) => void
) {
  const active = activeKey === column;
  return (
    <button
      type="button"
      className={`${styles.sortButton} ${active ? styles.sortButtonActive : ''}`}
      onClick={() => onToggle(column)}
    >
      {label}
      <span className={styles.sortGlyph}>{active ? (direction === 'asc' ? '▲' : '▼') : '↕'}</span>
    </button>
  );
}

export default function C3AdminPage() {
  const t = useT();
  return (
    <Suspense fallback={<div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>}>
      <C3CatalogueInner />
    </Suspense>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={catStyles.railSection}>
      <div className={catStyles.filterLabel}>{label}</div>
      <div className={catStyles.filterOptions}>{children}</div>
    </div>
  );
}
