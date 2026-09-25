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
                    <Field label={t('service_editor.text.relation_type')}>
                      <select className={styles.input} value={editRelForm.relation_type ?? r.relation_type}
                        onChange={e => setEditRelForm(p => ({ ...p, relation_type: e.target.value }))}>
                        {relationTypeOptions(r.relation_type).map(code => <option key={code} value={code}>{t(relationTypeLabelKey(code))}</option>)}
                      </select>
                    </Field>
                    <Field label={t('service_editor.text.impact_mode')}>
                      <select className={styles.input} value={editRelForm.impact_mode ?? r.impact_mode ?? ''}
                        onChange={e => setEditRelForm(p => ({ ...p, impact_mode: e.target.value || null }))}>
                        <option value="">{t('service_editor.text.none')}</option>
                        <option value="hard_stop">hard_stop</option>
                        <option value="degraded">degraded</option>
                        <option value="informational">informational</option>
                      </select>
                    </Field>
                    <Field label={t('service_editor.text.impact_level')}>
                      <select className={styles.input} value={editRelForm.impact_level ?? r.impact_level ?? ''}
                        onChange={e => setEditRelForm(p => ({ ...p, impact_level: e.target.value || null }))}>
                        <option value="">{t('service_editor.text.none')}</option>
                        <option value="high">high</option>
                        <option value="medium">medium</option>
                        <option value="low">low</option>
                      </select>
                    </Field>
                  </div>
                  <div className={styles.fieldRow}>
                    <Field label={t('service_editor.text.label_optional')}>
                      <input className={styles.input} value={editRelForm.relation_label ?? r.relation_label ?? ''}
                        onChange={e => setEditRelForm(p => ({ ...p, relation_label: e.target.value || undefined }))} />
                    </Field>
                    <Field label={t('service_editor.text.pace_code')}>
                      <select className={styles.input} value={editRelForm.pace_code ?? r.pace_code ?? ''}
                        onChange={e => setEditRelForm(p => ({ ...p, pace_code: e.target.value || null }))}>
                        <option value="">—</option>
                        <option value="P">{t('service_editor.text.p_primary')}</option>
                        <option value="A">{t('service_editor.text.a_alternate')}</option>
                        <option value="C">{t('service_editor.text.c_contingency')}</option>
                        <option value="E">{t('service_editor.text.e_emergency')}</option>
                      </select>
                    </Field>
                    <Field label={t('service_editor.text.verified')}>
                      <select className={styles.input}
                        value={editRelForm.is_verified != null ? String(editRelForm.is_verified) : (r.is_verified != null ? String(r.is_verified) : '')}
                        onChange={e => setEditRelForm(p => ({ ...p, is_verified: e.target.value === '' ? null : e.target.value === 'true' }))}>
                        <option value="">{t('service_editor.text.unset')}</option>
                        <option value="true">{t('service_editor.text.verified')}</option>
                        <option value="false">{t('service_editor.text.not_verified')}</option>
                      </select>
                    </Field>
                  </div>
                  <div className={styles.flavourEditActions}>
                    <button type="button" className={styles.btnPrimary} onClick={handleRelEditSave} disabled={relBusy}>{t('service_editor.text.save')}</button>
                    <button type="button" className={styles.btnGhost} onClick={() => { setEditRelId(null); setEditRelForm({}); }}>{t('service_editor.text.cancel')}</button>
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
                  <button type="button" className={styles.btnSmall} onClick={() => handleRelEditOpen(r)} disabled={relBusy} style={{ marginLeft: 'auto' }}>{t('service_editor.text.edit')}</button>
                  <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => handleRelDelete(r.id)} disabled={relBusy}>{t('service_editor.text.remove')}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.hint}>{t('service_editor.text.no_relationships_defined')}</p>
      )}

      {showRelAdd ? (
        <div className={styles.relAddForm}>
          <Field label={t('service_editor.text.target_service_id')}>
            <select className={styles.input} value={relForm.to_service_id ?? ''}
              onChange={e => setRelForm(p => ({ ...p, to_service_id: e.target.value }))}>
              <option value="">{t('service_editor.text.select_service')}</option>
              {servicePickerOptions.map(s => (
                <option key={s.service_id} value={s.service_id}>
                  {s.service_id} — {s.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('service_editor.text.relation_type')}>
            <select className={styles.input} value={relForm.relation_type} onChange={e => setRelForm(p => ({ ...p, relation_type: e.target.value }))}>
              {relationTypeOptions().map(code => <option key={code} value={code}>{t(relationTypeLabelKey(code))}</option>)}
            </select>
          </Field>
          <Field label={t('service_editor.text.label_optional')}>
            <input className={styles.input} placeholder={t('service_editor.text.e_g_approval_dependency')} value={relForm.relation_label} onChange={e => setRelForm(p => ({ ...p, relation_label: e.target.value }))} />
          </Field>
          <div className={styles.flavourEditActions}>
            <button type="button" className={styles.btnPrimary} onClick={handleRelAdd} disabled={relBusy}>{t('service_editor.text.add_relation')}</button>
            <button type="button" className={styles.btnGhost} onClick={() => setShowRelAdd(false)}>{t('service_editor.text.cancel')}</button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.btnSecondary} onClick={() => setShowRelAdd(true)} style={{ marginTop: 'var(--space-3)' }}>
          {t('service_editor.text.add_relationship')}
        </button>
      )}
      <p className={styles.hint} style={{ marginTop: 'var(--space-3)' }}>
        <a href={`/services/${id}/graph`} className={styles.link}>{t('service_editor.text.view_full_dependency_graph')}</a>
      </p>
    </>
  );
}
