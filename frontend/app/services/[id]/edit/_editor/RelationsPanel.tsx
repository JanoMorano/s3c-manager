'use client';

import styles from '../editor.module.css';
import { relationTypeLabelKey, relationTypeOptions } from '@/features/services/relationTypes';
import { Field } from './EditorFields';
import type { useRelationEditor } from './useRelationEditor';
import type { Translate } from './EditorFields';
import type { ServiceDetail } from '@/features/services/model/service.types';
import type { ServiceListResponse } from '@/features/services/model/service.types';

/** Relations of the service: outgoing and incoming list, inline edit, add. */
export function RelationsPanel({ id, t, relations, svc, servicePickerOptions }: {
  id: string;
  t: Translate;
  relations: ReturnType<typeof useRelationEditor>;
  svc: ServiceDetail;
  servicePickerOptions: ServiceListResponse['items'];
}) {
  const {
    relBusy,
    relError,
    showRelAdd,
    setShowRelAdd,
    relForm,
    setRelForm,
    editRelId,
    setEditRelId,
    editRelForm,
    setEditRelForm,
    handleRelAdd,
    handleRelEditOpen,
    handleRelEditSave,
    handleRelDelete,
  } = relations;
  return (
    <>
      {relError && <div className={styles.errorBanner}>{relError}</div>}

      {svc.relations && svc.relations.length > 0 ? (
        <div className={styles.relMgmtList}>
          {svc.relations.map(r => (
            <div key={r.id}>
              {editRelId === r.id ? (
                /* ── Inline edit form ─────────────────────────────── */
                <div className={styles.relAddForm}>
                  <div className={styles.fieldRow}>
                    <Field label="Relation Type">
                      <select className={styles.input} value={editRelForm.relation_type ?? r.relation_type}
                        onChange={e => setEditRelForm(p => ({ ...p, relation_type: e.target.value }))}>
                        {relationTypeOptions(r.relation_type).map(code => <option key={code} value={code}>{t(relationTypeLabelKey(code))}</option>)}
                      </select>
                    </Field>
                    <Field label="Impact Mode">
                      <select className={styles.input} value={editRelForm.impact_mode ?? r.impact_mode ?? ''}
                        onChange={e => setEditRelForm(p => ({ ...p, impact_mode: e.target.value || null }))}>
                        <option value="">— none —</option>
                        <option value="hard_stop">hard_stop</option>
                        <option value="degraded">degraded</option>
                        <option value="informational">informational</option>
                      </select>
                    </Field>
                    <Field label="Impact Level">
                      <select className={styles.input} value={editRelForm.impact_level ?? r.impact_level ?? ''}
                        onChange={e => setEditRelForm(p => ({ ...p, impact_level: e.target.value || null }))}>
                        <option value="">— none —</option>
                        <option value="high">high</option>
                        <option value="medium">medium</option>
                        <option value="low">low</option>
                      </select>
                    </Field>
                  </div>
                  <div className={styles.fieldRow}>
                    <Field label="Label (optional)">
                      <input className={styles.input} value={editRelForm.relation_label ?? r.relation_label ?? ''}
                        onChange={e => setEditRelForm(p => ({ ...p, relation_label: e.target.value || undefined }))} />
                    </Field>
                    <Field label="PACE Code">
                      <select className={styles.input} value={editRelForm.pace_code ?? r.pace_code ?? ''}
                        onChange={e => setEditRelForm(p => ({ ...p, pace_code: e.target.value || null }))}>
                        <option value="">—</option>
                        <option value="P">P – Primary</option>
                        <option value="A">A – Alternate</option>
                        <option value="C">C – Contingency</option>
                        <option value="E">E – Emergency</option>
                      </select>
                    </Field>
                    <Field label="Verified">
                      <select className={styles.input}
                        value={editRelForm.is_verified != null ? String(editRelForm.is_verified) : (r.is_verified != null ? String(r.is_verified) : '')}
                        onChange={e => setEditRelForm(p => ({ ...p, is_verified: e.target.value === '' ? null : e.target.value === 'true' }))}>
                        <option value="">— unset —</option>
                        <option value="true">Verified</option>
                        <option value="false">Not verified</option>
                      </select>
                    </Field>
                  </div>
                  <div className={styles.flavourEditActions}>
                    <button type="button" className={styles.btnPrimary} onClick={handleRelEditSave} disabled={relBusy}>Save</button>
                    <button type="button" className={styles.btnGhost} onClick={() => { setEditRelId(null); setEditRelForm({}); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                /* ── Read row ─────────────────────────────────────── */
                <div className={styles.relMgmtRow}>
                  <span className={styles.relTypeChip}>{t(relationTypeLabelKey(r.relation_type))}</span>
                  <a href={`/services/${r.to_service_id}`} className={styles.link}>
                    {r.to_title ? `${r.to_title} (${r.to_service_id})` : r.to_service_id}
                  </a>
                  {r.relation_label && <span className={styles.relBadge}>{r.relation_label}</span>}
                  {r.impact_mode && r.impact_mode !== 'none' && <span className={styles.relBadge}>{r.impact_mode}</span>}
                  {r.pace_code && <span className={styles.relBadge}>pace:{r.pace_code}</span>}
                  {r.is_inferred && <span className={styles.relBadge}>inferred</span>}
                  {r.is_verified && <span className={styles.relBadgeGreen}>verified</span>}
                  <button type="button" className={styles.btnSmall} onClick={() => handleRelEditOpen(r)} disabled={relBusy} style={{ marginLeft: 'auto' }}>Edit</button>
                  <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => handleRelDelete(r.id)} disabled={relBusy}>Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.hint}>No relationships defined.</p>
      )}

      {showRelAdd ? (
        <div className={styles.relAddForm}>
          <Field label="Target Service ID">
            <select className={styles.input} value={relForm.to_service_id ?? ''}
              onChange={e => setRelForm(p => ({ ...p, to_service_id: e.target.value }))}>
              <option value="">— select service —</option>
              {servicePickerOptions.map(s => (
                <option key={s.service_id} value={s.service_id}>
                  {s.service_id} — {s.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Relation Type">
            <select className={styles.input} value={relForm.relation_type} onChange={e => setRelForm(p => ({ ...p, relation_type: e.target.value }))}>
              {relationTypeOptions().map(code => <option key={code} value={code}>{t(relationTypeLabelKey(code))}</option>)}
            </select>
          </Field>
          <Field label="Label (optional)">
            <input className={styles.input} placeholder="e.g. approval dependency" value={relForm.relation_label} onChange={e => setRelForm(p => ({ ...p, relation_label: e.target.value }))} />
          </Field>
          <div className={styles.flavourEditActions}>
            <button type="button" className={styles.btnPrimary} onClick={handleRelAdd} disabled={relBusy}>Add relation</button>
            <button type="button" className={styles.btnGhost} onClick={() => setShowRelAdd(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.btnSecondary} onClick={() => setShowRelAdd(true)} style={{ marginTop: 'var(--space-3)' }}>
          + Add relationship
        </button>
      )}
      <p className={styles.hint} style={{ marginTop: 'var(--space-3)' }}>
        <a href={`/services/${id}/graph`} className={styles.link}>View full dependency graph →</a>
      </p>
    </>
  );
}
