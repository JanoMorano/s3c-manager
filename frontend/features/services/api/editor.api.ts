import { apiFetch, authHeaders } from './services.api';
import type {
  ServiceAudiencePolicy,
  ServiceDetail,
  ServiceOffering,
  ServiceOperationalLink,
  ServiceSupportModel,
} from '../model/service.types';

const BASE = '/api/v1';

// ── PUT /services/:id (main fields) ─────────────────────────────────────────
export interface ServiceUpdateBody {
  title?: string;
  service_type?: string;
  service_status?: string;
  portfolio_group_code?: string;
  global_service_group_code?: string;
  service_line_code?: string;
  organizational_element_code?: string;
  summary?: string;
  detailed_description?: string;
  value_proposition?: string;
  business_purpose?: string | null;
  service_features?: string;
  security_classification?: string;
  source_url?: string;
  unit_of_measure?: string;
  charging_basis?: string;
  rate_note?: string;
  ordering_note?: string;
  sla_availability?: number | null;
  sla_restoration?: number | null;
  sla_delivery?: number | null;
  retired_note?: string;
  notes_json?: string;
  // Item 7: narrative text fields
  scope_text?: string;
  operational_notes_raw?: string;
  sla_restoration_text?: string;
  sla_delivery_text?: string;
  // Table A gaps
  exclusions?: string;
  service_area?: string;
  customer_type?: string | null;
  business_summary?: string | null;
  requestable?: boolean | null;
  lifecycle_state?: string | null;
  target_audience_summary?: string | null;
  request_channel_type?: string | null;
  request_channel_url?: string | null;
  approval_required?: boolean | null;
  fulfillment_lead_time_text?: string | null;
  consumer_value?: string | null;
}

export async function updateService(id: string, body: ServiceUpdateBody): Promise<ServiceDetail> {
  const res = await fetch(`${BASE}/services/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT /services/${id} ${res.status}: ${text}`);
  }
  return res.json();
}

// ── PUT /services/:id/domains ────────────────────────────────────────────────
export async function updateDomains(id: string, domains: string[]): Promise<{ service_id: string; available_on: string[] }> {
  const res = await fetch(`${BASE}/services/${id}/domains`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ domains }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT /services/${id}/domains ${res.status}: ${text}`);
  }
  return res.json();
}

// ── PUT /services/:id/roles ──────────────────────────────────────────────────
export type RoleCode = 'service_owner' | 'service_area_owner' | 'service_delivery_manager';

export interface RoleUpdateBody {
  roleCode: RoleCode;
  displayName: string | null;   // null → close active record
  email?: string;
  orgName?: string;
}

export async function updateRole(id: string, body: RoleUpdateBody): Promise<{ service_id: string; service_owner: string; vlastnik: string; manager: string }> {
  const res = await fetch(`${BASE}/services/${id}/roles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT /services/${id}/roles ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Flavours CRUD ─────────────────────────────────────────────────────────────
// GET /api/v1/flavours?serviceId=WPS001
// Canonical snake_case — matches flavours.repo.js SELECT output exactly.
export interface FlavourBody {
  service_id?: string;
  title?: string;
  service_unit?: string | null;
  price_value?: number | null;
  currency_code?: string | null;
  billing_period_code?: string | null;
  initiation_cost?: number | null;
  lifecycle_cost?: number | null;
  lifetime_years?: number | null;
  nations_rate?: string | null;
  dependency_text?: string | null;
  short_note?: string | null;
  flavour_status_code?: string | null;
  pricing_note_raw?: string | null;
  display_order?: number | null;
  is_orderable?: boolean;
  delivery_note?: string | null;
  technical_note?: string | null;
}

/** Read-only record returned by the middleware — same shape as ServiceFlavour in service.types.ts */
export interface FlavourRecord {
  id: number;
  flavour_code: string;
  service_id: string;
  title: string;
  service_unit: string | null;
  price_value: number | null;
  currency_code: string | null;
  billing_period_code: string | null;
  initiation_cost: number | null;
  lifecycle_cost: number | null;
  lifetime_years: number | null;
  nations_rate: string | null;
  dependency_text: string | null;
  short_note: string | null;
  flavour_status_code: string | null;
  pricing_note_raw: string | null;
  display_order: number | null;
  is_orderable: boolean;
  delivery_note: string | null;
  technical_note: string | null;
  created_at: string;
  updated_at: string;
}

export const fetchServiceFlavours = (serviceId: string) =>
  apiFetch<FlavourRecord[]>(`${BASE}/flavours?serviceId=${encodeURIComponent(serviceId)}`);

export async function createFlavour(serviceId: string, body: FlavourBody): Promise<FlavourRecord> {
  const res = await fetch(`${BASE}/flavours`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ ...body, service_id: serviceId }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`POST /flavours ${res.status}: ${t}`); }
  return res.json();
}

export async function updateFlavour(id: number, body: FlavourBody): Promise<FlavourRecord> {
  const res = await fetch(`${BASE}/flavours/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`PUT /flavours/${id} ${res.status}: ${t}`); }
  return res.json();
}

export async function deleteFlavour(id: number): Promise<void> {
  const res = await fetch(`${BASE}/flavours/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) { const t = await res.text(); throw new Error(`DELETE /flavours/${id} ${res.status}: ${t}`); }
}

// ── Service Offerings CRUD ───────────────────────────────────────────────────
export interface ServiceOfferingBody {
  offering_code?: string;
  title?: string;
  description?: string | null;
  is_default?: boolean;
  requestable?: boolean;
  approval_required?: boolean | null;
  request_channel_type?: string | null;
  request_channel_url?: string | null;
  lead_time_text?: string | null;
  support_tier_code?: string | null;
  status?: string;
  display_order?: number | null;
}

export const fetchServiceOfferingsEditor = async (serviceId: string): Promise<ServiceOffering[]> => {
  const response = await apiFetch<{ items: ServiceOffering[] }>(`${BASE}/services/${serviceId}/offerings`);
  return response.items ?? [];
};

export async function createOffering(serviceId: string, body: ServiceOfferingBody): Promise<ServiceOffering> {
  const res = await fetch(`${BASE}/services/${serviceId}/offerings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`POST /services/${serviceId}/offerings ${res.status}: ${t}`); }
  return res.json();
}

export async function updateOffering(serviceId: string, offeringId: number, body: ServiceOfferingBody): Promise<ServiceOffering> {
  const res = await fetch(`${BASE}/services/${serviceId}/offerings/${offeringId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`PUT /services/${serviceId}/offerings/${offeringId} ${res.status}: ${t}`); }
  return res.json();
}

export async function deleteOffering(serviceId: string, offeringId: number): Promise<void> {
  const res = await fetch(`${BASE}/services/${serviceId}/offerings/${offeringId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`DELETE /services/${serviceId}/offerings/${offeringId} ${res.status}: ${t}`); }
}

// ── Support Model replace ────────────────────────────────────────────────────
export interface ServiceSupportModelBody {
  offering_id?: number | null;
  support_owner_name?: string | null;
  resolver_group?: string | null;
  support_hours_code?: string | null;
  support_channel?: string | null;
  escalation_path?: string | null;
  maintenance_window?: string | null;
  review_cadence?: string | null;
}

export const fetchServiceSupportModelEditor = async (serviceId: string): Promise<ServiceSupportModel[]> => {
  const response = await apiFetch<{ items: ServiceSupportModel[] }>(`${BASE}/services/${serviceId}/support-model`);
  return response.items ?? [];
};

export async function replaceSupportModel(serviceId: string, items: ServiceSupportModelBody[]): Promise<ServiceSupportModel[]> {
  const res = await fetch(`${BASE}/services/${serviceId}/support-model`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`PUT /services/${serviceId}/support-model ${res.status}: ${t}`); }
  const data = await res.json() as { items?: ServiceSupportModel[] };
  return data.items ?? [];
}

// ── Audience Policy replace ──────────────────────────────────────────────────
export interface ServiceAudiencePolicyBody {
  offering_id?: number | null;
  audience_type?: string | null;
  business_unit?: string | null;
  region_code?: string | null;
  eligibility_rule?: string | null;
  notes?: string | null;
}

export const fetchServiceAudienceEditor = async (serviceId: string): Promise<ServiceAudiencePolicy[]> => {
  const response = await apiFetch<{ items: ServiceAudiencePolicy[] }>(`${BASE}/services/${serviceId}/audience`);
  return response.items ?? [];
};

export async function replaceAudiencePolicies(serviceId: string, items: ServiceAudiencePolicyBody[]): Promise<ServiceAudiencePolicy[]> {
  const res = await fetch(`${BASE}/services/${serviceId}/audience`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`PUT /services/${serviceId}/audience ${res.status}: ${t}`); }
  const data = await res.json() as { items?: ServiceAudiencePolicy[] };
  return data.items ?? [];
}

// ── Operational Links CRUD ───────────────────────────────────────────────────
export interface ServiceOperationalLinkBody {
  offering_id?: number | null;
  link_type?: string | null;
  title?: string;
  url?: string;
  sort_order?: number | null;
}

export const fetchServiceOperationalLinksEditor = async (serviceId: string): Promise<ServiceOperationalLink[]> => {
  const response = await apiFetch<{ items: ServiceOperationalLink[] }>(`${BASE}/services/${serviceId}/operational-links`);
  return response.items ?? [];
};

export async function createOperationalLink(serviceId: string, body: ServiceOperationalLinkBody): Promise<ServiceOperationalLink> {
  const res = await fetch(`${BASE}/services/${serviceId}/operational-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`POST /services/${serviceId}/operational-links ${res.status}: ${t}`); }
  return res.json();
}

export async function updateOperationalLink(serviceId: string, linkId: number, body: ServiceOperationalLinkBody): Promise<ServiceOperationalLink> {
  const res = await fetch(`${BASE}/services/${serviceId}/operational-links/${linkId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`PUT /services/${serviceId}/operational-links/${linkId} ${res.status}: ${t}`); }
  return res.json();
}

export async function deleteOperationalLink(serviceId: string, linkId: number): Promise<void> {
  const res = await fetch(`${BASE}/services/${serviceId}/operational-links/${linkId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`DELETE /services/${serviceId}/operational-links/${linkId} ${res.status}: ${t}`); }
}

// ── Relations CRUD ────────────────────────────────────────────────────────────
export interface RelationBody {
  from_service_id: string;
  to_service_id: string;
  relation_type: string;
  relation_label?: string;
  is_verified?: boolean;
}

export async function createRelation(body: RelationBody): Promise<{ id: number }> {
  const res = await fetch(`${BASE}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`POST /relations ${res.status}: ${t}`); }
  return res.json();
}

export async function deleteRelation(id: number): Promise<void> {
  const res = await fetch(`${BASE}/relations/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) { const t = await res.text(); throw new Error(`DELETE /relations/${id} ${res.status}: ${t}`); }
}

export interface RelationPatch {
  relation_type?: string;
  relation_label?: string;
  pace_code?: string | null;
  is_mandatory?: boolean;
  impact_mode?: string | null;
  impact_level?: string | null;
  relation_note?: string | null;
  is_verified?: boolean | null;
  is_inferred?: boolean;
}

export async function updateRelation(id: number, patch: RelationPatch): Promise<void> {
  const res = await fetch(`${BASE}/relations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`PUT /relations/${id} ${res.status}: ${t}`); }
}

// ── GET /import/batches ──────────────────────────────────────────────────────
// Matches import.repo.js listBatches() SELECT exactly:
//   id, filename, imported_by, parser_version, ok_count, warn_count,
//   error_count, row_count, created_at, notes
export interface ImportBatch {
  id: number;
  filename: string;
  imported_by: string | null;
  parser_version: string | null;
  ok_count: number;
  warn_count: number;
  error_count: number;
  row_count: number;
  imported_at: string;
  notes: string | null;
}

// Matches import.repo.js getBatchWithIssues() — extends batch with issues array.
// Issues SELECT: id, row_id, service_id, severity, issue_code, field_name, raw_value, message, created_at
export interface ImportBatchIssue {
  id: number;
  row_id: number | null;
  service_id: string | null;
  severity: string;           // 'error' | 'warn' | 'info'
  issue_code: string | null;
  field_name: string | null;
  raw_value: string | null;
  message: string;
  created_at: string;
}

export interface ImportBatchDetail extends ImportBatch {
  issues: ImportBatchIssue[];
}

export const fetchImportBatches = (limit = 50) =>
  apiFetch<ImportBatch[]>(`${BASE}/import/batches?limit=${limit}`);

export const fetchImportBatch = (id: number) =>
  apiFetch<ImportBatchDetail>(`${BASE}/import/batches/${id}`);
