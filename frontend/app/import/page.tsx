/**
 * Import Review — GET /import/batches + GET /import/batches/:id
 * Shows import history and detailed errors per batch.
 */
'use client';

import { useState } from 'react';
import Link from '@/app/components/AppLink';
import useSWR from 'swr';
import { apiFetch } from '@/features/services/api/services.api';
import { fetchImportBatch } from '@/features/services/api/editor.api';
import type { ImportBatch, ImportBatchDetail, ImportBatchIssue } from '@/features/services/api/editor.api';
import { format } from 'date-fns';
import styles from './import.module.css';

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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showStubOnly, setShowStubOnly] = useState(false);
  const [selectedProfileKey, setSelectedProfileKey] = useState('s3c-service-catalogue-json');
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
    '/api/v1/taxonomy/import-runs/latest',
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
        <h1 className={styles.pageTitle}>Import Review</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {manifest?.contract_version && <span className={styles.uploadBtn}>Contract {manifest.contract_version}</span>}
          {manifest?.schema_version && <span className={styles.uploadBtn}>Schema {manifest.schema_version}</span>}
          <a href="/api/v1/export/bundle" className={styles.uploadBtn}>Export bundle →</a>
          <a href="/api/v1/export/manifest" className={styles.uploadBtn}>Export manifest →</a>
          <a href="/api/health/import" className={styles.uploadBtn}>Import health →</a>
          <a href="/import/upload" className={styles.uploadBtn}>Upload CSV →</a>
        </div>
      </div>

      <section className={styles.profilePanel}>
        <label className={styles.profileSelector}>
          <span>Import profile</span>
          <select
            aria-label="Import profile"
            value={selectedProfileKey}
            onChange={(event) => setSelectedProfileKey(event.target.value)}
          >
            {(profiles?.items ?? []).map((profile) => (
              <option key={profile.key} value={profile.key}>{profile.label}</option>
            ))}
          </select>
        </label>
        <div className={styles.profileDetail}>
          <strong>{selectedProfile?.label ?? 'S3C service catalogue JSON'}</strong>
          <span>{selectedProfile?.description ?? 'Native import/export profile.'}</span>
          <div className={styles.profileFields}>
            {(selectedProfile?.required_fields ?? ['service_id', 'title']).map((field) => (
              <code key={field}>{field}</code>
            ))}
          </div>
        </div>
        <div className={styles.profileExports}>
          <a href="/api/v1/export/governance-report" className={styles.uploadBtn}>Governance report</a>
          <a href="/api/v1/export/capabilities/coverage" className={styles.uploadBtn}>Capability coverage</a>
          <a href="/api/v1/export/backstage/catalog-info" className={styles.uploadBtn}>Backstage YAML</a>
          <Link href="/help#data" className={styles.uploadBtn}>Integration mappings</Link>
        </div>
      </section>

      <section className={styles.importWizard} aria-label="Import workspace">
        <ol className={styles.importSteps}>
          {['Profile', 'Upload', 'Dry run', 'Validate', 'Commit', 'Review'].map((step, index) => (
            <li key={step} className={index <= 2 ? styles.stepDone : index === 3 ? styles.stepActive : styles.stepTodo}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>

        <div className={styles.dryRunGrid}>
          <article className={`${styles.dryRunCard} ${styles.dryRunInfo}`}>
            <span>New records</span>
            <strong>{dryRunCreated}</strong>
            <small>server-side dry run</small>
          </article>
          <article className={`${styles.dryRunCard} ${styles.dryRunSuccess}`}>
            <span>Updated records</span>
            <strong>{dryRunUpdated}</strong>
            <small>safe to commit after validation</small>
          </article>
          <article className={`${styles.dryRunCard} ${dryRunFailed ? styles.dryRunDanger : styles.dryRunSuccess}`}>
            <span>Failed rows</span>
            <strong>{dryRunFailed}</strong>
            <small>{dryRunFailed ? 'fix before commit' : 'no blocking errors'}</small>
          </article>
          <article className={`${styles.dryRunCard} ${dryRunSuggestions ? styles.dryRunWarning : styles.dryRunInfo}`}>
            <span>Mapping suggestions</span>
            <strong>{dryRunSuggestions}</strong>
            <small>stubs and unresolved references</small>
          </article>
        </div>

        <div className={styles.governanceImpact}>
          <strong>Governance impact</strong>
          <span>
            Import profile {selectedProfile?.label ?? 'S3C service catalogue JSON'} can affect service ownership, C3 mapping, readiness and decision evidence. Commit is intentionally separated from dry run.
          </span>
        </div>
      </section>

      {preflight && (
        <div className={styles.preflightBar}>
          <div className={styles.preflightTitle}>Poslední preflight: {preflight.source_name}</div>
          <div className={styles.preflightGrid}>
            <span className={styles.preflightPill}>Services {preflight.item_count}</span>
            <span className={styles.preflightPill}>Flavours {preflight.flavour_count}</span>
            <span className={styles.preflightPill}>Explicit relations {preflight.explicit_relation_count}</span>
            <span className={styles.preflightPill}>Raw prerequisites {preflight.raw_prerequisite_count}</span>
            <span className={styles.preflightPill}>Stubs {preflight.stub_count}</span>
            <span className={styles.preflightPill}>Unresolved refs {preflight.unresolved_ref_count}</span>
            {preflight.source_hash_sha256 && <span className={styles.preflightPill}>Hash {preflight.source_hash_sha256.slice(0, 12)}…</span>}
            <span className={styles.preflightPill}>{formatDate(preflight.created_at)}</span>
          </div>
        </div>
      )}

      {!!c3EntityRuns && c3EntityRuns.length > 0 && (
        <div className={styles.c3RunPanel}>
          <div className={styles.stubPanelTitle}>Poslední import summary pro C3 entity</div>
          <div className={styles.c3RunGrid}>
            {c3EntityRuns.map((run) => (
              <div key={run.id} className={styles.c3RunCard}>
                <div className={styles.c3RunTitle}>{run.label}</div>
                <div className={styles.c3RunMeta}>{run.source_name ?? 'bez názvu zdroje'}</div>
                <div className={styles.preflightGrid}>
                  <span className={styles.preflightPill}>Rows {run.row_count}</span>
                  <span className={styles.preflightPill}>Inserted {run.inserted_count}</span>
                  <span className={styles.preflightPill}>Updated {run.updated_count}</span>
                  <span className={styles.preflightPill}>Failed {run.failed_count}</span>
                </div>
                <div className={styles.c3RunFooter}>
                  <span>{formatDate(run.created_at)}</span>
                  {run.admin_path && <Link href={run.admin_path}>Otevřít list →</Link>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.stubPanel}>
        <div className={styles.stubPanelTitleRow}>
          <div className={styles.stubPanelTitle}>Auto-created stub services</div>
          <label className={styles.stubFilterToggle}>
            <input type="checkbox" checked={showStubOnly} onChange={(event) => setShowStubOnly(event.target.checked)} />
            <span>Jen stuby</span>
          </label>
        </div>
        {!stubServices ? (
          <div className={styles.state}>Loading…</div>
        ) : stubServices.length === 0 ? (
          <div className={styles.state}>Žádné stub služby čekající na doplnění.</div>
        ) : (
          <div className={styles.stubTable}>
            <div className={styles.stubHeader}>
              <span>Service ID</span>
              <span>Title</span>
              <span>Incoming</span>
              <span>Outgoing</span>
              <span>Related services</span>
              <span>Detail</span>
            </div>
            {stubServices.map((stub) => (
              <div key={stub.id} className={styles.stubRow}>
                <span className={styles.stubMono}><Link href={`/services/${stub.service_id}`}>{stub.service_id}</Link></span>
                <span>{stub.title}</span>
                <span>{stub.incoming_relation_count}</span>
                <span>{stub.outgoing_relation_count}</span>
                <span className={styles.stubMono}>{stub.related_service_ids ?? 'none'}</span>
                <span><Link href={`/services/${stub.service_id}`} className={styles.stubDetailLink}>Detail stubu →</Link></span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.body}>
        {/* ── Batch list ─────────────────────────────────────────────── */}
        <div className={styles.batchList}>
          <div className={styles.listHeader}>Recent Batches</div>

          {isLoading && <div className={styles.state}>Loading…</div>}
          {error     && <div className={styles.stateError}>Failed to load batches.</div>}
          {!isLoading && !error && batches?.length === 0 && (
            <div className={styles.state}>No imports yet.</div>
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
                <span>{b.row_count} rows</span>
                <span>{formatDate(b.imported_at)}</span>
              </div>
            </button>
          ))}
        </div>

        {/* ── Batch detail ───────────────────────────────────────────── */}
        <div className={styles.batchDetail}>
          {!selectedId && (
            <div className={styles.detailEmpty}>Select a batch to see details and issues.</div>
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
                <h2 className={styles.detailTitle}>Batch #{detail.id}</h2>
                <div className={styles.detailMeta}>
                  <MetaPill label="File"      value={detail.filename} />
                  <MetaPill label="Rows"      value={`${detail.row_count}`} />
                  <MetaPill label="OK"        value={detail.ok_count}   color="green" />
                  <MetaPill label="Warnings"  value={detail.warn_count} color="blue" />
                  <MetaPill label="Errors"    value={detail.error_count} color={detail.error_count > 0 ? 'red' : undefined} />
                  <MetaPill label="Date"      value={formatDate(detail.imported_at)} />
                  {detail.imported_by && <MetaPill label="By" value={detail.imported_by} />}
                </div>
              </div>

              {/* Issues table */}
              {filteredIssues && filteredIssues.length > 0 ? (
                <div className={styles.issuesSection}>
                  <div className={styles.issueSectionTitle}>
                    Row Issues ({filteredIssues.length})
                  </div>
                  <div className={styles.issueTable}>
                    <div className={styles.issueHeader}>
                      <span>Row</span>
                      <span>Service ID</span>
                      <span>Severity</span>
                      <span>Field</span>
                      <span>Message</span>
                    </div>
                    {filteredIssues.map((issue: ImportBatchIssue) => (
                      <div key={issue.id} className={`${styles.issueRow} ${styles[`issue_${issue.severity}`] ?? ''}`}>
                        <span className={styles.issueRow_mono}>{issue.row_id != null ? `#${issue.row_id}` : '—'}</span>
                        <span className={styles.issueRow_mono}>{issue.service_id ?? '—'}</span>
                        <span className={styles.issueType}>{issue.severity}</span>
                        <span className={styles.issueRow_mono}>{issue.field_name ?? '—'}</span>
                        <span>{issue.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                detail.issues && (
                  <div className={styles.noIssues}>
                    {showStubOnly ? '✓ V tomto batchi nejsou žádné stub issues.' : '✓ No issues found in this batch.'}
                  </div>
                )
              )}
              {(parsedFlavourIssues.length > 0 || parsedSlaIssues.length > 0) && (
                <div className={styles.parsedPanel}>
                  <div className={styles.parsedPanelHeader}>
                    <span className={styles.detailTitle}>Parsované flavoury a SLA</span>
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
                            {issue.service_id ? <Link href={`/services/${issue.service_id}`}>{issue.service_id}</Link> : 'Služba'}
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
                            {issue.service_id ? <Link href={`/services/${issue.service_id}`}>{issue.service_id}</Link> : 'Služba'}
                          </div>
                          <div className={styles.parsedMessage}>{issue.message}</div>
                          <div className={styles.parsedList}>
                            <div className={styles.parsedListItem}><strong>availability</strong><span>{payload?.availability_pct != null ? `${payload.availability_pct}%` : '—'}</span></div>
                            <div className={styles.parsedListItem}><strong>restoration</strong><span>{payload?.restoration_hours != null ? `${payload.restoration_hours} h` : '—'}</span></div>
                            <div className={styles.parsedListItem}><strong>delivery</strong><span>{payload?.delivery_days != null ? `${payload.delivery_days} d` : '—'}</span></div>
                            <div className={styles.parsedListItem}><strong>support window</strong><span>{payload?.support_window_code ?? '—'}</span></div>
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
  if (errorCount > 0) return <span className={`${styles.batchBadge} ${styles.badgeFailed}`}>{errorCount} errors</span>;
  if (warnCount  > 0) return <span className={`${styles.batchBadge} ${styles.badgeWarn}`}>{okCount} ok · {warnCount} warn</span>;
  return <span className={`${styles.batchBadge} ${styles.badgeOk}`}>{okCount} ok</span>;
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
