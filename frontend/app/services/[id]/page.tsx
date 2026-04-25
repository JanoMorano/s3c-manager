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
  useService, useServiceSla, useServiceScore, useServiceRoles, useServiceC3Mappings,
  type ServiceC3Mapping,
} from '@/features/services/hooks/useServices';
import { StatusPill }        from '@/features/services/components/StatusPill';
import { AvailabilityBadge } from '@/features/services/components/AvailabilityBadge';
import { DomainDotGroup }    from '@/features/services/components/DomainDotGroup';
import { MetadataItem, MetadataGrid } from '@/features/services/components/MetadataItem';
import { SlaPanel }          from '@/features/services/components/SlaPanel';
import { Surface } from '@/design-system/primitives';
import { Button }  from '@/design-system/controls/Button';
import type {
  ScoreBreakdownItem,
  ServiceAudiencePolicy,
  ServiceOffering,
  ServiceOperationalLink,
  ServiceRoleAssignment,
  ServiceSupportModel,
} from '@/features/services/model/service.types';
import { authHeaders } from '@/features/services/api/services.api';
import { safeHref } from '@/shared/utils/safeHref';
import styles from './detail.module.css';

interface Props { params: Promise<{ id: string }> }
type DetailView = 'overview' | 'offerings' | 'request' | 'governance';

export default function ServiceDetailPage({ params }: Props) {
  const { id } = use(params);
  const { c3Visible } = useInstallStatus();
  const { data: svc, isLoading, error } = useService(id);
  const { data: slaData } = useServiceSla(id);
  const { data: scoreData } = useServiceScore(id);
  const { data: rolesData } = useServiceRoles(id);
  const { data: c3MappingsData } = useServiceC3Mappings(c3Visible ? id : null);
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

      {/* ── Header (L1 Identity) ─────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerMeta}>
          <span className={styles.serviceId}>{svc.service_id}</span>
          {svc.service_type && <span className={styles.typeChip}>{svc.service_type}</span>}
        </div>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{svc.title}</h1>
          <div className={styles.headerActions}>
            <InlineStatusPill id={id} status={svc.service_status ?? 'draft'} />
            <Link href={`/services/${id}/edit`}><Button size="sm">Edit</Button></Link>
          </div>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroIntro}>
          <div className={styles.heroEyebrow}>Business view</div>
          <h2 className={styles.heroTitle}>
            {businessSummary ?? svc.value_proposition ?? svc.summary ?? 'Service overview'}
          </h2>
          <p className={styles.heroBody}>
            {svc.value_proposition ?? svc.business_purpose ?? svc.detailed_description ?? 'This service record is ready for business-facing enrichment.'}
          </p>
          <div className={styles.heroActions}>
            {requestHref ? (
              <a href={requestHref} target="_blank" rel="noreferrer" className={styles.primaryAction}>
                Request service
              </a>
            ) : (
              <button type="button" className={styles.primaryActionMuted} disabled>
                Request path not configured
              </button>
            )}
            <a href={supportAnchor} className={styles.secondaryAction}>View support</a>
            <a href={governanceAnchor} className={styles.secondaryAction}>Open governance</a>
            {summarySourceUrl && (
              <a href={summarySourceUrl} target="_blank" rel="noreferrer" className={styles.secondaryAction}>
                Source page ↗
              </a>
            )}
          </div>
        </div>

        <div className={styles.heroFacts}>
          {overviewFacts.map((fact) =>
            fact.label === 'Lifecycle' ? (
              <div key={fact.label} className={styles.heroFact}>
                <span className={styles.heroFactLabel}>{fact.label}</span>
                <LifecycleBadge state={lifecycleState} fallback={fact.value} />
              </div>
            ) : (
              <div key={fact.label} className={styles.heroFact}>
                <span className={styles.heroFactLabel}>{fact.label}</span>
                <span className={styles.heroFactValue}>{fact.value}</span>
              </div>
            )
          )}
        </div>
      </section>

      <div className={styles.summaryStrip}>
        <SummaryItem label="Availability">
          <AvailabilityBadge pct={svc.sla_availability} />
        </SummaryItem>
        <SummaryItem label="Portfolio">{svc.portfolio_group ?? '—'}</SummaryItem>
        <SummaryItem label="Domains">
          <DomainDotGroup domains={svc.available_on} />
        </SummaryItem>
        <SummaryItem label="Owner">{svc.service_owner ?? '—'}</SummaryItem>
        <SummaryItem label="Support">{supportModels[0]?.support_owner_name ?? svc.vlastnik ?? '—'}</SummaryItem>
        <SummaryItem label="Review due">{svc.next_review_due_at ? formatDate(svc.next_review_due_at) : '—'}</SummaryItem>
      </div>

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
                    <p className={styles.calloutQuote} style={{ borderLeftColor: '#3b82f6' }}>
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
  { id: 'governance', label: 'Governance', hint: 'Metadata, relationships, architecture' },
];

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
