-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 38_c3_entity_link_view.sql | schema: data
--
-- One read model over the seven C3 link tables:
--   c3_capability_{application,data_object,tin,c3_service}_link
--   c3_technology_interaction_{application,data_object,service}_link
--
-- Each row is one directed link: source (capability or technology interaction)
-- -> target entity. link_kind uses the graph edge_kind names. Writes still go
-- to the individual tables; readers use this view instead of seven queries.
-- =============================================================================

SET search_path TO data, public;

CREATE OR REPLACE VIEW v_c3_entity_link AS
SELECT 'capability_application'::varchar(40) AS link_kind,
       'capability'::varchar(20) AS source_kind, l.capability_uuid AS source_uuid, NULL::bigint AS source_id,
       'application'::varchar(20) AS target_kind, app.id AS target_id, app.uuid AS target_uuid,
       app.application_code AS target_code, app.title AS target_title, app.item_status AS target_item_status,
       l.link_role AS link_role
FROM c3_capability_application_link l
JOIN c3_application app ON app.id = l.c3_application_id
UNION ALL
SELECT 'capability_data_object', 'capability', l.capability_uuid, NULL,
       'data_object', dob.id, dob.uuid, dob.data_object_code, dob.title, dob.item_status, l.link_role
FROM c3_capability_data_object_link l
JOIN c3_data_object dob ON dob.id = l.c3_data_object_id
UNION ALL
SELECT 'capability_tin', 'capability', l.capability_uuid, NULL,
       'tin', tin.id, tin.uuid, tin.technology_interaction_code, tin.title, tin.item_status, l.link_role
FROM c3_capability_tin_link l
JOIN c3_technology_interaction tin ON tin.id = l.c3_tin_id
UNION ALL
SELECT 'capability_c3_service', 'capability', l.capability_uuid, NULL,
       'c3_service', svc.id, svc.uuid, svc.service_code, svc.title, svc.item_status, l.link_role
FROM c3_capability_c3_service_link l
JOIN c3_service svc ON svc.id = l.c3_service_id
UNION ALL
SELECT 'tin_application', 'tin', ti.uuid, ti.id,
       'application', app.id, app.uuid, app.application_code, app.title, app.item_status, l.source_slot
FROM c3_technology_interaction_application_link l
JOIN c3_technology_interaction ti ON ti.id = l.technology_interaction_id
JOIN c3_application app ON app.id = l.c3_application_id
UNION ALL
SELECT 'tin_data_object', 'tin', ti.uuid, ti.id,
       'data_object', dob.id, dob.uuid, dob.data_object_code, dob.title, dob.item_status, l.source_slot
FROM c3_technology_interaction_data_object_link l
JOIN c3_technology_interaction ti ON ti.id = l.technology_interaction_id
JOIN c3_data_object dob ON dob.id = l.c3_data_object_id
UNION ALL
SELECT 'tin_c3_service', 'tin', ti.uuid, ti.id,
       'c3_service', svc.id, svc.uuid, svc.service_code, svc.title, svc.item_status, l.source_slot
FROM c3_technology_interaction_service_link l
JOIN c3_technology_interaction ti ON ti.id = l.technology_interaction_id
JOIN c3_service svc ON svc.id = l.c3_service_id;

COMMENT ON VIEW v_c3_entity_link IS
    'Unified read model over the seven C3 link tables; link_kind matches graph edge_kind.';

SET search_path TO platform, public;

INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '38_c3_entity_link_view',
    'Unified C3 entity link read model',
    '3.5.0',
    'Adds v_c3_entity_link over the seven C3 capability/technology-interaction link tables.'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    schema_version  = EXCLUDED.schema_version,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
