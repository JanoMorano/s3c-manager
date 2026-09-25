'use client';

import styles from '../editor.module.css';
import { OPERATIONAL_LINK_TYPES } from './schema';
import { Field } from './EditorFields';
import type { useServiceModelEditor } from './useServiceModelEditor';
import { useT } from '@/app/i18n/useI18n';

/** Operational links (knowledge, incidents, monitoring, …) of the service. */
export function OperationalLinksPanel({ model }: {
  model: ReturnType<typeof useServiceModelEditor>;
}) {
  const t = useT();
  const {
    offerings,
    operationalLinks,
    linkBusy,
    linkError,
    editLinkId,
    setEditLinkId,
    showLinkAdd,
    setShowLinkAdd,
    linkForm,
    setLinkForm,
    handleLinkSave,
    handleLinkDelete,
  } = model;
  return (
    <>
      {linkError && <div className={styles.errorBanner}>{linkError}</div>}
      {operationalLinks.length > 0 ? (
        <div className={styles.phase4Stack}>
          {operationalLinks.map((link) => (
            editLinkId === link.id ? (
              <div key={link.id} className={styles.phase4Card}>
                <div className={styles.fieldRow}>
                  <Field label={t('service_editor.text.offering')}>
                    <select className={styles.input} value={linkForm.offering_id ?? ''} onChange={e => setLinkForm((current) => ({ ...current, offering_id: e.target.value ? Number(e.target.value) : null }))}>
                      <option value="">{t('service_editor.text.service_level')}</option>
                      {offerings.map((offering) => (
                        <option key={offering.id} value={offering.id}>{offering.title} ({offering.offering_code})</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('service_editor.text.link_type')}>
                    <select className={styles.input} value={linkForm.link_type ?? ''} onChange={e => setLinkForm((current) => ({ ...current, link_type: e.target.value || null }))}>
                      <option value="">{t('service_editor.text.select_type')}</option>
                      {OPERATIONAL_LINK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label={t('service_editor.text.sort_order')}>
                    <input className={styles.input} type="number" value={linkForm.sort_order ?? ''} onChange={e => setLinkForm((current) => ({ ...current, sort_order: e.target.value ? Number(e.target.value) : null }))} />
                  </Field>
                </div>
                <div className={styles.fieldRow}>
                  <Field label={t('service_editor.text.title_2')}>
                    <input className={styles.input} value={linkForm.title ?? ''} onChange={e => setLinkForm((current) => ({ ...current, title: e.target.value }))} />
                  </Field>
                  <Field label="URL">
                    <input className={styles.input} value={linkForm.url ?? ''} onChange={e => setLinkForm((current) => ({ ...current, url: e.target.value }))} />
                  </Field>
                </div>
                <div className={styles.flavourEditActions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleLinkSave} disabled={linkBusy}>{t('service_editor.text.save')}</button>
                  <button type="button" className={styles.btnGhost} onClick={() => { setEditLinkId(null); setLinkForm({}); }}>{t('service_editor.text.cancel')}</button>
                </div>
              </div>
            ) : (
              <div key={link.id} className={styles.phase4Row}>
                <div className={styles.phase4Summary}>
                  <strong>{link.title}</strong>
                  <a href={link.url} target="_blank" rel="noreferrer" className={styles.link}>{link.url}</a>
                  <span className={styles.phase4Meta}>
                    {link.link_type ?? 'link'}{link.sort_order != null ? ` · order ${link.sort_order}` : ''}
                  </span>
                </div>
                <button type="button" className={styles.btnSmall} onClick={() => {
                  setEditLinkId(link.id);
                  setLinkForm({
                    offering_id: link.offering_id,
                    link_type: link.link_type,
                    title: link.title,
                    url: link.url,
                    sort_order: link.sort_order,
                  });
                }}>{t('service_editor.text.edit')}</button>
                <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => handleLinkDelete(link.id)} disabled={linkBusy}>{t('service_editor.text.delete')}</button>
              </div>
            )
          ))}
        </div>
      ) : null}

      {showLinkAdd && editLinkId == null ? (
        <div className={styles.phase4Card}>
          <div className={styles.fieldRow}>
            <Field label={t('service_editor.text.offering')}>
              <select className={styles.input} value={linkForm.offering_id ?? ''} onChange={e => setLinkForm((current) => ({ ...current, offering_id: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">{t('service_editor.text.service_level')}</option>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>{offering.title} ({offering.offering_code})</option>
                ))}
              </select>
            </Field>
            <Field label={t('service_editor.text.link_type')}>
              <input className={styles.input} value={linkForm.link_type ?? ''} onChange={e => setLinkForm((current) => ({ ...current, link_type: e.target.value || null }))} />
            </Field>
            <Field label={t('service_editor.text.sort_order')}>
              <input className={styles.input} type="number" value={linkForm.sort_order ?? ''} onChange={e => setLinkForm((current) => ({ ...current, sort_order: e.target.value ? Number(e.target.value) : null }))} />
            </Field>
          </div>
          <div className={styles.fieldRow}>
            <Field label={t('service_editor.text.title_2')}>
              <input className={styles.input} value={linkForm.title ?? ''} onChange={e => setLinkForm((current) => ({ ...current, title: e.target.value }))} />
            </Field>
            <Field label="URL">
              <input className={styles.input} value={linkForm.url ?? ''} onChange={e => setLinkForm((current) => ({ ...current, url: e.target.value }))} />
            </Field>
          </div>
          <div className={styles.flavourEditActions}>
            <button type="button" className={styles.btnPrimary} onClick={handleLinkSave} disabled={linkBusy}>{t('service_editor.text.add_link')}</button>
            <button type="button" className={styles.btnGhost} onClick={() => { setShowLinkAdd(false); setLinkForm({}); }}>{t('service_editor.text.cancel')}</button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.btnSecondary} onClick={() => { setShowLinkAdd(true); setEditLinkId(null); setLinkForm({}); }}>
          {t('service_editor.text.add_operational_link')}
        </button>
      )}
    </>
  );
}
