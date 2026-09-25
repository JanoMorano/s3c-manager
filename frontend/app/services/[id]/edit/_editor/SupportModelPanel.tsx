'use client';

import styles from '../editor.module.css';
import { Field } from './EditorFields';
import { emptySupportModel, updateSupportDraft } from './drafts';
import type { useServiceModelEditor } from './useServiceModelEditor';

/** Support model records of the service and its offerings. */
export function SupportModelPanel({ model, watchedRequestable }: {
  model: ReturnType<typeof useServiceModelEditor>;
  watchedRequestable: boolean | undefined;
}) {
  const {
    offerings,
    supportModels,
    setSupportModels,
    supportBusy,
    supportError,
    handleSupportSave,
  } = model;
  return (
    <>
      {supportError && <div className={styles.errorBanner}>{supportError}</div>}
      <p className={styles.hint}>
        Structured support metadata used by the business-facing service detail.
      </p>
      <div className={styles.phase4Stack}>
        {supportModels.map((item, index) => (
          <div key={`support-${index}`} className={styles.phase4Card}>
            <div className={styles.fieldRow}>
              <Field label="Offering">
                <select className={styles.input} value={item.offering_id ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'offering_id', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— service level —</option>
                  {offerings.map((offering) => (
                    <option key={offering.id} value={offering.id}>{offering.title} ({offering.offering_code})</option>
                  ))}
                </select>
              </Field>
              <Field label="Support Owner">
                <input className={styles.input} value={item.support_owner_name ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'support_owner_name', e.target.value || null)} />
              </Field>
              <Field label="Resolver Group">
                <input className={styles.input} value={item.resolver_group ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'resolver_group', e.target.value || null)} />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Support Hours">
                <input className={styles.input} value={item.support_hours_code ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'support_hours_code', e.target.value || null)} />
              </Field>
              <Field label="Support Channel">
                <input className={styles.input} value={item.support_channel ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'support_channel', e.target.value || null)} />
              </Field>
              <Field label="Review Cadence">
                <input className={styles.input} value={item.review_cadence ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'review_cadence', e.target.value || null)} />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Escalation Path">
                <textarea className={styles.textarea} rows={2} value={item.escalation_path ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'escalation_path', e.target.value || null)} />
              </Field>
              <Field label="Maintenance Window">
                <textarea className={styles.textarea} rows={2} value={item.maintenance_window ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'maintenance_window', e.target.value || null)} />
              </Field>
            </div>
            <div className={styles.flavourEditActions}>
              <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => setSupportModels((items) => items.filter((_, currentIndex) => currentIndex !== index))}>
                Remove row
              </button>
            </div>
          </div>
        ))}
        {supportModels.length === 0 && watchedRequestable && (
          <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
            <span className={styles.crossFieldAlertIcon}>⚠</span>
            Service is requestable — a support model is required so consumers know who to contact.
          </div>
        )}
        {supportModels.length > 0 && supportModels.some(m => !m.support_owner_name && !m.resolver_group) && (
          <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
            <span className={styles.crossFieldAlertIcon}>⚠</span>
            Some support rows are missing both Support Owner and Resolver Group. At least one identifier is recommended.
          </div>
        )}
      </div>
      <div className={styles.flavourEditActions}>
        <button type="button" className={styles.btnSecondary} onClick={() => setSupportModels((items) => [...items, emptySupportModel()])}>
          + Add support row
        </button>
        <button type="button" className={styles.btnPrimary} onClick={handleSupportSave} disabled={supportBusy}>
          {supportBusy ? 'Saving…' : 'Save support model'}
        </button>
      </div>
    </>
  );
}
