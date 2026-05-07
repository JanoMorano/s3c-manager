'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useGroups } from '@/features/admin/hooks/useGroups'
import { deleteGroup } from '@/features/admin/api/groups.api'
import styles from './groups.module.css'

export default function GroupsListPage() {
  const { groups, isLoading, error, mutate } = useGroups()
  const [deleting, setDeleting] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Smazat skupinu "${name}"? Tato akce odebere i všechny vazby na uživatele.`)) return
    setDeleting(id)
    setDeleteError(null)
    try {
      await deleteGroup(id)
      await mutate()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Chyba při mazání')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Group Management</h1>
          <p className={styles.subtitle}>Skupiny definují přístupová práva ke sloupcům a číselníkům.</p>
        </div>
        <Link href="/administration/groups/new" className={styles.btnPrimary}>
          + New Group
        </Link>
      </div>

      {deleteError && <div className={styles.errorBanner}>{deleteError}</div>}

      {isLoading && <p className={styles.loading}>Načítám skupiny…</p>}
      {error    && <div className={styles.errorBanner}>Chyba načítání: {error.message}</div>}

      {!isLoading && !error && (
        groups.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Žádné skupiny zatím neexistují.</p>
            <Link href="/administration/groups/new" className={styles.btnPrimary}>
              Vytvořit první skupinu
            </Link>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.groupTable}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Members</th>
                  <th>Status</th>
                  <th>Actions</th>
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
                        {g.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        <Link href={`/administration/groups/${g.id}`} className={styles.linkBtn}>
                          Edit
                        </Link>
                        <button
                          className={styles.btnDanger}
                          onClick={() => handleDelete(g.id, g.group_name)}
                          disabled={deleting === g.id}
                        >
                          {deleting === g.id ? '…' : 'Delete'}
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
