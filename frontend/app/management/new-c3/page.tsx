'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Link from '@/app/components/AppLink';
import useSWR from 'swr';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authHeaders, apiFetch } from '@/features/services/api/services.api';
import { Button } from '@/design-system/controls/Button';
import styles from '../new-service/editor.module.css';

const BASE_TAX = '/api/v1/taxonomy';

const schema = z.object({
  uuid: z.string().optional(),
  application: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  external_id: z.string().optional(),
  data_qualifier: z.string().optional(),
  data_source: z.string().optional(),
  order_num: z.coerce.number().optional().nullable(),
  ss_overall_status: z.string().optional(),
  ss_baseline_status: z.string().optional(),
  item_status: z.string().optional(),
  source_description: z.string().optional(),
  revised_description: z.string().optional(),
  abbreviation: z.string().optional(),
  synonym: z.string().optional(),
  script_raw: z.string().optional(),
  datasets_raw: z.string().optional(),
  standards_raw: z.string().optional(),
  references_raw: z.string().optional(),
  provenance_raw: z.string().optional(),
  item_type: z.string().optional(),
  parent_code: z.string().optional(),
  parent_uuid: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface C3Type { code: string; name: string; }
interface C3Item {
  uuid: string;
  external_id: string | null;
  title: string;
  item_type: string | null;
  parent_title: string | null;
}

export default function NewC3Page() {
  const router = useRouter();
  const { data: types } = useSWR<C3Type[]>(`${BASE_TAX}/c3/types`, apiFetch, { revalidateOnFocus: false });
  const { data: statuses } = useSWR<string[]>(`${BASE_TAX}/c3/statuses`, apiFetch, { revalidateOnFocus: false });
  const { data: c3Items } = useSWR<C3Item[]>(`${BASE_TAX}/c3`, apiFetch, { revalidateOnFocus: false });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      uuid: '',
      application: '',
      title: '',
      description: '',
      external_id: '',
      data_qualifier: '',
      data_source: '',
      order_num: undefined,
      ss_overall_status: '',
      ss_baseline_status: '',
      item_status: 'draft',
      source_description: '',
      revised_description: '',
      abbreviation: '',
      synonym: '',
      script_raw: '',
      datasets_raw: '',
      standards_raw: '',
      references_raw: '',
      provenance_raw: '',
      item_type: '',
      parent_code: '',
      parent_uuid: '',
    },
  });

  const watchedTitle = watch('title');
  const watchedExternalId = watch('external_id');
  const watchedStatus = watch('item_status');
  const dirtyCount = Object.keys(dirtyFields).length;

  const parentOptions = useMemo(
    () =>
      (c3Items ?? [])
        .filter((item) => item.uuid)
        .sort((a, b) => String(a.external_id ?? a.title).localeCompare(String(b.external_id ?? b.title))),
    [c3Items],
  );

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const body = compactPayload({
        uuid: data.uuid?.trim(),
        application: data.application?.trim(),
        title: data.title.trim(),
        description: data.description?.trim(),
        external_id: data.external_id?.trim(),
        data_qualifier: data.data_qualifier?.trim(),
        data_source: data.data_source?.trim(),
        order_num: data.order_num ?? null,
        ss_overall_status: data.ss_overall_status?.trim(),
        ss_baseline_status: data.ss_baseline_status?.trim(),
        item_status: data.item_status?.trim(),
        source_description: data.source_description?.trim(),
        revised_description: data.revised_description?.trim(),
        abbreviation: data.abbreviation?.trim(),
        synonym: data.synonym?.trim(),
        script_raw: data.script_raw?.trim(),
        datasets_raw: data.datasets_raw?.trim(),
        standards_raw: data.standards_raw?.trim(),
        references_raw: data.references_raw?.trim(),
        provenance_raw: data.provenance_raw?.trim(),
        item_type: data.item_type?.trim(),
        parent_code: data.parent_code?.trim(),
        parent_uuid: data.parent_uuid?.trim(),
      });

      const res = await fetch(`${BASE_TAX}/c3`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const responseText = await res.text().catch(() => '');
        throw new Error(responseText || `POST /taxonomy/c3 ${res.status}`);
      }

      const created = (await res.json()) as { uuid?: string };
      setSaved(true);
      router.push(created.uuid ? `/c3/${created.uuid}` : '/c3/list');
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.shell} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.editorHeader}>
        <div>
          <span className={styles.serviceId}>{watchedExternalId?.trim() || 'NEW C3'}</span>
          <h1 className={styles.editorTitle}>{watchedTitle?.trim() || 'New C3 Capability'}</h1>
        </div>
        <span className={styles.savedOk}>{watchedStatus || 'draft'}</span>
      </div>

      <div className={styles.editorBody}>
        <div className={styles.formArea}>
          <EditorSection id="identity" title="1. Basic Identity">
            <div className={styles.fieldRow}>
              <Field label="Title *" error={errors.title?.message}>
                <input {...register('title')} className={fieldClass(errors.title)} />
              </Field>
              <Field label="External ID">
                <input {...register('external_id')} className={styles.input} placeholder="e.g. BP-1016" />
              </Field>
              <Field label="UUID">
                <input {...register('uuid')} className={styles.input} placeholder="leave empty for auto-generated UUID" />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Application">
                <input {...register('application')} className={styles.input} />
              </Field>
              <Field label="Item Type">
                <select {...register('item_type')} className={styles.input}>
                  <option value="">— select —</option>
                  {types?.map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.code} — {type.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Item Status">
                <select {...register('item_status')} className={styles.input}>
                  <option value="">— select —</option>
                  {statuses?.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea {...register('description')} rows={4} className={styles.textarea} />
            </Field>
          </EditorSection>

          <EditorSection id="hierarchy" title="2. Hierarchy & Classification">
            <div className={styles.fieldRow}>
              <Field label="Parent UUID">
                <select
                  {...register('parent_uuid')}
                  className={styles.input}
                  onChange={(event) => {
                    const value = event.target.value;
                    const parent = parentOptions.find((item) => item.uuid === value);
                    setValue('parent_uuid', value, { shouldDirty: true });
                    setValue('parent_code', parent?.external_id ?? '', { shouldDirty: true });
                  }}
                >
                  <option value="">— no parent —</option>
                  {parentOptions.map((item) => (
                    <option key={item.uuid} value={item.uuid}>
                      {item.external_id ? `[${item.external_id}] ` : ''}{item.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Parent Code">
                <input {...register('parent_code')} className={styles.input} />
              </Field>
              <Field label="Order">
                <input type="number" {...register('order_num')} className={styles.input} min={0} />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Data Qualifier">
                <input {...register('data_qualifier')} className={styles.input} />
              </Field>
              <Field label="Data Source">
                <input {...register('data_source')} className={styles.input} />
              </Field>
              <Field label="Abbreviation">
                <input {...register('abbreviation')} className={styles.input} />
              </Field>
            </div>
            <Field label="Synonym">
              <textarea {...register('synonym')} rows={3} className={styles.textarea} />
            </Field>
          </EditorSection>

          <EditorSection id="status" title="3. Status & Source Text">
            <div className={styles.fieldRow}>
              <Field label="SS Overall Status">
                <input {...register('ss_overall_status')} className={styles.input} />
              </Field>
              <Field label="SS Baseline Status">
                <input {...register('ss_baseline_status')} className={styles.input} />
              </Field>
            </div>
            <Field label="Source Description">
              <textarea {...register('source_description')} rows={4} className={styles.textarea} />
            </Field>
            <Field label="Revised Description">
              <textarea {...register('revised_description')} rows={4} className={styles.textarea} />
            </Field>
          </EditorSection>

          <EditorSection id="raw" title="4. Raw Source Fields">
            <Field label="Script Raw">
              <textarea {...register('script_raw')} rows={4} className={styles.textarea} />
            </Field>
            <Field label="Datasets Raw">
              <textarea {...register('datasets_raw')} rows={4} className={styles.textarea} />
            </Field>
            <Field label="Standards Raw">
              <textarea {...register('standards_raw')} rows={4} className={styles.textarea} />
            </Field>
            <Field label="References Raw">
              <textarea {...register('references_raw')} rows={4} className={styles.textarea} />
            </Field>
            <Field label="Provenance Raw">
              <textarea {...register('provenance_raw')} rows={4} className={styles.textarea} />
            </Field>
          </EditorSection>

          <EditorSection id="review" title="5. Review">
            <p className={styles.hint}>Vytváří se plný C3 záznam se všemi poli podporovanými backend API.</p>
            {saveError && <div className={styles.errorBanner}>{saveError}</div>}
            {saved && <div className={styles.successBanner}>C3 capability created successfully.</div>}
          </EditorSection>
        </div>

        <aside className={styles.rail}>
          <div className={styles.railCard}>
            <div className={styles.railTitle}>Save Status</div>
            {saving && <div className={styles.saving}>Creating…</div>}
            {saved && !saving && <div className={styles.savedOk}>✓ Created</div>}
            {saveError && <div className={styles.railError}>{saveError}</div>}
            {isDirty && <div className={styles.dirtyNote}>{dirtyCount} field(s) changed</div>}

            <Button type="submit" loading={saving} style={{ width: '100%', marginBottom: 'var(--space-2)' }}>
              Create C3 capability
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              style={{ width: '100%' }}
              onClick={() => {
                if (isDirty && !confirm('You have unsaved changes. Leave anyway?')) return;
                router.push('/management');
              }}
            >
              Cancel
            </Button>
          </div>

          <div className={styles.railCard}>
            <div className={styles.railTitle}>Sections</div>
            <nav className={styles.sectionNav}>
              {['identity', 'hierarchy', 'status', 'raw', 'review'].map((section, index) => (
                <a key={section} href={`#${section}`} className={styles.sectionNavItem}>
                  {index + 1}. {section.charAt(0).toUpperCase() + section.slice(1)}
                </a>
              ))}
            </nav>
          </div>

          <div className={styles.railCard}>
            <div className={styles.railTitle}>Validation</div>
            {Object.entries(errors).length > 0 ? (
              Object.entries(errors).map(([field, error]) => (
                <div key={field} className={styles.validationError}>
                  {field}: {(error as { message?: string }).message}
                </div>
              ))
            ) : (
              <div className={styles.validOk}>No errors</div>
            )}
          </div>

          <div className={styles.railCard}>
            <div className={styles.railTitle}>Navigation</div>
            <Link href="/management" className={styles.sectionNavItem}>Back to Content Admin</Link>
          </div>
        </aside>
      </div>
    </form>
  );
}

function EditorSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}

function fieldClass(error?: { message?: string }) {
  return error ? `${styles.input} ${styles.inputError}` : styles.input;
}

function compactPayload<T extends Record<string, unknown>>(input: T): T {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined && value !== '');
  return Object.fromEntries(entries) as T;
}
