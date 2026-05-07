export interface ResourceDef {
  key:   string
  label: string
}

// ── Service Catalogue ─────────────────────────────────────────────────────────

export const SC_VIEW_COLUMNS: ResourceDef[] = [
  { key: 'service_id',                   label: 'Service ID' },
  { key: 'title',                         label: 'Title' },
  { key: 'short_description',             label: 'Short Description' },
  { key: 'description',                   label: 'Description' },
  { key: 'service_status_code',           label: 'Status' },
  { key: 'service_type_code',             label: 'Service Type' },
  { key: 'portfolio_group_code',          label: 'Portfolio Group' },
  { key: 'service_line_code',             label: 'Service Line' },
  { key: 'organizational_element_code',   label: 'Org. Element' },
  { key: 'global_service_group_code',     label: 'Global Service Group' },
  { key: 'service_url',                   label: 'Service URL' },
  { key: 'availability_pct',              label: 'Availability %' },
  { key: 'domains',                       label: 'Domains' },
  { key: 'pricing_variants',              label: 'Legacy Variants' },
  { key: 'sla',                           label: 'SLA' },
  { key: 'relations',                     label: 'Relations' },
  { key: 'ownership',                     label: 'Ownership' },
  { key: 'completeness_score',            label: 'Completeness Score' },
  { key: 'c3_mapping',                    label: 'C3 Mapping' },
  { key: 'scope_text',                    label: 'Scope' },
  { key: 'exclusions',                    label: 'Exclusions' },
  { key: 'customer_type',                 label: 'Customer Type' },
  { key: 'operational_notes_raw',         label: 'Operational Notes' },
  { key: 'extended_data',                 label: 'Extended Data (JSON)' },
  { key: 'audit_history',                 label: 'Audit History' },
]

export const SC_EDIT_COLUMNS: ResourceDef[] = [
  { key: 'title',                         label: 'Title' },
  { key: 'short_description',             label: 'Short Description' },
  { key: 'description',                   label: 'Description' },
  { key: 'scope_text',                    label: 'Scope' },
  { key: 'exclusions',                    label: 'Exclusions' },
  { key: 'service_status_code',           label: 'Status' },
  { key: 'service_type_code',             label: 'Service Type' },
  { key: 'portfolio_group_code',          label: 'Portfolio Group' },
  { key: 'service_line_code',             label: 'Service Line' },
  { key: 'organizational_element_code',   label: 'Org. Element' },
  { key: 'service_url',                   label: 'Service URL' },
  { key: 'availability_pct',              label: 'Availability %' },
  { key: 'domains',                       label: 'Domains' },
  { key: 'pricing_variants',              label: 'Legacy Variants (read-only)' },
  { key: 'sla',                           label: 'SLA Fields' },
  { key: 'relations',                     label: 'Relations (CRUD)' },
  { key: 'ownership',                     label: 'Ownership / Roles' },
  { key: 'customer_type',                 label: 'Customer Type' },
  { key: 'operational_notes_raw',         label: 'Operational Notes' },
  { key: 'notes_json',                    label: 'Notes JSON' },
]

export const SC_EDIT_REFS: ResourceDef[] = [
  { key: 'ref_ServiceStatus',         label: 'Service Statuses' },
  { key: 'ref_ServiceType',           label: 'Service Types' },
  { key: 'ref_PortfolioGroup',        label: 'Portfolio Groups' },
  { key: 'ref_ServiceLine',           label: 'Service Lines' },
  { key: 'ref_NetworkDomain',         label: 'Network Domains' },
  { key: 'ref_RelationType',          label: 'Relation Types' },
  { key: 'ref_SupportWindow',         label: 'Support Windows' },
  { key: 'ref_OrganizationalElement', label: 'Org. Elements' },
]

// ── C3 Taxonomy ───────────────────────────────────────────────────────────────

export const C3_VIEW_COLUMNS: ResourceDef[] = [
  { key: 'c3_uuid',           label: 'C3 UUID' },
  { key: 'c3_name',           label: 'C3 Name' },
  { key: 'c3_domain',         label: 'C3 Domain' },
  { key: 'c3_level',          label: 'C3 Level' },
  { key: 'c3_type',           label: 'C3 Type' },
  { key: 'c3_parent_uuid',    label: 'C3 Parent' },
  { key: 'is_primary',        label: 'Is Primary Mapping' },
  { key: 'sync_status',       label: 'Sync Status' },
  { key: 'last_synced_at',    label: 'Last Synced' },
  { key: 'modification_date', label: 'Modification Date' },
  { key: 'revised',           label: 'Revised By' },
  { key: 'notes',             label: 'Notes' },
]

export const C3_EDIT_COLUMNS: ResourceDef[] = [
  { key: 'sync_status', label: 'Sync Status' },
  { key: 'is_primary',  label: 'Is Primary' },
  { key: 'notes',       label: 'Notes' },
]

export const C3_EDIT_REFS: ResourceDef[] = [
  { key: 'c3_domain_values', label: 'C3 Domain Values' },
  { key: 'c3_type_values',   label: 'C3 Type Values' },
]

// ── Lookup map ────────────────────────────────────────────────────────────────

export const PERMISSION_SECTIONS = [
  {
    scope:       'service_catalogue' as const,
    scopeLabel:  'Service Catalogue',
    permission:  'view_column' as const,
    permLabel:   'Visible columns',
    resources:   SC_VIEW_COLUMNS,
  },
  {
    scope:       'service_catalogue' as const,
    scopeLabel:  'Service Catalogue',
    permission:  'edit_column' as const,
    permLabel:   'Editable columns',
    resources:   SC_EDIT_COLUMNS,
  },
  {
    scope:       'service_catalogue' as const,
    scopeLabel:  'Service Catalogue',
    permission:  'edit_ref' as const,
    permLabel:   'Editable ref data',
    resources:   SC_EDIT_REFS,
  },
  {
    scope:       'c3_taxonomy' as const,
    scopeLabel:  'C3 Taxonomy',
    permission:  'view_column' as const,
    permLabel:   'Visible columns',
    resources:   C3_VIEW_COLUMNS,
  },
  {
    scope:       'c3_taxonomy' as const,
    scopeLabel:  'C3 Taxonomy',
    permission:  'edit_column' as const,
    permLabel:   'Editable columns',
    resources:   C3_EDIT_COLUMNS,
  },
  {
    scope:       'c3_taxonomy' as const,
    scopeLabel:  'C3 Taxonomy',
    permission:  'edit_ref' as const,
    permLabel:   'Editable ref data',
    resources:   C3_EDIT_REFS,
  },
] as const
