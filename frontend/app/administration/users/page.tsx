'use client';

import Link from '@/app/components/AppLink';
import { useLocale, useT } from '@/app/i18n/useI18n';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import { ROLE_ACCESS_LABELS, ROLE_LABELS, type AppRole } from '@/features/auth/roles';
import styles from './users.module.css';

const USERS_ENDPOINT = '/api/v1/admin/users';

const ROLE_OPTIONS: Array<{ value: AppRole; label: string; access: string }> = [
  { value: 'viewer', label: ROLE_LABELS.viewer, access: ROLE_ACCESS_LABELS.viewer },
  { value: 'editor', label: ROLE_LABELS.editor, access: ROLE_ACCESS_LABELS.editor },
  { value: 'admin', label: ROLE_LABELS.admin, access: ROLE_ACCESS_LABELS.admin },
]

type AuthProvider = 'local' | 'ad'
type SortKey = 'username' | 'display_name' | 'role' | 'auth_provider' | 'is_active' | 'last_login_at'
type SortDirection = 'asc' | 'desc'

interface AdminUser {
  id: number
  username: string
  display_name: string | null
  email: string | null
  role: AppRole
  role_label: string
  access_label: string
  is_active: boolean
  auth_provider: AuthProvider
  auth_provider_label: string
  external_principal: string | null
  last_login_at: string | null
  last_sso_login_at: string | null
  created_at: string | null
  updated_at: string | null
  given_name: string | null
  surname: string | null
  department: string | null
}

interface UserDraft {
  username: string
  display_name: string
  email: string
  role: AppRole
  auth_provider: AuthProvider
  external_principal: string
  password: string
  is_active: boolean
  given_name: string
  surname: string
  department: string
}

const EMPTY_DRAFT: UserDraft = {
  username: '',
  display_name: '',
  email: '',
  role: 'viewer',
  auth_provider: 'local',
  external_principal: '',
  password: '',
  is_active: true,
  given_name: '',
  surname: '',
  department: '',
}

function formatDate(value: string | null, locale: 'cs' | 'en', neverLabel: string): string {
  if (!value) return neverLabel
  try {
    const dateLocale: Record<'cs' | 'en', string> = {
      cs: 'cs-CZ',
      en: 'en-GB',
    }
    return new Intl.DateTimeFormat(dateLocale[locale], {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function compareValues(left: string | number | boolean, right: string | number | boolean) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

export default function AdministrationUsersPage() {
  const t = useT();
  const locale = useLocale();
  const PROVIDER_OPTIONS = [
    { value: 'local', label: t('administration.users.provider.local.label'), help: t('administration.users.provider.local.help') },
    { value: 'ad', label: t('administration.users.provider.ad.label'), help: t('administration.users.provider.ad.help') },
  ] as const
  const { data, isLoading, error } = useSWR<AdminUser[]>(USERS_ENDPOINT, apiFetch, {
    revalidateOnFocus: false,
  })
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [sortKey, setSortKey] = useState<SortKey>('username')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<UserDraft>(EMPTY_DRAFT)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const editPanelRef = useRef<HTMLDivElement | null>(null)

  function scrollEditorIntoView() {
    window.requestAnimationFrame(() => {
      editPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  useEffect(() => {
    if (editingId === null && draft.username === '') return
    scrollEditorIntoView()
  }, [draft.username, editingId])

  const filteredUsers = useMemo(() => {
    const rows = data ?? []
    const query = deferredSearch.trim().toLowerCase()
    if (!query) return rows

    return rows.filter((user) =>
      [
        user.username,
        user.display_name,
        user.email,
        user.role_label,
        user.auth_provider_label,
        user.external_principal,
        user.given_name,
        user.surname,
        user.department,
      ].some((value) => String(value ?? '').toLowerCase().includes(query))
    )
  }, [data, deferredSearch])

  const sortedUsers = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1
    return [...filteredUsers].sort((left, right) => {
      const leftValue =
        sortKey === 'is_active'
          ? Number(left.is_active)
          : sortKey === 'last_login_at'
            ? new Date(left.last_login_at ?? '1970-01-01T00:00:00Z').getTime()
            : String(left[sortKey] ?? '').toLocaleLowerCase('cs')

      const rightValue =
        sortKey === 'is_active'
          ? Number(right.is_active)
          : sortKey === 'last_login_at'
            ? new Date(right.last_login_at ?? '1970-01-01T00:00:00Z').getTime()
            : String(right[sortKey] ?? '').toLocaleLowerCase('cs')

      const result = compareValues(leftValue, rightValue)
      if (result !== 0) return result * direction
      return left.username.localeCompare(right.username, 'cs') * direction
    })
  }, [filteredUsers, sortDirection, sortKey])

  function beginCreate() {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setSaveError(null)
    setSaveOk(null)
    scrollEditorIntoView()
  }

  function beginEdit(user: AdminUser) {
    setEditingId(user.id)
    setDraft({
      username: user.username,
      display_name: user.display_name ?? '',
      email: user.email ?? '',
      role: user.role,
      auth_provider: user.auth_provider,
      external_principal: user.external_principal ?? '',
      password: '',
      is_active: user.is_active,
      given_name: user.given_name ?? '',
      surname: user.surname ?? '',
      department: user.department ?? '',
    })
    setSaveError(null)
    setSaveOk(null)
    scrollEditorIntoView()
  }

  function resetEditor() {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setSaveError(null)
  }

  function updateDraft<K extends keyof UserDraft>(key: K, value: UserDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(nextKey)
    setSortDirection('asc')
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    setSaveOk(null)

    try {
      const res = await fetch(editingId ? `${USERS_ENDPOINT}/${editingId}` : USERS_ENDPOINT, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(draft),
      })

      const text = await res.text().catch(() => '')
      let payload: { error?: string } | null = null
      if (text) {
        try {
          payload = JSON.parse(text) as { error?: string }
        } catch {
          payload = null
        }
      }

      if (!res.ok) {
        throw new Error(payload?.error ?? text ?? `Uložení selhalo (${res.status})`)
      }

      await globalMutate(USERS_ENDPOINT)
      setEditingId(null)
      setDraft(EMPTY_DRAFT)
      setSaveOk(editingId ? 'Uživatel byl upraven.' : 'Uživatel byl vytvořen.')
    } catch (errorValue: unknown) {
      setSaveError(errorValue instanceof Error ? errorValue.message : 'Uložení selhalo')
    } finally {
      setSaving(false)
    }
  }

  const selectedProvider = PROVIDER_OPTIONS.find((option) => option.value === draft.auth_provider) ?? PROVIDER_OPTIONS[0]
  const neverLabel = t('common.never')

  return (
    <div className={styles.shell}>
      <nav className={styles.breadcrumb}>
        <Link href="/administration">{t('nav.administration')}</Link>
        <span className={styles.sep}>/</span>
        <span>{t('administration.card.users.title')}</span>
      </nav>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('administration.card.users.title')}</h1>
          <p className={styles.pageDesc}>{t('administration.card.users.desc')}</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={beginCreate}>
          {t('administration.users.new_button')}
        </button>
      </div>

      <div className={styles.roleGrid}>
        {ROLE_OPTIONS.map((option) => (
          <article key={option.value} className={styles.roleCard}>
            <div className={styles.roleTitle}>{option.label}</div>
            <div className={styles.roleDesc}>{option.access}</div>
          </article>
        ))}
      </div>

      <section ref={editPanelRef} className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>{editingId ? t('administration.users.edit_title', { id: editingId }) : t('administration.users.new_title')}</div>
            <div className={styles.panelMeta}>
              {selectedProvider.help}
            </div>
          </div>
          <div className={styles.panelActions}>
            <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={saving}>
              {saving ? t('common.loading') : editingId ? t('administration.users.save_changes') : t('administration.users.create_user')}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={resetEditor} disabled={saving}>
              {t('administration.users.cancel')}
            </button>
          </div>
        </div>

        {saveError && <div className={styles.errorBox}>{saveError}</div>}
        {saveOk && <div className={styles.successBox}>{saveOk}</div>}

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.label}>{t('administration.users.username_label')}</span>
            <input
              className={styles.input}
              value={draft.username}
              onChange={(event) => updateDraft('username', event.target.value)}
              placeholder="jnovak"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.display_name')}</span>
            <input
              className={styles.input}
              value={draft.display_name}
              onChange={(event) => updateDraft('display_name', event.target.value)}
              placeholder="Jan Novák"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.role')}</span>
            <select className={styles.select} value={draft.role} onChange={(event) => updateDraft('role', event.target.value as AppRole)}>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.login_type')}</span>
            <select className={styles.select} value={draft.auth_provider} onChange={(event) => updateDraft('auth_provider', event.target.value as AuthProvider)}>
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.email')}</span>
            <input
              className={styles.input}
              value={draft.email}
              onChange={(event) => updateDraft('email', event.target.value)}
              placeholder="jan.novak@firma.local"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.department')}</span>
            <input
              className={styles.input}
              value={draft.department}
              onChange={(event) => updateDraft('department', event.target.value)}
              placeholder="Architecture Office"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.given_name')}</span>
            <input
              className={styles.input}
              value={draft.given_name}
              onChange={(event) => updateDraft('given_name', event.target.value)}
              placeholder="Jan"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('common.surname')}</span>
            <input
              className={styles.input}
              value={draft.surname}
              onChange={(event) => updateDraft('surname', event.target.value)}
              placeholder="Novák"
            />
          </label>

          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span className={styles.label}>{t('administration.users.ad_principal_label')}</span>
            <input
              className={styles.input}
              value={draft.external_principal}
              onChange={(event) => updateDraft('external_principal', event.target.value)}
              placeholder={draft.auth_provider === 'ad' ? 'DOMENA\\jnovak nebo jnovak@firma.local' : 'Pro local účet nechej prázdné'}
              disabled={draft.auth_provider !== 'ad'}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{editingId ? t('administration.users.new_password_optional') : t('common.password')}</span>
            <input
              className={styles.input}
              type="password"
              value={draft.password}
              onChange={(event) => updateDraft('password', event.target.value)}
              placeholder={draft.auth_provider === 'local' ? 'Minimálně 8 znaků' : 'AD účet používá doménové přihlášení'}
              disabled={draft.auth_provider !== 'local'}
            />
          </label>

          <label className={`${styles.field} ${styles.checkboxField}`}>
            <span className={styles.label}>{t('administration.users.account_status')}</span>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(event) => updateDraft('is_active', event.target.checked)}
              />
              <span>{t('administration.users.account_active')}</span>
            </label>
          </label>
        </div>
      </section>

      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div>
            <div className={styles.panelTitle}>{t('administration.users.title')}</div>
            <div className={styles.panelMeta}>
              {t('administration.users.ad_signin_note')}
            </div>
          </div>
          <input
            className={styles.searchInput}
            type="search"
            placeholder={t('administration.users.search_placeholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {isLoading && <div className={styles.state}>{t('administration.users.loading')}</div>}
        {error && <div className={styles.errorBox}>{t('administration.users.load_failed')}</div>}
        {!isLoading && !error && sortedUsers.length === 0 && <div className={styles.state}>{t('administration.users.no_matches')}</div>}

        {!!sortedUsers.length && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th><button type="button" className={styles.sortButton} onClick={() => toggleSort('username')}>{t('common.username')} {sortKey === 'username' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</button></th>
                  <th><button type="button" className={styles.sortButton} onClick={() => toggleSort('display_name')}>{t('common.user')} {sortKey === 'display_name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</button></th>
                  <th><button type="button" className={styles.sortButton} onClick={() => toggleSort('role')}>{t('common.role')} {sortKey === 'role' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</button></th>
                  <th><button type="button" className={styles.sortButton} onClick={() => toggleSort('auth_provider')}>{t('common.login')} {sortKey === 'auth_provider' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</button></th>
                  <th><button type="button" className={styles.sortButton} onClick={() => toggleSort('is_active')}>{t('common.status')} {sortKey === 'is_active' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</button></th>
                  <th><button type="button" className={styles.sortButton} onClick={() => toggleSort('last_login_at')}>{t('common.last_login')} {sortKey === 'last_login_at' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</button></th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr key={user.id}>
                    <td className={styles.monoCell}>{user.username}</td>
                    <td>
                      <div className={styles.stack}>
                        <strong>{user.display_name || `${user.given_name ?? ''} ${user.surname ?? ''}`.trim() || t('common.no_name')}</strong>
                        <span>{user.email || t('common.no_email')}</span>
                        {user.department && <span>{user.department}</span>}
                      </div>
                    </td>
                    <td>
                      <div className={styles.stack}>
                        <span className={styles.rolePill}>{user.role_label}</span>
                        <span>{user.access_label}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.stack}>
                        <span className={styles.providerPill}>{user.auth_provider_label}</span>
                        <span className={styles.monoMuted}>{user.external_principal || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={user.is_active ? styles.statusActive : styles.statusInactive}>
                        {user.is_active ? t('common.active') : t('common.disabled')}
                      </span>
                    </td>
                    <td>
                      <div className={styles.stack}>
                        <span>{formatDate(user.last_login_at, locale, neverLabel)}</span>
                        {user.last_sso_login_at && <span>SSO: {formatDate(user.last_sso_login_at, locale, neverLabel)}</span>}
                      </div>
                    </td>
                    <td>
                      <button type="button" className={styles.rowButton} onClick={() => beginEdit(user)}>
                        {t('common.edit')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
