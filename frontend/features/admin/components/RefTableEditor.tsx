/**
 * RefTableEditor — generic CRUD editor for reference dictionaries.
 * Uses /api/v1/ref/:table for data and mutations.
 *
 * Props:
 *   table  — table name (must be in the server-side TABLES whitelist)
 */
'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate as swrMutate } from 'swr';
import { COUNT_LABELS, formatCountLabel } from '@/app/lib/counts';
import styles from '@/app/admin/ref.module.css';

// ── API types ────────────────────────────────────────────────────────────────
interface ColMeta {
  key:      string;
  type:     'pk' | 'text' | 'int' | 'bool' | 'color' | string; // fk:TABLE
  label:    string;
  maxlen?:  number;
  required?: boolean;
}

interface RefMeta {
  table:   string;
  label:   string;
  columns: ColMeta[];
}

interface RefResponse {
  meta: RefMeta;
  rows: Record<string, unknown>[];
}

// ── FK option cache ───────────────────────────────────────────────────────────
const fkCache: Record<string, { code: string; name: string }[]> = {};

async function loadFkOptions(refTable: string): Promise<{ code: string; name: string }[]> {
  if (fkCache[refTable]) return fkCache[refTable];
  const res = await fetch(`/api/v1/ref/${refTable}`);
  if (!res.ok) return [];
  const data: RefResponse = await res.json();
  const pkCol  = data.meta.columns.find(c => c.type === 'pk')?.key ?? 'code';
  const nameCol = data.meta.columns.find(c => c.key === 'name')?.key ?? pkCol;
  fkCache[refTable] = data.rows.map(r => ({
    code: String(r[pkCol] ?? ''),
    name: String(r[nameCol] ?? ''),
  }));
  return fkCache[refTable];
}

// ── apiFetch ──────────────────────────────────────────────────────────────────
const apiFetch = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json() as Promise<RefResponse>;
  });

// ── Helpers ───────────────────────────────────────────────────────────────────
function emptyRow(columns: ColMeta[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const col of columns) {
    obj[col.key] = col.type === 'bool' ? false : col.type === 'int' ? '' : '';
  }
  return obj;
}

function colIsFk(col: ColMeta): { fkTable: string } | null {
  if (col.type.startsWith('fk:')) return { fkTable: col.type.slice(3) };
  return null;
}

// ── Cell viewer ───────────────────────────────────────────────────────────────
function CellView({ col, value }: { col: ColMeta; value: unknown }) {
  if (col.type === 'bool') {
    return (
      <span
        className={`${styles.boolBadge} ${value ? styles.boolTrue : styles.boolFalse}`}
        title={value ? 'true' : 'false'}
      />
    );
  }
  if (col.type === 'color') {
    const hex = String(value ?? '');
    return (
      <span className={styles.colorSwatch}>
        {hex && <span className={styles.colorDot} style={{ background: hex }} />}
        <span>{hex || '—'}</span>
      </span>
    );
  }
  if (col.type === 'pk') return <code className={styles.tdCode}>{String(value ?? '—')}</code>;
  return <>{value != null && value !== '' ? String(value) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</>;
}

// ── Cell editor ───────────────────────────────────────────────────────────────
function CellEdit({
  col,
  value,
  onChange,
  fkOptions,
}: {
  col: ColMeta;
  value: unknown;
  onChange: (v: unknown) => void;
  fkOptions: Record<string, { code: string; name: string }[]>;
}) {
  const fk = colIsFk(col);
  if (fk) {
    const opts = fkOptions[fk.fkTable] ?? [];
    return (
      <select value={String(value ?? '')} onChange={e => onChange(e.target.value || null)}>
        <option value="">—</option>
        {opts.map(o => (
          <option key={o.code} value={o.code}>{o.name || o.code}</option>
        ))}
      </select>
    );
  }
  if (col.type === 'bool') {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={e => onChange(e.target.checked)}
      />
    );
  }
  if (col.type === 'color') {
    return (
      <input
        type="color"
        value={String(value ?? '#888888')}
        onChange={e => onChange(e.target.value)}
        style={{ width: 40, height: 28, padding: 2 }}
      />
    );
  }
  if (col.type === 'int') {
    return (
      <input
        type="number"
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value === '' ? null : parseInt(e.target.value))}
        style={{ width: 80 }}
      />
    );
  }
  // text / pk
  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      maxLength={col.maxlen}
      readOnly={col.type === 'pk'}
      style={col.type === 'pk' ? { background: 'var(--color-bg-canvas)', fontFamily: 'monospace' } : undefined}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function RefTableEditor({ table }: { table: string }) {
  const cacheKey = `/api/v1/ref/${table}`;
  const { data, error, isLoading } = useSWR<RefResponse>(cacheKey, apiFetch);

  // FK options — loaded lazily per table
  const [fkOptions, setFkOptions] = useState<Record<string, { code: string; name: string }[]>>({});

  // Load FK options when meta is available
  const ensureFkOptions = useCallback(async (columns: ColMeta[]) => {
    const needed = columns.filter(c => colIsFk(c)).map(c => colIsFk(c)!.fkTable);
    for (const t of needed) {
      if (!fkOptions[t]) {
        const opts = await loadFkOptions(t);
        setFkOptions(prev => ({ ...prev, [t]: opts }));
      }
    }
  }, [fkOptions]);

  // Call ensureFkOptions once meta is loaded
  if (data?.meta.columns && Object.keys(fkOptions).length === 0) {
    ensureFkOptions(data.meta.columns);
  }

  // Editing state: null = not editing, string = the PK value being edited
  const [editingPk, setEditingPk]   = useState<string | null>(null);
  const [editDraft, setEditDraft]   = useState<Record<string, unknown>>({});
  const [addDraft,  setAddDraft]    = useState<Record<string, unknown> | null>(null);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [busy,      setBusy]        = useState(false);

  if (isLoading) return <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>Načítám…</div>;
  if (error)     return <div style={{ padding: 'var(--space-6)', color: 'var(--color-danger)' }}>Chyba: {error.message}</div>;
  if (!data)     return null;

  const { meta, rows } = data;
  const pkCol   = meta.columns.find(c => c.type === 'pk')!;
  const editCols = meta.columns.filter(c => c.type !== 'pk');

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getPk(row: Record<string, unknown>): string {
    return String(row[pkCol.key] ?? '');
  }

  async function apiCall(method: string, url: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ── Save edit ──────────────────────────────────────────────────────────────
  async function handleSave(pk: string) {
    setBusy(true); setSaveError(null);
    try {
      await apiCall('PUT', `/api/v1/ref/${table}/${encodeURIComponent(pk)}`, editDraft);
      await swrMutate(cacheKey);
      setEditingPk(null);
    } catch (e: unknown) {
      setSaveError((e as Error).message);
    } finally { setBusy(false); }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(pk: string) {
    if (!confirm(`Smazat záznam "${pk}"?`)) return;
    setBusy(true); setSaveError(null);
    try {
      await apiCall('DELETE', `/api/v1/ref/${table}/${encodeURIComponent(pk)}`);
      await swrMutate(cacheKey);
    } catch (e: unknown) {
      setSaveError((e as Error).message);
    } finally { setBusy(false); }
  }

  // ── Add ────────────────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!addDraft) return;
    setBusy(true); setSaveError(null);
    try {
      await apiCall('POST', `/api/v1/ref/${table}`, addDraft);
      await swrMutate(cacheKey);
      setAddDraft(null);
    } catch (e: unknown) {
      setSaveError((e as Error).message);
    } finally { setBusy(false); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.editorPanel}>

      {/* Toolbar */}
      <div className={styles.editorToolbar}>
        <span className={styles.editorTitle}>{meta.label}</span>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <span className={styles.editorMeta}>{formatCountLabel(rows.length, COUNT_LABELS.records)}</span>
          {addDraft === null && (
            <button
              className={styles.btnAdd}
              onClick={() => { setAddDraft(emptyRow(meta.columns)); setSaveError(null); }}
            >
              + Přidat
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {saveError && (
        <div className={styles.errorBanner}>
          <span>⚠ {saveError}</span>
          <button onClick={() => setSaveError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Add form */}
      {addDraft !== null && (
        <div className={styles.addForm}>
          {meta.columns.map(col => (
            <div key={col.key} className={styles.addFormField}>
              <label>{col.label}{col.required ? ' *' : ''}</label>
              <CellEdit
                col={col}
                value={addDraft[col.key]}
                onChange={v => setAddDraft(prev => ({ ...prev!, [col.key]: v }))}
                fkOptions={fkOptions}
              />
            </div>
          ))}
          <div className={styles.addFormActions}>
            <button className={styles.btnAdd} onClick={handleAdd} disabled={busy || !addDraft[pkCol.key]}>
              Uložit
            </button>
            <button className={styles.btnCancel} onClick={() => setAddDraft(null)}>
              Zrušit
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.refTable}>
          <thead>
            <tr>
              {meta.columns.map(col => (
                <th key={col.key}>{col.label}</th>
              ))}
              <th style={{ width: 120 }}>Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr className={styles.emptyRow}>
                <td colSpan={meta.columns.length + 1}>Žádné záznamy</td>
              </tr>
            )}
            {rows.map(row => {
              const pk = getPk(row);
              const isEditing = editingPk === pk;
              return (
                <tr key={pk} className={isEditing ? styles.editing : undefined}>
                  {meta.columns.map(col => (
                    <td
                      key={col.key}
                      className={
                        col.type === 'pk'   ? styles.tdCode :
                        col.type === 'bool' ? styles.tdBool : undefined
                      }
                    >
                      {isEditing && col.type !== 'pk' ? (
                        <CellEdit
                          col={col}
                          value={editDraft[col.key]}
                          onChange={v => setEditDraft(prev => ({ ...prev, [col.key]: v }))}
                          fkOptions={fkOptions}
                        />
                      ) : (
                        <CellView col={col} value={row[col.key]} />
                      )}
                    </td>
                  ))}
                  <td>
                    <div className={styles.tdActions}>
                      {isEditing ? (
                        <>
                          <button className={styles.btnSave} onClick={() => handleSave(pk)} disabled={busy}>
                            Uložit
                          </button>
                          <button className={styles.btnCancel} onClick={() => setEditingPk(null)}>
                            Zrušit
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className={styles.btnEdit}
                            onClick={() => {
                              setEditingPk(pk);
                              // Init draft from current row (only editCols)
                              const draft: Record<string, unknown> = {};
                              for (const col of editCols) draft[col.key] = row[col.key];
                              setEditDraft(draft);
                              setSaveError(null);
                            }}
                          >
                            Upravit
                          </button>
                          <button className={styles.btnDel} onClick={() => handleDelete(pk)} disabled={busy}>
                            Smazat
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
