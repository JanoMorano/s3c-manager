import { createContext } from 'react';

/**
 * Editor tabs. Each tab shows its sections; the other tabs stay mounted but
 * hidden so unsaved form values and validation are kept.
 */
export const EDITOR_TABS: { id: string; sections: string[]; adminOnly?: boolean }[] = [
  { id: 'identity', sections: ['identity', 'value-scope'] },
  { id: 'offerings-sla', sections: ['request-access', 'offerings', 'availability-relations', 'audience', 'flavours'] },
  { id: 'ownership-support', sections: ['ownership-support', 'support-model', 'operational-links'] },
  { id: 'relations-c3', sections: ['relationships', 'readiness-governance'] },
  { id: 'evidence', sections: ['advanced-evidence', 'raw-fields'], adminOnly: true },
];

export function editorTabOfSection(sectionId: string): string {
  return EDITOR_TABS.find((tab) => tab.sections.includes(sectionId))?.id ?? EDITOR_TABS[0].id;
}

export const ActiveEditorTabContext = createContext<string>(EDITOR_TABS[0].id);

export const PRIMARY_EDITOR_SECTION_IDS = new Set([
  'identity',
  'value-scope',
  'request-access',
  'ownership-support',
  'availability-relations',
  'readiness-governance',
  'advanced-evidence',
]);
export const ADVANCED_DETAIL_SECTION_IDS = new Set(['flavours', 'raw-fields']);

export const SECTION_FIELD_MAP: Record<string, string[]> = {
  identity: ['title', 'service_type', 'lifecycle_stage_code', 'portfolio_group_code', 'service_line_code', 'security_classification'],
  'value-scope': ['summary', 'consumer_value', 'scope_text', 'exclusions'],
  'request-access': ['request_channel_type', 'request_channel_url', 'target_audience_summary', 'fulfillment_lead_time_text'],
  'ownership-support': ['service_owner', 'service_owner_email', 'manager'],
  'availability-relations': ['sla_availability', 'sla_restoration', 'sla_delivery', 'domains'],
  'readiness-governance': ['retired_note'],
  'advanced-evidence': ['source_url', 'notes_json'],
};
