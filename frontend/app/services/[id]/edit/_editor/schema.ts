import { z } from 'zod';

// ── Zod schema ───────────────────────────────────────────────────────────────
export const schema = z.object({
  title:                  z.string().min(1, 'Title is required'),
  service_type:           z.string().min(1, 'Service type is required'),
  portfolio_group_code:           z.string().optional(),
  global_service_group_code:      z.string().optional(),
  service_line_code:              z.string().optional(),
  organizational_element_code:    z.string().optional(),
  summary:                z.string().optional(),
  detailed_description:   z.string().optional(),
  service_features:       z.string().optional(),
  // Item 7: narrative text fields
  scope_text:             z.string().optional(),
  operational_notes_raw:  z.string().optional(),
  sla_restoration_text:   z.string().optional(),
  sla_delivery_text:      z.string().optional(),
  exclusions:             z.string().optional(),
  service_area:           z.string().optional(),
  security_classification:z.string().optional(),
  source_url:             z.string().url('Must be a valid URL').optional().or(z.literal('')),
  unit_of_measure:        z.string().optional(),
  charging_basis:         z.string().optional(),
  rate_note:              z.string().optional(),
  ordering_note:          z.string().optional(),
  retired_note:           z.string().optional(),
  customer_type:          z.string().optional(),
  consumer_value:         z.string().optional(),
  requestable:            z.boolean().optional(),
  lifecycle_stage_code:   z.string().optional(),
  target_audience_summary:z.string().optional(),
  request_channel_type:   z.string().optional(),
  request_channel_url:    z.string().url('Must be a valid URL').optional().or(z.literal('')),
  approval_required:      z.boolean().optional(),
  fulfillment_lead_time_text: z.string().optional(),
  // Item 13: notes_json
  notes_json:             z.string().optional(),
  sla_availability:       z.coerce.number().min(0).max(100).optional().nullable(),
  sla_restoration:        z.coerce.number().min(0).optional().nullable(),
  sla_delivery:           z.coerce.number().min(0).optional().nullable(),
  // Ownership (separate API calls)
  service_owner:          z.string().optional(),
  service_owner_email:    z.string().email().optional().or(z.literal('')),
  vlastnik:               z.string().optional(),
  manager:                z.string().optional(),
  service_owner_org:      z.string().optional(),
  vlastnik_org:           z.string().optional(),
  manager_org:            z.string().optional(),
  // Domains (separate API call)
  domains:                z.array(z.string()).optional(),
});

export type FormData = z.output<typeof schema>;

// Standard operational link types
export const OPERATIONAL_LINK_TYPES = ['knowledge', 'incidents', 'changes', 'docs', 'review', 'monitoring', 'support', 'other'];

export const OFFERING_STATUSES = ['draft', 'active', 'retired'];


export interface PreviewMappingResponse {
  read_only: boolean;
  coverage_delta_per_lvl3: Array<{
    capability_title: string;
    capability_slug: string | null;
    spiral_code: string;
    before_coverage_percent: number;
    after_coverage_percent: number;
    newly_covered_count: number;
  }>;
  newly_covered_requirements: Array<{ code: string; title: string; kind: string }>;
  potential_duplicate_coverage: Array<{ service_id: string; title: string }>;
  affected_spirals: string[];
  classification: string;
}

export interface Level3CapabilityOption {
  uuid: string;
  page_id: string | null;
  title: string;
  parent?: { title?: string | null } | null;
}

export interface C3TaxonomyCapabilityRow {
  uuid: string;
  external_id?: string | null;
  source_external_id?: string | null;
  title?: string | null;
  item_type?: string | null;
  level_num?: number | string | null;
  parent_title?: string | null;
}
