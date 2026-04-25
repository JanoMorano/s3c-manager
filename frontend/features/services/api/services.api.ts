import { clearAuthSession, refreshAuthSession, restoreAuthSession } from '@/features/auth/authStore';

async function tryRefresh(): Promise<boolean> {
  try {
    const refreshed = await refreshAuthSession();
    if (!refreshed) { clearAuthSession(); return false; }
    await restoreAuthSession(true);
    return true;
  } catch {
    clearAuthSession();
    return false;
  }
}

/** Returns the Authorization header for fetch() mutations in editor.api.ts and admin pages. */
export function authHeaders(): Record<string, string> {
  return {};
}

import type {
  ServiceListResponse,
  ServiceDetail,
  ServiceOffering,
  ServiceSupportModel,
  ServiceAudiencePolicy,
  ServiceOperationalLink,
  SlaResponse,
  GraphResponse,
} from '../model/service.types';

const BASE = '/api/v1';

function buildApiRequestInit(extraHeaders: Record<string, string> = {}) {
  return {
    cache: 'no-store' as const,
    credentials: 'include' as const,
    headers: {
      ...authHeaders(),
      ...extraHeaders,
    },
  };
}

// Generic fetcher for SWR — throws on non-OK responses
export async function apiFetch<T>(url: string): Promise<T> {
  let res = await fetch(url, buildApiRequestInit());
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await fetch(url, buildApiRequestInit());
    } else {
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Unauthorized');
    }
  }
  if (res.status === 304) {
    res = await fetch(url, buildApiRequestInit({ 'Cache-Control': 'no-cache' }));
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Services list ────────────────────────────────────────────────────────────
export type SortField = 'service_id' | 'title' | 'service_status' | 'service_type' | 'portfolio_group' | 'updated_at';
export type SortOrder = 'ASC' | 'DESC';

export interface ListParams {
  search?: string;
  status?: string;       // comma-separated
  type?: string;
  portfolio?: string;
  domain?: string;
  lifecycle?: string;    // comma-separated lifecycle states
  requestable?: boolean;
  page?: number;
  limit?: number;
  sort?: SortField;
  order?: SortOrder;
}

export function buildListUrl(params: ListParams = {}): string {
  const q = new URLSearchParams();
  if (params.search)               q.set('search',          params.search);
  if (params.status)               q.set('status',          params.status);
  if (params.type)                 q.set('service_type',    params.type);
  if (params.portfolio)            q.set('portfolio_group', params.portfolio);
  if (params.domain)               q.set('domain',          params.domain);
  if (params.lifecycle)            q.set('lifecycle_state', params.lifecycle);
  if (params.requestable != null)  q.set('requestable',     String(params.requestable));
  if (params.page)                 q.set('page',            String(params.page));
  if (params.limit)                q.set('limit',           String(params.limit));
  if (params.sort)                 q.set('sort',            params.sort);
  if (params.order)                q.set('order',           params.order);
  const qs = q.toString();
  return `${BASE}/services${qs ? `?${qs}` : ''}`;
}

export function buildListCsvExportUrl(params: ListParams = {}): string {
  const listUrl = buildListUrl(params);
  return listUrl.replace('/api/v1/services', '/api/v1/services/export/csv');
}

export const fetchServices = (params?: ListParams) =>
  apiFetch<ServiceListResponse>(buildListUrl(params));

// ── Service detail ───────────────────────────────────────────────────────────
export const fetchService = (id: string) =>
  apiFetch<ServiceDetail>(`${BASE}/services/${id}`);

export const fetchServiceOfferings = (id: string) =>
  apiFetch<{ items: ServiceOffering[] }>(`${BASE}/services/${id}/offerings`);

export const fetchServiceSupportModel = (id: string) =>
  apiFetch<{ items: ServiceSupportModel[] }>(`${BASE}/services/${id}/support-model`);

export const fetchServiceAudience = (id: string) =>
  apiFetch<{ items: ServiceAudiencePolicy[] }>(`${BASE}/services/${id}/audience`);

export const fetchServiceOperationalLinks = (id: string) =>
  apiFetch<{ items: ServiceOperationalLink[] }>(`${BASE}/services/${id}/operational-links`);

export const fetchServiceSla = (id: string) =>
  apiFetch<SlaResponse>(`${BASE}/services/${id}/sla`);

export const fetchServiceGraph = (id: string) =>
  apiFetch<GraphResponse>(`${BASE}/services/${id}/graph`);

export function buildGraphOverviewUrl(params: { compact?: boolean; includeC3?: boolean } = {}): string {
  const q = new URLSearchParams();
  if (params.includeC3 === false) q.set('include_c3', '0');
  const base = params.compact ? `${BASE}/graph/overview/compact` : `${BASE}/graph/overview`;
  const qs = q.toString();
  return `${base}${qs ? `?${qs}` : ''}`;
}

// ── Taxonomy ─────────────────────────────────────────────────────────────────
export const fetchPortfolioGroups = () =>
  apiFetch<Array<{ code: string; name: string }>>(`${BASE}/taxonomy/portfolio-groups`);

export const fetchServiceTypes = () =>
  apiFetch<Array<{ code: string; name: string }>>(`${BASE}/taxonomy/service-types`);

export const fetchSecurityClassifications = () =>
  apiFetch<Array<{ code: string; name: string; sort_order: number | null }>>(`${BASE}/taxonomy/security-classifications`);
