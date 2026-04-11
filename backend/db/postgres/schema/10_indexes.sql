-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 10_indexes.sql | schema: data
-- Converted from backend/db/08_indexes.sql
-- =============================================================================

SET search_path TO data, public;

CREATE INDEX IF NOT EXISTS ix_service_catalog_status_type
    ON service_catalog(service_status_code, service_type_code)
    INCLUDE (service_id, title, portfolio_group_code, is_deleted);

CREATE INDEX IF NOT EXISTS ix_service_catalog_taxonomy
    ON service_catalog(portfolio_group_code, global_service_group_code, service_line_code, organizational_element_code)
    INCLUDE (service_id, title, service_status_code, service_type_code, is_deleted);

CREATE INDEX IF NOT EXISTS ix_service_catalog_is_deleted
    ON service_catalog(is_deleted)
    INCLUDE (service_id, title, service_status_code);

CREATE INDEX IF NOT EXISTS ix_service_catalog_ambiguous_status
    ON service_catalog(is_available_status_ambiguous)
    INCLUDE (service_id, title, service_status_code)
    WHERE is_available_status_ambiguous = TRUE;

CREATE INDEX IF NOT EXISTS ix_service_catalog_is_stub
    ON service_catalog(is_stub)
    INCLUDE (service_id, title, service_status_code)
    WHERE is_stub = TRUE;

CREATE INDEX IF NOT EXISTS ix_service_flavour_service
    ON service_flavour(service_id)
    INCLUDE (flavour_code, title, price_value, flavour_status_code, is_deleted);

CREATE INDEX IF NOT EXISTS ix_service_flavour_flavour_code
    ON service_flavour(flavour_code)
    INCLUDE (service_id, title, is_deleted);

CREATE INDEX IF NOT EXISTS ix_service_relation_from
    ON service_relation(from_service_id)
    INCLUDE (to_service_id, relation_type_code, pace_code, is_mandatory, impact_level, is_deleted);

CREATE INDEX IF NOT EXISTS ix_service_relation_to
    ON service_relation(to_service_id)
    INCLUDE (from_service_id, relation_type_code, pace_code, is_mandatory, impact_level, is_deleted);

CREATE INDEX IF NOT EXISTS ix_service_relation_type_source
    ON service_relation(relation_type_code, source_field, is_inferred, is_deleted)
    INCLUDE (from_service_id, to_service_id, parse_confidence, impact_level);

CREATE INDEX IF NOT EXISTS ix_service_relation_updated_at
    ON service_relation(updated_at DESC)
    INCLUDE (from_service_id, to_service_id, relation_type_code, is_verified, is_deleted);

CREATE UNIQUE INDEX IF NOT EXISTS ux_service_relation_active_edge
    ON service_relation(from_service_id, to_service_id, relation_type_code, pace_code_normalized)
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS ix_service_relation_pace
    ON service_relation(pace_code)
    INCLUDE (from_service_id, to_service_id, relation_type_code);

CREATE INDEX IF NOT EXISTS ix_service_relation_raw_service
    ON service_relation_raw(service_id)
    INCLUDE (source_field, parsed_ok, parsed_at);

CREATE INDEX IF NOT EXISTS ix_service_relation_raw_source_field
    ON service_relation_raw(source_field, parsed_ok);

CREATE INDEX IF NOT EXISTS ix_service_available_on_domain
    ON service_available_on(domain_code)
    INCLUDE (service_id);

CREATE INDEX IF NOT EXISTS ix_service_sla_service
    ON service_sla(service_id)
    INCLUDE (flavour_id, support_window_code, availability_pct, restoration_hours, delivery_days);

CREATE INDEX IF NOT EXISTS ix_service_role_assignment_service
    ON service_role_assignment(service_id)
    INCLUDE (role_code, display_name, organization_name);

CREATE INDEX IF NOT EXISTS ix_service_role_assignment_role
    ON service_role_assignment(role_code)
    INCLUDE (service_id, display_name);

CREATE UNIQUE INDEX IF NOT EXISTS ux_service_role_assignment_current_role
    ON service_role_assignment(service_id, role_code)
    WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS ix_service_c3_mapping_service
    ON service_c3_mapping(service_id)
    INCLUDE (c3_uuid, mapping_type_code, pace_code, is_primary);

CREATE INDEX IF NOT EXISTS ix_service_c3_mapping_c3_uuid
    ON service_c3_mapping(c3_uuid)
    INCLUDE (service_id, mapping_type_code, is_primary);

CREATE INDEX IF NOT EXISTS ix_service_raw_field_service_field
    ON service_raw_field(service_id, field_name)
    INCLUDE (parse_status, parser_version);

CREATE INDEX IF NOT EXISTS ix_import_row_batch
    ON import_row(batch_id, status)
    INCLUDE (service_id, row_number);

CREATE INDEX IF NOT EXISTS ix_import_issue_batch
    ON import_issue(batch_id, severity, resolved)
    INCLUDE (service_id, issue_code, field_name);

CREATE INDEX IF NOT EXISTS ix_import_issue_unresolved
    ON import_issue(issue_code, service_id)
    WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS ix_import_contract_report_created_at
    ON import_contract_report(created_at DESC);

CREATE INDEX IF NOT EXISTS ix_import_contract_report_source_hash
    ON import_contract_report(source_hash_sha256, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_taxonomy_mapping_audit_service
    ON taxonomy_mapping_audit(service_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS ix_graph_layout_audit_service
    ON graph_layout_audit(service_id, changed_at DESC);
