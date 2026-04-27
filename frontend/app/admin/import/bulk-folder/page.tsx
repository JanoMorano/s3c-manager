'use client';

import { useMemo, useState } from 'react';
import { authHeaders } from '@/features/services/api/services.api';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import styles from '@/features/capabilities/capabilities.module.css';

interface PlanIssue {
  severity: string;
  code: string;
  message: string;
}

interface PlanRow {
  file: string;
  file_name: string;
  target_key: string | null;
  source_kind: string;
  spiral_code: string | null;
  row_count: number;
  duplicate_status: string;
  issues: PlanIssue[];
}

interface DryRunResponse {
  plan: PlanRow[];
  blocking_count: number;
}

interface CommitResponse {
  committed_count: number;
  skipped_count: number;
  runs: Array<PlanRow & { run_id: number }>;
}

export default function BulkFolderImportPage() {
  const [folderPath, setFolderPath] = useState('/tmp/import-nato');
  const [selectedSpiral, setSelectedSpiral] = useState('');
  const [allowOverride, setAllowOverride] = useState(false);
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);

  const stats = useMemo(() => {
    const blocking = plan.filter((row) => row.issues.some((issue) => issue.severity === 'blocking')).length;
    const ready = plan.length - blocking;
    const rows = plan.reduce((sum, row) => sum + Number(row.row_count ?? 0), 0);
    const spirals = [...new Set(plan.map((row) => row.spiral_code).filter(Boolean))].sort();
    return { blocking, ready, rows, spirals };
  }, [plan]);

  async function dryRun() {
    setBusy(true);
    setError(null);
    setCommitResult(null);
    try {
      const res = await fetch('/api/v1/import/bulk-folder/dry-run', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ folderPath, selectedSpiral: selectedSpiral || null, allowOverride }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      const payload = json as DryRunResponse;
      setPlan(payload.plan ?? []);
      setSummary(`${payload.plan?.length ?? 0} files planned, ${payload.blocking_count ?? 0} blocking issues`);
    } catch (caught: unknown) {
      setPlan([]);
      setSummary('');
      setError(caught instanceof Error ? caught.message : 'Dry-run failed');
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!plan.length) return;
    const readyRows = plan.filter((row) => !row.issues.some((issue) => issue.severity === 'blocking'));
    if (!readyRows.length) {
      setError('Commit blocked: no non-blocking files in the current plan.');
      return;
    }
    if (!window.confirm(`Create ${readyRows.length} import run record(s)? This writes audit rows but does not re-upload files.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/import/bulk-folder/commit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      const payload = json as CommitResponse;
      setCommitResult(payload);
      setSummary(`${payload.committed_count ?? 0} runs created, ${payload.skipped_count ?? 0} skipped`);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Commit failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Bulk folder import</h1>
          <p className={styles.lead}>Dry-run first, review spiral routing and blockers, then commit auditable import runs.</p>
        </div>
      </header>

      <section className={styles.wizardPanel}>
        <div className={styles.wizardControls}>
          <label>
            <span>Folder path visible to the API container</span>
            <input value={folderPath} onChange={(event) => setFolderPath(event.target.value)} />
          </label>
          <label>
            <span>Selected spiral override</span>
            <select value={selectedSpiral} onChange={(event) => setSelectedSpiral(event.target.value)}>
              <option value="">Infer from path/file</option>
              <option value="Spiral_4">Spiral 4</option>
              <option value="Spiral_5">Spiral 5</option>
              <option value="Spiral_6">Spiral 6</option>
              <option value="Spiral_7">Spiral 7</option>
            </select>
          </label>
          <label className={styles.checkboxLine}>
            <input type="checkbox" checked={allowOverride} onChange={(event) => setAllowOverride(event.target.checked)} />
            <span>Allow explicit override when inferred spiral differs</span>
          </label>
        </div>
        <div className={styles.wizardActions}>
          <button type="button" onClick={dryRun} disabled={busy}>Dry-run plan</button>
          <button type="button" onClick={commit} disabled={busy || !plan.length || stats.ready === 0}>Commit non-blocking</button>
        </div>
        <p className={styles.hintLine}>For local Docker smoke the path is `/tmp/import-nato`; in production mount the NATO source folder into the API container.</p>
        {error && <p className={styles.errorText}>{error}</p>}
        {summary && <p className={styles.bodyText}>{summary}</p>}
      </section>

      {plan.length > 0 && (
        <section className={styles.kpiGrid}>
          <KpiCard label="Files" value={plan.length} hint={`${stats.ready} ready`} />
          <KpiCard label="Rows" value={stats.rows} hint="planned source rows" />
          <KpiCard label="Blockers" value={stats.blocking} hint={stats.spirals.length ? `Spirals: ${stats.spirals.join(', ')}` : 'No spiral inferred yet'} />
        </section>
      )}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Import plan</h2>
        {!plan.length ? (
          <EmptyState title="No dry-run plan yet" description="Run a dry-run against a mounted folder to inspect target routing, source kind, row counts, and blocking issues." />
        ) : (
          <table className={styles.table}>
            <thead><tr><th>File</th><th>Target</th><th>Spiral</th><th>Rows</th><th>Status</th><th>Issues</th></tr></thead>
            <tbody>
              {plan.map((row) => {
                const blocking = row.issues.some((issue) => issue.severity === 'blocking');
                return (
                  <tr key={row.file}>
                    <td>{row.file_name}</td>
                    <td>{row.target_key ?? '—'}</td>
                    <td>{row.spiral_code ?? 'manual required'}</td>
                    <td>{row.row_count}</td>
                    <td><Badge variant={blocking ? 'danger' : 'success'}>{blocking ? 'blocked' : 'ready'}</Badge></td>
                    <td>{row.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ') || 'OK'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {commitResult && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Commit result</h2>
          <p className={styles.bodyText}>{commitResult.committed_count} run records created, {commitResult.skipped_count} skipped.</p>
          <div className={styles.commitRunList}>
            {commitResult.runs.slice(0, 12).map((run) => (
              <span key={`${run.file}-${run.run_id}`}>{run.file_name} → run #{run.run_id}</span>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
