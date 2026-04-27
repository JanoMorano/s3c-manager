'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createGroup } from '@/features/admin/api/groups.api'
import styles from '../groups.module.css'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 50)
}

export default function NewGroupPage() {
  const router = useRouter()
  const [groupName,   setGroupName]   = useState('')
  const [groupCode,   setGroupCode]   = useState('')
  const [description, setDescription] = useState('')
  const [codeManual,  setCodeManual]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  function handleNameChange(val: string) {
    setGroupName(val)
    if (!codeManual) setGroupCode(slugify(val))
  }

  function handleCodeChange(val: string) {
    setCodeManual(true)
    setGroupCode(slugify(val))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!groupCode || !groupName) return
    setSaving(true)
    setError(null)
    try {
      const group = await createGroup({ group_code: groupCode, group_name: groupName, description })
      router.push(`/admin/groups/${group.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při vytváření skupiny')
      setSaving(false)
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.breadcrumb}>
        <Link href="/admin/groups">Group Management</Link>
        <span>›</span>
        <span>New Group</span>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>Create Group</h1>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <form className={styles.infoPanel} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label>Group Name *</label>
          <input
            type="text"
            value={groupName}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Např. IT Operations"
            required
            autoFocus
          />
        </div>
        <div className={styles.formGroup}>
          <label>Group Code *</label>
          <input
            type="text"
            value={groupCode}
            onChange={e => handleCodeChange(e.target.value)}
            placeholder="it_operations"
            required
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Slug, automaticky generovaný z Name. Nelze změnit po uložení.
          </span>
        </div>
        <div className={styles.formGroup}>
          <label>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Volitelný popis skupiny…"
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="submit"
            className={styles.btnSave}
            disabled={saving || !groupCode || !groupName}
          >
            {saving ? 'Vytvářím…' : 'Create Group'}
          </button>
          <Link href="/admin/groups" className={styles.btnSecondary}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
