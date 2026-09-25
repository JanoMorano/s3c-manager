import { useContext } from 'react';
import { FormSection } from '@/app/components/layout-v2';
import type { ServiceOfferingBody } from '@/features/services/api/editor.api';
import styles from '../editor.module.css';
import { OFFERING_STATUSES } from './schema';
import { ActiveEditorTabContext, ADVANCED_DETAIL_SECTION_IDS, PRIMARY_EDITOR_SECTION_IDS, editorTabOfSection } from './editorTabs';

// ── Operational Readiness panel ──────────────────────────────────────────────
export function OperationalReadinessPanel({
  requestable,
  channelType,
  channelUrl,
  offeringHasChannel,
  supportModelCount,
  offeringsCount,
  defaultOfferingTitle,
}: {
  requestable: boolean | undefined;
  channelType: string | undefined;
  channelUrl: string | undefined;
  offeringHasChannel: boolean;
  supportModelCount: number;
  offeringsCount: number;
  defaultOfferingTitle: string | null;
}) {
  const checks: { label: string; ok: boolean }[] = [
    { label: 'Offerings defined',  ok: offeringsCount > 0 },
    { label: 'Default offering',    ok: offeringsCount === 0 || !!defaultOfferingTitle },
    { label: 'Support model',      ok: supportModelCount > 0 },
    { label: 'Request channel',    ok: !requestable || !!(channelType?.trim() || channelUrl?.trim()) || offeringHasChannel },
  ];
  const allOk = checks.every(c => c.ok);

  return (
    <div>
      {checks.map(c => (
        <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: c.ok ? 'var(--color-success)' : 'var(--color-warning)' }}>
            {c.ok ? '✓' : '⚠'}
          </span>
          <span style={{ font: 'var(--text-label-sm)', color: c.ok ? 'var(--color-text-secondary)' : 'var(--color-warning)' }}>
            {c.label}
          </span>
        </div>
      ))}
      {allOk && <div style={{ font: 'var(--text-body-sm)', color: 'var(--color-success)', marginTop: 4 }}>All checks pass</div>}
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────
export function EditorSection({ id, title, children, hidden = false }: { id: string; title: string; children: React.ReactNode; hidden?: boolean }) {
  const activeTab = useContext(ActiveEditorTabContext);
  if (hidden) return null;
  if (editorTabOfSection(id) !== activeTab) {
    return <div hidden>{children}</div>;
  }

  if (ADVANCED_DETAIL_SECTION_IDS.has(id)) {
    return (
      <details id={id} className={styles.advancedDetails}>
        <summary className={styles.advancedSummary}>{title}</summary>
        <div className={styles.advancedDetailsBody}>{children}</div>
      </details>
    );
  }

  if (!PRIMARY_EDITOR_SECTION_IDS.has(id)) {
    return (
      <section id={id} className={styles.inlineEditorBlock}>
        <h3 className={styles.inlineEditorTitle}>{title}</h3>
        <div className={styles.inlineEditorBody}>{children}</div>
      </section>
    );
  }

  return (
    <FormSection id={id} title={title}>
      {children}
    </FormSection>
  );
}

export interface OfferingInheritedValues {
  requestable: boolean;
  approval_required: boolean | null;
  request_channel_type: string | null;
  request_channel_url: string | null;
  lead_time_text: string | null;
}

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export function inheritBooleanValue(value: boolean | null | undefined): string {
  if (value == null) return 'inherit';
  return value ? 'yes' : 'no';
}

export function parseInheritBoolean(value: string): boolean | null {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return null;
}

/**
 * Offering form shared by the add and edit flows. Request/access fields left
 * empty inherit the service value (37_offering_request_inheritance.sql).
 */
export function OfferingFormFields({
  form,
  setForm,
  inherited,
  t,
  allowEmptyStatus = false,
}: {
  form: ServiceOfferingBody;
  setForm: React.Dispatch<React.SetStateAction<ServiceOfferingBody>>;
  inherited: OfferingInheritedValues;
  t: Translate;
  allowEmptyStatus?: boolean;
}) {
  const yesNo = (value: boolean | null) => (value == null ? '—' : value ? t('common.yes') : t('common.no'));
  const inheritedHint = (value: string | null) => t('service_editor.offering.inherited_value', { value: value || '—' });
  const effectiveRequestable = form.requestable ?? inherited.requestable;
  const effectiveChannel = form.request_channel_type || form.request_channel_url || inherited.request_channel_type || inherited.request_channel_url;
  return (
    <>
      <div className={styles.fieldRow}>
        <Field label="Offering Code">
          <input className={styles.input} value={form.offering_code ?? ''} onChange={e => setForm(p => ({ ...p, offering_code: e.target.value }))} />
        </Field>
        <Field label="Title">
          <input className={styles.input} value={form.title ?? ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
        </Field>
        <Field label="Status">
          <select className={styles.input} value={form.status ?? (allowEmptyStatus ? '' : 'draft')} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
            {allowEmptyStatus && <option value="">— select —</option>}
            {OFFERING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea className={styles.textarea} rows={3} value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value || null }))} />
      </Field>
      <p className={styles.hint}>{t('service_editor.offering.inheritance_hint')}</p>
      <div className={styles.fieldRow}>
        <Field label="Request Channel Type" hint={form.request_channel_type ? undefined : inheritedHint(inherited.request_channel_type)}>
          <input className={styles.input} value={form.request_channel_type ?? ''} placeholder={inherited.request_channel_type ?? ''} onChange={e => setForm(p => ({ ...p, request_channel_type: e.target.value || null }))} />
        </Field>
        <Field label="Request Channel URL" hint={form.request_channel_url ? undefined : inheritedHint(inherited.request_channel_url)}>
          <input className={styles.input} value={form.request_channel_url ?? ''} placeholder={inherited.request_channel_url ?? ''} onChange={e => setForm(p => ({ ...p, request_channel_url: e.target.value || null }))} />
        </Field>
        <Field label="Lead Time" hint={form.lead_time_text ? undefined : inheritedHint(inherited.lead_time_text)}>
          <input className={styles.input} value={form.lead_time_text ?? ''} placeholder={inherited.lead_time_text ?? ''} onChange={e => setForm(p => ({ ...p, lead_time_text: e.target.value || null }))} />
        </Field>
      </div>
      <div className={styles.fieldRow}>
        <Field label="Requestable">
          <select className={styles.input} value={inheritBooleanValue(form.requestable)} onChange={e => setForm(p => ({ ...p, requestable: parseInheritBoolean(e.target.value) }))}>
            <option value="inherit">{t('service_editor.offering.inherit_option', { value: yesNo(inherited.requestable) })}</option>
            <option value="yes">{t('common.yes')}</option>
            <option value="no">{t('common.no')}</option>
          </select>
        </Field>
        <Field label="Approval required">
          <select className={styles.input} value={inheritBooleanValue(form.approval_required)} onChange={e => setForm(p => ({ ...p, approval_required: parseInheritBoolean(e.target.value) }))}>
            <option value="inherit">{t('service_editor.offering.inherit_option', { value: yesNo(inherited.approval_required) })}</option>
            <option value="yes">{t('common.yes')}</option>
            <option value="no">{t('common.no')}</option>
          </select>
        </Field>
        <Field label="Support Tier">
          <input className={styles.input} value={form.support_tier_code ?? ''} onChange={e => setForm(p => ({ ...p, support_tier_code: e.target.value || null }))} />
        </Field>
        <Field label="Display Order">
          <input className={styles.input} type="number" value={form.display_order ?? ''} onChange={e => setForm(p => ({ ...p, display_order: e.target.value ? Number(e.target.value) : null }))} />
        </Field>
      </div>
      <div className={styles.toggleRow}>
        <label className={styles.domainCheck}>
          <input type="checkbox" checked={form.is_default ?? false} onChange={e => setForm(p => ({ ...p, is_default: e.target.checked }))} />
          <span>Default offering</span>
        </label>
      </div>
      {effectiveRequestable && !effectiveChannel && (
        <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
          <span className={styles.crossFieldAlertIcon}>⚠</span>
          Requestable offerings need a Request Channel Type or URL so consumers know how to order this service.
        </div>
      )}
    </>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {hint && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>{hint}</span>}
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}

export function fieldClass(error?: { message?: string }) {
  return error ? `${styles.input} ${styles.inputError}` : styles.input;
}

export function isConflictMessage(message: string) {
  return /\b412\b/.test(message) || /precondition|conflict|etag/i.test(message);
}
