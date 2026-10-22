'use client';

import { type FormEvent, useState } from 'react';
import { useT } from '@/app/i18n/useI18n';
import { formatCountLabel } from '@/app/lib/counts';
import styles from './DecisionRecordModal.module.css';

export type ReviewActionStatus = 'in_review' | 'approved' | 'rejected' | 'deferred' | 'cancelled';

export interface ReviewActionTarget {
  id: number;
  service_id: string;
  service_title?: string | null;
  review_type?: string | null;
  requested_by?: string | null;
  requested_at?: string | null;
}

export interface ReviewReadinessPreview {
  score?: number | null;
  blockers?: number | null;
  warnings?: number | null;
  label?: string | null;
}

export interface ReviewActionValue {
  status: ReviewActionStatus;
  rationale: string;
  evidence?: string;
  defer_expires_at?: string;
}

interface ReviewActionModalProps {
  item: ReviewActionTarget;
  status: ReviewActionStatus;
  readiness?: ReviewReadinessPreview | null;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (value: ReviewActionValue) => void | Promise<void>;
}

function isTerminalStatus(status: ReviewActionStatus) {
  return ['approved', 'rejected', 'deferred', 'cancelled'].includes(status);
}

function statusLabelKey(status: ReviewActionStatus) {
  if (status === 'in_review') return 'layout.review_action_modal.status.in_review';
  if (status === 'approved') return 'layout.review_action_modal.status.approved';
  if (status === 'rejected') return 'layout.review_action_modal.status.rejected';
  if (status === 'deferred') return 'layout.review_action_modal.status.deferred';
  return 'common.cancel';
}

export default function ReviewActionModal({
  item,
  status,
  readiness,
  busy = false,
  error,
  onClose,
  onSubmit,
}: ReviewActionModalProps) {
  const t = useT();
  const [rationale, setRationale] = useState('');
  const [evidence, setEvidence] = useState('');
  const [deferExpiry, setDeferExpiry] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const requiresRationale = status === 'rejected' || status === 'deferred';
  const actionLabel = t(statusLabelKey(status));
  const reviewType = item.review_type ?? 'governance_review';
  const target = item.service_title ?? item.service_id;
  const affectedService = t('layout.decision_log_preview.affects_service', { service_id: item.service_id });
  const readinessScore = readiness?.score != null ? `${readiness.score}%` : t('layout.review_action_modal.not_available');
  const blockersLabel = formatCountLabel(readiness?.blockers ?? 0, {
    one: t('layout.review_action_modal.blockers.one'),
    few: t('layout.review_action_modal.blockers.few'),
    many: t('layout.review_action_modal.blockers.many'),
  });
  const warningsLabel = formatCountLabel(readiness?.warnings ?? 0, {
    one: t('layout.review_action_modal.warnings.one'),
    few: t('layout.review_action_modal.warnings.few'),
    many: t('layout.review_action_modal.warnings.many'),
  });
  const requiredBeforeSubmit = t('layout.decision_log_preview.required_before_submit');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (requiresRationale && !rationale.trim()) {
      setLocalError(t('layout.review_action_modal.error.rationale_required'));
      return;
    }
    if (status === 'deferred' && !deferExpiry) {
      setLocalError(t('layout.review_action_modal.error.defer_date_required'));
      return;
    }
    await onSubmit({
      status,
      rationale: rationale.trim(),
      evidence: evidence.trim() || undefined,
      defer_expires_at: deferExpiry || undefined,
    });
  }

  return (
    <div className={styles.backdrop} role="presentation">
      <form className={styles.modal} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{t('layout.review_action_modal.title')}</h2>
            <p className={styles.hint}>{item.service_id} · {reviewType} · {actionLabel}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>{t('layout.decision_record_modal.close')}</button>
        </div>

        <div className={styles.form}>
          {(error || localError) ? <div className={styles.error}>{error ?? localError}</div> : null}

          <div className={styles.preview}>
            <strong>{t('layout.review_action_modal.preflight.title')}</strong>
            <span>{t('layout.review_action_modal.preflight.review', { review_type: reviewType, target })}</span>
            <span>{t('layout.review_action_modal.preflight.requested_by', { name: item.requested_by ?? t('layout.review_action_modal.unknown_requester') })}{item.requested_at ? ` · ${item.requested_at}` : ''}</span>
            <span>{t('layout.review_action_modal.preflight.readiness', { score: readinessScore, blockers: blockersLabel, warnings: warningsLabel })}</span>
            <span>{t('layout.review_action_modal.preflight.affected', { value: affectedService })}</span>
          </div>

          <label className={styles.field}>
            <span>{t('layout.decision_record_modal.rationale')} {requiresRationale ? '*' : ''}</span>
            <textarea
              rows={4}
              maxLength={1000}
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder={t('layout.review_action_modal.rationale_placeholder')}
            />
          </label>

          {status === 'deferred' && (
            <label className={styles.field}>
              <span>{t('layout.review_action_modal.defer_until')} *</span>
              <input
                type="date"
                value={deferExpiry}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setDeferExpiry(event.target.value)}
              />
            </label>
          )}

          <label className={styles.field}>
            <span>{t('layout.decision_record_modal.evidence')}</span>
            <input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder={t('layout.review_action_modal.evidence_placeholder')} />
          </label>

          <div className={styles.preview}>
            <strong>{t('layout.decision_log_preview.title')}</strong>
            <span>{t('layout.decision_log_preview.what', {
              value: t('layout.review_action_modal.what_value', {
                action: actionLabel,
                review_type: item.review_type ?? t('layout.review_action_modal.review_fallback'),
                target,
              }),
            })}</span>
            <span>{t('layout.decision_log_preview.why', { value: rationale.trim() || (requiresRationale ? requiredBeforeSubmit : t('layout.review_action_modal.optional_for_action')) })}</span>
            <span>{t('layout.decision_log_preview.affects', { value: affectedService })}</span>
            <span>{t('layout.decision_log_preview.expires', { value: status === 'deferred' ? (deferExpiry || requiredBeforeSubmit) : t('layout.decision_log_preview.not_set') })}</span>
            <span>{t('layout.decision_log_preview.evidence', { value: evidence.trim() || t('layout.decision_log_preview.not_provided') })}</span>
            {!isTerminalStatus(status) && <span>{t('layout.review_action_modal.status_only_note')}</span>}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className={styles.primary} disabled={busy}>{t('layout.review_action_modal.confirm')}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
