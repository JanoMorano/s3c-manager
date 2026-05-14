import type { ServiceReadiness } from '@/features/services/model/service.types';

export interface GovernanceResponse<T> {
  items: T[];
  count?: number;
}

export interface OwnerLoadRow {
  owner_key: string;
  owner_name: string;
  owner_email: string | null;
  owned_services: number;
  live_services: number;
  critical_services: number;
  readiness_blockers: number;
  overdue_reviews: number;
  c3_gaps: number;
  owner_load_score: number;
}

export interface OwnerAssignmentRow {
  assignment_id: number;
  owner_key: string;
  display_name: string;
  email: string | null;
  organization_name: string | null;
  role_code: string;
  role_name: string | null;
  service_pk: number;
  service_id: string;
  service_title: string;
  service_status_code: string | null;
  lifecycle_state: string | null;
  valid_from: string | null;
  valid_to: string | null;
}

export interface GovernanceFilters {
  severity?: string;
  type?: string;
  owner?: string;
  scope?: string;
  serviceId?: string;
  assignedTo?: string;
  mine?: boolean;
  overdue?: boolean;
  status?: string;
  decision?: string;
  decisionType?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface GovernanceReview {
  id: number;
  service_id: string;
  service_title: string;
  review_type: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'deferred' | 'cancelled' | string;
  requested_by: string | null;
  assigned_to: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  overdue?: boolean;
}

export interface GovernanceDecision {
  id: number;
  service_id: string;
  service_title: string;
  decision_type: string;
  decision: 'approved' | 'rejected' | 'deferred' | 'cancelled' | string;
  rationale: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string | null;
}

export interface ReadinessSummaryResponse {
  items: ServiceReadiness[];
  groups: {
    blockers: ServiceReadiness[];
    warnings: ServiceReadiness[];
    ready: ServiceReadiness[];
  };
  counts: {
    total: number;
    blockers: number;
    warnings: number;
    ready: number;
  };
}
