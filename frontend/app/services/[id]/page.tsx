/**
 * Service Detail: catalogue-first main body plus governance right rail.
 * Keep raw/import evidence out of the default detail path; expose audit history
 * and editor links for authorized users instead.
 */
'use client';

import { use, useEffect, useState, type MouseEvent } from 'react';
import Link from '@/app/components/AppLink';
import { useInstallStatus } from '@/features/install/installStatus';
import {
  useService, useService360, useServiceOverview, useServiceSla, useServiceRoles, useServiceC3Mappings,
  type ServiceC3Mapping,
} from '@/features/services/hooks/useServices';
import { AvailabilityBadge } from '@/features/services/components/AvailabilityBadge';
import { DomainDotGroup }    from '@/features/services/components/DomainDotGroup';
import { MetadataItem, MetadataGrid } from '@/features/services/components/MetadataItem';
import { SlaPanel }          from '@/features/services/components/SlaPanel';
import { Surface } from '@/design-system/primitives';
import { Button }  from '@/design-system/controls/Button';
import { useGovernanceDecisions, useGovernanceReviews } from '@/features/governance/hooks/useGovernance';
import type {
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
import { relationTypeLabelKey } from '@/features/services/relationTypes';
import styles from './detail.module.css';

interface Props { params: Promise<{ id: string }> }
type DetailView = 'overview' | 'request' | 'support' | 'dependencies' | 'governance';

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
  const [activeView,  setActiveView]  = useState<DetailView>('overview');

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'request') setActiveView('request');
      if (hash === 'support') setActiveView('support');
      if (hash === 'dependencies') setActiveView('dependencies');
      if (hash === 'governance' || hash === 'governance-workflow' || hash === 'history' || hash === 'audit' || hash === 'readiness') setActiveView('governance');
    };

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
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
  const externalRequestHref = safeHref(
    primaryOffering?.request_channel_url ??
    businessView?.request_channel_url ??
    svc.request_channel_url
  );
  const requestHref = externalRequestHref;
  const isRequestable = primaryOffering?.requestable ?? businessView?.requestable ?? svc.requestable ?? false;
  const supportAnchor = '#support';
  const governanceAnchor = '#governance';
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
  const openGovernanceWorkflow = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setActiveView('governance');
    window.setTimeout(() => {
      window.history.replaceState(null, '', '#governance-workflow');
      document.getElementById('governance-workflow')?.scrollIntoView({ block: 'start' });
    }, 0);
  };
  const lifecycleState = overview?.lifecycle.stage_code ?? svc.lifecycle_stage_code ?? businessView?.lifecycle_state ?? svc.lifecycle_state ?? svc.service_status ?? null;
  const normalizedLifecycleStage = normalizeLifecycleState(lifecycleState);
  const overviewFacts = [
    { label: t('service_detail.text.requestable'), value: formatBool(t, businessView?.requestable ?? svc.requestable) },
    { label: t('service_detail.text.lifecycle'), value: formatLifecycleState(t, normalizedLifecycleStage) },
    { label: t('service_detail.text.primary_offering'), value: primaryOffering?.title ?? primaryOffering?.offering_code ?? t('service_detail.text.not_defined_yet') },
    { label: t('service_detail.text.support'), value: supportModels[0]?.support_owner_name ?? svc.vlastnik ?? '—' },
    { label: t('service_detail.text.audience'), value: businessView?.target_audience_summary ?? svc.target_audience_summary ?? audiencePolicies[0]?.audience_type ?? '—' },
    { label: t('service_detail.text.lead_time'), value: primaryOffering?.lead_time_text ?? businessView?.fulfillment_lead_time_text ?? svc.fulfillment_lead_time_text ?? '—' },
  ];

  const visibleViews = BUSINESS_DETAIL_VIEWS;

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

      {/*
       * Design exception (LAYOUT_PROPOSAL §11):
       * Service 360 uses RelationshipStudioHero as a full-canvas hero
       * instead of the standard <PageHeader>. RelationshipStudioHero
       * provides the 4-question-card pattern (What / Who / Ready / Depends)
       * specified in §11 and is the intentional top-of-page anchoring element.
       * Do NOT add a generic PageHeader above this component.
       */}
      <RelationshipStudioHero
        id={id}
        service={svc}
        overview={overview}
        businessSummary={businessSummary}
        consumerValue={consumerValue}
        primaryOffering={primaryOffering}
        supportModels={supportModels}
        requestHref={requestHref}
        supportAnchor={supportAnchor}
        lifecycleState={lifecycleState}
        overviewFacts={overviewFacts}
      />

      <nav className={styles.viewNav} aria-label={t('service_detail.text.service_detail_views')}>
        {visibleViews.map((view) => (
          <button
            key={view.id}
            type="button"
            className={`${styles.viewTab} ${view.technical ? styles.viewTabTechnical : ''} ${activeView === view.id ? styles.viewTabActive : ''}`}
            onClick={() => setActiveView(view.id)}
          >
            <span className={styles.viewTabLabel}>{t(`service_detail.view.${view.id}.label`)}</span>
            {view.technical && <span className={styles.techBadge}>{t('service_detail.text.tech')}</span>}
            <span className={styles.viewTabHint}>{t(`service_detail.view.${view.id}.hint`)}</span>
          </button>
        ))}
      </nav>

      {/* ── Body + Right rail ────────────────────────────────────────── */}
      <div className={styles.body}>

        {/* Main content */}
        <div className={styles.main}>
          {activeView === 'overview' && (
            <>
              {(businessSummary || svc.detailed_description) && (
                <Section title={t('service_detail.text.overview')} id="overview">
                  {businessSummary && <p className={styles.prose}>{businessSummary}</p>}
                  {svc.detailed_description && svc.detailed_description !== businessSummary && (
                    <p className={styles.prose} style={{ marginTop: 'var(--space-3)' }}>
                      {svc.detailed_description}
                    </p>
                  )}
                </Section>
              )}

              {consumerValue && (
                <Section title={t('service_detail.text.business_value')}>
                  {consumerValue.split(/\n\s*\n/).map((paragraph, index) => (
                    <p
                      key={index}
                      className={index === 0 ? styles.calloutQuote : styles.prose}
                      style={index === 0 ? { borderLeftColor: 'var(--color-info)' } : undefined}
                    >
                      {paragraph}
                    </p>
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
          )}

          {activeView === 'request' && (
            <>
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
            </>
          )}

          {activeView === 'support' && (
            <>
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
            </>
          )}

          {activeView === 'dependencies' && (
            <DependenciesPanel relations={svc.relations ?? []} overview={overview} />
          )}

          {activeView === 'governance' && (
            <div id="governance" className={styles.governanceStack}>
              <Service360Panel
                overview={overview}
                isLoading={overviewLoading}
                error={overviewError}
                serviceId={id}
              />

              <Section title={t('service_detail.text.governance_facts')}>
                <MetadataGrid columns={3}>
                  <MetadataItem label={t('service_detail.text.lifecycle')} value={businessView?.lifecycle_state ?? svc.lifecycle_state ?? svc.service_status} />
                  <MetadataItem label={t('service_detail.text.status')} value={svc.service_status_name ?? svc.service_status} />
                  <MetadataItem label={t('service_detail.text.criticality')} value={svc.criticality_code ?? svc.security_classification} />
                  <MetadataItem label={t('service_detail.text.owner')} value={svc.service_owner} kind="person" />
                  <MetadataItem label={t('service_detail.text.area_owner')} value={svc.vlastnik} kind="person" />
                  <MetadataItem label={t('service_detail.text.review_owner')} value={svc.review_owner_user_id != null ? String(svc.review_owner_user_id) : null} />
                  <MetadataItem label={t('service_detail.text.next_review')} value={svc.review_due_at} kind="date" />
                  <MetadataItem label={t('service_detail.text.portfolio')} value={svc.portfolio_group_name ?? svc.portfolio_group} />
                  <MetadataItem label={t('service_detail.text.updated')} value={svc.updated_at} kind="date" />
                </MetadataGrid>
              </Section>

              {c3Visible && c3MappingsData && c3MappingsData.mappings.length > 0 && (
                <Section title={t('service_detail.text.c3_taxonomy_mapping')}>
                  <C3MappingTable mappings={c3MappingsData.mappings} />
                </Section>
              )}

              <Section title={t('service_detail.text.audit_trail')}>
                <MetadataGrid columns={3}>
                  <MetadataItem label={t('service_detail.text.version')} value={svc.catalogue_version} />
                  <MetadataItem label={t('service_detail.text.created')} value={svc.created_at} kind="date" />
                  <MetadataItem label={t('service_detail.text.updated')} value={svc.updated_at} kind="date" />
                  <MetadataItem label={t('service_detail.text.created_by')} value={svc.created_by} />
                  <MetadataItem label={t('service_detail.text.updated_by')} value={svc.updated_by} />
                </MetadataGrid>
                <a href="#governance" className={styles.graphLink} onClick={() => setActiveView('governance')}>{t('service_detail.text.open_audit_trail')}</a>
              </Section>

              {rolesData && rolesData.length > 0 && (
                <Section title={t('service_detail.text.ownership_history')}>
                  <OwnershipHistory roles={rolesData} />
                </Section>
              )}

              {svc.retired_note && (
                <Section title={t('service_detail.text.retirement_note')}>
                  <p className={styles.prose}>{svc.retired_note}</p>
                </Section>
              )}
            </div>
          )}
        </div>

        <aside className={styles.rail} aria-label={t('service_detail.text.service_detail_side_panels')}>
          {activeView !== 'governance' ? (
            <>
              <Surface padding="var(--space-4)" className={styles.accentSurface}>
                <div className={styles.railTitle}>{t('service_detail.text.at_a_glance')}</div>
                <div className={styles.railItems}>
                  <MetadataItem label={t('service_detail.text.lifecycle')} value={businessView?.lifecycle_state ?? svc.lifecycle_state ?? svc.service_status} />
                  <MetadataItem label={t('service_detail.text.request_channel')} value={primaryOffering?.request_channel_type ?? svc.request_channel_type} />
                  <MetadataItem label={t('service_detail.text.approval')} value={formatBool(t, primaryOffering?.approval_required ?? businessView?.approval_required ?? svc.approval_required)} />
                  <MetadataItem label={t('service_detail.text.lead_time')} value={primaryOffering?.lead_time_text ?? businessView?.fulfillment_lead_time_text ?? svc.fulfillment_lead_time_text} />
                  <MetadataItem label={t('service_detail.text.support_owner')} value={supportModels[0]?.support_owner_name ?? svc.vlastnik} />
                </div>
              </Surface>

              <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                <div className={styles.railTitle}>{t('service_detail.text.people_coverage')}</div>
                <div className={styles.railItems}>
                  <MetadataItem label={t('service_detail.text.owner')} value={svc.service_owner} kind="person" />
                  <MetadataItem label={t('service_detail.text.area_owner')} value={svc.vlastnik} kind="person" />
                  <MetadataItem label={t('service_detail.text.delivery_manager')} value={svc.manager} kind="person" />
                  <MetadataItem label={t('service_detail.text.audience')} value={businessView?.target_audience_summary ?? svc.target_audience_summary} />
                  <MetadataItem label={t('service_detail.text.portfolio')} value={svc.portfolio_group_name ?? svc.portfolio_group} />
                </div>
              </Surface>

              <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                <div className={styles.railTitle}>{t('service_detail.text.actions')}</div>
                <div className={styles.quickLinks}>
                  {requestHref && <ActionHref href={requestHref}>{t('service_detail.text.open_request_channel')}</ActionHref>}
                  <a href={supportAnchor}>{t('service_detail.text.jump_to_support')}</a>
                  <a href={governanceAnchor}>{t('service_detail.text.open_governance')}</a>
                  <Link href={editHref}>{t('service_detail.text.edit_service')}</Link>
                </div>
              </Surface>

              <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                <div className={styles.railTitle}>{t('service_detail.text.fix_in_context')}</div>
                <p className={styles.railHint}>{t('service_detail.text.jump_directly_to_the_editor_section_that_owns_th')}</p>
                <div className={styles.quickLinks}>
                  <Link href={`${editHref}#ownership`}>{t('service_detail.text.fix_owner')}</Link>
                  <Link href={`${editHref}#request-access`}>{t('service_detail.text.fix_request_path')}</Link>
                  <Link href={`${editHref}#c3mapping`}>{t('service_detail.text.fix_c3_mapping')}</Link>
                  <Link href={importEvidenceHref}>{t('service_detail.text.open_latest_import_evidence')}</Link>
                  <a href="#governance-workflow" onClick={openGovernanceWorkflow}>{t('service_detail.text.open_governance_decisions')}</a>
                </div>
              </Surface>

              {hasImportEvidence && (
                <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                  <div className={styles.railTitle}>{t('service_detail.text.import_evidence')}</div>
                  <div className={styles.railItems}>
                    <MetadataItem label={t('service_detail.text.source_id')} value={svc.source_local_id ?? svc.source_sp_id} />
                    <MetadataItem label={t('service_detail.text.source_modified')} value={svc.modified_at_source ?? svc.created_at_source} kind="date" />
                    <Link href={importEvidenceHref} className={styles.actionInlineLink}>{t('service_detail.text.open_import_source_evidence')}</Link>
                  </div>
                </Surface>
              )}
            </>
          ) : (
            <>
              <Surface padding="var(--space-4)">
                <div className={styles.railTitle}>{t('service_detail.text.governance')}</div>
                <div className={styles.railItems}>
                  <MetadataItem label={t('service_detail.text.lifecycle')}      value={businessView?.lifecycle_state ?? svc.lifecycle_state ?? svc.service_status} />
                  <MetadataItem label={t('service_detail.text.completeness')}   value={svc.completeness_score != null ? `${svc.completeness_score}%` : null} />
                  <MetadataItem label={t('service_detail.text.next_review')}    value={svc.review_due_at} kind="date" />
                  <MetadataItem label={t('service_detail.text.version')}        value={svc.catalogue_version} />
                  <MetadataItem label={t('service_detail.text.updated')}        value={svc.updated_at}   kind="date" />
                  <MetadataItem label={t('service_detail.text.updated_by')}     value={svc.updated_by} />
                </div>
              </Surface>

              <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                <div className={styles.railTitle}>{t('service_detail.text.ownership')}</div>
                <div className={styles.railItems}>
                  <MetadataItem label={t('service_detail.text.owner')}         value={svc.service_owner}  kind="person" />
                  <MetadataItem label={t('service_detail.text.area_owner_2')}    value={svc.vlastnik}       kind="person" />
                  <MetadataItem label={t('service_detail.text.delivery_mgr')}  value={svc.manager}        kind="person" />
                </div>
              </Surface>

              <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                <div className={styles.railTitle}>{t('service_detail.text.quick_links')}</div>
                <div className={styles.quickLinks}>
                  <Link href={`/services/${id}/graph`}>{t('service_detail.text.dependency_graph')}</Link>
                  <a href="#governance" onClick={() => setActiveView('governance')}>{t('service_detail.text.audit_trail')}</a>
                  <Link href={`/operations/reviews?service_id=${encodeURIComponent(id)}`}>{t('service_detail.text.governance_reviews')}</Link>
                  <Link href={`/operations/decisions?service_id=${encodeURIComponent(id)}`}>{t('service_detail.text.governance_decisions')}</Link>
                  <Link href={`${editHref}#ownership`}>{t('service_detail.text.fix_owner')}</Link>
                  <Link href={`${editHref}#request-access`}>{t('service_detail.text.fix_request_path')}</Link>
                  <Link href={`${editHref}#c3mapping`}>{t('service_detail.text.fix_c3_mapping')}</Link>
                  <Link href={importEvidenceHref}>{t('service_detail.text.open_latest_import_evidence')}</Link>
                </div>
              </Surface>

              {hasImportEvidence && (
                <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                  <div className={styles.railTitle}>{t('service_detail.text.import_evidence')}</div>
                  <div className={styles.railItems}>
                    <MetadataItem label={t('service_detail.text.source_id')} value={svc.source_local_id ?? svc.source_sp_id} />
                    <MetadataItem label={t('service_detail.text.source_modified')} value={svc.modified_at_source ?? svc.created_at_source} kind="date" />
                    <Link href={importEvidenceHref} className={styles.actionInlineLink}>{t('service_detail.text.open_import_source_evidence')}</Link>
                  </div>
                </Surface>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────
type StudioActionTone = 'success' | 'warning' | 'danger' | 'info';

interface StudioTask {
  tone: StudioActionTone;
  title: string;
  detail: string;
  href?: string;
  label?: string;
}

function RelationshipStudioHero({
  id,
  service,
  overview,
  businessSummary,
  consumerValue,
  primaryOffering,
  supportModels,
  requestHref,
  supportAnchor,
  lifecycleState,
  overviewFacts,
}: {
  id: string;
  service: ServiceDetail;
  overview: ServiceOverview | null;
  businessSummary: string | null | undefined;
  consumerValue: string | null | undefined;
  primaryOffering: ServiceOffering | null | undefined;
  supportModels: ServiceSupportModel[];
  requestHref: string | null;
  supportAnchor: string;
  lifecycleState: string | null;
  overviewFacts: Array<{ label: string; value: string }>;
}) {
  const t = useT();
  const blockers = overview?.readiness?.blockers ?? [];
  const warnings = overview?.readiness?.warnings ?? [];
  const relations = overview?.dependencies.total_count ?? service.relation_count ?? service.relations?.length ?? 0;
  const mandatoryRelations = overview?.dependencies.mandatory_count ?? service.relations?.filter((item) => item.is_mandatory).length ?? 0;
  const capabilityCount = overview?.capability_mappings.length ?? (service.c3_uuid ? 1 : 0);
  const primaryCapability = overview?.capability_mappings.find((item) => item.is_primary) ?? overview?.capability_mappings[0] ?? null;
  const completeness = service.completeness_score ?? (overview?.readiness?.is_publishable ? 100 : null);
  const portfolioTitle = overview?.portfolio.title ?? overview?.portfolio.code ?? service.portfolio_group_name ?? service.portfolio_group ?? t('service_detail.text.portfolio_missing');
  const audience = service.business_view?.target_audience_summary ?? service.target_audience_summary ?? t('service_detail.text.audience_policy_missing');
  const owner = overview?.owners.primary?.display_name ?? service.service_owner ?? service.vlastnik ?? t('service_detail.text.owner_missing');
  const resolverGroup = supportModels[0]?.resolver_group ?? t('service_detail.text.resolver_group_missing');
  const steward = overview?.owners.steward?.display_name ?? service.manager ?? t('service_detail.text.steward_missing');
  const reviewCadence = supportModels[0]?.review_cadence ?? (service.review_due_at ? t('service_detail.review_on', { date: formatDate(service.review_due_at) }) : t('service_detail.text.review_cadence_missing'));
  const downstreamCount = overview?.dependencies.outgoing_count ?? service.relation_count ?? 0;
  const upstreamCount = overview?.dependencies.incoming_count ?? 0;
  const criticalChains = overview?.dependencies.mandatory_count ?? service.relations?.filter((item) => item.is_mandatory).length ?? 0;
  const topDependencies = (overview?.dependencies.items ?? service.relations ?? [])
    .slice(0, 3)
    .map((item) => item.to_title ?? item.to_service_id)
    .filter(Boolean)
    .join(', ') || t('service_detail.text.no_dependency_list');
  const managerSummary = consumerValue ?? businessSummary ?? service.summary ?? t('service_detail.text.service_record_is_ready_for_business_facing_enri');
  const readinessLabel = blockers.length
    ? `${blockers.length} open blocker${blockers.length === 1 ? '' : 's'}`
    : warnings.length
      ? `${warnings.length} open warning${warnings.length === 1 ? '' : 's'}`
      : t('service_detail.text.ready_to_run');
  const taskQueue = buildStudioTasks({
    id,
    overview,
    service,
    supportModels,
    requestHref,
    primaryOffering,
    blockers,
    warnings,
    capabilityCount,
    t,
  });
  const mapNodes = [
    {
      label: t('service_detail.text.requester'),
      value: service.business_view?.target_audience_summary ?? service.target_audience_summary ?? t('service_detail.text.audience_missing'),
    },
    {
      label: t('service_detail.text.owner'),
      value: overview?.owners.primary?.display_name ?? service.service_owner ?? service.vlastnik ?? t('service_detail.text.owner_missing'),
    },
    {
      label: t('service_detail.text.support'),
      value: supportModels[0]?.support_owner_name ?? service.vlastnik ?? t('service_detail.text.support_missing'),
    },
    {
      label: t('service_detail.text.capability'),
      value: primaryCapability?.title ?? service.c3_domain ?? service.c3_reference ?? t('service_detail.text.c3_mapping_missing'),
    },
  ];

  return (
    <section className={styles.studioHero} aria-label={t('service_detail.text.service_relationship_overview')}>
      <div className={styles.studioSummary}>
        <div className={styles.studioTopline}>
          <div className={styles.headerMeta}>
            <span className={styles.serviceId}>{service.service_id}</span>
            {service.service_type && <span className={styles.typeChip}>{service.service_type}</span>}
            <LifecycleBadge state={lifecycleState ?? service.service_status ?? null} fallback={t('service_detail.lifecycle.draft')} />
          </div>
          <div className={styles.headerActions}>
            <Link href={`/services/${id}/edit`}><Button size="sm">{t('service_detail.text.edit')}</Button></Link>
          </div>
        </div>
        <span className={styles.studioEyebrow}>{t('service_detail.text.service_relationship_studio')}</span>
        <h1 className={styles.studioTitle}>{service.title}</h1>
        <p className={styles.studioLead}>{managerSummary}</p>

        <div className={styles.questionGrid} aria-label={t('service_detail.text.service_360_questions')}>
          <QuestionCard
            question={t('service_detail.question.what')}
            rows={[
              [t('service_detail.text.purpose'), businessSummary ?? service.summary ?? t('service_detail.text.purpose_missing')],
              [t('service_detail.text.portfolio'), portfolioTitle],
              [t('service_detail.text.audience'), audience],
            ]}
            href="#overview"
            linkLabel={t('service_detail.question.read_full')}
          />
          <QuestionCard
            question={t('service_detail.question.who')}
            rows={[
              [t('service_detail.text.service_owner'), owner],
              [t('service_detail.text.resolver_group'), resolverGroup],
              [t('service_detail.text.steward'), steward],
              [t('service_detail.text.review_cadence_2'), reviewCadence],
            ]}
            href="/operations#owner-load"
            linkLabel={t('service_detail.question.owner_load')}
          />
          <QuestionCard
            question={t('service_detail.question.ready')}
            rows={[
              [t('service_detail.text.readiness'), completeness != null ? `${completeness}%` : t('service_detail.text.unknown')],
              [t('service_detail.text.blockers'), String(blockers.length)],
              [t('service_detail.text.warnings'), String(warnings.length)],
              [t('service_detail.text.exceptions'), overview?.readiness?.rules?.some((rule) => rule.status === 'exception') ? t('service_detail.exceptions.active') : t('service_detail.exceptions.none')],
            ]}
            href="#readiness"
            linkLabel={t('service_detail.question.open_readiness')}
          />
          <QuestionCard
            question={t('service_detail.question.depends')}
            rows={[
              [t('service_detail.text.downstream'), countLabel(t, downstreamCount, 'service')],
              [t('service_detail.text.upstream'), countLabel(t, upstreamCount, 'service')],
              [t('service_detail.text.critical_chains'), String(criticalChains)],
              [t('service_detail.text.top'), topDependencies],
            ]}
            href="#dependencies"
            linkLabel={t('service_detail.question.view_relationships')}
          />
        </div>

        <div className={styles.studioActions}>
          {requestHref ? (
            <ActionHref href={requestHref} className={styles.primaryAction}>{t('service_detail.text.open_request_channel_2')}</ActionHref>
          ) : (
            <button type="button" className={styles.primaryActionMuted} disabled>
              {t('service_detail.text.request_path_missing')}
            </button>
          )}
          {(service.service_owner || service.vlastnik) && (
            <a
              href={`mailto:${service.service_owner ?? service.vlastnik}`}
              className={styles.secondaryAction}
              title={t('service_detail.contact_name', { name: service.service_owner ?? service.vlastnik ?? '' })}
            >
              {t('service_detail.text.contact_owner')}
            </a>
          )}
          <a href={supportAnchor} className={styles.secondaryAction}>{t('service_detail.text.support')}</a>
          <Link href={`/services/${id}/edit`} className={styles.secondaryAction}>{t('service_detail.text.edit')}</Link>
        </div>

        {(service.sla_availability != null || service.sla_restoration != null || service.sla_delivery != null) && (
          <div className={styles.heroSlaStrip} aria-label={t('service_detail.text.sla_commitments')}>
            <div className={`${styles.heroSlaChip} ${service.sla_availability != null ? styles.heroSlaChip_success : styles.heroSlaChip_muted}`}>
              <strong>{service.sla_availability != null ? `${service.sla_availability}%` : 'N/A'}</strong>
              <small>{t('service_detail.text.availability')}</small>
            </div>
            <div className={`${styles.heroSlaChip} ${service.sla_restoration != null ? styles.heroSlaChip_warning : styles.heroSlaChip_muted}`}>
              <strong>{service.sla_restoration_text ?? (service.sla_restoration != null ? `${service.sla_restoration}h` : 'N/A')}</strong>
              <small>{t('service_detail.text.restoration')}</small>
            </div>
            <div className={`${styles.heroSlaChip} ${service.sla_delivery != null ? styles.heroSlaChip_warning : styles.heroSlaChip_muted}`}>
              <strong>{service.sla_delivery_text ?? (service.sla_delivery != null ? `${service.sla_delivery}d` : 'N/A')}</strong>
              <small>{t('service_detail.text.delivery')}</small>
            </div>
          </div>
        )}

        <div className={styles.studioMetricGrid} aria-label={t('service_detail.text.service_headline_metrics')}>
          <StudioMetric value={completeness != null ? `${completeness}%` : 'N/A'} label={t('service_detail.text.completeness')} detail={readinessLabel} tone={blockers.length ? 'danger' : warnings.length ? 'warning' : 'success'} />
          <StudioMetric value={String(relations)} label={t('service_detail.text.relations')} detail={`${mandatoryRelations} mandatory`} tone={mandatoryRelations ? 'warning' : 'info'} />
          <StudioMetric value={String(capabilityCount)} label={t('service_detail.text.c3_links')} detail={primaryCapability?.code ?? service.c3_reference ?? t('service_detail.text.no_primary')} tone={capabilityCount ? 'success' : 'warning'} />
        </div>
      </div>

      <div className={styles.studioTaskPanel}>
        <div className={styles.studioPanelHeader}>
          <div>
            <span className={styles.studioEyebrow}>{t('service_detail.text.admin_queue')}</span>
            <h2>{t('service_detail.text.what_needs_attention')}</h2>
          </div>
          <span className={`${styles.studioBadge} ${styles[`studioBadge_${blockers.length ? 'danger' : warnings.length ? 'warning' : 'success'}`]}`}>
            {readinessLabel}
          </span>
        </div>
        <div className={styles.studioTaskList}>
          {taskQueue.map((task) => (
            <StudioTaskRow key={task.title} task={task} />
          ))}
        </div>
      </div>

      <RelationshipMap
        serviceTitle={service.title}
        nodes={mapNodes}
        readinessLabel={readinessLabel}
        primaryOffering={primaryOffering?.title ?? primaryOffering?.offering_code ?? t('service_detail.text.offering_missing')}
      />

      <div className={styles.studioFactsPanel}>
        {overviewFacts.map((fact) => (
          <div key={fact.label} className={styles.heroFact}>
            <span className={styles.heroFactLabel}>{fact.label}</span>
            {fact.label === t('service_detail.text.lifecycle')
              ? <LifecycleBadge state={lifecycleState} fallback={fact.value} />
              : <span className={styles.heroFactValue}>{fact.value}</span>}
          </div>
        ))}
        <div className={styles.summaryMiniRow}>
          <SummaryItem label={t('service_detail.text.availability')}>
            <AvailabilityBadge pct={service.sla_availability} />
          </SummaryItem>
          <SummaryItem label={t('service_detail.text.domains')}>
            <DomainDotGroup domains={service.available_on} />
          </SummaryItem>
          <SummaryItem label={t('service_detail.text.review_due')}>
            {service.review_due_at ? formatDate(service.review_due_at) : 'N/A'}
          </SummaryItem>
        </div>
      </div>
    </section>
  );
}

function buildStudioTasks({
  id,
  overview,
  service,
  supportModels,
  requestHref,
  primaryOffering,
  blockers,
  warnings,
  capabilityCount,
  t,
}: {
  id: string;
  overview: ServiceOverview | null;
  service: ServiceDetail;
  supportModels: ServiceSupportModel[];
  requestHref: string | null;
  primaryOffering: ServiceOffering | null | undefined;
  blockers: string[];
  warnings: string[];
  capabilityCount: number;
  t: Translate;
}): StudioTask[] {
  const tasks: StudioTask[] = [];
  if (blockers.length) {
    tasks.push({
      tone: 'danger',
      title: t('service_detail.task.publish_blockers'),
      detail: t('service_detail.task.publish_blockers_detail', { count: blockers.length }),
      href: `/services/${id}/edit#readiness-governance`,
      label: t('service_detail.task.fix_record'),
    });
  } else if (warnings.length) {
    tasks.push({
      tone: 'warning',
      title: t('service_detail.task.warnings'),
      detail: warnings[0],
      href: `/services/${id}/edit#readiness-governance`,
      label: t('service_detail.task.review'),
    });
  } else {
    tasks.push({
      tone: 'success',
      title: t('service_detail.task.record_ok'),
      detail: t('service_detail.task.record_ok_detail'),
    });
  }

  tasks.push(requestHref ? {
    tone: 'success',
    title: t('service_detail.task.request_ok'),
    detail: primaryOffering?.title ? t('service_detail.task.request_ok_offering', { offering: primaryOffering.title }) : t('service_detail.task.request_ok_detail'),
    href: requestHref,
    label: t('service_detail.task.open_channel'),
  } : {
    tone: 'warning',
    title: t('service_detail.task.request_missing'),
    detail: t('service_detail.task.request_missing_detail'),
    href: `/services/${id}/edit#request-access`,
    label: t('service_detail.task.add_path'),
  });

  tasks.push(supportModels.length ? {
    tone: 'success',
    title: t('service_detail.task.support_ok'),
    detail: t('service_detail.task.support_ok_detail', { owner: supportModels[0]?.support_owner_name ?? service.vlastnik ?? t('service_detail.task.support') }),
    href: '#support',
    label: t('service_detail.task.view_support'),
  } : {
    tone: 'warning',
    title: t('service_detail.task.support_missing'),
    detail: t('service_detail.task.support_missing_detail'),
    href: `/services/${id}/edit#support-model`,
    label: t('service_detail.task.fix_support'),
  });

  const missingAction = overview?.missing_actions[0];
  if (missingAction) {
    tasks.push({
      tone: missingAction.severity === 'blocker' ? 'danger' : missingAction.severity === 'warning' ? 'warning' : 'info',
      title: t('service_detail.task.governance'),
      detail: missingAction.description,
      href: missingAction.href || `/services/${id}/edit#readiness-governance`,
      label: t('service_detail.task.open'),
    });
  } else {
    tasks.push(capabilityCount ? {
      tone: 'success',
      title: t('service_detail.task.c3_ok'),
      detail: t('service_detail.task.c3_ok_detail'),
      href: '#dependencies',
      label: t('service_detail.task.view_relationships'),
    } : {
      tone: 'warning',
      title: t('service_detail.task.c3_missing'),
      detail: t('service_detail.task.c3_missing_detail'),
      href: `/services/${id}/edit#c3mapping`,
      label: t('service_detail.task.map_c3'),
    });
  }

  return tasks.slice(0, 4);
}

function StudioMetric({ value, label, detail, tone }: { value: string; label: string; detail: string; tone: StudioActionTone }) {
  return (
    <div className={`${styles.studioMetric} ${styles[`studioMetric_${tone}`]}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}

function StudioTaskRow({ task }: { task: StudioTask }) {
  const content = (
    <>
      <span className={`${styles.taskDot} ${styles[`taskDot_${task.tone}`]}`} />
      <span className={styles.taskCopy}>
        <strong>{task.title}</strong>
        <small>{task.detail}</small>
      </span>
      {task.label && <em>{task.label}</em>}
    </>
  );

  if (task.href?.startsWith('http')) {
    return <a href={task.href} target="_blank" rel="noreferrer" className={styles.studioTask}>{content}</a>;
  }

  if (task.href) {
    return <Link href={task.href} className={styles.studioTask}>{content}</Link>;
  }

  return <div className={styles.studioTask}>{content}</div>;
}

function RelationshipMap({
  serviceTitle,
  nodes,
  readinessLabel,
  primaryOffering,
}: {
  serviceTitle: string;
  nodes: Array<{ label: string; value: string }>;
  readinessLabel: string;
  primaryOffering: string;
}) {
  const t = useT();
  return (
    <div className={styles.relationshipPanel}>
      <div className={styles.studioPanelHeader}>
        <div>
          <span className={styles.studioEyebrow}>{t('service_detail.text.relationship_map')}</span>
          <h2>{t('service_detail.text.how_this_service_fits')}</h2>
        </div>
        <span className={styles.studioBadge}>{primaryOffering}</span>
      </div>
      <div className={styles.relationshipMap}>
        <div className={styles.mapNodePrimary}>
          <span>{t('service_detail.text.service')}</span>
          <strong>{serviceTitle}</strong>
          <small>{readinessLabel}</small>
        </div>
        {nodes.map((node, index) => (
          <div key={`${node.label}-${index}`} className={`${styles.mapNode} ${styles[`mapNode_${index}`] ?? ''}`}>
            <span>{node.label}</span>
            <strong>{node.value}</strong>
          </div>
        ))}
      </div>
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

function QuestionCard({
  question,
  rows,
  href,
  linkLabel,
}: {
  question: string;
  rows: Array<[string, string]>;
  href: string;
  linkLabel: string;
}) {
  return (
    <article className={styles.questionCard}>
      <h2>{question}</h2>
      <div className={styles.questionRows}>
        {rows.map(([key, value]) => (
          <div key={key} className={styles.questionRow}>
            <span>{key}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <Link href={href} className={styles.questionLink}>{linkLabel} →</Link>
    </article>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section className={styles.section} id={id}>
      {title ? <h2 className={styles.sectionTitle}>{title}</h2> : null}
      {children}
    </section>
  );
}

function ActionHref({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  if (/^https?:\/\//i.test(href)) {
    return <a href={href} target="_blank" rel="noreferrer" className={className}>{children}</a>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.summaryItem}>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{children}</span>
    </div>
  );
}

function Service360Panel({
  overview,
  isLoading,
  error,
  serviceId,
}: {
  overview: ServiceOverview | null;
  isLoading: boolean;
  error: unknown;
  serviceId: string;
}) {
  const t = useT();
  const { data: reviewData } = useGovernanceReviews({ serviceId, limit: 5 });
  const { data: decisionData } = useGovernanceDecisions({ serviceId, limit: 5 });
  const reviews = reviewData?.items ?? [];
  const decisions = decisionData?.items ?? [];

  if (isLoading) {
    return (
      <Section title={t('service_detail.text.service_360')}>
        <div className={styles.service360State}>{t('service_detail.text.loading_overview')}</div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section title={t('service_detail.text.service_360')}>
        <div className={styles.service360StateError}>{t('service_detail.text.service_360_overview_is_not_available')}</div>
      </Section>
    );
  }

  if (!overview) {
    return (
      <Section title={t('service_detail.text.service_360')}>
        <div className={styles.service360State}>{t('service_detail.text.no_service_360_data_yet')}</div>
      </Section>
    );
  }

  const blockers = overview.readiness?.blockers ?? [];
  const warnings = overview.readiness?.warnings ?? [];
  const ruleBadges = (overview.readiness?.rules ?? [])
    .filter((rule) => ['failed', 'exception', 'disabled', 'skipped'].includes(rule.status))
    .slice(0, 8);
  const ruleExplanations = (overview.readiness?.rules ?? [])
    .filter((rule) => rule.status === 'failed')
    .slice(0, 3);
  const primaryCapability = overview.capability_mappings.find((item) => item.is_primary) ?? overview.capability_mappings[0] ?? null;
  const ownerName = overview.owners.primary?.display_name ?? t('service_detail.text.missing');
  const lifecycle = overview.lifecycle.stage_code ?? overview.lifecycle.state ?? overview.lifecycle.service_status ?? t('service_detail.text.missing');
  const portfolio = overview.portfolio.title ?? overview.portfolio.code ?? t('service_detail.text.missing');
  const readinessStatus = overview.readiness == null
    ? t('service_detail.text.readiness_unknown')
    : overview.readiness.is_publishable
      ? t('service_detail.text.publishable')
      : t('service_detail.text.not_publishable');

  return (
    <Section title={t('service_detail.text.service_360')}>
      <div className={styles.service360Header}>
        <div>
          <div className={styles.service360Eyebrow}>{t('service_detail.text.decision_cockpit')}</div>
          <p className={styles.service360Lead}>
            {overview.service.summary ?? t('service_detail.text.operational_governance_summary_for_this_service')}
          </p>
        </div>
        <span className={`${styles.service360Status} ${overview.readiness?.is_publishable ? styles.service360StatusReady : styles.service360StatusBlocked}`}>
          {readinessStatus}
        </span>
      </div>

      <div className={styles.service360Readiness} id="readiness">
        <div className={styles.readinessHeader}>
          <h3 className={styles.service360Subhead}>{t('service_detail.text.readiness')}</h3>
          <div className={styles.readinessCounts}>
            <span className={`${styles.readinessBadge} ${blockers.length ? styles.readinessBadgeBlocker : ''}`}>
              {countLabel(t, blockers.length, 'blocker')}
            </span>
            <span className={`${styles.readinessBadge} ${warnings.length ? styles.readinessBadgeWarning : ''}`}>
              {countLabel(t, warnings.length, 'warning')}
            </span>
          </div>
        </div>
        {blockers.length || warnings.length ? (
          <div className={styles.issueList}>
            {blockers.map((item) => (
              <div key={`blocker-${item}`} className={styles.issueItemBlocker}>{item}</div>
            ))}
            {warnings.map((item) => (
              <div key={`warning-${item}`} className={styles.issueItemWarning}>{item}</div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>{t('service_detail.text.no_readiness_blockers_or_warnings')}</p>
        )}
        {ruleBadges.length > 0 && (
          <div className={styles.readinessRuleBadges} aria-label={t('service_detail.text.readiness_rules')}>
            {ruleBadges.map((rule) => (
              <span
                key={rule.rule_key}
                className={`${styles.readinessRuleBadge} ${styles[`readinessRule_${rule.status}`] ?? ''}`}
                title={[rule.why_text, rule.howto_text, rule.evidence_hint].filter(Boolean).join(' ')}
              >
                {rule.severity} {rule.title_text ?? rule.title}
              </span>
            ))}
          </div>
        )}
        {ruleExplanations.length > 0 && (
          <details className={styles.readinessExplainDetails}>
            <summary>{t('service_detail.text.why_this_is_a_blocker_and_how_to_fix_it')}</summary>
            <div className={styles.readinessExplainGrid} aria-label={t('service_detail.text.readiness_explanations')}>
              {ruleExplanations.map((rule) => (
                <div key={`explain-${rule.rule_key}`} className={styles.readinessExplainCard}>
                  <strong>{rule.title_text ?? rule.title}</strong>
                  {rule.why_text && <span>{rule.why_text}</span>}
                  {rule.howto_text && <small>{rule.howto_text}</small>}
                  {rule.evidence_hint && <code>{rule.evidence_hint}</code>}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className={styles.service360Grid}>
        <Service360Metric label={t('service_detail.text.portfolio')} value={portfolio} detail={overview.lifecycle.criticality_code ?? t('service_detail.text.standard_criticality')} />
        <Service360Metric label={t('service_detail.text.lifecycle')} value={lifecycle} detail={overview.lifecycle.review_due_at ? t('service_detail.review_on', { date: formatDate(overview.lifecycle.review_due_at) }) : t('service_detail.text.review_missing')} />
        <Service360Metric label={t('service_detail.text.owners')} value={ownerName} detail={overview.owners.steward?.display_name ?? t('service_detail.text.steward_missing')} />
        <Service360Metric label={t('service_detail.text.offerings')} value={countLabel(t, overview.offerings.count, 'offering')} detail={overview.offerings.primary?.title ?? overview.offerings.primary?.offering_code ?? t('service_detail.text.primary_missing')} />
        <Service360Metric label={t('service_detail.text.sla_offerings')} value={overview.sla.has_sla && overview.offerings.count > 0 ? t('service_detail.text.covered') : t('service_detail.text.incomplete')} detail={t('service_detail.sla_records_offerings', { records: overview.sla.record_count, offerings: overview.offerings.count })} />
        <Service360Metric label={t('service_detail.text.dependencies')} value={t('service_detail.dependencies_out_in', { out: overview.dependencies.outgoing_count, in: overview.dependencies.incoming_count })} detail={t('service_detail.count.mandatory', { count: overview.dependencies.mandatory_count })} />
        <Service360Metric label={t('service_detail.text.capabilities')} value={countLabel(t, overview.capability_mappings.length, 'mapping')} detail={primaryCapability?.code ? t('service_detail.primary_code', { code: primaryCapability.code }) : t('service_detail.text.primary_missing')} />
        <Service360Metric label={t('service_detail.text.c3_mapping')} value={primaryCapability?.code ?? primaryCapability?.c3_uuid ?? t('service_detail.text.missing')} detail={primaryCapability?.status ?? primaryCapability?.mapping_type_code ?? t('service_detail.text.unclassified')} />
        <Service360Metric label={t('service_detail.text.readiness')} value={countLabel(t, overview.governance_risks.count, 'signal')} detail={countLabel(t, overview.governance_risks.high_count, 'blocker')} />
        <Service360Metric label={t('service_detail.text.audit')} value={countLabel(t, overview.audit_summary.count, 'change')} detail={overview.audit_summary.last_action?.performed_at ? formatDate(overview.audit_summary.last_action.performed_at) : t('service_detail.text.no_recent_changes')} />
      </div>

      <div className={styles.service360Workflow} id="governance-workflow">
        <div className={styles.readinessHeader}>
          <h3 className={styles.service360Subhead}>{t('service_detail.text.governance_workflow')}</h3>
          <Link href={`/operations/reviews?service_id=${encodeURIComponent(serviceId)}`} className={styles.actionInlineLink}>{t('service_detail.text.open_reviews')}</Link>
        </div>
        <div className={styles.workflowMiniGrid}>
          <div>
            <h4>{t('service_detail.text.current_reviews')}</h4>
            {reviews.length ? reviews.map((review) => (
              <Link key={review.id} href="/operations/reviews" className={styles.workflowMiniRow}>
                <strong>{review.review_type}</strong>
                <span>{review.status} · {review.assigned_to ?? t('service_detail.text.unassigned')} · {review.due_at ? formatDate(review.due_at) : t('service_detail.text.no_due_date')}</span>
              </Link>
            )) : <p className={styles.emptyState}>{t('service_detail.text.no_current_governance_reviews')}</p>}
          </div>
          <div>
            <h4>{t('service_detail.text.recent_decisions')}</h4>
            {decisions.length ? decisions.map((decision) => (
              <Link key={decision.id} href="/operations/decisions" className={styles.workflowMiniRow}>
                <strong>{decision.decision}</strong>
                <span>{decision.decision_type} · {decision.decided_by ?? 'unknown'} · {decision.rationale ?? t('service_detail.text.no_rationale')}</span>
              </Link>
            )) : <p className={styles.emptyState}>{t('service_detail.text.no_governance_decisions_yet')}</p>}
          </div>
        </div>
      </div>

      <div className={styles.service360Actions}>
        <h3 className={styles.service360Subhead}>{t('service_detail.text.actions')}</h3>
        {overview.missing_actions.length > 0 ? (
          <div className={styles.actionList}>
            {overview.missing_actions.map((action) => (
              <Link key={action.key} href={action.href || `/services/${serviceId}/edit`} className={styles.actionLink}>
                <span className={styles.actionTitle}>{action.title}</span>
                <span className={styles.actionDescription}>{action.description}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>{t('service_detail.text.no_missing_actions_detected')}</p>
        )}
      </div>
    </Section>
  );
}

function Service360Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className={styles.service360Metric}>
      <span className={styles.service360MetricLabel}>{label}</span>
      <span className={styles.service360MetricValue}>{value}</span>
      <span className={styles.service360MetricDetail}>{detail}</span>
    </div>
  );
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
        <p className={styles.sectionIntro}>
          {t('service_detail.text.what_this_service_needs_what_depends_on_it_and_w')}
        </p>
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

const BUSINESS_DETAIL_VIEWS: Array<{ id: DetailView; technical?: boolean }> = [
  { id: 'overview' },
  { id: 'request' },
  { id: 'support' },
  { id: 'dependencies' },
  { id: 'governance' },
];

type Translate = (key: string, params?: Record<string, string | number>) => string;

function countLabel(t: Translate, count: number, noun: 'service' | 'blocker' | 'warning' | 'offering' | 'mapping' | 'signal' | 'change') {
  return t(`service_detail.count.${noun}`, { count });
}

function formatBool(t: Translate, value: boolean | null | undefined) {
  if (value == null) return '—';
  return value ? t('common.yes') : t('common.no');
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('cs-CZ');
}
