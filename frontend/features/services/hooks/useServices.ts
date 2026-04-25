import useSWR from 'swr';
import { apiFetch, buildGraphOverviewUrl, buildListUrl } from '../api/services.api';
import type { ListParams } from '../api/services.api';
import type {
  ServiceListResponse,
  ServiceDetail,
  SlaResponse,
  GraphResponse,
  ServiceGraphV2Response,
  GraphOverviewResponse,
  C3RelationGraphResponse,
  DashboardResponse,
  ServiceScoreResponse,
  ServiceHistoryEntry,
  ServiceRoleAssignment,
  ServiceReadiness,
  ServiceOffering,
  ServiceSupportModel,
  ServiceAudiencePolicy,
  ServiceOperationalLink,
} from '../model/service.types';

// ── Services list ────────────────────────────────────────────────────────────
export function useServices(params: ListParams = {}) {
  const key = buildListUrl(params);
  return useSWR<ServiceListResponse>(key, apiFetch, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
}

// ── Service detail ───────────────────────────────────────────────────────────
export function useService(id: string | null) {
  return useSWR<ServiceDetail>(
    id ? `/api/v1/services/${id}` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

export function useServiceOfferings(id: string | null) {
  return useSWR<{ items: ServiceOffering[] }>(
    id ? `/api/v1/services/${id}/offerings` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

export function useServiceSupportModel(id: string | null) {
  return useSWR<{ items: ServiceSupportModel[] }>(
    id ? `/api/v1/services/${id}/support-model` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

export function useServiceAudience(id: string | null) {
  return useSWR<{ items: ServiceAudiencePolicy[] }>(
    id ? `/api/v1/services/${id}/audience` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

export function useServiceOperationalLinks(id: string | null) {
  return useSWR<{ items: ServiceOperationalLink[] }>(
    id ? `/api/v1/services/${id}/operational-links` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

// ── SLA ──────────────────────────────────────────────────────────────────────
export function useServiceSla(id: string | null) {
  return useSWR<SlaResponse>(
    id ? `/api/v1/services/${id}/sla` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

// ── Graph ─────────────────────────────────────────────────────────────────────
export function useServiceGraph(id: string | null, depth: number = 2, mode: 'legacy' | 'v2' = 'legacy') {
  return useSWR<GraphResponse | ServiceGraphV2Response>(
    id ? `/api/v1/services/${id}/graph?depth=${depth}${mode === 'v2' ? '&mode=v2' : ''}` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

export function useServiceReadiness(id: string | null) {
  return useSWR<ServiceReadiness>(
    id ? `/api/v1/services/${id}/readiness` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

export function useGraphOverview(options: { compact?: boolean; includeC3?: boolean } = {}) {
  return useSWR<GraphOverviewResponse>(
    buildGraphOverviewUrl(options),
    apiFetch,
    { revalidateOnFocus: false }
  );
}

export function useC3RelationGraph(params: { search?: string; itemType?: string; domainCode?: string; l3PageId?: string; enabled?: boolean } = {}) {
  if (params.enabled === false) {
    return useSWR<C3RelationGraphResponse>(null, apiFetch, {
      revalidateOnFocus: false,
    });
  }
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.itemType) q.set('item_type', params.itemType);
  if (params.domainCode) q.set('domain_code', params.domainCode);
  if (params.l3PageId) q.set('l3_page_id', params.l3PageId);
  const key = `/api/v1/graph/c3-relations${q.toString() ? `?${q.toString()}` : ''}`;
  return useSWR<C3RelationGraphResponse>(key, apiFetch, {
    revalidateOnFocus: false,
  });
}

// ── Score / Completeness detail ───────────────────────────────────────────────
export function useServiceScore(id: string | null) {
  return useSWR<ServiceScoreResponse>(
    id ? `/api/v1/services/${id}/score` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

// ── History ───────────────────────────────────────────────────────────────────
export function useServiceHistory(id: string | null) {
  return useSWR<ServiceHistoryEntry[]>(
    id ? `/api/v1/services/${id}/history` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

// ── Role Assignments ──────────────────────────────────────────────────────────
export function useServiceRoles(id: string | null) {
  return useSWR<ServiceRoleAssignment[]>(
    id ? `/api/v1/services/${id}/roles` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function useDashboard() {
  return useSWR<DashboardResponse>('/api/v1/stats/dashboard', apiFetch, {
    refreshInterval: 60_000,  // refresh every minute
    revalidateOnFocus: false,
  });
}

// ── Completeness / audit list ─────────────────────────────────────────────────
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
  has_c3_mapping: number;
  flavour_count: number;
}

export function useCompleteness() {
  return useSWR<CompletenessItem[]>('/api/v1/stats/completeness', apiFetch, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  });
}

// ── Taxonomy ──────────────────────────────────────────────────────────────────
export function usePortfolioGroups() {
  return useSWR<Array<{ code: string; name: string }>>(
    '/api/v1/taxonomy/portfolio-groups',
    apiFetch,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );
}

export function useServiceTypes() {
  return useSWR<Array<{ code: string; name: string }>>(
    '/api/v1/taxonomy/service-types',
    apiFetch,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );
}

export function useSecurityClassifications() {
  return useSWR<Array<{ code: string; name: string; sort_order: number | null }>>(
    '/api/v1/taxonomy/security-classifications',
    apiFetch,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );
}

export function useServiceLines() {
  return useSWR<Array<{ code: string; name: string; global_service_group_code: string | null; sort_order: number | null }>>(
    '/api/v1/taxonomy/service-lines',
    apiFetch,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );
}

export function useNetworkDomains() {
  return useSWR<Array<{ code: string; name: string; color_hex: string | null; sort_order: number | null }>>(
    '/api/v1/taxonomy/domains',
    apiFetch,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );
}

export function useOrganizationalElements() {
  return useSWR<Array<{ code: string; name: string; sort_order: number | null }>>(
    '/api/v1/taxonomy/organizational-elements',
    apiFetch,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );
}

export function useGlobalServiceGroups() {
  return useSWR<Array<{ code: string; name: string; sort_order: number | null }>>(
    '/api/v1/taxonomy/global-service-groups',
    apiFetch,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );
}

// ── Service C3 Mappings ───────────────────────────────────────────────────────
export interface ServiceC3Mapping {
  id: number;
  c3_uuid: string;
  mapping_type_code: string | null;
  mapping_type_name: string | null;
  pace_code: string | null;
  pace_name: string | null;
  c3_level: number | null;
  c3_domain: string | null;
  c3_source: string | null;
  is_primary: boolean;
  mapping_note: string | null;
  synced_at: string | null;
  sync_status: string | null;
  c3_title: string | null;
  c3_external_id: string | null;
  c3_item_type: string | null;
  c3_item_status: string | null;
  c3_short_title: string | null;
}

export function useServiceC3Mappings(id: string | null) {
  return useSWR<{ mappings: ServiceC3Mapping[] }>(
    id ? `/api/v1/services/${id}/c3-mappings` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

// ── C3 Taxonomy ───────────────────────────────────────────────────────────────
export interface C3TaxonomyItem {
  uuid: string;
  application: string | null;
  title: string | null;
}

export function useC3Taxonomy() {
  return useSWR<C3TaxonomyItem[]>('/api/v1/taxonomy/c3', apiFetch, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000,
  });
}
