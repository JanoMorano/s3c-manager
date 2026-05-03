'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { C3Picker, CapabilityPicker, ServicePicker } from './Pickers';
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
  ['publish_approval', 'Publish approval'],
  ['deferral', 'Deferral'],
  ['risk_acceptance', 'Risk acceptance'],
  ['exception', 'Exception'],
  ['retirement', 'Retirement'],
];

const DECISIONS = [
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['deferred', 'Deferred'],
  ['cancelled', 'Cancelled'],
];

export default function DecisionRecordModal({
  title = 'Record decision',
  hint = 'Every decision is audit visible. Fill what changed, why, what it affects, and evidence when available.',
  initial,
  busy = false,
  error,
  requireService = false,
  onClose,
  onSubmit,
}: DecisionRecordModalProps) {
  const [serviceId, setServiceId] = useState(initial?.service_id ?? '');
  const [capabilityId, setCapabilityId] = useState(initial?.capability_id ?? '');
  const [c3Id, setC3Id] = useState(initial?.c3_id ?? '');
  const [decisionType, setDecisionType] = useState(initial?.decision_type ?? 'publish_approval');
  const [decision, setDecision] = useState(initial?.decision ?? 'approved');
  const [rationale, setRationale] = useState(initial?.rationale ?? '');
  const [expiresAt, setExpiresAt] = useState(initial?.expires_at ?? '');
  const [evidence, setEvidence] = useState(initial?.evidence ?? '');
  const [affectedSummary, setAffectedSummary] = useState(initial?.affected_summary ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const requiresRationale = decision === 'rejected' || decision === 'deferred';
  const affects = useMemo(() => {
    const values = [
      serviceId.trim() ? `Service ${serviceId.trim()}` : null,
      capabilityId.trim() ? `Capability ${capabilityId.trim()}` : null,
      c3Id.trim() ? `C3 ${c3Id.trim()}` : null,
      affectedSummary.trim() || null,
    ].filter(Boolean);
    return values.length ? values.join(' · ') : 'No affected entity selected yet';
  }, [affectedSummary, c3Id, capabilityId, serviceId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    const hasEntity = Boolean(serviceId.trim() || capabilityId.trim() || c3Id.trim());
    if (requireService && !serviceId.trim()) {
      setLocalError('Service ID is required for this decision flow.');
      return;
    }
    if (!hasEntity) {
      setLocalError('Select at least one service, capability or C3 entity.');
      return;
    }
    if (requiresRationale && !rationale.trim()) {
      setLocalError('Rationale is required for rejected or deferred decisions.');
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
          <button type="button" className={styles.close} onClick={onClose}>Close</button>
        </div>

        <div className={styles.form}>
          {(error || localError) ? <div className={styles.error}>{error ?? localError}</div> : null}

          <div className={styles.grid}>
            <ServicePicker label="Service ID" value={serviceId} onChange={setServiceId} required={requireService} />
            <CapabilityPicker label="Capability" value={capabilityId} onChange={setCapabilityId} />
            <C3Picker label="C3 entity" value={c3Id} onChange={setC3Id} />
            <label className={styles.field}>
              <span>Expiry / next review</span>
              <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </label>
          </div>

          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Decision type</span>
              <select value={decisionType} onChange={(event) => setDecisionType(event.target.value)}>
                {DECISION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>Decision</span>
              <select value={decision} onChange={(event) => setDecision(event.target.value)}>
                {DECISIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span>Rationale {requiresRationale ? '*' : ''}</span>
            <textarea rows={4} maxLength={1000} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Why is this decision valid?" />
          </label>

          <label className={styles.field}>
            <span>Evidence</span>
            <input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="SR-2026-12, Jira link, document reference" />
          </label>

          <label className={styles.field}>
            <span>Affected summary</span>
            <input value={affectedSummary} onChange={(event) => setAffectedSummary(event.target.value)} placeholder="1 service · 1 capability · EU partner audience" />
          </label>

          <div className={styles.preview}>
            <strong>Decision log preview</strong>
            <span>What: {DECISION_TYPES.find(([value]) => value === decisionType)?.[1] ?? decisionType}</span>
            <span>Why: {rationale.trim() || (requiresRationale ? 'Required before submit' : 'Optional for this decision')}</span>
            <span>Affects: {affects}</span>
            <span>Expires: {expiresAt || 'Not set'}</span>
            <span>Evidence: {evidence.trim() || 'Not provided'}</span>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={busy}>Record decision</button>
          </div>
        </div>
      </form>
    </div>
  );
}
