'use client';

import Link from '@/app/components/AppLink';
import { use, useEffect, useMemo, useState, type ReactNode } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import adminStyles from '../../../app/admin/admin.module.css';
import styles from '../../../app/admin/c3/c3.module.css';
import editorStyles from '../../../app/services/[id]/edit/editor.module.css';
import detailStyles from '../../../app/services/[id]/detail.module.css';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import { CapabilityLinksPanel } from '@/features/c3/components/CapabilityLinksPanel';
import { getAuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { useLocale } from '@/app/i18n/useI18n';
import { formatCapabilityTimestamp, sortCapabilityParentItems } from '../locale-utils';

const BASE = '/api/v1/taxonomy';

interface C3Type {
  code: string;
  name: string;
}

interface C3ListItem {
  uuid: string;
  external_id: string | null;
  title: string;
  item_type?: string | null;
}

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
    title: item.title,
    application: item.application ?? '',
    item_status: item.item_status ?? '',
    description: item.description ?? '',
    external_id: item.external_id ?? '',
    data_qualifier: item.data_qualifier ?? '',
    data_source: item.data_source ?? '',
    order_num: item.order_num,
    ss_overall_status: item.ss_overall_status ?? '',
    ss_baseline_status: item.ss_baseline_status ?? '',
    source_description: item.source_description ?? '',
    revised_description: item.revised_description ?? '',
    revised: item.revised ?? '',
    abbreviation: item.abbreviation ?? '',
    synonym: item.synonym ?? '',
    script_raw: item.script_raw ?? '',
    datasets_raw: item.datasets_raw ?? '',
    standards_raw: item.standards_raw ?? '',
    references_raw: item.references_raw ?? '',
    provenance_raw: item.provenance_raw ?? '',
    item_type: item.item_type ?? '',
    parent_uuid: item.parent_uuid ?? '',
    parent_code: item.parent_code ?? '',
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

export function CapabilityDetailPage({ params, uuid: initialUuid, mode }: Props) {
  const resolvedParams = params ? use(params) : null;
  const uuid = initialUuid ?? resolvedParams?.uuid ?? '';
  const isEdit = mode === 'edit';
  const locale = useLocale();
  const [role, setRole] = useState<string | null>(null);
  const canEdit = hasRoleAccess(role, 'editor');
  const isAdmin = hasRoleAccess(role, 'admin');

  const { data: item, isLoading, error } = useSWR<C3Item>(
    `${BASE}/c3/${encodeURIComponent(uuid)}`,
    apiFetch,
    { revalidateOnFocus: false },
  );
  const { data: c3Types } = useSWR<C3Type[]>(
    isEdit ? `${BASE}/c3/types` : null,
    apiFetch,
    { revalidateOnFocus: false },
  );
  const { data: c3Statuses } = useSWR<string[]>(
    isEdit ? `${BASE}/c3/statuses` : null,
    apiFetch,
    { revalidateOnFocus: false },
  );
  const { data: c3AllItems } = useSWR<C3ListItem[]>(`${BASE}/c3`, apiFetch, { revalidateOnFocus: false });

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isEdit && item && !form) setForm(itemToForm(item));
  }, [form, isEdit, item]);

  useEffect(() => {
    setRole(getAuthSnapshot()?.role ?? null);
  }, []);

  const set = (key: keyof FormState, value: string | number | null) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const parentItem = useMemo(() => {
    if (!item) return null;
    return (c3AllItems ?? []).find((entry) => entry.uuid === item.parent_uuid) ?? null;
  }, [c3AllItems, item]);

  const sortedParentItems = useMemo(
    () => sortCapabilityParentItems(locale, c3AllItems ?? [], uuid),
    [c3AllItems, locale, uuid],
  );

  const validationIssues = useMemo(() => {
    const source = isEdit ? form : item;
    if (!source) return [];
    const externalId = isEdit ? source.external_id : item?.external_id;
    return [
      !String(source.title ?? '').trim() ? 'Title je povinný.' : null,
      !String(source.item_type ?? '').trim() ? 'Item Type by měl být vyplněný.' : null,
      !String(externalId ?? '').trim() ? 'External ID / Page zatím není vyplněné.' : null,
      item?.level_num && item.level_num > 1 && !String(source.parent_uuid ?? source.parent_code ?? '').trim()
        ? 'Capability nad kořenem by měla mít vyplněný Parent.'
        : null,
    ].filter(Boolean) as string[];
  }, [form, isEdit, item]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
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
        throw new Error(text || 'Uložení selhalo');
      }
      await Promise.all([
        globalMutate(`${BASE}/c3/${encodeURIComponent(uuid)}`),
        globalMutate(`${BASE}/c3`),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Chyba při ukládání');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (item) setForm(itemToForm(item));
    setSaveError(null);
    setSaved(false);
  }

  if (isLoading) return <div className={editorStyles.state}>Načítám…</div>;
  if (error) return <div className={editorStyles.state}>Chyba: {error.message}</div>;
  if (!item) return null;
  if (isEdit && !form) return <div className={editorStyles.state}>Načítám formulář…</div>;

  const displayCode = item.external_id ?? item.uuid;
  const editForm = form ?? itemToForm(item);
  const parentDisplay = parentItem
    ? `${item.parent_code ?? parentItem.external_id ?? (isAdmin ? parentItem.uuid : parentItem.title)} — ${parentItem.title}`
    : item.parent_code;
  const sectionLinks = [
    { id: 'classification', label: '0. Klasifikace & hierarchie' },
    { id: 'identity', label: '1. Identifikace' },
    { id: 'description', label: '2. Popis' },
    { id: 'source', label: '3. Zdroj & kvalita dat' },
    { id: 'links', label: '4. Vazby & úplnost capability' },
    { id: 'raw', label: '5. Strukturovaná data (raw JSON/text)' },
  ];

  return (
    <div className={editorStyles.shell}>
      <div className={editorStyles.editorHeader}>
        <div>
          <nav className={adminStyles.breadcrumb}>
            {isEdit ? <Link href="/administration">Administration</Link> : <Link href="/c3/list">C3 Taxonomie</Link>}
            {isEdit && (
              <>
                <span className={adminStyles.breadcrumbSep}>/</span>
                <Link href="/c3/list">C3 Taxonomie</Link>
              </>
            )}
            <span className={adminStyles.breadcrumbSep}>/</span>
            <span>{item.title}</span>
          </nav>
          <span className={editorStyles.serviceId}>{displayCode}</span>
          <h1 className={editorStyles.editorTitle}>{item.title}</h1>
        </div>
        <div style={{ display: 'grid', gap: '0.75rem', justifyItems: 'end' }}>
          {!isEdit && canEdit && (
            <Link href={`/c3/${uuid}/edit`} className={detailStyles.editBtn}>
              Edit
            </Link>
          )}
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
            Synced: {formatCapabilityTimestamp(locale, item.synced_at)}<br />
            Modified: {formatCapabilityTimestamp(locale, item.modification_date)}
          </div>
        </div>
      </div>

      <div className={editorStyles.editorBody}>
        {isEdit ? (
          <form id="c3-detail-form" onSubmit={handleSave} className={editorStyles.formArea}>
            <section id="classification" className={editorStyles.section}>
              <h2 className={editorStyles.sectionTitle}>0. Klasifikace &amp; hierarchie</h2>
              <div className={editorStyles.sectionBody}>
                <div className={styles.editFieldGrid}>
                  <FieldBlock label="Item Type">
                    <select className={styles.editInput} value={editForm.item_type ?? ''} onChange={(e) => set('item_type', e.target.value)}>
                      <option value="">— neurčeno —</option>
                      {(c3Types ?? []).map((type) => (
                        <option key={type.code} value={type.code}>{type.code}</option>
                      ))}
                    </select>
                  </FieldBlock>
                  <FieldBlock label="Nadřazená schopnost (Parent)">
                    <select className={styles.editInput} value={editForm.parent_uuid ?? ''} onChange={(e) => set('parent_uuid', e.target.value)}>
                      <option value="">— žádný (kořenová schopnost) —</option>
                      {sortedParentItems.map((entry) => (
                          <option key={entry.uuid} value={entry.uuid}>
                            {entry.external_id ? `[${entry.external_id}] ` : ''}{entry.title}
                          </option>
                      ))}
                    </select>
                  </FieldBlock>
                </div>
              </div>
            </section>

            <section id="identity" className={editorStyles.section}>
              <h2 className={editorStyles.sectionTitle}>1. Identifikace</h2>
              <div className={editorStyles.sectionBody}>
                <div className={styles.editFieldGrid}>
                  <FieldBlock label="Title *">
                    <input className={styles.editInput} required value={editForm.title} onChange={(e) => set('title', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="Application (domain)">
                    <input className={styles.editInput} value={editForm.application ?? ''} onChange={(e) => set('application', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="Item status">
                    <select className={styles.editInput} value={editForm.item_status ?? ''} onChange={(e) => set('item_status', e.target.value)}>
                      <option value="">— neurčeno —</option>
                      {(c3Statuses ?? []).map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </FieldBlock>
                  <FieldBlock label="External ID">
                    <input className={styles.editInput} value={editForm.external_id ?? ''} onChange={(e) => set('external_id', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="Order #">
                    <input className={styles.editInput} type="number" value={editForm.order_num ?? ''} onChange={(e) => set('order_num', e.target.value ? parseInt(e.target.value, 10) : null)} />
                  </FieldBlock>
                  <FieldBlock label="Abbreviation">
                    <input className={styles.editInput} value={editForm.abbreviation ?? ''} onChange={(e) => set('abbreviation', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="Synonym">
                    <input className={styles.editInput} value={editForm.synonym ?? ''} onChange={(e) => set('synonym', e.target.value)} />
                  </FieldBlock>
                </div>
              </div>
            </section>

            <section id="description" className={editorStyles.section}>
              <h2 className={editorStyles.sectionTitle}>2. Popis</h2>
              <div className={editorStyles.sectionBody}>
                <div className={styles.editFieldStack}>
                  <FieldBlock label="Description">
                    <textarea className={styles.editTextarea} rows={4} value={editForm.description ?? ''} onChange={(e) => set('description', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="Source description">
                    <textarea className={styles.editTextarea} rows={3} value={editForm.source_description ?? ''} onChange={(e) => set('source_description', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="Revised description">
                    <textarea className={styles.editTextarea} rows={3} value={editForm.revised_description ?? ''} onChange={(e) => set('revised_description', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="Revised (note)">
                    <input className={styles.editInput} value={editForm.revised ?? ''} onChange={(e) => set('revised', e.target.value)} />
                  </FieldBlock>
                </div>
              </div>
            </section>

            <section id="source" className={editorStyles.section}>
              <h2 className={editorStyles.sectionTitle}>3. Zdroj &amp; kvalita dat</h2>
              <div className={editorStyles.sectionBody}>
                <div className={styles.editFieldGrid}>
                  <FieldBlock label="Data qualifier">
                    <input className={styles.editInput} value={editForm.data_qualifier ?? ''} onChange={(e) => set('data_qualifier', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="Data source">
                    <input className={styles.editInput} value={editForm.data_source ?? ''} onChange={(e) => set('data_source', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="SS overall status">
                    <input className={styles.editInput} value={editForm.ss_overall_status ?? ''} onChange={(e) => set('ss_overall_status', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="SS baseline status">
                    <input className={styles.editInput} value={editForm.ss_baseline_status ?? ''} onChange={(e) => set('ss_baseline_status', e.target.value)} />
                  </FieldBlock>
                </div>
              </div>
            </section>

            <section id="links" className={editorStyles.section}>
              <h2 className={editorStyles.sectionTitle}>4. Vazby &amp; úplnost capability</h2>
              <div className={editorStyles.sectionBody}>
                <CapabilityLinksPanel capabilityUuid={uuid} />
              </div>
            </section>

            <section id="raw" className={editorStyles.section}>
              <h2 className={editorStyles.sectionTitle}>5. Strukturovaná data (raw JSON/text)</h2>
              <div className={editorStyles.sectionBody}>
                <div className={styles.editFieldStack}>
                  <FieldBlock label="Script (raw)">
                    <textarea className={styles.editTextarea} rows={3} value={editForm.script_raw ?? ''} onChange={(e) => set('script_raw', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="Datasets (raw)">
                    <textarea className={styles.editTextarea} rows={3} value={editForm.datasets_raw ?? ''} onChange={(e) => set('datasets_raw', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="Standards (raw)">
                    <textarea className={styles.editTextarea} rows={3} value={editForm.standards_raw ?? ''} onChange={(e) => set('standards_raw', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="References (raw)">
                    <textarea className={styles.editTextarea} rows={3} value={editForm.references_raw ?? ''} onChange={(e) => set('references_raw', e.target.value)} />
                  </FieldBlock>
                  <FieldBlock label="Provenance (raw)">
                    <textarea className={styles.editTextarea} rows={3} value={editForm.provenance_raw ?? ''} onChange={(e) => set('provenance_raw', e.target.value)} />
                  </FieldBlock>
                </div>
              </div>
            </section>
          </form>
        ) : (
          <div className={editorStyles.formArea}>
            <section id="classification" className={editorStyles.section}>
              <h2 className={editorStyles.sectionTitle}>0. Klasifikace &amp; hierarchie</h2>
              <div className={editorStyles.sectionBody}>
                <div className={styles.editFieldGrid}>
                  <ReadonlyField label="Item Type" value={item.item_type} />
                  <ReadonlyField label="Application / doména" value={item.application} />
                  <ReadonlyField label="Level" value={item.level_num} />
                  <ReadonlyField label="Item status" value={item.item_status} />
                  <ReadonlyField label="Parent capability" value={parentDisplay} />
                  {isAdmin && <ReadonlyField label="Parent UUID" value={item.parent_uuid} mono />}
                </div>
              </div>
            </section>

            <section id="identity" className={editorStyles.section}>
              <h2 className={editorStyles.sectionTitle}>1. Identifikace</h2>
              <div className={editorStyles.sectionBody}>
                <div className={styles.editFieldGrid}>
                  {isAdmin && <ReadonlyField label="UUID" value={item.uuid} mono />}
                  <ReadonlyField label="Page / External ID" value={item.external_id} mono />
                  <ReadonlyField label="Source External ID" value={item.source_external_id} mono />
                  <ReadonlyField label="Order" value={item.order_num} />
                  <ReadonlyField label="Abbreviation" value={item.abbreviation} />
                  <ReadonlyField label="Synonym" value={item.synonym} />
                </div>
              </div>
            </section>

            <section id="description" className={editorStyles.section}>
              <h2 className={editorStyles.sectionTitle}>2. Popis</h2>
              <div className={editorStyles.sectionBody}>
                <div className={styles.editFieldStack}>
                  <ReadonlyArea label="Description" value={item.description} />
                  <ReadonlyArea label="Source description" value={item.source_description} />
                  <ReadonlyArea label="Revised description" value={item.revised_description} />
                  <ReadonlyField label="Revised" value={item.revised} />
                </div>
              </div>
            </section>

            <section id="source" className={editorStyles.section}>
              <h2 className={editorStyles.sectionTitle}>3. Zdroj &amp; kvalita dat</h2>
              <div className={editorStyles.sectionBody}>
                <div className={styles.editFieldGrid}>
                  <ReadonlyField label="Data qualifier" value={item.data_qualifier} />
                  <ReadonlyField label="Data source" value={item.data_source} />
                  <ReadonlyField label="SS overall status" value={item.ss_overall_status} />
                  <ReadonlyField label="SS baseline status" value={item.ss_baseline_status} />
                  <ReadonlyField
                    label="Modification date"
                    value={formatCapabilityTimestamp(locale, item.modification_date)}
                  />
                  <ReadonlyField
                    label="Synced at"
                    value={formatCapabilityTimestamp(locale, item.synced_at)}
                  />
                </div>
              </div>
            </section>

            <section id="links" className={editorStyles.section}>
              <h2 className={editorStyles.sectionTitle}>4. Vazby &amp; úplnost capability</h2>
              <div className={editorStyles.sectionBody}>
                <CapabilityLinksPanel capabilityUuid={uuid} readOnly />
              </div>
            </section>

            <section id="raw" className={editorStyles.section}>
              <h2 className={editorStyles.sectionTitle}>5. Strukturovaná data (raw JSON/text)</h2>
              <div className={editorStyles.sectionBody}>
                <div className={styles.editFieldStack}>
                  <ReadonlyArea label="Script (raw)" value={item.script_raw} />
                  <ReadonlyArea label="Datasets (raw)" value={item.datasets_raw} />
                  <ReadonlyArea label="Standards (raw)" value={item.standards_raw} />
                  <ReadonlyArea label="References (raw)" value={item.references_raw} />
                  <ReadonlyArea label="Provenance (raw)" value={item.provenance_raw} />
                </div>
              </div>
            </section>
          </div>
        )}

        <aside className={editorStyles.rail}>
          {isEdit && (
            <div className={editorStyles.railCard}>
              {saveError && <div className={editorStyles.railError}>{saveError}</div>}
              {saved && <div className={editorStyles.savedOk}>✓ Uloženo</div>}
              <button type="submit" form="c3-detail-form" className={editorStyles.saveBtn} disabled={saving}>
                {saving ? 'Ukládám…' : 'Uložit'}
              </button>
              <button type="button" className={editorStyles.cancelBtn} onClick={handleReset} disabled={saving}>
                Zahodit změny
              </button>
            </div>
          )}

          <div className={editorStyles.railCard}>
            <div className={editorStyles.railTitle}>Souhrn</div>
            {isAdmin && <div className={editorStyles.validOk}>UUID: {item.uuid}</div>}
            <div className={editorStyles.validOk}>Item Type: {isEdit ? editForm.item_type ?? '—' : item.item_type ?? '—'}</div>
            <div className={editorStyles.validOk}>Parent: {parentItem?.title ?? item.parent_title ?? item.parent_code ?? '—'}</div>
            <div className={editorStyles.validOk}>Status: {isEdit ? editForm.item_status ?? '—' : item.item_status ?? '—'}</div>
          </div>

          <div className={editorStyles.railCard}>
            <div className={editorStyles.railTitle}>Sekce</div>
            <div className={editorStyles.sectionNav}>
              {sectionLinks.map((section) => (
                <a key={section.id} href={`#${section.id}`} className={editorStyles.sectionNavItem}>
                  {section.label}
                </a>
              ))}
            </div>
          </div>

          <div className={editorStyles.railCard}>
            <div className={editorStyles.railTitle}>Validation</div>
            {validationIssues.length > 0 ? (
              validationIssues.map((issue) => (
                <div key={issue} className={editorStyles.validationError}>{issue}</div>
              ))
            ) : (
              <div className={editorStyles.validOk}>No errors</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
