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
import type { ScoreBreakdownItem, ServiceRoleAssignment } from '@/features/services/model/service.types';
import { authHeaders } from '@/features/services/api/services.api';
import { safeHref } from '@/shared/utils/safeHref';
import styles from './detail.module.css';

interface Props { params: Promise<{ id: string }> }

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

  if (isLoading) return <div className={styles.state}>Loading…</div>;
  if (error)     return <div className={styles.stateError}>Service not found or API unreachable.</div>;
  if (!svc)      return null;

  const summarySourceUrl = safeHref(svc.source_url);
  const footerSourceUrl = safeHref(svc.source_url);

  // JSON extended data presence check
  const hasExtData = svc.customer_type != null || svc.options != null || svc.notes != null || svc.training_refs != null || svc.prerequisites_json != null || svc.dependencies_json != null;

  return (
    <div className={styles.shell}>

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

      {/* ── Summary strip (L2 Operational orientation) ───────────────── */}
      <div className={styles.summaryStrip}>
        <SummaryItem label="Availability">
          <AvailabilityBadge pct={svc.sla_availability} />
        </SummaryItem>
        <SummaryItem label="Portfolio">{svc.portfolio_group ?? '—'}</SummaryItem>
        <SummaryItem label="Domains">
          <DomainDotGroup domains={svc.available_on} />
        </SummaryItem>
        <SummaryItem label="Owner">{svc.service_owner ?? '—'}</SummaryItem>
        <SummaryItem label="Support">{svc.vlastnik ?? '—'}</SummaryItem>
        {summarySourceUrl && (
          <SummaryItem label="URL">
            <a href={summarySourceUrl} target="_blank" rel="noreferrer" className={styles.summaryLink}>
              Service URL ↗
            </a>
          </SummaryItem>
        )}
      </div>

      {/* ── Body + Right rail ────────────────────────────────────────── */}
      <div className={styles.body}>

        {/* Main content */}
        <div className={styles.main}>

          {/* Description (L5 Narrative) */}
          {svc.summary && (
            <Section title="Description">
              <p className={styles.prose}>{svc.summary}</p>
              {svc.detailed_description && (
                <p className={styles.prose} style={{ marginTop: 'var(--space-3)' }}>
                  {svc.detailed_description}
                </p>
              )}
            </Section>
          )}

          {/* Business purpose */}
          {(svc.value_proposition || svc.business_purpose) && (
            <Section title="Business Purpose">
              {svc.value_proposition && <p className={styles.prose}>{svc.value_proposition}</p>}
              {svc.business_purpose && svc.business_purpose !== svc.value_proposition && (
                <p className={styles.prose} style={{ marginTop: 'var(--space-2)', borderLeft: '3px solid var(--color-border)', paddingLeft: 'var(--space-3)' }}>
                  <em>{svc.business_purpose}</em>
                </p>
              )}
            </Section>
          )}

          {/* Scope (Item 7) */}
          {svc.scope_text && (
            <Section title="Scope">
              <p className={styles.prose}>{svc.scope_text}</p>
            </Section>
          )}

          {/* Exclusions */}
          {svc.exclusions && (
            <Section title="Exclusions">
              <p className={styles.prose}>{svc.exclusions}</p>
            </Section>
          )}

          {/* Operational Notes (Item 7) */}
          {svc.operational_notes_raw && (
            <Section title="Operational Notes">
              <p className={styles.prose}>{svc.operational_notes_raw}</p>
            </Section>
          )}

          {/* Operational metadata (L2) */}
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

          {/* SLA — summary + detail jako jeden panel */}
          <Section title="">
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

          {/* Relations */}
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
                    {r.is_mandatory && <span className={styles.relBadgeDanger} title="Mandatory dependency">🔴 mandatory</span>}
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
                    {r.relation_note && <span className={styles.relNote} title={r.relation_note}>ℹ</span>}
                  </div>
                ))}
              </div>
              <Link href={`/services/${id}/graph`} className={styles.graphLink}>
                View dependency graph →
              </Link>
            </Section>
          )}

          {/* Pricing Variants (Item 11 — extended columns) */}
          {svc.flavours && svc.flavours.length > 0 && (
            <Section title="Pricing Variants">
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
                    <span>{f.is_orderable ? '✓' : '—'}</span>
                  </div>
                ))}
              </div>

              {/* nations_rate code blocks (Item 11) */}
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

              {/* dependency_text as expandable rows (Item 11) */}
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
            </Section>
          )}


          {/* C3 Taxonomy Mapping */}
          {c3Visible && c3MappingsData && c3MappingsData.mappings.length > 0 && (
            <Section title="C3 Taxonomy Mapping">
              <C3MappingTable mappings={c3MappingsData.mappings} />
            </Section>
          )}

          {/* Raw Extended Fields (collapsible) — Table A gaps */}
          {[svc.support_locations_raw, svc.request_process_raw, svc.support_availability_raw,
            svc.service_cost_raw, svc.additional_information_raw, svc.service_features_raw,
            svc.ext_tools_raw, svc.legacy_ssl_mapping_raw, svc.budget_activity_code,
            svc.other_info_raw, svc.pricing_note_raw, svc.training_refs,
            svc.prerequisites_json, svc.dependencies_json].some(v => v != null) && (
            <RawExtSection svc={svc} />
          )}
          {/* Features */}
          {svc.service_features && (
            <Section title="Service Features">
              <p className={styles.prose}>{svc.service_features}</p>
            </Section>
          )}

          {/* Extended Data (Item 13) — JSON fields collapsible */}
          {hasExtData && (
            <Section title="Extended Data">
              <button
                className={styles.collapseToggle}
                onClick={() => setExtDataOpen(o => !o)}
                aria-expanded={extDataOpen}
              >
                {extDataOpen ? '▲ Hide' : '▼ Show'} extended data
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

        {/* ── Right rail (L3 Governance) ─────────────────────────────── */}
        <aside className={styles.rail} aria-label="Governance and quick links">

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
                  {svc.is_stub && <div>⚠️ Stub record</div>}
                  {svc.is_deleted && <div>🗑 Deleted</div>}
                  {svc.is_available_status_ambiguous && <div>⚠️ Ambiguous availability</div>}
                  {svc.cp_service_type_raw && <div>CP type: {svc.cp_service_type_raw}</div>}
                </div>
              )}
              {svc.c3_parent_id && <MetadataItem label="C3 Parent ID" value={svc.c3_parent_id} />}
              {(svc.source_local_id || svc.source_sp_id || svc.source_etag) && (
                <div style={{ marginTop: 'var(--space-2)', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                  {svc.source_local_id && <div>Local ID: {svc.source_local_id}</div>}
                  {svc.source_sp_id && <div>SP ID: {svc.source_sp_id}</div>}
                  {svc.source_etag && <div title="ETag z importního zdroje">ETag: {svc.source_etag}</div>}
                </div>
              )}
            </div>

            {/* ── Completeness score + breakdown ─────────────────────── */}
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

          {/* ── Ownership History (Item 12) ────────────────────────── */}
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
                  {rolesOpen ? '▲ Hide' : '▼ Show'} ownership history
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
        </aside>
      </div>
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
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
