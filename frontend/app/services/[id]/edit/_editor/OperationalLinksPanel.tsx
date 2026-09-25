'use client';

import styles from '../editor.module.css';
import { OPERATIONAL_LINK_TYPES } from './schema';
import { Field } from './EditorFields';
import type { useServiceModelEditor } from './useServiceModelEditor';

/** Operational links (knowledge, incidents, monitoring, …) of the service. */
export function OperationalLinksPanel({ model }: {
  model: ReturnType<typeof useServiceModelEditor>;
}) {
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
                  <Field label="Offering">
                    <select className={styles.input} value={linkForm.offering_id ?? ''} onChange={e => setLinkForm((current) => ({ ...current, offering_id: e.target.value ? Number(e.target.value) : null }))}>
                      <option value="">— service level —</option>
                      {offerings.map((offering) => (
                        <option key={offering.id} value={offering.id}>{offering.title} ({offering.offering_code})</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Link Type">
                    <select className={styles.input} value={linkForm.link_type ?? ''} onChange={e => setLinkForm((current) => ({ ...current, link_type: e.target.value || null }))}>
                      <option value="">— select type —</option>
                      {OPERATIONAL_LINK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Sort Order">
                    <input className={styles.input} type="number" value={linkForm.sort_order ?? ''} onChange={e => setLinkForm((current) => ({ ...current, sort_order: e.target.value ? Number(e.target.value) : null }))} />
                  </Field>
                </div>
                <div className={styles.fieldRow}>
                  <Field label="Title">
                    <input className={styles.input} value={linkForm.title ?? ''} onChange={e => setLinkForm((current) => ({ ...current, title: e.target.value }))} />
                  </Field>
                  <Field label="URL">
                    <input className={styles.input} value={linkForm.url ?? ''} onChange={e => setLinkForm((current) => ({ ...current, url: e.target.value }))} />
                  </Field>
                </div>
                <div className={styles.flavourEditActions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleLinkSave} disabled={linkBusy}>Save</button>
                  <button type="button" className={styles.btnGhost} onClick={() => { setEditLinkId(null); setLinkForm({}); }}>Cancel</button>
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
                }}>Edit</button>
                <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => handleLinkDelete(link.id)} disabled={linkBusy}>Delete</button>
              </div>
            )
          ))}
        </div>
      ) : null}

      {showLinkAdd && editLinkId == null ? (
        <div className={styles.phase4Card}>
          <div className={styles.fieldRow}>
            <Field label="Offering">
              <select className={styles.input} value={linkForm.offering_id ?? ''} onChange={e => setLinkForm((current) => ({ ...current, offering_id: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">— service level —</option>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>{offering.title} ({offering.offering_code})</option>
                ))}
              </select>
            </Field>
            <Field label="Link Type">
              <input className={styles.input} value={linkForm.link_type ?? ''} onChange={e => setLinkForm((current) => ({ ...current, link_type: e.target.value || null }))} />
            </Field>
            <Field label="Sort Order">
              <input className={styles.input} type="number" value={linkForm.sort_order ?? ''} onChange={e => setLinkForm((current) => ({ ...current, sort_order: e.target.value ? Number(e.target.value) : null }))} />
            </Field>
          </div>
          <div className={styles.fieldRow}>
            <Field label="Title">
              <input className={styles.input} value={linkForm.title ?? ''} onChange={e => setLinkForm((current) => ({ ...current, title: e.target.value }))} />
            </Field>
            <Field label="URL">
              <input className={styles.input} value={linkForm.url ?? ''} onChange={e => setLinkForm((current) => ({ ...current, url: e.target.value }))} />
            </Field>
          </div>
          <div className={styles.flavourEditActions}>
            <button type="button" className={styles.btnPrimary} onClick={handleLinkSave} disabled={linkBusy}>Add link</button>
            <button type="button" className={styles.btnGhost} onClick={() => { setShowLinkAdd(false); setLinkForm({}); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.btnSecondary} onClick={() => { setShowLinkAdd(true); setEditLinkId(null); setLinkForm({}); }}>
          + Add operational link
        </button>
      )}
    </>
  );
}
