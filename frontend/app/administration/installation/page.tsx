'use client';
/**
 * /app/administration/installation/page.tsx
 *
 * Admin section: Installation & Modules
 * Displays installation status, active modules, version, and allows the user to:
 *   - trigger the repair flow
 *   - navigate to re-import
 *   - inspect installation state detail
 */

import { useState, useEffect, useCallback } from 'react';
import styles from '../../admin/admin.module.css';
import Link from '@/app/components/AppLink';
import { useI18n, useT } from '../../i18n/useI18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModuleStatus {
  code: string;
  label: string;
  kind?: string | null;
  is_mandatory: boolean;
  enabled: boolean;
  schema_installed?: boolean;
  seed_installed?: boolean;
  reference_seed_installed?: boolean;
  api_enabled?: boolean;
  ui_visible?: boolean;
  version?: string;
  install_order?: number;
  depends_on?: string[];
  optional_integrations?: string[];
  api_route_prefixes?: string[];
  ui_route_prefixes?: string[];
  db_slices?: string[];
  manifest_managed?: boolean;
}

interface InstallSummary {
  status: string;
  mode?: string;
  app_version: string;
  schema_version: string;
  admin_exists?: boolean;
  modules: ModuleStatus[];
  installed_at?: string;
  installed_by?: string;
  lock_token?: string;
  install_locked?: boolean;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    READY: 'var(--color-success)',
    INSTALL_FAILED: 'var(--color-danger)',
    REPAIR_REQUIRED: 'var(--color-warning)',
    UPGRADE_REQUIRED: 'var(--color-warning)',
    INSTALL_IN_PROGRESS: 'var(--color-info)',
    NOT_INSTALLED: 'var(--color-text-muted)',
  };
  const color = colorMap[status] || 'var(--color-text-secondary)';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px',
      background: `color-mix(in srgb, ${color} 15%, var(--color-bg-surface))`,
      color, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 12,
    }}>
      {status}
    </span>
  );
}

function ModuleBadge({ enabled }: { enabled: boolean }) {
  const t = useT();
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px',
      background: enabled ? 'color-mix(in srgb, var(--color-success) 12%, var(--color-bg-surface))' : 'var(--color-bg-surface-raised)',
      color: enabled ? 'var(--color-success)' : 'var(--color-text-muted)',
      border: `1px solid ${enabled ? 'color-mix(in srgb, var(--color-success) 30%, transparent)' : 'var(--color-border-default)'}`,
      borderRadius: 'var(--radius-pill)', fontSize: 11,
    }}>
      {enabled ? t('common.active') : t('administration.installation.module_inactive')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function InstallationPage() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<InstallSummary | null>(null);
  const [loading, setLoading] = useState(true);
  // Holds an i18n message key so the error follows the active locale.
  const [error, setError] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, summaryRes] = await Promise.all([
        fetch('/api/v1/install/status'),
        fetch('/api/v1/install/summary'),
      ]);
      const statusData = await statusRes.json();
      const summaryData = await summaryRes.json();
      // Merge: summary might not have full module data if install was old — fallback to status
      setSummary({
        ...statusData,
        ...summaryData,
        modules: summaryData.modules || statusData.modules || [],
      });
    } catch {
      setError('install.page.status_load_failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- U5: load() performs the async install-status sync and owns state updates.
  useEffect(() => { load(); }, [load]);

  async function handleSeedDemo(action: 'seed' | 'remove') {
    if (action === 'remove') {
      if (!confirm(t('install.page.demo_remove_confirm'))) return;
    }
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch('/api/v1/install/seed-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        setSeedResult({ ok: true, msg: data.message || (action === 'seed' ? t('administration.installation.demo_restored') : t('administration.installation.demo_removed')) });
      } else {
        setSeedResult({ ok: false, msg: data.error || t('administration.installation.unknown_error') });
      }
    } catch {
      setSeedResult({ ok: false, msg: t('administration.installation.middleware_error') });
    } finally {
      setSeeding(false);
    }
  }

  async function handleRepair() {
    if (!confirm(t('administration.installation.repair_confirm'))) return;
    setRepairing(true);
    setRepairResult(null);
    try {
      const res = await fetch('/api/v1/install/repair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setRepairResult(t('administration.installation.repair_started'));
        setTimeout(() => { window.location.href = '/install'; }, 2000);
      } else {
        setRepairResult(t('administration.installation.repair_error', { error: data.error || t('administration.installation.unknown_error') }));
      }
    } catch {
      setRepairResult(t('administration.installation.middleware_error'));
    } finally {
      setRepairing(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.shell}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>{t('install.page.loading_status')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.shell}>
        <div style={{ padding: 'var(--space-4)', background: 'color-mix(in srgb, var(--color-danger) 10%, var(--color-bg-surface))', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: 'var(--space-4)' }}>
          {t(error)}
        </div>
        <button onClick={load} style={{ fontSize: 13, padding: '6px 14px', cursor: 'pointer' }}>
          {t('administration.installation.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <h1 className={styles.pageTitle} style={{ margin: 0 }}>{t('administration.card.installation.title')}</h1>
          {summary?.status && <StatusPill status={summary.status} />}
        </div>
        <p className={styles.pageSubtitle} style={{ marginBottom: 0 }}>
          {t('administration.installation.subtitle')}
        </p>
      </div>

      {seedResult && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: seedResult.ok
            ? 'color-mix(in srgb, var(--color-success) 10%, var(--color-bg-surface))'
            : 'color-mix(in srgb, var(--color-danger) 10%, var(--color-bg-surface))',
          border: `1px solid ${seedResult.ok ? 'color-mix(in srgb, var(--color-success) 30%, transparent)' : 'color-mix(in srgb, var(--color-danger) 30%, transparent)'}`,
          borderRadius: 'var(--radius-md)',
          color: seedResult.ok ? 'var(--color-success)' : 'var(--color-danger)',
          marginBottom: 'var(--space-4)', fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{seedResult.ok ? '✓ ' : '✗ '}{seedResult.msg}</span>
          <button onClick={() => setSeedResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.6 }}>&times;</button>
        </div>
      )}

      {repairResult && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'color-mix(in srgb, var(--color-info) 10%, var(--color-bg-surface))', border: '1px solid color-mix(in srgb, var(--color-info) 30%, transparent)', borderRadius: 'var(--radius-md)', color: 'var(--color-info)', marginBottom: 'var(--space-4)', fontSize: 13 }}>
          {repairResult}
        </div>
      )}

      {/* ── Installation overview ─────────────────────────────────── */}
      <section style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
        <h2 style={{ font: 'var(--text-title-sm)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
          {t('administration.installation.section.installation')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          {[
            { label: t('common.status'), value: summary?.status ?? '—' },
            { label: t('install.page.execute.application_version'), value: summary?.app_version ?? '—' },
            { label: t('administration.installation.schema_version'), value: summary?.schema_version ?? '—' },
            { label: t('administration.installation.installed_at'), value: summary?.installed_at ? new Date(summary.installed_at).toLocaleString('cs') : '—' },
            { label: t('administration.installation.installed_by'), value: summary?.installed_by ?? '—' },
            { label: t('administration.installation.admin_account'), value: summary?.admin_exists ? `✓ ${t('administration.installation.admin_exists')}` : `✗ ${t('administration.installation.admin_missing')}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ borderLeft: '2px solid var(--color-border-strong)', paddingLeft: 'var(--space-3)' }}>
              <div style={{ font: 'var(--text-label-sm)', color: 'var(--color-text-muted)', marginBottom: 2 }}>{label}</div>
              <div style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-primary)', fontFamily: value?.startsWith('v') ? 'monospace' : undefined }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Modules ──────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
        <h2 style={{ font: 'var(--text-title-sm)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
          {t('administration.installation.section.modules')}
        </h2>
        {(!summary?.modules || summary.modules.length === 0) ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{t('administration.installation.no_modules')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {summary.modules.map(mod => (
              <div key={mod.code} style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                padding: 'var(--space-4)', gap: 'var(--space-4)',
                background: mod.enabled ? 'color-mix(in srgb, var(--color-success) 5%, var(--color-bg-surface-raised))' : 'var(--color-bg-surface-raised)',
                border: `1px solid ${mod.enabled ? 'color-mix(in srgb, var(--color-success) 20%, var(--color-border-default))' : 'var(--color-border-default)'}`,
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ font: 'var(--text-label-md)', color: 'var(--color-text-primary)' }}>{mod.label || mod.code}</span>
                    {mod.is_mandatory && (
                      <span style={{ font: 'var(--text-label-sm)', color: 'var(--color-text-muted)', fontSize: 11 }}>{t('common.mandatory')}</span>
                    )}
                  </div>
                  <div style={{ font: 'var(--text-label-sm)', color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 11 }}>{mod.code}</div>
                  {(mod.kind || (mod.depends_on?.length ?? 0) > 0) && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                      {mod.kind && <span>{t('administration.installation.module_kind', { kind: mod.kind })}</span>}
                      {mod.kind && (mod.depends_on?.length ?? 0) > 0 && <span> · </span>}
                      {(mod.depends_on?.length ?? 0) > 0 && <span>{t('administration.installation.module_dependencies', { dependencies: mod.depends_on?.join(', ') })}</span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    {[
                      { label: t('administration.installation.flag.schema'), val: mod.schema_installed },
                      { label: t('administration.installation.flag.seed'), val: mod.seed_installed ?? mod.reference_seed_installed },
                      { label: t('administration.installation.flag.api'), val: mod.api_enabled },
                    ].map(({ label, val }) => (
                      <span key={label} style={{ fontSize: 11, color: val ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                        {val ? '✓' : '○'} {label}
                      </span>
                    ))}
                    {mod.version && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>v{mod.version}</span>}
                  </div>
                </div>
                <ModuleBadge enabled={mod.enabled} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Demo data management ─────────────────────────────────────── */}
      {summary?.status === 'READY' && (
        <section style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
          <h2 style={{ font: 'var(--text-title-sm)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
            {t('install.page.modules.demo_data')}
          </h2>
          <p style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            {t('install.page.demo_data_management_description')}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleSeedDemo('seed')}
              disabled={seeding}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px',
                background: 'color-mix(in srgb, var(--color-success) 10%, var(--color-bg-surface))',
                border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
                borderRadius: 'var(--radius-md)', fontSize: 13, cursor: seeding ? 'not-allowed' : 'pointer',
                color: 'var(--color-success)', opacity: seeding ? 0.6 : 1, fontWeight: 500,
              }}
            >
              {seeding ? `⏳ ${t('common.running')}` : `🔁 ${t('administration.installation.demo_restore')}`}
            </button>
            <button
              onClick={() => handleSeedDemo('remove')}
              disabled={seeding}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px',
                background: 'var(--color-bg-surface-raised)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-md)', fontSize: 13, cursor: seeding ? 'not-allowed' : 'pointer',
                color: 'var(--color-text-secondary)', opacity: seeding ? 0.6 : 1,
              }}
            >
              🗑 {t('administration.installation.demo_remove')}
            </button>
          </div>
        </section>
      )}

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)' }}>
        <h2 style={{ font: 'var(--text-title-sm)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
          {t('administration.installation.section.management')}
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Link href="/import" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: 'var(--color-action-secondary)', border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--color-text-primary)', textDecoration: 'none',
            cursor: 'pointer',
          }}>
            📥 {t('administration.installation.reimport')}
          </Link>

          <button
            onClick={load}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: 'var(--color-bg-surface-raised)', border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-primary)',
            }}
          >
            🔄 {t('administration.installation.refresh_status')}
          </button>

          {summary?.status !== 'READY' && (
            <a href="/install" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: 'color-mix(in srgb, var(--color-info) 10%, var(--color-bg-surface))',
              border: '1px solid color-mix(in srgb, var(--color-info) 30%, transparent)',
              borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--color-info)', textDecoration: 'none',
            }}>
              🧙 {t('administration.installation.open_wizard')}
            </a>
          )}

          <button
            onClick={handleRepair}
            disabled={repairing || summary?.status === 'INSTALL_IN_PROGRESS'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: 'color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-surface))',
              border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)',
              borderRadius: 'var(--radius-md)', fontSize: 13, cursor: 'pointer', color: 'var(--color-danger)',
              opacity: repairing ? 0.6 : 1,
            }}
          >
            🔧 {t('administration.installation.run_repair')}
          </button>
        </div>

        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-bg-surface-raised)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--color-text-muted)' }}>
          ⚠️ {t('administration.installation.repair_note')}
        </div>
      </section>
    </div>
  );
}
