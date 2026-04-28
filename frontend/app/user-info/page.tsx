/**
 * User Info page
 * - Shows account info fetched from GET /api/v1/auth/me
 * - Editable profile form (PATCH /api/v1/auth/me)
 * - Password change (POST /api/v1/auth/change-password)
 * - Avatar colour picker (deterministic palette; saved to profile)
 * - Owned services mini-dashboard
 */
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from '@/app/components/AppLink';
import { useI18n } from '@/app/i18n/useI18n';
import useSWR from 'swr';
import styles from './user-info.module.css';
import { clearAuthSession, getAuthSnapshot, restoreAuthSession, setAuthSnapshotFromUser } from '@/features/auth/authStore';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import type { ServiceListResponse, ServiceListItem } from '@/features/services/model/service.types';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/app/i18n/messages';
import { usePersonaContext, type Persona } from '@/features/auth/PersonaContext';

// ── Avatar colour palette ─────────────────────────────────────────────────────
const PALETTE = [
  'var(--color-info)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-danger)', 'var(--color-domain-relay)',
  'var(--color-domain-zenith)', 'var(--color-domain-pulse)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-text-secondary)',
];

function pickColorFromName(name: string): string {
  let h = 0;
  for (const c of name) h = ((h * 31) + c.charCodeAt(0)) & 0x7fffffff;
  return PALETTE[h % PALETTE.length];
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface MeResponse {
  id: number;
  username: string;
  display_name: string | null;
  email: string | null;
  role: string;
  auth_provider: string | null;
  must_change_password: boolean;
  preferred_lang: string | null;
  preferred_theme: string | null;
  given_name: string | null;
  surname: string | null;
  phone: string | null;
  department: string | null;
  avatar_color: string | null;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function UserInfoPage() {
  const { t, setLocale } = useI18n();
  const { persona, setPersona } = usePersonaContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Profile data from /me ─────────────────────────────────────────────────
  const { data: me, mutate: mutateMe, error: meError } = useSWR<MeResponse>(
    '/api/v1/auth/me',
    apiFetch,
    { revalidateOnFocus: false },
  );

  // ── Profile edit form state ───────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    display_name: '', given_name: '', surname: '',
    email: '', department: '', phone: '', avatar_color: '',
    preferred_lang: 'cs' as Locale,
  });
  const [profileSaving,  setProfileSaving]  = useState(false);
  const [profileSaved,   setProfileSaved]   = useState(false);
  const [profileError,   setProfileError]   = useState<string | null>(null);
  const [langSaving, setLangSaving] = useState(false);
  const [langError, setLangError] = useState<string | null>(null);
  const [personaSaving, setPersonaSaving] = useState(false);
  const [personaSaved, setPersonaSaved] = useState(false);
  const [personaError, setPersonaError] = useState<string | null>(null);

  // ── Password form state ───────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving,   setPwSaving]   = useState(false);
  const [pwSaved,    setPwSaved]    = useState(false);
  const [pwError,    setPwError]    = useState<string | null>(null);

  // ── Session info ───────────────────────────────────────────────────────────
  const [showSession, setShowSession] = useState(false);
  const forcedPasswordChange = searchParams?.get('must_change_password') === '1';
  const mustChangePassword = me?.must_change_password || forcedPasswordChange;
  const redirectAfterPasswordChange = searchParams?.get('next') ?? '/';

  // ── Seed form when /me data arrives ──────────────────────────────────────
  useEffect(() => {
    if (!me) return;
    setProfileForm({
      display_name: me.display_name ?? '',
      given_name:   me.given_name   ?? '',
      surname:      me.surname      ?? '',
      email:        me.email        ?? '',
      department:   me.department   ?? '',
      phone:        me.phone        ?? '',
      avatar_color: me.avatar_color ?? pickColorFromName(me.username),
      preferred_lang: (['cs', 'en', 'sk', 'de'].includes(me.preferred_lang ?? '') ? me.preferred_lang : 'cs') as Locale,
    });
  }, [me]);

  useEffect(() => {
    void restoreAuthSession();
  }, []);

  // ── Owned services ────────────────────────────────────────────────────────
  // GET /services returns { items, total, page, limit } — NOT a plain array.
  // Filter by the user's display_name (stored in ServiceRoleAssignment.display_name).
  const ownerParam = me && !mustChangePassword ? encodeURIComponent(me.display_name ?? me.username) : null;
  const { data: ownedSvcResp, isLoading: svcLoading, error: svcError } = useSWR<ServiceListResponse>(
    ownerParam ? `/api/v1/services?owner=${ownerParam}&limit=100` : null,
    apiFetch,
    { revalidateOnFocus: false },
  );
  const ownedServices: ServiceListItem[] = ownedSvcResp?.items ?? [];

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleLogout() {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      clearAuthSession();
    }
    router.replace('/login');
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true); setProfileError(null); setProfileSaved(false);
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          display_name: profileForm.display_name || null,
          given_name:   profileForm.given_name   || null,
          surname:      profileForm.surname       || null,
          email:        profileForm.email         || null,
          department:   profileForm.department    || null,
          phone:        profileForm.phone         || null,
          avatar_color: profileForm.avatar_color  || null,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`${res.status}: ${t}`);
      }
      await mutateMe();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t('user_info.save_failed'));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePreferredLangChange(nextLang: Locale) {
    const previousLang = profileForm.preferred_lang;
    setProfileForm(p => ({ ...p, preferred_lang: nextLang }));
    setLangSaving(true);
    setLangError(null);

    try {
      const res = await fetch('/api/v1/auth/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify({ preferred_lang: nextLang }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`${res.status}: ${t}`);
      }

      let persistedLang: Locale = nextLang;
      try {
        const data = await res.json() as { preferred_lang?: string };
        if (['cs', 'en', 'sk', 'de'].includes(data.preferred_lang ?? '')) {
          persistedLang = data.preferred_lang as Locale;
        }
      } catch {
        // Keep optimistic locale when the response body is not JSON.
      }

      setAuthSnapshotFromUser({
        ...me,
        preferred_lang: persistedLang,
      });
      setLocale(persistedLang);
      void mutateMe().catch(() => undefined);
    } catch (err) {
      setProfileForm(p => ({ ...p, preferred_lang: previousLang }));
      setLangError(err instanceof Error ? err.message : t('user_info.save_failed'));
    } finally {
      setLangSaving(false);
    }
  }

  async function handlePersonaChange(nextPersona: Persona) {
    setPersonaSaving(true);
    setPersonaSaved(false);
    setPersonaError(null);
    try {
      await setPersona(nextPersona);
      setPersonaSaved(true);
      setTimeout(() => setPersonaSaved(false), 2400);
    } catch (err) {
      setPersonaError(err instanceof Error ? err.message : t('user_info.save_failed'));
    } finally {
      setPersonaSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null); setPwSaved(false);
    if (pwForm.next !== pwForm.confirm) {
      setPwError(t('user_info.password_mismatch'));
      return;
    }
    if (pwForm.next.length < 10) {
      setPwError(t('auth.password.errors.too_short'));
      return;
    }
    const hasUpper = /[A-Z]/.test(pwForm.next);
    const hasLower = /[a-z]/.test(pwForm.next);
    const hasDigit = /[0-9]/.test(pwForm.next);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwForm.next);
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      setPwError(t('auth.password.errors.policy'));
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.next }),
      });
      if (!res.ok) {
        const t = await res.text();
        let msg = `${res.status}`;
        try { msg = JSON.parse(t).error ?? msg; } catch { /* raw text */ }
        throw new Error(msg);
      }
      setPwSaved(true);
      setPwForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setPwSaved(false), 3000);
      if (mustChangePassword) {
        router.replace(redirectAfterPasswordChange);
      }
    } catch (err) {
      setPwError(err instanceof Error ? err.message : t('user_info.save_failed'));
    } finally {
      setPwSaving(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const avatarColor   = profileForm.avatar_color || (me ? pickColorFromName(me.username) : 'var(--color-text-secondary)');
  const avatarInitial = (profileForm.given_name || me?.display_name || me?.username || '?')[0].toUpperCase();

  if (meError && !me) {
    return (
      <div className={styles.shell}>
        <h1 className={styles.pageTitle}>{t('user_info.title')}</h1>
        <div className={styles.card}>
          <div className={styles.noToken}>
            {t('user_info.load_failed')} <Link href="/login">{t('user_info.log_in_again')}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <h1 className={styles.pageTitle}>{t('user_info.title')}</h1>

      {/* ── Account card ─────────────────────────────────────────────────── */}
      <section className={styles.card}>
        {mustChangePassword && (
          <div className={styles.infoNote}>
            {t('user_info.first_login_note')}
          </div>
        )}
        {/* Header */}
        <div className={styles.cardHeader}>
          <div className={styles.avatarLg} style={{ background: avatarColor }}>
            {avatarInitial}
          </div>
          <div>
            <div className={styles.displayName}>
              {me?.display_name ?? me?.username ?? '…'}
            </div>
            <div className={styles.emailLine}>{me?.email ?? '—'}</div>
          </div>
          {me?.role && (
            <span className={styles.rolePill} style={{ marginLeft: 'auto' }}>
              {me.role}
            </span>
          )}
        </div>

        {/* ── Profile Edit Form ─────────────────────────────────────── */}
        <form onSubmit={handleProfileSave} noValidate>
          <div className={styles.profileForm}>
            {/* Name row */}
            <div className={styles.formGroup}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('common.given_name')}</label>
                <input
                  className={styles.input}
                  value={profileForm.given_name}
                  onChange={e => setProfileForm(p => ({ ...p, given_name: e.target.value }))}
                  placeholder={t('administration.users.given_name_placeholder')}
                  disabled={!me}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('common.surname')}</label>
                <input
                  className={styles.input}
                  value={profileForm.surname}
                  onChange={e => setProfileForm(p => ({ ...p, surname: e.target.value }))}
                  placeholder={t('administration.users.surname_placeholder')}
                  disabled={!me}
                />
              </div>
            </div>

            {/* Display name + email */}
            <div className={styles.formGroup}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('common.display_name')}</label>
                <input
                  className={styles.input}
                  value={profileForm.display_name}
                  onChange={e => setProfileForm(p => ({ ...p, display_name: e.target.value }))}
                  placeholder={t('administration.users.display_name_placeholder')}
                  disabled={!me}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('common.email')}</label>
                <input
                  type="email"
                  className={styles.input}
                  value={profileForm.email}
                  onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))}
                  placeholder={t('administration.users.email_placeholder')}
                  disabled={!me}
                />
              </div>
            </div>

            <div className={styles.preferencePanel}>
              <div className={styles.preferenceIntro}>
                <h2 className={styles.preferenceTitle}>{t('user_info.preferences_title')}</h2>
                <p className={styles.preferenceDesc}>{t('user_info.preferences_desc')}</p>
              </div>
              <div className={`${styles.field} ${styles.preferenceField}`}>
                <label className={styles.fieldLabel} htmlFor="preferred-language">{t('user_info.language_label')}</label>
                <select
                  id="preferred-language"
                  name="preferred_lang"
                  className={styles.input}
                  value={profileForm.preferred_lang}
                  onChange={e => void handlePreferredLangChange(e.target.value as Locale)}
                  disabled={!me || langSaving}
                >
                  <option value="cs">{t('user_info.language_cs')}</option>
                  <option value="en">{t('user_info.language_en')}</option>
                  <option value="sk">{t('locale.sk')}</option>
                  <option value="de">{t('locale.de')}</option>
                </select>
              </div>
              <div className={`${styles.field} ${styles.preferenceField}`}>
                <label className={styles.fieldLabel} htmlFor="preferred-persona">{t('user_info.persona_label')}</label>
                <select
                  id="preferred-persona"
                  className={styles.input}
                  value={persona}
                  onChange={(event) => void handlePersonaChange(event.target.value as Persona)}
                  disabled={!me || personaSaving}
                >
                  <option value="consumer">{t('persona.consumer')}</option>
                  <option value="service_owner">{t('persona.service_owner')}</option>
                  <option value="admin">{t('persona.admin')}</option>
                </select>
                <p className={styles.fieldHint}>{t('user_info.persona_desc')}</p>
              </div>
            </div>
            {(langError || personaError || personaSaved) && (
              <div className={styles.saveRow}>
                {langError && <span className={styles.saveError}>{langError}</span>}
                {personaError && <span className={styles.saveError}>{personaError}</span>}
                {personaSaved && <span className={styles.saveSuccess}>✓ {t('user_info.preferences_saved')}</span>}
              </div>
            )}

            {/* Department + phone */}
            <div className={styles.formGroup}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('common.department')}</label>
                <input
                  className={styles.input}
                  value={profileForm.department}
                  onChange={e => setProfileForm(p => ({ ...p, department: e.target.value }))}
                  placeholder={t('administration.users.department_placeholder')}
                  disabled={!me}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('user_info.phone_label')}</label>
                <input
                  className={styles.input}
                  value={profileForm.phone}
                  onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+420 123 456 789"
                  disabled={!me}
                />
              </div>
            </div>

            {/* Avatar colour */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>{t('user_info.avatar_color_label')}</label>
              <div className={styles.colorPicker}>
                {PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.colorSwatch} ${profileForm.avatar_color === c ? styles.colorSwatchActive : ''}`}
                    style={{ background: c }}
                    title={c}
                    onClick={() => setProfileForm(p => ({ ...p, avatar_color: c }))}
                  />
                ))}
              </div>
            </div>

            {/* Save row */}
            <div className={styles.saveRow}>
              <button type="submit" className={styles.btnPrimary} disabled={profileSaving || !me}>
                {profileSaving ? t('user_info.saving_profile') : t('user_info.save_profile')}
              </button>
              {profileSaved  && <span className={styles.saveSuccess}>✓ {t('user_info.profile_saved')}</span>}
              {profileError  && <span className={styles.saveError}>{profileError}</span>}
            </div>
          </div>
        </form>

        {/* ── Password Change Form ──────────────────────────────────── */}
        <div className={styles.subsectionTitle}>{t('user_info.password_section_title')}</div>
        <form onSubmit={handlePasswordChange} noValidate>
          <div className={styles.profileForm}>
            <div className={styles.formGroup}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('user_info.current_password_label')}</label>
                <input
                  type="password"
                  className={styles.input}
                  value={pwForm.current}
                  onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                  autoComplete="current-password"
                  disabled={!me}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('user_info.new_password_label')}</label>
                <input
                  type="password"
                  className={styles.input}
                  value={pwForm.next}
                  onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                  autoComplete="new-password"
                  placeholder={t('user_info.password_hint')}
                  disabled={!me}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('user_info.confirm_password_label')}</label>
                <input
                  type="password"
                  className={`${styles.input} ${pwForm.next && pwForm.confirm && pwForm.next !== pwForm.confirm ? styles.inputError : ''}`}
                  value={pwForm.confirm}
                  onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                  autoComplete="new-password"
                  disabled={!me}
                />
              </div>
            </div>
            <div className={styles.saveRow}>
              <button type="submit" className={styles.btnPrimary} disabled={pwSaving || !me}>
                {pwSaving ? t('user_info.changing_password') : t('user_info.change_password')}
              </button>
              {pwSaved  && <span className={styles.saveSuccess}>✓ {t('user_info.password_changed')}</span>}
              {pwError  && <span className={styles.saveError}>{pwError}</span>}
            </div>
          </div>
        </form>

        {/* ── Token info (collapsed) ────────────────────────────────── */}
        <div className={styles.tokenSection}>
          <button className={styles.tokenToggle} type="button" onClick={() => setShowSession(s => !s)}>
            {showSession ? t('user_info.session_info_hide') : t('user_info.session_info_show')}
          </button>
          {showSession && (
            <dl className={styles.tokenDl}>
              <div className={styles.tokenRow}>
                <dt>{t('user_info.session_username')}</dt>
                <dd className={styles.mono}>{me?.username ?? getAuthSnapshot()?.username ?? '—'}</dd>
              </div>
              <div className={styles.tokenRow}>
                <dt>{t('user_info.session_role')}</dt>
                <dd>{me?.role || getAuthSnapshot()?.role ? <span className={styles.rolePill}>{me?.role ?? getAuthSnapshot()?.role}</span> : '—'}</dd>
              </div>
              <div className={styles.tokenRow}>
                <dt>{t('user_info.session_type')}</dt>
                <dd>{t('user_info.session_type_value')}</dd>
              </div>
              <div className={styles.tokenRow}>
                <dt>{t('user_info.session_auth_provider')}</dt>
                <dd>{me?.auth_provider ?? getAuthSnapshot()?.auth_provider ?? '—'}</dd>
              </div>
              <div className={styles.tokenRow}>
                <dt>{t('user_info.session_must_change_password')}</dt>
                <dd>{mustChangePassword ? t('user_info.must_change_password_yes') : t('user_info.must_change_password_no')}</dd>
              </div>
            </dl>
          )}
        </div>

        {/* ── Card footer — Sign out ────────────────────────────────── */}
        <div className={styles.cardFooter}>
          <button className={styles.logoutBtn} type="button" onClick={handleLogout}>
            {t('nav.log_out')}
          </button>
        </div>
      </section>

      {!mustChangePassword && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>{t('user_info.owned_services_title')}</span>
            {ownedSvcResp && (
              <span className={styles.sectionMeta}>{t('user_info.owned_services_count', { count: String(ownedSvcResp.total) })}</span>
            )}
          </div>

          {svcError && (
            <div className={styles.infoNote}>
              {t('user_info.owned_services_load_failed')}
            </div>
          )}

          {!svcError && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('user_info.owned_services_table.id')}</th>
                  <th>{t('user_info.owned_services_table.title')}</th>
                  <th>{t('user_info.owned_services_table.type')}</th>
                  <th>{t('user_info.owned_services_table.status')}</th>
                  <th>{t('user_info.owned_services_table.group')}</th>
                </tr>
              </thead>
              <tbody>
                {svcLoading && (
                  <tr className={styles.emptyRow}><td colSpan={5}>{t('user_info.owned_services_loading')}</td></tr>
                )}
                {!svcLoading && ownedServices.length === 0 && (
                  <tr className={styles.emptyRow}><td colSpan={5}>{t('user_info.owned_services_empty')}</td></tr>
                )}
                {ownedServices.map(svc => (
                  <tr key={svc.service_id}>
                    <td>
                      <Link href={`/services/${svc.service_id}`} className={styles.idLink}>
                        {svc.service_id}
                      </Link>
                    </td>
                    <td>{svc.title}</td>
                    <td className={styles.mono}>{svc.service_type ?? '—'}</td>
                    <td>
                      <span className={styles.statusPill} data-status={svc.service_status ?? 'unknown'}>
                        {svc.service_status ?? '—'}
                      </span>
                    </td>
                    <td>{svc.portfolio_group ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
