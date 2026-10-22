'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useGroup } from '@/features/admin/hooks/useGroups'
import {
  updateGroup,
  setGroupPermissions,
  addGroupMember,
  removeGroupMember,
} from '@/features/admin/api/groups.api'
import { PERMISSION_SECTIONS } from '@/features/admin/constants/permissionResources'
import type { GroupPermission, GroupMember } from '@/features/admin/types/groups.types'
import { useT } from '@/app/i18n/useI18n'
import { formatCountLabel } from '@/app/lib/counts'
import styles from '../groups.module.css'

type Tab = 'info' | 'permissions' | 'members'

export default function GroupDetailPage() {
  const t = useT()
  const params   = useParams<{ id: string }>()
  const groupIdRaw = Number(params?.id ?? '')
  const groupId = Number.isFinite(groupIdRaw) && groupIdRaw > 0 ? groupIdRaw : null
  const { group, isLoading, error, mutate } = useGroup(groupId)

  const [activeTab, setActiveTab] = useState<Tab>('info')

  // ── Info panel state ────────────────────────────────────────────────────
  const [groupName,    setGroupName]    = useState('')
  const [description,  setDescription]  = useState('')
  const [isActive,     setIsActive]     = useState(true)
  const [infoSaving,   setInfoSaving]   = useState(false)
  const [infoMsg,      setInfoMsg]      = useState<{ ok: boolean; text: string } | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect -- U5: editable group form is hydrated from async group detail data. */
  useEffect(() => {
    if (group) {
      setGroupName(group.group_name)
      setDescription(group.description ?? '')
      setIsActive(group.is_active)
    }
  }, [group])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleSaveInfo() {
    if (groupId == null) return
    setInfoSaving(true)
    setInfoMsg(null)
    try {
      await updateGroup(groupId, { group_name: groupName, description, is_active: isActive })
      await mutate()
      setInfoMsg({ ok: true, text: t('administration.groups.saved') })
    } catch (err) {
      setInfoMsg({ ok: false, text: err instanceof Error ? err.message : t('administration.groups.error') })
    } finally {
      setInfoSaving(false)
    }
  }

  // ── Permissions panel state ─────────────────────────────────────────────
  // Set of "scope|permission|resource" keys currently checked
  const [checkedPerms, setCheckedPerms] = useState<Set<string>>(new Set())
  const [permSaving,   setPermSaving]   = useState(false)
  const [permMsg,      setPermMsg]      = useState<{ ok: boolean; text: string } | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect -- U5: permissions checkboxes mirror persisted group permissions before editing. */
  useEffect(() => {
    if (group?.permissions) {
      const keys = group.permissions.map(p => `${p.scope}|${p.permission}|${p.resource}`)
      setCheckedPerms(new Set(keys))
    }
  }, [group])
  /* eslint-enable react-hooks/set-state-in-effect */

  function togglePerm(scope: string, permission: string, resource: string) {
    const key = `${scope}|${permission}|${resource}`
    setCheckedPerms(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAll(scope: string, permission: string, resources: ReadonlyArray<{ key: string }>) {
    setCheckedPerms(prev => {
      const next = new Set(prev)
      resources.forEach(r => next.add(`${scope}|${permission}|${r.key}`))
      return next
    })
  }

  function deselectAll(scope: string, permission: string, resources: ReadonlyArray<{ key: string }>) {
    setCheckedPerms(prev => {
      const next = new Set(prev)
      resources.forEach(r => next.delete(`${scope}|${permission}|${r.key}`))
      return next
    })
  }

  async function handleSavePermissions() {
    if (groupId == null) return
    setPermSaving(true)
    setPermMsg(null)
    try {
      const permissions: GroupPermission[] = Array.from(checkedPerms).map(key => {
        const [scope, permission, resource] = key.split('|') as [GroupPermission['scope'], GroupPermission['permission'], string]
        return { scope, permission, resource }
      })
      await setGroupPermissions(groupId, permissions)
      await mutate()
      setPermMsg({ ok: true, text: t('administration.groups.permissions_saved', { count: String(permissions.length) }) })
    } catch (err) {
      setPermMsg({ ok: false, text: err instanceof Error ? err.message : t('administration.groups.error') })
    } finally {
      setPermSaving(false)
    }
  }

  // ── Members panel state ─────────────────────────────────────────────────
  const [newMemberSub, setNewMemberSub] = useState('')
  const [memberAdding, setMemberAdding] = useState(false)
  const [memberError,  setMemberError]  = useState<string | null>(null)
  const [removingId,   setRemovingId]   = useState<string | null>(null)

  async function handleAddMember() {
    if (groupId == null) return
    if (!newMemberSub.trim()) return
    setMemberAdding(true)
    setMemberError(null)
    try {
      await addGroupMember(groupId, newMemberSub.trim())
      setNewMemberSub('')
      await mutate()
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setMemberAdding(false)
    }
  }

  async function handleRemoveMember(userSub: string) {
    if (groupId == null) return
    if (!confirm(t('administration.groups.remove_member_confirm', { user: userSub }))) return
    setRemovingId(userSub)
    try {
      await removeGroupMember(groupId, userSub)
      await mutate()
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setRemovingId(null)
    }
  }

  // ── Render guards ───────────────────────────────────────────────────────
  if (groupId == null) return (
    <div className={styles.shell}>
      <div className={styles.errorBanner}>{t('administration.groups.invalid_id')}</div>
      <Link href="/administration/groups" className={styles.btnSecondary}>← {t('common.back')}</Link>
    </div>
  )
  if (isLoading) return <div className={styles.shell}><p className={styles.loading}>{t('common.loading')}</p></div>
  if (error || !group) return (
    <div className={styles.shell}>
      <div className={styles.errorBanner}>{error?.message ?? t('administration.groups.not_found')}</div>
      <Link href="/administration/groups" className={styles.btnSecondary}>← {t('common.back')}</Link>
    </div>
  )

  // Group PERMISSION_SECTIONS by scope for rendering
  const scSections  = PERMISSION_SECTIONS.filter(s => s.scope === 'service_catalogue')
  const c3Sections  = PERMISSION_SECTIONS.filter(s => s.scope === 'c3_taxonomy')

  return (
    <div className={styles.shell}>
      <div className={styles.breadcrumb}>
        <Link href="/administration/groups">{t('administration.card.groups.title')}</Link>
        <span>›</span>
        <span>{group.group_name}</span>
      </div>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{group.group_name}</h1>
          <p className={styles.subtitle}>
            <span className={styles.codeBadge}>{group.group_code}</span>
            {' · '}
            <span className={`${styles.activeBadge} ${group.is_active ? styles.badgeActive : styles.badgeInactive}`}>
              {group.is_active ? t('common.active') : t('administration.groups.inactive')}
            </span>
            {' · '}
            {formatCountLabel(group.member_count ?? group.members?.length ?? 0, {
              one: t('administration.groups.member_count.one'),
              few: t('administration.groups.member_count.few'),
              many: t('administration.groups.member_count.many'),
            })}
          </p>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className={styles.tabBar}>
        {(['info', 'permissions', 'members'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'info'        ? t('administration.groups.tab.info')
            : tab === 'permissions' ? t('administration.groups.tab.permissions', { count: String(checkedPerms.size) })
            : t('administration.groups.tab.members', { count: String(group.members?.length ?? 0) })}
          </button>
        ))}
      </div>

      {/* ════ TAB: INFO ════════════════════════════════════════════════════ */}
      {activeTab === 'info' && (
        <div className={styles.infoPanel}>
          {infoMsg && (
            <div className={infoMsg.ok ? styles.successBanner : styles.errorBanner}>
              {infoMsg.text}
            </div>
          )}
          <div className={styles.formGroup}>
            <label>{t('administration.groups.field.code')}</label>
            <input type="text" value={group.group_code} readOnly />
          </div>
          <div className={styles.formGroup}>
            <label>{t('administration.groups.field.name')} *</label>
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder={t('administration.groups.field.name_placeholder')}
            />
          </div>
          <div className={styles.formGroup}>
            <label>{t('administration.groups.field.description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('administration.groups.field.description_placeholder')}
            />
          </div>
          <div className={styles.formGroup}>
            <label>{t('common.status')}</label>
            <div className={styles.toggleRow}>
              <button
                className={`${styles.toggle} ${isActive ? styles.toggleOn : styles.toggleOff}`}
                onClick={() => setIsActive(v => !v)}
                title={isActive ? t('administration.groups.deactivate') : t('administration.groups.activate')}
              />
              <span>{isActive ? t('common.active') : t('administration.groups.inactive')}</span>
            </div>
          </div>
          <button
            className={styles.btnSave}
            onClick={handleSaveInfo}
            disabled={infoSaving || !groupName.trim()}
          >
            {infoSaving ? t('administration.groups.saving') : t('common.save')}
          </button>
        </div>
      )}

      {/* ════ TAB: PERMISSIONS ═════════════════════════════════════════════ */}
      {activeTab === 'permissions' && (
        <div>
          {permMsg && (
            <div className={permMsg.ok ? styles.successBanner : styles.errorBanner}>
              {permMsg.text}
            </div>
          )}

          {/* Service Catalogue */}
          <div className={styles.permScope}>
            <h2 className={styles.permScopeTitle}>{t('administration.groups.scope.service_catalogue')}</h2>
            {scSections.map(section => (
              <PermSection
                key={`${section.scope}-${section.permission}`}
                section={section}
                checkedPerms={checkedPerms}
                onToggle={togglePerm}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
              />
            ))}
          </div>

          {/* C3 Taxonomy */}
          <div className={styles.permScope}>
            <h2 className={styles.permScopeTitle}>{t('administration.groups.scope.c3_taxonomy')}</h2>
            {c3Sections.map(section => (
              <PermSection
                key={`${section.scope}-${section.permission}`}
                section={section}
                checkedPerms={checkedPerms}
                onToggle={togglePerm}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
              />
            ))}
          </div>

          <button
            className={`${styles.btnSave} ${styles.savePermBtn}`}
            onClick={handleSavePermissions}
            disabled={permSaving}
          >
            {permSaving ? t('administration.groups.saving') : t('administration.groups.save_permissions', { count: String(checkedPerms.size) })}
          </button>
        </div>
      )}

      {/* ════ TAB: MEMBERS ═════════════════════════════════════════════════ */}
      {activeTab === 'members' && (
        <div>
          {memberError && <div className={styles.errorBanner}>{memberError}</div>}

          <div className={styles.addMemberRow}>
            <input
              className={styles.addMemberInput}
              type="text"
              placeholder={t('administration.groups.member_placeholder')}
              value={newMemberSub}
              onChange={e => setNewMemberSub(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddMember()}
            />
            <button
              className={styles.btnPrimary}
              onClick={handleAddMember}
              disabled={memberAdding || !newMemberSub.trim()}
            >
              {memberAdding ? '…' : t('administration.groups.add_member')}
            </button>
          </div>

          {(!group.members || group.members.length === 0) ? (
            <p className={styles.emptyState}>{t('administration.groups.members_empty')}</p>
          ) : (
            <table className={styles.membersTable}>
              <thead>
                <tr>
                  <th>{t('administration.groups.members_table.user_sub')}</th>
                  <th>{t('administration.groups.members_table.assigned_at')}</th>
                  <th>{t('administration.groups.members_table.assigned_by')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(group.members as GroupMember[]).map(m => (
                  <tr key={m.user_sub}>
                    <td><code>{m.user_sub}</code></td>
                    <td>{new Date(m.assigned_at).toLocaleString('cs-CZ')}</td>
                    <td>{m.assigned_by ?? '—'}</td>
                    <td>
                      <button
                        className={styles.btnDanger}
                        onClick={() => handleRemoveMember(m.user_sub)}
                        disabled={removingId === m.user_sub}
                      >
                        {removingId === m.user_sub ? '…' : t('common.remove')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-component: PermSection ────────────────────────────────────────────────
interface PermSectionProps {
  section: {
    scope:      string
    permission: string
    permLabel:  string
    resources:  ReadonlyArray<{ key: string; label: string }>
  }
  checkedPerms:  Set<string>
  onToggle:      (scope: string, permission: string, resource: string) => void
  onSelectAll:   (scope: string, permission: string, resources: ReadonlyArray<{ key: string; label: string }>) => void
  onDeselectAll: (scope: string, permission: string, resources: ReadonlyArray<{ key: string; label: string }>) => void
}

function PermSection({ section, checkedPerms, onToggle, onSelectAll, onDeselectAll }: PermSectionProps) {
  const t = useT()
  const { scope, permission, permLabel, resources } = section
  const checkedCount = resources.filter(r => checkedPerms.has(`${scope}|${permission}|${r.key}`)).length

  return (
    <div className={styles.permSection}>
      <div className={styles.permSectionHeader}>
        <span className={styles.permSectionTitle}>
          {permLabel} ({checkedCount}/{resources.length})
        </span>
        <span className={styles.selectAllRow}>
          <button className={styles.selectAllBtn} onClick={() => onSelectAll(scope, permission, resources)}>
            {t('administration.groups.select_all')}
          </button>
          <span style={{ color: 'var(--color-border-default)' }}>|</span>
          <button className={styles.selectAllBtn} onClick={() => onDeselectAll(scope, permission, resources)}>
            {t('administration.groups.deselect_all')}
          </button>
        </span>
      </div>
      <div className={styles.permissionsGrid}>
        {resources.map(r => {
          const key     = `${scope}|${permission}|${r.key}`
          const checked = checkedPerms.has(key)
          return (
            <label key={r.key} className={styles.checkboxItem}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(scope, permission, r.key)}
              />
              {r.label}
            </label>
          )
        })}
      </div>
    </div>
  )
}
