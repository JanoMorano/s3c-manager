'use client';

import { useState, type FormEvent } from 'react';
import Link from '@/app/components/AppLink';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import type { BadgeVariant } from '@/design-system/controls';
import { authHeaders } from '@/features/services/api/services.api';
import { useReadinessSummary } from '@/features/governance/hooks/useGovernance';
import type { ServiceReadiness, ReadinessRuleResult } from '@/features/services/model/service.types';
import styles from '../../dashboard/dashboard.module.css';
import govStyles from '../governance.module.css';

function severityTone(severity: string): BadgeVariant {
  if (severity === 'P0') return 'danger';
  if (severity === 'P1') return 'warning';
  if (severity === 'P2') return 'info';
  return 'neutral';
}

function statusTone(status: string): BadgeVariant {
  if (status === 'failed') return 'danger';
  if (status === 'exception') return 'info';
  if (status === 'passed') return 'success';
  return 'neutral';
}

function actionableRules(item: ServiceReadiness) {
  return (item.rules ?? []).filter((rule) => rule.status === 'failed' || rule.status === 'exception');
}

function primaryFailedRule(item: ServiceReadiness) {
  return (item.rules ?? []).find((rule) => rule.status === 'failed') ?? null;
}

function RuleBadges({ rules }: { rules: ReadinessRuleResult[] }) {
  if (rules.length === 0) return <span className={govStyles.stateLine}>No rule findings</span>;
  return (
    <div className={govStyles.ruleBadgeList}>
      {rules.map((rule) => (
        <span key={rule.rule_key} className={govStyles.ruleBadge}>
          <Badge variant={severityTone(rule.severity)}>{rule.severity}</Badge>
          <Badge variant={statusTone(rule.status)}>{rule.status}</Badge>
          <span>{rule.title}</span>
          {rule.exception?.expired ? <strong>expired exception</strong> : null}
          {rule.status === 'exception' && !rule.exception?.expired ? <strong>exception</strong> : null}
        </span>
      ))}
    </div>
  );
}

function ExceptionForm({
  serviceId,
  rule,
  onSaved,
}: {
  serviceId: string;
  rule: ReadinessRuleResult;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const reasonId = `exception-reason-${serviceId}-${rule.rule_key}`;
  const expiryId = `exception-expiry-${serviceId}-${rule.rule_key}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const reason = String(data.get('reason') ?? '').trim();
    const expiresAt = String(data.get('expires_at') ?? '').trim();
    if (!reason) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/v1/readiness/services/${encodeURIComponent(serviceId)}/exceptions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          rule_key: rule.rule_key,
          reason,
          expires_at: expiresAt ? `${expiresAt}T00:00:00Z` : null,
        }),
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      form.reset();
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={govStyles.exceptionPanel}>
      <button type="button" className={govStyles.exceptionSummary} onClick={() => setOpen((value) => !value)}>
        Exception
      </button>
      {open ? (
        <form className={govStyles.exceptionForm} onSubmit={submit}>
          <label className={govStyles.exceptionField} htmlFor={reasonId}>
            <span>Exception reason</span>
            <input id={reasonId} name="reason" type="text" required maxLength={1000} />
          </label>
          <label className={govStyles.exceptionField} htmlFor={expiryId}>
            <span>Exception expiry</span>
            <input id={expiryId} name="expires_at" type="date" />
          </label>
          <button type="submit" className={styles.secondaryLink} disabled={busy}>
            {busy ? 'Saving...' : 'Approve exception'}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function ReadinessRow({ item, onSaved }: { item: ServiceReadiness; onSaved: () => Promise<void> }) {
  const findings = actionableRules(item);
  const failedRule = primaryFailedRule(item);
  const statusText = item.blockers.length > 0 ? 'Blocked' : item.warnings.length > 0 ? 'Warnings' : 'Ready';

  return (
    <article className={govStyles.readinessRow}>
      <div className={govStyles.readinessRowHeader}>
        <Link href={`/services/${item.service_id}`} className={govStyles.readinessTitleLink}>
          <strong>{item.title}</strong>
          <span>{item.service_id} · {item.service_status ?? 'unknown'}</span>
        </Link>
        <Badge variant={item.blockers.length > 0 ? 'danger' : item.warnings.length > 0 ? 'warning' : 'success'}>
          {statusText}
        </Badge>
      </div>
      <RuleBadges rules={findings} />
      {failedRule ? <ExceptionForm serviceId={item.service_id} rule={failedRule} onSaved={onSaved} /> : null}
    </article>
  );
}

function QueueGroup({
  title,
  hint,
  items,
  empty,
  onSaved,
}: {
  title: string;
  hint: string;
  items: ServiceReadiness[];
  empty: string;
  onSaved: () => Promise<void>;
}) {
  return (
    <section className={govStyles.governancePanel}>
      <div className={govStyles.panelHeader}>
        <div>
          <h2 className={govStyles.panelTitle}>{title}</h2>
          <p className={govStyles.panelHint}>{hint}</p>
        </div>
        <span className={govStyles.panelCount}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <div className={govStyles.governanceList}>
          {items.map((item) => <ReadinessRow key={item.service_id} item={item} onSaved={onSaved} />)}
        </div>
      )}
    </section>
  );
}

export default function ReadinessQueuePage() {
  const { data, isLoading, error, mutate } = useReadinessSummary({ limit: 200 });

  if (isLoading) return <div className={styles.state}>Loading readiness...</div>;
  if (error || !data) return <div className={styles.stateError}>Readiness queue is not available.</div>;

  return (
    <main className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>Operations</span>
          <h1 className={styles.pageTitle}>Readiness Queue</h1>
          <p className={styles.pageLead}>Named rules, blockers, warnings, ready services, and time-bound exceptions.</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/operations" className={styles.secondaryLink}>Operations</Link>
          <Link href="/services/list" className={styles.secondaryLink}>Service list</Link>
        </div>
      </header>

      <section className={styles.kpiThree} aria-label="Readiness KPIs">
        <KpiCard label="Total scanned" value={data.counts.total} hint="Services evaluated by enabled rules" />
        <KpiCard label="Blockers" value={data.counts.blockers} hint="Not publishable without fix or exception" />
        <KpiCard label="Ready" value={data.counts.ready} hint="No blockers or warnings" />
      </section>

      <div className={govStyles.readinessGroupGrid}>
        <QueueGroup
          title="Blockers"
          hint="Blocking failed rules before publication."
          items={data.groups.blockers}
          empty="No blocking readiness items."
          onSaved={async () => { await mutate(); }}
        />
        <QueueGroup
          title="Warnings"
          hint="Non-blocking rule findings and waivers past expiry."
          items={data.groups.warnings}
          empty="No warning readiness items."
          onSaved={async () => { await mutate(); }}
        />
        <QueueGroup
          title="Ready"
          hint="Services currently publishable by configured rules."
          items={data.groups.ready}
          empty="No ready services yet."
          onSaved={async () => { await mutate(); }}
        />
      </div>
    </main>
  );
}
