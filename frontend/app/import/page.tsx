/**
 * Import — the single import page.
 * GET /api/v1/import/review       — batches (status filter) + summary
 * GET /api/v1/import/batches/:id  — batch detail with issues
 * Upload itself lives in /import/upload; /administration/import redirects here.
 */
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from '@/app/components/AppLink';
import useSWR from 'swr';
import { EmptyState, KpiCard } from '@/design-system/controls';
import type { KpiCardTone } from '@/design-system/controls/KpiCard';
import { apiFetch } from '@/features/services/api/services.api';
import { fetchImportBatch } from '@/features/services/api/editor.api';
import type { ImportBatchDetail, ImportBatchIssue } from '@/features/services/api/editor.api';
import { AUTH_STATE_EVENT, getAuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { useInstallStatus } from '@/features/install/installStatus';
import { useI18n, useT } from '@/app/i18n/useI18n';
import { formatDate } from '@/app/i18n/format';
import { formatCountLabel } from '@/app/lib/counts';
import ImportExportMenu from './ImportExportMenu';
import ImportExpertTools from './ImportExpertTools';
import styles from './import.module.css';

const IMPORT_DEBUG_TOOLS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_IMPORT_DEBUG_TOOLS === 'true';
const UPLOAD_HREF = '/import/upload';

type StatusFilter = '' | 'ok' | 'warn' | 'error';
type StepState = 'done' | 'active' | 'blocked';

const STATUS_FILTERS: Array<{ value: StatusFilter; labelKey: string }> = [
  { value: '', labelKey: 'administration.import.filter_all' },
  { value: 'ok', labelKey: 'administration.import.column_ok' },
  { value: 'warn', labelKey: 'import.workspace.batch.warnings' },
  { value: 'error', labelKey: 'administration.import.column_errors' },
];

const SEVERITY_LABEL_KEYS: Record<string, string> = {
  error: 'import.workspace.severity.error',
  warn: 'import.workspace.severity.warn',
  warning: 'import.workspace.severity.warn',
  info: 'import.workspace.severity.info',
};

interface ReviewBatch {
  id: number;
  filename: string;
  imported_by: string | null;
  row_count: number;
  ok_count: number;
  warn_count: number;
  error_count: number;
  imported_at: string;
}

interface ReviewResponse {
  batches: ReviewBatch[];
  summary: { total_batches: number | string | null; last_imported_at: string | null };
}

interface ImportContractReport {
  source_name: string;
  item_count: number;
  flavour_count: number;
  explicit_relation_count: number;
  stub_count: number;
  unresolved_ref_count: number;
  created_at: string;
}

interface StubCompletionItem {
  id: number;
  service_id: string;
  title: string;
  incoming_relation_count: number;
  outgoing_relation_count: number;
  related_service_ids: string | null;
}

interface C3EntityImportRunSummary {
  id: number;
  label: string;
  source_name: string | null;
  row_count: number;
  inserted_count: number;
  updated_count: number;
  failed_count: number;
  created_at: string;
  admin_path: string | null;
}

function useRole() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    const syncRole = () => setRole(getAuthSnapshot()?.role ?? null);
    syncRole();
    window.addEventListener('focus', syncRole);
    window.addEventListener('storage', syncRole);
    window.addEventListener(AUTH_STATE_EVENT, syncRole);
    return () => {
      window.removeEventListener('focus', syncRole);
      window.removeEventListener('storage', syncRole);
      window.removeEventListener(AUTH_STATE_EVENT, syncRole);
    };
  }, []);
  return role;
}

function batchTone(batch: Pick<ReviewBatch, 'error_count' | 'warn_count'>): 'error' | 'warn' | 'ok' {
  if (batch.error_count > 0) return 'error';
  if (batch.warn_count > 0) return 'warn';
  return 'ok';
}

export default function ImportPage() {
  return (
    <Suspense fallback={null}>
      <ImportWorkspace />
    </Suspense>
  );
}

function ImportWorkspace() {
  const { locale, t } = useI18n();
  const searchParams = useSearchParams();
  const requestedBatchId = Number(searchParams?.get('batchId')) || null;
  const { c3Visible } = useInstallStatus();
  const role = useRole();
  const canUpload = hasRoleAccess(role, 'editor');
  const isAdmin = hasRoleAccess(role, 'admin');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [selectedId, setSelectedId] = useState<number | null>(requestedBatchId);
  const fmt = (value: string | null | undefined) => (value ? formatDate(locale, value, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

  const { data, isLoading, error } = useSWR<ReviewResponse>(
    `/api/v1/import/review?limit=100${statusFilter ? `&status=${statusFilter}` : ''}`,
    apiFetch,
    { revalidateOnFocus: false },
  );
  const { data: preflight } = useSWR<ImportContractReport>('/api/v1/import/contract-report/latest', apiFetch, { revalidateOnFocus: false });
  const { data: stubServices } = useSWR<StubCompletionItem[]>('/api/v1/import/stubs?limit=50', apiFetch, { revalidateOnFocus: false });
  const { data: c3EntityRuns } = useSWR<C3EntityImportRunSummary[]>(
    isAdmin && c3Visible ? '/api/v1/taxonomy/import-runs/latest' : null,
    apiFetch,
    { revalidateOnFocus: false },
  );

  const batches = data?.batches ?? [];
  const totalBatches = Number(data?.summary?.total_batches ?? 0);
  const isEmpty = !!data && totalBatches === 0;
  const activeId = selectedId ?? batches[0]?.id ?? null;
  const activeRow = batches.find((batch) => batch.id === activeId);

  const { data: detail, isLoading: detailLoading } = useSWR<ImportBatchDetail>(
    activeId != null ? `/api/v1/import/batches/${activeId}` : null,
    () => fetchImportBatch(activeId!),
    { revalidateOnFocus: false },
  );

  const changeFilter = (value: StatusFilter) => {
    setStatusFilter(value);
    setSelectedId(null);
  };

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{t('nav.import')}</h1>
          <p className={styles.purpose}>{t('import.hub.lead')}</p>
        </div>
        <div className={styles.headerActions}>
          <ImportExportMenu />
          {canUpload && !isEmpty && (
            <Link href={UPLOAD_HREF} className={styles.primaryBtn}>{t('import.hub.upload')}</Link>
          )}
        </div>
      </header>

      {error && <div className={styles.stateError}>{t('import.workspace.batches.error')}</div>}
      {isLoading && !data && <div className={styles.state}>{t('common.loading')}</div>}

      {isEmpty && (
        <EmptyState
          title={t('import.workspace.batches.empty')}
          action={canUpload ? <Link href={UPLOAD_HREF} className={styles.primaryBtn}>{t('import.hub.upload')}</Link> : null}
        />
      )}

      {data && !isEmpty && (
        <section className={styles.workspace} aria-label={t('import.workspace.aria')}>
          {/* ── Batch list ─────────────────────────────────────────── */}
          <div className={styles.listPanel}>
            <div className={styles.listHeader}>
              <h2 className={styles.panelTitle}>
                {t('administration.import.tab_batches')} <span className={styles.count}>{totalBatches}</span>
              </h2>
              <div className={styles.segmented} role="group" aria-label={t('common.status')}>
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.value || 'all'}
                    type="button"
                    aria-pressed={statusFilter === filter.value}
                    className={`${styles.segment} ${statusFilter === filter.value ? styles.segmentActive : ''}`}
                    onClick={() => changeFilter(filter.value)}
                  >
                    {t(filter.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            {batches.length === 0 && <div className={styles.state}>{t('administration.import.no_batches')}</div>}
            <div className={styles.batchList}>
              {batches.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  className={`${styles.batchRow} ${activeId === batch.id ? styles.batchRowSelected : ''}`}
                  aria-current={activeId === batch.id ? 'true' : undefined}
                  onClick={() => setSelectedId(batch.id)}
                >
                  <span className={styles.batchTop}>
                    <span className={styles.batchName}>{batch.filename}</span>
                    <BatchStatus batch={batch} />
                  </span>
                  <span className={styles.batchMeta}>
                    <span>#{batch.id}</span>
                    <span>{formatCountLabel(Number(batch.row_count), { one: t('import.workspace.count.row.one'), few: t('import.workspace.count.row.few'), many: t('import.workspace.count.row.many') })}</span>
                    <span>{fmt(batch.imported_at)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Batch detail ───────────────────────────────────────── */}
          <div className={styles.detailPanel}>
            {activeId == null && <div className={styles.state}>{t('import.workspace.batches.select')}</div>}
            {activeId != null && detailLoading && !detail && <div className={styles.state}>{t('common.loading')}</div>}
            {activeId != null && detail && (
              <BatchDetail
                detail={detail}
                importedBy={detail.imported_by ?? activeRow?.imported_by ?? null}
                stubServiceIds={new Set((stubServices ?? []).map((item) => item.service_id))}
                fmt={fmt}
              />
            )}
          </div>
        </section>
      )}

      {/* ── Follow-up sections (only when there is something to show) ── */}
      {!!stubServices && stubServices.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {t('import.workspace.stubs.title')} <span className={styles.count}>{stubServices.length}</span>
          </h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('administration.import.column_service_id')}</th>
                  <th>{t('import.workspace.stubs.column.title')}</th>
                  <th>{t('import.workspace.stubs.column.incoming')}</th>
                  <th>{t('import.workspace.stubs.column.outgoing')}</th>
                  <th>{t('import.workspace.stubs.column.related')}</th>
                </tr>
              </thead>
              <tbody>
                {stubServices.map((stub) => (
                  <tr key={stub.id}>
                    <td><Link href={`/services/${stub.service_id}`} className={styles.textLink}>{stub.service_id}</Link></td>
                    <td>{stub.title}</td>
                    <td className={styles.mono}>{stub.incoming_relation_count}</td>
                    <td className={styles.mono}>{stub.outgoing_relation_count}</td>
                    <td className={styles.muted}>{stub.related_service_ids ?? t('common.none')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {preflight && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('import.workspace.latest_dry_run', { name: preflight.source_name })}</h2>
          <div className={styles.pillRow}>
            <span className={styles.pill}>{t('import.workspace.preflight.services', { count: preflight.item_count })}</span>
            <span className={styles.pill}>{t('import.workspace.preflight.legacy_variants', { count: preflight.flavour_count })}</span>
            <span className={styles.pill}>{t('import.workspace.preflight.relations', { count: preflight.explicit_relation_count })}</span>
            <span className={styles.pill}>{t('import.workspace.preflight.stubs', { count: preflight.stub_count })}</span>
            <span className={styles.pill}>{t('import.workspace.preflight.unresolved_refs', { count: preflight.unresolved_ref_count })}</span>
            <span className={styles.muted}>{fmt(preflight.created_at)}</span>
          </div>
        </section>
      )}

      {!!c3EntityRuns && c3EntityRuns.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('import.workspace.c3_runs.title')}</h2>
          <div className={styles.cardGrid}>
            {c3EntityRuns.map((run) => (
              <div key={run.id} className={styles.card}>
                <strong>{run.label}</strong>
                <span className={styles.muted}>{run.source_name ?? t('import.workspace.c3_runs.no_source')} · {fmt(run.created_at)}</span>
                <div className={styles.pillRow}>
                  <span className={styles.pill}>{t('import.workspace.pill.rows', { count: run.row_count })}</span>
                  <span className={styles.pill}>{t('import.workspace.pill.inserted', { count: run.inserted_count })}</span>
                  <span className={styles.pill}>{t('import.workspace.pill.updated', { count: run.updated_count })}</span>
                  <span className={styles.pill}>{t('import.workspace.pill.failed', { count: run.failed_count })}</span>
                </div>
                {run.admin_path && <Link href={run.admin_path} className={styles.textLink}>{t('import.workspace.c3_runs.open_list')} →</Link>}
              </div>
            ))}
          </div>
        </section>
      )}

      {isAdmin && IMPORT_DEBUG_TOOLS_ENABLED && <ImportExpertTools />}
    </main>
  );
}

// ── Batch detail ──────────────────────────────────────────────────────────────
function BatchDetail({
  detail,
  importedBy,
  stubServiceIds,
  fmt,
}: {
  detail: ImportBatchDetail;
  importedBy: string | null;
  stubServiceIds: Set<string>;
  fmt: (value: string | null | undefined) => string;
}) {
  const t = useT();
  const [stubOnly, setStubOnly] = useState(false);
  const errorCount = Number(detail.error_count);
  const warnCount = Number(detail.warn_count);
  const okCount = Number(detail.ok_count);
  const issues = stubOnly
    ? detail.issues.filter((issue) => issue.service_id && stubServiceIds.has(issue.service_id))
    : detail.issues;
  const parsedFlavourIssues = issues.filter((issue) => issue.issue_code === 'FLAVOURS_PARSED');
  const parsedSlaIssues = issues.filter((issue) => issue.issue_code === 'SLA_PARSED');
  const rowIssues = issues.filter((issue) => issue.issue_code !== 'FLAVOURS_PARSED' && issue.issue_code !== 'SLA_PARSED');

  const steps: Array<{ key: string; state: StepState }> = [
    { key: 'import.workspace.step.upload', state: 'done' },
    { key: 'import.workspace.step.validate', state: 'done' },
    { key: 'import.workspace.step.commit', state: okCount > 0 ? 'done' : 'blocked' },
    { key: 'import.workspace.step.review', state: errorCount + warnCount > 0 ? 'active' : 'done' },
  ];
  const tiles: Array<{ labelKey: string; value: number; tone: KpiCardTone }> = [
    { labelKey: 'import.workspace.batch.rows', value: Number(detail.row_count), tone: 'neutral' },
    { labelKey: 'administration.import.column_ok', value: okCount, tone: 'success' },
    { labelKey: 'import.workspace.batch.warnings', value: warnCount, tone: warnCount > 0 ? 'warning' : 'neutral' },
    { labelKey: 'administration.import.column_errors', value: errorCount, tone: errorCount > 0 ? 'danger' : 'neutral' },
  ];

  return (
    <>
      <div className={styles.detailHeader}>
        <h2 className={styles.panelTitle}>{t('import.workspace.batch.title', { id: detail.id })}</h2>
        <p className={styles.muted}>
          {[detail.filename, importedBy, fmt(detail.imported_at)].filter(Boolean).join(' · ')}
        </p>
      </div>

      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={step.key} className={styles[`step_${step.state}`]}>
            <span>{step.state === 'done' ? '✓' : index + 1}</span>
            <strong>{t(step.key)}</strong>
          </li>
        ))}
      </ol>

      <div className={styles.tiles}>
        {tiles.map((tile) => (
          <KpiCard key={tile.labelKey} label={t(tile.labelKey)} value={tile.value} tone={tile.tone} />
        ))}
      </div>

      <div className={styles.issueBlock}>
        <div className={styles.issueHeader}>
          <h3 className={styles.blockTitle}>{t('import.workspace.issues.title', { count: rowIssues.length })}</h3>
          {stubServiceIds.size > 0 && (
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={stubOnly} onChange={(event) => setStubOnly(event.target.checked)} />
              <span>{t('import.workspace.stubs.only')}</span>
            </label>
          )}
        </div>
        {rowIssues.length === 0 ? (
          <p className={styles.okNote}>✓ {t(stubOnly ? 'import.workspace.issues.none_stub' : 'import.workspace.issues.none')}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('import.workspace.issues.row')}</th>
                  <th>{t('administration.import.column_severity')}</th>
                  <th>{t('administration.import.column_code')}</th>
                  <th>{t('administration.import.column_service_id')}</th>
                  <th>{t('administration.import.column_field')}</th>
                  <th>{t('administration.import.column_message')}</th>
                </tr>
              </thead>
              <tbody>
                {rowIssues.map((issue: ImportBatchIssue) => (
                  <tr key={issue.id}>
                    <td className={styles.mono}>{issue.row_id != null ? `#${issue.row_id}` : '—'}</td>
                    <td>
                      <span className={`${styles.severity} ${styles[`severity_${issue.severity === 'warning' ? 'warn' : issue.severity}`] ?? ''}`}>
                        {SEVERITY_LABEL_KEYS[issue.severity] ? t(SEVERITY_LABEL_KEYS[issue.severity]) : issue.severity}
                      </span>
                    </td>
                    <td><code className={styles.code}>{issue.issue_code ?? '—'}</code></td>
                    <td>{issue.service_id ? <Link href={`/services/${issue.service_id}`} className={styles.textLink}>{issue.service_id}</Link> : '—'}</td>
                    <td className={styles.mono}>{issue.field_name ?? '—'}</td>
                    <td>{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(parsedFlavourIssues.length > 0 || parsedSlaIssues.length > 0) && (
        <div className={styles.issueBlock}>
          <h3 className={styles.blockTitle}>{t('administration.import.parsed_title')}</h3>
          <div className={styles.cardGrid}>
            {parsedFlavourIssues.map((issue) => {
              const payload = parseIssuePayload(issue.raw_value);
              const flavours = Array.isArray(payload)
                ? payload as Array<{ flavour_code?: string; title?: string; service_unit?: string | null; price_value?: number | null; currency_code?: string | null }>
                : [];
              return (
                <div key={issue.id} className={styles.card}>
                  <strong>{issue.service_id ? <Link href={`/services/${issue.service_id}`} className={styles.textLink}>{issue.service_id}</Link> : t('administration.import.service_fallback')}</strong>
                  <span className={styles.muted}>{issue.message}</span>
                  <div className={styles.parsedList}>
                    {flavours.map((flavour, index) => (
                      <div key={`${issue.id}-${flavour.flavour_code ?? index}`} className={styles.parsedItem}>
                        <strong>{flavour.flavour_code ?? t('administration.import.not_available')}</strong>
                        <span>{flavour.title ?? t('administration.import.untitled')}</span>
                        <span>{flavour.service_unit ?? '—'}</span>
                        <span>{flavour.price_value != null ? `${flavour.price_value} ${flavour.currency_code ?? 'EUR'}` : t('administration.import.no_legacy_price')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {parsedSlaIssues.map((issue) => {
              const payload = parseIssuePayload(issue.raw_value) as { availability_pct?: number | null; restoration_hours?: number | null; delivery_days?: number | null; support_window_code?: string | null } | null;
              return (
                <div key={issue.id} className={styles.card}>
                  <strong>{issue.service_id ? <Link href={`/services/${issue.service_id}`} className={styles.textLink}>{issue.service_id}</Link> : t('administration.import.service_fallback')}</strong>
                  <span className={styles.muted}>{issue.message}</span>
                  <div className={styles.parsedList}>
                    <div className={styles.parsedItem}><strong>{t('administration.import.sla.availability')}</strong><span>{payload?.availability_pct != null ? `${payload.availability_pct}%` : '—'}</span></div>
                    <div className={styles.parsedItem}><strong>{t('administration.import.sla.restoration')}</strong><span>{payload?.restoration_hours != null ? `${payload.restoration_hours} h` : '—'}</span></div>
                    <div className={styles.parsedItem}><strong>{t('administration.import.sla.delivery')}</strong><span>{payload?.delivery_days != null ? `${payload.delivery_days} d` : '—'}</span></div>
                    <div className={styles.parsedItem}><strong>{t('administration.import.sla.support_window')}</strong><span>{payload?.support_window_code ?? '—'}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function BatchStatus({ batch }: { batch: ReviewBatch }) {
  const t = useT();
  const tone = batchTone({ error_count: Number(batch.error_count), warn_count: Number(batch.warn_count) });
  const label = tone === 'error'
    ? formatCountLabel(Number(batch.error_count), { one: t('administration.import.count.error.one'), few: t('administration.import.count.error.few'), many: t('administration.import.count.error.many') })
    : tone === 'warn'
      ? formatCountLabel(Number(batch.warn_count), { one: t('administration.import.count.warning.one'), few: t('administration.import.count.warning.few'), many: t('administration.import.count.warning.many') })
      : t('administration.import.all_ok');
  return <span className={`${styles.statusBadge} ${styles[`status_${tone}`]}`}>{label}</span>;
}

function parseIssuePayload(rawValue: string | null): unknown {
  if (!rawValue) return null;
  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}
