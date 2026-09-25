'use client';

import Link from '@/app/components/AppLink';
import styles from '../editor.module.css';
import { Field } from './EditorFields';
import type { useC3MappingEditor } from './useC3MappingEditor';
import type { Translate } from './EditorFields';
import type { ServiceReadiness } from '@/features/services/model/service.types';
import type { C3TaxonomyItem } from '@/features/services/hooks/useServices';

/** C3 readiness summary and capability mappings with the coverage preview of a new mapping. */
export function C3MappingPanel({ t, c3, c3ItemMap, readiness }: {
  t: Translate;
  c3: ReturnType<typeof useC3MappingEditor>;
  c3ItemMap: Map<string, C3TaxonomyItem>;
  readiness: ServiceReadiness | undefined;
}) {
  const {
    c3Mappings,
    c3Busy,
    c3Error,
    showC3Add,
    setShowC3Add,
    c3Form,
    setC3Form,
    c3Preview,
    c3PreviewBusy,
    c3PreviewError,
    level3Capabilities,
    handleC3Add,
    handleC3Delete,
  } = c3;
  return (
    <>
      <div id="c3mapping" className={styles.inlineEditorBody}>
      {c3Error && <div className={styles.errorBanner}>{c3Error}</div>}
      {readiness && (
        <div className={styles.readinessCard}>
          <div className={styles.readinessHeader}>
            <span className={styles.readinessTitle}>{t('service_editor.c3.readiness.title')}</span>
            <span className={readiness.is_publishable ? styles.readinessOk : styles.readinessBlocked}>
              {readiness.is_publishable ? t('service_editor.c3.readiness.ready') : t('service_editor.c3.readiness.blocked')}
            </span>
          </div>
          <div className={styles.readinessMeta}>
            <span>{t('service_editor.c3.readiness.primary_mapping')}: {readiness.primary_mapping_count}</span>
            <span>{t('service_editor.c3.readiness.capability_status')}: {readiness.primary_c3_completeness_status}</span>
            <span>{t('service_editor.c3.readiness.active_flavours')}: {readiness.active_flavour_count}</span>
          </div>
          {readiness.blockers.length > 0 && (
            <div className={styles.readinessBlock}>
              <strong>{t('service_editor.c3.readiness.blockers')}</strong>
              <ul className={styles.readinessList}>
                {readiness.blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {readiness.warnings.length > 0 && (
            <div className={styles.readinessWarn}>
              <strong>{t('service_editor.c3.readiness.warnings')}</strong>
              <ul className={styles.readinessList}>
                {readiness.warnings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {c3Mappings.length > 0 ? (
        <div className={styles.relMgmtList}>
          {c3Mappings.map(m => (
            <div key={m.id} className={styles.relMgmtRow}>
              <span className={styles.relTypeChip}>{m.mapping_type_code}</span>
              {(() => {
                const cap = c3ItemMap.get(m.c3_uuid);
                const label = cap
                  ? (cap.application ? `${cap.application} — ${cap.title ?? m.c3_uuid}` : (cap.title ?? m.c3_uuid))
                  : m.c3_uuid;
                return (
                  <a href={`/c3/${m.c3_uuid}`} title={m.c3_uuid}
                    className={styles.link} style={{ fontSize: '0.85em' }}>
                    {label}
                  </a>
                );
              })()}
              {m.is_primary && <span className={styles.relBadgeGreen}>{t('service_editor.c3.primary_badge')}</span>}
              {m.mapping_note && <span className={styles.hint}>{m.mapping_note}</span>}
              <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`}
                onClick={() => handleC3Delete(m.id)} disabled={c3Busy} style={{ marginLeft: 'auto' }}>{t('common.remove')}</button>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.hint}>{t('service_editor.c3.empty')}</p>
      )}

      {showC3Add ? (
        <div className={styles.relAddForm}>
          <Field label={t('service_editor.c3.capability')}>
            <select className={styles.input} value={c3Form.c3_uuid ?? ''}
              onChange={e => setC3Form(p => ({ ...p, c3_uuid: e.target.value }))}>
              <option value="">{t('service_editor.c3.select_level3')}</option>
              {level3Capabilities.map(capability => (
                <option key={capability.uuid} value={capability.uuid}>
                  {capability.page_id ? `${capability.page_id} — ` : ''}{capability.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('service_editor.c3.mapping_type')}>
            <select className={styles.input} value={c3Form.mapping_type_code}
              onChange={e => setC3Form(p => ({ ...p, mapping_type_code: e.target.value }))}>
              {['supports','enables','fully_fulfills','partially_fulfills'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <div className={styles.previewPanel}>
            <div className={styles.previewHeader}>
              <span>{t('service_editor.c3.preview.title')}</span>
              {c3PreviewBusy && <small>{t('service_editor.c3.preview.calculating')}</small>}
              {c3Preview && <small>{c3Preview.classification.replace(/_/g, ' ')}</small>}
            </div>
            {c3PreviewError && <p className={styles.previewError}>{c3PreviewError}</p>}
            {!c3PreviewError && !c3Preview && !c3PreviewBusy && <p className={styles.hint}>{t('service_editor.c3.preview.empty')}</p>}
            {c3Preview && (
              <div className={styles.previewBody}>
                <div className={styles.previewDeltaGrid}>
                  {c3Preview.coverage_delta_per_lvl3.map((delta) => (
                    <div key={`${delta.spiral_code}-${delta.capability_title}`} className={styles.previewDeltaCard}>
                      <strong>{delta.spiral_code}</strong>
                      <span>{delta.before_coverage_percent}% → {delta.after_coverage_percent}%</span>
                      <em>{t('service_editor.c3.preview.requirement_delta', { count: delta.newly_covered_count })}</em>
                    </div>
                  ))}
                </div>
                <div className={styles.previewMeta}>
                  <span>{t('service_editor.c3.preview.affected_spirals')}: {c3Preview.affected_spirals.join(', ') || t('common.none')}</span>
                  <span>{t('service_editor.c3.preview.potential_duplicates')}: {c3Preview.potential_duplicate_coverage.length}</span>
                </div>
                {c3Preview.newly_covered_requirements.length > 0 && (
                  <details className={styles.previewDetails}>
                    <summary>{t('service_editor.c3.preview.new_requirements', { count: c3Preview.newly_covered_requirements.length })}</summary>
                    <ul>
                      {c3Preview.newly_covered_requirements.slice(0, 8).map((requirement) => (
                        <li key={`${requirement.kind}-${requirement.code}`}>{requirement.code} — {requirement.title}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
          <Field label={t('service_editor.c3.primary_mapping')}>
            <input type="checkbox" checked={c3Form.is_primary}
              onChange={e => setC3Form(p => ({ ...p, is_primary: e.target.checked }))} />
          </Field>
          <Field label={t('service_editor.c3.mapping_note')}>
            <textarea className={styles.textarea} rows={2} placeholder={t('service_editor.c3.mapping_note_placeholder')}
              value={c3Form.mapping_note}
              onChange={e => setC3Form(p => ({ ...p, mapping_note: e.target.value }))} />
          </Field>
          <div className={styles.flavourEditActions}>
            <button type="button" className={styles.btnPrimary} onClick={handleC3Add} disabled={c3Busy}>{t('service_editor.c3.add_mapping')}</button>
            <button type="button" className={styles.btnGhost} onClick={() => setShowC3Add(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.btnSecondary} onClick={() => setShowC3Add(true)}
          style={{ marginTop: 'var(--space-3)' }}>
          {t('service_editor.c3.assign_taxonomy')}
        </button>
      )}
      <p className={styles.hint} style={{ marginTop: 'var(--space-3)' }}>
        {t('service_editor.c3.catalogue_hint')} <Link href="/c3/list" className={styles.link}>{t('service_editor.c3.catalogue_link')} →</Link>
      </p>
      </div>
    </>
  );
}
