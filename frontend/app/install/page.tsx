'use client';
/**
 * /app/install/page.tsx — Install wizard
 *
 * 11 steps as defined in APP_FLOW.md:
 *   1  Welcome / mode detection
 *   2  System configuration
 *   3  Secret validation
 *   4  Admin bootstrap
 *   5  Connectivity check
 *   6  Module plan
 *   7  Data package plan
 *   8  Import upload (optional)
 *   9  Import preview
 *  10  Execute
 *  11  Final summary
 *
 * The frontend only reads state from the API — it never determines install state itself.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { markInstallReady } from '@/app/components/AuthGuard';
import { useT } from '@/app/i18n/useI18n';
import styles from './install.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InstallMode   = 'fresh' | 'repair' | 'upgrade' | 'ready';
type InstallStatus = 'NOT_INSTALLED' | 'INSTALL_IN_PROGRESS' | 'CORE_INSTALLED' |
                     'MODULES_CONFIGURED' | 'DATA_IMPORT_IN_PROGRESS' | 'READY' |
                     'INSTALL_FAILED' | 'UPGRADE_REQUIRED' | 'REPAIR_REQUIRED';

interface ModuleInfo {
  code: string;
  label: string;
  is_mandatory: boolean;
  enabled: boolean;
  ui_visible?: boolean;
  api_enabled?: boolean;
}

interface InstallStatusResponse {
  mode: InstallMode;
  status: InstallStatus;
  install_locked: boolean;
  locked_by: string | null;
  app_version: string;
  schema_version: string;
  admin_exists: boolean;
  modules: ModuleInfo[];
  db_error?: string;
}

interface ConnectivityChecks {
  db_reachable: boolean;
  db_write_access: boolean;
  platform_schema: boolean;
  errors: string[];
}

interface ImportPreview {
  row_count: number;
  columns: string[];
  required_present: string[];
  required_missing: string[];
  warnings: string[];
  sample: Record<string, string>[];
  fatal_error: string | null;
}

interface ImportResult {
  ok: boolean;
  filename: string;
  batchId?: string | number;
  inserted?: number;
  updated?: number;
  failed?: number;
  error?: string;
  status?: string;
}

interface FilePreview {
  file: File;
  preview: ImportPreview;
  content: string;
}

interface SysConfig {
  app_name: string;
  base_url: string;
  timezone: string;
  storage_path: string;
  https_mode: boolean;
}

interface StepDef {
  label: string;
  id: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS: StepDef[] = [
  { id: 'welcome',     label: 'install.step.welcome' },
  { id: 'config',      label: 'install.step.config' },
  { id: 'secrets',     label: 'install.step.secrets' },
  { id: 'admin',       label: 'install.step.admin' },
  { id: 'connectivity',label: 'install.step.connectivity' },
  { id: 'modules',     label: 'install.step.modules' },
  { id: 'data-plan',   label: 'install.step.data_plan' },
  { id: 'upload',      label: 'install.step.upload' },
  { id: 'preview',     label: 'install.step.preview' },
  { id: 'execute',     label: 'install.step.execute' },
  { id: 'summary',     label: 'install.step.summary' },
];

// ---------------------------------------------------------------------------
// Small reusable components
// ---------------------------------------------------------------------------

function StepDot({ num, status }: { num: number; status: 'pending' | 'active' | 'done' | 'error' }) {
  if (status === 'done')  return <span className={styles.stepDot}>✓</span>;
  if (status === 'error') return <span className={styles.stepDot}>!</span>;
  return <span className={styles.stepDot}>{num}</span>;
}

function Alert({ type, children }: { type: 'error' | 'warning' | 'success' | 'info'; children: React.ReactNode }) {
  return <div className={`${styles.alert} ${styles[type]}`}>{children}</div>;
}

function Spinner({ dark }: { dark?: boolean }) {
  return <span className={`${styles.spinner} ${dark ? styles.spinnerDark : ''}`} />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function InstallPage() {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [errorSteps, setErrorSteps] = useState<Set<number>>(new Set());

  // Step 1 — detection
  const [installInfo, setInstallInfo] = useState<InstallStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Step 2 — system config
  const [sysConfig, setSysConfig] = useState<SysConfig>({
    app_name: 'Service Catalogue',
    base_url: '',
    timezone: 'Europe/Prague',
    storage_path: '/app/uploads',
    https_mode: false,
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Step 4 — admin form
  const [adminForm, setAdminForm] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    mustChangePassword: true,
  });
  const [adminErrors, setAdminErrors] = useState<Partial<Record<string, string>>>({});

  // Step 5 — connectivity
  const [connectivity, setConnectivity] = useState<ConnectivityChecks | null>(null);
  const [checkingConn, setCheckingConn] = useState(false);

  // Step 6 — modules
  const [activateC3, setActivateC3] = useState(false);
  const [seedDemoData, setSeedDemoData] = useState(false);

  // Step 8 — upload (multi-file)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 9 — import previews (per-file)
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Step 11 — import results (per-file)
  const [importResults, setImportResults] = useState<ImportResult[]>([]);

  // Step 10 — execute
  const [executing, setExecuting] = useState(false);
  const [executeProgress, setExecuteProgress] = useState(0);
  const [executeLog, setExecuteLog] = useState<string[]>([]);
  const [executeError, setExecuteError] = useState<string | null>(null);

  // Step 11 — summary
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);

  // Global error
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [installSetupToken, setInstallSetupToken] = useState('');

  // Reset stuck install
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [installLockedError, setInstallLockedError] = useState(false);

  // Guard against double-submit on welcome step
  const [isStarting, setIsStarting] = useState(false);

  // ---------------------------------------------------------------------------
  // Load install status on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetchInstallStatus();
  }, []);

  async function fetchInstallStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/v1/install/status', { cache: 'no-store' });
      const data: InstallStatusResponse = await res.json();
      setInstallInfo(data);

      // If READY, update AuthGuard cache and redirect to login
      if (data.status === 'READY') {
        markInstallReady(data.modules);
        router.replace('/login');
        return;
      }

      // Repair / upgrade — stay on step 0 but surface the information
    } catch {
      setGlobalError(t('install.page.status_load_failed'));
    } finally {
      setLoadingStatus(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  function markDone(stepIdx: number) {
    setCompletedSteps(prev => new Set([...prev, stepIdx]));
    setErrorSteps(prev => { const s = new Set(prev); s.delete(stepIdx); return s; });
  }

  function markError(stepIdx: number) {
    setErrorSteps(prev => new Set([...prev, stepIdx]));
  }

  function goNext() {
    markDone(step);
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  }

  function installRequestHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(installSetupToken.trim() ? { 'x-install-setup-token': installSetupToken.trim() } : {}),
    };
  }

  function goBack() {
    setStep(s => Math.max(s - 1, 0));
  }

  function stepStatus(idx: number): 'pending' | 'active' | 'done' | 'error' {
    if (errorSteps.has(idx))     return 'error';
    if (idx === step)            return 'active';
    if (completedSteps.has(idx)) return 'done';
    return 'pending';
  }

  // ---------------------------------------------------------------------------
  // CSV helpers (client-side, no backend call for preview)
  // ---------------------------------------------------------------------------

  function parseCsvLine(line: string, delim: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = false;
        } else { current += ch; }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        result.push(current); current = '';
      } else { current += ch; }
    }
    result.push(current);
    return result;
  }

  function parseCsvPreview(text: string): ImportPreview {
    const normalized = text.replace(/^\uFEFF/, '');
    const lines = normalized.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      return {
        row_count: 0,
        columns: [],
        required_present: [],
        required_missing: [],
        warnings: [],
        sample: [],
        fatal_error: t('install.page.preview.csv_requires_data_row'),
      };
    }
    const delim = lines[0].split(';').length >= lines[0].split(',').length ? ';' : ',';
    const columns = parseCsvLine(lines[0], delim).map(c => c.trim()).filter(Boolean);
    const dataLines = lines.slice(1);
    const row_count = dataLines.length;
    const REQUIRED = ['service_id', 'title'];
    const colsLower = columns.map(c => c.toLowerCase());
    const required_present = REQUIRED.filter(r => colsLower.includes(r));
    const required_missing = REQUIRED.filter(r => !colsLower.includes(r));
    const warnings: string[] = [];
    if (required_missing.length > 0) {
      warnings.push(t('install.page.preview.missing_recommended_columns', { columns: required_missing.join(', ') }));
    }
    if (!colsLower.includes('service_type_code') && !colsLower.includes('service_type')) {
      warnings.push(t('install.page.preview.service_type_missing'));
    }
    const sample = dataLines.slice(0, 3).map(line => {
      const values = parseCsvLine(line, delim);
      const row: Record<string, string> = {};
      columns.forEach((col, i) => { row[col] = values[i] ?? ''; });
      return row;
    });
    return { row_count, columns, required_present, required_missing, warnings, sample, fatal_error: null };
  }

  function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }

  // ---------------------------------------------------------------------------
  // Step actions
  // ---------------------------------------------------------------------------

  // Statuses where a reset is appropriate (stuck / failed — not READY, not NOT_INSTALLED)
  const STUCK_STATUSES: InstallStatus[] = [
    'INSTALL_FAILED',
    'INSTALL_IN_PROGRESS',
    'CORE_INSTALLED',
    'MODULES_CONFIGURED',
    'DATA_IMPORT_IN_PROGRESS',
  ];

  async function handleResetInstall() {
    if (!confirm(t('install.page.reset_confirm'))) return;
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch('/api/v1/install/reset', {
        method: 'POST',
        headers: installRequestHeaders(),
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || t('install.page.reset_failed'));
        return;
      }
      // Re-fetch status — should now be NOT_INSTALLED
      await fetchInstallStatus();
    } catch {
      setResetError(t('install.page.reset_error'));
    } finally {
      setResetting(false);
    }
  }

  async function startInstall() {
    try {
      const res = await fetch('/api/v1/install/start', {
        method: 'POST',
        headers: installRequestHeaders(),
        body: JSON.stringify({ performed_by: 'wizard' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setInstallLockedError(false);
          setGlobalError(t('install.page.start_rate_limit'));
        } else if (res.status === 409) {
          setInstallLockedError(true);
          setGlobalError(t('install.page.start_locked'));
        } else {
          setInstallLockedError(false);
          setGlobalError(d.error || t('install.page.start_failed'));
        }
        return false;
      }
      setInstallLockedError(false);
      setGlobalError(null);
      return true;
    } catch (err) {
      setInstallLockedError(false);
      setGlobalError(t('install.page.start_error'));
      return false;
    }
  }

  async function handleWelcomeNext() {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const ok = await startInstall();
      if (ok) goNext();
    } finally {
      setIsStarting(false);
    }
  }

  async function handleConfigSave() {
    setConfigSaving(true);
    setConfigError(null);
    try {
      const res = await fetch('/api/v1/install/config', {
        method: 'POST',
        headers: installRequestHeaders(),
        body: JSON.stringify(sysConfig),
      });
      const data = await res.json();
      if (!res.ok) { setConfigError(data.error || t('install.page.config_save_failed')); return; }
      setConfigSaved(true);
      markDone(1);
      goNext();
    } catch {
      setConfigError(t('install.page.config_load_failed'));
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleUploadNext() {
    if (uploadedFiles.length > 0) {
      setPreviewLoading(true);
      try {
        const previews: FilePreview[] = await Promise.all(
          uploadedFiles.map(async (file) => {
            try {
              const content = await readFileAsText(file);
              const preview = parseCsvPreview(content);
              return { file, preview, content };
            } catch {
              return {
                file,
                content: '',
                preview: { row_count: 0, columns: [], required_present: [], required_missing: [], warnings: [], sample: [], fatal_error: t('install.page.upload.file_load_failed') },
              };
            }
          })
        );
        setFilePreviews(previews);
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setFilePreviews([]);
    }
    goNext();
  }

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const arr = Array.from(newFiles).filter(f =>
      f.name.endsWith('.csv') || f.name.endsWith('.json') || f.name.endsWith('.xlsx')
    );
    setUploadedFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...arr.filter(f => !existing.has(f.name))];
    });
  }

  function removeFile(name: string) {
    setUploadedFiles(prev => prev.filter(f => f.name !== name));
  }

  async function handleConnectivityCheck() {
    setCheckingConn(true);
    setConnectivity(null);
    try {
      const res = await fetch('/api/v1/install/check-db', {
        method: 'POST',
        headers: installRequestHeaders(),
      });
      const data = await res.json();
      setConnectivity(data.checks);
      if (data.ok) {
        markDone(4);
      } else {
        markError(4);
      }
    } catch {
      setConnectivity({
        db_reachable: false,
        db_write_access: false,
        platform_schema: false,
        errors: [t('install.page.connectivity.middleware_unavailable')],
      });
      markError(4);
    } finally {
      setCheckingConn(false);
    }
  }

  function validateAdminForm(): boolean {
    const errors: Partial<Record<string, string>> = {};
    if (!adminForm.username.trim()) errors.username = t('install.page.admin.validation.required');
    if (!adminForm.displayName.trim()) errors.displayName = t('install.page.admin.validation.required');
    if (!adminForm.email.trim() || !adminForm.email.includes('@')) errors.email = t('install.page.admin.validation.invalid_email');
    if (adminForm.password.length < 10) errors.password = t('install.page.admin.validation.password_min');
    if (adminForm.password && !/[A-Z]/.test(adminForm.password)) errors.password = t('install.page.admin.validation.password_complexity');
    if (adminForm.password && !/[a-z]/.test(adminForm.password)) errors.password = t('install.page.admin.validation.password_complexity');
    if (adminForm.password && !/[0-9]/.test(adminForm.password)) errors.password = t('install.page.admin.validation.password_complexity');
    if (adminForm.password && !/[^A-Za-z0-9]/.test(adminForm.password)) errors.password = t('install.page.admin.validation.password_complexity');
    if (adminForm.password !== adminForm.confirmPassword) errors.confirmPassword = t('install.page.admin.validation.password_mismatch');
    setAdminErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleAdminBootstrap() {
    if (!validateAdminForm()) return;
    try {
      const res = await fetch('/api/v1/install/bootstrap-admin', {
        method: 'POST',
        headers: installRequestHeaders(),
        body: JSON.stringify({
          username: adminForm.username,
          displayName: adminForm.displayName,
          email: adminForm.email,
          password: adminForm.password,
          mustChangePassword: adminForm.mustChangePassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminErrors({ general: data.error || t('install.page.admin.create_failed') });
        markError(3);
        return;
      }
      markDone(3);
      goNext();
    } catch {
      setAdminErrors({ general: t('install.page.admin.create_error') });
      markError(3);
    }
  }

  async function handleExecute() {
    setExecuting(true);
    setExecuteProgress(0);
    setExecuteError(null);
    setExecuteLog([]);

    const logMsg = (msg: string) => setExecuteLog(prev => [...prev, msg]);

    try {
      logMsg(t('install.page.execute.log.start'));
      setExecuteProgress(10);

      logMsg(t('install.page.execute.log.activate_core'));
      setExecuteProgress(30);

      if (activateC3) {
        logMsg(t('install.page.execute.log.activate_c3'));
        setExecuteProgress(50);
      }

      if (seedDemoData) {
        logMsg(t('install.page.execute.log.prepare_demo_data'));
      }

      logMsg(t('install.page.execute.log.write_metadata'));
      setExecuteProgress(70);

      const res = await fetch('/api/v1/install/execute', {
        method: 'POST',
        headers: installRequestHeaders(),
        body: JSON.stringify({
          activate_c3: activateC3,
          seed_demo: seedDemoData,
          performed_by: adminForm.username || 'wizard',
        }),
      });

      const data = await res.json();
      setExecuteProgress(90);

      if (!res.ok || !data.ok) {
        setExecuteError(data.error || t('install.page.execute.failed'));
        markError(9);
        setExecuting(false);
        return;
      }

      // Run import for each uploaded file sequentially
      const validPreviews = filePreviews.filter(fp => !fp.preview.fatal_error && fp.preview.row_count > 0);
      if (validPreviews.length > 0) {
        if (!adminForm.username.trim() || !adminForm.password) {
          logMsg(t('install.page.execute.log.import_skipped_missing_credentials'));
        } else {
          logMsg(t('install.page.execute.log.import_login'));
          setExecuteProgress(75);
          try {
            const loginRes = await fetch('/api/v1/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: adminForm.username, password: adminForm.password }),
            });
            const loginData = await loginRes.json();
            if (loginRes.ok && loginData.access_token) {
              const results: ImportResult[] = [];
              for (let i = 0; i < validPreviews.length; i++) {
                const fp = validPreviews[i];
                logMsg(t('install.page.execute.log.import_file', { index: i + 1, total: validPreviews.length, name: fp.file.name, rows: fp.preview.row_count }));
                setExecuteProgress(75 + Math.round((i / validPreviews.length) * 18));
                try {
                  const importRes = await fetch('/api/v1/import/services/csv', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'text/csv; charset=utf-8',
                      'Authorization': `Bearer ${loginData.access_token}`,
                    },
                    body: fp.content,
                  });
                  const importData = await importRes.json();
                  if (importRes.ok) {
                    const ir: ImportResult = {
                      ok: true,
                      filename: fp.file.name,
                      batchId: importData.batchId,
                      inserted: importData.inserted ?? 0,
                      updated: importData.updated ?? 0,
                      failed: importData.failed ?? 0,
                      status: (importData.failed ?? 0) === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS',
                    };
                    results.push(ir);
                    logMsg(`  ✅ ${fp.file.name} — ${ir.inserted} nových, ${ir.updated} aktualizovaných, ${ir.failed} chyb`);
                  } else {
                    results.push({ ok: false, filename: fp.file.name, error: importData.error || t('install.page.execute.import_failed_short'), status: 'FAILED' });
                    logMsg(t('install.page.execute.log.import_failed', { name: fp.file.name, error: importData.error || t('install.page.execute.import_failed_short') }));
                  }
                } catch {
                  results.push({ ok: false, filename: fp.file.name, error: t('install.page.execute.import_network_error_short'), status: 'FAILED' });
                  logMsg(t('install.page.execute.log.import_network_error', { name: fp.file.name }));
                }
              }
              setImportResults(results);
            } else {
              logMsg(t('install.page.execute.log.import_login_failed'));
            }
          } catch {
            logMsg(t('install.page.execute.log.import_failed_generic'));
          }
        }
      }

      logMsg(t('install.page.execute.log.loading_report'));
      setExecuteProgress(95);
      let readyModules: ModuleInfo[] = [];
      if (data.summary) {
        setSummary(data.summary);
        readyModules = Array.isArray(data.summary.modules) ? data.summary.modules : [];
      } else {
        const summaryRes = await fetch('/api/v1/install/summary');
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
        readyModules = Array.isArray(summaryData.modules) ? summaryData.modules : [];
      }
      setExecuteProgress(100);

      logMsg(t('install.page.execute.log.completed'));
      markDone(9);

      // Set AuthGuard cache to READY immediately — prevents redirect loop
      markInstallReady(readyModules);

      setTimeout(() => goNext(), 800);
    } catch (err) {
      setExecuteError(t('install.page.execute.unexpected_error'));
      markError(9);
    } finally {
      setExecuting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderModeBadge() {
    const mode = installInfo?.mode;
    if (!mode || mode === 'ready') return null;
    const labels: Record<string, string> = {
      fresh: `🆕 ${t('install.mode.fresh')}`,
      repair: `🔧 ${t('install.mode.repair')}`,
      upgrade: `⬆️ ${t('install.mode.upgrade')}`,
    };
    return (
      <div className={`${styles.modeBadge} ${styles[mode]}`}>
        {labels[mode] || mode}
      </div>
    );
  }

  function renderConnCheck(label: string, ok: boolean | undefined, detail?: string) {
    const cls = ok === undefined ? 'pending' : ok ? 'ok' : 'fail';
    const icon = ok === undefined ? '○' : ok ? '✓' : '✗';
    return (
      <div className={`${styles.checkItem} ${styles[cls]}`} key={label}>
        <span className={styles.checkIcon}>{icon}</span>
        <span className={styles.checkLabel}>{label}</span>
        {detail && <span className={styles.checkDetail}>{detail}</span>}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Step renderers
  // ---------------------------------------------------------------------------

  function renderStep0_Welcome() {
    return (
      <>
        <h1 className={styles.panelTitle}>{t('install.page.welcome_title')}</h1>
        <p className={styles.panelSubtitle}>{t('install.page.welcome_subtitle')}</p>

        {renderModeBadge()}

        {installInfo && (
          <div className={styles.checkList}>
            {renderConnCheck(t('install.page.app_status'), true, `v${installInfo.app_version}`)}
            {renderConnCheck(t('install.page.schema_version'), true, installInfo.schema_version)}
            {renderConnCheck(t('install.page.db_status'), installInfo.status !== 'NOT_INSTALLED' ? true : undefined,
              installInfo.status)}
            {installInfo.db_error && (
              <Alert type="warning">{installInfo.db_error}</Alert>
            )}
          </div>
        )}

        {installInfo?.mode === 'repair' && (
          <Alert type="warning">
            {t('install.page.repair_mode_alert')}
          </Alert>
        )}

        {installInfo?.mode === 'upgrade' && (
          <Alert type="info">
            {t('install.page.upgrade_mode_alert')}
          </Alert>
        )}

        <div className={styles.fieldGroup}>
          <div className={styles.field}>
            <label className={styles.label}>{t('install.page.setup_token_label')}</label>
            <input
              className={styles.input}
              type="password"
              value={installSetupToken}
              onChange={e => setInstallSetupToken(e.target.value)}
              autoComplete="off"
              placeholder={t('install.page.setup_token_placeholder')}
            />
            <span className={styles.fieldHint}>
              {t('install.page.setup_token_hint')}
            </span>
          </div>
        </div>

        {/* Reset section — shown for stuck/failed states OR when lock error occurred */}
        {installInfo && (STUCK_STATUSES.includes(installInfo.status) || installInfo.install_locked || installLockedError) && (
          <div className={styles.resetSection}>
            <div className={styles.resetTitle}>{t('install.page.reset_title')}</div>
            <p className={styles.resetDesc}>{t('install.page.reset_description')}</p>
            {resetError && <Alert type="error">{resetError}</Alert>}
            <button
              className={styles.btnDanger}
              onClick={handleResetInstall}
              disabled={resetting}
            >
              {resetting ? <Spinner /> : null}
              {resetting ? t('common.loading') : t('install.page.reset_button')}
            </button>
          </div>
        )}

        <div className={styles.actions}>
          <div />
          <button className={styles.btnPrimary} onClick={handleWelcomeNext} disabled={loadingStatus || isStarting}>
            {(loadingStatus || isStarting) ? <Spinner /> : null}
            {isStarting ? t('common.loading') : t('install.page.start_button')}
          </button>
        </div>
      </>
    );
  }

  function renderStep1_Config() {
    return (
      <>
        <h1 className={styles.panelTitle}>{t('install.page.config_title')}</h1>
        <p className={styles.panelSubtitle}>{t('install.page.config_subtitle')}</p>

        {configError && <Alert type="error">{configError}</Alert>}
        {configSaved && <Alert type="success">{t('install.page.config_saved')}</Alert>}

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>{t('install.page.config.application_name')}</label>
              <input
                className={styles.input}
                value={sysConfig.app_name}
                onChange={e => setSysConfig(c => ({ ...c, app_name: e.target.value }))}
                placeholder={t('install.page.config.application_name_placeholder')}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{t('install.page.config.base_url')}</label>
              <input
                className={styles.input}
                value={sysConfig.base_url}
                onChange={e => setSysConfig(c => ({ ...c, base_url: e.target.value }))}
                placeholder={t('install.page.config.base_url_placeholder')}
              />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>{t('install.page.config.timezone')}</label>
              <input
                className={styles.input}
                value={sysConfig.timezone}
                onChange={e => setSysConfig(c => ({ ...c, timezone: e.target.value }))}
                placeholder={t('install.page.config.timezone_placeholder')}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{t('install.page.config.storage_path')}</label>
              <input
                className={styles.input}
                value={sysConfig.storage_path}
                onChange={e => setSysConfig(c => ({ ...c, storage_path: e.target.value }))}
                placeholder={t('install.page.config.storage_path_placeholder')}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sysConfig.https_mode}
                onChange={e => setSysConfig(c => ({ ...c, https_mode: e.target.checked }))}
              />
              <span className={styles.label}>{t('install.page.config.https_mode')}</span>
            </label>
          </div>
        </div>

        <div className={styles.checkList}>
          {renderConnCheck(t('install.page.config.database_env_label'), true, t('install.page.config.env_set'))}
          {renderConnCheck(t('install.page.config.jwt_secret_label'), true, t('install.page.config.env_secret_set'))}
          {renderConnCheck(t('install.page.config.app_version_label'), true, installInfo?.app_version ?? t('install.page.config.app_version_fallback'))}
        </div>

        <div className={styles.securityNote}>
          {t('install.page.config.secrets_note')}
        </div>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>{t('common.back')}</button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className={styles.btnSecondary} onClick={goNext}>{t('common.skip')}</button>
            <button className={styles.btnPrimary} onClick={handleConfigSave} disabled={configSaving}>
              {configSaving ? <><Spinner /> {t('common.loading')}</> : t('common.save')}
            </button>
          </div>
        </div>
      </>
    );
  }

  function renderStep2_Secrets() {
    return (
      <>
        <h1 className={styles.panelTitle}>{t('install.page.secrets_title')}</h1>
        <p className={styles.panelSubtitle}>{t('install.page.secrets_subtitle')}</p>

        <Alert type="info">
          {t('install.page.secrets.note')}
        </Alert>

        <div className={styles.checkList}>
          {renderConnCheck(t('install.page.secrets.jwt_present'), true, t('install.page.secrets.validated_on_startup'))}
          {renderConnCheck(t('install.page.secrets.db_credentials_present'), true, t('install.page.secrets.validated_on_startup'))}
          {renderConnCheck(t('install.page.secrets.outside_source_code'), true, t('install.page.secrets.compose_env_or_secret_mount'))}
          {renderConnCheck(t('install.page.secrets.plaintext_in_logs'), true, t('install.page.secrets.no_secrets_in_logs'))}
        </div>

        <div className={styles.securityNote}>
          {t('install.page.secrets.passwords_note')}
        </div>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>{t('common.back')}</button>
          <button className={styles.btnPrimary} onClick={goNext}>{t('common.continue')} →</button>
        </div>
      </>
    );
  }

  function renderStep3_Admin() {
    return (
      <>
        <h1 className={styles.panelTitle}>{t('install.page.admin_title')}</h1>
        <p className={styles.panelSubtitle}>
          {t('install.page.admin_subtitle')}
        </p>

        {installInfo?.admin_exists && (
          <Alert type="warning">
            {t('install.page.admin_exists_warning')}
          </Alert>
        )}

        {adminErrors.general && <Alert type="error">{adminErrors.general}</Alert>}

        <div className={styles.securityNote}>
          {t('install.page.admin.password_policy')}
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>
                {t('install.page.admin.username')} <span className={styles.required}>*</span>
              </label>
              <input
                className={`${styles.input} ${adminErrors.username ? styles.error : ''}`}
                value={adminForm.username}
                onChange={e => setAdminForm(f => ({ ...f, username: e.target.value }))}
                autoComplete="off"
                placeholder={t('install.page.admin.username_placeholder')}
              />
              {adminErrors.username && <span className={styles.fieldError}>{adminErrors.username}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                {t('install.page.admin.display_name')} <span className={styles.required}>*</span>
              </label>
              <input
                className={`${styles.input} ${adminErrors.displayName ? styles.error : ''}`}
                value={adminForm.displayName}
                onChange={e => setAdminForm(f => ({ ...f, displayName: e.target.value }))}
                placeholder={t('install.page.admin.display_name_placeholder')}
              />
              {adminErrors.displayName && <span className={styles.fieldError}>{adminErrors.displayName}</span>}
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              {t('install.page.admin.email')} <span className={styles.required}>*</span>
            </label>
            <input
              className={`${styles.input} ${adminErrors.email ? styles.error : ''}`}
              type="email"
              value={adminForm.email}
              onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))}
              placeholder={t('install.page.admin.email_placeholder')}
            />
            {adminErrors.email && <span className={styles.fieldError}>{adminErrors.email}</span>}
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>
                {t('install.page.admin.password')} <span className={styles.required}>*</span>
              </label>
              <input
                className={`${styles.input} ${adminErrors.password ? styles.error : ''}`}
                type="password"
                value={adminForm.password}
                onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
              />
              {adminErrors.password && <span className={styles.fieldError}>{adminErrors.password}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                {t('install.page.admin.confirm_password')} <span className={styles.required}>*</span>
              </label>
              <input
                className={`${styles.input} ${adminErrors.confirmPassword ? styles.error : ''}`}
                type="password"
                value={adminForm.confirmPassword}
                onChange={e => setAdminForm(f => ({ ...f, confirmPassword: e.target.value }))}
                autoComplete="new-password"
              />
              {adminErrors.confirmPassword && <span className={styles.fieldError}>{adminErrors.confirmPassword}</span>}
            </div>
          </div>
          <div className={styles.field}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={adminForm.mustChangePassword}
                onChange={e => setAdminForm(f => ({ ...f, mustChangePassword: e.target.checked }))}
              />
              <span className={styles.label}>{t('install.page.admin.require_password_change')}</span>
            </label>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>{t('common.back')}</button>
          <button className={styles.btnPrimary} onClick={handleAdminBootstrap}>
            {t('install.page.admin.create_account')} →
          </button>
        </div>
      </>
    );
  }

  function renderStep4_Connectivity() {
    const allOk = connectivity &&
      connectivity.db_reachable &&
      connectivity.db_write_access &&
      connectivity.platform_schema;

    return (
      <>
        <h1 className={styles.panelTitle}>{t('install.page.connectivity.title')}</h1>
        <p className={styles.panelSubtitle}>
          {t('install.page.connectivity.subtitle')}
        </p>

        <div className={styles.checkList}>
          {renderConnCheck(t('install.page.connectivity.db_reachable'), connectivity?.db_reachable,
            connectivity?.db_reachable ? t('install.page.connectivity.db_reachable_ok') : (connectivity?.errors?.[0] ?? t('install.page.connectivity.db_reachable_fail')))}
          {renderConnCheck(t('install.page.connectivity.write_access'), connectivity?.db_write_access,
            connectivity?.db_write_access ? t('install.page.connectivity.write_access_ok') : t('install.page.connectivity.write_access_fail'))}
          {renderConnCheck(t('install.page.connectivity.platform_schema'), connectivity?.platform_schema,
            connectivity?.platform_schema ? t('install.page.connectivity.platform_schema_ok') : t('install.page.connectivity.platform_schema_fail'))}
        </div>

        {connectivity?.errors && connectivity.errors.length > 0 && (
          <Alert type="error">
            {connectivity.errors.join(' | ')}
          </Alert>
        )}

        {!connectivity && !checkingConn && (
          <Alert type="info">{t('install.page.connectivity.run_check_hint')}</Alert>
        )}

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>{t('common.back')}</button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className={styles.btnSecondary}
              onClick={handleConnectivityCheck}
              disabled={checkingConn}
            >
              {checkingConn ? <><Spinner dark /> {t('common.running')}</> : t('install.page.connectivity.run_check')}
            </button>
            <button
              className={styles.btnPrimary}
              onClick={goNext}
              disabled={!allOk}
            >
              {t('common.continue')} →
            </button>
          </div>
        </div>
      </>
    );
  }

  function renderStep5_Modules() {
    return (
      <>
        <h1 className={styles.panelTitle}>{t('install.page.modules.title')}</h1>
        <p className={styles.panelSubtitle}>
          {t('install.page.modules.subtitle')}
        </p>

        <div className={styles.moduleGrid}>
          <div className={`${styles.moduleCard} ${styles.mandatory}`}>
            <div className={styles.moduleToggle}>
              <input type="checkbox" checked disabled />
            </div>
            <div className={styles.moduleInfo}>
              <div className={styles.moduleTitle}>
                {t('install.page.modules.service_catalogue_core')}
                <span className={styles.moduleMandatoryBadge}>{t('common.mandatory')}</span>
              </div>
              <div className={styles.moduleDesc}>
                {t('install.page.modules.core_desc')}
              </div>
            </div>
          </div>

          <div
            className={`${styles.moduleCard} ${activateC3 ? styles.selected : ''}`}
            onClick={() => setActivateC3(v => !v)}
            style={{ cursor: 'pointer' }}
          >
            <div className={styles.moduleToggle}>
              <input
                type="checkbox"
                checked={activateC3}
                onChange={e => setActivateC3(e.target.checked)}
              />
            </div>
            <div className={styles.moduleInfo}>
              <div className={styles.moduleTitle}>{t('install.page.modules.c3_taxonomy')}</div>
              <div className={styles.moduleDesc}>
                {t('install.page.modules.c3_desc')}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>{t('common.back')}</button>
          <button className={styles.btnPrimary} onClick={goNext}>{t('common.continue')} →</button>
        </div>
      </>
    );
  }

  function renderStep6_DataPlan() {
    return (
      <>
        <h1 className={styles.panelTitle}>{t('install.page.data_plan.title')}</h1>
        <p className={styles.panelSubtitle}>{t('install.page.data_plan.subtitle')}</p>

        <div className={styles.packageList}>
          <div className={`${styles.packageItem} ${styles.mandatory}`}>
            <span className={styles.packageIcon}>🗄️</span>
            <span className={styles.packageTitle}>{t('install.page.data_plan.core_installation')}</span>
            <span className={`${styles.packageBadge} ${styles.mandatory}`}>{t('common.mandatory')}</span>
          </div>
          <div className={styles.packageItem} style={{ paddingLeft: 48, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {t('install.page.data_plan.core_installation_desc')}
          </div>

          <div className={`${styles.packageItem} ${styles.mandatory}`}>
            <span className={styles.packageIcon}>📋</span>
            <span className={styles.packageTitle}>{t('install.page.data_plan.reference_seed_sc')}</span>
            <span className={`${styles.packageBadge} ${styles.mandatory}`}>{t('common.mandatory')}</span>
          </div>
          <div className={styles.packageItem} style={{ paddingLeft: 48, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {t('install.page.data_plan.reference_seed_sc_desc')}
          </div>

          {activateC3 && (
            <>
              <div className={`${styles.packageItem} ${styles.mandatory}`}>
                <span className={styles.packageIcon}>🧩</span>
                <span className={styles.packageTitle}>{t('install.page.data_plan.reference_seed_c3')}</span>
                <span className={`${styles.packageBadge} ${styles.mandatory}`}>{t('install.page.data_plan.mandatory_c3')}</span>
              </div>
            </>
          )}

          <div className={`${styles.packageItem} ${styles.optional}`}>
            <span className={styles.packageIcon}>📦</span>
            <span className={styles.packageTitle}>{t('install.page.data_plan.business_data_sc')}</span>
            <span className={`${styles.packageBadge} ${styles.optional}`}>{t('common.optional')}</span>
          </div>
          <div className={styles.packageItem} style={{ paddingLeft: 48, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {t('install.page.data_plan.business_data_import_hint')}
          </div>

          {/* Demo data block */}
          <div
            className={`${styles.packageItem} ${seedDemoData ? styles.selected : ''}`}
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setSeedDemoData(v => !v)}
          >
            <input
              type="checkbox"
              checked={seedDemoData}
              onChange={e => setSeedDemoData(e.target.checked)}
              style={{ marginRight: 10, width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
              onClick={e => e.stopPropagation()}
            />
            <span className={styles.packageIcon}>🧪</span>
            <span className={styles.packageTitle}>{t('install.page.data_plan.demo_data')}</span>
            <span className={`${styles.packageBadge} ${styles.optional}`}>{t('common.recommended')}</span>
          </div>
          <div className={styles.packageItem} style={{ paddingLeft: 48, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {t('install.page.data_plan.demo_data_description')}
          </div>
        </div>

        <Alert type="info">
          {t('install.page.data_plan.core_reference_note')}
          {seedDemoData && <><br /><strong>{t('install.page.data_plan.demo_data_note')}</strong></>}
        </Alert>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>{t('common.back')}</button>
          <button className={styles.btnPrimary} onClick={goNext}>{t('common.continue')} →</button>
        </div>
      </>
    );
  }

  function renderStep7_Upload() {
    const totalRows = uploadedFiles.reduce((s, f) => s + f.size, 0);
    return (
      <>
        <h1 className={styles.panelTitle}>{t('install.page.upload.title')}</h1>
        <p className={styles.panelSubtitle}>{t('install.page.upload.subtitle')}</p>

        {/* Drop zone — always visible, allows adding more files */}
        <div
          className={styles.uploadZone}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-action-primary)'; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = ''; }}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = ''; addFiles(e.dataTransfer.files); }}
          style={{ marginBottom: uploadedFiles.length > 0 ? 'var(--space-3)' : undefined }}
        >
          <div className={styles.uploadIcon}>📤</div>
          <div className={styles.uploadTitle}>
            {uploadedFiles.length > 0 ? t('install.page.upload.add_more_files') : t('install.page.upload.drop_files')}
          </div>
          <div className={styles.uploadHint}>{t('install.page.upload.hint')}</div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.json"
          multiple
          style={{ display: 'none' }}
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
        />

        {/* List of uploaded files */}
        {uploadedFiles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            {uploadedFiles.map((f, i) => (
              <div key={f.name} className={styles.uploadedFile} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12, minWidth: 20 }}>{i + 1}.</span>
                <span style={{ fontSize: 13 }}>
                  {f.name.endsWith('.csv') ? '📋' : f.name.endsWith('.json') ? '📦' : '📊'}
                </span>
                <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}>{f.name}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                  {(f.size / 1024).toFixed(1)} KB
                </span>
                <button
                  onClick={() => removeFile(f.name)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 14, lineHeight: 1, padding: '0 4px' }}
                  title={t('common.remove')}
                >
                  ✕
                </button>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', paddingLeft: 4 }}>
              {t('install.page.upload.files_total', { count: uploadedFiles.length, size: (totalRows / 1024).toFixed(1) })}
            </div>
          </div>
        )}

        <Alert type="warning">
          {t('install.page.upload.import_batch_note')}
        </Alert>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>{t('common.back')}</button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className={styles.btnSecondary} onClick={handleUploadNext}>
              {uploadedFiles.length > 0 ? t('install.page.upload.skip_import') : t('install.page.upload.skip_arrow')}
            </button>
            {uploadedFiles.length > 0 && (
              <button className={styles.btnPrimary} onClick={handleUploadNext} disabled={previewLoading}>
                {previewLoading
                  ? <><Spinner /> {t('common.loading')}</>
                  : uploadedFiles.length === 1
                    ? t('install.page.upload.continue_one', { count: uploadedFiles.length })
                    : uploadedFiles.length < 5
                      ? t('install.page.upload.continue_few', { count: uploadedFiles.length })
                      : t('install.page.upload.continue_many', { count: uploadedFiles.length })}
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  function renderFilePreviewCard(fp: FilePreview, index: number) {
    const { file, preview } = fp;
    const hasFatal = preview.fatal_error != null;
    return (
      <div key={file.name} style={{
        border: `1px solid ${hasFatal ? 'color-mix(in srgb, var(--color-danger) 40%, var(--color-border-default))' : 'var(--color-border-default)'}`,
        borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-3)',
        background: hasFatal ? 'color-mix(in srgb, var(--color-danger) 4%, var(--color-bg-surface))' : 'var(--color-bg-surface)',
      }}>
        {/* File header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{index + 1}.</span>
          <span style={{ fontFamily: 'monospace', fontSize: 13, flex: 1 }}>{file.name}</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</span>
          {hasFatal
            ? <span style={{ fontSize: 11, color: 'var(--color-danger)', fontWeight: 600 }}>✗ {t('install.page.preview.file_error')}</span>
            : <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>✓ {t('install.page.preview.file_rows', { count: preview.row_count })}</span>}
        </div>

        {hasFatal && (
          <div style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 8 }}>
            ⚠ {preview.fatal_error}
          </div>
        )}

        {!hasFatal && (
          <>
            {/* Column chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: preview.warnings.length > 0 ? 8 : 0 }}>
              {preview.columns.slice(0, 10).map(col => (
                <span key={col} style={{
                  padding: '1px 7px', borderRadius: 'var(--radius-pill)', fontSize: 10,
                  background: 'var(--color-bg-surface-raised)', border: '1px solid var(--color-border-default)',
                  color: preview.required_present.includes(col) ? 'var(--color-success)' : 'var(--color-text-muted)',
                }}>
                  {col}
                </span>
              ))}
              {preview.columns.length > 10 && (
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', padding: '1px 4px' }}>
                  {t('install.page.preview.more_columns', { count: preview.columns.length - 10 })}
                </span>
              )}
            </div>
            {/* Warnings */}
            {preview.warnings.map((w, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 4 }}>⚠ {w}</div>
            ))}
          </>
        )}
      </div>
    );
  }

  function renderStep8_Preview() {
    const totalRows = filePreviews.reduce((s, fp) => s + fp.preview.row_count, 0);
    const fatalCount = filePreviews.filter(fp => fp.preview.fatal_error).length;
    const validCount = filePreviews.filter(fp => !fp.preview.fatal_error && fp.preview.row_count > 0).length;

    return (
      <>
        <h1 className={styles.panelTitle}>{t('install.page.preview_title')}</h1>
        <p className={styles.panelSubtitle}>
          {filePreviews.length > 0
            ? filePreviews.length === 1
              ? t('install.page.preview.analysis_one', { count: filePreviews.length })
              : t('install.page.preview.analysis_many', { count: filePreviews.length })
            : t('install.page.preview.no_files')}
        </p>

        {filePreviews.length === 0 ? (
          <Alert type="info">
            {t('install.page.preview.import_skipped')}
          </Alert>
        ) : (
          <>
            {/* Aggregate summary */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
              {[
                { label: t('install.page.preview.files_total'), value: filePreviews.length, color: 'var(--color-text-primary)' },
                { label: t('install.page.preview.rows_to_import'), value: totalRows, color: 'var(--color-action-primary)' },
                { label: t('install.page.preview.ready'), value: validCount, color: 'var(--color-success)' },
                ...(fatalCount > 0 ? [{ label: t('install.page.preview.errors'), value: fatalCount, color: 'var(--color-danger)' }] : []),
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-bg-surface-raised)', borderRadius: 'var(--radius-md)', minWidth: 80 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Per-file cards */}
            {filePreviews.map((fp, i) => renderFilePreviewCard(fp, i))}

            {validCount > 0 && (
              <Alert type="success">
                {validCount === 1
                  ? t('install.page.preview.ready_for_import_one', { count: validCount, rows: totalRows })
                  : t('install.page.preview.ready_for_import_many', { count: validCount, rows: totalRows })}
              </Alert>
            )}
            {fatalCount > 0 && (
              <Alert type="warning">
                {fatalCount === 1
                  ? t('install.page.preview.failed_one', { count: fatalCount })
                  : t('install.page.preview.failed_many', { count: fatalCount })}
              </Alert>
            )}
          </>
        )}

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>{t('common.back')}</button>
          <button className={styles.btnPrimary} onClick={goNext}>
            {validCount === 0 && filePreviews.length > 0
              ? `${t('install.page.upload.skip_import')} →`
              : `${t('common.continue')} →`}
          </button>
        </div>
      </>
    );
  }

  function renderStep9_Execute() {
    return (
      <>
        <h1 className={styles.panelTitle}>{t('install.page.execute_title')}</h1>
        <p className={styles.panelSubtitle}>
          {t('install.page.execute.subtitle')}
        </p>

        {!executing && !completedSteps.has(9) && (
          <div className={styles.checkList}>
            {renderConnCheck(t('install.page.modules.service_catalogue_core'), true, t('install.page.execute.will_be_activated'))}
            {renderConnCheck(t('install.page.modules.c3_taxonomy'), activateC3 ? undefined : true,
              activateC3 ? t('install.page.execute.will_be_activated') : t('install.page.execute.skipped'))}
            {renderConnCheck(t('install.page.execute.admin_account'), installInfo?.admin_exists || !!adminForm.username, t('install.page.execute.ready'))}
            {renderConnCheck(t('install.page.execute.release_metadata'), true, `v${installInfo?.app_version}`)}
          </div>
        )}

        {executeError && <Alert type="error">{executeError}</Alert>}

        {(executing || executeLog.length > 0) && (
          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${executeProgress}%` }} />
            </div>
            <div className={styles.progressLabel}>{executeProgress}%</div>
            <div style={{ marginTop: 12, fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
              {executeLog.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack} disabled={executing}>
            {t('common.back')}
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleExecute}
            disabled={executing || completedSteps.has(9)}
          >
            {executing ? <><Spinner /> {t('common.running')}</> : `🚀 ${t('install.page.execute.start_installation')}`}
          </button>
        </div>
      </>
    );
  }

  function renderStep10_Summary() {
    const isReady = summary && (summary as Record<string, unknown>).status === 'READY';
    const summaryModules = (summary as Record<string, unknown> | null)?.modules as Array<Record<string, unknown>> | undefined;

    return (
      <>
        <div className={styles.summaryStatus}>
          <div className={styles.summaryIcon}>{isReady ? '✅' : '❌'}</div>
          <div className={styles.summaryTitle}>
            {isReady ? t('install.page.result.complete') : t('install.page.result.failed')}
          </div>
          <div className={styles.summaryDesc}>
            {isReady ? t('install.page.result.ready_desc') : t('install.page.result.failed_desc')}
          </div>
        </div>

        {summary && (
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <div className={styles.metaLabel}>{t('install.page.result.summary_status')}</div>
              <div className={styles.metaValue}>{String((summary as Record<string, unknown>).status ?? '')}</div>
            </div>
            <div className={styles.metaItem}>
              <div className={styles.metaLabel}>{t('install.page.result.summary_version')}</div>
              <div className={styles.metaValue}>{String((summary as Record<string, unknown>).app_version ?? '')}</div>
            </div>
            <div className={styles.metaItem}>
              <div className={styles.metaLabel}>{t('install.page.result.summary_schema')}</div>
              <div className={styles.metaValue}>{String((summary as Record<string, unknown>).schema_version ?? '')}</div>
            </div>
            <div className={styles.metaItem}>
              <div className={styles.metaLabel}>{t('install.page.result.summary_active_modules')}</div>
              <div className={styles.metaValue}>
                {summaryModules
                  ? summaryModules.filter(m => m.enabled).map(m => String(m.code)).join(', ')
                  : '—'}
              </div>
            </div>
            {importResults.length > 0 && (() => {
              const totalInserted = importResults.reduce((s, r) => s + (r.inserted ?? 0), 0);
              const totalUpdated  = importResults.reduce((s, r) => s + (r.updated  ?? 0), 0);
              const totalFailed   = importResults.reduce((s, r) => s + (r.failed   ?? 0), 0);
              const allOk = importResults.every(r => r.ok);
              return (
                <>
                  <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>{t('install.page.execute.imported_files')}</div>
                    <div className={styles.metaValue}>{importResults.length}</div>
                  </div>
                  <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>{t('install.page.execute.inserted')}</div>
                    <div className={styles.metaValue}>{totalInserted}</div>
                  </div>
                  <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>{t('install.page.execute.updated')}</div>
                    <div className={styles.metaValue}>{totalUpdated}</div>
                  </div>
                  {totalFailed > 0 && (
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>{t('install.page.execute.row_errors')}</div>
                      <div className={styles.metaValue} style={{ color: 'var(--color-warning)' }}>{totalFailed}</div>
                    </div>
                  )}
                  <div className={styles.metaItem} style={{ gridColumn: '1 / -1' }}>
                    <div className={styles.metaLabel}>{t('install.page.execute.per_file_results')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      {importResults.map(r => (
                        <div key={r.filename} style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'center' }}>
                          <span style={{ color: r.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>{r.ok ? '✓' : '✗'}</span>
                          <span style={{ fontFamily: 'monospace', flex: 1 }}>{r.filename}</span>
                          {r.ok
                            ? <span style={{ color: 'var(--color-text-muted)' }}>{r.inserted ?? 0}↑ {r.updated ?? 0}↻ {r.failed ?? 0}✗</span>
                            : <span style={{ color: 'var(--color-danger)' }}>{r.error}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
            {importResults.length === 0 && uploadedFiles.length > 0 && (
              <div className={styles.metaItem}>
                <div className={styles.metaLabel}>{t('install.page.result.summary_import')}</div>
                <div className={styles.metaValue} style={{ color: 'var(--color-text-muted)' }}>{t('install.page.result.summary_import_skipped')}</div>
              </div>
            )}
          </div>
        )}

        <Alert type="warning">
          {t('install.page.result.warning')}
        </Alert>

        {isReady && (
          <div className={styles.actions}>
            <div />
            <button
              className={styles.btnPrimary}
              onClick={() => router.replace('/login')}
            >
              {t('install.page.execute.go_to_signin')}
            </button>
          </div>
        )}

        {!isReady && (
          <div className={styles.actions}>
            <div />
            <button
              className={styles.btnDanger}
              onClick={() => {
                setStep(0);
                setCompletedSteps(new Set());
                setErrorSteps(new Set());
                fetchInstallStatus();
              }}
            >
              {t('install.page.execute.start_repair_flow')}
            </button>
          </div>
        )}
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Step dispatch
  // ---------------------------------------------------------------------------

  const STEP_RENDERERS = [
    renderStep0_Welcome,
    renderStep1_Config,
    renderStep2_Secrets,
    renderStep3_Admin,
    renderStep4_Connectivity,
    renderStep5_Modules,
    renderStep6_DataPlan,
    renderStep7_Upload,
    renderStep8_Preview,
    renderStep9_Execute,
    renderStep10_Summary,
  ];

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loadingStatus) {
    return (
      <div className={styles.shell} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Spinner dark />
          <p style={{ marginTop: 16, color: 'var(--color-text-muted)', fontSize: 14 }}>
            {t('install.page.loading_status')}
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <span className={styles.headerLogo}>{t('home.title')}</span>
        <span className={styles.headerSub}>{t('install.wizard_title')} · v{installInfo?.app_version ?? '1.0.0'}</span>
      </div>

      <div className={styles.main}>
        {/* Left stepper */}
        <nav className={styles.stepper}>
          <div className={styles.stepperTitle}>{t('install.wizard_title')}</div>
          <ul className={styles.stepList}>
            {STEPS.map((s, idx) => {
              const st = stepStatus(idx);
              return (
                <li key={s.id} className={`${styles.stepItem} ${styles[st]}`}>
                  <StepDot num={idx + 1} status={st} />
                  <span className={styles.stepLabel}>{t(s.label)}</span>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Content */}
        <div className={styles.content}>
          {globalError && (
            <Alert type="error">{globalError}</Alert>
          )}
          <div className={styles.panel}>
            {STEP_RENDERERS[step]?.()}
          </div>
        </div>
      </div>
    </div>
  );
}
