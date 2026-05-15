'use client';
/**
 * /app/install/page.tsx — Install wizard
 *
 * 9 steps:
 *   1  Welcome / application description / language
 *   2  Setup token / mode detection
 *   3  System configuration
 *   4  Secret validation
 *   5  Admin bootstrap
 *   6  Connectivity check
 *   7  Module plan
 *   8  Execute
 *   9  Final summary
 *
 * The frontend only reads state from the API — it never determines install state itself.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { markInstallReady } from '@/app/components/AuthGuard';
import { useI18n } from '@/app/i18n/useI18n';
import type { Locale } from '@/app/i18n/messages';
import type { InstallModuleInfo } from '@/features/install/installStatus';
import { MODULE_CODES } from '@/features/modules/manifest';
import styles from './install.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InstallMode   = 'fresh' | 'repair' | 'upgrade' | 'ready';
type InstallStatus = 'NOT_INSTALLED' | 'INSTALL_IN_PROGRESS' | 'CORE_INSTALLED' |
                     'MODULES_CONFIGURED' | 'DATA_IMPORT_IN_PROGRESS' | 'READY' |
                     'INSTALL_FAILED' | 'UPGRADE_REQUIRED' | 'REPAIR_REQUIRED';

interface ModuleInfo extends Omit<InstallModuleInfo, 'enabled'> {
  mandatory?: boolean;
  enabled?: boolean;
  will_activate?: boolean;
}

interface InstallStatusResponse {
  mode: InstallMode;
  status: InstallStatus;
  install_locked: boolean;
  locked_by: string | null;
  app_version: string;
  schema_version: string;
  admin_exists: boolean;
  modules: InstallModuleInfo[];
  db_error?: string;
}

interface InstallModulesResponse {
  ok: boolean;
  modules: ModuleInfo[];
  error?: string;
}

interface ConnectivityChecks {
  db_reachable: boolean;
  db_write_access: boolean;
  platform_schema: boolean;
  errors: string[];
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

const INSTALL_WIZARD_MANIFEST: StepDef[] = [
  { id: 'welcome',     label: 'install.step.welcome' },
  { id: 'setup-token', label: 'install.step.setup_token' },
  { id: 'config',      label: 'install.step.config' },
  { id: 'secrets',     label: 'install.step.secrets' },
  { id: 'admin',       label: 'install.step.admin' },
  { id: 'connectivity',label: 'install.step.connectivity' },
  { id: 'modules',     label: 'install.step.modules' },
  { id: 'execute',     label: 'install.step.execute' },
  { id: 'summary',     label: 'install.step.summary' },
];

const STEP_INDEX = {
  welcome: 0,
  setupToken: 1,
  config: 2,
  secrets: 3,
  admin: 4,
  connectivity: 5,
  modules: 6,
  execute: 7,
  summary: 8,
} as const;

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
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [errorSteps, setErrorSteps] = useState<Set<number>>(new Set());

  // Step 2 — detection
  const [installInfo, setInstallInfo] = useState<InstallStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Step 3 — system config
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

  // Step 5 — admin form
  const [adminForm, setAdminForm] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    mustChangePassword: true,
  });
  const [adminErrors, setAdminErrors] = useState<Partial<Record<string, string>>>({});

  // Step 6 — connectivity
  const [connectivity, setConnectivity] = useState<ConnectivityChecks | null>(null);
  const [checkingConn, setCheckingConn] = useState(false);

  // Step 7 — modules and optional demo seed
  const [activateC3, setActivateC3] = useState(false);
  const [modulePlan, setModulePlan] = useState<ModuleInfo[]>([]);
  const [modulePlanLoading, setModulePlanLoading] = useState(false);
  const [modulePlanError, setModulePlanError] = useState<string | null>(null);
  const [seedDemoData, setSeedDemoData] = useState(false);

  // Step 8 — execute
  const [executing, setExecuting] = useState(false);
  const [executeProgress, setExecuteProgress] = useState(0);
  const [executeLog, setExecuteLog] = useState<string[]>([]);
  const [executeError, setExecuteError] = useState<string | null>(null);

  // Step 9 — summary
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
  /* eslint-disable react-hooks/exhaustive-deps -- U5: installer status is loaded once on mount; fetchInstallStatus owns its internal state. */
  useEffect(() => {
    fetchInstallStatus();
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps -- U5: module plan is loaded from installer API whenever the wizard enters module selection or C3 changes. */
  useEffect(() => {
    if (step === STEP_INDEX.modules) {
      void fetchModulePlan(activateC3);
    }
  }, [step, activateC3]);
  /* eslint-enable react-hooks/exhaustive-deps */

  async function fetchInstallStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/v1/install/status', { cache: 'no-store' });
      const data: InstallStatusResponse = await res.json();
      setInstallInfo(data);

      // If READY, update AuthGuard cache but keep the install page stable.
      // The user can continue explicitly via the result action; auto-redirecting
      // from /install causes visible route flicker during first-run diagnostics.
      if (data.status === 'READY') {
        markInstallReady(data.modules);
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
    setStep(s => Math.min(s + 1, INSTALL_WIZARD_MANIFEST.length - 1));
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
    } catch {
      setInstallLockedError(false);
      setGlobalError(t('install.page.start_error'));
      return false;
    }
  }

  async function handleSetupTokenNext() {
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
      markDone(STEP_INDEX.config);
      goNext();
    } catch {
      setConfigError(t('install.page.config_load_failed'));
    } finally {
      setConfigSaving(false);
    }
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
        markDone(STEP_INDEX.connectivity);
      } else {
        markError(STEP_INDEX.connectivity);
      }
    } catch {
      setConnectivity({
        db_reachable: false,
        db_write_access: false,
        platform_schema: false,
        errors: [t('install.page.connectivity.middleware_unavailable')],
      });
      markError(STEP_INDEX.connectivity);
    } finally {
      setCheckingConn(false);
    }
  }

  async function fetchModulePlan(nextActivateC3 = activateC3) {
    setModulePlanLoading(true);
    setModulePlanError(null);
    try {
      const res = await fetch('/api/v1/install/modules', {
        method: 'POST',
        headers: installRequestHeaders(),
        body: JSON.stringify({ activate_c3: nextActivateC3 }),
      });
      const data: InstallModulesResponse = await res.json();
      if (!res.ok || !data.ok || !Array.isArray(data.modules)) {
        setModulePlanError(data.error || t('install.page.modules.load_failed'));
        return [];
      }
      setModulePlan(data.modules);
      return data.modules;
    } catch {
      setModulePlanError(t('install.page.modules.load_failed'));
      return [];
    } finally {
      setModulePlanLoading(false);
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
        markError(STEP_INDEX.admin);
        return;
      }
      setInstallInfo(prev => prev ? { ...prev, admin_exists: true } : prev);
      markDone(STEP_INDEX.admin);
      goNext();
    } catch {
      setAdminErrors({ general: t('install.page.admin.create_error') });
      markError(STEP_INDEX.admin);
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
        markError(STEP_INDEX.execute);
        setExecuting(false);
        return;
      }

      logMsg(t('install.page.execute.log.loading_report'));
      setExecuteProgress(95);
      let readyModules: InstallModuleInfo[] = [];
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
      markDone(STEP_INDEX.execute);

      // Set AuthGuard cache to READY immediately — prevents redirect loop
      markInstallReady(readyModules);

      setTimeout(() => goNext(), 800);
    } catch {
      setExecuteError(t('install.page.execute.unexpected_error'));
      markError(STEP_INDEX.execute);
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

  function isMandatoryModule(module: ModuleInfo) {
    return module.is_mandatory === true || module.mandatory === true;
  }

  function isC3Module(module: ModuleInfo) {
    return module.code === MODULE_CODES.C3;
  }

  function isSelectableModule(module: ModuleInfo) {
    return !isMandatoryModule(module) && isC3Module(module);
  }

  function resolveModuleWillActivate(module: ModuleInfo) {
    if (isMandatoryModule(module)) return true;
    if (isC3Module(module)) return activateC3;
    return module.will_activate === true || module.enabled === true;
  }

  function moduleDescription(module: ModuleInfo) {
    const details = [
      module.kind ? `${t('install.page.modules.kind')}: ${module.kind}` : null,
      (module.depends_on?.length ?? 0) > 0
        ? `${t('install.page.modules.dependencies')}: ${module.depends_on?.join(', ')}`
        : t('install.page.modules.no_dependencies'),
      (module.db_slices?.length ?? 0) > 0
        ? `${t('install.page.modules.db_slices')}: ${module.db_slices?.length}`
        : null,
      (module.api_route_prefixes?.length ?? 0) > 0
        ? `${t('install.page.modules.api_routes')}: ${module.api_route_prefixes?.length}`
        : null,
      (module.ui_route_prefixes?.length ?? 0) > 0
        ? `${t('install.page.modules.ui_routes')}: ${module.ui_route_prefixes?.length}`
        : null,
      (module.optional_integrations?.length ?? 0) > 0
        ? `${t('install.page.modules.optional_integrations')}: ${module.optional_integrations?.join(', ')}`
        : null,
    ].filter(Boolean);

    return details.join(' | ');
  }

  function setModuleActivation(module: ModuleInfo, selected: boolean) {
    if (isC3Module(module)) {
      setActivateC3(selected);
    }
  }

  function plannedInstallModules(): ModuleInfo[] {
    if (modulePlan.length > 0) return modulePlan;
    return installInfo?.modules ?? [];
  }

  function renderModuleCard(module: ModuleInfo) {
    const mandatory = isMandatoryModule(module);
    const selected = resolveModuleWillActivate(module);
    const selectable = isSelectableModule(module);
    const cardClass = [
      styles.moduleCard,
      mandatory ? styles.mandatory : '',
      selected && !mandatory ? styles.selected : '',
    ].filter(Boolean).join(' ');

    return (
      <div
        key={module.code}
        className={cardClass}
        onClick={selectable ? () => setModuleActivation(module, !selected) : undefined}
        style={selectable ? { cursor: 'pointer' } : undefined}
      >
        <div className={styles.moduleToggle}>
          <input
            type="checkbox"
            checked={selected}
            disabled={!selectable}
            onChange={e => setModuleActivation(module, e.target.checked)}
            onClick={e => e.stopPropagation()}
          />
        </div>
        <div className={styles.moduleInfo}>
          <div className={styles.moduleTitle}>
            {module.label || module.code}
            <span className={styles.moduleCode}>{module.code}</span>
            <span className={styles.moduleMandatoryBadge}>
              {mandatory ? t('common.mandatory') : t('common.optional')}
            </span>
          </div>
          <div className={styles.moduleDesc}>
            {moduleDescription(module)}
          </div>
        </div>
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

        <div className={styles.descriptionPanel}>
          <strong>{t('install.page.description_title')}</strong>
          <p>{t('install.page.description_body')}</p>
        </div>

        <div className={styles.languagePanel}>
          <label className={styles.label} htmlFor="install-locale">
            {t('install.page.environment_label')}
          </label>
          <select
            id="install-locale"
            className={styles.input}
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            <option value="cs">{t('install.page.environment_cze')}</option>
            <option value="en">{t('install.page.environment_eng')}</option>
          </select>
          <span className={styles.fieldHint}>{t('install.page.environment_hint')}</span>
        </div>

        <div className={styles.actions}>
          <div />
          <button className={styles.btnPrimary} onClick={goNext} disabled={loadingStatus}>
            {loadingStatus ? <Spinner /> : null}
            {t('common.continue')} →
          </button>
        </div>
      </>
    );
  }

  function renderStep1_SetupToken() {
    return (
      <>
        <h1 className={styles.panelTitle}>{t('install.page.setup_token_title')}</h1>
        <p className={styles.panelSubtitle}>{t('install.page.setup_token_subtitle')}</p>

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
          <button className={styles.btnSecondary} onClick={goBack}>{t('common.back')}</button>
          <button className={styles.btnPrimary} onClick={handleSetupTokenNext} disabled={loadingStatus || isStarting}>
            {(loadingStatus || isStarting) ? <Spinner /> : null}
            {isStarting ? t('common.loading') : t('install.page.start_button')}
          </button>
        </div>
      </>
    );
  }

  function renderStep2_Config() {
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
          <button className={styles.btnPrimary} onClick={goNext}>
            {t('common.continue')} →
          </button>
        </div>
      </>
    );
  }

  function renderStep3_Admin() {
        const adminAccountSaved = completedSteps.has(STEP_INDEX.admin) || installInfo?.admin_exists;

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
            {adminAccountSaved ? t('install.page.admin.save_account') : t('install.page.admin.create_account')} →
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
    const modules = plannedInstallModules();

    return (
      <>
        <h1 className={styles.panelTitle}>{t('install.page.modules.title')}</h1>
        <p className={styles.panelSubtitle}>
          {t('install.page.modules.subtitle')}
        </p>

        {modulePlanLoading && (
          <Alert type="info">
            <Spinner dark /> {t('install.page.modules.loading')}
          </Alert>
        )}

        {modulePlanError && (
          <Alert type="error">{modulePlanError}</Alert>
        )}

        <div className={styles.moduleGrid}>
          {modules.map(renderModuleCard)}
        </div>

        <div className={styles.packageList}>
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
            <span className={styles.packageTitle}>{t('install.page.modules.demo_data')}</span>
            <span className={`${styles.packageBadge} ${styles.optional}`}>{t('common.optional')}</span>
          </div>
          <div className={styles.packageItem} style={{ paddingLeft: 48, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {t('install.page.modules.demo_data_description')}
          </div>
        </div>

        {seedDemoData && (
          <Alert type="info">
            {t('install.page.modules.demo_data_note')}
          </Alert>
        )}

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={goBack}>{t('common.back')}</button>
          <button
            className={styles.btnPrimary}
            onClick={goNext}
            disabled={modulePlanLoading || !!modulePlanError || modules.length === 0}
          >
            {t('common.continue')} →
          </button>
        </div>
      </>
    );
  }

  function renderStep6_Execute() {
    const modules = plannedInstallModules();

    return (
      <>
        <h1 className={styles.panelTitle}>{t('install.page.execute_title')}</h1>
        <p className={styles.panelSubtitle}>
          {t('install.page.execute.subtitle')}
        </p>

        {!executing && !completedSteps.has(STEP_INDEX.execute) && (
          <div className={styles.checkList}>
            {modules.map(module => renderConnCheck(
              module.label || module.code,
              true,
              resolveModuleWillActivate(module)
                ? t('install.page.execute.will_be_activated')
                : t('install.page.execute.skipped'),
            ))}
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
            disabled={executing || completedSteps.has(STEP_INDEX.execute)}
          >
            {executing ? <><Spinner /> {t('common.running')}</> : `🚀 ${t('install.page.execute.start_installation')}`}
          </button>
        </div>
      </>
    );
  }

  function renderStep7_Summary() {
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

  const STEP_RENDERERS: Record<string, () => React.ReactNode> = {
    welcome: renderStep0_Welcome,
    'setup-token': renderStep1_SetupToken,
    config: renderStep2_Config,
    secrets: renderStep2_Secrets,
    admin: renderStep3_Admin,
    connectivity: renderStep4_Connectivity,
    modules: renderStep5_Modules,
    execute: renderStep6_Execute,
    summary: renderStep7_Summary,
  };

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
        <span className={styles.headerSub}>{t('install.wizard_title')} · v{installInfo?.app_version ?? '1.2.2'}</span>
      </div>

      <div className={styles.main}>
        {/* Left stepper */}
        <nav className={styles.stepper}>
          <div className={styles.stepperTitle}>{t('install.wizard_title')}</div>
          <ul className={styles.stepList}>
            {INSTALL_WIZARD_MANIFEST.map((s, idx) => {
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
            {STEP_RENDERERS[INSTALL_WIZARD_MANIFEST[step]?.id]?.()}
          </div>
        </div>
      </div>
    </div>
  );
}
