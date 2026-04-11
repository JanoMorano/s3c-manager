/**
 * Admin — Import Review
 * GET /api/v1/import/review  — ImportBatch + ImportIssue overview
 * GET /api/v1/import/batches/:id — batch detail with issues
 * GET /api/v1/import/relation-raw — unparsed relations (re-parse pipeline)
 */
'use client';

import { useState, useEffect } from 'react';
import Link from '@/app/components/AppLink';
import useSWR from 'swr';
import adminStyles from '../admin.module.css';
import styles from './import.module.css';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';

const BASE = '/api/v1/import';
const PAGE_SIZE = 50;

// ── Types ──────────────────────────────────────────────────────────────────
interface ImportBatch {
  id: number;
  filename: string;
  imported_by: string;
  row_count: number;
  ok_count: number;
  warn_count: number;
  error_count: number;
  status: string;
  imported_at: string;
  closed_at: string | null;
  issue_error_count: number;
  issue_warn_count: number;
}

interface ReviewSummary {
  total_batches: number;
  total_ok: number;
  total_warn: number;
  total_error: number;
  last_imported_at: string | null;
}

interface ImportIssue {
  id: number;
  severity: string;
  issue_code: string;
  field_name: string | null;
  raw_value: string | null;
  message: string;
  service_id: string | null;
  row_number: number | null;
}

interface BatchDetail {
  id: number;
  filename: string;
  imported_by: string;
  imported_at: string;
  issues: ImportIssue[];
}

interface RelationRaw {
  id: number;
  service_id: string;
  source_field: string;
  raw_value: string;
  parsed_ok: boolean;
  parser_version: string | null;
  parsed_at: string;
}

interface ServiceRawField {
  id: number;
  field_name: string;
  raw_value: string;
  parser_version: string | null;
  notes: string | null;
  created_at: string;
}

interface ExportManifestResponse {
  contract_version: string;
  schema_version: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' });
}

function StatusBadge({ value }: { value: string }) {
  const cls = value === 'error' ? styles.badgeDanger
    : value === 'warn'  ? styles.badgeWarn
    : value === 'ok' || value === 'closed' ? styles.badgeOk
    : styles.badgeNeutral;
  return <span className={`${styles.badge} ${cls}`}>{value}</span>;
}

function parseIssuePayload(rawValue: string | null): unknown {
  if (!rawValue) return null;
  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ImportReviewPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [rawTab, setRawTab] = useState(false);
  const [rawFieldsTab, setRawFieldsTab] = useState(false);
  const [rawFieldsServiceId, setRawFieldsServiceId] = useState('');
  const [rawFieldsSearch, setRawFieldsSearch] = useState('');

  // ── Pagination state ──────────────────────────────────────────────────────
  const [batchOffset, setBatchOffset] = useState(0);
  const [allBatches, setAllBatches] = useState<ImportBatch[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const { data: manifest } = useSWR<ExportManifestResponse>(
    '/api/v1/export/manifest?scope=import',
    apiFetch,
    { revalidateOnFocus: false }
  );

  const handleFilterChange = (f: string) => {
    setStatusFilter(f);
    setBatchOffset(0);
    setAllBatches([]);
    setSelectedBatch(null);
  };

  const reviewUrl = `${BASE}/review?limit=${PAGE_SIZE}&offset=${batchOffset}${statusFilter ? `&status=${statusFilter}` : ''}`;
  const { data, isLoading, error, mutate } = useSWR<{ batches: ImportBatch[]; summary: ReviewSummary }>(
    reviewUrl, apiFetch
  );

  // Accumulate pages; reset on offset=0 (new filter)
  useEffect(() => {
    if (!data?.batches) return;
    if (batchOffset === 0) {
      setAllBatches(data.batches);
    } else {
      setAllBatches(prev => [...prev, ...data.batches]);
    }
    setHasMore(data.batches.length === PAGE_SIZE);
  }, [data?.batches, batchOffset]);
  const { data: batchDetail, isLoading: detailLoading } = useSWR<BatchDetail>(
    selectedBatch ? `${BASE}/batches/${selectedBatch}` : null, apiFetch
  );
  const { data: rawData, isLoading: rawLoading, mutate: mutateRaw } = useSWR<RelationRaw[]>(
    rawTab ? `${BASE}/relation-raw?parsedOk=0&limit=100` : null, apiFetch
  );
  const { data: rawFieldsData, isLoading: rawFieldsLoading } = useSWR<ServiceRawField[]>(
    rawFieldsTab && rawFieldsSearch ? `/api/v1/services/${encodeURIComponent(rawFieldsSearch)}/raw-fields` : null,
    apiFetch
  );
  const [reparseState, setReparseState] = useState<{ busy: boolean; result: string | null }>({ busy: false, result: null });

  // Re-parse — single row (specific service_id)
  const handleReparse = async (rawId: number, serviceId: string) => {
    if (!confirm(`Spustit re-parse pro ${serviceId}?`)) return;
    setReparseState({ busy: true, result: null });
    try {
      const res = await fetch(`${BASE}/reparse-raw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ serviceId, limit: 50 }),
      });
      const json = await res.json();
      setReparseState({ busy: false, result: `✅ ${serviceId}: zpracováno=${json.processed}, vytvořeno=${json.created}, přeskočeno=${json.skipped}${json.errors?.length ? `, chyby: ${json.errors.slice(0, 3).join('; ')}` : ''}` });
      mutateRaw();
    } catch (e) {
      setReparseState({ busy: false, result: `❌ Chyba: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  // Re-parse — all (all unparsed records)
  const handleReparseAll = async () => {
    if (!confirm('Spustit re-parse ALL neparsovaných relací (max 200)?')) return;
    setReparseState({ busy: true, result: null });
    try {
      const res = await fetch(`${BASE}/reparse-raw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ limit: 200 }),
      });
      const json = await res.json();
      setReparseState({ busy: false, result: `✅ Re-parse ALL: zpracováno=${json.processed}, vytvořeno=${json.created}, přeskočeno=${json.skipped}${json.errors?.length ? `, chyby: ${json.errors.slice(0, 3).join('; ')}` : ''}` });
      mutateRaw();
    } catch (e) {
      setReparseState({ busy: false, result: `❌ Chyba: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  if (isLoading) return <div className={styles.state}>Načítám přehled importů…</div>;
  if (error)     return <div className={`${styles.state} ${styles.stateError}`}>Chyba: {(error as Error).message}</div>;
  if (!data)     return null;

  const { batches, summary } = data;

  return (
    <div className={styles.shell}>
      {/* Breadcrumb */}
      <nav className={adminStyles.breadcrumb}>
        <Link href="/administration">Administration</Link>
        <span className={adminStyles.breadcrumbSep}>/</span>
        <span>Import Review</span>
      </nav>

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Import Review</h1>
        <div className={styles.headerActions}>
          {manifest?.contract_version && <span className={styles.tabBtn}>Contract {manifest.contract_version}</span>}
          {manifest?.schema_version && <span className={styles.tabBtn}>Schema {manifest.schema_version}</span>}
          <a className={styles.tabBtn} href="/api/v1/export/manifest">Export manifest</a>
          <a className={styles.tabBtn} href="/api/v1/export/bundle">Export bundle</a>
          <button className={styles.tabBtn} onClick={() => { setRawTab(false); setRawFieldsTab(false); setSelectedBatch(null); }}
            aria-pressed={!rawTab && !rawFieldsTab}>Dávky</button>
          <button className={styles.tabBtn} onClick={() => { setRawTab(true); setRawFieldsTab(false); setSelectedBatch(null); }}
            aria-pressed={rawTab}>Raw relace (re-parse)</button>
          <button className={styles.tabBtn} onClick={() => { setRawTab(false); setRawFieldsTab(true); setSelectedBatch(null); }}
            aria-pressed={rawFieldsTab}>Raw Fields (per služba)</button>
        </div>
      </div>

      {!rawTab && (
        <>
          {/* Summary KPIs */}
          <div className={styles.kpiRow}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Dávek celkem</div>
              <div className={styles.kpiValue}>{summary.total_batches ?? 0}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>OK řádků</div>
              <div className={styles.kpiValue} style={{ color: '#006644' }}>{summary.total_ok ?? 0}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>S chybou</div>
              <div className={styles.kpiValue} style={{ color: '#de350b' }}>{summary.total_error ?? 0}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Posledni import</div>
              <div className={styles.kpiValue} style={{ fontSize: '0.95rem' }}>{fmt(summary.last_imported_at)}</div>
            </div>
          </div>

          {/* Filter */}
          <div className={styles.toolbar}>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Filtr:</span>
            {['', 'ok', 'error', 'warn'].map(f => (
              <button key={f} className={`${styles.filterBtn} ${statusFilter === f ? styles.filterBtnActive : ''}`}
                onClick={() => handleFilterChange(f)}>
                {f === '' ? 'Vše' : f}
              </button>
            ))}
            <button className={styles.refreshBtn} onClick={() => { setBatchOffset(0); setAllBatches([]); mutate(); }}>↻ Obnovit</button>
          </div>

          {/* Batch table */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Soubor / zdroj</th>
                  <th>Importoval</th>
                  <th>Datum</th>
                  <th>Řádků</th>
                  <th>OK</th>
                  <th>Chyby</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {allBatches.length === 0 && !isLoading && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '32px' }}>
                    Žádné dávky
                  </td></tr>
                )}
                {allBatches.map(b => (
                  <tr key={b.id}
                    className={`${styles.batchRow} ${selectedBatch === b.id ? styles.batchRowSelected : ''}`}
                    onClick={() => setSelectedBatch(b.id === selectedBatch ? null : b.id)}
                  >
                    <td className={styles.numCell}>{b.id}</td>
                    <td><span className={styles.filename}>{b.filename}</span></td>
                    <td>{b.imported_by}</td>
                    <td>{fmt(b.imported_at)}</td>
                    <td className={styles.numCell}>{b.row_count}</td>
                    <td className={styles.numCell} style={{ color: '#006644' }}>{b.ok_count}</td>
                    <td className={styles.numCell}>
                      {b.error_count > 0
                        ? <span className={styles.errorCount}>{b.error_count}</span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>0</span>
                      }
                    </td>
                    <td><StatusBadge value={b.error_count > 0 ? 'error' : b.status} /></td>
                    <td>
                      <button className={styles.detailBtn}
                        onClick={e => { e.stopPropagation(); setSelectedBatch(b.id === selectedBatch ? null : b.id); }}>
                        {selectedBatch === b.id ? '▲' : '▼'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {(hasMore || isLoading) && (
            <div className={styles.loadMoreBar}>
              {isLoading
                ? <span className={styles.loadMoreHint}>Načítám…</span>
                : <button className={styles.loadMoreBtn}
                    onClick={() => setBatchOffset(prev => prev + PAGE_SIZE)}>
                    Načíst další ({allBatches.length} načteno)
                  </button>
              }
            </div>
          )}

          {/* Batch detail / issues */}
          {selectedBatch && (() => {
            const sb = allBatches.find(b => b.id === selectedBatch);
            const issueTotal = batchDetail?.issues.length ?? ((sb?.issue_error_count ?? 0) + (sb?.issue_warn_count ?? 0));
            const errCnt  = batchDetail ? batchDetail.issues.filter(i => i.severity === 'error').length : (sb?.issue_error_count ?? 0);
            const warnCnt = batchDetail ? batchDetail.issues.filter(i => i.severity === 'warn').length  : (sb?.issue_warn_count ?? 0);
            const parsedFlavourIssues = batchDetail?.issues.filter((issue) => issue.issue_code === 'FLAVOURS_PARSED') ?? [];
            const parsedSlaIssues = batchDetail?.issues.filter((issue) => issue.issue_code === 'SLA_PARSED') ?? [];
            const parsedFlavourCount = parsedFlavourIssues.reduce((sum, issue) => {
              const payload = parseIssuePayload(issue.raw_value);
              return sum + (Array.isArray(payload) ? payload.length : 0);
            }, 0);
            return (
            <div className={styles.issuePanel}>
              <div className={styles.issuePanelHeader}>
                <span className={styles.issuePanelTitle}>
                  Issues — dávka #{selectedBatch}
                </span>
                <span className={styles.issueBadgeRow}>
                  <a href="/api/v1/export/bundle" className={styles.detailBtn}>Export bundle</a>
                  <a href="/api/v1/export/manifest?scope=import" className={styles.detailBtn}>Manifest</a>
                </span>
                {issueTotal > 0 && (
                  <span className={styles.issueBadgeRow}>
                    {errCnt  > 0 && <span className={`${styles.badge} ${styles.badgeDanger}`}>{errCnt} {errCnt === 1 ? 'chyba' : errCnt < 5 ? 'chyby' : 'chyb'}</span>}
                    {warnCnt > 0 && <span className={`${styles.badge} ${styles.badgeWarn}`}>{warnCnt} {warnCnt === 1 ? 'varování' : 'varování'}</span>}
                    {errCnt === 0 && warnCnt === 0 && issueTotal > 0 && <span className={`${styles.badge} ${styles.badgeNeutral}`}>{issueTotal} issues</span>}
                  </span>
                )}
                {issueTotal === 0 && !detailLoading && (
                  <span className={`${styles.badge} ${styles.badgeOk}`}>vše OK</span>
                )}
              </div>
              {detailLoading && <div className={styles.state} style={{ height: 80 }}>Načítám…</div>}
              {batchDetail && batchDetail.issues.length === 0 && (
                <div className={styles.state} style={{ height: 80 }}>Žádné problémy ✅</div>
              )}
              {batchDetail && batchDetail.issues.length > 0 && (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Závažnost</th>
                      <th>Kód</th>
                      <th>Service ID</th>
                      <th>Pole</th>
                      <th>Zpráva</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchDetail.issues.map(iss => (
                      <tr key={iss.id}>
                        <td><StatusBadge value={iss.severity} /></td>
                        <td><code className={styles.issueCode}>{iss.issue_code}</code></td>
                        <td>
                          {iss.service_id
                            ? <Link href={`/services/${iss.service_id}`} className={styles.serviceLink}>{iss.service_id}</Link>
                            : '—'}
                        </td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{iss.field_name ?? '—'}</td>
                        <td className={styles.issueMsg}>{iss.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {batchDetail && (parsedFlavourIssues.length > 0 || parsedSlaIssues.length > 0) && (
                <div className={styles.parsedPanel}>
                  <div className={styles.parsedPanelHeader}>
                    <span className={styles.issuePanelTitle}>Parsované flavoury a SLA</span>
                    <span className={styles.issueBadgeRow}>
                      {parsedFlavourIssues.length > 0 && <span className={`${styles.badge} ${styles.badgeNeutral}`}>{parsedFlavourCount} flavourů</span>}
                      {parsedSlaIssues.length > 0 && <span className={`${styles.badge} ${styles.badgeNeutral}`}>{parsedSlaIssues.length} SLA</span>}
                    </span>
                  </div>
                  <div className={styles.parsedGrid}>
                    {parsedFlavourIssues.map((issue) => {
                      const payload = parseIssuePayload(issue.raw_value);
                      const flavours = Array.isArray(payload) ? payload as Array<{ flavour_code?: string; title?: string; service_unit?: string | null; price_value?: number | null; currency_code?: string | null }> : [];
                      return (
                        <div key={issue.id} className={styles.parsedCard}>
                          <div className={styles.parsedCardTitle}>
                            {issue.service_id ? <Link href={`/services/${issue.service_id}`} className={styles.serviceLink}>{issue.service_id}</Link> : 'Služba'}
                            <span className={`${styles.badge} ${styles.badgeNeutral}`}>flavour parse</span>
                          </div>
                          <div className={styles.parsedMessage}>{issue.message}</div>
                          <div className={styles.parsedList}>
                            {flavours.map((flavour, index) => (
                              <div key={`${issue.id}-${flavour.flavour_code ?? index}`} className={styles.parsedListItem}>
                                <strong>{flavour.flavour_code ?? 'n/a'}</strong>
                                <span>{flavour.title ?? 'Bez názvu'}</span>
                                <span>{flavour.service_unit ?? '—'}</span>
                                <span>{flavour.price_value != null ? `${flavour.price_value} ${flavour.currency_code ?? 'EUR'}` : 'bez ceny'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {parsedSlaIssues.map((issue) => {
                      const payload = parseIssuePayload(issue.raw_value) as { availability_pct?: number | null; restoration_hours?: number | null; delivery_days?: number | null; support_window_code?: string | null } | null;
                      return (
                        <div key={issue.id} className={styles.parsedCard}>
                          <div className={styles.parsedCardTitle}>
                            {issue.service_id ? <Link href={`/services/${issue.service_id}`} className={styles.serviceLink}>{issue.service_id}</Link> : 'Služba'}
                            <span className={`${styles.badge} ${styles.badgeNeutral}`}>sla parse</span>
                          </div>
                          <div className={styles.parsedMessage}>{issue.message}</div>
                          <div className={styles.parsedList}>
                            <div className={styles.parsedListItem}>
                              <strong>availability</strong>
                              <span>{payload?.availability_pct != null ? `${payload.availability_pct}%` : '—'}</span>
                            </div>
                            <div className={styles.parsedListItem}>
                              <strong>restoration</strong>
                              <span>{payload?.restoration_hours != null ? `${payload.restoration_hours} h` : '—'}</span>
                            </div>
                            <div className={styles.parsedListItem}>
                              <strong>delivery</strong>
                              <span>{payload?.delivery_days != null ? `${payload.delivery_days} d` : '—'}</span>
                            </div>
                            <div className={styles.parsedListItem}>
                              <strong>support window</strong>
                              <span>{payload?.support_window_code ?? '—'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            );
          })()}
        </>
      )}

      {/* Raw Fields tab — ServiceRawField per service */}
      {rawFieldsTab && (
        <div className={styles.tableWrap}>
          <div className={styles.rawHeader}>
            <span className={styles.rawTitle}>Raw Fields — zdrojové texty per služba (ServiceRawField)</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <a href="/api/v1/export/bundle" className={styles.serviceLink} style={{ fontSize: 12 }}>
                → Export bundle
              </a>
              <input
                className={styles.rawFieldInput ?? styles.rawValue}
                style={{ padding: '4px 10px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 13, width: 200 }}
                placeholder="Service ID (napr. WPS001)"
                value={rawFieldsServiceId}
                onChange={e => setRawFieldsServiceId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setRawFieldsSearch(rawFieldsServiceId.trim())}
              />
              <button className={styles.reparseBtn}
                style={{ padding: '4px 14px', fontSize: 12 }}
                onClick={() => setRawFieldsSearch(rawFieldsServiceId.trim())}
                disabled={!rawFieldsServiceId.trim()}>
                Načíst
              </button>
              {rawFieldsSearch && (
                <Link href={`/services/${rawFieldsSearch}`} className={styles.serviceLink} style={{ fontSize: 12 }}>
                  → Detail služby
                </Link>
              )}
            </div>
          </div>
          {rawFieldsLoading && <div className={styles.state}>Načítám raw fields…</div>}
          {rawFieldsSearch && !rawFieldsLoading && rawFieldsData && rawFieldsData.length === 0 && (
            <div className={styles.state}>Žádné raw fields pro {rawFieldsSearch}</div>
          )}
          {rawFieldsData && rawFieldsData.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pole</th>
                  <th>Parser</th>
                  <th>Uloženo</th>
                  <th>Raw hodnota</th>
                  <th>Poznámky</th>
                </tr>
              </thead>
              <tbody>
                {rawFieldsData.map(rf => (
                  <tr key={rf.id}>
                    <td><code className={styles.issueCode}>{rf.field_name}</code></td>
                    <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{rf.parser_version ?? '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{fmt(rf.created_at)}</td>
                    <td className={styles.rawValue} title={rf.raw_value}>
                      {rf.raw_value.slice(0, 200)}{rf.raw_value.length > 200 ? '…' : ''}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{rf.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Raw relation tab */}
      {rawTab && (
        <div className={styles.tableWrap}>
          <div className={styles.rawHeader}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <span className={styles.rawTitle}>Neparsované relace (ServiceRelationRaw — parsed_ok = 0)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a href="/api/v1/export/bundle" className={styles.serviceLink} style={{ fontSize: 12 }}>
                  → Export bundle
                </a>
                <button
                  className={styles.reparseBtn}
                  style={{ padding: '4px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
                  onClick={handleReparseAll}
                  disabled={reparseState.busy}
                  title="Re-parse všechny neparsované záznamy (max 200)"
                >
                  {reparseState.busy ? '…' : '↺ Re-parse vše'}
                </button>
              </div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Zdrojové texty, které nebyly převedeny na typed ServiceRelation. Re-parse pipeline je plánován.
            </span>
            {reparseState.result && (
              <div className={styles.reparseResult}>{reparseState.result}</div>
            )}
          </div>
          {rawLoading && <div className={styles.state}>Načítám raw relace…</div>}
          {rawData && rawData.length === 0 && (
            <div className={styles.state}>Žádné neparsované relace ✅</div>
          )}
          {rawData && rawData.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Service ID</th>
                  <th>Zdrojové pole</th>
                  <th>Parser</th>
                  <th>Zachyceno</th>
                  <th>Raw hodnota</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rawData.map(r => (
                  <tr key={r.id}>
                    <td className={styles.numCell}>{r.id}</td>
                    <td>
                      <Link href={`/services/${r.service_id}`} className={styles.serviceLink}>{r.service_id}</Link>
                    </td>
                    <td><code className={styles.issueCode}>{r.source_field}</code></td>
                    <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{r.parser_version ?? '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{fmt(r.parsed_at)}</td>
                    <td className={styles.rawValue} title={r.raw_value}>
                      {r.raw_value.slice(0, 120)}{r.raw_value.length > 120 ? '…' : ''}
                    </td>
                    <td>
                      <button className={styles.reparseBtn}
                        onClick={() => handleReparse(r.id, r.service_id)}
                        disabled={reparseState.busy}
                        title="Spustit re-parse">
                        {reparseState.busy ? '…' : '↺'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
