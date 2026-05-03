/**
 * API response types — mapped from middleware findAllDirect / findByServiceId.
 * These are the raw wire shapes. Use canonical.ts for business logic types.
 */

// ── List item (GET /api/v1/services) ─────────────────────────────────────────
export interface ServiceListItem {
  id: number;
  service_id: string;
  title: string;
  short_description: string | null;
  service_type: string | null;
  service_status: string | null;
  lifecycle_state: string | null;
  requestable: boolean | null;
  unit_of_measure: string | null;
  charging_basis: string | null;
  available_on: string | null;     // comma-separated domain codes: "CLOUD,PRISM,NEXUS"
  sla_availability: number | null;
  sla_delivery: number | null;
  sla_restoration: number | null;
  portfolio_group: string | null;
  in_service_eur: number | null;
  flavour_count: number;
  relation_count: number;
  service_owner: string | null;
  vlastnik: string | null;
  manager: string | null;
  updated_at: string;
  completeness_score?: number | null;
  has_c3_mapping?: number | boolean | null;
  c3_mapping_count?: number | null;
  primary_capability_title?: string | null;
  primary_capability_code?: string | null;
}

export interface ServiceListResponse {
  items: ServiceListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ServiceOverviewRole {
  id: number | null;
  role_code: string;
  role_name?: string | null;
  display_name: string;
  email: string | null;
  organization_name?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
}

export interface ServiceOverviewAction {
  key: string;
  title: string;
  description: string;
  href: string;
  severity: 'blocker' | 'warning' | 'info' | string;
}

export interface ServiceCapabilityMapping {
  mapping_id: number | null;
  c3_uuid: string;
  code: string | null;
  title: string;
  mapping_type_code: string | null;
  mapping_type_name: string | null;
  pace_code: string | null;
  pace_name: string | null;
  c3_level: number | string | null;
  c3_domain: string | null;
  is_primary: boolean;
  status: string | null;
}

export interface ServiceOverview {
  service: {
    id: number;
    service_id: string;
    title: string;
    summary: string | null;
    service_type: string | null;
    service_type_name: string | null;
    service_status: string | null;
    service_status_name: string | null;
    updated_at: string | null;
  };
  portfolio: {
    id: number | null;
    code: string | null;
    title: string | null;
    group_code: string | null;
    group_name: string | null;
  };
  lifecycle: {
    stage_code: string | null;
    state: string | null;
    service_status: string | null;
    service_status_name: string | null;
    criticality_code: string | null;
    requestable: boolean | null;
    review_due_at: string | null;
  };
  owners: {
    primary: ServiceOverviewRole | null;
    steward: ServiceOverviewRole | null;
    delivery_manager: ServiceOverviewRole | null;
    reviewer: ServiceOverviewRole | null;
    review_owner_user_id: number | string | null;
    assignments: ServiceOverviewRole[];
  };
  offerings: {
    count: number;
    requestable_count: number;
    primary: Partial<ServiceOffering> | null;
    items: ServiceOffering[];
  };
  flavours: ServiceFlavour[];
  audience_policies: ServiceAudiencePolicy[];
  support_model: ServiceSupportModel[];
  operational_links: ServiceOperationalLink[];
  sla: {
    availability_pct: number | null;
    restoration_hours: number | null;
    delivery_days: number | null;
    restoration_text?: string | null;
    delivery_text?: string | null;
    record_count: number;
    has_sla: boolean;
    records: SlaRecord[];
  };
  pricing: {
    has_prices: boolean;
    requestable_without_price: boolean;
    flavour_count: number;
    active_flavour_count: number;
    priced_flavour_count: number;
    currency_codes: string[];
    billing_period_codes: string[];
    service_cost_raw?: string | null;
    pricing_note_raw?: string | null;
    flavours: ServiceFlavour[];
  };
  dependencies: {
    total_count: number;
    incoming_count: number;
    outgoing_count: number;
    mandatory_count: number;
    unverified_count: number;
    incoming: Array<ServiceRelation & { direction?: string }>;
    outgoing: Array<ServiceRelation & { direction?: string }>;
    items: ServiceRelation[];
    raw_dependencies: unknown[];
  };
  capability_mappings: ServiceCapabilityMapping[];
  c3_mappings: unknown[];
  readiness: ServiceReadiness | null;
  governance_risks: {
    count: number;
    high_count: number;
    items: Array<Record<string, unknown>>;
  };
  audit_summary: {
    count: number;
    last_action: ServiceHistoryEntry | null;
    recent: ServiceHistoryEntry[];
  };
  missing_actions: ServiceOverviewAction[];
}

export interface ServiceOverviewResponse {
  item: ServiceOverview;
}

export interface ServicePortfolio {
  id: number;
  portfolio_code: string;
  title: string;
  description: string | null;
  status_code: string;
  owner_group_id: number | null;
  owner_group_name: string | null;
  service_count: number;
  draft_service_count: number;
  active_service_count: number;
  retiring_service_count: number;
  retired_service_count: number;
  requestable_service_count: number;
  overdue_review_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioListResponse {
  items: ServicePortfolio[];
  count: number;
}

export interface ImpactNode {
  node_id: string;
  node_kind: 'service' | 'c3_capability' | 'c3_application' | 'c3_data_object' | 'c3_tin' | 'c3_service' | string;
  node_key: string | null;
  node_uuid?: string | null;
  title: string;
  status?: string | null;
  url?: string | null;
  lifecycle_stage?: string | null;
  criticality?: string | null;
  depth: number;
  path?: string[];
  relation_path?: string[];
}

export interface ImpactEdge {
  edge_id?: string;
  edge_kind?: string;
  source_node_id: string;
  source_kind?: string;
  source_key?: string | null;
  source_title?: string | null;
  target_node_id: string;
  target_kind?: string;
  target_key?: string | null;
  target_title?: string | null;
  relation_kind: string;
  relation_label?: string | null;
  impact_level?: string | null;
  risk_hint?: string | null;
}

export interface ImpactPath {
  node_id: string;
  depth: number;
  path: string[];
  relation_path: string[];
}

export interface ImpactResponse {
  root: ImpactNode;
  direction: 'downstream' | 'upstream';
  max_depth: number;
  depth_reached: number;
  total_impacted: number;
  nodes: ImpactNode[];
  edges: ImpactEdge[];
  paths: ImpactPath[];
}

// ── Detail (GET /api/v1/services/:id) ────────────────────────────────────────
export interface ServiceDetail {
  id: number;
  service_id: string;
  title: string;
  service_type: string | null;
  service_status: string | null;
  portfolio_group: string | null;
  summary: string | null;           // short_description alias
  detailed_description: string | null;
  global_service_group_code: string | null;
  global_service_group_name: string | null;  // COALESCE(gsg.name, global_service_group_code)
  service_line_name: string | null;          // COALESCE(sl.name, service_line_code)
  portfolio_group_name: string | null;       // COALESCE(pg.name, portfolio_group_code)
  service_type_name: string | null;          // COALESCE(st.name, service_type_code)
  service_status_name: string | null;        // COALESCE(ss.name, service_status_code)
  value_proposition: string | null;
  business_purpose: string | null;
  service_features: string | null;
  unit_of_measure: string | null;
  charging_basis: string | null;
  available_on: string[] | null;  // _hydrateService() returns string[] (STRING_AGG split)
  sla_availability: number | null;
  sla_restoration: number | null;
  sla_delivery: number | null;
  source_url: string | null;
  completeness_score: number | null;
  in_service_eur: number | null;
  flavour_count: number;
  relation_count: number;
  service_owner: string | null;
  vlastnik: string | null;
  manager: string | null;
  created_at: string;
  updated_at: string;
  flavours: ServiceFlavour[];
  relations: ServiceRelation[];
  // ordering / pricing hints
  rate_note: string | null;
  ordering_note: string | null;
  exclusions: string | null;
  service_area: string | null;
  // governance
  security_classification: string | null;
  retired_note: string | null;
  notes: unknown | null;
  // taxonomy classification
  service_line_code: string | null;
  organizational_element_code: string | null;
  catalogue_version: string | null;
  // source timestamps (from import source, not internal DB timestamps)
  created_at_source: string | null;
  modified_at_source: string | null;
  // audit
  created_by: string | null;
  updated_by: string | null;
  // flags
  is_deleted: boolean;
  is_stub: boolean;
  is_available_status_ambiguous: boolean;
  cp_service_type_raw: string | null;
  // graph positioning
  graph_x: number | null;
  graph_y: number | null;
  // JSON relation/prereq fields
  prerequisites_json: unknown | null;
  dependencies_json: unknown | null;
  training_refs: unknown | null;
  // import provenance
  source_local_id: string | null;
  source_sp_id: string | null;
  source_etag: string | null;
  // c3 taxonomy
  c3_uuid: string | null;
  c3_parent_id: string | null;
  c3_level: string | null;
  c3_domain: string | null;
  c3_source: string | null;
  c3_reference: string | null;
  c3_synced_at: string | null;
  c3_sync_status: string | null;
  c3_is_primary: boolean | null;
  // extended narrative (L5)
  scope_text: string | null;
  sla_restoration_text: string | null;
  sla_delivery_text: string | null;
  operational_notes_raw: string | null;
  support_locations_raw: string | null;
  request_process_raw: string | null;
  support_availability_raw: string | null;
  service_cost_raw: string | null;
  additional_information_raw: string | null;
  service_features_raw: string | null;
  ext_tools_raw: string | null;
  legacy_ssl_mapping_raw: string | null;
  budget_activity_code: string | null;
  other_info_raw: string | null;
  pricing_note_raw: string | null;
  // JSON fields
  customer_type: unknown | null;
  options: unknown | null;
  business_summary: string | null;
  consumer_value: string | null;
  requestable: boolean | null;
  lifecycle_state: string | null;
  lifecycle_stage_code?: string | null;
  criticality_code?: string | null;
  target_audience_summary: string | null;
  request_channel_type: string | null;
  request_channel_url: string | null;
  approval_required: boolean | null;
  fulfillment_lead_time_text: string | null;
  review_owner_user_id: number | null;
  next_review_due_at: string | null;
  offerings: ServiceOffering[];
  primary_offering: ServiceOffering | null;
  support_model: ServiceSupportModel[];
  audience_policies: ServiceAudiencePolicy[];
  operational_links: ServiceOperationalLink[];
  business_view: ServiceBusinessView;
  technical_view: ServiceTechnicalView;
}

export interface ServiceOffering {
  id: number;
  service_id: number;
  offering_code: string;
  title: string;
  description: string | null;
  is_default: boolean;
  requestable: boolean;
  approval_required: boolean | null;
  request_channel_type: string | null;
  request_channel_url: string | null;
  lead_time_text: string | null;
  support_tier_code: string | null;
  status: string;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceSupportModel {
  id: number;
  service_id: number;
  offering_id: number | null;
  support_owner_name: string | null;
  resolver_group: string | null;
  support_hours_code: string | null;
  support_channel: string | null;
  escalation_path: string | null;
  maintenance_window: string | null;
  review_cadence: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceAudiencePolicy {
  id: number;
  service_id: number;
  offering_id: number | null;
  audience_type: string | null;
  business_unit: string | null;
  region_code: string | null;
  eligibility_rule: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceOperationalLink {
  id: number;
  service_id: number;
  offering_id: number | null;
  link_type: string | null;
  title: string;
  url: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceBusinessView {
  business_summary: string | null;
  consumer_value: string | null;
  requestable: boolean | null;
  lifecycle_state: string | null;
  target_audience_summary: string | null;
  request_channel_type: string | null;
  request_channel_url: string | null;
  approval_required: boolean | null;
  fulfillment_lead_time_text: string | null;
  primary_offering: ServiceOffering | null;
  support_model: ServiceSupportModel[];
  audience_policies: ServiceAudiencePolicy[];
  operational_links: ServiceOperationalLink[];
}

export interface ServiceTechnicalView {
  service_type: string | null;
  service_status: string | null;
  completeness_score: number | null;
  relation_count: number;
  flavour_count: number;
  has_c3_mapping: boolean;
  has_primary_offering: boolean;
}

// ── Flavour (embedded in GET /api/v1/services/:id, or GET /api/v1/flavours?serviceId=) ─────
// Canonical snake_case — matches flavours.repo.js SELECT output exactly.
export interface ServiceFlavour {
  id: number;
  flavour_code: string;
  service_id: string;          // business key string (from JOIN ServiceCatalog)
  title: string;
  service_unit: string | null;
  price_value: number | null;
  currency_code: string | null;
  billing_period_code: string | null;
  initiation_cost: number | null;
  lifecycle_cost: number | null;
  lifetime_years: number | null;
  nations_rate: string | null; // NVARCHAR(MAX) — may be number or JSON string
  dependency_text: string | null;
  short_note: string | null;
  flavour_status_code: string | null;
  pricing_note_raw: string | null;
  delivery_note: string | null;
  technical_note: string | null;
  display_order: number | null;
  is_orderable: boolean;
  created_at: string;
  updated_at: string;
}

// ── Relation (GET /api/v1/services/:id/relations) ────────────────────────────
export interface ServiceRelation {
  id: number;
  from_service_id: string;
  to_service_id: string;
  from_title: string | null;   // joined from ServiceCatalog
  to_title: string | null;     // joined from ServiceCatalog
  relation_type: string;
  relation_label: string | null;
  relation_note: string | null;
  source_field: string | null;
  raw_text: string | null;
  is_inferred: boolean;
  parse_confidence: number | null;
  is_verified: boolean;
  is_mandatory: boolean;
  impact_mode: string | null;  // 'hard_stop' | 'degraded' | 'none'
  impact_level: string | null;
  pace_code: string | null;
  is_deleted: boolean;
  created_at: string;
  created_by: string | null;
}

// ── Score (GET /api/v1/services/:id/score) ────────────────────────────────────
export interface ScoreBreakdownItem {
  name: string;
  weight: number;
  passed: boolean;
}

export interface ServiceScoreResponse {
  score: number;
  passed: string[];
  failed: string[];
  breakdown: ScoreBreakdownItem[];
}

// ── History (GET /api/v1/services/:id/history) ────────────────────────────────
// Maps sc_platform dbo.AuditLog columns returned by audit.findByRecord()
export interface ServiceHistoryEntry {
  id: number;
  action: string;
  changed_fields: string | null;    // JSON array or CSV of changed field names
  performed_by: string | null;
  performed_at: string | null;      // ISO timestamp
  client_ip: string | null;
  // Legacy aliases (backward compat)
  changed_by?: string | null;
  changed_at?: string;
  old_value?: string | null;
  new_value?: string | null;
  new_values?: unknown;
}

// ── Role Assignment (GET /api/v1/services/:id/roles) ─────────────────────────
export interface ServiceRoleAssignment {
  id: number;
  role_code: string;
  display_name: string;
  email: string | null;
  organization_name: string | null;
  valid_from: string;
  valid_to: string | null;
}

// ── SLA (GET /api/v1/services/:id/sla) ──────────────────────────────────────
export interface SlaRecord {
  id: number;
  support_window_code: string | null;
  availability_pct: number | null;
  restoration_hours: number | null;
  delivery_days: number | null;
  priority_model_raw: string | null;
  sla_note_raw: string | null;
  source_field: string | null;
  flavour_code: string | null;
  flavour_title: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlaResponse {
  service_id: string;
  sla_summary: {
    sla_availability: number | null;
    sla_restoration: number | null;
    sla_delivery: number | null;
  };
  sla_records: SlaRecord[];
}

// ── C3 Mapping (GET /api/v1/taxonomy/mapping/:serviceId) ─────────────────────
export interface ServiceC3Mapping {
  id: number;
  service_id: string | number;
  c3_uuid: string;
  mapping_type_code: string;
  is_primary: boolean;
  mapping_note: string | null;
  pace_code: string | null;
  c3_synced_at: string | null;
  c3_sync_status: string | null;
}

export interface ReadinessRuleException {
  id?: number | null;
  rule_key?: string;
  reason: string | null;
  expires_at: string | null;
  approved_by?: string | null;
  created_at?: string | null;
  expired?: boolean;
}

export interface ReadinessRuleResult {
  rule_key: string;
  title: string;
  description?: string | null;
  title_text?: string | null;
  why_text?: string | null;
  howto_text?: string | null;
  evidence_hint?: string | null;
  status: 'passed' | 'failed' | 'exception' | 'disabled' | 'skipped' | string;
  severity: 'P0' | 'P1' | 'P2' | 'info' | string;
  blocking: boolean;
  enabled?: boolean;
  message: string;
  exception: ReadinessRuleException | null;
}

export interface ServiceReadiness {
  service_pk: number;
  service_id: string;
  title: string;
  service_status: string | null;
  primary_mapping_count: number;
  primary_c3_uuid: string | null;
  primary_c3_title: string | null;
  primary_c3_code: string | null;
  primary_c3_completeness_status: 'complete' | 'partial' | 'incomplete';
  primary_c3_app_count: number;
  primary_c3_data_object_count: number;
  primary_c3_tin_count: number;
  primary_c3_c3_service_count: number;
  primary_c3_service_mapping_count: number;
  active_flavour_count: number;
  relation_count: number;
  dependency_relation_count: number;
  has_single_primary_mapping: boolean;
  has_complete_primary_capability: boolean;
  has_active_flavour: boolean;
  is_publishable: boolean;
  blockers: string[];
  warnings: string[];
  rules?: ReadinessRuleResult[];
}

// ── Graph (GET /api/v1/services/:id/graph) ───────────────────────────────────
export interface GraphNode {
  service_id: string;
  title: string;
  service_type: string | null;
  service_status: string | null;
  portfolio_group: string | null;
  sla_availability: number | null;
  graph_x: number | null;
  graph_y: number | null;
}

export interface GraphEdge {
  from_service_id: string;
  to_service_id: string;
  relation_type: string;
  relation_label: string | null;
  is_mandatory: boolean;
  impact_level: string | null;
  pace_code: string | null;
  is_verified: boolean;
  parse_confidence: number | null;
  relation_note: string | null;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ServiceGraphV2Node {
  [key: string]: unknown;
  id: string;
  node_kind:
    | 'service'
    | 'flavour'
    | 'c3_capability'
    | 'c3_application'
    | 'c3_tin'
    | 'c3_data_object'
    | 'c3_service';
  label: string;
  code: string | null;
  status: string | null;
  service_id?: string | null;
  service_type?: string | null;
  portfolio_group?: string | null;
  graph_x?: number | null;
  graph_y?: number | null;
  is_root?: boolean;
  c3_uuid?: string | null;
  item_type?: string | null;
  completeness_status?: string | null;
  entity_uuid?: string | null;
  price_label?: string | null;
}

export interface ServiceGraphV2Edge {
  id: string;
  source: string;
  target: string;
  edge_kind:
    | 'service_relation'
    | 'service_flavour'
    | 'service_c3_mapping'
    | 'capability_application'
    | 'capability_tin'
    | 'capability_data_object'
    | 'capability_c3_service'
    | 'tin_application'
    | 'tin_data_object'
    | 'tin_c3_service';
  relation_type: string;
  relation_label?: string | null;
  is_primary?: boolean;
  is_mandatory?: boolean;
  impact_level?: string | null;
  pace_code?: string | null;
  is_verified?: boolean;
  parse_confidence?: number | null;
  relation_note?: string | null;
}

export interface ServiceGraphV2Response {
  mode: 'v2';
  root_service_id: string;
  readiness: ServiceReadiness | null;
  nodes: ServiceGraphV2Node[];
  edges: ServiceGraphV2Edge[];
}

export interface C3RelationGraphNode {
  [key: string]: unknown;
  id: string;
  node_kind: 'c3_capability' | 'c3_application' | 'c3_tin' | 'c3_data_object' | 'c3_service';
  label: string;
  code: string | null;
  status: string | null;
  item_type?: string | null;
  completeness_status?: string | null;
  c3_uuid?: string | null;
  entity_uuid?: string | null;
}

export interface C3RelationGraphEdge {
  id: string;
  source: string;
  target: string;
  edge_kind:
    | 'capability_application'
    | 'capability_tin'
    | 'capability_data_object'
    | 'capability_c3_service'
    | 'tin_application'
    | 'tin_data_object'
    | 'tin_c3_service';
  relation_type: string;
}

export interface C3RelationGraphResponse {
  nodes: C3RelationGraphNode[];
  edges: C3RelationGraphEdge[];
}

export interface GraphOverviewNode {
  id: string;
  node_kind:
    | 'service'
    | 'c3_capability'
    | 'c3_application'
    | 'c3_tin'
    | 'c3_data_object'
    | 'c3_service';
  title: string;
  code?: string | null;
  status?: string | null;
  service_id: string | null;
  c3_uuid: string | null;
  service_type: string | null;
  service_status: string | null;
  portfolio_group: string | null;
  available_on: string | null;
  sla_availability: number | null;
  graph_x: number | null;
  graph_y: number | null;
  item_type: string | null;
  parent_uuid: string | null;
  entity_uuid?: string | null;
  completeness_status?: string | null;
}

export interface GraphOverviewEdge {
  id: string;
  source: string;
  target: string;
  edge_kind:
    | 'service_relation'
    | 'service_c3_mapping'
    | 'c3_parent'
    | 'capability_application'
    | 'capability_tin'
    | 'capability_data_object'
    | 'capability_c3_service'
    | 'tin_application'
    | 'tin_data_object'
    | 'tin_c3_service';
  relation_type: string;
  relation_label: string | null;
  mapping_type_code: string | null;
  is_mandatory: boolean;
  impact_level: string | null;
  pace_code: string | null;
  is_verified: boolean;
  parse_confidence: number | null;
  relation_note: string | null;
}

export interface GraphOverviewResponse {
  nodes: GraphOverviewNode[];
  edges: GraphOverviewEdge[];
}

// ── Dashboard (GET /api/v1/stats/dashboard) ──────────────────────────────────
export interface DashboardSummary {
  total_services: number;
  active_services: number;
  draft_services: number;
  deprecated_services: number;
  retired_services: number;
  requestable_services: number;
  total_relations: number;
  total_flavours: number;
}

export interface DashboardResponse {
  summary: DashboardSummary;
  by_type: Array<{ service_type: string; count: number }>;
  by_portfolio: Array<{ portfolio_group: string; count: number }>;
  by_domain: Array<{ domain_code: string; service_count: number }>;
  by_owner: Array<{ display_name: string; email: string | null; service_count: number }>;
  expensive_flavours: Array<{
    service_id: string;
    flavour_code: string;
    flavour_title: string;
    service_unit: string | null;
    price_value: number | null;
    currency_code: string | null;
  }>;
  c3_coverage: Array<{
    item_type: string;
    total_count: number;
    mapped_count: number;
  }>;
  by_lifecycle: Array<{ lifecycle_state: string; count: number }>;
  _cached: boolean;
}

export interface CompletenessItem {
  id: number;
  service_id: string;
  title: string;
  service_type: string | null;
  service_status: string | null;
  portfolio_group: string | null;
  summary: string | null;
  completeness_score: number | null;
  sla_availability: number | null;
  updated_at: string;
  has_c3_mapping: number | boolean;
  flavour_count: number;
}

export interface DashboardHeadlineKpi {
  key: 'services_count' | 'publishable_readiness_percent' | 'top_framework_coverage_percent';
  label: string;
  value: number;
  unit: 'count' | 'percent';
  hint: string;
}

export interface DashboardHeadlineResponse {
  kpis: DashboardHeadlineKpi[];
  _cached: boolean;
}

export interface DashboardInboxItem {
  id: string;
  type: 'service_review' | 'c3_mapping_gap' | 'pricing_gap' | string;
  title: string;
  description: string;
  href: string;
  severity: 'info' | 'warning' | 'danger';
  created_at: string | null;
}

export interface DashboardOwnedService {
  service_id: string;
  title: string;
  service_status: string | null;
  lifecycle_stage_code: string | null;
  completeness_score: number | null;
  next_review_due_at: string | null;
  updated_at: string | null;
}

export interface DashboardReviewAssignment {
  id: number;
  service_id: string;
  service_title: string;
  review_type: string;
  status: string;
  assigned_to: string | null;
  due_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DashboardDecisionItem {
  id: number;
  service_id: string;
  service_title: string;
  decision_type: string;
  decision: string;
  rationale: string | null;
  decided_by: string | null;
  decided_at: string | null;
}

export interface DashboardInboxResponse {
  items: DashboardInboxItem[];
  my_owned_services?: DashboardOwnedService[];
  my_reviews?: DashboardReviewAssignment[];
  my_blockers?: DashboardInboxItem[];
  my_decisions?: DashboardDecisionItem[];
}

export interface NotificationItem {
  id: number;
  notification_type: string;
  severity: 'info' | 'success' | 'warning' | 'danger' | string;
  title: string;
  body: string | null;
  href: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  dismissed_at: string | null;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unread_count: number;
  total: number;
  generated_at: string;
}

export interface ServiceRequestItem {
  id: number;
  request_number: string;
  service_id: string | null;
  service_pk: number | null;
  service_title: string | null;
  offering_id: number | null;
  offering_title: string | null;
  status: string;
  request_channel_type: string | null;
  request_channel_url: string | null;
  external_ticket_ref: string | null;
  external_ticket_url: string | null;
  request_note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ServiceRequestResponse {
  item: ServiceRequestItem;
  external_redirect_url: string | null;
}

export interface Service360Response {
  service: ServiceDetail | null;
  overview: ServiceOverview | null;
  relationships: {
    relations: ServiceRelation[];
    c3_mappings: unknown[];
    dependency_summary: ServiceOverview['dependencies'] | null;
    capability_mappings: ServiceOverview['capability_mappings'];
  };
  readiness: ServiceReadiness | null;
  lifecycle: ServiceOverview['lifecycle'];
  generated_at: string;
}

export interface DashboardDecisionSummary {
  total_services: number;
  services_ready_for_publish: number;
  services_blocked_by_readiness: number;
  overdue_reviews: number;
  uncovered_capabilities: number;
  over_covered_capabilities: number;
  active_governance_reviews: number;
  recent_decisions: number;
}

export interface DashboardDecisionSummaryResponse {
  generated_at?: string;
  summary: DashboardDecisionSummary;
  links: {
    governance_health: string;
    readiness_queue: string;
    capability_coverage: string;
    review_deadlines: string;
    owner_load: string;
    recent_decisions: string;
  };
}

export interface OperationsResponse {
  summary: DashboardSummary;
  sections: {
    incomplete_metadata: CompletenessItem[];
    missing_owners: Array<Pick<CompletenessItem, 'service_id' | 'title' | 'service_status' | 'updated_at'>>;
    top_completeness: CompletenessItem[];
    deprecated_retired: CompletenessItem[];
    pricing_patrol: {
      total_services: number;
      with_pricing: number;
      coverage_percent: number;
      missing: CompletenessItem[];
    };
    c3_mapping_gap: Array<{
      item_type: string;
      total_count: number;
      mapped_count: number;
      gap_count: number;
    }>;
  };
}

export interface ServiceFrameworkCoverage {
  framework_code: string;
  title: string;
  capability_slug: string | null;
  spiral_code: string | null;
  coverage_percent: number;
  core_total: number;
  core_covered: number;
  missing_core: Array<{ code: string; title: string; kind: string }>;
}
