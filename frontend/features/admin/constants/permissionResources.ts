// All labels in this file (label, scopeLabel, permLabel) are i18n keys; translate them with t() at render time.
export interface ResourceDef {
  key:   string
  label: string
}

// ── Service Catalogue ─────────────────────────────────────────────────────────

export const SC_VIEW_COLUMNS: ResourceDef[] = [
  { key: 'service_id',                   label: 'permissions.sc_column.service_id' },
  { key: 'title',                         label: 'permissions.sc_column.title' },
  { key: 'short_description',             label: 'permissions.sc_column.short_description' },
  { key: 'description',                   label: 'permissions.sc_column.description' },
  { key: 'service_status_code',           label: 'permissions.sc_column.service_status_code' },
  { key: 'service_type_code',             label: 'permissions.sc_column.service_type_code' },
  { key: 'portfolio_group_code',          label: 'permissions.sc_column.portfolio_group_code' },
  { key: 'service_line_code',             label: 'permissions.sc_column.service_line_code' },
  { key: 'organizational_element_code',   label: 'permissions.sc_column.organizational_element_code' },
  { key: 'global_service_group_code',     label: 'permissions.sc_column.global_service_group_code' },
  { key: 'service_url',                   label: 'permissions.sc_column.service_url' },
  { key: 'availability_pct',              label: 'permissions.sc_column.availability_pct' },
  { key: 'domains',                       label: 'permissions.sc_column.domains' },
  { key: 'pricing_variants',              label: 'permissions.sc_column.pricing_variants' },
  { key: 'sla',                           label: 'permissions.sc_column.sla' },
  { key: 'relations',                     label: 'permissions.sc_column.relations' },
  { key: 'ownership',                     label: 'permissions.sc_column.ownership' },
  { key: 'completeness_score',            label: 'permissions.sc_column.completeness_score' },
  { key: 'c3_mapping',                    label: 'permissions.sc_column.c3_mapping' },
  { key: 'scope_text',                    label: 'permissions.sc_column.scope_text' },
  { key: 'exclusions',                    label: 'permissions.sc_column.exclusions' },
  { key: 'customer_type',                 label: 'permissions.sc_column.customer_type' },
  { key: 'operational_notes_raw',         label: 'permissions.sc_column.operational_notes_raw' },
  { key: 'extended_data',                 label: 'permissions.sc_column.extended_data' },
  { key: 'audit_history',                 label: 'permissions.sc_column.audit_history' },
]

export const SC_EDIT_COLUMNS: ResourceDef[] = [
  { key: 'title',                         label: 'permissions.sc_column.title' },
  { key: 'short_description',             label: 'permissions.sc_column.short_description' },
  { key: 'description',                   label: 'permissions.sc_column.description' },
  { key: 'scope_text',                    label: 'permissions.sc_column.scope_text' },
  { key: 'exclusions',                    label: 'permissions.sc_column.exclusions' },
  { key: 'service_status_code',           label: 'permissions.sc_column.service_status_code' },
  { key: 'service_type_code',             label: 'permissions.sc_column.service_type_code' },
  { key: 'portfolio_group_code',          label: 'permissions.sc_column.portfolio_group_code' },
  { key: 'service_line_code',             label: 'permissions.sc_column.service_line_code' },
  { key: 'organizational_element_code',   label: 'permissions.sc_column.organizational_element_code' },
  { key: 'service_url',                   label: 'permissions.sc_column.service_url' },
  { key: 'availability_pct',              label: 'permissions.sc_column.availability_pct' },
  { key: 'domains',                       label: 'permissions.sc_column.domains' },
  { key: 'pricing_variants',              label: 'permissions.sc_edit_column.pricing_variants' },
  { key: 'sla',                           label: 'permissions.sc_edit_column.sla' },
  { key: 'relations',                     label: 'permissions.sc_edit_column.relations' },
  { key: 'ownership',                     label: 'permissions.sc_edit_column.ownership' },
  { key: 'customer_type',                 label: 'permissions.sc_column.customer_type' },
  { key: 'operational_notes_raw',         label: 'permissions.sc_column.operational_notes_raw' },
  { key: 'notes_json',                    label: 'permissions.sc_edit_column.notes_json' },
]

export const SC_EDIT_REFS: ResourceDef[] = [
  { key: 'ref_ServiceStatus',         label: 'permissions.sc_ref.ref_ServiceStatus' },
  { key: 'ref_ServiceType',           label: 'permissions.sc_ref.ref_ServiceType' },
  { key: 'ref_PortfolioGroup',        label: 'permissions.sc_ref.ref_PortfolioGroup' },
  { key: 'ref_ServiceLine',           label: 'permissions.sc_ref.ref_ServiceLine' },
  { key: 'ref_NetworkDomain',         label: 'permissions.sc_ref.ref_NetworkDomain' },
  { key: 'ref_RelationType',          label: 'permissions.sc_ref.ref_RelationType' },
  { key: 'ref_SupportWindow',         label: 'permissions.sc_ref.ref_SupportWindow' },
  { key: 'ref_OrganizationalElement', label: 'permissions.sc_ref.ref_OrganizationalElement' },
]

// ── C3 Taxonomy ───────────────────────────────────────────────────────────────

export const C3_VIEW_COLUMNS: ResourceDef[] = [
  { key: 'c3_uuid',           label: 'permissions.c3_column.c3_uuid' },
  { key: 'c3_name',           label: 'permissions.c3_column.c3_name' },
  { key: 'c3_domain',         label: 'permissions.c3_column.c3_domain' },
  { key: 'c3_level',          label: 'permissions.c3_column.c3_level' },
  { key: 'c3_type',           label: 'permissions.c3_column.c3_type' },
  { key: 'c3_parent_uuid',    label: 'permissions.c3_column.c3_parent_uuid' },
  { key: 'is_primary',        label: 'permissions.c3_column.is_primary' },
  { key: 'sync_status',       label: 'permissions.c3_column.sync_status' },
  { key: 'last_synced_at',    label: 'permissions.c3_column.last_synced_at' },
  { key: 'modification_date', label: 'permissions.c3_column.modification_date' },
  { key: 'revised',           label: 'permissions.c3_column.revised' },
  { key: 'notes',             label: 'permissions.c3_column.notes' },
]

export const C3_EDIT_COLUMNS: ResourceDef[] = [
  { key: 'sync_status', label: 'permissions.c3_column.sync_status' },
  { key: 'is_primary',  label: 'permissions.c3_edit_column.is_primary' },
  { key: 'notes',       label: 'permissions.c3_column.notes' },
]

export const C3_EDIT_REFS: ResourceDef[] = [
  { key: 'c3_domain_values', label: 'permissions.c3_ref.c3_domain_values' },
  { key: 'c3_type_values',   label: 'permissions.c3_ref.c3_type_values' },
]

// ── Lookup map ────────────────────────────────────────────────────────────────

export const PERMISSION_SECTIONS = [
  {
    scope:       'service_catalogue' as const,
    scopeLabel:  'administration.groups.scope.service_catalogue',
    permission:  'view_column' as const,
    permLabel:   'permissions.section.view_column',
    resources:   SC_VIEW_COLUMNS,
  },
  {
    scope:       'service_catalogue' as const,
    scopeLabel:  'administration.groups.scope.service_catalogue',
    permission:  'edit_column' as const,
    permLabel:   'permissions.section.edit_column',
    resources:   SC_EDIT_COLUMNS,
  },
  {
    scope:       'service_catalogue' as const,
    scopeLabel:  'administration.groups.scope.service_catalogue',
    permission:  'edit_ref' as const,
    permLabel:   'permissions.section.edit_ref',
    resources:   SC_EDIT_REFS,
  },
  {
    scope:       'c3_taxonomy' as const,
    scopeLabel:  'administration.groups.scope.c3_taxonomy',
    permission:  'view_column' as const,
    permLabel:   'permissions.section.view_column',
    resources:   C3_VIEW_COLUMNS,
  },
  {
    scope:       'c3_taxonomy' as const,
    scopeLabel:  'administration.groups.scope.c3_taxonomy',
    permission:  'edit_column' as const,
    permLabel:   'permissions.section.edit_column',
    resources:   C3_EDIT_COLUMNS,
  },
  {
    scope:       'c3_taxonomy' as const,
    scopeLabel:  'administration.groups.scope.c3_taxonomy',
    permission:  'edit_ref' as const,
    permLabel:   'permissions.section.edit_ref',
    resources:   C3_EDIT_REFS,
  },
] as const
