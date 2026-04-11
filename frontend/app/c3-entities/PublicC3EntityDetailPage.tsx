'use client';

import Link from '@/app/components/AppLink';
import { use, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import { getAuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import adminStyles from '../admin/admin.module.css';
import detailStyles from '../services/[id]/detail.module.css';
import editorStyles from '../services/[id]/edit/editor.module.css';
import entityStyles from '../admin/c3-entities/entity-list.module.css';
import type { EditFieldDef } from '../admin/c3-entities/C3EntityListPage';
import type { PublicC3EntityConfig } from './public-config';
import { buildEntityEditHref, renderLinkedJsonList } from './public-config';

interface Props {
  params: Promise<{ code: string }>;
  config: PublicC3EntityConfig;
  mode?: 'view' | 'edit';
}

const CLASSIFICATION_KEYS = new Set([
  'uuid',
  'item_status',
  'modification_date',
  'order_num',
]);

const SOURCE_STATUS_KEYS = new Set([
  'ss_overall_status',
  'ss_baseline_status',
  'data_source',
  'external_id',
  'data_qualifier',
  'revised',
  'ciav_review_status',
  'mcsma_review_status',
  'technology_interaction_type',
  'technology_interaction_maturity',
]);

function normalize(value: unknown) {
  return String(value ?? '').trim();
}

function formatDate(value: unknown) {
  const text = normalize(value);
  if (!text) return '—';
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleString('cs-CZ');
}

function formatValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = normalize(value);
  return text || '—';
}

function uniqueKeys(keys: string[]) {
  return [...new Set(keys.filter(Boolean))];
}

function isEmptyValue(value: unknown, type: EditFieldDef['type']) {
  if (type === 'checkbox') return false;
  if (value == null) return true;
  return String(value).trim() === '';
}

function toBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return ['1', 'true', 'yes', 'y'].includes(String(value ?? '').trim().toLowerCase());
}

function toDateTimeLocalValue(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={detailStyles.summaryItem}>
      <span className={detailStyles.summaryLabel}>{label}</span>
      <span className={detailStyles.summaryValue}>{value}</span>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section id={id} className={editorStyles.section}>
      <h2 className={editorStyles.sectionTitle}>{title}</h2>
      <div className={editorStyles.sectionBody}>{children}</div>
    </section>
  );
}

function ReadonlyField({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div className={entityStyles.editField}>
      <span className={entityStyles.fieldLabel}>{label}</span>
      <div className={mono ? entityStyles.mono : undefined}>{formatValue(value)}</div>
    </div>
  );
}

function ReadonlyArea({ label, value }: { label: string; value: unknown }) {
  return (
    <div className={entityStyles.editFieldWide}>
      <span className={entityStyles.fieldLabel}>{label}</span>
      <div className={entityStyles.cellText}>{normalize(value) || '—'}</div>
    </div>
  );
}

function FieldBlock({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? entityStyles.editFieldWide : entityStyles.editField}>
      <span className={entityStyles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function renderEditControl(
  field: EditFieldDef,
  draft: Record<string, unknown>,
  setDraft: Dispatch<SetStateAction<Record<string, unknown> | null>>,
) {
  if (field.type === 'textarea') {
    return (
      <textarea
        className={entityStyles.editTextarea}
        value={String(draft[field.key] ?? '')}
        onChange={(event) => setDraft((current) => ({ ...(current ?? {}), [field.key]: event.target.value }))}
        placeholder={field.placeholder}
        rows={4}
      />
    );
  }

  if (field.type === 'checkbox') {
    return (
      <input
        className={entityStyles.editCheckbox}
        type="checkbox"
        checked={toBoolean(draft[field.key])}
        onChange={(event) => setDraft((current) => ({ ...(current ?? {}), [field.key]: event.target.checked }))}
      />
    );
  }

  if (field.type === 'datetime-local') {
    return (
      <input
        className={entityStyles.editInput}
        type="datetime-local"
        value={toDateTimeLocalValue(draft[field.key])}
        onChange={(event) => setDraft((current) => ({ ...(current ?? {}), [field.key]: event.target.value }))}
        placeholder={field.placeholder}
      />
    );
  }

  return (
    <input
      className={entityStyles.editInput}
      type={field.type === 'number' ? 'number' : 'text'}
      value={String(draft[field.key] ?? '')}
      onChange={(event) => setDraft((current) => ({ ...(current ?? {}), [field.key]: event.target.value }))}
      placeholder={field.placeholder}
    />
  );
}

export function PublicC3EntityDetailPage({ params, config, mode = 'view' }: Props) {
  const { code } = use(params);
  const router = useRouter();
  const decodedCode = decodeURIComponent(code);
  const isEdit = mode === 'edit';
  const [role, setRole] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const canEdit = hasRoleAccess(role, 'editor');
  const isAdmin = hasRoleAccess(role, 'admin');

  const { data: item, isLoading, error } = useSWR<Record<string, unknown>>(
    `${config.detailEndpointBase}/${encodeURIComponent(decodedCode)}`,
    apiFetch,
    {
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    setRole(getAuthSnapshot()?.role ?? null);
  }, []);

  useEffect(() => {
    if (!isEdit || !item || draft) return;
    const nextDraft = config.editFields.reduce<Record<string, unknown>>((acc, field) => {
      acc[field.key] = item[field.key] ?? '';
      return acc;
    }, {});
    setDraft(nextDraft);
  }, [config.editFields, draft, isEdit, item]);

  const descriptionKeySet = useMemo(
    () => new Set(uniqueKeys(['title', ...config.descriptionKeys])),
    [config.descriptionKeys],
  );
  const rawKeySet = useMemo(() => new Set(config.rawKeys), [config.rawKeys]);
  const metadataKeys = useMemo(
    () => config.metadataKeys.filter((key) => isAdmin || key !== 'uuid'),
    [config.metadataKeys, isAdmin],
  );

  const classificationKeys = useMemo(() => {
    const preferred = uniqueKeys([
      config.codeKey,
      'uuid',
      ...metadataKeys.filter((key) => CLASSIFICATION_KEYS.has(key)),
      ...metadataKeys.filter((key) => !SOURCE_STATUS_KEYS.has(key) && !CLASSIFICATION_KEYS.has(key)),
    ]);
    return preferred.filter((key) => !descriptionKeySet.has(key) && !rawKeySet.has(key));
  }, [config.codeKey, descriptionKeySet, metadataKeys, rawKeySet]);

  const sourceKeys = useMemo(
    () =>
      metadataKeys.filter((key) =>
        SOURCE_STATUS_KEYS.has(key) &&
        !descriptionKeySet.has(key) &&
        !rawKeySet.has(key),
      ),
    [descriptionKeySet, metadataKeys, rawKeySet],
  );

  const descriptionFields = useMemo(
    () => config.editFields.filter((field) => field.key === 'title' || descriptionKeySet.has(field.key)),
    [config.editFields, descriptionKeySet],
  );
  const rawFields = useMemo(
    () => config.editFields.filter((field) => rawKeySet.has(field.key)),
    [config.editFields, rawKeySet],
  );
  const classificationFields = useMemo(
    () => config.editFields.filter((field) => field.key === config.codeKey || field.key === 'uuid' || CLASSIFICATION_KEYS.has(field.key)),
    [config.codeKey, config.editFields],
  );
  const sourceFields = useMemo(
    () =>
      config.editFields.filter((field) =>
        !descriptionKeySet.has(field.key) &&
        !rawKeySet.has(field.key) &&
        !classificationFields.some((candidate) => candidate.key === field.key),
      ),
    [classificationFields, config.editFields, descriptionKeySet, rawKeySet],
  );

  const validationIssues = useMemo(() => {
    const source = isEdit ? draft : item;
    if (!source) return [];
    return [
      !normalize(source[config.codeKey]) ? `${config.codeLabel} je povinný.` : null,
      !normalize(source.uuid) ? 'UUID je povinné.' : null,
      !normalize(source.title) ? 'Title je povinný.' : null,
    ].filter(Boolean) as string[];
  }, [config.codeKey, config.codeLabel, draft, isEdit, item]);

  const linkSections = useMemo(
    () => config.linkFields?.filter((field) => normalize(item?.[field.key])) ?? [],
    [config.linkFields, item],
  );

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!item || !draft) return;
    const entityId = Number(item.id);
    if (!entityId || Number.isNaN(entityId)) {
      setSaveError('Záznam nemá platné interní ID pro uložení.');
      return;
    }
    if (validationIssues.length > 0) {
      setSaveError(validationIssues[0]);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaved(false);

    try {
      const body = config.editFields.reduce<Record<string, unknown>>((acc, field) => {
        const value = draft[field.key];
        acc[field.key] = value === '' ? null : value;
        return acc;
      }, {});

      const response = await fetch(`${config.editEndpoint}/${entityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Uložení selhalo (${response.status})`);
      }

      const nextCode = normalize(body[config.codeKey] ?? decodedCode);
      await Promise.all([
        globalMutate(config.endpoint),
        globalMutate(config.editEndpoint),
        globalMutate(`${config.detailEndpointBase}/${encodeURIComponent(decodedCode)}`),
        nextCode && nextCode !== decodedCode
          ? globalMutate(`${config.detailEndpointBase}/${encodeURIComponent(nextCode)}`)
          : Promise.resolve(undefined),
      ]);

      setSaved(true);
      if (nextCode && nextCode !== decodedCode) {
        router.replace(`${config.editBasePath}/${encodeURIComponent(nextCode)}/edit`);
      }
    } catch (saveErrorValue: unknown) {
      setSaveError(saveErrorValue instanceof Error ? saveErrorValue.message : 'Uložení selhalo');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!item) return;
    const nextDraft = config.editFields.reduce<Record<string, unknown>>((acc, field) => {
      acc[field.key] = item[field.key] ?? '';
      return acc;
    }, {});
    setDraft(nextDraft);
    setSaveError(null);
    setSaved(false);
  }

  if (isLoading) return <div className={detailStyles.state}>Načítám…</div>;
  if (error) return <div className={detailStyles.stateError}>Načtení selhalo.</div>;
  if (!item) return <div className={detailStyles.stateError}>Položka nebyla nalezena.</div>;
  if (isEdit && !draft) return <div className={detailStyles.state}>Načítám editor…</div>;

  const codeValue = normalize(item[config.codeKey]) || normalize(item.uuid);
  const titleValue = normalize(item.title) || codeValue;
  const editHref = buildEntityEditHref(config, item);
  const sectionLinks = [
    { id: 'classification', label: '0. Klasifikace & identifikace' },
    { id: 'description', label: '1. Popis' },
    { id: 'source', label: '2. Zdroj & stav' },
    { id: 'links', label: '3. Vazby & návaznosti' },
    { id: 'raw', label: '4. Strukturovaná data (raw JSON/text)' },
  ];

  return (
    <div className={editorStyles.shell}>
      <div className={editorStyles.editorHeader}>
        <div>
          <nav className={adminStyles.breadcrumb}>
            {isEdit ? <Link href="/administration">Administration</Link> : <Link href={config.listPath}>C3 Taxonomie</Link>}
            <span className={adminStyles.breadcrumbSep}>/</span>
            <Link href={config.listPath}>{config.title}</Link>
            <span className={adminStyles.breadcrumbSep}>/</span>
            <span>{titleValue}</span>
          </nav>
          <span className={editorStyles.serviceId}>{codeValue}</span>
          <h1 className={editorStyles.editorTitle}>{titleValue}</h1>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem', justifyItems: 'end' }}>
          {!isEdit && canEdit && (
            <Link href={editHref} className={detailStyles.editBtn}>
              Edit
            </Link>
          )}
          {isEdit && (
            <Link href={`${config.detailBasePath}/${encodeURIComponent(codeValue)}`} className={detailStyles.editBtn}>
              Náhled
            </Link>
          )}
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
            Modified: {formatDate(item.modification_date)}<br />
            {item.item_status ? <>Status: {formatValue(item.item_status)}</> : <>Status: —</>}
          </div>
        </div>
      </div>

      <div className={detailStyles.summaryStrip}>
        <SummaryItem label={config.codeLabel} value={codeValue} />
        {isAdmin && <SummaryItem label="UUID" value={formatValue(item.uuid)} />}
        <SummaryItem label="Status" value={formatValue(item.item_status)} />
        <SummaryItem label="Modified" value={formatDate(item.modification_date)} />
      </div>

      <div className={editorStyles.editorBody}>
        {isEdit ? (
          <form id="c3-entity-detail-form" onSubmit={handleSave} className={editorStyles.formArea}>
            <Section id="classification" title="0. Klasifikace & identifikace">
              <div className={entityStyles.editGrid}>
                {classificationFields.map((field) => (
                  <FieldBlock key={field.key} label={field.label} wide={field.type === 'textarea'}>
                    {renderEditControl(field, draft ?? {}, setDraft)}
                  </FieldBlock>
                ))}
              </div>
            </Section>

            <Section id="description" title="1. Popis">
              <div className={entityStyles.cellStack}>
                {descriptionFields.map((field) => (
                  <FieldBlock key={field.key} label={field.label} wide>
                    {renderEditControl(field, draft ?? {}, setDraft)}
                  </FieldBlock>
                ))}
              </div>
            </Section>

            <Section id="source" title="2. Zdroj & stav">
              <div className={entityStyles.editGrid}>
                {sourceFields.map((field) => (
                  <FieldBlock key={field.key} label={field.label} wide={field.type === 'textarea'}>
                    {renderEditControl(field, draft ?? {}, setDraft)}
                  </FieldBlock>
                ))}
              </div>
            </Section>

            <Section id="links" title="3. Vazby & návaznosti">
              {linkSections.length > 0 ? (
                <div className={entityStyles.cellStack}>
                  {linkSections.map((field) => (
                    <div key={field.key} className={entityStyles.editFieldWide}>
                      <span className={entityStyles.fieldLabel}>{field.label}</span>
                      {renderLinkedJsonList(item[field.key], field.target) ?? <div className={entityStyles.cellText}>—</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={editorStyles.validOk}>Žádné odvozené vazby nejsou dostupné.</div>
              )}
            </Section>

            <Section id="raw" title="4. Strukturovaná data (raw JSON/text)">
              <div className={entityStyles.cellStack}>
                {rawFields.length > 0 ? rawFields.map((field) => (
                  <FieldBlock key={field.key} label={field.label} wide>
                    {renderEditControl(field, draft ?? {}, setDraft)}
                  </FieldBlock>
                )) : <div className={editorStyles.validOk}>Tato entita nemá raw pole k editaci.</div>}
              </div>
            </Section>
          </form>
        ) : (
          <div className={editorStyles.formArea}>
            <Section id="classification" title="0. Klasifikace & identifikace">
              <div className={entityStyles.editGrid}>
                {classificationKeys.map((key) => (
                  <ReadonlyField key={key} label={config.labels[key] ?? key} value={item[key]} mono={key === 'uuid' || key === config.codeKey || key === 'external_id'} />
                ))}
              </div>
            </Section>

            <Section id="description" title="1. Popis">
              <div className={entityStyles.cellStack}>
                {config.descriptionKeys.some((key) => normalize(item[key])) ? (
                  config.descriptionKeys.map((key) => (
                    <ReadonlyArea key={key} label={config.labels[key] ?? key} value={item[key]} />
                  ))
                ) : (
                  <div className={editorStyles.validOk}>Žádný popis není dostupný.</div>
                )}
              </div>
            </Section>

            <Section id="source" title="2. Zdroj & stav">
              <div className={entityStyles.editGrid}>
                {sourceKeys.length > 0 ? (
                  sourceKeys.map((key) => (
                    <ReadonlyField key={key} label={config.labels[key] ?? key} value={item[key]} mono={key === 'external_id'} />
                  ))
                ) : (
                  <ReadonlyField label="Status" value={item.item_status} />
                )}
              </div>
            </Section>

            <Section id="links" title="3. Vazby & návaznosti">
              {linkSections.length > 0 ? (
                <div className={entityStyles.cellStack}>
                  {linkSections.map((field) => (
                    <div key={field.key} className={entityStyles.editFieldWide}>
                      <span className={entityStyles.fieldLabel}>{field.label}</span>
                      {renderLinkedJsonList(item[field.key], field.target) ?? <div className={entityStyles.cellText}>—</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={editorStyles.validOk}>Žádné odvozené vazby nejsou dostupné.</div>
              )}
            </Section>

            <Section id="raw" title="4. Strukturovaná data (raw JSON/text)">
              <div className={entityStyles.cellStack}>
                {config.rawKeys.length > 0 ? (
                  config.rawKeys.map((key) => (
                    <ReadonlyArea key={key} label={config.labels[key] ?? key} value={item[key]} />
                  ))
                ) : (
                  <div className={editorStyles.validOk}>Tato entita nemá raw pole.</div>
                )}
              </div>
            </Section>
          </div>
        )}

        <aside className={editorStyles.rail}>
          {isEdit && (
            <div className={editorStyles.railCard}>
              {saveError && <div className={editorStyles.railError}>{saveError}</div>}
              {saved && <div className={editorStyles.savedOk}>✓ Uloženo</div>}
              <button type="submit" form="c3-entity-detail-form" className={editorStyles.saveBtn} disabled={saving}>
                {saving ? 'Ukládám…' : 'Uložit'}
              </button>
              <button type="button" className={editorStyles.cancelBtn} onClick={handleReset} disabled={saving}>
                Zahodit změny
              </button>
            </div>
          )}

          <div className={editorStyles.railCard}>
            <div className={editorStyles.railTitle}>Souhrn</div>
            {isAdmin && <div className={editorStyles.validOk}>UUID: {formatValue(item.uuid)}</div>}
            <div className={editorStyles.validOk}>{config.codeLabel}: {codeValue}</div>
            <div className={editorStyles.validOk}>Status: {formatValue(isEdit ? draft?.item_status : item.item_status)}</div>
            <div className={editorStyles.validOk}>Modified: {formatDate(item.modification_date)}</div>
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
