'use client';

import Link from '@/app/components/AppLink';
import { useDeferredValue, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import styles from './entity-list.module.css';

type SortDirection = 'asc' | 'desc';

export interface ColumnDef {
  key: string;
  label: string;
  mono?: boolean;
  sortable?: boolean;
  render?: (row: Record<string, unknown>) => ReactNode;
  sortValue?: (row: Record<string, unknown>) => string | number | null;
}

export interface EditFieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'checkbox' | 'datetime-local';
  placeholder?: string;
  required?: boolean;
}

interface C3EntityListPageProps {
  title: string;
  endpoint: string;
  columns: ColumnDef[];
  subtitle?: string;
  editFields?: EditFieldDef[];
  exactSearchKeys?: string[];
  embedded?: boolean;
  rowEditHref?: (row: Record<string, unknown>) => string | null;
}

export function C3EntityListPage({
  title,
  endpoint,
  columns,
  subtitle,
  editFields = [],
  exactSearchKeys = [],
  embedded = false,
  rowEditHref,
}: C3EntityListPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const exactSearch = searchParams?.get('exact') ?? '';
  const editParam = searchParams?.get('edit') ?? '';
  const [search, setSearch] = useState(searchParams?.get('search') ?? exactSearch);
  const [sortKey, setSortKey] = useState(columns[0]?.key ?? '');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editPanelRef = useRef<HTMLDivElement | null>(null);
  const deferredSearch = useDeferredValue(search);
  const hasRowEditLink = typeof rowEditHref === 'function';
  const hasInlineEdit = editFields.length > 0 && !hasRowEditLink;
  const showActionColumn = hasInlineEdit || hasRowEditLink;

  const { data, isLoading, error } = useSWR<Array<Record<string, unknown>>>(endpoint, apiFetch, {
    revalidateOnFocus: false,
  });

  function scrollEditPanelIntoView() {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      editPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  useEffect(() => {
    setSearch(searchParams?.get('search') ?? searchParams?.get('exact') ?? '');
  }, [searchParams]);

  useEffect(() => {
    if (editingId == null) return;
    scrollEditPanelIntoView();
  }, [editingId]);

  useEffect(() => {
    if (!editParam || !hasInlineEdit || !data || editingId != null) return;
    const requestedId = Number(editParam);
    if (Number.isNaN(requestedId)) return;
    const targetRow = data.find((row) => Number(row.id) === requestedId);
    if (!targetRow) return;
    setEditingId(Number(targetRow.id));
    setEditDraft(
      editFields.reduce<Record<string, unknown>>((draft, field) => {
        draft[field.key] = targetRow[field.key] ?? '';
        return draft;
      }, {})
    );
    setSaveError(null);
    setSaveOk(null);
    scrollEditPanelIntoView();
  }, [data, editParam, editingId, hasInlineEdit, editFields]);

  // When edit=1 (boolean flag) or edit={id} is in the URL but this page uses rowEditHref (not inline edit),
  // resolve the matching row and redirect to its edit page.
  useEffect(() => {
    if (!editParam || !hasRowEditLink || !data) return;

    let targetRow: Record<string, unknown> | undefined;

    // edit=1 is a boolean-like flag: find the row by exactSearch first
    if (editParam === '1' && exactSearch && exactSearchKeys.length > 0) {
      const q = exactSearch.trim().toLowerCase();
      targetRow = data.find((row) =>
        exactSearchKeys.some((key) => String(row[key] ?? '').trim().toLowerCase() === q)
      );
    }

    // Fallback: numeric id lookup (edit={id})
    if (!targetRow) {
      const requestedId = Number(editParam);
      if (!Number.isNaN(requestedId)) {
        targetRow = data.find((row) => Number(row.id) === requestedId);
      }
    }

    if (!targetRow) return;
    const href = rowEditHref?.(targetRow) ?? null;
    if (href) router.push(href);
  }, [data, editParam, exactSearch, exactSearchKeys, hasRowEditLink, rowEditHref, router]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    const exact = exactSearch.trim().toLowerCase();
    const q = deferredSearch.trim().toLowerCase();
    let rows = data;
    if (exact && exactSearchKeys.length > 0) {
      rows = rows.filter((row) =>
        exactSearchKeys.some((key) => String(row[key] ?? '').trim().toLowerCase() === exact)
      );
    }
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(q))
    );
  }, [data, deferredSearch, exactSearch, exactSearchKeys]);

  const sortedData = useMemo(() => {
    const activeColumn = columns.find((column) => column.key === sortKey);
    if (!activeColumn) return filteredData;
    const direction = sortDirection === 'asc' ? 1 : -1;

    return [...filteredData].sort((left, right) => {
      const leftValue = activeColumn.sortValue ? activeColumn.sortValue(left) : defaultSortValue(left[sortKey]);
      const rightValue = activeColumn.sortValue ? activeColumn.sortValue(right) : defaultSortValue(right[sortKey]);
      return compareSortValues(leftValue, rightValue) * direction;
    });
  }, [columns, filteredData, sortDirection, sortKey]);

  const validationErrors = useMemo(() => {
    if (editingId == null) return [];
    return editFields
      .filter((field) => field.required)
      .filter((field) => isEmptyValue(editDraft[field.key], field.type))
      .map((field) => `${field.label} je povinné.`);
  }, [editDraft, editFields, editingId]);

  function handleSort(column: ColumnDef) {
    if (column.sortable === false) return;
    if (sortKey === column.key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(column.key);
    setSortDirection('asc');
  }

  function startEdit(row: Record<string, unknown>) {
    setEditingId(Number(row.id));
    setEditDraft(
      editFields.reduce<Record<string, unknown>>((draft, field) => {
        draft[field.key] = row[field.key] ?? '';
        return draft;
      }, {})
    );
    setSaveError(null);
    setSaveOk(null);
    scrollEditPanelIntoView();
  }

  function resetEdit(clearMessages = true) {
    setEditingId(null);
    setEditDraft({});
    if (clearMessages) {
      setSaveError(null);
      setSaveOk(null);
    }
  }

  async function handleSave() {
    if (!editingId) return;
    if (validationErrors.length > 0) {
      setSaveError(validationErrors[0]);
      setSaveOk(null);
      scrollEditPanelIntoView();
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      const res = await fetch(`${endpoint}/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(editDraft),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Uložení selhalo (${res.status})`);
      }
      await globalMutate(endpoint);
      resetEdit(false);
      setSaveOk('Záznam byl upraven.');
    } catch (saveErrorValue: unknown) {
      setSaveError(saveErrorValue instanceof Error ? saveErrorValue.message : 'Uložení selhalo');
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>{title}</div>
          {subtitle && <div className={styles.cardSubtitle}>{subtitle}</div>}
        </div>
        <div className={styles.filterBar}>
          <input
            className={styles.filterInput}
            type="search"
            placeholder="Filtrovat tabulku"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {editingId != null && (
        <div ref={editPanelRef} className={styles.editPanel}>
          <div className={styles.editHeader}>
            <div className={styles.editTitle}>Editace záznamu ID {editingId}</div>
            <div className={styles.editActions}>
              <button type="button" className={styles.buttonPrimary} onClick={handleSave} disabled={saving}>
                {saving ? 'Ukládám…' : 'Uložit'}
              </button>
              <button type="button" className={styles.buttonSecondary} onClick={() => resetEdit()} disabled={saving}>
                Zrušit
              </button>
            </div>
          </div>
          {saveError && <div className={styles.stateError}>{saveError}</div>}
          <div className={styles.editGrid}>
            {editFields.map((field) => (
              <label
                key={field.key}
                className={
                  field.type === 'textarea'
                    ? styles.editFieldWide
                    : field.type === 'checkbox'
                      ? styles.editFieldCheckbox
                      : styles.editField
                }
              >
                <span className={styles.fieldLabel}>{field.label}</span>
                {renderEditControl(field, editDraft, setEditDraft)}
              </label>
            ))}
          </div>
          <div className={styles.validationCard}>
            <div className={styles.validationTitle}>Validation</div>
            {validationErrors.length > 0 ? (
              validationErrors.map((errorText) => (
                <div key={errorText} className={styles.stateError}>{errorText}</div>
              ))
            ) : (
              <div className={styles.stateSuccess}>No errors</div>
            )}
          </div>
        </div>
      )}

      {saveOk && editingId == null && <div className={styles.stateSuccess}>{saveOk}</div>}
      {isLoading && <div className={styles.state}>Načítám…</div>}
      {error && <div className={styles.stateError}>Načtení selhalo.</div>}
      {!isLoading && !error && sortedData.length === 0 && <div className={styles.empty}>Žádné záznamy.</div>}
      {!!data && sortedData.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>
                    <button
                      type="button"
                      className={`${styles.sortButton} ${sortKey === column.key ? styles.sortButtonActive : ''}`}
                      onClick={() => handleSort(column)}
                      disabled={column.sortable === false}
                    >
                      <span>{column.label}</span>
                      {column.sortable === false ? null : (
                        <span className={styles.sortIndicator}>
                          {sortKey === column.key ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      )}
                    </button>
                  </th>
                ))}
                {showActionColumn && <th>Akce</th>}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, index) => (
                <tr key={String(row.id ?? row.uuid ?? index)}>
                  {columns.map((column) => (
                    <td key={column.key} className={column.mono ? styles.mono : undefined}>
                      {column.render ? column.render(row) : String(row[column.key] ?? '—')}
                    </td>
                  ))}
                  {showActionColumn && (
                    <td>
                      {hasRowEditLink ? (
                        (() => {
                          const href = rowEditHref?.(row) ?? null;
                          return href ? (
                            <Link href={href} className={styles.buttonSecondary}>
                              Edit
                            </Link>
                          ) : '—';
                        })()
                      ) : hasInlineEdit ? (
                        <button type="button" className={styles.buttonSecondary} onClick={() => startEdit(row)}>
                          Edit
                        </button>
                      ) : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  if (embedded) return content;

  return (
    <div className={styles.shell}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>
      <div className={styles.body}>{content}</div>
    </div>
  );
}

function defaultSortValue(value: unknown) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  return String(value).trim();
}

function compareSortValues(left: string | number | null, right: string | number | null) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), 'cs', { numeric: true, sensitivity: 'base' });
}

function renderEditControl(
  field: EditFieldDef,
  editDraft: Record<string, unknown>,
  setEditDraft: Dispatch<SetStateAction<Record<string, unknown>>>,
) {
  if (field.type === 'textarea') {
    return (
      <textarea
        className={styles.editTextarea}
        value={String(editDraft[field.key] ?? '')}
        onChange={(event) => setEditDraft((current) => ({ ...current, [field.key]: event.target.value }))}
        placeholder={field.placeholder}
        rows={4}
      />
    );
  }

  if (field.type === 'checkbox') {
    return (
      <input
        className={styles.editCheckbox}
        type="checkbox"
        checked={toBoolean(editDraft[field.key])}
        onChange={(event) => setEditDraft((current) => ({ ...current, [field.key]: event.target.checked }))}
      />
    );
  }

  if (field.type === 'datetime-local') {
    return (
      <input
        className={styles.editInput}
        type="datetime-local"
        value={toDateTimeLocalValue(editDraft[field.key])}
        onChange={(event) => setEditDraft((current) => ({ ...current, [field.key]: event.target.value }))}
        placeholder={field.placeholder}
      />
    );
  }

  return (
    <input
      className={styles.editInput}
      type={field.type === 'number' ? 'number' : 'text'}
      value={String(editDraft[field.key] ?? '')}
      onChange={(event) => setEditDraft((current) => ({ ...current, [field.key]: event.target.value }))}
      placeholder={field.placeholder}
    />
  );
}

function toBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(normalized);
}

function toDateTimeLocalValue(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function isEmptyValue(value: unknown, type: EditFieldDef['type']) {
  if (type === 'checkbox') return false;
  if (value == null) return true;
  return String(value).trim() === '';
}
