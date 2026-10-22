'use client';

import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import {
  C3EntityWorkspace,
  CodeEditor,
  EditorSubNav,
  FormSection,
  StickySaveBar,
  type EditorSubNavSection,
  type SaveState,
} from '@/app/components/layout-v2';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import { CapabilityLinksPanel } from '@/features/c3/components/CapabilityLinksPanel';
import { getAuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { useLocale, useT } from '@/app/i18n/useI18n';
import { resolveCountForm } from '@/app/lib/counts';
import { formatCapabilityTimestamp, sortCapabilityParentItems } from '../locale-utils';
import styles from '../../../app/admin/c3/c3.module.css';
import editorStyles from '../../../app/services/[id]/edit/editor.module.css';
import detailStyles from '../../../app/services/[id]/detail.module.css';

const BASE = '/api/v1/taxonomy';

interface C3Type { code: string; name: string }
interface C3ListItem { uuid: string; external_id: string | null; title: string; item_type?: string | null }

interface C3Item {
  id: number;
  uuid: string;
  application: string | null;
  title: string;
  description: string | null;
  external_id: string | null;
  source_external_id: string | null;
  data_qualifier: string | null;
  data_source: string | null;
  order_num: number | null;
  level_num: number | null;
  ss_overall_status: string | null;
  ss_baseline_status: string | null;
  item_status: string | null;
  source_description: string | null;
  revised_description: string | null;
  synced_at: string | null;
  modification_date: string | null;
  revised: string | null;
  abbreviation: string | null;
  synonym: string | null;
  script_raw: string | null;
  datasets_raw: string | null;
  standards_raw: string | null;
  references_raw: string | null;
  provenance_raw: string | null;
  item_type: string | null;
  parent_uuid: string | null;
  parent_code: string | null;
  parent_title?: string | null;
}

type FormState = Omit<C3Item, 'id' | 'uuid' | 'synced_at' | 'modification_date' | 'parent_title' | 'source_external_id' | 'level_num'>;

interface Props {
  params?: Promise<{ uuid: string }>;
  uuid?: string;
  mode: 'view' | 'edit';
}

function itemToForm(item: C3Item): FormState {
  return {
    title:              item.title,
    application:        item.application        ?? '',
    item_status:        item.item_status         ?? '',
    description:        item.description         ?? '',
    external_id:        item.external_id         ?? '',
    data_qualifier:     item.data_qualifier      ?? '',
    data_source:        item.data_source         ?? '',
    order_num:          item.order_num,
    ss_overall_status:  item.ss_overall_status   ?? '',
    ss_baseline_status: item.ss_baseline_status  ?? '',
    source_description: item.source_description  ?? '',
    revised_description:item.revised_description ?? '',
    revised:            item.revised             ?? '',
    abbreviation:       item.abbreviation        ?? '',
    synonym:            item.synonym             ?? '',
    script_raw:         item.script_raw          ?? '',
    datasets_raw:       item.datasets_raw        ?? '',
    standards_raw:      item.standards_raw       ?? '',
    references_raw:     item.references_raw      ?? '',
    provenance_raw:     item.provenance_raw      ?? '',
    item_type:          item.item_type           ?? '',
    parent_uuid:        item.parent_uuid         ?? '',
    parent_code:        item.parent_code         ?? '',
  };
}

function ReadonlyField({ label, value, mono = false }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  const text = value == null || value === '' ? '—' : String(value);
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={mono ? styles.fieldMonoValue : styles.fieldValue}>{text}</div>
    </div>
  );
}

function ReadonlyArea({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.fieldTextareaValue}>{value?.trim() ? value : '—'}</div>
    </div>
  );
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function rawLanguage(value: string | null | undefined) {
  const text = String(value ?? '').trim();
  return text.startsWith('{') || text.startsWith('[') ? 'json' : 'plaintext';
}

export function CapabilityDetailPage({ params, uuid: initialUuid, mode }: Props) {
  const resolvedParams = params ? use(params) : null;
  const uuid = initialUuid ?? resolvedParams?.uuid ?? '';
  const isEdit = mode === 'edit';
  const locale = useLocale();
  const t = useT();
  const [role]                    = useState<string | null>(() => getAuthSnapshot()?.role ?? null);
  const [form, setForm]           = useState<FormState | null>(null);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved]         = useState(false);
  const [isDirty, setIsDirty]     = useState(false);

  const canEdit = hasRoleAccess(role, 'editor');
  const isAdmin = hasRoleAccess(role, 'admin');

  const { data: item, isLoading, error } = useSWR<C3Item>(
    `${BASE}/c3/${encodeURIComponent(uuid)}`,
    apiFetch,
    { revalidateOnFocus: false },
  );
  const { data: c3Types }    = useSWR<C3Type[]>(isEdit ? `${BASE}/c3/types`    : null, apiFetch, { revalidateOnFocus: false });
  const { data: c3Statuses } = useSWR<string[]>(isEdit ? `${BASE}/c3/statuses` : null, apiFetch, { revalidateOnFocus: false });
  const { data: c3AllItems } = useSWR<C3ListItem[]>(`${BASE}/c3`, apiFetch, { revalidateOnFocus: false });

  // eslint-disable-next-line react-hooks/set-state-in-effect -- U5: edit form hydrates from async C3 item data before user changes it.
  useEffect(() => { if (isEdit && item && !form) setForm(itemToForm(item)); }, [form, isEdit, item]);

  // Mark form dirty on every field change
  const set = useCallback((key: keyof FormState, value: string | number | null) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setIsDirty(true);
  }, []);

  const parentItem = useMemo(
    () => (c3AllItems ?? []).find((entry) => entry.uuid === item?.parent_uuid) ?? null,
    [c3AllItems, item?.parent_uuid],
  );
  const sortedParentItems = useMemo(
    () => sortCapabilityParentItems(locale, c3AllItems ?? [], uuid),
    [c3AllItems, locale, uuid],
  );

  const validationIssues = useMemo(() => {
    const source = isEdit ? form : item;
    if (!source) return [];
    const externalId = isEdit ? source.external_id : item?.external_id;
    return [
      !String(source.title ?? '').trim() ? t('capability_detail.c3.validation.title_required') : null,
      !String(source.item_type ?? '').trim() ? t('capability_detail.c3.validation.item_type_missing') : null,
      !String(externalId ?? '').trim() ? t('capability_detail.c3.validation.external_id_missing') : null,
      item?.level_num && item.level_num > 1 && !String(source.parent_uuid ?? source.parent_code ?? '').trim()
        ? t('capability_detail.c3.validation.parent_missing') : null,
    ].filter(Boolean) as string[];
  }, [form, isEdit, item, t]);

  // ── Save / discard ────────────────────────────────────────────────────
  async function doSave() {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(form)) {
        body[key] = value === '' || value === null ? null : value;
      }
      const res = await fetch(`${BASE}/c3/${encodeURIComponent(uuid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || t('capability_detail.c3.save_failed'));
      }
      await Promise.all([
        globalMutate(`${BASE}/c3/${encodeURIComponent(uuid)}`),
        globalMutate(`${BASE}/c3`),
      ]);
      setSaved(true);
      setIsDirty(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : t('capability_detail.c3.save_error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    await doSave();
  }

  function handleReset() {
    if (item) setForm(itemToForm(item));
    setSaveError(null);
    setSaved(false);
    setIsDirty(false);
  }

  // ── Guards ────────────────────────────────────────────────────────────
  if (isLoading) return <div className={editorStyles.state}>{t('common.loading')}</div>;
  if (error)     return <div className={editorStyles.state}>{t('capability_detail.c3.load_error', { message: error.message })}</div>;
  if (!item)     return null;
  if (isEdit && !form) return <div className={editorStyles.state}>{t('capability_detail.c3.loading_form')}</div>;

  const displayCode  = item.external_id ?? item.uuid;
  const editForm     = form ?? itemToForm(item);
  const parentDisplay = parentItem
    ? `${item.parent_code ?? parentItem.external_id ?? (isAdmin ? parentItem.uuid : parentItem.title)} — ${parentItem.title}`
    : item.parent_code;

  const saveState: SaveState = saving ? 'saving' : saved ? 'saved' : saveError ? 'error' : isDirty ? 'dirty' : 'clean';

  const editorSections: EditorSubNavSection[] = [
    { id: 'classification', label: t('capability_detail.c3.section.classification') },
    { id: 'identity',       label: t('capability_detail.c3.section.identity') },
    { id: 'description',    label: t('capability_detail.c3.section.description') },
    { id: 'source',         label: t('capability_detail.c3.section.source') },
    { id: 'links',          label: t('capability_detail.c3.section.links_nav'), badge: undefined },
    { id: 'raw',            label: t('capability_detail.c3.section.raw_nav') },
  ];

  return (
    <>
      {/* ── PageHeader (spec v2 §8) ───────────────────────────────────── */}
      <PageHeader
        title={item.title}
        purpose={t('capability_detail.c3.purpose', { type: item.item_type ?? 'CP', code: displayCode })}
        chips={[
          { label: isEdit ? t('capability_detail.c3.mode_edit') : t('capability_detail.c3.mode_view'), tone: isEdit ? 'warn' : 'neutral' },
          { label: item.item_status ?? t('capability_detail.c3.status_unknown'), tone: 'neutral' },
          ...(validationIssues.length > 0
            ? [{ label: t(resolveCountForm(validationIssues.length, { one: 'capability_detail.c3.error_count.one', few: 'capability_detail.c3.error_count.few', many: 'capability_detail.c3.error_count.many' }), { count: validationIssues.length }), tone: 'bad' as const }]
            : [{ label: t('capability_detail.c3.valid'), tone: 'ok' as const }]),
        ]}
        primaryAction={
          isEdit
            ? { label: t('capability_detail.c3.preview'), href: `/c3/${encodeURIComponent(uuid)}` }
            : canEdit
              ? { label: t('common.edit'), href: `/c3/${encodeURIComponent(uuid)}/edit` }
              : undefined
        }
      />

      <C3EntityWorkspace className={editorStyles.shell}>
        {/* ── Summary strip ─────────────────────────────────────────── */}
        <div className={detailStyles.summaryStrip}>
          <div className={detailStyles.summaryItem}>
            <span className={detailStyles.summaryLabel}>{t('capability_detail.c3.field.external_id')}</span>
            <span className={detailStyles.summaryValue}>{displayCode}</span>
          </div>
          {isAdmin && (
            <div className={detailStyles.summaryItem}>
              <span className={detailStyles.summaryLabel}>UUID</span>
              <span className={detailStyles.summaryValue}>{item.uuid}</span>
            </div>
          )}
          <div className={detailStyles.summaryItem}>
            <span className={detailStyles.summaryLabel}>{t('capability_detail.c3.field.parent')}</span>
            <span className={detailStyles.summaryValue}>{parentItem?.title ?? item.parent_title ?? item.parent_code ?? '—'}</span>
          </div>
          <div className={detailStyles.summaryItem}>
            <span className={detailStyles.summaryLabel}>{t('capability_detail.c3.field.modified')}</span>
            <span className={detailStyles.summaryValue}>{formatCapabilityTimestamp(locale, item.modification_date)}</span>
          </div>
        </div>

        {/* ── EditorSubNav + content (spec v2 §8) ──────────────────── */}
        <div className={editorStyles.editorBody}>
          <EditorSubNav
            title={t('capability_detail.c3.editor_title')}
            summary={t('capability_detail.c3.editor_summary')}
            sections={editorSections}
            onSelect={(id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />

          <div className={editorStyles.formArea}>
            {isEdit ? (
              <form id="c3-detail-form" onSubmit={handleSave}>

                {/* 0. Classification & hierarchy */}
                <FormSection id="classification" title={t('capability_detail.c3.section.classification')}>
                  <div className={styles.editFieldGrid}>
                    <FieldBlock label={t('capability_detail.c3.field.item_type')}>
                      <select className={styles.editInput} value={editForm.item_type ?? ''} onChange={(e) => set('item_type', e.target.value)}>
                        <option value="">{t('capability_detail.c3.option_unset')}</option>
                        {(c3Types ?? []).map((type) => (
                          <option key={type.code} value={type.code}>{type.code}</option>
                        ))}
                      </select>
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.parent_select')}>
                      <select className={styles.editInput} value={editForm.parent_uuid ?? ''} onChange={(e) => set('parent_uuid', e.target.value)}>
                        <option value="">{t('capability_detail.c3.option_root')}</option>
                        {sortedParentItems.map((entry) => (
                          <option key={entry.uuid} value={entry.uuid}>
                            {entry.external_id ? `[${entry.external_id}] ` : ''}{entry.title}
                          </option>
                        ))}
                      </select>
                    </FieldBlock>
                  </div>
                </FormSection>

                {/* 1. Identification */}
                <FormSection id="identity" title={t('capability_detail.c3.section.identity')}>
                  <div className={styles.editFieldGrid}>
                    <FieldBlock label={t('capability_detail.c3.field.title_required')}>
                      <input className={styles.editInput} required value={editForm.title} onChange={(e) => set('title', e.target.value)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.application')}>
                      <input className={styles.editInput} value={editForm.application ?? ''} onChange={(e) => set('application', e.target.value)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.item_status')}>
                      <select className={styles.editInput} value={editForm.item_status ?? ''} onChange={(e) => set('item_status', e.target.value)}>
                        <option value="">{t('capability_detail.c3.option_unset')}</option>
                        {(c3Statuses ?? []).map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.external_id')}>
                      <input className={styles.editInput} value={editForm.external_id ?? ''} onChange={(e) => set('external_id', e.target.value)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.order')}>
                      <input className={styles.editInput} type="number" value={editForm.order_num ?? ''} onChange={(e) => set('order_num', e.target.value ? parseInt(e.target.value, 10) : null)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.abbreviation')}>
                      <input className={styles.editInput} value={editForm.abbreviation ?? ''} onChange={(e) => set('abbreviation', e.target.value)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.synonym')}>
                      <input className={styles.editInput} value={editForm.synonym ?? ''} onChange={(e) => set('synonym', e.target.value)} />
                    </FieldBlock>
                  </div>
                </FormSection>

                {/* 2. Description */}
                <FormSection id="description" title={t('capability_detail.c3.section.description')}>
                  <div className={styles.editFieldStack}>
                    <FieldBlock label={t('capability_detail.c3.field.description')}>
                      <textarea className={styles.editTextarea} rows={4} value={editForm.description ?? ''} onChange={(e) => set('description', e.target.value)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.source_description')}>
                      <textarea className={styles.editTextarea} rows={3} value={editForm.source_description ?? ''} onChange={(e) => set('source_description', e.target.value)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.revised_description')}>
                      <textarea className={styles.editTextarea} rows={3} value={editForm.revised_description ?? ''} onChange={(e) => set('revised_description', e.target.value)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.revised_note')}>
                      <input className={styles.editInput} value={editForm.revised ?? ''} onChange={(e) => set('revised', e.target.value)} />
                    </FieldBlock>
                  </div>
                </FormSection>

                {/* 3. Source & data quality */}
                <FormSection id="source" title={t('capability_detail.c3.section.source')}>
                  <div className={styles.editFieldGrid}>
                    <FieldBlock label={t('capability_detail.c3.field.data_qualifier')}>
                      <input className={styles.editInput} value={editForm.data_qualifier ?? ''} onChange={(e) => set('data_qualifier', e.target.value)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.data_source')}>
                      <input className={styles.editInput} value={editForm.data_source ?? ''} onChange={(e) => set('data_source', e.target.value)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.ss_overall_status')}>
                      <input className={styles.editInput} value={editForm.ss_overall_status ?? ''} onChange={(e) => set('ss_overall_status', e.target.value)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.ss_baseline_status')}>
                      <input className={styles.editInput} value={editForm.ss_baseline_status ?? ''} onChange={(e) => set('ss_baseline_status', e.target.value)} />
                    </FieldBlock>
                  </div>
                </FormSection>

                {/* 4. Capability links & completeness */}
                <FormSection id="links" title={t('capability_detail.c3.section.links')}>
                  <CapabilityLinksPanel capabilityUuid={uuid} />
                </FormSection>

                {/* 5. Raw JSON / text */}
                <FormSection id="raw" title={t('capability_detail.c3.section.raw')}>
                  <div className={styles.editFieldStack}>
                    <FieldBlock label={t('capability_detail.c3.field.script_raw')}>
                      <CodeEditor label={t('capability_detail.c3.field.script_raw')} language={rawLanguage(editForm.script_raw)} rows={5} value={editForm.script_raw ?? ''} onValueChange={(v) => set('script_raw', v)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.datasets_raw')}>
                      <CodeEditor label={t('capability_detail.c3.field.datasets_raw')} language={rawLanguage(editForm.datasets_raw)} rows={5} value={editForm.datasets_raw ?? ''} onValueChange={(v) => set('datasets_raw', v)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.standards_raw')}>
                      <CodeEditor label={t('capability_detail.c3.field.standards_raw')} language={rawLanguage(editForm.standards_raw)} rows={5} value={editForm.standards_raw ?? ''} onValueChange={(v) => set('standards_raw', v)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.references_raw')}>
                      <CodeEditor label={t('capability_detail.c3.field.references_raw')} language={rawLanguage(editForm.references_raw)} rows={5} value={editForm.references_raw ?? ''} onValueChange={(v) => set('references_raw', v)} />
                    </FieldBlock>
                    <FieldBlock label={t('capability_detail.c3.field.provenance_raw')}>
                      <CodeEditor label={t('capability_detail.c3.field.provenance_raw')} language={rawLanguage(editForm.provenance_raw)} rows={5} value={editForm.provenance_raw ?? ''} onValueChange={(v) => set('provenance_raw', v)} />
                    </FieldBlock>
                  </div>
                </FormSection>

              </form>
            ) : (
              /* ── Read-only view ────────────────────────────────────── */
              <div>
                <FormSection id="classification" title={t('capability_detail.c3.section.classification')}>
                  <div className={styles.editFieldGrid}>
                    <ReadonlyField label={t('capability_detail.c3.field.item_type')}          value={item.item_type} />
                    <ReadonlyField label={t('capability_detail.c3.field.application')} value={item.application} />
                    <ReadonlyField label={t('capability_detail.c3.field.level')}              value={item.level_num} />
                    <ReadonlyField label={t('capability_detail.c3.field.item_status')}        value={item.item_status} />
                    <ReadonlyField label={t('capability_detail.c3.field.parent_capability')}  value={parentDisplay} />
                    {isAdmin && <ReadonlyField label={t('capability_detail.c3.field.parent_uuid')} value={item.parent_uuid} mono />}
                  </div>
                </FormSection>

                <FormSection id="identity" title={t('capability_detail.c3.section.identity')}>
                  <div className={styles.editFieldGrid}>
                    {isAdmin && <ReadonlyField label="UUID"           value={item.uuid} mono />}
                    <ReadonlyField label={t('capability_detail.c3.field.page_external_id')}         value={item.external_id} mono />
                    <ReadonlyField label={t('capability_detail.c3.field.source_external_id')}         value={item.source_external_id} mono />
                    <ReadonlyField label={t('capability_detail.c3.field.order')}                      value={item.order_num} />
                    <ReadonlyField label={t('capability_detail.c3.field.abbreviation')}               value={item.abbreviation} />
                    <ReadonlyField label={t('capability_detail.c3.field.synonym')}                    value={item.synonym} />
                  </div>
                </FormSection>

                <FormSection id="description" title={t('capability_detail.c3.section.description')}>
                  <div className={styles.editFieldStack}>
                    <ReadonlyArea label={t('capability_detail.c3.field.description')}         value={item.description} />
                    <ReadonlyArea label={t('capability_detail.c3.field.source_description')}  value={item.source_description} />
                    <ReadonlyArea label={t('capability_detail.c3.field.revised_description')} value={item.revised_description} />
                    <ReadonlyField label={t('capability_detail.c3.field.revised')}            value={item.revised} />
                  </div>
                </FormSection>

                <FormSection id="source" title={t('capability_detail.c3.section.source')}>
                  <div className={styles.editFieldGrid}>
                    <ReadonlyField label={t('capability_detail.c3.field.data_qualifier')}     value={item.data_qualifier} />
                    <ReadonlyField label={t('capability_detail.c3.field.data_source')}        value={item.data_source} />
                    <ReadonlyField label={t('capability_detail.c3.field.ss_overall_status')}  value={item.ss_overall_status} />
                    <ReadonlyField label={t('capability_detail.c3.field.ss_baseline_status')} value={item.ss_baseline_status} />
                    <ReadonlyField label={t('capability_detail.c3.field.modification_date')}  value={formatCapabilityTimestamp(locale, item.modification_date)} />
                    <ReadonlyField label={t('capability_detail.c3.field.synced_at')}          value={formatCapabilityTimestamp(locale, item.synced_at)} />
                  </div>
                </FormSection>

                <FormSection id="links" title={t('capability_detail.c3.section.links')}>
                  <CapabilityLinksPanel capabilityUuid={uuid} readOnly />
                </FormSection>

                <FormSection id="raw" title={t('capability_detail.c3.section.raw')}>
                  <div className={styles.editFieldStack}>
                    <ReadonlyArea label={t('capability_detail.c3.field.script_raw')}     value={item.script_raw} />
                    <ReadonlyArea label={t('capability_detail.c3.field.datasets_raw')}   value={item.datasets_raw} />
                    <ReadonlyArea label={t('capability_detail.c3.field.standards_raw')}  value={item.standards_raw} />
                    <ReadonlyArea label={t('capability_detail.c3.field.references_raw')} value={item.references_raw} />
                    <ReadonlyArea label={t('capability_detail.c3.field.provenance_raw')} value={item.provenance_raw} />
                  </div>
                </FormSection>
              </div>
            )}
          </div>

          {/* ── Right rail: validation only ────────────────────────── */}
          <aside className={editorStyles.rail}>
            <div className={editorStyles.railCard}>
              <div className={editorStyles.railTitle}>{t('capability_detail.c3.validation_title')}</div>
              {validationIssues.length > 0 ? (
                validationIssues.map((issue) => (
                  <div key={issue} className={editorStyles.validationError}>{issue}</div>
                ))
              ) : (
                <div className={editorStyles.validOk}>{t('capability_detail.c3.no_errors')}</div>
              )}
            </div>
            {!isEdit && canEdit && (
              <div className={editorStyles.railCard}>
                <Link href={`/c3/${encodeURIComponent(uuid)}/edit`} className={detailStyles.editBtn}>{t('common.edit')}</Link>
              </div>
            )}
          </aside>
        </div>
      </C3EntityWorkspace>

      {/* ── StickySaveBar — only in edit mode (spec v2 §8) ──────────────── */}
      {isEdit && (
        <StickySaveBar
          state={saveState}
          message={saveError ?? undefined}
          primaryLabel={t('layout.save_bar.save_changes')}
          secondaryLabel={t('layout.save_bar.discard')}
          disabled={!isDirty || validationIssues.length > 0}
          onSave={() => void doSave()}
          onDiscard={handleReset}
        />
      )}
    </>
  );
}
