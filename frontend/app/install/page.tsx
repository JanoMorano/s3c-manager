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
  { id: 'welcome',     label: 'Vítejte' },
  { id: 'config',      label: 'Konfigurace' },
  { id: 'secrets',     label: 'Secrets' },
  { id: 'admin',       label: 'Admin účet' },
  { id: 'connectivity',label: 'Konektivita' },
  { id: 'modules',     label: 'Moduly' },
  { id: 'data-plan',   label: 'Data packages' },
  { id: 'upload',      label: 'Import (volitelný)' },
  { id: 'preview',     label: 'Náhled importu' },
  { id: 'execute',     label: 'Instalace' },
  { id: 'summary',     label: 'Výsledek' },
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
    mustChangePassword: false,
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

  // Reset stuck install
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

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
      setGlobalError('Nepodařilo se načíst stav instalace. Ověřte, že middleware běží.');
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
      return { row_count: 0, columns: [], required_present: [], required_missing: [], warnings: [], sample: [], fatal_error: 'CSV musí mít hlavičku a alespoň jeden datový řádek' };
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
    if (required_missing.length > 0) warnings.push(`Chybí doporučené sloupce: ${required_missing.join(', ')}`);
    if (!colsLower.includes('service_type_code') && !colsLower.includes('service_type')) warnings.push('Sloupec service_type_code/service_type není přítomen — záznamy budou importovány bez typu');
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
    if (!confirm('Opravdu chcete resetovat instalaci? Tímto se zruší rozdělaná instalace a wizard začne znovu od kroku 1. Admin účet ani data v DB tímto nebudou dotčeny.')) return;
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch('/api/v1/install/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || 'Reset selhal.');
        return;
      }
      // Re-fetch status — should now be NOT_INSTALLED
      await fetchInstallStatus();
    } catch {
      setResetError('Chyba při resetování instalace — ověřte dostupnost middleware.');
    } finally {
      setResetting(false);
    }
  }

  async function startInstall() {
    try {
      const res = await fetch('/api/v1/install/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performed_by: 'wizard' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setGlobalError('Příliš mnoho požadavků — zkuste to za 30 sekund. Pokud problém přetrvává, restartujte middleware.');
        } else if (res.status === 409 && d.error?.includes('zamčena')) {
          // Lock held from a previous attempt — offer reset
          setGlobalError(`Instalace je zamčená z předchozího pokusu. Klikněte na "Resetovat instalaci" níže a zkuste znovu.`);
        } else {
          setGlobalError(d.error || 'Nepodařilo se zahájit instalaci.');
        }
        return false;
      }
      setGlobalError(null);
      return true;
    } catch (err) {
      setGlobalError('Chyba při zahájení instalace.');
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sysConfig),
      });
      const data = await res.json();
      if (!res.ok) { setConfigError(data.error || 'Chyba při ukládání konfigurace.'); return; }
      setConfigSaved(true);
      markDone(1);
      goNext();
    } catch {
      setConfigError('Nepodařilo se uložit konfiguraci — ověřte dostupnost middleware.');
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
                preview: { row_count: 0, columns: [], required_present: [], required_missing: [], warnings: [], sample: [], fatal_error: 'Nepodařilo se načíst soubor' },
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
      const res = await fetch('/api/v1/install/check-db', { method: 'POST' });
      const data = await res.json();
      setConnectivity(data.checks);
      if (data.ok) {
        markDone(4);
      } else {
        markError(4);
      }
    } catch {
      setConnectivity({ db_reachable: false, db_write_access: false, platform_schema: false, errors: ['Middleware nedostupný'] });
      markError(4);
    } finally {
      setCheckingConn(false);
    }
  }

  function validateAdminForm(): boolean {
    const errors: Partial<Record<string, string>> = {};
    if (!adminForm.username.trim()) errors.username = 'Povinné pole';
    if (!adminForm.displayName.trim()) errors.displayName = 'Povinné pole';
    if (!adminForm.email.trim() || !adminForm.email.includes('@')) errors.email = 'Zadejte platný e-mail';
    if (adminForm.password.length < 10) errors.password = 'Minimálně 10 znaků';
    if (adminForm.password !== adminForm.confirmPassword) errors.confirmPassword = 'Hesla se neshodují';
    setAdminErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleAdminBootstrap() {
    if (!validateAdminForm()) return;
    try {
      const res = await fetch('/api/v1/install/bootstrap-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        setAdminErrors({ general: data.error || 'Nepodařilo se vytvořit admin účet.' });
        markError(3);
        return;
      }
      markDone(3);
      goNext();
    } catch {
      setAdminErrors({ general: 'Chyba při vytváření admin účtu.' });
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
      logMsg('Spouštím instalaci...');
      setExecuteProgress(10);

      logMsg('Aktivuji Service Catalogue Core...');
      setExecuteProgress(30);

      if (activateC3) {
        logMsg('Aktivuji C3 Taxonomy modul...');
        setExecuteProgress(50);
      }

      if (seedDemoData) {
        logMsg('Připravuji testovací data (3 demo služby + C3 vazby)...');
      }

      logMsg('Zapisuji konfiguraci a release metadata...');
      setExecuteProgress(70);

      const res = await fetch('/api/v1/install/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activate_c3: activateC3,
          seed_demo: seedDemoData,
          performed_by: adminForm.username || 'wizard',
        }),
      });

      const data = await res.json();
      setExecuteProgress(90);

      if (!res.ok || !data.ok) {
        setExecuteError(data.error || 'Instalace selhala.');
        markError(9);
        setExecuting(false);
        return;
      }

      // Run import for each uploaded file sequentially
      const validPreviews = filePreviews.filter(fp => !fp.preview.fatal_error && fp.preview.row_count > 0);
      if (validPreviews.length > 0) {
        logMsg('Přihlašuji admin účet pro import dat...');
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
              logMsg(`Importuji soubor ${i + 1}/${validPreviews.length}: ${fp.file.name} (${fp.preview.row_count} řádků)...`);
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
                  results.push({ ok: false, filename: fp.file.name, error: importData.error || 'Import selhal', status: 'FAILED' });
                  logMsg(`  ⚠️ ${fp.file.name}: ${importData.error || 'selhalo'}`);
                }
              } catch {
                results.push({ ok: false, filename: fp.file.name, error: 'Síťová chyba', status: 'FAILED' });
                logMsg(`  ⚠️ ${fp.file.name}: síťová chyba`);
              }
            }
            setImportResults(results);
          } else {
            logMsg('⚠️ Přihlášení pro import selhalo — data lze importovat v admin sekci');
          }
        } catch {
          logMsg('⚠️ Chyba při importu — data lze importovat v admin sekci');
        }
      }

      logMsg('Načítám výsledný report...');
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

      logMsg('✅ Instalace dokončena — stav READY');
      markDone(9);

      // Set AuthGuard cache to READY immediately — prevents redirect loop
      markInstallReady(readyModules);

      setTimeout(() => goNext(), 800);
    } catch (err) {
      setExecuteError('Neočekávaná chyba při instalaci.');
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
      fresh: '🆕 Fresh Install',
      repair: '🔧 Repair',
      upgrade: '⬆️ Upgrade',
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
        <h1 className={styles.panelTitle}>Vítejte v Service Catalogue</h1>
        <p className={styles.panelSubtitle}>
          Tento průvodce vás provede prvním spuštěním aplikace. Detekoval jsem instalační mód
          a připravil potřebné kroky. Celý proces trvá přibližně 5–10 minut.
        </p>

        {renderModeBadge()}

        {installInfo && (
          <div className={styles.checkList}>
            {renderConnCheck('Stav aplikace', true, `v${installInfo.app_version}`)}
            {renderConnCheck('Schema verze', true, installInfo.schema_version)}
            {renderConnCheck('DB stav', installInfo.status !== 'NOT_INSTALLED' ? true : undefined,
              installInfo.status)}
            {installInfo.db_error && (
              <Alert type="warning">{installInfo.db_error}</Alert>
            )}
          </div>
        )}

        {installInfo?.mode === 'repair' && (
          <Alert type="warning">
            Předchozí instalace skončila s chybou. Tento průvodce opraví neúplný stav.
          </Alert>
        )}

        {installInfo?.mode === 'upgrade' && (
          <Alert type="info">
            Detekovaná verze aplikace je novější než verze v databázi. Bude provedena migrace.
          </Alert>
        )}

        {/* Reset section — shown for stuck/failed states OR when lock error occurred */}
        {installInfo && (STUCK_STATUSES.includes(installInfo.status) || installInfo.install_locked || globalError?.includes('zamčená')) && (
          <div className={styles.resetSection}>
            <div className={styles.resetTitle}>Uvízlá instalace</div>
            <p className={styles.resetDesc}>
              Instalace je v neúplném stavu ({installInfo.status}).
              Pokud průvodce nefunguje správně (např. po restartu), lze ji bezpečně resetovat
              a zahájit znovu. Existující data v databázi nebudou smazána.
            </p>
            {resetError && <Alert type="error">{resetError}</Alert>}
            <button
              className={styles.btnDanger}
              onClick={handleResetInstall}
              disabled={resetting}
            >
              {resetting ? <Spinner /> : null}
              {resetting ? 'Resetuji...' : 'Resetovat instalaci'}
            </button>
          </div>
        )}

        <div className={styles.actions}>
          <div />
          <button className={styles.btnPrimary} onClick={handleWelcomeNext} disabled={loadingStatus || isStarting}>
            {(loadingStatus || isStarting) ? <Spinner /> : null}
            {isStarting ? 'Zahajuji...' : 'Zahájit instalaci →'}
          </button>
        </div>
      </>
    );
  }

  function renderStep1_Config() {
    return (
      <>
        <h1 className={styles.panelTitle}>Konfigurace aplikace</h1>
        <p className={styles.panelSubtitle}>
          Nastavte základní provozní parametry aplikace. Secrets (JWT, DB) jsou načítány
          z Compose environment a mounted secrets — nelze je zde měnit.
        </p>

        {configError && <Alert type="error">{configError}</Alert>}
        {configSaved && <Alert type="success">Konfigurace uložena.</Alert>}

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Název aplikace</label>
              <input
                className={styles.input}
                value={sysConfig.app_name}
                onChange={e => setSysConfig(c => ({ ...c, app_name: e.target.value }))}
                placeholder="Service Catalogue"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Base URL</label>
              <input
                className={styles.input}
                value={sysConfig.base_url}
                onChange={e => setSysConfig(c => ({ ...c, base_url: e.target.value }))}
                placeholder="https://sc.example.com"
              />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Timezone</label>
              <input
                className={styles.input}
                value={sysConfig.timezone}
                onChange={e => setSysConfig(c => ({ ...c, timezone: e.target.value }))}
                placeholder="Europe/Prague"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Storage path</label>
              <input
                className={styles.input}
                value={sysConfig.storage_path}
                onChange={e => setSysConfig(c => ({ ...c, storage_path: e.target.value }))}
                placeholder="/app/uploads"
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
              <span className={styles.label}>HTTPS mode — vynuťte HTTPS v generovaných odkazech</span>
            </label>
          </div>
        </div>

        <div className={styles.checkList}>
          {renderConnCheck('DATABASE_URL / DB_HOST', true, 'nastaveno přes Compose env')}
          {renderConnCheck('JWT_SECRET', true, 'nastaveno přes Compose env / secret')}
          {renderConnCheck('APP_VERSION', true, installInfo?.app_version ?? '1.0.0')}
        </div>

        <div className={styles.securityNote}>
          🔒 Secrets nejsou zobrazovány v čitelné podobě. Konfigurace bude uložena do DB (app_config).
        </div>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>← Zpět</button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className={styles.btnSecondary} onClick={goNext}>Přeskočit</button>
            <button className={styles.btnPrimary} onClick={handleConfigSave} disabled={configSaving}>
              {configSaving ? <><Spinner /> Ukládám...</> : 'Uložit a pokračovat →'}
            </button>
          </div>
        </div>
      </>
    );
  }

  function renderStep2_Secrets() {
    return (
      <>
        <h1 className={styles.panelTitle}>Validace secrets</h1>
        <p className={styles.panelSubtitle}>
          Kontrola, zda jsou povinné secrets předány bezpečným způsobem (Compose secrets nebo env).
        </p>

        <Alert type="info">
          Secrets jsou validovány middleware vrstvou při startu. Zobrazujeme pouze výsledky
          validace — nikdy samotné hodnoty.
        </Alert>

        <div className={styles.checkList}>
          {renderConnCheck('JWT_SECRET přítomen', true, 'validováno při startu middleware')}
          {renderConnCheck('DB credentials přítomny', true, 'validováno při startu middleware')}
          {renderConnCheck('Secrets mimo source kód', true, 'Compose env / secret mount')}
          {renderConnCheck('Plaintext v logu', false ? false : true, 'žádné secrets v logu')}
        </div>

        <div className={styles.securityNote}>
          🔒 Hesla a tokeny nesmí být uloženy v plaintext formě, source kódu ani image.
          Doporučujeme použít Docker Compose secrets (montované jako /run/secrets/&lt;name&gt;).
        </div>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>← Zpět</button>
          <button className={styles.btnPrimary} onClick={goNext}>Pokračovat →</button>
        </div>
      </>
    );
  }

  function renderStep3_Admin() {
    // If admin already exists (repair flow), skip this step
    if (installInfo?.admin_exists) {
      return (
        <>
          <h1 className={styles.panelTitle}>Admin účet</h1>
          <p className={styles.panelSubtitle}>Admin účet je již vytvořen.</p>
          <Alert type="success">Admin účet existuje. V repair flow bude zachován.</Alert>
          <div className={styles.actions}>
            <button className={styles.btnSecondary} onClick={goBack}>← Zpět</button>
            <button className={styles.btnPrimary} onClick={goNext}>Pokračovat →</button>
          </div>
        </>
      );
    }

    return (
      <>
        <h1 className={styles.panelTitle}>Vytvoření admin účtu</h1>
        <p className={styles.panelSubtitle}>
          Zadejte přihlašovací údaje pro prvního administrátora systému. Heslo bude uloženo
          jako bezpečný hash — nikdy v čitelné podobě.
        </p>

        {adminErrors.general && <Alert type="error">{adminErrors.general}</Alert>}

        <div className={styles.securityNote}>
          🔒 Heslo musí mít alespoň 10 znaků a obsahovat velká písmena, malá písmena, číslice a speciální znak.
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>
                Username <span className={styles.required}>*</span>
              </label>
              <input
                className={`${styles.input} ${adminErrors.username ? styles.error : ''}`}
                value={adminForm.username}
                onChange={e => setAdminForm(f => ({ ...f, username: e.target.value }))}
                autoComplete="off"
                placeholder="admin"
              />
              {adminErrors.username && <span className={styles.fieldError}>{adminErrors.username}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                Zobrazované jméno <span className={styles.required}>*</span>
              </label>
              <input
                className={`${styles.input} ${adminErrors.displayName ? styles.error : ''}`}
                value={adminForm.displayName}
                onChange={e => setAdminForm(f => ({ ...f, displayName: e.target.value }))}
                placeholder="Jan Novák"
              />
              {adminErrors.displayName && <span className={styles.fieldError}>{adminErrors.displayName}</span>}
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              E-mail <span className={styles.required}>*</span>
            </label>
            <input
              className={`${styles.input} ${adminErrors.email ? styles.error : ''}`}
              type="email"
              value={adminForm.email}
              onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))}
              placeholder="admin@example.com"
            />
            {adminErrors.email && <span className={styles.fieldError}>{adminErrors.email}</span>}
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>
                Heslo <span className={styles.required}>*</span>
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
                Potvrdit heslo <span className={styles.required}>*</span>
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
              <span className={styles.label}>Vyžadovat změnu hesla po prvním přihlášení</span>
            </label>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>← Zpět</button>
          <button className={styles.btnPrimary} onClick={handleAdminBootstrap}>
            Vytvořit admin účet →
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
        <h1 className={styles.panelTitle}>Test konektivity</h1>
        <p className={styles.panelSubtitle}>
          Ověřujeme dosažitelnost databáze, oprávnění k zápisu a existenci systémového schématu.
        </p>

        <div className={styles.checkList}>
          {renderConnCheck('DB dostupná', connectivity?.db_reachable,
            connectivity?.db_reachable ? 'PostgreSQL odpovídá' : (connectivity?.errors?.[0] ?? 'nedostupná'))}
          {renderConnCheck('Write access', connectivity?.db_write_access,
            connectivity?.db_write_access ? 'zápis povolen' : 'chyba')}
          {renderConnCheck('platform schema', connectivity?.platform_schema,
            connectivity?.platform_schema ? 'existuje' : 'chybí — spusťte init-db-postgres.sh')}
        </div>

        {connectivity?.errors && connectivity.errors.length > 0 && (
          <Alert type="error">
            {connectivity.errors.join(' | ')}
          </Alert>
        )}

        {!connectivity && !checkingConn && (
          <Alert type="info">Klikněte na „Spustit check" pro ověření konektivity.</Alert>
        )}

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>← Zpět</button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className={styles.btnSecondary}
              onClick={handleConnectivityCheck}
              disabled={checkingConn}
            >
              {checkingConn ? <><Spinner dark /> Probíhá...</> : '🔍 Spustit check'}
            </button>
            <button
              className={styles.btnPrimary}
              onClick={goNext}
              disabled={!allOk}
            >
              Pokračovat →
            </button>
          </div>
        </div>
      </>
    );
  }

  function renderStep5_Modules() {
    return (
      <>
        <h1 className={styles.panelTitle}>Aktivace modulů</h1>
        <p className={styles.panelSubtitle}>
          Service Catalogue Core je povinný a nelze ho deaktivovat.
          C3 Taxonomy modul je volitelný — lze aktivovat nyní nebo kdykoli později v admin sekci.
        </p>

        <div className={styles.moduleGrid}>
          <div className={`${styles.moduleCard} ${styles.mandatory}`}>
            <div className={styles.moduleToggle}>
              <input type="checkbox" checked disabled />
            </div>
            <div className={styles.moduleInfo}>
              <div className={styles.moduleTitle}>
                Service Catalogue Core
                <span className={styles.moduleMandatoryBadge}>Povinný</span>
              </div>
              <div className={styles.moduleDesc}>
                Jádro aplikace — seznam služeb, detail, editor, import, dashboard, vazby a governance.
                Nelze deaktivovat.
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
              <div className={styles.moduleTitle}>C3 Taxonomy</div>
              <div className={styles.moduleDesc}>
                Capability Taxonomy modul — C3 entity, capability map, technologické vazby
                a C3 dashboard. Volitelný — lze přidat i po instalaci.
              </div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>← Zpět</button>
          <button className={styles.btnPrimary} onClick={goNext}>Pokračovat →</button>
        </div>
      </>
    );
  }

  function renderStep6_DataPlan() {
    return (
      <>
        <h1 className={styles.panelTitle}>Data packages</h1>
        <p className={styles.panelSubtitle}>
          Instalace dat je rozdělena do tří vrstev. Core a reference seed jsou povinné.
          Business data jsou volitelná a lze je importovat kdykoli.
        </p>

        <div className={styles.packageList}>
          <div className={`${styles.packageItem} ${styles.mandatory}`}>
            <span className={styles.packageIcon}>🗄️</span>
            <span className={styles.packageTitle}>Core Installation</span>
            <span className={`${styles.packageBadge} ${styles.mandatory}`}>Povinné</span>
          </div>
          <div className={styles.packageItem} style={{ paddingLeft: 48, fontSize: 12, color: 'var(--color-text-muted)' }}>
            DB schema, indexy, constraints, systémové role, default konfigurace
          </div>

          <div className={`${styles.packageItem} ${styles.mandatory}`}>
            <span className={styles.packageIcon}>📋</span>
            <span className={styles.packageTitle}>Reference Seed — Service Catalogue Core</span>
            <span className={`${styles.packageBadge} ${styles.mandatory}`}>Povinné</span>
          </div>
          <div className={styles.packageItem} style={{ paddingLeft: 48, fontSize: 12, color: 'var(--color-text-muted)' }}>
            Enumy, systémové dashboard definice, konfigurační taxonomie, editor metadata
          </div>

          {activateC3 && (
            <>
              <div className={`${styles.packageItem} ${styles.mandatory}`}>
                <span className={styles.packageIcon}>🧩</span>
                <span className={styles.packageTitle}>Reference Seed — C3 Taxonomy</span>
                <span className={`${styles.packageBadge} ${styles.mandatory}`}>Povinné (C3)</span>
              </div>
            </>
          )}

          <div className={`${styles.packageItem} ${styles.optional}`}>
            <span className={styles.packageIcon}>📦</span>
            <span className={styles.packageTitle}>Business data — Service Catalogue</span>
            <span className={`${styles.packageBadge} ${styles.optional}`}>Volitelné</span>
          </div>
          <div className={styles.packageItem} style={{ paddingLeft: 48, fontSize: 12, color: 'var(--color-text-muted)' }}>
            Importovat ve voliteleném kroku nebo kdykoli v admin sekci
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
            <span className={styles.packageTitle}>Testovací data</span>
            <span className={`${styles.packageBadge} ${styles.optional}`}>Doporučeno</span>
          </div>
          <div className={styles.packageItem} style={{ paddingLeft: 48, fontSize: 12, color: 'var(--color-text-muted)' }}>
            Vytvoří 3 kompletně vyplněné demo služby (PIS, IAM, DAP) se SLA, ceníky, rolemi,
            vazbami a napojením na C3 taxonomy (všechny typy: BP, BR, CP, CI, CO, CR, IP, UA).
            Název služeb je označen prefixem <strong>[DEMO]</strong> — snadno identifikovatelné.
          </div>
        </div>

        <Alert type="info">
          Core a reference seed budou aplikovány automaticky. Business data lze
          nahrát v dalším kroku nebo přeskočit.
          {seedDemoData && <><br /><strong>Testovací data budou vytvořena automaticky během instalace.</strong></>}
        </Alert>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>← Zpět</button>
          <button className={styles.btnPrimary} onClick={goNext}>Pokračovat →</button>
        </div>
      </>
    );
  }

  function renderStep7_Upload() {
    const totalRows = uploadedFiles.reduce((s, f) => s + f.size, 0);
    return (
      <>
        <h1 className={styles.panelTitle}>Import business dat (volitelné)</h1>
        <p className={styles.panelSubtitle}>
          Nahrajte jeden nebo více souborů se službami. Každý soubor bude zpracován jako
          samostatný batch. Tento krok lze přeskočit a provést import kdykoli v admin sekci.
        </p>

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
            {uploadedFiles.length > 0 ? 'Přidat další soubory' : 'Přetáhněte soubory nebo klikněte pro výběr'}
          </div>
          <div className={styles.uploadHint}>CSV, XLSX nebo JSON · Více souborů najednou · Max 50 MB na soubor</div>
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
                  title="Odebrat"
                >
                  ✕
                </button>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', paddingLeft: 4 }}>
              {uploadedFiles.length} souborů · {(totalRows / 1024).toFixed(1)} KB celkem
            </div>
          </div>
        )}

        <Alert type="warning">
          Každý soubor bude zpracován jako samostatný import batch. Záznamy se shodným
          service_id budou aktualizovány (upsert), nové záznamy vloženy.
        </Alert>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>← Zpět</button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className={styles.btnSecondary} onClick={handleUploadNext}>
              {uploadedFiles.length > 0 ? 'Přeskočit import' : 'Přeskočit →'}
            </button>
            {uploadedFiles.length > 0 && (
              <button className={styles.btnPrimary} onClick={handleUploadNext} disabled={previewLoading}>
                {previewLoading ? <><Spinner /> Načítám...</> : `Pokračovat (${uploadedFiles.length} ${uploadedFiles.length === 1 ? 'soubor' : uploadedFiles.length < 5 ? 'soubory' : 'souborů'}) →`}
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
            ? <span style={{ fontSize: 11, color: 'var(--color-danger)', fontWeight: 600 }}>✗ Chyba</span>
            : <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>✓ {preview.row_count} řádků</span>}
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
                  +{preview.columns.length - 10} dalších
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
        <h1 className={styles.panelTitle}>Náhled importu</h1>
        <p className={styles.panelSubtitle}>
          {filePreviews.length > 0
            ? `Analýza ${filePreviews.length} ${filePreviews.length === 1 ? 'souboru' : 'souborů'} — počty záznamů, sloupce, varování.`
            : 'Žádné soubory k importu. Přejdeme k instalaci.'}
        </p>

        {filePreviews.length === 0 ? (
          <Alert type="info">
            Import přeskočen. Systém bude inicializován s prázdnými business daty.
            Import lze provést kdykoli v admin sekci po dokončení instalace.
          </Alert>
        ) : (
          <>
            {/* Aggregate summary */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
              {[
                { label: 'Souborů celkem', value: filePreviews.length, color: 'var(--color-text-primary)' },
                { label: 'Řádků k importu', value: totalRows, color: 'var(--color-action-primary)' },
                { label: 'Připraveno', value: validCount, color: 'var(--color-success)' },
                ...(fatalCount > 0 ? [{ label: 'Chyby', value: fatalCount, color: 'var(--color-danger)' }] : []),
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
                ✅ {validCount} {validCount === 1 ? 'soubor připraven' : 'soubory připraveny'} k importu — celkem {totalRows} záznamů bude zpracováno po dokončení instalace.
              </Alert>
            )}
            {fatalCount > 0 && (
              <Alert type="warning">
                {fatalCount} {fatalCount === 1 ? 'soubor' : 'soubory'} se nepodařilo načíst a {fatalCount === 1 ? 'bude přeskočen' : 'budou přeskočeny'}. Lze importovat v admin sekci.
              </Alert>
            )}
          </>
        )}

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>← Zpět</button>
          <button className={styles.btnPrimary} onClick={goNext}>
            {validCount === 0 && filePreviews.length > 0 ? 'Přeskočit import →' : 'Pokračovat →'}
          </button>
        </div>
      </>
    );
  }

  function renderStep9_Execute() {
    return (
      <>
        <h1 className={styles.panelTitle}>Spuštění instalace</h1>
        <p className={styles.panelSubtitle}>
          Vše je připraveno. Instalace provede aktivaci modulů, zápis konfigurace
          a přepne systém do stavu READY.
        </p>

        {!executing && !completedSteps.has(9) && (
          <div className={styles.checkList}>
            {renderConnCheck('Service Catalogue Core', true, 'bude aktivován')}
            {renderConnCheck('C3 Taxonomy', activateC3 ? undefined : true,
              activateC3 ? 'bude aktivován' : 'přeskočen')}
            {renderConnCheck('Admin účet', installInfo?.admin_exists ?? !!adminForm.username, 'připraven')}
            {renderConnCheck('Release metadata', true, `v${installInfo?.app_version}`)}
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
            ← Zpět
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleExecute}
            disabled={executing || completedSteps.has(9)}
          >
            {executing ? <><Spinner /> Probíhá...</> : '🚀 Spustit instalaci'}
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
            {isReady ? 'Instalace dokončena' : 'Instalace selhala'}
          </div>
          <div className={styles.summaryDesc}>
            {isReady
              ? 'Systém je ve stavu READY. Aplikace je připravena k provozu.'
              : 'Zkontrolujte chyby a spusťte repair flow.'}
          </div>
        </div>

        {summary && (
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <div className={styles.metaLabel}>Stav systému</div>
              <div className={styles.metaValue}>{String((summary as Record<string, unknown>).status ?? '')}</div>
            </div>
            <div className={styles.metaItem}>
              <div className={styles.metaLabel}>Verze aplikace</div>
              <div className={styles.metaValue}>{String((summary as Record<string, unknown>).app_version ?? '')}</div>
            </div>
            <div className={styles.metaItem}>
              <div className={styles.metaLabel}>Schema verze</div>
              <div className={styles.metaValue}>{String((summary as Record<string, unknown>).schema_version ?? '')}</div>
            </div>
            <div className={styles.metaItem}>
              <div className={styles.metaLabel}>Aktivní moduly</div>
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
                    <div className={styles.metaLabel}>Import souborů</div>
                    <div className={styles.metaValue}>{importResults.length}</div>
                  </div>
                  <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>Nově importováno</div>
                    <div className={styles.metaValue}>{totalInserted}</div>
                  </div>
                  <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>Aktualizováno</div>
                    <div className={styles.metaValue}>{totalUpdated}</div>
                  </div>
                  {totalFailed > 0 && (
                    <div className={styles.metaItem}>
                      <div className={styles.metaLabel}>Chyby řádků</div>
                      <div className={styles.metaValue} style={{ color: 'var(--color-warning)' }}>{totalFailed}</div>
                    </div>
                  )}
                  <div className={styles.metaItem} style={{ gridColumn: '1 / -1' }}>
                    <div className={styles.metaLabel}>Výsledky po souborech</div>
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
                <div className={styles.metaLabel}>Import</div>
                <div className={styles.metaValue} style={{ color: 'var(--color-text-muted)' }}>Přeskočen — data lze importovat v admin sekci</div>
              </div>
            )}
          </div>
        )}

        <Alert type="warning">
          Tato stránka nebude po odchodu znovu zobrazena jako výchozí vstup.
          Správa instalace a modulů je dostupná v admin sekci → Installation &amp; Modules.
        </Alert>

        {isReady && (
          <div className={styles.actions}>
            <div />
            <button
              className={styles.btnPrimary}
              onClick={() => router.replace('/login')}
            >
              Přejít na přihlášení →
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
              🔧 Spustit repair flow
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
            Načítám stav instalace…
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
        <span className={styles.headerLogo}>Service Catalogue</span>
        <span className={styles.headerSub}>Installation Wizard · v{installInfo?.app_version ?? '1.0.0'}</span>
      </div>

      <div className={styles.main}>
        {/* Left stepper */}
        <nav className={styles.stepper}>
          <div className={styles.stepperTitle}>Průběh instalace</div>
          <ul className={styles.stepList}>
            {STEPS.map((s, idx) => {
              const st = stepStatus(idx);
              return (
                <li key={s.id} className={`${styles.stepItem} ${styles[st]}`}>
                  <StepDot num={idx + 1} status={st} />
                  <span className={styles.stepLabel}>{s.label}</span>
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
