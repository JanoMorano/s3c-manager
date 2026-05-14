import useSWR from 'swr';
import { apiFetch, buildGraphOverviewUrl, buildListUrl } from '../api/services.api';
import type { ListParams } from '../api/services.api';
import type {
  ServiceListResponse,
  CatalogQualityResponse,
  PortfolioListResponse,
  PortfolioCapabilityListResponse,
  PortfolioServiceScopeResponse,
  ServiceDetail,
  ServiceOverviewResponse,
  SlaResponse,
  GraphResponse,
  ServiceGraphV2Response,
  GraphOverviewResponse,
  C3RelationGraphResponse,
  DashboardResponse,
  DashboardHeadlineResponse,
  DashboardInboxResponse,
  DashboardDecisionSummaryResponse,
  OperationsResponse,
  CompletenessItem,
  ServiceFrameworkCoverage,
  ServiceScoreResponse,
  ServiceHistoryEntry,
  ServiceRoleAssignment,
  ServiceReadiness,
  ServiceOffering,
  ServiceSupportModel,
  ServiceAudiencePolicy,
  ServiceOperationalLink,
  ImpactResponse,
  Service360Response,
} from '../model/service.types';

// ── Services list ────────────────────────────────────────────────────────────
export function useServices(params: ListParams = {}) {
  const key = buildListUrl(params);
  return useSWR<ServiceListResponse>(key, apiFetch, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });
}

export function useCatalogQualitySummary() {
  return useSWR<CatalogQualityResponse>('/api/v1/services/catalog-quality', apiFetch, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  });
}

export function usePortfolioList() {
  return useSWR<PortfolioListResponse>('/api/v1/portfolio', apiFetch, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  });
}

export function usePortfolioCapabilities() {
  return useSWR<PortfolioCapabilityListResponse>('/api/v1/portfolio/capabilities', apiFetch, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  });
}

export function usePortfolioServiceScope(
  filter: 'all' | 'active' | 'planned' | 'retiring' | 'requestable' | 'overdue' | 'due_soon' | 'missing_owner' | 'readiness_blocked' = 'all',
) {
  const query = filter === 'all' ? '' : `?filter=${encodeURIComponent(filter)}`;
  return useSWR<PortfolioServiceScopeResponse>(`/api/v1/portfolio/services${query}`, apiFetch, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
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

export function useServiceOverview(id: string | null) {
  return useSWR<ServiceOverviewResponse>(
    id ? `/api/v1/services/${id}/overview` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

export function useService360(id: string | null) {
  return useSWR<Service360Response>(
    id ? `/api/v1/services/${id}/360` : null,
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

export function useServiceFrameworks(id: string | null) {
  return useSWR<ServiceFrameworkCoverage[]>(
    id ? `/api/v1/services/${id}/frameworks` : null,
    apiFetch,
    { revalidateOnFocus: false }
  );
}

export function useGraphOverview(options: { compact?: boolean; includeC3?: boolean } = {}) {
  return useSWR<GraphOverviewResponse>(
    buildGraphOverviewUrl(options),
    apiFetch,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
}

export function useC3RelationGraph(params: { search?: string; itemType?: string; domainCode?: string; l3PageId?: string; enabled?: boolean } = {}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.itemType) q.set('item_type', params.itemType);
  if (params.domainCode) q.set('domain_code', params.domainCode);
  if (params.l3PageId) q.set('l3_page_id', params.l3PageId);
  const key = params.enabled === false
    ? null
    : `/api/v1/graph/c3-relations${q.toString() ? `?${q.toString()}` : ''}`;
  return useSWR<C3RelationGraphResponse>(key, apiFetch, {
    revalidateOnFocus: false,
  });
}

export function useServiceImpact(params: {
  serviceId?: string | null;
  direction?: 'downstream' | 'upstream';
  depth?: number;
  include?: string[];
  enabled?: boolean;
} = {}) {
  const q = new URLSearchParams();
  q.set('direction', params.direction ?? 'downstream');
  q.set('depth', String(params.depth ?? 3));
  if (params.include?.length) q.set('include', params.include.join(','));
  const key = params.enabled === false || !params.serviceId
    ? null
    : `/api/v1/impact/services/${encodeURIComponent(params.serviceId)}?${q.toString()}`;
  return useSWR<ImpactResponse>(key, apiFetch, {
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

export function useDashboardHeadline() {
  return useSWR<DashboardHeadlineResponse>('/api/v1/stats/dashboard-headline', apiFetch, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });
}

export function useDashboardInbox() {
  return useSWR<DashboardInboxResponse>('/api/v1/dashboard/inbox', apiFetch, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });
}

export function useDashboardSummary() {
  return useSWR<DashboardDecisionSummaryResponse>('/api/v1/dashboard/summary', apiFetch, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });
}

export function useOperationsDashboard() {
  return useSWR<OperationsResponse>('/api/v1/stats/operations', apiFetch, {
    refreshInterval: 120_000,
    revalidateOnFocus: false,
  });
}

// ── Completeness / audit list ─────────────────────────────────────────────────
export type { CompletenessItem };

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
