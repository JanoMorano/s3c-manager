import useSWR from 'swr';
import { apiFetch } from '@/features/services/api/services.api';
import type {
  AdvisorFinding,
  ContractOverlapRow,
  GovernanceDecision,
  GovernanceFilters,
  GovernanceResponse,
  GovernanceReview,
  OwnerAssignmentRow,
  OwnerLoadRow,
  ReadinessSummaryResponse,
  RenewalRiskRow,
  ServiceRiskFinding,
} from '../types';

function buildUrl(path: string, filters: GovernanceFilters = {}) {
  const q = new URLSearchParams();
  if (filters.severity) q.set('severity', filters.severity);
  if (filters.type) q.set('type', filters.type);
  if (filters.owner) q.set('owner', filters.owner);
  if (filters.scope) q.set('scope', filters.scope);
  if (filters.serviceId) q.set('service_id', filters.serviceId);
  if (filters.assignedTo) q.set('assigned_to', filters.assignedTo);
  if (filters.status) q.set('status', filters.status);
  if (filters.decision) q.set('decision', filters.decision);
  if (filters.decisionType) q.set('decision_type', filters.decisionType);
  if (filters.q) q.set('q', filters.q);
  if (filters.limit) q.set('limit', String(filters.limit));
  if (filters.offset) q.set('offset', String(filters.offset));
  const qs = q.toString();
  return `/api/v1/governance/${path}${qs ? `?${qs}` : ''}`;
}

const swrOptions = {
  refreshInterval: 120_000,
  revalidateOnFocus: false,
};

export function useServiceRiskRadar(filters: GovernanceFilters = {}) {
  return useSWR<GovernanceResponse<ServiceRiskFinding>>(
    buildUrl('risk-radar', filters),
    apiFetch,
    swrOptions
  );
}

export function useOwnerLoad(filters: GovernanceFilters = {}) {
  return useSWR<GovernanceResponse<OwnerLoadRow>>(
    buildUrl('owner-load', filters),
    apiFetch,
    swrOptions
  );
}

export function useOwnerAssignments(filters: GovernanceFilters = {}) {
  return useSWR<GovernanceResponse<OwnerAssignmentRow>>(
    filters.owner ? buildUrl('owner-load/assignments', filters) : null,
    apiFetch,
    swrOptions
  );
}

export function useContractOverlap(filters: GovernanceFilters = {}) {
  return useSWR<GovernanceResponse<ContractOverlapRow>>(
    buildUrl('contract-overlap', filters),
    apiFetch,
    swrOptions
  );
}

export function useRenewalCalendar(filters: GovernanceFilters = {}) {
  return useSWR<GovernanceResponse<RenewalRiskRow>>(
    buildUrl('renewal-calendar', filters),
    apiFetch,
    swrOptions
  );
}

export function useGovernanceAdvisor(filters: GovernanceFilters = {}) {
  return useSWR<GovernanceResponse<AdvisorFinding>>(
    buildUrl('advisor', filters),
    apiFetch,
    swrOptions
  );
}

export function useReadinessSummary(filters: Pick<GovernanceFilters, 'limit' | 'offset' | 'owner'> & { lifecycle?: string } = {}) {
  const q = new URLSearchParams();
  if (filters.limit) q.set('limit', String(filters.limit));
  if (filters.offset) q.set('offset', String(filters.offset));
  if (filters.owner) q.set('owner', filters.owner);
  if (filters.lifecycle) q.set('lifecycle', filters.lifecycle);
  const qs = q.toString();
  return useSWR<ReadinessSummaryResponse>(
    `/api/v1/readiness/summary${qs ? `?${qs}` : ''}`,
    apiFetch,
    swrOptions
  );
}

export function useGovernanceReviews(filters: GovernanceFilters = {}) {
  return useSWR<GovernanceResponse<GovernanceReview>>(
    buildUrl('reviews', filters),
    apiFetch,
    swrOptions
  );
}

export function useGovernanceDecisions(filters: GovernanceFilters = {}) {
  return useSWR<GovernanceResponse<GovernanceDecision>>(
    buildUrl('decisions', filters),
    apiFetch,
    swrOptions
  );
}
