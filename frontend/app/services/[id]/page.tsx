/**
 * Service Detail: compact header (identity, owner, readiness, max. two actions),
 * tabs directly underneath, one fact per screen. The active tab lives in the
 * URL hash so refresh, Back and shared links keep it.
 */
'use client';

import { use, useCallback, useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import Link from '@/app/components/AppLink';
import { useInstallStatus } from '@/features/install/installStatus';
import {
  useService, useService360, useServiceOverview, useServiceSla, useServiceRoles, useServiceC3Mappings,
  type ServiceC3Mapping,
} from '@/features/services/hooks/useServices';
import { DomainDotGroup }    from '@/features/services/components/DomainDotGroup';
import { MetadataItem, MetadataGrid } from '@/features/services/components/MetadataItem';
import { SlaPanel }          from '@/features/services/components/SlaPanel';
import { useGovernanceDecisions, useGovernanceReviews } from '@/features/governance/hooks/useGovernance';
import { AUTH_STATE_EVENT, restoreAuthSession } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import type {
  ReadinessRuleResult,
  ServiceAudiencePolicy,
  ServiceOffering,
  ServiceOperationalLink,
  ServiceRoleAssignment,
  ServiceSupportModel,
  ServiceOverview,
  ServiceDetail,
  ServiceRelation,
} from '@/features/services/model/service.types';
import { safeHref } from '@/shared/utils/safeHref';
import { useT } from '@/app/i18n/useI18n';
import { formatCountLabel } from '@/app/lib/counts';
import { relationTypeLabelKey } from '@/features/services/relationTypes';
import styles from './detail.module.css';

interface Props { params: Promise<{ id: string }> }
type DetailView = 'overview' | 'request' | 'support' | 'dependencies' | 'governance';

/** Hash values that open a tab. Anchors inside a tab map to that tab. */
const HASH_TO_VIEW: Record<string, DetailView> = {
  overview: 'overview',
  request: 'request',
  support: 'support',
  dependencies: 'dependencies',
  governance: 'governance',
  'governance-workflow': 'governance',
  history: 'governance',
  audit: 'governance',
  readiness: 'governance',
};

function useCanEdit() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const syncRole = async () => {
      const snapshot = await restoreAuthSession();
      if (!cancelled) setRole(snapshot?.role ?? null);
    };
    void syncRole();
    window.addEventListener(AUTH_STATE_EVENT, syncRole);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_STATE_EVENT, syncRole);
    };
  }, []);
  return hasRoleAccess(role, 'editor');
}

export default function ServiceDetailPage({ params }: Props) {
  const t = useT();
  const { id } = use(params);
  const { c3Visible } = useInstallStatus();
  const { data: svc, isLoading, error } = useService(id);
  const { data: service360Data } = useService360(id);
  const { data: overviewData, isLoading: overviewLoading, error: overviewError } = useServiceOverview(id);
  const { data: slaData } = useServiceSla(id);
  const { data: rolesData } = useServiceRoles(id);
  const { data: c3MappingsData } = useServiceC3Mappings(c3Visible ? id : null);
  const canEdit = useCanEdit();
  const [activeView, setActiveView] = useState<DetailView>('overview');
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);

  // Read the tab from the hash on load and on in-page anchor navigation.
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace('#', '');
      const view = HASH_TO_VIEW[hash];
      if (!view) return;
      setActiveView(view);
      if (hash !== view) setPendingAnchor(hash);
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  // Scroll to an anchor inside a tab once that tab has rendered.
  useEffect(() => {
    if (!pendingAnchor) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(pendingAnchor);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        setPendingAnchor(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pendingAnchor, activeView, svc]);

  // Write the tab to the hash (replace, so Back leaves the page instead of cycling tabs).
  const selectView = useCallback((value: string) => {
    const view = HASH_TO_VIEW[value] ?? 'overview';
    setActiveView(view);
    const base = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(window.history.state, '', view === 'overview' ? base : `${base}#${view}`);
  }, []);

  if (isLoading) return <div className={styles.state}>{t('service_detail.text.loading')}</div>;
  if (error)     return <div className={styles.stateError}>{t('service_detail.text.service_not_found_or_api_unreachable')}</div>;
  if (!svc)      return null;

  const businessView = svc.business_view;
  const overview = service360Data?.overview ?? overviewData?.item ?? null;
  const businessSummary = businessView?.business_summary ?? svc.summary;
  const consumerValue = businessView?.consumer_value ?? svc.consumer_value ?? null;
  const primaryOffering = businessView?.primary_offering ?? svc.primary_offering;
  const supportModels = businessView?.support_model ?? svc.support_model ?? [];
  const audiencePolicies = businessView?.audience_policies ?? svc.audience_policies ?? [];
  const operationalLinks = businessView?.operational_links ?? svc.operational_links ?? [];
  const requestHref = safeHref(
    primaryOffering?.request_channel_url ??
    businessView?.request_channel_url ??
    svc.request_channel_url
  );
  const isRequestable = primaryOffering?.requestable ?? businessView?.requestable ?? svc.requestable ?? false;
  const editHref = `/services/${id}/edit`;
  const importEvidenceHref = `${editHref}#raw-fields`;
  const hasImportEvidence = Boolean(
    svc.source_url ||
    svc.source_local_id ||
    svc.source_sp_id ||
    svc.source_etag ||
    svc.created_at_source ||
    svc.modified_at_source
  );
  const lifecycleState = overview?.lifecycle.stage_code ?? svc.lifecycle_stage_code ?? businessView?.lifecycle_state ?? svc.lifecycle_state ?? svc.service_status ?? null;
  const normalizedLifecycleStage = normalizeLifecycleState(lifecycleState);

  // ── Readiness (header) ──────────────────────────────────────────────────
  const blockers = overview?.readiness?.blockers ?? [];
  const warnings = overview?.readiness?.warnings ?? [];
  const completeness = svc.completeness_score ?? (overview?.readiness?.is_publishable ? 100 : null);
  const readinessTone: Tone = blockers.length ? 'danger' : warnings.length ? 'warning' : overview?.readiness ? 'ok' : 'muted';
  const readinessLabel = blockers.length
    ? formatCountLabel(blockers.length, countForms(t, 'blockers'))
    : warnings.length
      ? formatCountLabel(warnings.length, countForms(t, 'warnings'))
      : overview?.readiness
        ? t('service_detail.text.ready_to_run')
        : t('service_detail.text.readiness_unknown');

  // ── People ──────────────────────────────────────────────────────────────
  const ownerName = overview?.owners.primary?.display_name ?? svc.service_owner ?? svc.vlastnik ?? null;
  const primaryCapability = overview?.capability_mappings.find((item) => item.is_primary) ?? overview?.capability_mappings[0] ?? null;
  const capabilityCount = overview?.capability_mappings.length ?? (svc.c3_uuid ? 1 : 0);

  const checklist = buildChecklist({
    id,
    overview,
    service: svc,
    ownerName,
    supportModels,
    requestHref,
    primaryOffering,
    capabilityCount,
    t,
  });
  const openItems = checklist.filter((item) => item.tone !== 'ok').length;

  const goToRequest = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    selectView('request');
    document.getElementById('service-tabs')?.scrollIntoView({ block: 'nearest' });
  };

  const requestAction = isRequestable ? (
    <a href="#request" onClick={goToRequest} className={canEdit ? styles.secondaryAction : styles.primaryAction}>
      {t('service_detail.action.how_to_get')}
    </a>
  ) : null;

  return (
    <div className={styles.shell}>

      {/* ── Lifecycle banner for deprecated/retired services ─────────────── */}
      {(normalizedLifecycleStage === 'deprecated' || normalizedLifecycleStage === 'retired') && (
        <div className={`${styles.lifecycleBanner} ${normalizedLifecycleStage === 'retired' ? styles.lifecycleBannerRetired : styles.lifecycleBannerDeprecated}`}>
          <span className={styles.lifecycleBannerIcon}>!</span>
          <span>
            {normalizedLifecycleStage === 'retired'
              ? t('service_detail.text.this_service_has_been_retired_and_is_no_longer_a')
              : t('service_detail.text.this_service_is_deprecated_please_check_for_a_re')}
          </span>
          <Link href={editHref} className={styles.lifecycleBannerLink}>{t('service_detail.text.view_details')}</Link>
        </div>
      )}

      {/* ── Compact header ──────────────────────────────────────────────── */}
      <header className={styles.detailHeader}>
        <div className={styles.detailHeaderMain}>
          <div className={styles.headerMeta}>
            <span className={styles.serviceId}>{svc.service_id}</span>
            {(svc.service_type_name ?? svc.service_type) && <span className={styles.typeChip}>{svc.service_type_name ?? svc.service_type}</span>}
            <LifecycleBadge state={lifecycleState ?? svc.service_status ?? null} fallback={t('service_detail.lifecycle.draft')} />
          </div>
          <h1 className={styles.detailTitle}>{svc.title}</h1>
          <dl className={styles.headerFacts}>
            <div className={styles.headerFact}>
              <dt>{t('service_detail.text.owner')}</dt>
              <dd>{ownerName ?? <span className={styles.textWarning}>{t('service_detail.text.owner_missing')}</span>}</dd>
            </div>
            <div className={styles.headerFact}>
              <dt>{t('service_detail.text.readiness')}</dt>
              <dd>
                <span className={`${styles.statusDot} ${styles[`statusDot_${readinessTone}`]}`} aria-hidden="true" />
                {readinessLabel}
                {completeness != null && (
                  <span className={styles.headerFactMuted} title={t('service_detail.text.completeness')}>
                    {' · '}{t('service_detail.header.completeness', { pct: completeness })}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
        {(canEdit || requestAction) && (
          <div className={styles.headerActions}>
            {requestAction}
            {canEdit && <Link href={editHref} className={styles.primaryAction}>{t('service_detail.text.edit')}</Link>}
          </div>
        )}
      </header>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <TabsPrimitive.Root value={activeView} onValueChange={selectView} className={styles.tabsRoot}>
        <TabsPrimitive.List id="service-tabs" className={styles.tabList} aria-label={t('service_detail.text.service_detail_views')}>
          {BUSINESS_DETAIL_VIEWS.map((view) => (
            <TabsPrimitive.Trigger
              key={view}
              value={view}
              className={styles.tab}
              title={t(`service_detail.view.${view}.hint`)}
            >
              {t(`service_detail.view.${view}.label`)}
              {view === 'governance' && openItems > 0 && (
                <span className={styles.tabCount} aria-label={t('service_detail.tab.open_items', { count: openItems })}>{openItems}</span>
              )}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>

        {/* ── Přehled ─────────────────────────────────────────────────── */}
        <TabsPrimitive.Content value="overview" className={styles.tabPanel}>
          <div className={styles.split}>
            <div className={styles.main}>
              {businessSummary || svc.detailed_description || consumerValue || svc.scope_text || svc.exclusions ? (
                <>
                  {(businessSummary || svc.detailed_description) && (
                    <Section title={t('service_detail.text.purpose')} id="overview">
                      <p className={styles.lead}>{businessSummary ?? svc.detailed_description}</p>
                      {businessSummary && svc.detailed_description && svc.detailed_description !== businessSummary && (
                        <details className={styles.more}>
                          <summary>{t('service_detail.question.read_full')}</summary>
                          <p className={styles.prose}>{svc.detailed_description}</p>
                        </details>
                      )}
                    </Section>
                  )}

                  {consumerValue && consumerValue !== businessSummary && (
                    <Section title={t('service_detail.text.business_value')}>
                      {consumerValue.split(/\n\s*\n/).map((paragraph, index) => (
                        <p key={index} className={styles.prose}>{paragraph}</p>
                      ))}
                    </Section>
                  )}

                  {(svc.scope_text || svc.exclusions) && (
                    <Section title={t('service_detail.text.scope')}>
                      <div className={styles.dualPanel}>
                        {svc.scope_text && (
                          <div className={styles.infoCard}>
                            <div className={styles.infoCardLabel}>{t('service_detail.text.included')}</div>
                            <p className={styles.prose}>{svc.scope_text}</p>
                          </div>
                        )}
                        {svc.exclusions && (
                          <div className={styles.infoCard}>
                            <div className={styles.infoCardLabel}>{t('service_detail.text.not_covered')}</div>
                            <p className={styles.prose}>{svc.exclusions}</p>
                          </div>
                        )}
                      </div>
                    </Section>
                  )}
                </>
              ) : (
                <Section title={t('service_detail.text.purpose')} id="overview">
                  <div className={styles.emptyBlock}>
                    <p>{t('service_detail.overview.empty')}</p>
                    {canEdit && <Link href={`${editHref}#description`} className={styles.secondaryAction}>{t('service_detail.overview.add_description')}</Link>}
                  </div>
                </Section>
              )}
            </div>

            <aside className={styles.aside}>
              <Section title={t('service_detail.overview.facts')}>
                <dl className={styles.factList}>
                  <Fact label={t('service_detail.text.portfolio')}>
                    {overview?.portfolio.title ?? overview?.portfolio.code ?? svc.portfolio_group_name ?? svc.portfolio_group}
                  </Fact>
                  <Fact label={t('service_detail.text.audience')}>
                    {businessView?.target_audience_summary ?? svc.target_audience_summary ?? audiencePolicies[0]?.audience_type}
                  </Fact>
                  {svc.vlastnik !== ownerName && (
                    <Fact label={t('service_detail.text.area_owner')}>{svc.vlastnik}</Fact>
                  )}
                  <Fact label={t('service_detail.text.delivery_manager')}>{overview?.owners.delivery_manager?.display_name ?? svc.manager}</Fact>
                  {overview?.owners.steward?.display_name
                    && overview.owners.steward.display_name !== svc.vlastnik
                    && overview.owners.steward.display_name !== (overview.owners.delivery_manager?.display_name ?? svc.manager) && (
                    <Fact label={t('service_detail.text.steward')}>{overview.owners.steward.display_name}</Fact>
                  )}
                  <Fact label={t('service_detail.text.capability')}>
                    {primaryCapability
                      ? <Link href={`/c3/${encodeURIComponent(primaryCapability.c3_uuid)}`} className={styles.inlineLink}>{primaryCapability.title}</Link>
                      : (svc.c3_domain ?? svc.c3_reference)}
                  </Fact>
                  {svc.available_on && svc.available_on.length > 0 && (
                    <Fact label={t('service_detail.text.domains')}>
                      <DomainDotGroup domains={svc.available_on} />
                    </Fact>
                  )}
                </dl>
              </Section>
            </aside>
          </div>
        </TabsPrimitive.Content>

        {/* ── Jak ji získat ──────────────────────────────────────────── */}
        <TabsPrimitive.Content value="request" className={styles.tabPanel}>
          <div className={styles.main}>
            <Section title={t('service_detail.text.how_to_get_this_service')} id="request">
              <RequestabilityPanel
                service={svc}
                primaryOffering={primaryOffering}
                audiencePolicies={audiencePolicies}
              />
            </Section>
            {svc.offerings.length > 0 && (
              <Section title={t('service_detail.text.available_offerings')}>
                <OfferingsGrid offerings={svc.offerings} primaryOffering={primaryOffering} />
              </Section>
            )}
          </div>
        </TabsPrimitive.Content>

        {/* ── Podpora / SLA ──────────────────────────────────────────── */}
        <TabsPrimitive.Content value="support" className={styles.tabPanel}>
          <div className={styles.main}>
            {(supportModels.length > 0 || isRequestable) && (
              <Section title={t('service_detail.text.support')} id="support">
                <SupportModelPanel supportModels={supportModels} svc={svc} />
              </Section>
            )}

            <Section title={t('service_detail.text.sla_commitments')}>
              <SlaPanel
                summary={{
                  sla_availability:    svc.sla_availability    ?? null,
                  sla_restoration:     svc.sla_restoration     ?? null,
                  sla_delivery:        svc.sla_delivery        ?? null,
                  sla_restoration_text: svc.sla_restoration_text ?? null,
                  sla_delivery_text:   svc.sla_delivery_text   ?? null,
                }}
                detail={slaData}
              />
            </Section>

            {(operationalLinks.length > 0 || svc.review_due_at || svc.review_owner_user_id) && (
              <Section title={t('service_detail.text.operations')}>
                <OperationsPanel
                  links={operationalLinks}
                  reviewDueAt={svc.review_due_at ?? null}
                  reviewOwnerId={svc.review_owner_user_id ?? null}
                  serviceId={id}
                />
              </Section>
            )}
          </div>
        </TabsPrimitive.Content>

        {/* ── Vazby ──────────────────────────────────────────────────── */}
        <TabsPrimitive.Content value="dependencies" className={styles.tabPanel}>
          <div className={styles.main}>
            <Section
              title={t('service_detail.text.relationship_map')}
              action={<Link href={`/services/${id}/graph`} className={styles.inlineLink}>{t('service_detail.text.dependency_graph')}</Link>}
            >
              <RelationshipMap
                serviceTitle={svc.title}
                primaryOffering={primaryOffering?.title ?? primaryOffering?.offering_code ?? t('service_detail.text.offering_missing')}
                nodes={[
                  {
                    label: t('service_detail.text.requester'),
                    value: businessView?.target_audience_summary ?? svc.target_audience_summary ?? t('service_detail.text.audience_missing'),
                  },
                  {
                    label: t('service_detail.text.owner'),
                    value: ownerName ?? t('service_detail.text.owner_missing'),
                  },
                  {
                    label: t('service_detail.text.support'),
                    value: supportModels[0]?.support_owner_name ?? svc.vlastnik ?? t('service_detail.text.support_missing'),
                  },
                  {
                    label: t('service_detail.text.capability'),
                    value: primaryCapability?.title ?? svc.c3_domain ?? svc.c3_reference ?? t('service_detail.text.c3_mapping_missing'),
                  },
                ]}
              />
            </Section>
            <DependenciesPanel relations={svc.relations ?? []} overview={overview} />
          </div>
        </TabsPrimitive.Content>

        {/* ── Řízení ─────────────────────────────────────────────────── */}
        <TabsPrimitive.Content value="governance" className={styles.tabPanel} id="governance">
          <div className={styles.split}>
            <div className={styles.main}>
              <ReadinessChecklist
                items={checklist}
                isLoading={overviewLoading}
                error={overviewError}
                blockerCount={blockers.length}
                warningCount={warnings.length}
                riskCount={overview?.governance_risks.count ?? null}
                riskHighCount={overview?.governance_risks.high_count ?? null}
              />

              <GovernanceWorkflow serviceId={id} />

              {c3Visible && c3MappingsData && c3MappingsData.mappings.length > 0 && (
                <Section title={t('service_detail.text.c3_taxonomy_mapping')}>
                  <C3MappingTable mappings={c3MappingsData.mappings} />
                </Section>
              )}

              {svc.retired_note && (
                <Section title={t('service_detail.text.retirement_note')}>
                  <p className={styles.prose}>{svc.retired_note}</p>
                </Section>
              )}
            </div>

            <aside className={styles.aside}>
              <Section title={t('service_detail.text.governance_facts')}>
                <MetadataGrid columns={2}>
                  <MetadataItem label={t('service_detail.text.status')} value={svc.service_status_name ?? svc.service_status} />
                  <MetadataItem label={t('service_detail.text.criticality')} value={overview?.lifecycle.criticality_code ?? svc.criticality_code ?? svc.security_classification} />
                  <MetadataItem label={t('service_detail.text.next_review')} value={svc.review_due_at ?? overview?.lifecycle.review_due_at} kind="date" />
                  <MetadataItem label={t('service_detail.text.review_owner')} value={svc.review_owner_user_id != null ? String(svc.review_owner_user_id) : null} />
                  <MetadataItem
                    label={t('service_detail.text.sla_offerings')}
                    value={overview ? `${overview.sla.has_sla && overview.offerings.count > 0 ? t('service_detail.text.covered') : t('service_detail.text.incomplete')} · ${t('service_detail.sla_records_offerings', { records: overview.sla.record_count, offerings: overview.offerings.count })}` : null}
                  />
                  <MetadataItem label={t('service_detail.text.version')} value={svc.catalogue_version} />
                  <MetadataItem label={t('service_detail.text.created')} value={svc.created_at} kind="date" />
                  <MetadataItem label={t('service_detail.text.created_by')} value={svc.created_by} />
                  <MetadataItem label={t('service_detail.text.updated')} value={svc.updated_at} kind="date" />
                  <MetadataItem label={t('service_detail.text.updated_by')} value={svc.updated_by} />
                  <MetadataItem
                    label={t('service_detail.text.audit')}
                    value={overview ? `${countLabel(t, overview.audit_summary.count, 'change')}${overview.audit_summary.last_action?.performed_at ? ` · ${formatDate(overview.audit_summary.last_action.performed_at)}` : ''}` : null}
                  />
                </MetadataGrid>
              </Section>

              {rolesData && rolesData.length > 0 && (
                <Section
                  title={t('service_detail.text.ownership_history')}
                  action={<Link href="/operations#owner-load" className={styles.inlineLink}>{t('service_detail.question.owner_load')}</Link>}
                >
                  <OwnershipHistory roles={rolesData} />
                </Section>
              )}

              {hasImportEvidence && (
                <Section title={t('service_detail.text.import_evidence')}>
                  <MetadataGrid columns={2}>
                    <MetadataItem label={t('service_detail.text.source_id')} value={svc.source_local_id ?? svc.source_sp_id} />
                    <MetadataItem label={t('service_detail.text.source_modified')} value={svc.modified_at_source ?? svc.created_at_source} kind="date" />
                  </MetadataGrid>
                  <Link href={importEvidenceHref} className={styles.inlineLink}>{t('service_detail.text.open_import_source_evidence')}</Link>
                </Section>
              )}
            </aside>
          </div>
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────
type Tone = 'ok' | 'warning' | 'danger' | 'info' | 'muted';

interface ChecklistItem {
  key: string;
  tone: Tone;
  title: string;
  detail?: string | null;
  why?: string | null;
  how?: string | null;
  evidence?: string | null;
  status?: string | null;
  action?: { label: string; href: string };
}

const TONE_ORDER: Record<Tone, number> = { danger: 0, warning: 1, info: 2, muted: 3, ok: 4 };

function editorSectionForRule(rule: ReadinessRuleResult) {
  const text = `${rule.rule_key ?? ''} ${rule.title ?? ''} ${rule.message ?? ''}`.toLowerCase();
  if (text.includes('owner') || text.includes('ownership')) return 'ownership';
  if (text.includes('request') || text.includes('channel') || text.includes('offering')) return 'request-access';
  if (text.includes('c3') || text.includes('capability') || text.includes('mapping')) return 'c3mapping';
  if (text.includes('support') || text.includes('sla')) return 'support-model';
  return 'readiness-governance';
}

/**
 * One readiness checklist for the Řízení tab: readiness-gate rules, loose
 * blockers/warnings, the four core checks (owner, request path, support, C3)
 * and any remaining missing actions from Service 360 — each listed once.
 */
function buildChecklist({
  id,
  overview,
  service,
  ownerName,
  supportModels,
  requestHref,
  primaryOffering,
  capabilityCount,
  t,
}: {
  id: string;
  overview: ServiceOverview | null;
  service: ServiceDetail;
  ownerName: string | null;
  supportModels: ServiceSupportModel[];
  requestHref: string | null;
  primaryOffering: ServiceOffering | null | undefined;
  capabilityCount: number;
  t: Translate;
}): ChecklistItem[] {
  const editHref = `/services/${id}/edit`;
  const items: ChecklistItem[] = [];
  const rules = (overview?.readiness?.rules ?? []).filter((rule) => rule.status !== 'passed');
  const ruleTexts = new Set(rules.flatMap((rule) => [rule.message, rule.title, rule.title_text].filter(Boolean) as string[]));

  for (const rule of rules) {
    const failed = rule.status === 'failed';
    items.push({
      key: `rule-${rule.rule_key}`,
      tone: failed ? (rule.blocking || rule.severity === 'P0' ? 'danger' : 'warning') : rule.status === 'exception' ? 'info' : 'muted',
      title: rule.title_text ?? rule.title,
      detail: rule.message || rule.description,
      why: rule.why_text,
      how: rule.howto_text,
      evidence: rule.evidence_hint,
      status: failed ? rule.severity : `${rule.severity} · ${rule.status}`,
      action: failed ? { label: t('operations.readiness.action.fix_rule'), href: `${editHref}#${editorSectionForRule(rule)}` } : undefined,
    });
  }
  (overview?.readiness?.blockers ?? []).filter((text) => !ruleTexts.has(text)).forEach((text, index) => {
    items.push({ key: `blocker-${index}`, tone: 'danger', title: text, action: { label: t('service_detail.task.fix_record'), href: `${editHref}#readiness-governance` } });
  });
  (overview?.readiness?.warnings ?? []).filter((text) => !ruleTexts.has(text)).forEach((text, index) => {
    items.push({ key: `warning-${index}`, tone: 'warning', title: text, action: { label: t('service_detail.task.review'), href: `${editHref}#readiness-governance` } });
  });

  // Service 360 missing actions; the ones matching a core check feed that check instead.
  const missing = overview?.missing_actions ?? [];
  const matchCore = (pattern: RegExp) => missing.find((action) => pattern.test(action.key));
  const ownerAction = matchCore(/owner/);
  const requestAction = matchCore(/request|channel/);
  const supportAction = matchCore(/support/);
  const c3Action = matchCore(/c3|capab/);
  const coreActions = new Set([ownerAction, requestAction, supportAction, c3Action].filter(Boolean));

  items.push(ownerName && !ownerAction ? {
    key: 'owner', tone: 'ok', title: t('service_detail.check.owner_ok'), detail: ownerName,
  } : {
    key: 'owner', tone: 'warning', title: t('service_detail.text.owner_missing'), detail: ownerAction?.description ?? t('service_detail.check.owner_missing_detail'),
    action: { label: t('service_detail.text.fix_owner'), href: ownerAction?.href || `${editHref}#ownership` },
  });

  items.push(requestHref && !requestAction ? {
    key: 'request', tone: 'ok', title: t('service_detail.task.request_ok'),
    detail: primaryOffering?.title ? t('service_detail.task.request_ok_offering', { offering: primaryOffering.title }) : t('service_detail.task.request_ok_detail'),
  } : {
    key: 'request', tone: 'warning', title: t('service_detail.task.request_missing'), detail: t('service_detail.task.request_missing_detail'),
    action: { label: t('service_detail.task.add_path'), href: requestAction?.href || `${editHref}#request-access` },
  });

  items.push(supportModels.length && !supportAction ? {
    key: 'support', tone: 'ok', title: t('service_detail.task.support_ok'),
    detail: t('service_detail.task.support_ok_detail', { owner: supportModels[0]?.support_owner_name ?? service.vlastnik ?? t('service_detail.task.support') }),
  } : {
    key: 'support', tone: 'warning', title: t('service_detail.task.support_missing'), detail: t('service_detail.task.support_missing_detail'),
    action: { label: t('service_detail.task.fix_support'), href: supportAction?.href || `${editHref}#support-model` },
  });

  items.push(capabilityCount && !c3Action ? {
    key: 'c3', tone: 'ok', title: t('service_detail.task.c3_ok'), detail: t('service_detail.task.c3_ok_detail'),
  } : {
    key: 'c3', tone: 'warning', title: t('service_detail.task.c3_missing'), detail: t('service_detail.task.c3_missing_detail'),
    action: { label: t('service_detail.task.map_c3'), href: c3Action?.href || `${editHref}#c3mapping` },
  });

  for (const action of missing) {
    if (coreActions.has(action)) continue;
    items.push({
      key: `action-${action.key}`,
      tone: action.severity === 'blocker' ? 'danger' : action.severity === 'warning' ? 'warning' : 'info',
      title: action.title,
      detail: action.description,
      action: { label: t('service_detail.task.open'), href: action.href || `${editHref}#readiness-governance` },
    });
  }

  return items.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

function ReadinessChecklist({
  items,
  isLoading,
  error,
  blockerCount,
  warningCount,
  riskCount,
  riskHighCount,
}: {
  items: ChecklistItem[];
  isLoading: boolean;
  error: unknown;
  blockerCount: number;
  warningCount: number;
  riskCount: number | null;
  riskHighCount: number | null;
}) {
  const t = useT();
  const done = items.filter((item) => item.tone === 'ok').length;

  return (
    <Section
      title={t('service_detail.text.readiness')}
      id="readiness"
      action={(
        <span className={styles.checklistSummary}>
          {t('service_detail.checklist.progress', { done, total: items.length })}
          {blockerCount > 0 && <span className={`${styles.countPill} ${styles.countPill_danger}`}>{formatCountLabel(blockerCount, countForms(t, 'blockers'))}</span>}
          {warningCount > 0 && <span className={`${styles.countPill} ${styles.countPill_warning}`}>{formatCountLabel(warningCount, countForms(t, 'warnings'))}</span>}
          {riskCount ? (
            <span className={styles.countPill} title={countLabel(t, riskHighCount ?? 0, 'blocker')}>{countLabel(t, riskCount, 'signal')}</span>
          ) : null}
        </span>
      )}
    >
      {isLoading && <p className={styles.emptyState}>{t('service_detail.text.loading_overview')}</p>}
      {Boolean(error) && <p className={styles.textWarning}>{t('service_detail.text.service_360_overview_is_not_available')}</p>}
      <ul className={styles.checklist}>
        {items.map((item) => (
          <li key={item.key} className={`${styles.checkRow} ${item.tone === 'ok' ? styles.checkRowOk : ''}`}>
            <span className={`${styles.checkIcon} ${styles[`checkIcon_${item.tone}`]}`} aria-hidden="true">
              {item.tone === 'ok' ? '✓' : item.tone === 'danger' || item.tone === 'warning' ? '!' : 'i'}
            </span>
            <div className={styles.checkBody}>
              <div className={styles.checkTitle}>
                {item.title}
                {item.status && <span className={styles.checkStatus}>{item.status}</span>}
              </div>
              {item.detail && <p className={styles.checkDetail}>{item.detail}</p>}
              {(item.why || item.how || item.evidence) && (
                <details className={styles.more}>
                  <summary>{t('service_detail.checklist.why_how')}</summary>
                  <dl className={styles.checkExplain}>
                    {item.why && (<><dt>{t('operations.readiness.detail.why')}</dt><dd>{item.why}</dd></>)}
                    {item.how && (<><dt>{t('operations.readiness.detail.how')}</dt><dd>{item.how}</dd></>)}
                    {item.evidence && (<><dt>{t('service_detail.checklist.evidence')}</dt><dd><code>{item.evidence}</code></dd></>)}
                  </dl>
                </details>
              )}
            </div>
            {item.action && (
              <ActionHref href={item.action.href} className={styles.checkAction}>{item.action.label}</ActionHref>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function GovernanceWorkflow({ serviceId }: { serviceId: string }) {
  const t = useT();
  const { data: reviewData } = useGovernanceReviews({ serviceId, limit: 5 });
  const { data: decisionData } = useGovernanceDecisions({ serviceId, limit: 5 });
  const reviews = reviewData?.items ?? [];
  const decisions = decisionData?.items ?? [];
  const encodedId = encodeURIComponent(serviceId);

  return (
    <Section title={t('service_detail.text.governance_workflow')} id="governance-workflow">
      <div className={styles.workflowMiniGrid}>
        <div>
          <div className={styles.workflowHead}>
            <h3>{t('service_detail.text.current_reviews')}</h3>
            <Link href={`/operations/reviews?service_id=${encodedId}`} className={styles.inlineLink}>{t('service_detail.text.open_reviews')}</Link>
          </div>
          {reviews.length ? reviews.map((review) => (
            <Link key={review.id} href="/operations/reviews" className={styles.workflowMiniRow}>
              <strong>{review.review_type}</strong>
              <span>{review.status} · {review.assigned_to ?? t('service_detail.text.unassigned')} · {review.due_at ? formatDate(review.due_at) : t('service_detail.text.no_due_date')}</span>
            </Link>
          )) : <p className={styles.emptyState}>{t('service_detail.text.no_current_governance_reviews')}</p>}
        </div>
        <div>
          <div className={styles.workflowHead}>
            <h3>{t('service_detail.text.recent_decisions')}</h3>
            <Link href={`/operations/decisions?service_id=${encodedId}`} className={styles.inlineLink}>{t('service_detail.text.open_governance_decisions')}</Link>
          </div>
          {decisions.length ? decisions.map((decision) => (
            <Link key={decision.id} href="/operations/decisions" className={styles.workflowMiniRow}>
              <strong>{decision.decision}</strong>
              <span>{decision.decision_type} · {decision.decided_by ?? t('service_detail.text.unknown')} · {decision.rationale ?? t('service_detail.text.no_rationale')}</span>
            </Link>
          )) : <p className={styles.emptyState}>{t('service_detail.text.no_governance_decisions_yet')}</p>}
        </div>
      </div>
    </Section>
  );
}

function RelationshipMap({
  serviceTitle,
  nodes,
  primaryOffering,
}: {
  serviceTitle: string;
  nodes: Array<{ label: string; value: string }>;
  primaryOffering: string;
}) {
  const t = useT();
  return (
    <div className={styles.relationshipMap}>
      <div className={styles.mapNodePrimary}>
        <span>{t('service_detail.text.service')}</span>
        <strong>{serviceTitle}</strong>
        <small>{primaryOffering}</small>
      </div>
      {nodes.map((node, index) => (
        <div key={`${node.label}-${index}`} className={`${styles.mapNode} ${styles[`mapNode_${index}`] ?? ''}`}>
          <span>{node.label}</span>
          <strong>{node.value}</strong>
        </div>
      ))}
    </div>
  );
}

const CANONICAL_LIFECYCLE_STATES = ['draft', 'live', 'deprecated', 'retired'] as const;

type LifecycleStepCode = typeof CANONICAL_LIFECYCLE_STATES[number];

function normalizeLifecycleState(state: string | null): LifecycleStepCode {
  if (!state) return 'draft';
  // Legacy → canonical mapping
  if (state === 'design' || state === 'planned' || state === 'under_review' || state === 'approved') return 'draft';
  if (state === 'active' || state === 'published' || state === 'production') return 'live';
  if (state === 'retiring') return 'deprecated';
  return CANONICAL_LIFECYCLE_STATES.includes(state as LifecycleStepCode) ? state as LifecycleStepCode : 'draft';
}

function formatLifecycleState(t: Translate, state: LifecycleStepCode) {
  return t(`service_detail.lifecycle.${state}`);
}

function Section({ title, children, id, action }: { title: string; children: ReactNode; id?: string; action?: ReactNode }) {
  return (
    <section className={styles.section} id={id}>
      {title ? (
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  const empty = children == null || children === '';
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{empty ? <span className={styles.factEmpty}>—</span> : children}</dd>
    </div>
  );
}

function ActionHref({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (/^https?:\/\//i.test(href)) {
    return <a href={href} target="_blank" rel="noreferrer" className={className}>{children}</a>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

function OfferingsGrid({
  offerings,
  primaryOffering,
}: {
  offerings: ServiceOffering[];
  primaryOffering: ServiceOffering | null;
}) {
  const t = useT();
  if (!offerings || offerings.length === 0) return null;

  // Featured card = explicit default, or primary resolved from detail, or first in list
  const featured = primaryOffering ?? offerings[0];
  const rest = offerings.filter((o) => o.id !== featured.id);

  return (
    <div>
      {/* ── Featured / default offering ─────────────────────────────────── */}
      <div style={{ marginBottom: rest.length > 0 ? 'var(--space-5)' : 0 }}>
        <div className={styles.offeringFeaturedLabel}>
          {featured.is_default ? t('service_detail.text.default_offering') : t('service_detail.text.primary_offering')}
        </div>
        <article className={`${styles.offeringCard} ${styles.offeringCardPrimary}`}>
          <div className={styles.offeringHeader}>
            <div>
              <div className={styles.offeringCode}>{featured.offering_code}</div>
              <h3 className={styles.offeringTitle}>{featured.title}</h3>
            </div>
            <div className={styles.offeringBadges}>
              {featured.is_default && <span className={styles.softBadgeStrong}>{t('service_detail.text.default')}</span>}
              <span className={styles.softBadge}>{featured.status}</span>
              {featured.requestable
                ? <span className={styles.softBadgePositive}>{t('service_detail.text.requestable')}</span>
                : <span className={styles.softBadge}>{t('service_detail.text.not_requestable')}</span>
              }
            </div>
          </div>
          <div className={styles.offeringFeaturedBody}>
            <div>
              {featured.description
                ? <p className={styles.prose}>{featured.description}</p>
                : <p className={styles.emptyState}>{t('service_detail.text.no_description_provided')}</p>
              }
              {safeHref(featured.request_channel_url) && (
                <a href={safeHref(featured.request_channel_url)!} target="_blank" rel="noreferrer" className={styles.offeringLink}>
                  {t('service_detail.text.open_request_form')}
                </a>
              )}
            </div>
            <div className={styles.offeringMeta}>
              <MiniFact label={t('service_detail.text.approval')} value={formatBool(t, featured.approval_required)} />
              <MiniFact label={t('service_detail.text.lead_time')} value={featured.lead_time_text ?? '—'} />
              <MiniFact label={t('service_detail.text.support_tier')} value={featured.support_tier_code ?? '—'} />
              <MiniFact label={t('service_detail.text.channel')} value={featured.request_channel_type ?? '—'} />
            </div>
          </div>
        </article>
      </div>

      {/* ── Remaining offerings ──────────────────────────────────────────── */}
      {rest.length > 0 && (
        <>
          <div className={styles.sectionIntro} style={{ marginBottom: 'var(--space-3)' }}>
            {t('service_detail.text.additional_offerings')}
          </div>
          <div className={styles.offeringsGrid}>
            {rest.map((offering) => (
              <article key={offering.id} className={styles.offeringCard}>
                <div className={styles.offeringHeader}>
                  <div>
                    <div className={styles.offeringCode}>{offering.offering_code}</div>
                    <h3 className={styles.offeringTitle}>{offering.title}</h3>
                  </div>
                  <div className={styles.offeringBadges}>
                    <span className={styles.softBadge}>{offering.status}</span>
                    {(offering.effective_requestable ?? offering.requestable)
                      ? <span className={styles.softBadgePositive}>{t('service_detail.text.requestable')}</span>
                      : <span className={styles.softBadge}>{t('service_detail.text.not_requestable')}</span>
                    }
                  </div>
                </div>
                {offering.description && <p className={styles.prose}>{offering.description}</p>}
                <div className={styles.offeringMeta}>
                  <MiniFact label={t('service_detail.text.approval')} value={formatBool(t, offering.effective_approval_required ?? offering.approval_required)} />
                  <MiniFact label={t('service_detail.text.lead_time')} value={offering.effective_lead_time_text ?? offering.lead_time_text ?? '—'} />
                  <MiniFact label={t('service_detail.text.support_tier')} value={offering.support_tier_code ?? '—'} />
                  <MiniFact label={t('service_detail.text.channel')} value={offering.effective_request_channel_type ?? offering.request_channel_type ?? '—'} />
                </div>
                {safeHref(offering.effective_request_channel_url ?? offering.request_channel_url) && (
                  <a href={safeHref(offering.effective_request_channel_url ?? offering.request_channel_url)!} target="_blank" rel="noreferrer" className={styles.offeringLink}>
                    {t('service_detail.text.open_request_path')}
                  </a>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RequestabilityPanel({
  service,
  primaryOffering,
  audiencePolicies,
}: {
  service: import('@/features/services/model/service.types').ServiceDetail;
  primaryOffering: ServiceOffering | null;
  audiencePolicies: ServiceAudiencePolicy[];
}) {
  const t = useT();
  const requestable = primaryOffering?.requestable ?? service.requestable;
  const externalRequestHref = safeHref(primaryOffering?.request_channel_url ?? service.request_channel_url);
  const requestChannel = primaryOffering?.request_channel_type ?? service.request_channel_type;
  const leadTime = primaryOffering?.lead_time_text ?? service.fulfillment_lead_time_text;
  const approval = primaryOffering?.approval_required ?? service.approval_required;

  return (
    <div className={styles.requestGrid}>
      <div className={styles.infoCard}>
        <div className={styles.infoCardLabel}>{t('service_detail.text.ordering_path')}</div>
        <div className={styles.requestHeadline}>{requestable ? t('service_detail.text.available_to_request') : t('service_detail.text.not_requestable_yet')}</div>
        <div className={styles.requestMeta}>
          <MiniFact label={t('service_detail.text.channel')} value={requestChannel ?? '—'} />
          <MiniFact label={t('service_detail.text.approval')} value={formatBool(t, approval)} />
          <MiniFact label={t('service_detail.text.lead_time')} value={leadTime ?? '—'} />
        </div>
        {externalRequestHref ? (
          <ActionHref href={externalRequestHref} className={styles.inlineActionLink}>{t('service_detail.text.open_request_channel')}</ActionHref>
        ) : requestable ? (
          <p className={styles.operationalGap}>{t('service_detail.text.readiness_blocker_add_an_external_request_url_so')}</p>
        ) : (
          <p className={styles.prose}>{t('service_detail.text.this_service_is_informational_use_the_owner_and')}</p>
        )}
      </div>

      {(service.target_audience_summary || audiencePolicies.length > 0) && (
        <div className={styles.infoCard}>
          <div className={styles.infoCardLabel}>{t('service_detail.text.audience_eligibility')}</div>
          {service.target_audience_summary && <p className={styles.prose}>{service.target_audience_summary}</p>}
          {audiencePolicies.length > 0 && (
          <div className={styles.policyList}>
            {audiencePolicies.map((policy) => (
              <div key={policy.id} className={styles.policyRow}>
                <div className={styles.policyHeadline}>
                  {policy.audience_type ?? t('service_detail.text.audience_policy')}
                  {policy.region_code ? ` · ${policy.region_code}` : ''}
                </div>
                <div className={styles.policyMeta}>
                  {policy.business_unit ?? t('service_detail.text.any_business_unit')}
                </div>
                {policy.eligibility_rule && <p className={styles.prose}>{policy.eligibility_rule}</p>}
                {policy.notes && <p className={styles.policyNote}>{policy.notes}</p>}
              </div>
            ))}
          </div>
          )}
        </div>
      )}
    </div>
  );
}

function SupportModelPanel({
  supportModels,
  svc,
}: {
  supportModels: ServiceSupportModel[];
  svc: import('@/features/services/model/service.types').ServiceDetail;
}) {
  const t = useT();
  if (!supportModels || supportModels.length === 0) {
    const requestable = svc.requestable ?? svc.business_view?.requestable;
    return (
      <div className={styles.infoCard}>
        <div className={styles.infoCardLabel}>{t('service_detail.text.support_model')}</div>
        {requestable && (
          <p className={styles.operationalGap}>
            {t('service_detail.text.readiness_blocker_add_a_support_model_so_consume')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.supportGrid}>
      {supportModels.map((model) => (
        <div key={model.id} className={styles.infoCard}>
          <div className={styles.infoCardLabel}>
            {model.offering_id ? t('service_detail.text.offering_support') : t('service_detail.text.service_support')}
          </div>
          <div className={styles.requestMeta}>
            <MiniFact label={t('service_detail.text.support_owner')} value={model.support_owner_name ?? svc.vlastnik ?? '—'} />
            <MiniFact label={t('service_detail.text.resolver_group')} value={model.resolver_group ?? '—'} />
            <MiniFact label={t('service_detail.text.hours')} value={model.support_hours_code ?? svc.support_availability_raw ?? '—'} />
            <MiniFact label={t('service_detail.text.channel')} value={model.support_channel ?? '—'} />
            <MiniFact label={t('service_detail.text.escalation')} value={model.escalation_path ?? '—'} />
            <MiniFact label={t('service_detail.text.maintenance')} value={model.maintenance_window ?? '—'} />
          </div>
          {model.review_cadence && (
            <p className={styles.policyNote}>{t('service_detail.text.review_cadence')}{' '}{model.review_cadence}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Operations panel: grouped links + review metadata ────────────────────────

const LINK_TYPE_ORDER = ['knowledge', 'incidents', 'changes', 'docs', 'review', 'monitoring', 'support', 'other'];
const LINK_TYPE_CODES = new Set(['knowledge', 'incidents', 'changes', 'docs', 'review', 'monitoring', 'support', 'other']);

function OperationsPanel({
  links,
  reviewDueAt,
  reviewOwnerId,
  serviceId,
}: {
  links: ServiceOperationalLink[];
  reviewDueAt: string | null;
  reviewOwnerId: number | string | null;
  serviceId: string;
}) {
  // Group links by type
  const t = useT();
  const grouped: Record<string, ServiceOperationalLink[]> = {};
  for (const link of links) {
    const key = link.link_type ?? 'other';
    (grouped[key] = grouped[key] ?? []).push(link);
  }
  const groupKeys = [
    ...LINK_TYPE_ORDER.filter(k => grouped[k]),
    ...Object.keys(grouped).filter(k => !LINK_TYPE_ORDER.includes(k)),
  ];

  // Review overdue check
  const reviewDate = reviewDueAt ? new Date(reviewDueAt) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reviewOverdue  = reviewDate ? reviewDate < today : false;
  const reviewSoon     = reviewDate && !reviewOverdue
    ? (reviewDate.getTime() - today.getTime()) < 14 * 24 * 60 * 60 * 1000  // within 14 days
    : false;

  return (
    <div className={styles.operationsPanel}>
      {/* Service review card */}
      {(reviewDueAt || reviewOwnerId) && (
        <div className={`${styles.reviewCard} ${reviewOverdue ? styles.reviewCardOverdue : reviewSoon ? styles.reviewCardSoon : ''}`}>
          <div className={styles.reviewCardLabel}>{t('service_detail.text.service_review')}</div>
          <div className={styles.reviewMeta}>
            {reviewDueAt && (
              <span className={reviewOverdue ? styles.reviewOverdue : reviewSoon ? styles.reviewSoon : ''}>
                {reviewOverdue ? t('service_detail.text.overdue') : reviewSoon ? t('service_detail.text.due_soon') : ''}
                {t('service_detail.text.next_review_2')}{' '}{formatDate(reviewDueAt)}
              </span>
            )}
            {reviewOwnerId && <span>{t('service_detail.text.review_owner_id')}{' '}{reviewOwnerId}</span>}
          </div>
          <Link href={`/services/${serviceId}/edit#governance`} className={styles.inlineActionLink}>
            {t('service_detail.text.update_review_date')}
          </Link>
        </div>
      )}

      {/* Grouped operational links */}
      {groupKeys.map(key => (
        <div key={key} className={styles.linkGroup}>
          <div className={styles.linkGroupLabel}>{LINK_TYPE_CODES.has(key) ? t(`service_detail.link_type.${key}`) : key}</div>
          <div className={styles.linksGrid}>
            {grouped[key].map(link => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className={styles.linkCard}
              >
                <span className={styles.linkTitle}>{link.title}</span>
                <span className={styles.linkArrow}>↗</span>
              </a>
            ))}
          </div>
        </div>
      ))}

    </div>
  );
}

// ── Lifecycle badge ──────────────────────────────────────────────────────────
const LIFECYCLE_BADGE_CLASS: Record<string, string> = {
  draft:        'lifecycleDraft',
  live:         'lifecycleLive',
  deprecated:   'lifecycleDeprecated',
  retired:      'lifecycleRetired',
  // legacy aliases
  design:       'lifecycleDraft',
  under_review: 'lifecycleDraft',
  approved:     'lifecycleDraft',
  active:       'lifecycleLive',
  retiring:     'lifecycleDeprecated',
};

function LifecycleBadge({ state, fallback }: { state: string | null; fallback: string }) {
  const t = useT();
  if (!state) return <span className={styles.heroFactValue}>{fallback}</span>;
  const normalized = normalizeLifecycleState(state);
  const cls = LIFECYCLE_BADGE_CLASS[normalized] ?? 'lifecycleDraft';
  return (
    <span className={`${styles.lifecycleBadge} ${styles[cls]}`}>
      {formatLifecycleState(t, normalized)}
    </span>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.miniFact}>
      <span className={styles.miniFactLabel}>{label}</span>
      <span className={styles.miniFactValue}>{value}</span>
    </div>
  );
}

// ── Ownership History (Item 12) ────────────────────────────────────────────────
const ROLE_CODES = new Set(['service_owner', 'service_area_owner', 'service_delivery_manager']);

function OwnershipHistory({ roles }: { roles: ServiceRoleAssignment[] }) {
  const t = useT();
  const today = new Date().toISOString().split('T')[0];
  const current = roles.filter(r => r.valid_to == null);
  const expired = roles.filter(r => r.valid_to != null && r.valid_to < today);

  return (
    <div className={styles.ownershipTable}>
      {[...current, ...expired].map(r => (
        <div key={r.id} className={`${styles.ownershipRow} ${r.valid_to ? styles.ownershipRowExpired : ''}`}>
          <span className={styles.ownershipRole}>{ROLE_CODES.has(r.role_code) ? t(`service_detail.role.${r.role_code}`) : r.role_code}</span>
          <span className={styles.ownershipName}>
            {r.display_name}
            {r.organization_name && <span className={styles.ownershipOrg}> · {r.organization_name}</span>}
          </span>
          <span className={styles.ownershipPeriod}>
            {r.valid_from ? new Date(r.valid_from).toLocaleDateString('cs-CZ') : '—'}
            {' → '}
            {r.valid_to ? new Date(r.valid_to).toLocaleDateString('cs-CZ') : <em>{t('service_detail.role.current')}</em>}
          </span>
        </div>
      ))}
    </div>
  );
}

function DependenciesPanel({
  relations,
  overview,
}: {
  relations: ServiceRelation[];
  overview: ServiceOverview | null;
}) {
  const t = useT();
  const incoming = overview?.dependencies.incoming ?? [];
  const outgoing = overview?.dependencies.outgoing ?? relations;
  const mandatoryCount = overview?.dependencies.mandatory_count ?? relations.filter((item) => item.is_mandatory).length;

  return (
    <>
      <Section title={t('service_detail.text.relationships')} id="dependencies">
        <div className={styles.dualPanel}>
          <div className={styles.infoCard}>
            <div className={styles.infoCardLabel}>{t('service_detail.text.what_the_service_needs')}</div>
            {outgoing.length ? (
              <div className={styles.relationList}>
                {outgoing.slice(0, 8).map((relation) => (
                  <RelationRow key={`out-${relation.id}`} relation={relation} />
                ))}
              </div>
            ) : (
              <p className={styles.emptyState}>{t('service_detail.text.no_outgoing_relations_are_recorded')}</p>
            )}
          </div>
          <div className={styles.infoCard}>
            <div className={styles.infoCardLabel}>{t('service_detail.text.what_depends_on_the_service')}</div>
            {incoming.length ? (
              <div className={styles.relationList}>
                {incoming.slice(0, 8).map((relation) => (
                  <RelationRow key={`in-${relation.id}`} relation={relation} />
                ))}
              </div>
            ) : (
              <p className={styles.emptyState}>{t('service_detail.text.no_incoming_relations_are_recorded')}</p>
            )}
          </div>
        </div>
      </Section>
      <Section title={t('service_detail.text.dependency_conclusion')}>
        <p className={styles.prose}>
          {t('service_detail.dependency_summary', { outgoing: outgoing.length, incoming: incoming.length })}
          {mandatoryCount > 0 ? ` ${t('service_detail.mandatory_dependency_impact', { count: mandatoryCount })}` : t('service_detail.text.no_mandatory_dependency_is_highlighted')}
        </p>
      </Section>
    </>
  );
}

function RelationRow({ relation }: { relation: ServiceRelation }) {
  const t = useT();
  return (
    <div className={styles.relationRow}>
      <span className={styles.relType}>{t(relationTypeLabelKey(relation.relation_type))}</span>
      <Link href={`/services/${relation.to_service_id}`} className={styles.relLink}>
        {relation.to_title ?? relation.to_service_id}
      </Link>
      {relation.is_mandatory && <span className={styles.relBadgeDanger}>{t('service_detail.relation.mandatory')}</span>}
      {relation.impact_level && <span className={styles.relBadge}>{relation.impact_level}</span>}
      {relation.is_verified && <span className={styles.relBadgeGreen}>{t('service_detail.relation.verified')}</span>}
    </div>
  );
}

// ── C3 Taxonomy Mapping Table ─────────────────────────────────────────────────
const C3_ITEM_TYPE_CODES = new Set(['BP', 'BR', 'CP', 'CI', 'CO', 'CR', 'IP', 'UA']);

const PACE_COLORS: Record<string, string> = {
  Differentiation: 'var(--color-status-active)',
  Systems:         'var(--color-info)',
  Commodity:       'var(--color-text-secondary)',
  Innovation:      'var(--color-warning)',
};

function C3MappingTable({ mappings }: { mappings: ServiceC3Mapping[] }) {
  const t = useT();
  return (
    <div className={styles.c3MappingTable}>
      <div className={styles.c3MappingHeader}>
        <span>{t('service_detail.text.c3_item')}</span>
        <span>{t('service_detail.text.type')}</span>
        <span>{t('service_detail.text.mapping')}</span>
        <span>{t('service_detail.text.pace_layer')}</span>
        <span>{t('service_detail.text.domain')}</span>
        <span>{t('service_detail.text.level')}</span>
        <span>{t('service_detail.text.note')}</span>
      </div>
      {mappings.map(m => (
        <div key={m.id} className={`${styles.c3MappingRow} ${m.is_primary ? styles.c3MappingRowPrimary : ''}`}>
          <span className={styles.c3ItemTitle}>
            {m.is_primary && <span className={styles.c3PrimaryBadge}>●</span>}
            <Link href={`/c3/${encodeURIComponent(m.c3_uuid)}`} className={styles.c3ItemLink}>{m.c3_short_title || m.c3_title || m.c3_uuid}</Link>
            {m.c3_external_id && <span className={styles.c3ItemCode}>{m.c3_external_id}</span>}
          </span>
          <span>
            {m.c3_item_type && (
              <span className={styles.c3ItemTypeBadge} title={m.c3_item_type && C3_ITEM_TYPE_CODES.has(m.c3_item_type) ? t(`service_detail.c3_item_type.${m.c3_item_type}`) : undefined}>
                {m.c3_item_type}
              </span>
            )}
          </span>
          <span>
            {m.mapping_type_code && (
              <span className={styles.c3MappingTypeBadge}>
                {m.mapping_type_name || m.mapping_type_code}
              </span>
            )}
          </span>
          <span>
            {m.pace_code && (
              <span
                className={styles.c3PaceBadge}
                style={{ color: PACE_COLORS[m.pace_code] ?? 'inherit' }}
              >
                {m.pace_name || m.pace_code}
              </span>
            )}
          </span>
          <span className={styles.c3Domain}>{m.c3_domain ?? '—'}</span>
          <span>{m.c3_level ?? '—'}</span>
          <span className={styles.c3MappingNote}>{m.mapping_note ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

const BUSINESS_DETAIL_VIEWS: DetailView[] = ['overview', 'request', 'support', 'dependencies', 'governance'];

type Translate = (key: string, params?: Record<string, string | number>) => string;

function countLabel(t: Translate, count: number, noun: 'service' | 'blocker' | 'warning' | 'offering' | 'mapping' | 'signal' | 'change') {
  return t(`service_detail.count.${noun}`, { count });
}

function countForms(t: Translate, noun: 'blockers' | 'warnings') {
  return {
    one: t(`layout.review_action_modal.${noun}.one`),
    few: t(`layout.review_action_modal.${noun}.few`),
    many: t(`layout.review_action_modal.${noun}.many`),
  };
}

function formatBool(t: Translate, value: boolean | null | undefined) {
  if (value == null) return '—';
  return value ? t('common.yes') : t('common.no');
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('cs-CZ');
}
