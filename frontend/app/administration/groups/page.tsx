'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useGroups } from '@/features/admin/hooks/useGroups'
import { deleteGroup } from '@/features/admin/api/groups.api'
import { useT } from '@/app/i18n/useI18n'
import styles from './groups.module.css'

export default function GroupsListPage() {
  const t = useT()
  const { groups, isLoading, error, mutate } = useGroups()
  const [deleting, setDeleting] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete(id: number, name: string) {
    if (!confirm(t('administration.groups.delete_confirm', { name }))) return
    setDeleting(id)
    setDeleteError(null)
    try {
      await deleteGroup(id)
      await mutate()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('administration.groups.delete_failed'))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('administration.card.groups.title')}</h1>
          <p className={styles.subtitle}>{t('administration.groups.subtitle')}</p>
        </div>
        <Link href="/administration/groups/new" className={styles.btnPrimary}>
          + {t('administration.groups.new_button')}
        </Link>
      </div>

      {deleteError && <div className={styles.errorBanner}>{deleteError}</div>}

      {isLoading && <p className={styles.loading}>{t('administration.groups.loading')}</p>}
      {error    && <div className={styles.errorBanner}>{t('administration.groups.load_failed', { message: error.message })}</div>}

      {!isLoading && !error && (
        groups.length === 0 ? (
          <div className={styles.emptyState}>
            <p>{t('administration.groups.empty')}</p>
            <Link href="/administration/groups/new" className={styles.btnPrimary}>
              {t('administration.groups.create_first')}
            </Link>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.groupTable}>
              <thead>
                <tr>
                  <th>{t('administration.groups.table.code')}</th>
                  <th>{t('administration.groups.table.name')}</th>
                  <th>{t('administration.groups.table.members')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id}>
                    <td><span className={styles.codeBadge}>{g.group_code}</span></td>
                    <td>{g.group_name}</td>
                    <td>{g.member_count ?? 0}</td>
                    <td>
                      <span className={`${styles.activeBadge} ${g.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                        {g.is_active ? t('common.active') : t('administration.groups.inactive')}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        <Link href={`/administration/groups/${g.id}`} className={styles.linkBtn}>
                          {t('common.edit')}
                        </Link>
                        <button
                          className={styles.btnDanger}
                          onClick={() => handleDelete(g.id, g.group_name)}
                          disabled={deleting === g.id}
                        >
                          {deleting === g.id ? '…' : t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
