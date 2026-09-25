'use client';

import styles from '../editor.module.css';
import { OfferingFormFields, type OfferingInheritedValues } from './EditorFields';
import type { useServiceModelEditor } from './useServiceModelEditor';
import type { Translate } from './EditorFields';

/** Offerings of the service: list, reorder, default, inline edit and add. */
export function OfferingsPanel({ t, model, inherited }: {
  t: Translate;
  model: ReturnType<typeof useServiceModelEditor>;
  inherited: OfferingInheritedValues;
}) {
  const {
    offerings,
    offeringBusy,
    offeringError,
    editOfferingId,
    setEditOfferingId,
    showOfferingAdd,
    setShowOfferingAdd,
    offeringForm,
    setOfferingForm,
    sortedOfferings,
    defaultOffering,
    handleOfferingSave,
    handleOfferingMakeDefault,
    handleOfferingReorder,
    handleOfferingDelete,
  } = model;
  return (
    <>
      {offeringError && <div className={styles.errorBanner}>{offeringError}</div>}
      {offerings.length > 0 && !defaultOffering && (
        <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
          <span className={styles.crossFieldAlertIcon}>!</span>
          Select one default offering before publish. The default is shown first in catalogue and Service 360.
        </div>
      )}
      {offerings.length > 0 ? (
        <div className={styles.flavourList}>
          {sortedOfferings.map((offering, offeringIndex) => (
            editOfferingId === offering.id ? (
              <div key={offering.id} className={styles.phase4Card}>
                <OfferingFormFields form={offeringForm} setForm={setOfferingForm} inherited={inherited} t={t} allowEmptyStatus />
                <div className={styles.flavourEditActions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleOfferingSave} disabled={offeringBusy}>Save</button>
                  <button type="button" className={styles.btnGhost} onClick={() => { setEditOfferingId(null); setOfferingForm({}); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div key={offering.id} className={styles.phase4Row}>
                <div className={styles.phase4Summary}>
                  <strong>{offering.title}</strong>
                  <span className={styles.phase4Meta}>
                    {offering.offering_code} · {offering.status} · {(offering.effective_requestable ?? offering.requestable) ? 'requestable' : 'not requestable'}{offering.requestable == null ? ` (${t('service_editor.offering.inherited_short')})` : ''}
                  </span>
                  {offering.description && <span className={styles.phase4Hint}>{offering.description}</span>}
                </div>
                {offering.is_default && <span className={styles.relBadgeGreen}>default</span>}
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.btnSmall}
                    onClick={() => handleOfferingReorder(offering.id, -1)}
                    disabled={offeringBusy || offeringIndex === 0}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className={styles.btnSmall}
                    onClick={() => handleOfferingReorder(offering.id, 1)}
                    disabled={offeringBusy || offeringIndex === sortedOfferings.length - 1}
                  >
                    Down
                  </button>
                  {!offering.is_default && (
                    <button type="button" className={styles.btnSmall} onClick={() => handleOfferingMakeDefault(offering)} disabled={offeringBusy}>
                      Make default
                    </button>
                  )}
                </div>
                <button type="button" className={styles.btnSmall} onClick={() => {
                  setEditOfferingId(offering.id);
                  setOfferingForm({
                    offering_code: offering.offering_code,
                    title: offering.title,
                    description: offering.description,
                    is_default: offering.is_default,
                    requestable: offering.requestable,
                    approval_required: offering.approval_required,
                    request_channel_type: offering.request_channel_type,
                    request_channel_url: offering.request_channel_url,
                    lead_time_text: offering.lead_time_text,
                    support_tier_code: offering.support_tier_code,
                    status: offering.status,
                    display_order: offering.display_order,
                  });
                }}>Edit</button>
                <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => handleOfferingDelete(offering.id)} disabled={offeringBusy}>Delete</button>
              </div>
            )
          ))}
        </div>
      ) : null}

      {showOfferingAdd && editOfferingId == null ? (
        <div className={styles.phase4Card}>
          <OfferingFormFields form={offeringForm} setForm={setOfferingForm} inherited={inherited} t={t} />
          <div className={styles.flavourEditActions}>
            <button type="button" className={styles.btnPrimary} onClick={handleOfferingSave} disabled={offeringBusy}>Add offering</button>
            <button type="button" className={styles.btnGhost} onClick={() => { setShowOfferingAdd(false); setOfferingForm({}); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.btnSecondary} onClick={() => { setShowOfferingAdd(true); setEditOfferingId(null); setOfferingForm({ status: 'draft', requestable: null, approval_required: null, is_default: offerings.length === 0, display_order: sortedOfferings.length + 1 }); }} style={{ marginTop: 'var(--space-3)' }}>
          + Add service offering
        </button>
      )}
    </>
  );
}
