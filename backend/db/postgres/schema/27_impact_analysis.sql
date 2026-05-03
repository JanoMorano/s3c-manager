-- =============================================================================
-- SERVICE CATALOGUE — Impact analysis helper views
-- 27_impact_analysis.sql | schema: data
-- =============================================================================

SET search_path TO data, public;

INSERT INTO data.ref_relation_type
    (code, name, description, is_directional, is_operational_dependency, default_impact_mode, default_impact_level)
VALUES
    ('supports',         'Supports',         'Source service or capability supports the target.', TRUE, TRUE, NULL, 'medium'),
    ('consumes',         'Consumes',         'Source consumes data or a supporting element from the target.', TRUE, TRUE, NULL, 'medium'),
    ('implements',       'Implements',       'Source implements the target capability or requirement.', TRUE, TRUE, NULL, 'medium'),
    ('exposes_data',     'Exposes data',     'Source exposes or governs the target data object.', TRUE, TRUE, NULL, 'medium'),
    ('uses_application', 'Uses application', 'Source uses the target application as implementation evidence.', TRUE, TRUE, NULL, 'medium')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_directional = EXCLUDED.is_directional,
    is_operational_dependency = EXCLUDED.is_operational_dependency,
    default_impact_mode = EXCLUDED.default_impact_mode,
    default_impact_level = EXCLUDED.default_impact_level;

CREATE OR REPLACE VIEW data.v_impact_node AS
SELECT
    CONCAT('svc:', sc.service_id) AS node_id,
    'service'::text AS node_kind,
    sc.service_id::text AS node_key,
    sc.id::text AS node_uuid,
    sc.title::text AS title,
    sc.service_status_code::text AS status,
    CONCAT('/services/', sc.service_id)::text AS url,
    sc.lifecycle_stage_code::text AS lifecycle_stage,
    sc.criticality_code::text AS criticality,
    sc.updated_at
FROM data.service_catalog sc
WHERE sc.is_deleted = FALSE
UNION ALL
SELECT
    CONCAT('c3:', c.uuid) AS node_id,
    'c3_capability'::text AS node_kind,
    COALESCE(c.external_id, c.uuid)::text AS node_key,
    c.uuid::text AS node_uuid,
    COALESCE(c.title, c.external_id, c.uuid)::text AS title,
    c.item_status::text AS status,
    CONCAT('/c3/', c.uuid)::text AS url,
    NULL::text AS lifecycle_stage,
    NULL::text AS criticality,
    COALESCE(c.synced_at, c.modification_date, CURRENT_TIMESTAMP) AS updated_at
FROM data.c3_taxonomy c
UNION ALL
SELECT
    CONCAT('app:', app.uuid) AS node_id,
    'c3_application'::text AS node_kind,
    app.application_code::text AS node_key,
    app.uuid::text AS node_uuid,
    app.title::text AS title,
    app.item_status::text AS status,
    NULL::text AS url,
    NULL::text AS lifecycle_stage,
    NULL::text AS criticality,
    app.updated_at
FROM data.c3_application app
UNION ALL
SELECT
    CONCAT('do:', dob.uuid) AS node_id,
    'c3_data_object'::text AS node_kind,
    dob.data_object_code::text AS node_key,
    dob.uuid::text AS node_uuid,
    dob.title::text AS title,
    dob.item_status::text AS status,
    NULL::text AS url,
    NULL::text AS lifecycle_stage,
    NULL::text AS criticality,
    dob.updated_at
FROM data.c3_data_object dob
UNION ALL
SELECT
    CONCAT('tin:', tin.uuid) AS node_id,
    'c3_tin'::text AS node_kind,
    tin.technology_interaction_code::text AS node_key,
    tin.uuid::text AS node_uuid,
    tin.title::text AS title,
    tin.item_status::text AS status,
    NULL::text AS url,
    NULL::text AS lifecycle_stage,
    NULL::text AS criticality,
    tin.updated_at
FROM data.c3_technology_interaction tin
UNION ALL
SELECT
    CONCAT('c3svc:', svc.uuid) AS node_id,
    'c3_service'::text AS node_kind,
    svc.service_code::text AS node_key,
    svc.uuid::text AS node_uuid,
    svc.title::text AS title,
    svc.item_status::text AS status,
    NULL::text AS url,
    NULL::text AS lifecycle_stage,
    NULL::text AS criticality,
    svc.updated_at
FROM data.c3_service svc;

CREATE OR REPLACE VIEW data.v_impact_edge AS
SELECT
    CONCAT('rel:', sr.id) AS edge_id,
    'service_relation'::text AS edge_kind,
    CONCAT('svc:', t.service_id) AS source_node_id,
    'service'::text AS source_kind,
    t.service_id::text AS source_key,
    t.title::text AS source_title,
    CONCAT('svc:', f.service_id) AS target_node_id,
    'service'::text AS target_kind,
    f.service_id::text AS target_key,
    f.title::text AS target_title,
    sr.relation_type_code::text AS relation_kind,
    sr.relation_label::text AS relation_label,
    sr.impact_level::text AS impact_level,
    CASE
        WHEN sr.is_mandatory AND sr.impact_level = 'high' THEN 'blocking_dependency'
        WHEN sr.is_verified = FALSE THEN 'unverified_dependency'
        ELSE NULL
    END::text AS risk_hint
FROM data.service_relation sr
JOIN data.service_catalog f ON f.id = sr.from_service_id AND f.is_deleted = FALSE
JOIN data.service_catalog t ON t.id = sr.to_service_id AND t.is_deleted = FALSE
WHERE sr.is_deleted = FALSE
UNION ALL
SELECT
    CONCAT('svc-c3:', scm.id) AS edge_id,
    'service_c3_mapping'::text AS edge_kind,
    CONCAT('svc:', sc.service_id) AS source_node_id,
    'service'::text AS source_kind,
    sc.service_id::text AS source_key,
    sc.title::text AS source_title,
    CONCAT('c3:', scm.c3_uuid) AS target_node_id,
    'c3_capability'::text AS target_kind,
    COALESCE(c.external_id, scm.c3_reference, scm.c3_uuid)::text AS target_key,
    COALESCE(c.title, scm.c3_reference, scm.c3_uuid)::text AS target_title,
    scm.mapping_type_code::text AS relation_kind,
    scm.mapping_note::text AS relation_label,
    CASE WHEN scm.is_primary THEN 'high' ELSE 'medium' END::text AS impact_level,
    CASE WHEN scm.is_primary THEN 'primary_capability_mapping' ELSE NULL END::text AS risk_hint
FROM data.service_c3_mapping scm
JOIN data.service_catalog sc ON sc.id = scm.service_id AND sc.is_deleted = FALSE
LEFT JOIN data.c3_taxonomy c ON c.uuid = scm.c3_uuid
UNION ALL
SELECT
    CONCAT('c3-parent:', child.uuid, ':', child.parent_uuid) AS edge_id,
    'c3_parent'::text AS edge_kind,
    CONCAT('c3:', child.uuid) AS source_node_id,
    'c3_capability'::text AS source_kind,
    COALESCE(child.external_id, child.uuid)::text AS source_key,
    COALESCE(child.title, child.external_id, child.uuid)::text AS source_title,
    CONCAT('c3:', parent.uuid) AS target_node_id,
    'c3_capability'::text AS target_kind,
    COALESCE(parent.external_id, parent.uuid)::text AS target_key,
    COALESCE(parent.title, parent.external_id, parent.uuid)::text AS target_title,
    'supports'::text AS relation_kind,
    NULL::text AS relation_label,
    'medium'::text AS impact_level,
    NULL::text AS risk_hint
FROM data.c3_taxonomy child
JOIN data.c3_taxonomy parent ON parent.uuid = child.parent_uuid
UNION ALL
SELECT
    CONCAT('cap-app:', l.capability_uuid, ':', app.uuid) AS edge_id,
    'capability_application'::text AS edge_kind,
    CONCAT('c3:', l.capability_uuid) AS source_node_id,
    'c3_capability'::text AS source_kind,
    COALESCE(c.external_id, l.capability_uuid)::text AS source_key,
    COALESCE(c.title, c.external_id, l.capability_uuid)::text AS source_title,
    CONCAT('app:', app.uuid) AS target_node_id,
    'c3_application'::text AS target_kind,
    app.application_code::text AS target_key,
    app.title::text AS target_title,
    'uses_application'::text AS relation_kind,
    l.link_role::text AS relation_label,
    'medium'::text AS impact_level,
    NULL::text AS risk_hint
FROM data.c3_capability_application_link l
JOIN data.c3_application app ON app.id = l.c3_application_id
LEFT JOIN data.c3_taxonomy c ON c.uuid = l.capability_uuid
UNION ALL
SELECT
    CONCAT('cap-do:', l.capability_uuid, ':', dob.uuid) AS edge_id,
    'capability_data_object'::text AS edge_kind,
    CONCAT('c3:', l.capability_uuid) AS source_node_id,
    'c3_capability'::text AS source_kind,
    COALESCE(c.external_id, l.capability_uuid)::text AS source_key,
    COALESCE(c.title, c.external_id, l.capability_uuid)::text AS source_title,
    CONCAT('do:', dob.uuid) AS target_node_id,
    'c3_data_object'::text AS target_kind,
    dob.data_object_code::text AS target_key,
    dob.title::text AS target_title,
    'exposes_data'::text AS relation_kind,
    l.link_role::text AS relation_label,
    'medium'::text AS impact_level,
    NULL::text AS risk_hint
FROM data.c3_capability_data_object_link l
JOIN data.c3_data_object dob ON dob.id = l.c3_data_object_id
LEFT JOIN data.c3_taxonomy c ON c.uuid = l.capability_uuid
UNION ALL
SELECT
    CONCAT('cap-tin:', l.capability_uuid, ':', tin.uuid) AS edge_id,
    'capability_tin'::text AS edge_kind,
    CONCAT('c3:', l.capability_uuid) AS source_node_id,
    'c3_capability'::text AS source_kind,
    COALESCE(c.external_id, l.capability_uuid)::text AS source_key,
    COALESCE(c.title, c.external_id, l.capability_uuid)::text AS source_title,
    CONCAT('tin:', tin.uuid) AS target_node_id,
    'c3_tin'::text AS target_kind,
    tin.technology_interaction_code::text AS target_key,
    tin.title::text AS target_title,
    'implements'::text AS relation_kind,
    l.link_role::text AS relation_label,
    'medium'::text AS impact_level,
    NULL::text AS risk_hint
FROM data.c3_capability_tin_link l
JOIN data.c3_technology_interaction tin ON tin.id = l.c3_tin_id
LEFT JOIN data.c3_taxonomy c ON c.uuid = l.capability_uuid
UNION ALL
SELECT
    CONCAT('cap-c3svc:', l.capability_uuid, ':', svc.uuid) AS edge_id,
    'capability_c3_service'::text AS edge_kind,
    CONCAT('c3:', l.capability_uuid) AS source_node_id,
    'c3_capability'::text AS source_kind,
    COALESCE(c.external_id, l.capability_uuid)::text AS source_key,
    COALESCE(c.title, c.external_id, l.capability_uuid)::text AS source_title,
    CONCAT('c3svc:', svc.uuid) AS target_node_id,
    'c3_service'::text AS target_kind,
    svc.service_code::text AS target_key,
    svc.title::text AS target_title,
    'supports'::text AS relation_kind,
    l.link_role::text AS relation_label,
    'medium'::text AS impact_level,
    NULL::text AS risk_hint
FROM data.c3_capability_c3_service_link l
JOIN data.c3_service svc ON svc.id = l.c3_service_id
LEFT JOIN data.c3_taxonomy c ON c.uuid = l.capability_uuid;

SET search_path TO platform, public;

INSERT INTO platform.schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES ('27_impact_analysis', 'Impact analysis helper views and relation kinds', '1.2.0', 'Adds normalized impact nodes and edges for service/capability traversal.')
ON CONFLICT (migration_key) DO NOTHING;
