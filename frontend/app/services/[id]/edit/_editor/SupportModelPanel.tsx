'use client';

import styles from '../editor.module.css';
import { Field } from './EditorFields';
import { emptySupportModel, updateSupportDraft } from './drafts';
import type { useServiceModelEditor } from './useServiceModelEditor';
import { useT } from '@/app/i18n/useI18n';

/** Support model records of the service and its offerings. */
export function SupportModelPanel({ model, watchedRequestable }: {
  model: ReturnType<typeof useServiceModelEditor>;
  watchedRequestable: boolean | undefined;
}) {
  const t = useT();
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
        {t('service_editor.text.structured_support_metadata_used_by_the_business')}
      </p>
      <div className={styles.phase4Stack}>
        {supportModels.map((item, index) => (
          <div key={`support-${index}`} className={styles.phase4Card}>
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.offering')}>
                <select className={styles.input} value={item.offering_id ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'offering_id', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">{t('service_editor.text.service_level')}</option>
                  {offerings.map((offering) => (
                    <option key={offering.id} value={offering.id}>{offering.title} ({offering.offering_code})</option>
                  ))}
                </select>
              </Field>
              <Field label={t('service_editor.text.support_owner')}>
                <input className={styles.input} value={item.support_owner_name ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'support_owner_name', e.target.value || null)} />
              </Field>
              <Field label={t('service_editor.text.resolver_group')}>
                <input className={styles.input} value={item.resolver_group ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'resolver_group', e.target.value || null)} />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.support_hours')}>
                <input className={styles.input} value={item.support_hours_code ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'support_hours_code', e.target.value || null)} />
              </Field>
              <Field label={t('service_editor.text.support_channel')}>
                <input className={styles.input} value={item.support_channel ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'support_channel', e.target.value || null)} />
              </Field>
              <Field label={t('service_editor.text.review_cadence')}>
                <input className={styles.input} value={item.review_cadence ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'review_cadence', e.target.value || null)} />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.escalation_path')}>
                <textarea className={styles.textarea} rows={2} value={item.escalation_path ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'escalation_path', e.target.value || null)} />
              </Field>
              <Field label={t('service_editor.text.maintenance_window')}>
                <textarea className={styles.textarea} rows={2} value={item.maintenance_window ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'maintenance_window', e.target.value || null)} />
              </Field>
            </div>
            <div className={styles.flavourEditActions}>
              <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => setSupportModels((items) => items.filter((_, currentIndex) => currentIndex !== index))}>
                {t('service_editor.text.remove_row')}
              </button>
            </div>
          </div>
        ))}
        {supportModels.length === 0 && watchedRequestable && (
          <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
            <span className={styles.crossFieldAlertIcon}>⚠</span>
            {t('service_editor.text.service_is_requestable_a_support_model_is_requir')}
          </div>
        )}
        {supportModels.length > 0 && supportModels.some(m => !m.support_owner_name && !m.resolver_group) && (
          <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
            <span className={styles.crossFieldAlertIcon}>⚠</span>
            {t('service_editor.text.some_support_rows_are_missing_both_support_owner')}
          </div>
        )}
      </div>
      <div className={styles.flavourEditActions}>
        <button type="button" className={styles.btnSecondary} onClick={() => setSupportModels((items) => [...items, emptySupportModel()])}>
          {t('service_editor.text.add_support_row')}
        </button>
        <button type="button" className={styles.btnPrimary} onClick={handleSupportSave} disabled={supportBusy}>
          {supportBusy ? t('service_editor.text.saving') : t('service_editor.text.save_support_model')}
        </button>
      </div>
    </>
  );
}
