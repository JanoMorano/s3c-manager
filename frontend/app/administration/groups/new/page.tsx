'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createGroup } from '@/features/admin/api/groups.api'
import { useT } from '@/app/i18n/useI18n'
import styles from '../groups.module.css'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 50)
}

export default function NewGroupPage() {
  const t = useT()
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
      router.push(`/administration/groups/${group.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('administration.groups.create_failed'))
      setSaving(false)
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.breadcrumb}>
        <Link href="/administration/groups">{t('administration.card.groups.title')}</Link>
        <span>›</span>
        <span>{t('administration.groups.new_button')}</span>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>{t('administration.groups.create_title')}</h1>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <form className={styles.infoPanel} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label>{t('administration.groups.field.name')} *</label>
          <input
            type="text"
            value={groupName}
            onChange={e => handleNameChange(e.target.value)}
            placeholder={t('administration.groups.field.name_placeholder')}
            required
            autoFocus
          />
        </div>
        <div className={styles.formGroup}>
          <label>{t('administration.groups.field.code')} *</label>
          <input
            type="text"
            value={groupCode}
            onChange={e => handleCodeChange(e.target.value)}
            placeholder="it_operations"
            required
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {t('administration.groups.field.code_hint')}
          </span>
        </div>
        <div className={styles.formGroup}>
          <label>{t('administration.groups.field.description')}</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('administration.groups.field.description_placeholder')}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="submit"
            className={styles.btnSave}
            disabled={saving || !groupCode || !groupName}
          >
            {saving ? t('administration.groups.creating') : t('administration.groups.create_title')}
          </button>
          <Link href="/administration/groups" className={styles.btnSecondary}>
            {t('common.cancel')}
          </Link>
        </div>
      </form>
    </div>
  )
}
