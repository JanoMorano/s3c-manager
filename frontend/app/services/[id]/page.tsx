/**
 * §9.2 Service Detail — Pattern B: main body + right rail
 * Items 7, 11, 12, 13 added in this revision:
 *   7:  scope_text, operational_notes_raw, sla_restoration_text, sla_delivery_text
 *   11: flavour lifecycle_cost, dependency_text, nations_rate
 *   12: Ownership History expandable section
 *   13: Extended Data (customer_type, options, notes JSON)
 */
'use client';

import { use, useState } from 'react';
import Link from '@/app/components/AppLink';
import { useSWRConfig } from 'swr';
import { useInstallStatus } from '@/features/install/installStatus';
import {
  useService, useServiceOverview, useServiceSla, useServiceScore, useServiceRoles, useServiceC3Mappings,
  useServiceFrameworks,
  type ServiceC3Mapping,
} from '@/features/services/hooks/useServices';
import { StatusPill }        from '@/features/services/components/StatusPill';
import { AvailabilityBadge } from '@/features/services/components/AvailabilityBadge';
import { DomainDotGroup }    from '@/features/services/components/DomainDotGroup';
import { MetadataItem, MetadataGrid } from '@/features/services/components/MetadataItem';
import { SlaPanel }          from '@/features/services/components/SlaPanel';
import { Surface } from '@/design-system/primitives';
import { Button }  from '@/design-system/controls/Button';
import { EmptyState, ProgressBar } from '@/design-system/controls';
import { useGovernanceDecisions, useGovernanceReviews } from '@/features/governance/hooks/useGovernance';
import type {
  ScoreBreakdownItem,
  ServiceAudiencePolicy,
  ServiceOffering,
  ServiceOperationalLink,
  ServiceRoleAssignment,
  ServiceSupportModel,
  ServiceFrameworkCoverage,
  ServiceOverview,
  ServiceDetail,
} from '@/features/services/model/service.types';
import { authHeaders } from '@/features/services/api/services.api';
import { safeHref } from '@/shared/utils/safeHref';
import styles from './detail.module.css';

interface Props { params: Promise<{ id: string }> }
type DetailView = 'overview' | 'offerings' | 'request' | 'coverage' | 'governance';

export default function ServiceDetailPage({ params }: Props) {
  const { id } = use(params);
  const { c3Visible } = useInstallStatus();
  const { data: svc, isLoading, error } = useService(id);
  const { data: overviewData, isLoading: overviewLoading, error: overviewError } = useServiceOverview(id);
  const { data: slaData } = useServiceSla(id);
  const { data: scoreData } = useServiceScore(id);
  const { data: rolesData } = useServiceRoles(id);
  const { data: c3MappingsData } = useServiceC3Mappings(c3Visible ? id : null);
  const { data: frameworksData } = useServiceFrameworks(id);
  const [scoreOpen,   setScoreOpen]   = useState(false);
  const [rolesOpen,   setRolesOpen]   = useState(false);
  const [extDataOpen, setExtDataOpen] = useState(false);
  const [activeView,  setActiveView]  = useState<DetailView>('overview');

  if (isLoading) return <div className={styles.state}>Loading…</div>;
  if (error)     return <div className={styles.stateError}>Service not found or API unreachable.</div>;
  if (!svc)      return null;

  const summarySourceUrl = safeHref(svc.source_url);
  const footerSourceUrl = safeHref(svc.source_url);
  const businessView = svc.business_view;
  const overview = overviewData?.item ?? null;
  const technicalView = svc.technical_view;
  const businessSummary = businessView?.business_summary ?? svc.business_summary ?? svc.summary;
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
  const supportAnchor = '#support';
  const governanceAnchor = '#governance';
  const overviewFacts = [
    { label: 'Requestable', value: formatBool(businessView?.requestable ?? svc.requestable) },
    { label: 'Lifecycle', value: businessView?.lifecycle_state ?? svc.lifecycle_state ?? svc.service_status_name ?? svc.service_status ?? '—' },
    { label: 'Primary offering', value: primaryOffering?.title ?? primaryOffering?.offering_code ?? 'Not defined yet' },
    { label: 'Support', value: supportModels[0]?.support_owner_name ?? svc.vlastnik ?? '—' },
    { label: 'Audience', value: businessView?.target_audience_summary ?? svc.target_audience_summary ?? audiencePolicies[0]?.audience_type ?? '—' },
    { label: 'Lead time', value: primaryOffering?.lead_time_text ?? businessView?.fulfillment_lead_time_text ?? svc.fulfillment_lead_time_text ?? '—' },
  ];

  // JSON extended data presence check
  const hasExtData = svc.customer_type != null || svc.options != null || svc.notes != null || svc.training_refs != null || svc.prerequisites_json != null || svc.dependencies_json != null;

  const lifecycleState = businessView?.lifecycle_state ?? svc.lifecycle_state ?? null;

  return (
    <div className={styles.shell}>

      {/* ── Phase 7: Lifecycle banner for deprecated/retired ─────────────── */}
      {(lifecycleState === 'deprecated' || lifecycleState === 'retired') && (
        <div className={`${styles.lifecycleBanner} ${lifecycleState === 'retired' ? styles.lifecycleBannerRetired : styles.lifecycleBannerDeprecated}`}>
          <span className={styles.lifecycleBannerIcon}>
            {lifecycleState === 'retired' ? '🚫' : '⚠️'}
          </span>
          <span>
            {lifecycleState === 'retired'
              ? 'This service has been retired and is no longer available.'
              : 'This service is deprecated. Please check for a replacement or contact the service owner.'}
          </span>
          <Link href={`/services/${id}/edit`} className={styles.lifecycleBannerLink}>View details →</Link>
        </div>
      )}

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
        governanceAnchor={governanceAnchor}
        summarySourceUrl={summarySourceUrl}
        lifecycleState={lifecycleState}
        overviewFacts={overviewFacts}
      />

      <nav className={styles.viewNav} aria-label="Service detail views">
        {DETAIL_VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            className={`${styles.viewTab} ${activeView === view.id ? styles.viewTabActive : ''}`}
            onClick={() => setActiveView(view.id)}
          >
            <span className={styles.viewTabLabel}>{view.label}</span>
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
              <Service360Panel
                overview={overview}
                isLoading={overviewLoading}
                error={overviewError}
                serviceId={id}
              />

              {(businessSummary || svc.detailed_description) && (
                <Section title="Overview">
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

              <Section title="Service Commitments">
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

          {activeView === 'coverage' && (
            <CoveragePanel frameworks={frameworksData ?? []} serviceId={id} />
          )}

          {activeView === 'offerings' && (
            <>
              <Section title="Service Offerings">
                <OfferingsGrid offerings={svc.offerings} primaryOffering={primaryOffering} />
              </Section>

              {svc.flavours && svc.flavours.length > 0 && (
                <Section title="Commercial Variants">
                  <p className={styles.sectionIntro}>
                    Pricing variants remain available as the commercial detail layer behind the catalogue offering model.
                  </p>
                  <FlavourTable svc={svc} />
                </Section>
              )}
            </>
          )}

          {activeView === 'request' && (
            <>
              <Section title="Request & Eligibility">
                <RequestabilityPanel
                  service={svc}
                  primaryOffering={primaryOffering}
                  audiencePolicies={audiencePolicies}
                />
              </Section>

              <Section title="Support" id="support">
                <SupportModelPanel supportModels={supportModels} svc={svc} />
              </Section>

              {(svc.prerequisites_json || svc.request_process_raw || svc.operational_notes_raw) && (
                <Section title="Fulfillment Notes">
                  {svc.request_process_raw && <p className={styles.prose}>{svc.request_process_raw}</p>}
                  {svc.operational_notes_raw && (
                    <p className={styles.prose} style={{ marginTop: 'var(--space-3)' }}>
                      {svc.operational_notes_raw}
                    </p>
                  )}
                  {svc.prerequisites_json != null && (
                    <div className={styles.inlineJsonBlock}>
                      <div className={styles.infoCardLabel}>Prerequisites</div>
                      <pre className={styles.extDataPre}>{safeJson(svc.prerequisites_json)}</pre>
                    </div>
                  )}
                </Section>
              )}
            </>
          )}

          {activeView === 'governance' && (
            <div id="governance" className={styles.governanceStack}>
              <Section title="Operational Metadata">
                <MetadataGrid columns={3}>
                  <MetadataItem label="Service Type"     value={svc.service_type_name ?? svc.service_type} />
                  <MetadataItem label="Status"           value={svc.service_status_name ?? svc.service_status} />
                  <MetadataItem label="Portfolio"        value={svc.portfolio_group_name ?? svc.portfolio_group} />
                  <MetadataItem label="Global Svc Group" value={svc.global_service_group_name ?? svc.global_service_group_code} />
                  <MetadataItem label="Service Line"     value={svc.service_line_name ?? svc.service_line_code} />
                  <MetadataItem label="Org Element"      value={svc.organizational_element_code} />
                  <MetadataItem label="Service Area"     value={svc.service_area} />
                  <MetadataItem label="Owner"            value={svc.service_owner}  kind="person" />
                  <MetadataItem label="Area Owner"       value={svc.vlastnik}       kind="person" />
                  <MetadataItem label="Delivery Mgr"     value={svc.manager}        kind="person" />
                  <MetadataItem label="Unit"             value={svc.unit_of_measure} />
                  <MetadataItem label="Charging"         value={svc.charging_basis} />
                  <MetadataItem label="From EUR"         value={svc.in_service_eur != null ? `€${svc.in_service_eur.toLocaleString()}` : null} />
                  <MetadataItem label="Updated"          value={svc.updated_at}   kind="date" />
                </MetadataGrid>
              </Section>

              {svc.relations && svc.relations.length > 0 && (
                <Section title="Relationships">
                  <div className={styles.relationList}>
                    {svc.relations.map(r => (
                      <div key={r.id} className={styles.relationRow}>
                        <span className={styles.relType}>{r.relation_type}</span>
                        <Link href={`/services/${r.to_service_id}`} className={styles.relLink}>
                          {r.to_title ?? r.to_service_id}
                        </Link>
                        {r.relation_label && <span className={styles.relBadge}>{r.relation_label}</span>}
                        {r.is_mandatory && <span className={styles.relBadgeDanger} title="Mandatory dependency">mandatory</span>}
                        {r.impact_level && (
                          <span className={`${styles.relBadge} ${styles['relImpact_' + r.impact_level] ?? ''}`}>
                            {r.impact_level} impact
                          </span>
                        )}
                        {r.is_inferred && <span className={styles.relBadge}>inferred</span>}
                        {r.is_verified && <span className={styles.relBadgeGreen}>verified</span>}
                        {r.pace_code && <span className={styles.relBadge}>pace:{r.pace_code}</span>}
                        {r.impact_mode && r.impact_mode !== 'none' && <span className={styles.relBadge}>{r.impact_mode}</span>}
                        {r.source_field && <span className={styles.relNote} title={`Source: ${r.source_field}${r.raw_text ? ' — ' + r.raw_text : ''}`}>src</span>}
                        {r.parse_confidence != null && r.parse_confidence < 1 && (
                          <span className={styles.relNote} title={`Parse confidence: ${r.parse_confidence}`}>~{Math.round(r.parse_confidence * 100)}%</span>
                        )}
                        {r.relation_note && <span className={styles.relNote} title={r.relation_note}>info</span>}
                      </div>
                    ))}
                  </div>
                  <Link href={`/services/${id}/graph`} className={styles.graphLink}>
                    View dependency graph →
                  </Link>
                </Section>
              )}

              {svc.flavours && svc.flavours.length > 0 && (
                <Section title="Pricing Variants">
                  <FlavourTable svc={svc} />
                </Section>
              )}

              {c3Visible && c3MappingsData && c3MappingsData.mappings.length > 0 && (
                <Section title="C3 Taxonomy Mapping">
                  <C3MappingTable mappings={c3MappingsData.mappings} />
                </Section>
              )}

              {[svc.support_locations_raw, svc.request_process_raw, svc.support_availability_raw,
                svc.service_cost_raw, svc.additional_information_raw, svc.service_features_raw,
                svc.ext_tools_raw, svc.legacy_ssl_mapping_raw, svc.budget_activity_code,
                svc.other_info_raw, svc.pricing_note_raw, svc.training_refs,
                svc.prerequisites_json, svc.dependencies_json].some(v => v != null) && (
                <RawExtSection svc={svc} />
              )}

              {svc.service_features && (
                <Section title="Service Features">
                  <p className={styles.prose}>{svc.service_features}</p>
                </Section>
              )}

              {hasExtData && (
                <Section title="Extended Data">
                  <button
                    className={styles.collapseToggle}
                    onClick={() => setExtDataOpen(o => !o)}
                    aria-expanded={extDataOpen}
                  >
                    {extDataOpen ? 'Hide' : 'Show'} extended data
                  </button>
                  {extDataOpen && (
                    <div className={styles.extDataGrid}>
                      {svc.customer_type != null && (
                        <ExtDataBlock label="Customer Type" value={svc.customer_type} />
                      )}
                      {svc.options != null && (
                        <ExtDataBlock label="Options" value={svc.options} />
                      )}
                      {svc.notes != null && (
                        <ExtDataBlock label="Notes" value={svc.notes} />
                      )}
                      {svc.training_refs != null && (
                        <ExtDataBlock label="Training References" value={svc.training_refs} />
                      )}
                      {svc.prerequisites_json != null && (
                        <ExtDataBlock label="Prerequisites" value={svc.prerequisites_json} />
                      )}
                      {svc.dependencies_json != null && (
                        <ExtDataBlock label="Dependencies (JSON)" value={svc.dependencies_json} />
                      )}
                    </div>
                  )}
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
                  {requestHref && <a href={requestHref} target="_blank" rel="noreferrer">Request service ↗</a>}
                  <a href={supportAnchor}>Jump to support</a>
                  <a href={governanceAnchor}>Open governance</a>
                  <Link href={`/services/${id}/edit`}>Edit service</Link>
                  {footerSourceUrl && <a href={footerSourceUrl} target="_blank" rel="noreferrer">Source page ↗</a>}
                </div>
              </Surface>
            </>
          ) : (
            <>
              <div id="governance">
              <Surface padding="var(--space-4)">
                <div className={styles.railTitle}>Governance</div>
                <div className={styles.railItems}>
                  <MetadataItem label="Version"        value={svc.catalogue_version} />
                  <MetadataItem label="Updated"        value={svc.updated_at}   kind="date" />
                  <MetadataItem label="Created"        value={svc.created_at}   kind="date" />
                  <MetadataItem label="Updated by"     value={svc.updated_by} />
                  <MetadataItem label="Created by"     value={svc.created_by} />
                  <MetadataItem label="Source updated" value={svc.modified_at_source} kind="date" />
                  {svc.created_at_source && <MetadataItem label="Source created" value={svc.created_at_source} kind="date" />}
                  <MetadataItem label="Classification" value={svc.security_classification} />
                  <MetadataItem label="Lifecycle model" value={technicalView?.service_status ?? svc.service_status} />
                  <MetadataItem label="Primary offering" value={technicalView?.has_primary_offering ? 'Yes' : 'No'} />
                  <MetadataItem label="C3 UUID"        value={svc.c3_uuid} />
                  <MetadataItem label="C3 Level"       value={svc.c3_level} />
                  <MetadataItem label="C3 Domain"      value={svc.c3_domain} />
                  <MetadataItem label="C3 Source"      value={svc.c3_source} />
                  <MetadataItem label="C3 Reference"   value={svc.c3_reference} />
                  {svc.c3_synced_at && <MetadataItem label="C3 Synced"  value={svc.c3_synced_at} kind="date" />}
                  {svc.c3_sync_status && <MetadataItem label="C3 Sync status" value={svc.c3_sync_status} />}
                  {svc.c3_is_primary != null && <MetadataItem label="C3 Primary" value={svc.c3_is_primary ? 'Yes' : 'No'} />}
                  {(svc.is_deleted || svc.is_stub || svc.is_available_status_ambiguous || svc.cp_service_type_raw) && (
                    <div style={{ marginTop: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      {svc.is_stub && <div>Stub record</div>}
                      {svc.is_deleted && <div>Deleted</div>}
                      {svc.is_available_status_ambiguous && <div>Ambiguous availability</div>}
                      {svc.cp_service_type_raw && <div>CP type: {svc.cp_service_type_raw}</div>}
                    </div>
                  )}
                  {svc.c3_parent_id && <MetadataItem label="C3 Parent ID" value={svc.c3_parent_id} />}
                  {(svc.source_local_id || svc.source_sp_id || svc.source_etag) && (
                    <div style={{ marginTop: 'var(--space-2)', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                      {svc.source_local_id && <div>Local ID: {svc.source_local_id}</div>}
                      {svc.source_sp_id && <div>SP ID: {svc.source_sp_id}</div>}
                      {svc.source_etag && <div title="ETag from import source">ETag: {svc.source_etag}</div>}
                    </div>
                  )}
                </div>

                {svc.completeness_score != null && (
                  <div className={styles.scoreSection}>
                    <button
                      className={styles.scoreToggle}
                      onClick={() => setScoreOpen(o => !o)}
                      aria-expanded={scoreOpen}
                    >
                      <span className={styles.scoreLabel}>Completeness</span>
                      <span className={styles.scoreValue} style={{ color: svc.completeness_score < 40 ? 'var(--color-danger)' : svc.completeness_score < 70 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                        {svc.completeness_score}%
                      </span>
                      <span className={styles.scoreChevron}>{scoreOpen ? '▲' : '▼'}</span>
                    </button>
                    <div className={styles.scoreBar}>
                      <div className={styles.scoreBarFill} style={{ width: `${svc.completeness_score}%`, background: svc.completeness_score < 40 ? 'var(--color-danger)' : svc.completeness_score < 70 ? 'var(--color-warning)' : 'var(--color-success)' }} />
                    </div>
                    {scoreOpen && scoreData && (
                      <ScoreBreakdown breakdown={scoreData.breakdown} serviceId={id} />
                    )}
                  </div>
                )}
              </Surface>
              </div>

              <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                <div className={styles.railTitle}>Ownership</div>
                <div className={styles.railItems}>
                  <MetadataItem label="Owner"         value={svc.service_owner}  kind="person" />
                  <MetadataItem label="Area Owner"    value={svc.vlastnik}       kind="person" />
                  <MetadataItem label="Delivery Mgr"  value={svc.manager}        kind="person" />
                </div>
                {rolesData && rolesData.length > 0 && (
                  <div className={styles.ownershipHistorySection}>
                    <button
                      className={styles.collapseToggle}
                      onClick={() => setRolesOpen(o => !o)}
                      aria-expanded={rolesOpen}
                      style={{ marginTop: 'var(--space-3)' }}
                    >
                      {rolesOpen ? 'Hide' : 'Show'} ownership history
                    </button>
                    {rolesOpen && (
                      <OwnershipHistory roles={rolesData} />
                    )}
                  </div>
                )}
              </Surface>

              <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)' }}>
                <div className={styles.railTitle}>Quick Links</div>
                <div className={styles.quickLinks}>
                  <Link href={`/services/${id}/graph`}>Dependency graph</Link>
                  <Link href={`/services/${id}/history`}>Audit history</Link>
                  <Link href={`/services/${id}/edit`}>Edit service</Link>
                  {footerSourceUrl && <a href={footerSourceUrl} target="_blank" rel="noreferrer">Service URL ↗</a>}
                </div>
              </Surface>

              {svc.retired_note && (
                <Surface padding="var(--space-4)" style={{ marginTop: 'var(--space-3)', borderColor: 'var(--color-warning)' }}>
                  <div className={styles.railTitle} style={{ color: 'var(--color-warning)' }}>Retirement Note</div>
                  <p className={styles.prose}>{svc.retired_note}</p>
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
  governanceAnchor,
  summarySourceUrl,
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
  governanceAnchor: string;
  summarySourceUrl: string | null;
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
  const managerSummary = consumerValue ?? businessSummary ?? service.value_proposition ?? service.business_purpose ?? service.summary ?? 'Service record is ready for business-facing enrichment.';
  const readinessLabel = blockers.length
    ? `${blockers.length} blocker${blockers.length === 1 ? '' : 's'}`
    : warnings.length
      ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
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
            <InlineStatusPill id={id} status={service.service_status ?? 'draft'} />
          </div>
          <div className={styles.headerActions}>
            <Link href={`/services/${id}/edit`}><Button size="sm">Edit</Button></Link>
          </div>
        </div>
        <span className={styles.studioEyebrow}>Service relationship studio</span>
        <h1 className={styles.studioTitle}>{service.title}</h1>
        <p className={styles.studioLead}>{managerSummary}</p>

        <div className={styles.studioActions}>
          {requestHref ? (
            <a href={requestHref} target="_blank" rel="noreferrer" className={styles.primaryAction}>
              Request service
            </a>
          ) : (
            <button type="button" className={styles.primaryActionMuted} disabled>
              Request path missing
            </button>
          )}
          <a href={supportAnchor} className={styles.secondaryAction}>Support</a>
          <a href={governanceAnchor} className={styles.secondaryAction}>Governance</a>
          {summarySourceUrl && (
            <a href={summarySourceUrl} target="_blank" rel="noreferrer" className={styles.secondaryAction}>
              Source page
            </a>
          )}
        </div>

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
      detail: blockers[0],
      href: `/services/${id}/edit`,
      label: 'Fix record',
    });
  } else if (warnings.length) {
    tasks.push({
      tone: 'warning',
      title: 'Warnings before publish',
      detail: warnings[0],
      href: `/services/${id}/edit`,
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
    detail: primaryOffering?.title ? `${primaryOffering.title} is the primary customer path.` : 'Users have a route to request the service.',
    href: requestHref,
    label: 'Open path',
  } : {
    tone: 'warning',
    title: 'Request path missing',
    detail: 'Admins should add a request channel before managers promote this service.',
    href: `/services/${id}/edit`,
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
    href: '#support',
    label: 'View support',
  });

  const missingAction = overview?.missing_actions[0];
  if (missingAction) {
    tasks.push({
      tone: missingAction.severity === 'blocker' ? 'danger' : missingAction.severity === 'warning' ? 'warning' : 'info',
      title: missingAction.title,
      detail: missingAction.description,
      href: missingAction.href || `/services/${id}/edit`,
      label: 'Open',
    });
  } else {
    tasks.push(capabilityCount ? {
      tone: 'success',
      title: 'C3 relationship is visible',
      detail: 'Managers can see how this service supports capability coverage.',
      href: `/services/${id}/graph`,
      label: 'Open graph',
    } : {
      tone: 'warning',
      title: 'C3 mapping missing',
      detail: 'Connect this service to a capability so the C3 board can explain impact.',
      href: `/services/${id}/edit`,
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

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section className={styles.section} id={id}>
      {title ? <h2 className={styles.sectionTitle}>{title}</h2> : null}
      {children}
    </section>
  );
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
              <span key={rule.rule_key} className={`${styles.readinessRuleBadge} ${styles[`readinessRule_${rule.status}`] ?? ''}`}>
                {rule.severity} {rule.title}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={styles.service360Grid}>
        <Service360Metric label="Portfolio" value={portfolio} detail={overview.lifecycle.criticality_code ?? 'Standard criticality'} />
        <Service360Metric label="Lifecycle" value={lifecycle} detail={overview.lifecycle.review_due_at ? `Review ${formatDate(overview.lifecycle.review_due_at)}` : 'Review missing'} />
        <Service360Metric label="Owners" value={ownerName} detail={overview.owners.steward?.display_name ?? 'Steward missing'} />
        <Service360Metric label="Offerings" value={countLabel(overview.offerings.count, 'offering')} detail={overview.offerings.primary?.title ?? overview.offerings.primary?.offering_code ?? 'Primary missing'} />
        <Service360Metric label="SLA & Pricing" value={overview.sla.has_sla && overview.pricing.has_prices ? 'Covered' : 'Incomplete'} detail={`${overview.sla.record_count} SLA records / ${overview.pricing.priced_flavour_count} priced`} />
        <Service360Metric label="Dependencies" value={`${overview.dependencies.outgoing_count} out / ${overview.dependencies.incoming_count} in`} detail={`${overview.dependencies.mandatory_count} mandatory`} />
        <Service360Metric label="Capabilities" value={countLabel(overview.capability_mappings.length, 'mapping')} detail={primaryCapability?.title ?? 'Primary missing'} />
        <Service360Metric label="C3 Mapping" value={primaryCapability?.code ?? primaryCapability?.c3_uuid ?? 'Missing'} detail={primaryCapability?.status ?? primaryCapability?.mapping_type_code ?? 'Unclassified'} />
        <Service360Metric label="Governance" value={countLabel(overview.governance_risks.count, 'risk')} detail={`${overview.governance_risks.high_count} high priority`} />
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
  if (!offerings || offerings.length === 0) {
    return <p className={styles.emptyState}>No service offerings are configured yet.</p>;
  }

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
  const requestHref = safeHref(primaryOffering?.request_channel_url ?? service.request_channel_url);
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
        {requestHref ? (
          <a href={requestHref} target="_blank" rel="noreferrer" className={styles.inlineActionLink}>
            Open request form ↗
          </a>
        ) : (
          <p className={styles.emptyState}>No request URL is configured yet.</p>
        )}
      </div>

      <div className={styles.infoCard}>
        <div className={styles.infoCardLabel}>Audience & eligibility</div>
        {service.target_audience_summary && <p className={styles.prose}>{service.target_audience_summary}</p>}
        {audiencePolicies.length > 0 ? (
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
        ) : (
          <p className={styles.emptyState}>No structured audience policies are configured yet.</p>
        )}
      </div>
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
        {requestable ? (
          <p className={styles.operationalGap}>
            ⚠ This service is marked requestable but no structured support model has been configured yet. Service admins can add one in the editor.
          </p>
        ) : (
          <p className={styles.emptyState}>
            No structured support model is configured yet. The current owner fields remain visible in the side panel.
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

// ── Phase 8: Operations panel — grouped links + review metadata ───────────────

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

      {links.length === 0 && (
        <p className={styles.emptyState}>
          No operational links configured yet. Add them in the service editor.
        </p>
      )}
    </div>
  );
}

// Keep the old component for any remaining usage
function OperationalLinksList({ links }: { links: ServiceOperationalLink[] }) {
  return (
    <div className={styles.linksGrid}>
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className={styles.linkCard}
        >
          <span className={styles.linkType}>{link.link_type ?? 'link'}</span>
          <span className={styles.linkTitle}>{link.title}</span>
          <span className={styles.linkArrow}>Open ↗</span>
        </a>
      ))}
    </div>
  );
}

// ── Phase 7: Lifecycle badge ──────────────────────────────────────────────────
const LIFECYCLE_BADGE_CLASS: Record<string, string> = {
  draft:        'lifecycleDraft',
  under_review: 'lifecycleUnderReview',
  approved:     'lifecycleApproved',
  live:         'lifecycleLive',
  deprecated:   'lifecycleDeprecated',
  retired:      'lifecycleRetired',
};

function LifecycleBadge({ state, fallback }: { state: string | null; fallback: string }) {
  if (!state) return <span className={styles.heroFactValue}>{fallback}</span>;
  const cls = LIFECYCLE_BADGE_CLASS[state] ?? 'lifecycleDraft';
  return (
    <span className={`${styles.lifecycleBadge} ${styles[cls]}`}>
      {state.replace('_', ' ')}
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

// ── Score breakdown panel ──────────────────────────────────────────────────────
const SCORE_LABELS: Record<string, string> = {
  title:                'Title',
  service_type:         'Service Type',
  detailed_description: 'Description',
  service_id:           'Service ID',
  unit_of_measure:      'Unit of Measure',
  has_rate:             'Pricing (flavour with rate)',
  has_sla:              'SLA (availability + delivery)',
  available_on:         'Available On (domains)',
  portfolio_group:      'Portfolio Group',
  has_owner:            'Service Owner',
  c3_linked:            'C3 Mapping',
  has_flavours:         'Pricing Variants',
  summary:              'Short Description',
};

function ScoreBreakdown({ breakdown, serviceId }: { breakdown: ScoreBreakdownItem[]; serviceId: string }) {
  const failed = breakdown.filter(b => !b.passed);
  if (failed.length === 0) return <p className={styles.scoreAllGood}>✓ All checks passed</p>;
  return (
    <div className={styles.scoreBreakdown}>
      <div className={styles.scoreBreakdownTitle}>What&apos;s missing:</div>
      {failed.map(b => (
        <div key={b.name} className={styles.scoreBreakdownRow}>
          <span className={styles.scoreBreakdownIcon}>✗</span>
          <span className={styles.scoreBreakdownName}>{SCORE_LABELS[b.name] ?? b.name}</span>
          <span className={styles.scoreBreakdownWeight}>−{b.weight}%</span>
        </div>
      ))}
      <Link href={`/services/${serviceId}/edit`} className={styles.scoreFixLink}>Fix in editor →</Link>
    </div>
  );
}

function FlavourTable({ svc }: { svc: import('@/features/services/model/service.types').ServiceDetail }) {
  return (
    <>
      <div className={styles.flavourTable}>
        <div className={styles.flavourHeaderExt}>
          <span>Variant</span>
          <span>Unit</span>
          <span>Price (EUR)</span>
          <span>Initiation</span>
          <span>Lifecycle</span>
          <span>Billing</span>
          <span>Order</span>
          <span>Status</span>
          <span>Orderable</span>
        </div>
        {svc.flavours.map(f => (
          <div key={f.id} className={styles.flavourRowExt}>
            <span className={styles.flavourTitle}>
              <span className={styles.flavourCode}>{f.flavour_code}</span>
              {f.title && f.title !== f.flavour_code && (
                <span className={styles.flavourSubtitle}>{f.title}</span>
              )}
              {f.short_note && (
                <span className={styles.flavourDesc}>{f.short_note}</span>
              )}
            </span>
            <span>{f.service_unit ?? '—'}</span>
            <span>{f.price_value != null ? `€${f.price_value.toLocaleString()}` : '—'}</span>
            <span>{f.initiation_cost != null ? `€${f.initiation_cost.toLocaleString()}` : '—'}</span>
            <span>{f.lifecycle_cost != null ? `€${f.lifecycle_cost.toLocaleString()}` : '—'}</span>
            <span>{f.billing_period_code ?? '—'}</span>
            <span>{f.display_order != null ? `#${f.display_order}` : '—'}</span>
            <span>
              <span className={styles[`flavourStatus_${f.flavour_status_code ?? 'unknown'}`] ?? styles.flavourStatusDefault}>
                {f.flavour_status_code ?? '—'}
              </span>
            </span>
            <span>{f.is_orderable ? 'Yes' : '—'}</span>
          </div>
        ))}
      </div>

      {svc.flavours.some(f => f.nations_rate) && (
        <div className={styles.flavourNote}>
          <strong className={styles.flavourNoteLabel}>Nations Rate:</strong>
          {svc.flavours.filter(f => f.nations_rate).map(f => (
            <div key={f.id}>
              <span className={styles.flavourNoteTitle}>{f.title || f.flavour_code}:</span>
              <pre className={styles.nationsRatePre}>{f.nations_rate}</pre>
            </div>
          ))}
        </div>
      )}

      {svc.flavours.some(f => f.dependency_text) && (
        <div className={styles.flavourNote}>
          <strong className={styles.flavourNoteLabel}>Dependencies:</strong>
          {svc.flavours.filter(f => f.dependency_text).map(f => (
            <p key={f.id} className={styles.prose}>
              <strong>{f.title || f.flavour_code}:</strong> {f.dependency_text}
            </p>
          ))}
        </div>
      )}

      {svc.flavours.some(f => f.pricing_note_raw) && (
        <div className={styles.flavourNote}>
          {svc.flavours.filter(f => f.pricing_note_raw).map(f => (
            <p key={f.id} className={styles.prose}>
              <strong>{f.title}:</strong> {f.pricing_note_raw}
            </p>
          ))}
        </div>
      )}

      {svc.flavours.some(f => f.delivery_note) && (
        <div className={styles.flavourNote}>
          <strong className={styles.flavourNoteLabel}>Delivery Notes:</strong>
          {svc.flavours.filter(f => f.delivery_note).map(f => (
            <p key={f.id} className={styles.prose}>
              <strong>{f.title || f.flavour_code}:</strong> {f.delivery_note}
            </p>
          ))}
        </div>
      )}

      {svc.flavours.some(f => f.technical_note) && (
        <div className={styles.flavourNote}>
          <strong className={styles.flavourNoteLabel}>Technical Notes:</strong>
          {svc.flavours.filter(f => f.technical_note).map(f => (
            <p key={f.id} className={styles.prose}>
              <strong>{f.title || f.flavour_code}:</strong> {f.technical_note}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

// ── Inline status edit pill ────────────────────────────────────────────────────
const STATUS_OPTIONS = ['active', 'planned', 'retired', 'deprecated', 'draft'];

function InlineStatusPill({ id, status }: { id: string; status: string }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const { mutate } = useSWRConfig();

  const handleChange = async (newStatus: string) => {
    setBusy(true);
    try {
      await fetch(`/api/v1/services/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ service_status: newStatus }),
      });
      await mutate(`/api/v1/services/${id}`);
    } finally {
      setBusy(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <select
        className={styles.inlineStatusSelect}
        defaultValue={status}
        autoFocus
        disabled={busy}
        onChange={e => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        aria-label="Change service status"
      >
        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }

  return (
    <button
      className={styles.inlineStatusBtn}
      onClick={() => setEditing(true)}
      title="Click to change status"
      aria-label={`Status: ${status}. Click to edit.`}
    >
      <StatusPill status={status} />
    </button>
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

// ── Extended Data block (Item 13) ──────────────────────────────────────────────
function ExtDataBlock({ label, value }: { label: string; value: unknown }) {
  let formatted: string;
  try {
    formatted = JSON.stringify(
      typeof value === 'string' ? JSON.parse(value) : value,
      null, 2
    );
  } catch {
    formatted = String(value);
  }
  return (
    <div className={styles.extDataItem}>
      <div className={styles.extDataLabel}>{label}</div>
      <pre className={styles.extDataPre}>{formatted}</pre>
    </div>
  );
}

// ── Raw Extended Fields section (Table A — 11 raw + 3 JSON fields) ────────────
const RAW_LABELS: Array<[keyof import('@/features/services/model/service.types').ServiceDetail, string]> = [
  ['support_locations_raw',      'Support Locations'],
  ['request_process_raw',        'Request Process'],
  ['support_availability_raw',   'Support Availability'],
  ['service_cost_raw',           'Service Cost'],
  ['additional_information_raw', 'Additional Information'],
  ['service_features_raw',       'Service Features (raw)'],
  ['ext_tools_raw',             'Ext Tools'],
  ['legacy_ssl_mapping_raw',     'Legacy SSL Mapping'],
  ['budget_activity_code',       'Budget Activity Code'],
  ['other_info_raw',             'Other Info'],
  ['pricing_note_raw',           'Pricing Note (raw)'],
];

function RawExtSection({ svc }: { svc: import('@/features/services/model/service.types').ServiceDetail }) {
  const [open, setOpen] = useState(false);
  const visible = RAW_LABELS.filter(([k]) => svc[k] != null);
  if (visible.length === 0) return null;
  return (
    <Section title="Extended Fields">
      <button
        className={styles.collapseToggle}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {open ? '▲ Hide' : '▼ Show'} {visible.length} extended field(s)
      </button>
      {open && (
        <div className={styles.extDataGrid}>
          {visible.map(([key, label]) => (
            <ExtDataBlock key={key} label={label} value={svc[key]} />
          ))}
        </div>
      )}
    </Section>
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
            <span>{m.c3_short_title || m.c3_title || m.c3_uuid}</span>
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

const DETAIL_VIEWS: Array<{ id: DetailView; label: string; hint: string }> = [
  { id: 'overview', label: 'Overview', hint: 'Value, scope, commitments' },
  { id: 'offerings', label: 'Offerings', hint: 'Catalogue packages and variants' },
  { id: 'request', label: 'Request & Support', hint: 'Eligibility, approvals, support path' },
  { id: 'coverage', label: 'Coverage', hint: 'Framework requirements and gaps' },
  { id: 'governance', label: 'Governance', hint: 'Metadata, relationships, architecture' },
];

function CoveragePanel({ frameworks, serviceId }: { frameworks: ServiceFrameworkCoverage[]; serviceId: string }) {
  if (!frameworks.length) {
    return (
      <Section title="Coverage">
        <EmptyState
          title="No framework coverage mapped yet"
          description="Add a Level-3 capability mapping to show FMN/C3 framework coverage, missing requirements, and capability dashboard links."
          action={<Link href={`/services/${serviceId}/edit#c3`}>Add framework mapping</Link>}
        />
      </Section>
    );
  }
  return (
    <Section title="Coverage">
      <div className={styles.coverageCards}>
        {frameworks.map((framework) => (
          <article key={framework.framework_code} className={styles.coverageCard}>
            <div className={styles.coverageHeader}>
              <div>
                <div className={styles.coverageCode}>{framework.framework_code}</div>
                <h3>{framework.title}</h3>
              </div>
              <strong>{framework.coverage_percent}%</strong>
            </div>
            <ProgressBar value={framework.coverage_percent} tone={framework.coverage_percent >= 80 ? 'success' : 'warning'} label={`${framework.title} coverage`} />
            <p>{framework.core_covered}/{framework.core_total} core requirements covered for {framework.spiral_code ?? 'selected spiral'}.</p>
            {framework.capability_slug && <Link href={`/capabilities/${framework.capability_slug}`}>Open capability dashboard →</Link>}
            {framework.missing_core.length > 0 && (
              <ul>
                {framework.missing_core.slice(0, 5).map((item) => <li key={`${item.kind}-${item.code}`}>{item.code}: {item.title}</li>)}
              </ul>
            )}
          </article>
        ))}
      </div>
    </Section>
  );
}

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

function safeJson(value: unknown) {
  try {
    return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2);
  } catch {
    return String(value);
  }
}
