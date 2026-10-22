'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { C3Picker, CapabilityPicker, ServicePicker } from './Pickers';
import { useT } from '@/app/i18n/useI18n';
import styles from './DecisionRecordModal.module.css';

export interface DecisionRecordValue {
  service_id: string;
  capability_id?: string;
  c3_id?: string;
  decision_type: string;
  decision: string;
  rationale: string;
  expires_at?: string;
  evidence?: string;
  affected_summary?: string;
}

interface DecisionRecordModalProps {
  title?: string;
  hint?: string;
  initial?: Partial<DecisionRecordValue>;
  busy?: boolean;
  error?: string | null;
  requireService?: boolean;
  onClose: () => void;
  onSubmit: (value: DecisionRecordValue) => void | Promise<void>;
}

const DECISION_TYPES = [
  ['publish', 'layout.decision_record_modal.decision_type.publish'],
  ['exception', 'layout.decision_record_modal.decision_type.exception'],
  ['lifecycle', 'layout.decision_record_modal.decision_type.lifecycle'],
  ['other', 'layout.decision_record_modal.decision_type.other'],
];

const DECISIONS = [
  ['approved', 'layout.decision_record_modal.decision.approved'],
  ['rejected', 'layout.decision_record_modal.decision.rejected'],
  ['deferred', 'layout.decision_record_modal.decision.deferred'],
  ['cancelled', 'layout.decision_record_modal.decision.cancelled'],
];

export default function DecisionRecordModal({
  title: titleProp,
  hint: hintProp,
  initial,
  busy = false,
  error,
  requireService = false,
  onClose,
  onSubmit,
}: DecisionRecordModalProps) {
  const t = useT();
  const title = titleProp ?? t('nav.topbar.action.record_decision');
  const hint = hintProp ?? t('layout.decision_record_modal.hint');
  const [serviceId, setServiceId] = useState(initial?.service_id ?? '');
  const [capabilityId, setCapabilityId] = useState(initial?.capability_id ?? '');
  const [c3Id, setC3Id] = useState(initial?.c3_id ?? '');
  const [decisionType, setDecisionType] = useState(initial?.decision_type ?? 'publish');
  const [decision, setDecision] = useState(initial?.decision ?? 'approved');
  const [rationale, setRationale] = useState(initial?.rationale ?? '');
  const [expiresAt, setExpiresAt] = useState(initial?.expires_at ?? '');
  const [evidence, setEvidence] = useState(initial?.evidence ?? '');
  const [affectedSummary, setAffectedSummary] = useState(initial?.affected_summary ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const requiresRationale = decision === 'rejected' || decision === 'deferred';
  const affects = useMemo(() => {
    const values = [
      serviceId.trim() ? t('layout.decision_record_modal.affects_service', { id: serviceId.trim() }) : null,
      capabilityId.trim() ? t('layout.decision_record_modal.affects_capability', { id: capabilityId.trim() }) : null,
      c3Id.trim() ? `C3 ${c3Id.trim()}` : null,
      affectedSummary.trim() || null,
    ].filter(Boolean);
    return values.length ? values.join(' · ') : t('layout.decision_record_modal.no_affected_entity');
  }, [affectedSummary, c3Id, capabilityId, serviceId, t]);

  const decisionTypeKey = DECISION_TYPES.find(([value]) => value === decisionType)?.[1];
  const decisionTypeLabel = decisionTypeKey ? t(decisionTypeKey) : decisionType;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    const hasEntity = Boolean(serviceId.trim() || capabilityId.trim() || c3Id.trim());
    if (requireService && !serviceId.trim()) {
      setLocalError(t('layout.decision_record_modal.error.service_required'));
      return;
    }
    if (!hasEntity) {
      setLocalError(t('layout.decision_record_modal.error.entity_required'));
      return;
    }
    if (requiresRationale && !rationale.trim()) {
      setLocalError(t('layout.decision_record_modal.error.rationale_required'));
      return;
    }

    await onSubmit({
      service_id: serviceId.trim(),
      capability_id: capabilityId.trim() || undefined,
      c3_id: c3Id.trim() || undefined,
      decision_type: decisionType,
      decision,
      rationale: rationale.trim(),
      expires_at: expiresAt || undefined,
      evidence: evidence.trim() || undefined,
      affected_summary: affectedSummary.trim() || undefined,
    });
  }

  return (
    <div className={styles.backdrop} role="presentation">
      <form className={styles.modal} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.hint}>{hint}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>{t('layout.decision_record_modal.close')}</button>
        </div>

        <div className={styles.form}>
          {(error || localError) ? <div className={styles.error}>{error ?? localError}</div> : null}

          <div className={styles.grid}>
            <ServicePicker label={t('layout.decision_record_modal.service_id')} value={serviceId} onChange={setServiceId} required={requireService} />
            <CapabilityPicker label={t('layout.pickers.capability')} value={capabilityId} onChange={setCapabilityId} />
            <C3Picker label={t('layout.pickers.c3_entity')} value={c3Id} onChange={setC3Id} />
            <label className={styles.field}>
              <span>{t('layout.decision_record_modal.expiry')}</span>
              <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </label>
          </div>

          <div className={styles.grid}>
            <label className={styles.field}>
              <span>{t('layout.decision_record_modal.decision_type_label')}</span>
              <select value={decisionType} onChange={(event) => setDecisionType(event.target.value)}>
                {DECISION_TYPES.map(([value, labelKey]) => <option key={value} value={value}>{t(labelKey)}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>{t('layout.decision_record_modal.decision_label')}</span>
              <select value={decision} onChange={(event) => setDecision(event.target.value)}>
                {DECISIONS.map(([value, labelKey]) => <option key={value} value={value}>{t(labelKey)}</option>)}
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span>{t('layout.decision_record_modal.rationale')} {requiresRationale ? '*' : ''}</span>
            <textarea rows={4} maxLength={1000} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder={t('layout.decision_record_modal.rationale_placeholder')} />
          </label>

          <label className={styles.field}>
            <span>{t('layout.decision_record_modal.evidence')}</span>
            <input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder={t('layout.decision_record_modal.evidence_placeholder')} />
          </label>

          <label className={styles.field}>
            <span>{t('layout.decision_record_modal.affected_summary')}</span>
            <input value={affectedSummary} onChange={(event) => setAffectedSummary(event.target.value)} placeholder={t('layout.decision_record_modal.affected_summary_placeholder')} />
          </label>

          <div className={styles.preview}>
            <strong>{t('layout.decision_log_preview.title')}</strong>
            <span>{t('layout.decision_log_preview.what', { value: decisionTypeLabel })}</span>
            <span>{t('layout.decision_log_preview.why', { value: rationale.trim() || (requiresRationale ? t('layout.decision_log_preview.required_before_submit') : t('layout.decision_record_modal.optional_for_decision')) })}</span>
            <span>{t('layout.decision_log_preview.affects', { value: affects })}</span>
            <span>{t('layout.decision_log_preview.expires', { value: expiresAt || t('layout.decision_log_preview.not_set') })}</span>
            <span>{t('layout.decision_log_preview.evidence', { value: evidence.trim() || t('layout.decision_log_preview.not_provided') })}</span>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className={styles.primary} disabled={busy}>{t('nav.topbar.action.record_decision')}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
