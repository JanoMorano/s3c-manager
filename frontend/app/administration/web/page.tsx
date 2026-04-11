'use client';

import Link from '@/app/components/AppLink';
import { useEffect, useMemo, useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import styles from './web.module.css';

const WEB_SETTINGS_ENDPOINT = '/api/v1/admin/web-settings';

type SettingType = 'string' | 'boolean';

interface WebSetting {
  key: string;
  type: SettingType;
  description: string;
  default_value: string;
  value: string;
}

interface WebSettingsResponse {
  items: WebSetting[];
}

function labelForSetting(key: string): string {
  switch (key) {
    case 'auth.sso.enabled':
      return 'Zapnout ADFS / SSO';
    case 'auth.sso.header':
      return 'Identity header';
    case 'auth.sso.display_name_header':
      return 'Display name header';
    case 'auth.sso.email_header':
      return 'Email header';
    case 'auth.sso.given_name_header':
      return 'Given name header';
    case 'auth.sso.surname_header':
      return 'Surname header';
    case 'auth.sso.department_header':
      return 'Department header';
    default:
      return key;
  }
}

export default function AdministrationWebPage() {
  const { data, isLoading, error } = useSWR<WebSettingsResponse>(WEB_SETTINGS_ENDPOINT, apiFetch, {
    revalidateOnFocus: false,
  });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.items) return;
    setDraft(
      data.items.reduce<Record<string, string>>((acc, item) => {
        acc[item.key] = String(item.value ?? item.default_value ?? '');
        return acc;
      }, {})
    );
  }, [data]);

  const items = useMemo(() => data?.items ?? [], [data]);

  function updateValue(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveOk(null);

    try {
      const response = await fetch(WEB_SETTINGS_ENDPOINT, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(draft),
      });

      const text = await response.text().catch(() => '');
      let payload: WebSettingsResponse | { error?: string } | null = null;

      if (text) {
        try {
          payload = JSON.parse(text) as WebSettingsResponse | { error?: string };
        } catch {
          payload = null;
        }
      }

      if (!response.ok) {
        const message =
          payload && 'error' in payload && payload.error
            ? payload.error
            : text || `Uložení selhalo (${response.status})`;
        throw new Error(message);
      }

      const result = payload as WebSettingsResponse | null;
      if (result?.items) {
        setDraft(
          result.items.reduce<Record<string, string>>((acc, item) => {
            acc[item.key] = String(item.value ?? item.default_value ?? '');
            return acc;
          }, {})
        );
      }

      await globalMutate(WEB_SETTINGS_ENDPOINT);
      setSaveOk('Web / ADFS nastavení bylo uloženo.');
    } catch (errorValue: unknown) {
      setSaveError(errorValue instanceof Error ? errorValue.message : 'Uložení selhalo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.breadcrumb}>
        <Link href="/administration">Administration</Link>
        <span className={styles.sep}>/</span>
        <span>Web</span>
      </nav>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Web</h1>
          <p className={styles.pageDesc}>
            Konfigurace ADFS / SSO trusted-header přihlášení. Tyto hodnoty určují, z jakých
            hlaviček aplikace čte doménovou identitu a profil uživatele po předání z IIS, ADFS nebo
            reverzní proxy.
          </p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={saving || isLoading}>
          {saving ? 'Ukládám…' : 'Uložit nastavení'}
        </button>
      </div>

      <section className={styles.infoCard}>
        <div className={styles.infoTitle}>Jak to funguje</div>
        <div className={styles.infoText}>
          Aplikace sama neprovádí Kerberos/NTLM handshake. Očekává, že důvěryhodná vrstva před ní
          uživatele ověří a předá jeho identitu v HTTP hlavičkách. Pokud v aplikaci existuje aktivní
          účet typu <strong>AD / SSO</strong>, uživatel se po otevření webu přihlásí automaticky.
        </div>
      </section>

      {saveError && <div className={styles.errorBox}>{saveError}</div>}
      {saveOk && <div className={styles.successBox}>{saveOk}</div>}
      {error && <div className={styles.errorBox}>Načtení konfigurace selhalo.</div>}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>ADFS / SSO parametry</div>
            <div className={styles.panelMeta}>
              Header názvy musí odpovídat tomu, co nastavuje IIS / ADFS / reverse proxy před
              middleware vrstvou.
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className={styles.state}>Načítám konfiguraci…</div>
        ) : (
          <div className={styles.formGrid}>
            {items.map((item) => {
              const value = draft[item.key] ?? item.default_value;
              const isBoolean = item.type === 'boolean';

              return (
                <label
                  key={item.key}
                  className={isBoolean ? `${styles.field} ${styles.fieldWide}` : styles.fieldWide}
                >
                  <span className={styles.label}>{labelForSetting(item.key)}</span>
                  <span className={styles.hint}>{item.description}</span>

                  {isBoolean ? (
                    <span className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={String(value).toLowerCase() === 'true'}
                        onChange={(event) => updateValue(item.key, event.target.checked ? 'true' : 'false')}
                      />
                      <span>Povolit automatické doménové přihlášení přes trusted headers</span>
                    </span>
                  ) : (
                    <input
                      className={styles.input}
                      value={value}
                      onChange={(event) => updateValue(item.key, event.target.value)}
                      placeholder={item.default_value}
                    />
                  )}

                  <span className={styles.meta}>
                    <span className={styles.metaLabel}>Config key:</span> {item.key}
                    <span className={styles.metaSep}>•</span>
                    <span className={styles.metaLabel}>Default:</span> {item.default_value}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
