/**
 * Import history — GET /import/batches + GET /import/batches/:id
 * Shows import history and detailed errors per batch.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from '@/app/components/AppLink';
import useSWR from 'swr';
import { apiFetch } from '@/features/services/api/services.api';
import { fetchImportBatch } from '@/features/services/api/editor.api';
import type { ImportBatch, ImportBatchDetail, ImportBatchIssue } from '@/features/services/api/editor.api';
import { AUTH_STATE_EVENT, getAuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { useInstallStatus } from '@/features/install/installStatus';
import { useI18n, useT } from '@/app/i18n/useI18n';
import { formatCountLabel } from '@/app/lib/counts';
import { helpIndexHref } from '@/app/lib/helpRoutes';
import { format } from 'date-fns';
import styles from './import.module.css';

const IMPORT_STEP_KEYS = [
  'import.workspace.step.profile',
  'import.workspace.step.upload',
  'import.workspace.step.dry_run',
  'import.workspace.step.validate',
  'import.workspace.step.commit',
  'import.workspace.step.review',
];

const SEVERITY_LABEL_KEYS: Record<string, string> = {
  error: 'import.workspace.severity.error',
  warn: 'import.workspace.severity.warn',
  warning: 'import.workspace.severity.warn',
  info: 'import.workspace.severity.info',
};

interface ExportManifestResponse {
  contract_version: string;
  schema_version: string;
}

interface ImportProfile {
  key: string;
  label: string;
  mode: string;
  required_fields: string[];
  description?: string;
}

interface ImportContractReport {
  source_name: string;
  source_hash_sha256?: string;
  item_count: number;
  flavour_count: number;
  explicit_relation_count: number;
  raw_prerequisite_count: number;
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
  target_key: string;
  label: string;
  source_name: string | null;
  source_kind: string;
  row_count: number;
  inserted_count: number;
  updated_count: number;
  failed_count: number;
  warn_count: number;
  error_count: number;
  created_at: string;
  admin_path: string | null;
}

export default function ImportReviewPage() {
  const { locale, t } = useI18n();
  const helpHref = `${helpIndexHref(locale)}#data`;
  const { c3Visible } = useInstallStatus();
  const [role, setRole] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showStubOnly, setShowStubOnly] = useState(false);
  const [selectedProfileKey, setSelectedProfileKey] = useState('s3c-service-catalogue-json');

  useEffect(() => {
    const syncRole = () => {
      setRole(getAuthSnapshot()?.role ?? null);
      setHydrated(true);
    };
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

  const isExpertImportUser = hydrated && c3Visible && hasRoleAccess(role, 'admin');

  const { data: manifest } = useSWR<ExportManifestResponse>(
    '/api/v1/export/manifest?scope=import',
    apiFetch,
    { revalidateOnFocus: false }
  );
  const { data: profiles } = useSWR<{ items: ImportProfile[] }>(
    '/api/v1/import/profiles',
    apiFetch,
    { revalidateOnFocus: false }
  );
  const { data: batches, isLoading, error } = useSWR<ImportBatch[]>(
    '/api/v1/import/batches?limit=50',
    apiFetch,
    { revalidateOnFocus: false }
  );
  const { data: preflight } = useSWR<ImportContractReport>(
    '/api/v1/import/contract-report/latest',
    apiFetch,
    { revalidateOnFocus: false }
  );
  const { data: stubServices } = useSWR<StubCompletionItem[]>(
    '/api/v1/import/stubs?limit=50',
    apiFetch,
    { revalidateOnFocus: false }
  );
  const { data: c3EntityRuns } = useSWR<C3EntityImportRunSummary[]>(
    isExpertImportUser ? '/api/v1/taxonomy/import-runs/latest' : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
  const { data: detail } = useSWR<ImportBatchDetail>(
    selectedId != null ? `/api/v1/import/batches/${selectedId}` : null,
    () => fetchImportBatch(selectedId!),
    { revalidateOnFocus: false }
  );
  const stubServiceIds = new Set((stubServices ?? []).map((item) => item.service_id));
  const selectedProfile = (profiles?.items ?? []).find((profile) => profile.key === selectedProfileKey) ?? profiles?.items?.[0];
  const latestC3Run = c3EntityRuns?.[0];
  const latestBatch = batches?.[0];
  const dryRunCreated = latestC3Run?.inserted_count ?? 0;
  const dryRunUpdated = latestC3Run?.updated_count ?? latestBatch?.ok_count ?? 0;
  const dryRunFailed = latestC3Run?.failed_count ?? latestBatch?.error_count ?? 0;
  const dryRunSuggestions = (preflight?.stub_count ?? 0) + (preflight?.unresolved_ref_count ?? 0);

  return (
    <div className={styles.shell}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('import.workspace.title')}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {manifest?.contract_version && <span className={styles.uploadBtn}>{t('administration.import.contract_version', { version: manifest.contract_version })}</span>}
          {manifest?.schema_version && <span className={styles.uploadBtn}>{t('administration.import.schema_version', { version: manifest.schema_version })}</span>}
          <a href="/api/v1/export/bundle" className={styles.uploadBtn}>{t('administration.import.export_bundle')} →</a>
          <a href="/api/v1/export/manifest" className={styles.uploadBtn}>{t('administration.import.export_manifest')} →</a>
          <a href="/import/upload" className={styles.uploadBtn}>{t('import.workspace.upload_catalogue')} →</a>
        </div>
      </div>

      <section className={styles.profilePanel}>
        <label className={styles.profileSelector}>
          <span>{t('administration.import.profile_label')}</span>
          <select
            aria-label={t('administration.import.profile_label')}
            value={selectedProfileKey}
            onChange={(event) => setSelectedProfileKey(event.target.value)}
          >
            {(profiles?.items ?? []).map((profile) => (
              <option key={profile.key} value={profile.key}>{profile.label}</option>
            ))}
          </select>
        </label>
        <div className={styles.profileDetail}>
          <strong>{selectedProfile?.label ?? t('administration.import.profile_default_label')}</strong>
          <span>{selectedProfile?.description ?? t('administration.import.profile_default_description')}</span>
          <div className={styles.profileFields}>
            {(selectedProfile?.required_fields ?? ['service_id', 'title']).map((field) => (
              <code key={field}>{field}</code>
            ))}
          </div>
        </div>
        <div className={styles.profileExports}>
          <a href="/api/v1/export/governance-report" className={styles.uploadBtn}>{t('administration.import.governance_report')}</a>
          <a href="/api/v1/export/capabilities/coverage" className={styles.uploadBtn}>{t('import.workspace.capability_coverage')}</a>
          <a href="/api/v1/export/backstage/catalog-info" className={styles.uploadBtn}>{t('import.workspace.backstage_yaml')}</a>
          <Link href={helpHref} className={styles.uploadBtn}>{t('administration.import.integration_mappings')}</Link>
        </div>
      </section>

      <section className={styles.importWizard} aria-label={t('import.workspace.aria')}>
        <ol className={styles.importSteps}>
          {IMPORT_STEP_KEYS.map((step, index) => (
            <li key={step} className={index <= 2 ? styles.stepDone : index === 3 ? styles.stepActive : styles.stepTodo}>
              <span>{index + 1}</span>
              <strong>{t(step)}</strong>
            </li>
          ))}
        </ol>

        <div className={styles.dryRunGrid}>
          <article className={`${styles.dryRunCard} ${styles.dryRunInfo}`}>
            <span>{t('import.workspace.dry_run.new_records')}</span>
            <strong>{dryRunCreated}</strong>
            <small>{t('import.workspace.dry_run.new_records_hint')}</small>
          </article>
          <article className={`${styles.dryRunCard} ${styles.dryRunSuccess}`}>
            <span>{t('import.workspace.dry_run.updated_records')}</span>
            <strong>{dryRunUpdated}</strong>
            <small>{t('import.workspace.dry_run.updated_records_hint')}</small>
          </article>
          <article className={`${styles.dryRunCard} ${dryRunFailed ? styles.dryRunDanger : styles.dryRunSuccess}`}>
            <span>{t('import.workspace.dry_run.failed_rows')}</span>
            <strong>{dryRunFailed}</strong>
            <small>{t(dryRunFailed ? 'import.workspace.dry_run.failed_rows_fix' : 'import.workspace.dry_run.failed_rows_none')}</small>
          </article>
          <article className={`${styles.dryRunCard} ${dryRunSuggestions ? styles.dryRunWarning : styles.dryRunInfo}`}>
            <span>{t('import.workspace.dry_run.suggestions')}</span>
            <strong>{dryRunSuggestions}</strong>
            <small>{t('import.workspace.dry_run.suggestions_hint')}</small>
          </article>
        </div>

        <div className={styles.governanceImpact}>
          <strong>{t('import.workspace.impact.title')}</strong>
          <span>
            {t('import.workspace.impact.text')}
          </span>
        </div>
      </section>

      {preflight && (
        <div className={styles.preflightBar}>
          <div className={styles.preflightTitle}>{t('import.workspace.latest_dry_run', { name: preflight.source_name })}</div>
          <div className={styles.preflightGrid}>
            <span className={styles.preflightPill}>{t('import.workspace.preflight.services', { count: preflight.item_count })}</span>
            <span className={styles.preflightPill}>{t('import.workspace.preflight.legacy_variants', { count: preflight.flavour_count })}</span>
            <span className={styles.preflightPill}>{t('import.workspace.preflight.relations', { count: preflight.explicit_relation_count })}</span>
            <span className={styles.preflightPill}>{t('import.workspace.preflight.stubs', { count: preflight.stub_count })}</span>
            <span className={styles.preflightPill}>{t('import.workspace.preflight.unresolved_refs', { count: preflight.unresolved_ref_count })}</span>
            <span className={styles.preflightPill}>{formatDate(preflight.created_at)}</span>
          </div>
        </div>
      )}

      {!!c3EntityRuns && c3EntityRuns.length > 0 && (
        <div className={styles.c3RunPanel}>
          <div className={styles.stubPanelTitle}>{t('import.workspace.c3_runs.title')}</div>
          <div className={styles.c3RunGrid}>
            {c3EntityRuns.map((run) => (
              <div key={run.id} className={styles.c3RunCard}>
                <div className={styles.c3RunTitle}>{run.label}</div>
                <div className={styles.c3RunMeta}>{run.source_name ?? t('import.workspace.c3_runs.no_source')}</div>
                <div className={styles.preflightGrid}>
                  <span className={styles.preflightPill}>{t('import.workspace.pill.rows', { count: run.row_count })}</span>
                  <span className={styles.preflightPill}>{t('import.workspace.pill.inserted', { count: run.inserted_count })}</span>
                  <span className={styles.preflightPill}>{t('import.workspace.pill.updated', { count: run.updated_count })}</span>
                  <span className={styles.preflightPill}>{t('import.workspace.pill.failed', { count: run.failed_count })}</span>
                </div>
                <div className={styles.c3RunFooter}>
                  <span>{formatDate(run.created_at)}</span>
                  {run.admin_path && <Link href={run.admin_path}>{t('import.workspace.c3_runs.open_list')} →</Link>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.stubPanel}>
        <div className={styles.stubPanelTitleRow}>
          <div className={styles.stubPanelTitle}>{t('import.workspace.stubs.title')}</div>
          <label className={styles.stubFilterToggle}>
            <input type="checkbox" checked={showStubOnly} onChange={(event) => setShowStubOnly(event.target.checked)} />
            <span>{t('import.workspace.stubs.only')}</span>
          </label>
        </div>
        {!stubServices ? (
          <div className={styles.state}>{t('common.loading')}</div>
        ) : stubServices.length === 0 ? (
          <div className={styles.state}>{t('import.workspace.stubs.empty')}</div>
        ) : (
          <div className={styles.stubTable}>
            <div className={styles.stubHeader}>
              <span>{t('administration.import.column_service_id')}</span>
              <span>{t('import.workspace.stubs.column.title')}</span>
              <span>{t('import.workspace.stubs.column.incoming')}</span>
              <span>{t('import.workspace.stubs.column.outgoing')}</span>
              <span>{t('import.workspace.stubs.column.related')}</span>
              <span>{t('import.workspace.stubs.column.detail')}</span>
            </div>
            {stubServices.map((stub) => (
              <div key={stub.id} className={styles.stubRow}>
                <span className={styles.stubMono}><Link href={`/services/${stub.service_id}`}>{stub.service_id}</Link></span>
                <span>{stub.title}</span>
                <span>{stub.incoming_relation_count}</span>
                <span>{stub.outgoing_relation_count}</span>
                <span className={styles.stubMono}>{stub.related_service_ids ?? t('common.none')}</span>
                <span><Link href={`/services/${stub.service_id}`} className={styles.stubDetailLink}>{t('import.workspace.stubs.open_detail')} →</Link></span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.body}>
        {/* ── Batch list ─────────────────────────────────────────────── */}
        <div className={styles.batchList}>
          <div className={styles.listHeader}>{t('import.workspace.batches.title')}</div>

          {isLoading && <div className={styles.state}>{t('common.loading')}</div>}
          {error     && <div className={styles.stateError}>{t('import.workspace.batches.error')}</div>}
          {!isLoading && !error && batches?.length === 0 && (
            <div className={styles.state}>{t('import.workspace.batches.empty')}</div>
          )}

          {batches?.map(b => (
            <button
              key={b.id}
              className={`${styles.batchRow} ${selectedId === b.id ? styles.selected : ''}`}
              onClick={() => setSelectedId(b.id)}
            >
              <div className={styles.batchTop}>
                <span className={styles.batchId}>#{b.id}</span>
                <span className={styles.batchSource}>{b.filename}</span>
                <BatchStatus errorCount={b.error_count} okCount={b.ok_count} warnCount={b.warn_count} />
              </div>
              <div className={styles.batchBottom}>
                <span>{formatCountLabel(b.row_count, { one: t('import.workspace.count.row.one'), few: t('import.workspace.count.row.few'), many: t('import.workspace.count.row.many') })}</span>
                <span>{formatDate(b.imported_at)}</span>
              </div>
            </button>
          ))}
        </div>

        {/* ── Batch detail ───────────────────────────────────────────── */}
        <div className={styles.batchDetail}>
          {!selectedId && (
            <div className={styles.detailEmpty}>{t('import.workspace.batches.select')}</div>
          )}

          {selectedId && detail && (
            (() => {
              const filteredIssues = showStubOnly
                ? detail.issues.filter((issue) => issue.service_id && stubServiceIds.has(issue.service_id))
                : detail.issues;
              const parsedFlavourIssues = filteredIssues.filter((issue) => issue.issue_code === 'FLAVOURS_PARSED');
              const parsedSlaIssues = filteredIssues.filter((issue) => issue.issue_code === 'SLA_PARSED');
              return (
            <>
              <div className={styles.detailHeader}>
                <h2 className={styles.detailTitle}>{t('import.workspace.batch.title', { id: detail.id })}</h2>
                <div className={styles.detailMeta}>
                  <MetaPill label={t('import.workspace.batch.file')} value={detail.filename} />
                  <MetaPill label={t('import.workspace.batch.rows')} value={`${detail.row_count}`} />
                  <MetaPill label={t('administration.import.column_ok')} value={detail.ok_count} color="green" />
                  <MetaPill label={t('import.workspace.batch.warnings')} value={detail.warn_count} color="blue" />
                  <MetaPill label={t('administration.import.column_errors')} value={detail.error_count} color={detail.error_count > 0 ? 'red' : undefined} />
                  <MetaPill label={t('administration.import.column_date')} value={formatDate(detail.imported_at)} />
                  {detail.imported_by && <MetaPill label={t('import.workspace.batch.imported_by')} value={detail.imported_by} />}
                </div>
              </div>

              {/* Issues table */}
              {filteredIssues && filteredIssues.length > 0 ? (
                <div className={styles.issuesSection}>
                  <div className={styles.issueSectionTitle}>
                    {t('import.workspace.issues.title', { count: filteredIssues.length })}
                  </div>
                  <div className={styles.issueTable}>
                    <div className={styles.issueHeader}>
                      <span>{t('import.workspace.issues.row')}</span>
                      <span>{t('administration.import.column_service_id')}</span>
                      <span>{t('administration.import.column_severity')}</span>
                      <span>{t('administration.import.column_field')}</span>
                      <span>{t('administration.import.column_message')}</span>
                    </div>
                    {filteredIssues.map((issue: ImportBatchIssue) => (
                      <div key={issue.id} className={`${styles.issueRow} ${styles[`issue_${issue.severity}`] ?? ''}`}>
                        <span className={styles.issueRow_mono}>{issue.row_id != null ? `#${issue.row_id}` : '—'}</span>
                        <span className={styles.issueRow_mono}>{issue.service_id ?? '—'}</span>
                        <span className={styles.issueType}>{SEVERITY_LABEL_KEYS[issue.severity] ? t(SEVERITY_LABEL_KEYS[issue.severity]) : issue.severity}</span>
                        <span className={styles.issueRow_mono}>{issue.field_name ?? '—'}</span>
                        <span>{issue.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                detail.issues && (
                  <div className={styles.noIssues}>
                    ✓ {t(showStubOnly ? 'import.workspace.issues.none_stub' : 'import.workspace.issues.none')}
                  </div>
                )
              )}
              {(parsedFlavourIssues.length > 0 || parsedSlaIssues.length > 0) && (
                <div className={styles.parsedPanel}>
                  <div className={styles.parsedPanelHeader}>
                    <span className={styles.detailTitle}>{t('administration.import.parsed_title')}</span>
                  </div>
                  <div className={styles.parsedGrid}>
                    {parsedFlavourIssues.map((issue) => {
                      const payload = parseIssuePayload(issue.raw_value);
                      const flavours = Array.isArray(payload)
                        ? payload as Array<{ flavour_code?: string; title?: string; service_unit?: string | null; price_value?: number | null; currency_code?: string | null }>
                        : [];
                      return (
                        <div key={issue.id} className={styles.parsedCard}>
                          <div className={styles.parsedCardTitle}>
                            {issue.service_id ? <Link href={`/services/${issue.service_id}`}>{issue.service_id}</Link> : t('administration.import.service_fallback')}
                          </div>
                          <div className={styles.parsedMessage}>{issue.message}</div>
                          <div className={styles.parsedList}>
                            {flavours.map((flavour, index) => (
                              <div key={`${issue.id}-${flavour.flavour_code ?? index}`} className={styles.parsedListItem}>
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
                        <div key={issue.id} className={styles.parsedCard}>
                          <div className={styles.parsedCardTitle}>
                            {issue.service_id ? <Link href={`/services/${issue.service_id}`}>{issue.service_id}</Link> : t('administration.import.service_fallback')}
                          </div>
                          <div className={styles.parsedMessage}>{issue.message}</div>
                          <div className={styles.parsedList}>
                            <div className={styles.parsedListItem}><strong>{t('administration.import.sla.availability')}</strong><span>{payload?.availability_pct != null ? `${payload.availability_pct}%` : '—'}</span></div>
                            <div className={styles.parsedListItem}><strong>{t('administration.import.sla.restoration')}</strong><span>{payload?.restoration_hours != null ? `${payload.restoration_hours} h` : '—'}</span></div>
                            <div className={styles.parsedListItem}><strong>{t('administration.import.sla.delivery')}</strong><span>{payload?.delivery_days != null ? `${payload.delivery_days} d` : '—'}</span></div>
                            <div className={styles.parsedListItem}><strong>{t('administration.import.sla.support_window')}</strong><span>{payload?.support_window_code ?? '—'}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function BatchStatus({ errorCount, okCount, warnCount }: { errorCount: number; okCount: number; warnCount: number }) {
  const t = useT();
  const okLabel = t('import.workspace.batch_status.ok', { count: okCount });
  if (errorCount > 0) return <span className={`${styles.batchBadge} ${styles.badgeFailed}`}>{formatCountLabel(errorCount, { one: t('administration.import.count.error.one'), few: t('administration.import.count.error.few'), many: t('administration.import.count.error.many') })}</span>;
  if (warnCount  > 0) return <span className={`${styles.batchBadge} ${styles.badgeWarn}`}>{okLabel} · {formatCountLabel(warnCount, { one: t('administration.import.count.warning.one'), few: t('administration.import.count.warning.few'), many: t('administration.import.count.warning.many') })}</span>;
  return <span className={`${styles.batchBadge} ${styles.badgeOk}`}>{okLabel}</span>;
}

function MetaPill({ label, value, color }: { label: string; value: string | number; color?: 'green' | 'red' | 'blue' }) {
  return (
    <div className={styles.metaPill}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={`${styles.metaValue} ${color ? styles[`meta_${color}`] : ''}`}>{value}</span>
    </div>
  );
}

function formatDate(iso: string) {
  try { return format(new Date(iso), 'dd MMM yyyy HH:mm'); } catch { return iso; }
}

function parseIssuePayload(rawValue: string | null): unknown {
  if (!rawValue) return null;
  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}
