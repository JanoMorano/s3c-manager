'use client';

import { type FormEvent, useState } from 'react';
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

function statusLabel(status: ReviewActionStatus) {
  if (status === 'in_review') return 'Start review';
  if (status === 'approved') return 'Approve';
  if (status === 'rejected') return 'Reject';
  if (status === 'deferred') return 'Defer';
  return 'Cancel';
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
  const [rationale, setRationale] = useState('');
  const [evidence, setEvidence] = useState('');
  const [deferExpiry, setDeferExpiry] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const requiresRationale = status === 'rejected' || status === 'deferred';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (requiresRationale && !rationale.trim()) {
      setLocalError('Rationale is required for rejected or deferred reviews.');
      return;
    }
    if (status === 'deferred' && !deferExpiry) {
      setLocalError('Defer until date is required for deferred reviews.');
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
            <h2 className={styles.title}>Review action</h2>
            <p className={styles.hint}>{item.service_id} · {item.review_type ?? 'governance_review'} · {statusLabel(status)}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>Close</button>
        </div>

        <div className={styles.form}>
          {(error || localError) ? <div className={styles.error}>{error ?? localError}</div> : null}

          <div className={styles.preview}>
            <strong>Pre-flight readiness</strong>
            <span>Review: {item.review_type ?? 'governance_review'} · {item.service_title ?? item.service_id}</span>
            <span>Requested by: {item.requested_by ?? 'Unknown'}{item.requested_at ? ` · ${item.requested_at}` : ''}</span>
            <span>Readiness: {readiness?.score != null ? `${readiness.score}%` : 'Not available'} · {readiness?.blockers ?? 0} blockers · {readiness?.warnings ?? 0} warnings</span>
            <span>Affected: Service · {item.service_id}</span>
          </div>

          <label className={styles.field}>
            <span>Rationale {requiresRationale ? '*' : ''}</span>
            <textarea
              rows={4}
              maxLength={1000}
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder="Why is this action valid?"
            />
          </label>

          {status === 'deferred' && (
            <label className={styles.field}>
              <span>Defer until *</span>
              <input
                type="date"
                value={deferExpiry}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setDeferExpiry(event.target.value)}
              />
            </label>
          )}

          <label className={styles.field}>
            <span>Evidence</span>
            <input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Link, document ID or short evidence note" />
          </label>

          <div className={styles.preview}>
            <strong>Decision log preview</strong>
            <span>What: {statusLabel(status)} {item.review_type ?? 'review'} of {item.service_title ?? item.service_id}</span>
            <span>Why: {rationale.trim() || (requiresRationale ? 'Required before submit' : 'Optional for this action')}</span>
            <span>Affects: Service · {item.service_id}</span>
            <span>Expires: {status === 'deferred' ? (deferExpiry || 'Required before submit') : 'Not set'}</span>
            <span>Evidence: {evidence.trim() || 'Not provided'}</span>
            {!isTerminalStatus(status) && <span>Status update only; no decision record will be created.</span>}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={busy}>Confirm action</button>
          </div>
        </div>
      </form>
    </div>
  );
}
