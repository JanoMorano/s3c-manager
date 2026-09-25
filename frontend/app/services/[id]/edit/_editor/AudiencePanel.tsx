'use client';

import styles from '../editor.module.css';
import { Field } from './EditorFields';
import { emptyAudiencePolicy, updateAudienceDraft } from './drafts';
import type { useServiceModelEditor } from './useServiceModelEditor';
import { useT } from '@/app/i18n/useI18n';

/** Audience policies of the service and its offerings. */
export function AudiencePanel({ model }: {
  model: ReturnType<typeof useServiceModelEditor>;
}) {
  const t = useT();
  const {
    offerings,
    audiencePolicies,
    setAudiencePolicies,
    audienceBusy,
    audienceError,
    handleAudienceSave,
  } = model;
  return (
    <>
      {audienceError && <div className={styles.errorBanner}>{audienceError}</div>}
      <p className={styles.hint}>
        {t('service_editor.text.audience_segmentation_used_for_requestability_an')}
      </p>
      <div className={styles.phase4Stack}>
        {audiencePolicies.map((item, index) => (
          <div key={`audience-${index}`} className={styles.phase4Card}>
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.offering')}>
                <select className={styles.input} value={item.offering_id ?? ''} onChange={e => updateAudienceDraft(setAudiencePolicies, index, 'offering_id', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">{t('service_editor.text.service_level')}</option>
                  {offerings.map((offering) => (
                    <option key={offering.id} value={offering.id}>{offering.title} ({offering.offering_code})</option>
                  ))}
                </select>
              </Field>
              <Field label={t('service_editor.text.audience_type')}>
                <input className={styles.input} value={item.audience_type ?? ''} onChange={e => updateAudienceDraft(setAudiencePolicies, index, 'audience_type', e.target.value || null)} />
              </Field>
              <Field label={t('service_editor.text.business_unit')}>
                <input className={styles.input} value={item.business_unit ?? ''} onChange={e => updateAudienceDraft(setAudiencePolicies, index, 'business_unit', e.target.value || null)} />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.region')}>
                <input className={styles.input} value={item.region_code ?? ''} onChange={e => updateAudienceDraft(setAudiencePolicies, index, 'region_code', e.target.value || null)} />
              </Field>
            </div>
            <Field label={t('service_editor.text.eligibility_rule')}>
              <textarea className={styles.textarea} rows={2} value={item.eligibility_rule ?? ''} onChange={e => updateAudienceDraft(setAudiencePolicies, index, 'eligibility_rule', e.target.value || null)} />
            </Field>
            <Field label={t('service_editor.text.notes')}>
              <textarea className={styles.textarea} rows={2} value={item.notes ?? ''} onChange={e => updateAudienceDraft(setAudiencePolicies, index, 'notes', e.target.value || null)} />
            </Field>
            <div className={styles.flavourEditActions}>
              <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => setAudiencePolicies((items) => items.filter((_, currentIndex) => currentIndex !== index))}>
                {t('service_editor.text.remove_row')}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.flavourEditActions}>
        <button type="button" className={styles.btnSecondary} onClick={() => setAudiencePolicies((items) => [...items, emptyAudiencePolicy()])}>
          {t('service_editor.text.add_audience_row')}
        </button>
        <button type="button" className={styles.btnPrimary} onClick={handleAudienceSave} disabled={audienceBusy}>
          {audienceBusy ? t('service_editor.text.saving') : t('service_editor.text.save_audience_policies')}
        </button>
      </div>
    </>
  );
}
