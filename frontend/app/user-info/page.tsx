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
import { useT } from '@/app/i18n/useI18n';
import useSWR from 'swr';
import styles from './user-info.module.css';
import { clearAuthSession, getAuthSnapshot, restoreAuthSession, setAuthSnapshotFromUser } from '@/features/auth/authStore';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import type { ServiceListResponse, ServiceListItem } from '@/features/services/model/service.types';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/app/i18n/messages';

// ── Avatar colour palette ─────────────────────────────────────────────────────
const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b',
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
  const t = useT();
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
      preferred_lang: me.preferred_lang === 'en' ? 'en' : 'cs',
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
      setProfileError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePreferredLangChange(nextLang: Locale) {
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
        if (data.preferred_lang === 'en') {
          persistedLang = 'en';
        }
      } catch {
        // Keep optimistic locale when the response body is not JSON.
      }

      setAuthSnapshotFromUser({
        ...me,
        preferred_lang: persistedLang,
      });
      await mutateMe();
    } catch (err) {
      setProfileForm(p => ({ ...p, preferred_lang: me?.preferred_lang === 'en' ? 'en' : 'cs' }));
      setLangError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLangSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null); setPwSaved(false);
    if (pwForm.next !== pwForm.confirm) {
      setPwError('Hesla se neshodují');
      return;
    }
    if (pwForm.next.length < 10) {
      setPwError('Nové heslo musí mít alespoň 10 znaků');
      return;
    }
    const hasUpper = /[A-Z]/.test(pwForm.next);
    const hasLower = /[a-z]/.test(pwForm.next);
    const hasDigit = /[0-9]/.test(pwForm.next);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwForm.next);
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      setPwError('Nové heslo musí obsahovat velká písmena, malá písmena, číslice a speciální znak.');
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
      setPwError(err instanceof Error ? err.message : 'Error');
    } finally {
      setPwSaving(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const avatarColor   = profileForm.avatar_color || (me ? pickColorFromName(me.username) : '#64748b');
  const avatarInitial = (profileForm.given_name || me?.display_name || me?.username || '?')[0].toUpperCase();

  if (meError) {
    return (
      <div className={styles.shell}>
        <h1 className={styles.pageTitle}>{t('user_info.title')}</h1>
        <div className={styles.card}>
          <div className={styles.noToken}>
            Could not load profile. <Link href="/login">Log in again</Link>
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
            První přihlášení vyžaduje změnu hesla. Dokončete ji níže před pokračováním do aplikace.
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
                <label className={styles.fieldLabel}>Jméno (given name)</label>
                <input
                  className={styles.input}
                  value={profileForm.given_name}
                  onChange={e => setProfileForm(p => ({ ...p, given_name: e.target.value }))}
                  placeholder="Jan"
                  disabled={!me}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Příjmení (surname)</label>
                <input
                  className={styles.input}
                  value={profileForm.surname}
                  onChange={e => setProfileForm(p => ({ ...p, surname: e.target.value }))}
                  placeholder="Novák"
                  disabled={!me}
                />
              </div>
            </div>

            {/* Display name + email */}
            <div className={styles.formGroup}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Display Name</label>
                <input
                  className={styles.input}
                  value={profileForm.display_name}
                  onChange={e => setProfileForm(p => ({ ...p, display_name: e.target.value }))}
                  placeholder="Jan Novák"
                  disabled={!me}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>E-mail</label>
                <input
                  type="email"
                  className={styles.input}
                  value={profileForm.email}
                  onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="jan.novak@example.com"
                  disabled={!me}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('user_info.language_label')}</label>
                <select
                  name="preferred_lang"
                  className={styles.input}
                  value={profileForm.preferred_lang}
                  onChange={e => void handlePreferredLangChange((e.target.value === 'en' ? 'en' : 'cs') as Locale)}
                  disabled={!me || langSaving}
                >
                  <option value="cs">{t('user_info.language_cs')}</option>
                  <option value="en">{t('user_info.language_en')}</option>
                </select>
              </div>
            </div>
            {langError && (
              <div className={styles.saveRow}>
                <span className={styles.saveError}>{langError}</span>
              </div>
            )}

            {/* Department + phone */}
            <div className={styles.formGroup}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Útvar / Department</label>
                <input
                  className={styles.input}
                  value={profileForm.department}
                  onChange={e => setProfileForm(p => ({ ...p, department: e.target.value }))}
                  placeholder="Infrastruktura"
                  disabled={!me}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Telefon / Phone</label>
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
              <label className={styles.fieldLabel}>Barva avataru</label>
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
                {profileSaving ? 'Ukládám…' : 'Uložit profil'}
              </button>
              {profileSaved  && <span className={styles.saveSuccess}>✓ Profil uložen</span>}
              {profileError  && <span className={styles.saveError}>{profileError}</span>}
            </div>
          </div>
        </form>

        {/* ── Password Change Form ──────────────────────────────────── */}
        <div className={styles.subsectionTitle}>Změna hesla</div>
        <form onSubmit={handlePasswordChange} noValidate>
          <div className={styles.profileForm}>
            <div className={styles.formGroup}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Aktuální heslo</label>
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
                <label className={styles.fieldLabel}>Nové heslo</label>
                <input
                  type="password"
                  className={styles.input}
                  value={pwForm.next}
                  onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                  autoComplete="new-password"
                  placeholder="min. 10 znaků + upper/lower/number/special"
                  disabled={!me}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Potvrzení hesla</label>
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
                {pwSaving ? 'Měním heslo…' : 'Změnit heslo'}
              </button>
              {pwSaved  && <span className={styles.saveSuccess}>✓ Heslo změněno</span>}
              {pwError  && <span className={styles.saveError}>{pwError}</span>}
            </div>
          </div>
        </form>

        {/* ── Token info (collapsed) ────────────────────────────────── */}
        <div className={styles.tokenSection}>
          <button className={styles.tokenToggle} type="button" onClick={() => setShowSession(s => !s)}>
            {showSession ? '▴ Skrýt session info' : '▾ Session info'}
          </button>
          {showSession && (
            <dl className={styles.tokenDl}>
              <div className={styles.tokenRow}>
                <dt>Username</dt>
                <dd className={styles.mono}>{me?.username ?? getAuthSnapshot()?.username ?? '—'}</dd>
              </div>
              <div className={styles.tokenRow}>
                <dt>Role</dt>
                <dd>{me?.role || getAuthSnapshot()?.role ? <span className={styles.rolePill}>{me?.role ?? getAuthSnapshot()?.role}</span> : '—'}</dd>
              </div>
              <div className={styles.tokenRow}>
                <dt>Session</dt>
                <dd>Secure cookies + /api/v1/auth/me restore</dd>
              </div>
              <div className={styles.tokenRow}>
                <dt>Auth provider</dt>
                <dd>{me?.auth_provider ?? getAuthSnapshot()?.auth_provider ?? '—'}</dd>
              </div>
              <div className={styles.tokenRow}>
                <dt>Must change password</dt>
                <dd>{mustChangePassword ? 'Ano' : 'Ne'}</dd>
              </div>
            </dl>
          )}
        </div>

        {/* ── Card footer — Sign out ────────────────────────────────── */}
        <div className={styles.cardFooter}>
          <button className={styles.logoutBtn} type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </section>

      {!mustChangePassword && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Services I Own</span>
            {ownedSvcResp && (
              <span className={styles.sectionMeta}>{ownedSvcResp.total} service(s)</span>
            )}
          </div>

          {svcError && (
            <div className={styles.infoNote}>
              Owned services could not be loaded — the <code>/services?owner=</code> filter
              may not be supported by this backend version.
            </div>
          )}

          {!svcError && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Group</th>
                </tr>
              </thead>
              <tbody>
                {svcLoading && (
                  <tr className={styles.emptyRow}><td colSpan={5}>Loading…</td></tr>
                )}
                {!svcLoading && ownedServices.length === 0 && (
                  <tr className={styles.emptyRow}><td colSpan={5}>No owned services found.</td></tr>
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
