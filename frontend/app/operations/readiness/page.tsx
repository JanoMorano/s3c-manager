'use client';

import { useState, type FormEvent } from 'react';
import Link from '@/app/components/AppLink';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/app/components/PageHeader';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import type { BadgeVariant } from '@/design-system/controls';
import { authHeaders } from '@/features/services/api/services.api';
import { useReadinessSummary } from '@/features/governance/hooks/useGovernance';
import type { ServiceReadiness, ReadinessRuleResult } from '@/features/services/model/service.types';
import styles from '../../dashboard/dashboard.module.css';
import govStyles from '../governance.module.css';
import { useT } from '@/app/i18n/useI18n';

type Translate = ReturnType<typeof useT>;

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

function editorSectionForRule(rule: ReadinessRuleResult | null | undefined) {
  const text = `${rule?.rule_key ?? ''} ${rule?.title ?? ''} ${rule?.message ?? ''}`.toLowerCase();
  if (text.includes('owner') || text.includes('ownership')) return 'ownership';
  if (text.includes('request') || text.includes('channel') || text.includes('offering')) return 'request-access';
  if (text.includes('c3') || text.includes('capability') || text.includes('mapping')) return 'c3mapping';
  if (text.includes('support') || text.includes('sla')) return 'support-model';
  return 'readiness-governance';
}

function editorHrefForRule(serviceId: string, rule: ReadinessRuleResult | null | undefined) {
  return `/services/${encodeURIComponent(serviceId)}/edit#${editorSectionForRule(rule)}`;
}

function RuleBadges({ rules }: { rules: ReadinessRuleResult[] }) {
  const t = useT();
  if (rules.length === 0) return <span className={govStyles.stateLine}>{t('operations.readiness.no_findings')}</span>;
  return (
    <div className={govStyles.ruleBadgeList}>
      {rules.map((rule) => (
        <span key={rule.rule_key} className={govStyles.ruleBadge}>
          <Badge variant={severityTone(rule.severity)}>{rule.severity}</Badge>
          <Badge variant={statusTone(rule.status)}>{rule.status}</Badge>
          <span>{rule.title}</span>
          {rule.exception?.expired ? <strong>{t('operations.readiness.expired_exception')}</strong> : null}
          {rule.status === 'exception' && !rule.exception?.expired ? <strong>{t('operations.readiness.exception')}</strong> : null}
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
  const t = useT();
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
        {t('operations.readiness.exception_toggle')}
      </button>
      {open ? (
        <form className={govStyles.exceptionForm} onSubmit={submit}>
          <label className={govStyles.exceptionField} htmlFor={reasonId}>
            <span>{t('operations.readiness.exception_reason')}</span>
            <input id={reasonId} name="reason" type="text" required maxLength={1000} />
          </label>
          <label className={govStyles.exceptionField} htmlFor={expiryId}>
            <span>{t('operations.readiness.exception_expiry')}</span>
            <input id={expiryId} name="expires_at" type="date" />
          </label>
          <button type="submit" className={styles.secondaryLink} disabled={busy}>
            {busy ? t('operations.readiness.saving') : t('operations.readiness.approve_exception')}
          </button>
        </form>
      ) : null}
    </div>
  );
}

type ReadinessFilter = 'blocked' | 'warnings' | 'ready' | 'exceptions';
type RuleDetail = ReadinessRuleResult & {
  related_process?: string | null;
  what_is_missing?: string | null;
};

function exceptionItems(items: ServiceReadiness[]) {
  return items.filter((item) => (item.rules ?? []).some((rule) => rule.status === 'exception' || rule.exception));
}

function exceptionsExpiring(items: ServiceReadiness[]) {
  const now = Date.now();
  const threshold = now + 30 * 24 * 60 * 60 * 1000;
  return items.reduce((sum, item) => {
    const expiring = (item.rules ?? []).filter((rule) => {
      const expiresAt = rule.exception?.expires_at ? new Date(rule.exception.expires_at).getTime() : Number.NaN;
      return Number.isFinite(expiresAt) && expiresAt <= threshold;
    }).length;
    return sum + expiring;
  }, 0);
}

function visibleItems(filter: ReadinessFilter, data: NonNullable<ReturnType<typeof useReadinessSummary>['data']>) {
  if (filter === 'blocked') return data.groups?.blockers ?? [];
  if (filter === 'warnings') return data.groups?.warnings ?? [];
  if (filter === 'ready') return data.groups?.ready ?? [];
  return exceptionItems(data.items ?? []);
}

function statusLabelKey(item: ServiceReadiness) {
  if (item.blockers.length > 0) return 'service_list.row.state.blocked';
  if (item.warnings.length > 0) return 'service_list.row.state.warning';
  return 'service_list.row.state.ready';
}

function statusBadge(item: ServiceReadiness): BadgeVariant {
  if (item.blockers.length > 0) return 'danger';
  if (item.warnings.length > 0) return 'warning';
  return 'success';
}

function ruleDetailText(rule: RuleDetail | null, key: 'what' | 'why' | 'how', t: Translate) {
  if (!rule) return t('operations.readiness.detail.select_service');
  if (key === 'what') return rule.what_is_missing ?? rule.title_text ?? rule.message ?? rule.title;
  if (key === 'why') return rule.why_text ?? rule.description ?? t('operations.readiness.detail.why_fallback');
  return rule.howto_text ?? rule.evidence_hint ?? t('operations.readiness.detail.how_fallback');
}

function defaultFilter(data: NonNullable<ReturnType<typeof useReadinessSummary>['data']>): ReadinessFilter {
  // Auto-select the first non-empty tab so the table is never blank on load.
  if ((data.groups?.blockers ?? []).length > 0) return 'blocked';
  if ((data.groups?.warnings ?? []).length > 0) return 'warnings';
  if ((data.groups?.ready ?? []).length > 0) return 'ready';
  return 'blocked';
}

function resolveReadinessFilter(value: string | null | undefined): ReadinessFilter | null {
  return value === 'blocked' || value === 'warnings' || value === 'ready' || value === 'exceptions' ? value : null;
}

function readinessFilterHref(filter: ReadinessFilter, ownerFilter: string) {
  const params = new URLSearchParams({ filter });
  if (ownerFilter) params.set('owner', ownerFilter);
  return `/operations/readiness?${params.toString()}`;
}

export default function ReadinessQueuePage() {
  const t = useT();
  const searchParams = useSearchParams();
  const ownerFilter = searchParams?.get('owner') ?? '';
  const requestedFilter = resolveReadinessFilter(searchParams?.get('filter'));
  const { data, isLoading, error, mutate } = useReadinessSummary({ limit: 200, owner: ownerFilter || undefined });
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  if (isLoading) return <div className={styles.state}>{t('operations.readiness.loading')}</div>;
  if (error || !data) return <div className={styles.stateError}>{t('operations.readiness.error', { error: String(error ?? t('operations.readiness.no_data')) })}</div>;

  // Resolve the active filter — set once when data first arrives, then user-controlled.
  const resolvedFilter: ReadinessFilter = requestedFilter ?? defaultFilter(data);

  const filteredItems = visibleItems(resolvedFilter, data);
  const selectedItem = filteredItems.find((item) => item.service_id === selectedServiceId) ?? filteredItems[0] ?? null;
  const selectedRule = selectedItem ? (primaryFailedRule(selectedItem) ?? actionableRules(selectedItem)[0] ?? selectedItem.rules?.[0] ?? null) as RuleDetail | null : null;
  const allItems = data.items ?? [];
  const expiringCount = exceptionsExpiring(allItems);

  return (
    <main className={styles.shell}>
      <PageHeader
        title={t('nav.sidebar.readiness_gate')}
        purpose={t('operations.readiness.purpose')}
        primaryAction={{
          label: t('nav.sidebar.service_list'),
          href: ownerFilter ? `/services/list?owner=${encodeURIComponent(ownerFilter)}` : '/services/list',
        }}
      />

      <section className={govStyles.readinessKpiGrid} aria-label={t('operations.readiness.kpi.aria')}>
        <Link href={readinessFilterHref('blocked', ownerFilter)} className={`${govStyles.kpiLink} ${resolvedFilter === 'blocked' ? govStyles.kpiLinkActive : ''}`} aria-label={t('operations.readiness.kpi.blocked.aria')} onClick={() => setSelectedServiceId(null)}>
          <KpiCard label={t('service_list.row.state.blocked')} value={data.counts.blockers} hint={t('operations.readiness.kpi.blocked.hint')} tone={data.counts.blockers ? 'danger' : 'success'} />
        </Link>
        <Link href={readinessFilterHref('warnings', ownerFilter)} className={`${govStyles.kpiLink} ${resolvedFilter === 'warnings' ? govStyles.kpiLinkActive : ''}`} aria-label={t('operations.readiness.kpi.warnings.aria')} onClick={() => setSelectedServiceId(null)}>
          <KpiCard label={t('service_list.row.state.warning')} value={data.counts.warnings} hint={t('operations.readiness.kpi.warnings.hint')} tone={data.counts.warnings ? 'warning' : 'success'} />
        </Link>
        <Link href={readinessFilterHref('ready', ownerFilter)} className={`${govStyles.kpiLink} ${resolvedFilter === 'ready' ? govStyles.kpiLinkActive : ''}`} aria-label={t('operations.readiness.kpi.ready.aria')} onClick={() => setSelectedServiceId(null)}>
          <KpiCard label={t('service_list.row.state.ready')} value={data.counts.ready} hint={t('operations.readiness.kpi.ready.hint')} tone="success" />
        </Link>
        <Link href={readinessFilterHref('exceptions', ownerFilter)} className={`${govStyles.kpiLink} ${resolvedFilter === 'exceptions' ? govStyles.kpiLinkActive : ''}`} aria-label={t('operations.readiness.kpi.exceptions.aria')} onClick={() => setSelectedServiceId(null)}>
          <KpiCard label={t('operations.readiness.kpi.exceptions.label')} value={expiringCount} hint={t('operations.readiness.kpi.exceptions.hint')} tone={expiringCount ? 'warning' : 'neutral'} />
        </Link>
      </section>

      <section className={govStyles.readinessWorkspace} aria-label={t('operations.readiness.workspace.aria')}>
        <div className={govStyles.readinessTable}>
          <div className={govStyles.readinessTableHeader}>
            <span>{t('service_list.column.service')}</span>
            <span>{t('operations.readiness.column.rule')}</span>
            <span>{t('common.status')}</span>
            <span>{t('common.actions')}</span>
          </div>
          {filteredItems.length === 0 ? (
            <EmptyState title={
              resolvedFilter === 'blocked'
                ? t('operations.readiness.empty.blocked')
                : resolvedFilter === 'warnings'
                  ? t('operations.readiness.empty.warnings')
                  : resolvedFilter === 'ready'
                    ? t('operations.readiness.empty.ready')
                    : t('operations.readiness.empty.exceptions')
            } />
          ) : filteredItems.map((item) => {
            const failedRule = primaryFailedRule(item);
            const findings = actionableRules(item);
            return (
              <article
                key={item.service_id}
                role="button"
                tabIndex={0}
                className={`${govStyles.readinessTableRow} ${selectedItem?.service_id === item.service_id ? govStyles.readinessTableRowSelected : ''}`}
                onClick={() => setSelectedServiceId(item.service_id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') setSelectedServiceId(item.service_id);
                }}
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.service_id} · {item.service_status ?? t('operations.readiness.unknown')}</small>
                </span>
                <span>{failedRule?.title ?? findings[0]?.title ?? t('operations.readiness.all_passed')}</span>
                <Badge variant={statusBadge(item)}>{t(statusLabelKey(item))}</Badge>
                <span className={govStyles.rowActionStack}>
                  <Link href={`/services/${encodeURIComponent(item.service_id)}`} className={govStyles.rowActionLink} onClick={(event) => event.stopPropagation()}>{t('operations.readiness.action.detail')}</Link>
                  <Link href={editorHrefForRule(item.service_id, failedRule ?? findings[0])} className={govStyles.rowActionLink} onClick={(event) => event.stopPropagation()}>{t('operations.readiness.action.fix_rule')}</Link>
                </span>
              </article>
            );
          })}
        </div>

        <aside className={govStyles.ruleDetailPanel}>
          <div className={govStyles.panelHeader}>
            <div>
              <h2 className={govStyles.panelTitle}>{selectedRule?.title ?? t('operations.readiness.detail.title')}</h2>
              <p className={govStyles.panelHint}>{selectedItem ? `${selectedItem.title} · ${selectedItem.service_id}` : t('operations.readiness.detail.select_item')}</p>
            </div>
            {selectedRule ? <Badge variant={severityTone(selectedRule.severity)}>{selectedRule.severity}</Badge> : null}
          </div>

          <div className={govStyles.ruleExplanation}>
            <section>
              <h3>{t('operations.readiness.detail.what')}</h3>
              <p>{ruleDetailText(selectedRule, 'what', t)}</p>
            </section>
            <section>
              <h3>{t('operations.readiness.detail.why')}</h3>
              <p>{ruleDetailText(selectedRule, 'why', t)}</p>
            </section>
            <section>
              <h3>{t('operations.readiness.detail.process')}</h3>
              <p>{selectedRule?.related_process ?? t('operations.readiness.detail.process_fallback')}</p>
            </section>
            <section>
              <h3>{t('operations.readiness.detail.how')}</h3>
              <p>{ruleDetailText(selectedRule, 'how', t)}</p>
            </section>
          </div>

          {selectedItem ? <RuleBadges rules={actionableRules(selectedItem)} /> : null}
          {selectedItem ? (
            <div className={govStyles.workflowActions}>
              <Link href={`/services/${encodeURIComponent(selectedItem.service_id)}`} className={govStyles.rowActionLink}>{t('operations.readiness.open_service_detail')}</Link>
              <Link href={editorHrefForRule(selectedItem.service_id, selectedRule)} className={govStyles.rowActionLink}>{t('operations.reviews.open_editor_rule')}</Link>
              {selectedItem.primary_c3_uuid ? (
                <Link href={`/c3/${encodeURIComponent(selectedItem.primary_c3_uuid)}`} className={govStyles.rowActionLink}>{t('operations.readiness.open_capability')}</Link>
              ) : null}
            </div>
          ) : null}
          {selectedItem && selectedRule?.status === 'failed' ? (
            <ExceptionForm serviceId={selectedItem.service_id} rule={selectedRule} onSaved={async () => { await mutate(); }} />
          ) : null}
        </aside>
      </section>
    </main>
  );
}
