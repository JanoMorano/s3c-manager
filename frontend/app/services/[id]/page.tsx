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
import styles from './detail.module.css';

interface Props { params: Promise<{ id: string }> }
type DetailView = 'overview' | 'request' | 'support' | 'dependencies' | 'governance';

export default function ServiceDetailPage({ params }: Props) {
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

  if (isLoading) return <div className={styles.state}>Loading…</div>;
  if (error)     return <div className={styles.stateError}>Service not found or API unreachable.</div>;
  if (!svc)      return null;

  const businessView = svc.business_view;
  const overview = service360Data?.overview ?? overviewData?.item ?? null;
  const businessSummary = businessView?.business_summary ?? svc.business_summary ?? svc.summary;
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
    { label: 'Requestable', value: formatBool(businessView?.requestable ?? svc.requestable) },
    { label: 'Lifecycle', value: formatLifecycleState(normalizedLifecycleStage) },
    { label: 'Primary offering', value: primaryOffering?.title ?? primaryOffering?.offering_code ?? 'Not defined yet' },
    { label: 'Support', value: supportModels[0]?.support_owner_name ?? svc.vlastnik ?? '—' },
    { label: 'Audience', value: businessView?.target_audience_summary ?? svc.target_audience_summary ?? audiencePolicies[0]?.audience_type ?? '—' },
    { label: 'Lead time', value: primaryOffering?.lead_time_text ?? businessView?.fulfillment_lead_time_text ?? svc.fulfillment_lead_time_text ?? '—' },
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
              ? 'This service has been retired and is no longer available.'
              : 'This service is deprecated. Please check for a replacement or contact the service owner.'}
          </span>
          <Link href={editHref} className={styles.lifecycleBannerLink}>View details</Link>
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

      <nav className={styles.viewNav} aria-label="Service detail views">
        {visibleViews.map((view) => (
          <button
            key={view.id}
            type="button"
            className={`${styles.viewTab} ${view.technical ? styles.viewTabTechnical : ''} ${activeView === view.id ? styles.viewTabActive : ''}`}
            onClick={() => setActiveView(view.id)}
          >
            <span className={styles.viewTabLabel}>{view.label}</span>
            {view.technical && <span className={styles.techBadge}>Tech</span>}
            <span className={styles.viewTabHint}>{view.hint}</span>
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
                <Section title="Overview" id="overview">
                  {businessSummary && <p className={styles.prose}>{businessSummary}</p>}
                  {svc.detailed_description && svc.detailed_description !== businessSummary && (
                    <p className={styles.prose} style={{ marginTop: 'var(--space-3)' }}>
                      {svc.detailed_description}
                    </p>
                  )}
                </Section>
              )}

              {(consumerValue || svc.value_proposition || svc.business_purpose) && (
                <Section title="Business Value">
                  {consumerValue && (
                    <p className={styles.calloutQuote} style={{ borderLeftColor: 'var(--color-info)' }}>
                      {consumerValue}
                    </p>
                  )}
                  {svc.value_proposition && svc.value_proposition !== consumerValue && <p className={styles.prose}>{svc.value_proposition}</p>}
                  {svc.business_purpose && svc.business_purpose !== svc.value_proposition && (
                    <p className={styles.calloutQuote}>
                      <em>{svc.business_purpose}</em>
                    </p>
                  )}
                </Section>
              )}

              {(svc.scope_text || svc.exclusions) && (
                <Section title="Scope">
                  <div className={styles.dualPanel}>
                    {svc.scope_text && (
                      <div className={styles.infoCard}>
                        <div className={styles.infoCardLabel}>Included</div>
                        <p className={styles.prose}>{svc.scope_text}</p>
                      </div>
                    )}
                    {svc.exclusions && (
                      <div className={styles.infoCard}>
                        <div className={styles.infoCardLabel}>Not covered</div>
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
              <Section title="How to get this service" id="request">
                <RequestabilityPanel
                  service={svc}
                  primaryOffering={primaryOffering}
                  audiencePolicies={audiencePolicies}
                />
              </Section>
              {svc.offerings.length > 0 && (
                <Section title="Available offerings">
                  <OfferingsGrid offerings={svc.offerings} primaryOffering={primaryOffering} />
                </Section>
              )}
            </>
          )}

          {activeView === 'support' && (
            <>
              {(supportModels.length > 0 || isRequestable) && (
                <Section title="Support" id="support">
                  <SupportModelPanel supportModels={supportModels} svc={svc} />
                </Section>
              )}

              <Section title="SLA commitments">
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

              {(operationalLinks.length > 0 || svc.next_review_due_at || svc.review_owner_user_id) && (
                <Section title="Operations">
                  <OperationsPanel
                    links={operationalLinks}
                    nextReviewDueAt={svc.next_review_due_at ?? null}
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

              <Section title="Governance facts">
                <MetadataGrid columns={3}>
                  <MetadataItem label="Lifecycle" value={businessView?.lifecycle_state ?? svc.lifecycle_state ?? svc.service_status} />
                  <MetadataItem label="Status" value={svc.service_status_name ?? svc.service_status} />
                  <MetadataItem label="Criticality" value={svc.criticality_code ?? svc.security_classification} />
                  <MetadataItem label="Owner" value={svc.service_owner} kind="person" />
                  <MetadataItem label="Area owner" value={svc.vlastnik} kind="person" />
                  <MetadataItem label="Review owner" value={svc.review_owner_user_id != null ? String(svc.review_owner_user_id) : null} />
                  <MetadataItem label="Next review" value={svc.next_review_due_at ?? svc.review_due_at} kind="date" />
                  <MetadataItem label="Portfolio" value={svc.portfolio_group_name ?? svc.portfolio_group} />
                  <MetadataItem label="Updated" value={svc.updated_at} kind="date" />
                </MetadataGrid>
              </Section>

              {c3Visible && c3MappingsData && c3MappingsData.mappings.length > 0 && (
                <Section title="C3 Taxonomy Mapping">
                  <C3MappingTable mappings={c3MappingsData.mappings} />
                </Section>
              )}

              <Section title="Audit trail">
                <MetadataGrid columns={3}>
                  <MetadataItem label="Version" value={svc.catalogue_version} />
                  <MetadataItem label="Created" value={svc.created_at} kind="date" />
                  <MetadataItem label="Updated" value={svc.updated_at} kind="date" />
                  <MetadataItem label="Created by" value={svc.created_by} />
                  <MetadataItem label="Updated by" value={svc.updated_by} />
                </MetadataGrid>
                <a href="#governance" className={styles.graphLink} onClick={() => setActiveView('governance')}>Open audit trail →</a>
              </Section>

              {rolesData && rolesData.length > 0 && (
                <Section title="Ownership history">
                  <OwnershipHistory roles={rolesData} />
                </Section>
              )}

              {svc.retired_note && (
                <Section title="Retirement note">
                  <p className={styles.prose}>{svc.retired_note}</p>
                </Section>
              )}
            </div>
          )}
        </div>

        <aside className={styles.rail} aria-label="Service detail side panels">
          {activeView !== 'governance' ? (
            <>
              <Surface padding="var(--space-4)" className={styles.accentSurface}>
                <div className={styles.railTitle}>At a glance</div>
                <div className={styles.railItems}>
                  <MetadataItem label="Lifecycle" value={businessView?.lifecycle_state ?? svc.lifecycle_state ?? svc.service_status} />
                  <MetadataItem label="Request channel" value={primaryOffering?.request_channel_type ?? svc.request_channel_type} />
                  <MetadataItem label="Approval" value={formatBool(primaryOffering?.approval_required ?? businessView?.approval_required ?? svc.approval_required)} />
                  <MetadataItem label="Lead time" value={primaryOffering?.lead_time_text ?? businessView?.fulfillment_lead_time_text ?? svc.fulfillment_lead_time_text} />
                  <MetadataItem label="Support owner" value={supportModels[0]?.support_owner_name ?? svc.vlastnik} />
                </div>
              </Surface>

              <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                <div className={styles.railTitle}>People & Coverage</div>
                <div className={styles.railItems}>
                  <MetadataItem label="Owner" value={svc.service_owner} kind="person" />
                  <MetadataItem label="Area owner" value={svc.vlastnik} kind="person" />
                  <MetadataItem label="Delivery manager" value={svc.manager} kind="person" />
                  <MetadataItem label="Audience" value={businessView?.target_audience_summary ?? svc.target_audience_summary} />
                  <MetadataItem label="Portfolio" value={svc.portfolio_group_name ?? svc.portfolio_group} />
                </div>
              </Surface>

              <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                <div className={styles.railTitle}>Actions</div>
                <div className={styles.quickLinks}>
                  {requestHref && <ActionHref href={requestHref}>Open request channel</ActionHref>}
                  <a href={supportAnchor}>Jump to support</a>
                  <a href={governanceAnchor}>Open governance</a>
                  <Link href={editHref}>Edit service</Link>
                </div>
              </Surface>

              <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                <div className={styles.railTitle}>Fix in context</div>
                <p className={styles.railHint}>Jump directly to the editor section that owns the missing evidence.</p>
                <div className={styles.quickLinks}>
                  <Link href={`${editHref}#ownership`}>Fix owner</Link>
                  <Link href={`${editHref}#request-access`}>Fix request path</Link>
                  <Link href={`${editHref}#c3mapping`}>Fix C3 mapping</Link>
                  <Link href={importEvidenceHref}>Open latest import evidence</Link>
                  <a href="#governance-workflow" onClick={openGovernanceWorkflow}>Open governance decisions</a>
                </div>
              </Surface>

              {hasImportEvidence && (
                <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                  <div className={styles.railTitle}>Import evidence</div>
                  <div className={styles.railItems}>
                    <MetadataItem label="Source ID" value={svc.source_local_id ?? svc.source_sp_id} />
                    <MetadataItem label="Source modified" value={svc.modified_at_source ?? svc.created_at_source} kind="date" />
                    <Link href={importEvidenceHref} className={styles.actionInlineLink}>Open import source evidence</Link>
                  </div>
                </Surface>
              )}
            </>
          ) : (
            <>
              <Surface padding="var(--space-4)">
                <div className={styles.railTitle}>Governance</div>
                <div className={styles.railItems}>
                  <MetadataItem label="Lifecycle"      value={businessView?.lifecycle_state ?? svc.lifecycle_state ?? svc.service_status} />
                  <MetadataItem label="Completeness"   value={svc.completeness_score != null ? `${svc.completeness_score}%` : null} />
                  <MetadataItem label="Next review"    value={svc.next_review_due_at ?? svc.review_due_at} kind="date" />
                  <MetadataItem label="Version"        value={svc.catalogue_version} />
                  <MetadataItem label="Updated"        value={svc.updated_at}   kind="date" />
                  <MetadataItem label="Updated by"     value={svc.updated_by} />
                </div>
              </Surface>

              <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                <div className={styles.railTitle}>Ownership</div>
                <div className={styles.railItems}>
                  <MetadataItem label="Owner"         value={svc.service_owner}  kind="person" />
                  <MetadataItem label="Area Owner"    value={svc.vlastnik}       kind="person" />
                  <MetadataItem label="Delivery Mgr"  value={svc.manager}        kind="person" />
                </div>
              </Surface>

              <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                <div className={styles.railTitle}>Quick Links</div>
                <div className={styles.quickLinks}>
                  <Link href={`/services/${id}/graph`}>Dependency graph</Link>
                  <a href="#governance" onClick={() => setActiveView('governance')}>Audit trail</a>
                  <Link href={`/operations/reviews?service_id=${encodeURIComponent(id)}`}>Governance reviews</Link>
                  <Link href={`/operations/decisions?service_id=${encodeURIComponent(id)}`}>Governance decisions</Link>
                  <Link href={`${editHref}#ownership`}>Fix owner</Link>
                  <Link href={`${editHref}#request-access`}>Fix request path</Link>
                  <Link href={`${editHref}#c3mapping`}>Fix C3 mapping</Link>
                  <Link href={importEvidenceHref}>Open latest import evidence</Link>
                </div>
              </Surface>

              {hasImportEvidence && (
                <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                  <div className={styles.railTitle}>Import evidence</div>
                  <div className={styles.railItems}>
                    <MetadataItem label="Source ID" value={svc.source_local_id ?? svc.source_sp_id} />
                    <MetadataItem label="Source modified" value={svc.modified_at_source ?? svc.created_at_source} kind="date" />
                    <Link href={importEvidenceHref} className={styles.actionInlineLink}>Open import source evidence</Link>
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
  const blockers = overview?.readiness?.blockers ?? [];
  const warnings = overview?.readiness?.warnings ?? [];
  const relations = overview?.dependencies.total_count ?? service.relation_count ?? service.relations?.length ?? 0;
  const mandatoryRelations = overview?.dependencies.mandatory_count ?? service.relations?.filter((item) => item.is_mandatory).length ?? 0;
  const capabilityCount = overview?.capability_mappings.length ?? (service.c3_uuid ? 1 : 0);
  const primaryCapability = overview?.capability_mappings.find((item) => item.is_primary) ?? overview?.capability_mappings[0] ?? null;
  const completeness = service.completeness_score ?? (overview?.readiness?.is_publishable ? 100 : null);
  const portfolioTitle = overview?.portfolio.title ?? overview?.portfolio.code ?? service.portfolio_group_name ?? service.portfolio_group ?? 'Portfolio missing';
  const audience = service.business_view?.target_audience_summary ?? service.target_audience_summary ?? 'Audience policy missing';
  const owner = overview?.owners.primary?.display_name ?? service.service_owner ?? service.vlastnik ?? 'Owner missing';
  const resolverGroup = supportModels[0]?.resolver_group ?? 'Resolver group missing';
  const steward = overview?.owners.steward?.display_name ?? service.manager ?? 'Steward missing';
  const reviewCadence = supportModels[0]?.review_cadence ?? (service.next_review_due_at ? `Review ${formatDate(service.next_review_due_at)}` : 'Review cadence missing');
  const downstreamCount = overview?.dependencies.outgoing_count ?? service.relation_count ?? 0;
  const upstreamCount = overview?.dependencies.incoming_count ?? 0;
  const criticalChains = overview?.dependencies.mandatory_count ?? service.relations?.filter((item) => item.is_mandatory).length ?? 0;
  const topDependencies = (overview?.dependencies.items ?? service.relations ?? [])
    .slice(0, 3)
    .map((item) => item.to_title ?? item.to_service_id)
    .filter(Boolean)
    .join(', ') || 'No dependency list';
  const managerSummary = consumerValue ?? businessSummary ?? service.value_proposition ?? service.business_purpose ?? service.summary ?? 'Service record is ready for business-facing enrichment.';
  const readinessLabel = blockers.length
    ? `${blockers.length} open blocker${blockers.length === 1 ? '' : 's'}`
    : warnings.length
      ? `${warnings.length} open warning${warnings.length === 1 ? '' : 's'}`
      : 'Ready to run';
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
  });
  const mapNodes = [
    {
      label: 'Requester',
      value: service.business_view?.target_audience_summary ?? service.target_audience_summary ?? 'Audience missing',
    },
    {
      label: 'Owner',
      value: overview?.owners.primary?.display_name ?? service.service_owner ?? service.vlastnik ?? 'Owner missing',
    },
    {
      label: 'Support',
      value: supportModels[0]?.support_owner_name ?? service.vlastnik ?? 'Support missing',
    },
    {
      label: 'Capability',
      value: primaryCapability?.title ?? service.c3_domain ?? service.c3_reference ?? 'C3 mapping missing',
    },
  ];

  return (
    <section className={styles.studioHero} aria-label="Service relationship overview">
      <div className={styles.studioSummary}>
        <div className={styles.studioTopline}>
          <div className={styles.headerMeta}>
            <span className={styles.serviceId}>{service.service_id}</span>
            {service.service_type && <span className={styles.typeChip}>{service.service_type}</span>}
            <LifecycleBadge state={lifecycleState ?? service.service_status ?? null} fallback="Draft" />
          </div>
          <div className={styles.headerActions}>
            <Link href={`/services/${id}/edit`}><Button size="sm">Edit</Button></Link>
          </div>
        </div>
        <span className={styles.studioEyebrow}>Service relationship studio</span>
        <h1 className={styles.studioTitle}>{service.title}</h1>
        <p className={styles.studioLead}>{managerSummary}</p>

        <div className={styles.questionGrid} aria-label="Service 360 questions">
          <QuestionCard
            question="What is this?"
            rows={[
              ['Purpose', businessSummary ?? service.summary ?? 'Purpose missing'],
              ['Portfolio', portfolioTitle],
              ['Audience', audience],
            ]}
            href="#overview"
            linkLabel="Read full"
          />
          <QuestionCard
            question="Who owns it?"
            rows={[
              ['Service owner', owner],
              ['Resolver group', resolverGroup],
              ['Steward', steward],
              ['Review cadence', reviewCadence],
            ]}
            href="/operations#owner-load"
            linkLabel="Owner load"
          />
          <QuestionCard
            question="Is it ready?"
            rows={[
              ['Readiness', completeness != null ? `${completeness}%` : 'Unknown'],
              ['Blockers', String(blockers.length)],
              ['Warnings', String(warnings.length)],
              ['Exceptions', overview?.readiness?.rules?.some((rule) => rule.status === 'exception') ? 'active' : 'none'],
            ]}
            href="#readiness"
            linkLabel="Otevřít readiness"
          />
          <QuestionCard
            question="What depends on it?"
            rows={[
              ['Downstream', countLabel(downstreamCount, 'service')],
              ['Upstream', countLabel(upstreamCount, 'service')],
              ['Critical chains', String(criticalChains)],
              ['Top', topDependencies],
            ]}
            href="#dependencies"
            linkLabel="View relationships"
          />
        </div>

        <div className={styles.studioActions}>
          {requestHref ? (
            <ActionHref href={requestHref} className={styles.primaryAction}>Open request channel →</ActionHref>
          ) : (
            <button type="button" className={styles.primaryActionMuted} disabled>
              Request path missing
            </button>
          )}
          {(service.service_owner || service.vlastnik) && (
            <a
              href={`mailto:${service.service_owner ?? service.vlastnik}`}
              className={styles.secondaryAction}
              title={`Contact ${service.service_owner ?? service.vlastnik}`}
            >
              Contact owner
            </a>
          )}
          <a href={supportAnchor} className={styles.secondaryAction}>Support</a>
          <Link href={`/services/${id}/edit`} className={styles.secondaryAction}>Edit</Link>
        </div>

        {(service.sla_availability != null || service.sla_restoration != null || service.sla_delivery != null) && (
          <div className={styles.heroSlaStrip} aria-label="SLA commitments">
            <div className={`${styles.heroSlaChip} ${service.sla_availability != null ? styles.heroSlaChip_success : styles.heroSlaChip_muted}`}>
              <strong>{service.sla_availability != null ? `${service.sla_availability}%` : 'N/A'}</strong>
              <small>Availability</small>
            </div>
            <div className={`${styles.heroSlaChip} ${service.sla_restoration != null ? styles.heroSlaChip_warning : styles.heroSlaChip_muted}`}>
              <strong>{service.sla_restoration_text ?? (service.sla_restoration != null ? `${service.sla_restoration}h` : 'N/A')}</strong>
              <small>Restoration</small>
            </div>
            <div className={`${styles.heroSlaChip} ${service.sla_delivery != null ? styles.heroSlaChip_warning : styles.heroSlaChip_muted}`}>
              <strong>{service.sla_delivery_text ?? (service.sla_delivery != null ? `${service.sla_delivery}d` : 'N/A')}</strong>
              <small>Delivery</small>
            </div>
          </div>
        )}

        <div className={styles.studioMetricGrid} aria-label="Service headline metrics">
          <StudioMetric value={completeness != null ? `${completeness}%` : 'N/A'} label="Completeness" detail={readinessLabel} tone={blockers.length ? 'danger' : warnings.length ? 'warning' : 'success'} />
          <StudioMetric value={String(relations)} label="Relations" detail={`${mandatoryRelations} mandatory`} tone={mandatoryRelations ? 'warning' : 'info'} />
          <StudioMetric value={String(capabilityCount)} label="C3 links" detail={primaryCapability?.code ?? service.c3_reference ?? 'No primary'} tone={capabilityCount ? 'success' : 'warning'} />
        </div>
      </div>

      <div className={styles.studioTaskPanel}>
        <div className={styles.studioPanelHeader}>
          <div>
            <span className={styles.studioEyebrow}>Admin queue</span>
            <h2>What needs attention</h2>
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
        primaryOffering={primaryOffering?.title ?? primaryOffering?.offering_code ?? 'Offering missing'}
      />

      <div className={styles.studioFactsPanel}>
        {overviewFacts.map((fact) => (
          <div key={fact.label} className={styles.heroFact}>
            <span className={styles.heroFactLabel}>{fact.label}</span>
            {fact.label === 'Lifecycle'
              ? <LifecycleBadge state={lifecycleState} fallback={fact.value} />
              : <span className={styles.heroFactValue}>{fact.value}</span>}
          </div>
        ))}
        <div className={styles.summaryMiniRow}>
          <SummaryItem label="Availability">
            <AvailabilityBadge pct={service.sla_availability} />
          </SummaryItem>
          <SummaryItem label="Domains">
            <DomainDotGroup domains={service.available_on} />
          </SummaryItem>
          <SummaryItem label="Review due">
            {service.next_review_due_at ? formatDate(service.next_review_due_at) : 'N/A'}
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
}): StudioTask[] {
  const tasks: StudioTask[] = [];
  if (blockers.length) {
    tasks.push({
      tone: 'danger',
      title: 'Publish blockers',
      detail: `${blockers.length} readiness blocker${blockers.length === 1 ? '' : 's'} need attention before publish.`,
      href: `/services/${id}/edit#readiness-governance`,
      label: 'Fix record',
    });
  } else if (warnings.length) {
    tasks.push({
      tone: 'warning',
      title: 'Warnings before publish',
      detail: warnings[0],
      href: `/services/${id}/edit#readiness-governance`,
      label: 'Review',
    });
  } else {
    tasks.push({
      tone: 'success',
      title: 'Record can be understood',
      detail: 'No readiness blockers were detected in the current Service 360 data.',
    });
  }

  tasks.push(requestHref ? {
    tone: 'success',
    title: 'Request path is configured',
    detail: primaryOffering?.title ? `${primaryOffering.title} points to the external customer path.` : 'Users have an external channel for the service.',
    href: requestHref,
    label: 'Open channel',
  } : {
    tone: 'warning',
    title: 'Request path missing',
    detail: 'Admins should add a request channel before managers promote this service.',
    href: `/services/${id}/edit#request-access`,
    label: 'Add path',
  });

  tasks.push(supportModels.length ? {
    tone: 'success',
    title: 'Support ownership exists',
    detail: `${supportModels[0]?.support_owner_name ?? service.vlastnik ?? 'Support'} is visible for escalation.`,
    href: '#support',
    label: 'View support',
  } : {
    tone: 'warning',
    title: 'Support model missing',
    detail: 'Requestable services need a named support owner and escalation path.',
    href: `/services/${id}/edit#support-model`,
    label: 'Fix support',
  });

  const missingAction = overview?.missing_actions[0];
  if (missingAction) {
    tasks.push({
      tone: missingAction.severity === 'blocker' ? 'danger' : missingAction.severity === 'warning' ? 'warning' : 'info',
      title: 'Governance action',
      detail: missingAction.description,
      href: missingAction.href || `/services/${id}/edit#readiness-governance`,
      label: 'Open',
    });
  } else {
    tasks.push(capabilityCount ? {
      tone: 'success',
      title: 'C3 relationship is visible',
      detail: 'Managers can see how this service supports capability coverage.',
      href: '#dependencies',
      label: 'View relationships',
    } : {
      tone: 'warning',
      title: 'C3 mapping missing',
      detail: 'Connect this service to a capability so the C3 board can explain impact.',
      href: `/services/${id}/edit#c3mapping`,
      label: 'Map C3',
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
  return (
    <div className={styles.relationshipPanel}>
      <div className={styles.studioPanelHeader}>
        <div>
          <span className={styles.studioEyebrow}>Relationship map</span>
          <h2>How this service fits</h2>
        </div>
        <span className={styles.studioBadge}>{primaryOffering}</span>
      </div>
      <div className={styles.relationshipMap}>
        <div className={styles.mapNodePrimary}>
          <span>Service</span>
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

function formatLifecycleState(state: LifecycleStepCode) {
  return state.charAt(0).toUpperCase() + state.slice(1);
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
  const { data: reviewData } = useGovernanceReviews({ serviceId, limit: 5 });
  const { data: decisionData } = useGovernanceDecisions({ serviceId, limit: 5 });
  const reviews = reviewData?.items ?? [];
  const decisions = decisionData?.items ?? [];

  if (isLoading) {
    return (
      <Section title="Service 360">
        <div className={styles.service360State}>Loading overview...</div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section title="Service 360">
        <div className={styles.service360StateError}>Service 360 overview is not available.</div>
      </Section>
    );
  }

  if (!overview) {
    return (
      <Section title="Service 360">
        <div className={styles.service360State}>No Service 360 data yet.</div>
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
  const ownerName = overview.owners.primary?.display_name ?? 'Missing';
  const lifecycle = overview.lifecycle.stage_code ?? overview.lifecycle.state ?? overview.lifecycle.service_status ?? 'Missing';
  const portfolio = overview.portfolio.title ?? overview.portfolio.code ?? 'Missing';
  const readinessStatus = overview.readiness == null
    ? 'Readiness unknown'
    : overview.readiness.is_publishable
      ? 'Publishable'
      : 'Not publishable';

  return (
    <Section title="Service 360">
      <div className={styles.service360Header}>
        <div>
          <div className={styles.service360Eyebrow}>Decision cockpit</div>
          <p className={styles.service360Lead}>
            {overview.service.summary ?? 'Operational governance summary for this service.'}
          </p>
        </div>
        <span className={`${styles.service360Status} ${overview.readiness?.is_publishable ? styles.service360StatusReady : styles.service360StatusBlocked}`}>
          {readinessStatus}
        </span>
      </div>

      <div className={styles.service360Readiness} id="readiness">
        <div className={styles.readinessHeader}>
          <h3 className={styles.service360Subhead}>Readiness</h3>
          <div className={styles.readinessCounts}>
            <span className={`${styles.readinessBadge} ${blockers.length ? styles.readinessBadgeBlocker : ''}`}>
              {countLabel(blockers.length, 'blocker')}
            </span>
            <span className={`${styles.readinessBadge} ${warnings.length ? styles.readinessBadgeWarning : ''}`}>
              {countLabel(warnings.length, 'warning', 'warnings')}
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
          <p className={styles.emptyState}>No readiness blockers or warnings.</p>
        )}
        {ruleBadges.length > 0 && (
          <div className={styles.readinessRuleBadges} aria-label="Readiness rules">
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
            <summary>Proč je to blocker a jak ho opravit</summary>
            <div className={styles.readinessExplainGrid} aria-label="Readiness explanations">
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
        <Service360Metric label="Portfolio" value={portfolio} detail={overview.lifecycle.criticality_code ?? 'Standard criticality'} />
        <Service360Metric label="Lifecycle" value={lifecycle} detail={overview.lifecycle.review_due_at ? `Review ${formatDate(overview.lifecycle.review_due_at)}` : 'Review missing'} />
        <Service360Metric label="Owners" value={ownerName} detail={overview.owners.steward?.display_name ?? 'Steward missing'} />
        <Service360Metric label="Offerings" value={countLabel(overview.offerings.count, 'offering')} detail={overview.offerings.primary?.title ?? overview.offerings.primary?.offering_code ?? 'Primary missing'} />
        <Service360Metric label="SLA & Offerings" value={overview.sla.has_sla && overview.offerings.count > 0 ? 'Covered' : 'Incomplete'} detail={`${overview.sla.record_count} SLA records / ${overview.offerings.count} offerings`} />
        <Service360Metric label="Dependencies" value={`${overview.dependencies.outgoing_count} out / ${overview.dependencies.incoming_count} in`} detail={`${overview.dependencies.mandatory_count} mandatory`} />
        <Service360Metric label="Capabilities" value={countLabel(overview.capability_mappings.length, 'mapping')} detail={primaryCapability?.code ? `Primary ${primaryCapability.code}` : 'Primary missing'} />
        <Service360Metric label="C3 Mapping" value={primaryCapability?.code ?? primaryCapability?.c3_uuid ?? 'Missing'} detail={primaryCapability?.status ?? primaryCapability?.mapping_type_code ?? 'Unclassified'} />
        <Service360Metric label="Readiness" value={countLabel(overview.governance_risks.count, 'signal')} detail={`${overview.governance_risks.high_count} blockers`} />
        <Service360Metric label="Audit" value={countLabel(overview.audit_summary.count, 'change')} detail={overview.audit_summary.last_action?.performed_at ? formatDate(overview.audit_summary.last_action.performed_at) : 'No recent changes'} />
      </div>

      <div className={styles.service360Workflow} id="governance-workflow">
        <div className={styles.readinessHeader}>
          <h3 className={styles.service360Subhead}>Governance workflow</h3>
          <Link href={`/operations/reviews?service_id=${encodeURIComponent(serviceId)}`} className={styles.actionInlineLink}>Open reviews</Link>
        </div>
        <div className={styles.workflowMiniGrid}>
          <div>
            <h4>Current reviews</h4>
            {reviews.length ? reviews.map((review) => (
              <Link key={review.id} href="/operations/reviews" className={styles.workflowMiniRow}>
                <strong>{review.review_type}</strong>
                <span>{review.status} · {review.assigned_to ?? 'Unassigned'} · {review.due_at ? formatDate(review.due_at) : 'No due date'}</span>
              </Link>
            )) : <p className={styles.emptyState}>No current governance reviews.</p>}
          </div>
          <div>
            <h4>Recent decisions</h4>
            {decisions.length ? decisions.map((decision) => (
              <Link key={decision.id} href="/operations/decisions" className={styles.workflowMiniRow}>
                <strong>{decision.decision}</strong>
                <span>{decision.decision_type} · {decision.decided_by ?? 'unknown'} · {decision.rationale ?? 'No rationale'}</span>
              </Link>
            )) : <p className={styles.emptyState}>No governance decisions yet.</p>}
          </div>
        </div>
      </div>

      <div className={styles.service360Actions}>
        <h3 className={styles.service360Subhead}>Actions</h3>
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
          <p className={styles.emptyState}>No missing actions detected.</p>
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
  if (!offerings || offerings.length === 0) return null;

  // Featured card = explicit default, or primary resolved from detail, or first in list
  const featured = primaryOffering ?? offerings[0];
  const rest = offerings.filter((o) => o.id !== featured.id);

  return (
    <div>
      {/* ── Featured / default offering ─────────────────────────────────── */}
      <div style={{ marginBottom: rest.length > 0 ? 'var(--space-5)' : 0 }}>
        <div className={styles.offeringFeaturedLabel}>
          {featured.is_default ? 'Default offering' : 'Primary offering'}
        </div>
        <article className={`${styles.offeringCard} ${styles.offeringCardPrimary}`}>
          <div className={styles.offeringHeader}>
            <div>
              <div className={styles.offeringCode}>{featured.offering_code}</div>
              <h3 className={styles.offeringTitle}>{featured.title}</h3>
            </div>
            <div className={styles.offeringBadges}>
              {featured.is_default && <span className={styles.softBadgeStrong}>Default</span>}
              <span className={styles.softBadge}>{featured.status}</span>
              {featured.requestable
                ? <span className={styles.softBadgePositive}>Requestable</span>
                : <span className={styles.softBadge}>Not requestable</span>
              }
            </div>
          </div>
          <div className={styles.offeringFeaturedBody}>
            <div>
              {featured.description
                ? <p className={styles.prose}>{featured.description}</p>
                : <p className={styles.emptyState}>No description provided.</p>
              }
              {safeHref(featured.request_channel_url) && (
                <a href={safeHref(featured.request_channel_url)!} target="_blank" rel="noreferrer" className={styles.offeringLink}>
                  Open request form ↗
                </a>
              )}
            </div>
            <div className={styles.offeringMeta}>
              <MiniFact label="Approval" value={formatBool(featured.approval_required)} />
              <MiniFact label="Lead time" value={featured.lead_time_text ?? '—'} />
              <MiniFact label="Support tier" value={featured.support_tier_code ?? '—'} />
              <MiniFact label="Channel" value={featured.request_channel_type ?? '—'} />
            </div>
          </div>
        </article>
      </div>

      {/* ── Remaining offerings ──────────────────────────────────────────── */}
      {rest.length > 0 && (
        <>
          <div className={styles.sectionIntro} style={{ marginBottom: 'var(--space-3)' }}>
            Additional offerings
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
                    {offering.requestable
                      ? <span className={styles.softBadgePositive}>Requestable</span>
                      : <span className={styles.softBadge}>Not requestable</span>
                    }
                  </div>
                </div>
                {offering.description && <p className={styles.prose}>{offering.description}</p>}
                <div className={styles.offeringMeta}>
                  <MiniFact label="Approval" value={formatBool(offering.approval_required)} />
                  <MiniFact label="Lead time" value={offering.lead_time_text ?? '—'} />
                  <MiniFact label="Support tier" value={offering.support_tier_code ?? '—'} />
                  <MiniFact label="Channel" value={offering.request_channel_type ?? '—'} />
                </div>
                {safeHref(offering.request_channel_url) && (
                  <a href={safeHref(offering.request_channel_url)!} target="_blank" rel="noreferrer" className={styles.offeringLink}>
                    Open request path ↗
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
  const requestable = primaryOffering?.requestable ?? service.requestable;
  const externalRequestHref = safeHref(primaryOffering?.request_channel_url ?? service.request_channel_url);
  const requestChannel = primaryOffering?.request_channel_type ?? service.request_channel_type;
  const leadTime = primaryOffering?.lead_time_text ?? service.fulfillment_lead_time_text;
  const approval = primaryOffering?.approval_required ?? service.approval_required;

  return (
    <div className={styles.requestGrid}>
      <div className={styles.infoCard}>
        <div className={styles.infoCardLabel}>Ordering path</div>
        <div className={styles.requestHeadline}>{requestable ? 'Available to request' : 'Not requestable yet'}</div>
        <div className={styles.requestMeta}>
          <MiniFact label="Channel" value={requestChannel ?? '—'} />
          <MiniFact label="Approval" value={formatBool(approval)} />
          <MiniFact label="Lead time" value={leadTime ?? '—'} />
        </div>
        {externalRequestHref ? (
          <ActionHref href={externalRequestHref} className={styles.inlineActionLink}>Open request channel</ActionHref>
        ) : requestable ? (
          <p className={styles.operationalGap}>Readiness blocker: add an external request URL so consumers have a clear ordering channel.</p>
        ) : (
          <p className={styles.prose}>This service is informational. Use the owner and support information before starting onboarding.</p>
        )}
      </div>

      {(service.target_audience_summary || audiencePolicies.length > 0) && (
        <div className={styles.infoCard}>
          <div className={styles.infoCardLabel}>Audience & eligibility</div>
          {service.target_audience_summary && <p className={styles.prose}>{service.target_audience_summary}</p>}
          {audiencePolicies.length > 0 && (
          <div className={styles.policyList}>
            {audiencePolicies.map((policy) => (
              <div key={policy.id} className={styles.policyRow}>
                <div className={styles.policyHeadline}>
                  {policy.audience_type ?? 'Audience policy'}
                  {policy.region_code ? ` · ${policy.region_code}` : ''}
                </div>
                <div className={styles.policyMeta}>
                  {policy.business_unit ?? 'Any business unit'}
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
  if (!supportModels || supportModels.length === 0) {
    const requestable = svc.requestable ?? svc.business_view?.requestable;
    return (
      <div className={styles.infoCard}>
        <div className={styles.infoCardLabel}>Support model</div>
        {requestable && (
          <p className={styles.operationalGap}>
            Readiness blocker: add a support model so consumers know who owns fulfilment and escalation.
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
            {model.offering_id ? 'Offering support' : 'Service support'}
          </div>
          <div className={styles.requestMeta}>
            <MiniFact label="Support owner" value={model.support_owner_name ?? svc.vlastnik ?? '—'} />
            <MiniFact label="Resolver group" value={model.resolver_group ?? '—'} />
            <MiniFact label="Hours" value={model.support_hours_code ?? svc.support_availability_raw ?? '—'} />
            <MiniFact label="Channel" value={model.support_channel ?? '—'} />
            <MiniFact label="Escalation" value={model.escalation_path ?? '—'} />
            <MiniFact label="Maintenance" value={model.maintenance_window ?? '—'} />
          </div>
          {model.review_cadence && (
            <p className={styles.policyNote}>Review cadence: {model.review_cadence}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Operations panel: grouped links + review metadata ────────────────────────

const LINK_TYPE_ORDER = ['knowledge', 'incidents', 'changes', 'docs', 'review', 'monitoring', 'support', 'other'];
const LINK_TYPE_LABEL: Record<string, string> = {
  knowledge:  'Knowledge',
  incidents:  'Incidents',
  changes:    'Changes',
  docs:       'Documentation',
  review:     'Service Review',
  monitoring: 'Monitoring',
  support:    'Support',
  other:      'Other',
};

function OperationsPanel({
  links,
  nextReviewDueAt,
  reviewOwnerId,
  serviceId,
}: {
  links: ServiceOperationalLink[];
  nextReviewDueAt: string | null;
  reviewOwnerId: number | string | null;
  serviceId: string;
}) {
  // Group links by type
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
  const reviewDate = nextReviewDueAt ? new Date(nextReviewDueAt) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reviewOverdue  = reviewDate ? reviewDate < today : false;
  const reviewSoon     = reviewDate && !reviewOverdue
    ? (reviewDate.getTime() - today.getTime()) < 14 * 24 * 60 * 60 * 1000  // within 14 days
    : false;

  return (
    <div className={styles.operationsPanel}>
      {/* Service review card */}
      {(nextReviewDueAt || reviewOwnerId) && (
        <div className={`${styles.reviewCard} ${reviewOverdue ? styles.reviewCardOverdue : reviewSoon ? styles.reviewCardSoon : ''}`}>
          <div className={styles.reviewCardLabel}>Service Review</div>
          <div className={styles.reviewMeta}>
            {nextReviewDueAt && (
              <span className={reviewOverdue ? styles.reviewOverdue : reviewSoon ? styles.reviewSoon : ''}>
                {reviewOverdue ? '⚠ Overdue · ' : reviewSoon ? '⏰ Due soon · ' : ''}
                Next review: {formatDate(nextReviewDueAt)}
              </span>
            )}
            {reviewOwnerId && <span>Review owner ID: {reviewOwnerId}</span>}
          </div>
          <Link href={`/services/${serviceId}/edit#governance`} className={styles.inlineActionLink}>
            Update review date →
          </Link>
        </div>
      )}

      {/* Grouped operational links */}
      {groupKeys.map(key => (
        <div key={key} className={styles.linkGroup}>
          <div className={styles.linkGroupLabel}>{LINK_TYPE_LABEL[key] ?? key}</div>
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
  if (!state) return <span className={styles.heroFactValue}>{fallback}</span>;
  const normalized = normalizeLifecycleState(state);
  const cls = LIFECYCLE_BADGE_CLASS[normalized] ?? 'lifecycleDraft';
  return (
    <span className={`${styles.lifecycleBadge} ${styles[cls]}`}>
      {normalized.replace('_', ' ')}
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
const ROLE_LABELS: Record<string, string> = {
  service_owner:             'Owner',
  service_area_owner:        'Area Owner',
  service_delivery_manager:  'Delivery Mgr',
};

function OwnershipHistory({ roles }: { roles: ServiceRoleAssignment[] }) {
  const today = new Date().toISOString().split('T')[0];
  const current = roles.filter(r => r.valid_to == null);
  const expired = roles.filter(r => r.valid_to != null && r.valid_to < today);

  return (
    <div className={styles.ownershipTable}>
      {[...current, ...expired].map(r => (
        <div key={r.id} className={`${styles.ownershipRow} ${r.valid_to ? styles.ownershipRowExpired : ''}`}>
          <span className={styles.ownershipRole}>{ROLE_LABELS[r.role_code] ?? r.role_code}</span>
          <span className={styles.ownershipName}>
            {r.display_name}
            {r.organization_name && <span className={styles.ownershipOrg}> · {r.organization_name}</span>}
          </span>
          <span className={styles.ownershipPeriod}>
            {r.valid_from ? new Date(r.valid_from).toLocaleDateString('cs-CZ') : '—'}
            {' → '}
            {r.valid_to ? new Date(r.valid_to).toLocaleDateString('cs-CZ') : <em>current</em>}
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
  const incoming = overview?.dependencies.incoming ?? [];
  const outgoing = overview?.dependencies.outgoing ?? relations;
  const mandatoryCount = overview?.dependencies.mandatory_count ?? relations.filter((item) => item.is_mandatory).length;

  return (
    <>
      <Section title="Relationships" id="dependencies">
        <p className={styles.sectionIntro}>
          Co tato služba potřebuje, co je na ní závislé a kde změna vyžaduje review.
        </p>
        <div className={styles.dualPanel}>
          <div className={styles.infoCard}>
            <div className={styles.infoCardLabel}>Co služba potřebuje</div>
            {outgoing.length ? (
              <div className={styles.relationList}>
                {outgoing.slice(0, 8).map((relation) => (
                  <RelationRow key={`out-${relation.id}`} relation={relation} />
                ))}
              </div>
            ) : (
              <p className={styles.emptyState}>Žádné odchozí vazby nejsou evidované.</p>
            )}
          </div>
          <div className={styles.infoCard}>
            <div className={styles.infoCardLabel}>Co závisí na službě</div>
            {incoming.length ? (
              <div className={styles.relationList}>
                {incoming.slice(0, 8).map((relation) => (
                  <RelationRow key={`in-${relation.id}`} relation={relation} />
                ))}
              </div>
            ) : (
              <p className={styles.emptyState}>Žádné příchozí vazby nejsou evidované.</p>
            )}
          </div>
        </div>
      </Section>
      <Section title="Dependency conclusion">
        <p className={styles.prose}>
          Evidence obsahuje {countLabel(outgoing.length, 'outgoing relation')} a {countLabel(incoming.length, 'incoming relation')}.
          {mandatoryCount > 0 ? ` ${countLabel(mandatoryCount, 'mandatory dependency')} má dopad na change/release plán.` : ' Žádná mandatory dependency není zvýrazněná.'}
        </p>
      </Section>
    </>
  );
}

function RelationRow({ relation }: { relation: ServiceRelation }) {
  return (
    <div className={styles.relationRow}>
      <span className={styles.relType}>{relation.relation_type}</span>
      <Link href={`/services/${relation.to_service_id}`} className={styles.relLink}>
        {relation.to_title ?? relation.to_service_id}
      </Link>
      {relation.is_mandatory && <span className={styles.relBadgeDanger}>mandatory</span>}
      {relation.impact_level && <span className={styles.relBadge}>{relation.impact_level}</span>}
      {relation.is_verified && <span className={styles.relBadgeGreen}>verified</span>}
    </div>
  );
}

// ── C3 Taxonomy Mapping Table ─────────────────────────────────────────────────
const C3_ITEM_TYPE_LABELS: Record<string, string> = {
  BP: 'Business Process',
  BR: 'Business Role',
  CP: 'Capability',
  CI: 'COI Service',
  CO: 'Communication Service',
  CR: 'Core Service',
  IP: 'Information Product',
  UA: 'User Application',
};

const PACE_COLORS: Record<string, string> = {
  Differentiation: 'var(--color-status-active)',
  Systems:         'var(--color-info)',
  Commodity:       'var(--color-text-secondary)',
  Innovation:      'var(--color-warning)',
};

function C3MappingTable({ mappings }: { mappings: ServiceC3Mapping[] }) {
  return (
    <div className={styles.c3MappingTable}>
      <div className={styles.c3MappingHeader}>
        <span>C3 Item</span>
        <span>Type</span>
        <span>Mapping</span>
        <span>Pace Layer</span>
        <span>Domain</span>
        <span>Level</span>
        <span>Note</span>
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
              <span className={styles.c3ItemTypeBadge} title={C3_ITEM_TYPE_LABELS[m.c3_item_type]}>
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

const BUSINESS_DETAIL_VIEWS: Array<{ id: DetailView; label: string; hint: string; technical?: boolean }> = [
  { id: 'overview', label: 'Overview', hint: 'Value, scope, owner' },
  { id: 'request', label: 'How to get it', hint: 'Request channel and offerings' },
  { id: 'support', label: 'Support / SLA', hint: 'Support owner, hours, escalation' },
  { id: 'dependencies', label: 'Relationships', hint: 'What this service needs and affects' },
  { id: 'governance', label: 'Governance', hint: 'Readiness, reviews, decisions' },
];

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatBool(value: boolean | null | undefined) {
  if (value == null) return '—';
  return value ? 'Yes' : 'No';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('cs-CZ');
}
