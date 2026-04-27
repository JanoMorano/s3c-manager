-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 20_capability_coverage_views.sql | generic capability coverage helper views
-- =============================================================================

SET search_path TO data, public;

CREATE OR REPLACE VIEW v_capability_requirement AS
SELECT l.capability_uuid, 'application'::text AS entity_kind, a.uuid AS entity_uuid, a.application_code AS code, a.title, l.link_role
FROM c3_capability_application_link l
JOIN c3_application a ON a.id = l.c3_application_id
UNION ALL
SELECT l.capability_uuid, 'data_object'::text AS entity_kind, d.uuid AS entity_uuid, d.data_object_code AS code, d.title, l.link_role
FROM c3_capability_data_object_link l
JOIN c3_data_object d ON d.id = l.c3_data_object_id
UNION ALL
SELECT l.capability_uuid, 'technology_interaction'::text AS entity_kind, t.uuid AS entity_uuid, t.technology_interaction_code AS code, t.title, l.link_role
FROM c3_capability_tin_link l
JOIN c3_technology_interaction t ON t.id = l.c3_tin_id
UNION ALL
SELECT l.capability_uuid, 'c3_service'::text AS entity_kind, s.uuid AS entity_uuid, s.service_code AS code, s.title, l.link_role
FROM c3_capability_c3_service_link l
JOIN c3_service s ON s.id = l.c3_service_id;

CREATE OR REPLACE VIEW v_capability_lvl3_coverage AS
WITH requirements AS (
    SELECT r.capability_uuid, m.spiral_code, r.entity_kind, r.entity_uuid
    FROM v_capability_requirement r
    JOIN c3_entity_spiral_membership m
      ON m.entity_uuid = r.entity_uuid
     AND m.entity_kind = r.entity_kind
     AND m.status_in_spiral IS DISTINCT FROM 'removed'
), covered AS (
    SELECT DISTINCT req.capability_uuid, req.spiral_code, req.entity_kind, req.entity_uuid
    FROM requirements req
    JOIN service_c3_mapping scm
      ON scm.c3_uuid = req.capability_uuid OR scm.c3_uuid = req.entity_uuid
)
SELECT
    req.capability_uuid,
    req.spiral_code,
    COUNT(DISTINCT (req.entity_kind, req.entity_uuid))::integer AS total_requirements,
    COUNT(DISTINCT (covered.entity_kind, covered.entity_uuid))::integer AS covered_count,
    CASE WHEN COUNT(DISTINCT (req.entity_kind, req.entity_uuid)) = 0 THEN 0
         ELSE ROUND(COUNT(DISTINCT (covered.entity_kind, covered.entity_uuid))::numeric * 100 / COUNT(DISTINCT (req.entity_kind, req.entity_uuid)))::integer
    END AS coverage_percent
FROM requirements req
LEFT JOIN covered
  ON covered.capability_uuid = req.capability_uuid
 AND covered.spiral_code = req.spiral_code
 AND covered.entity_kind = req.entity_kind
 AND covered.entity_uuid = req.entity_uuid
GROUP BY req.capability_uuid, req.spiral_code;

CREATE OR REPLACE VIEW v_framework_completeness AS
SELECT capability_uuid, spiral_code, GREATEST(total_requirements - covered_count, 0)::integer AS orphan_requirement_count
FROM v_capability_lvl3_coverage;

CREATE OR REPLACE VIEW v_capability_gap_evidence AS
SELECT r.capability_uuid, m.spiral_code, r.entity_kind, r.entity_uuid, 1::integer AS evidence_count, 1::integer AS source_document_count
FROM v_capability_requirement r
JOIN c3_entity_spiral_membership m
  ON m.entity_uuid = r.entity_uuid
 AND m.entity_kind = r.entity_kind
 AND m.status_in_spiral IS DISTINCT FROM 'removed';

CREATE OR REPLACE VIEW v_capability_service_overlap AS
SELECT NULL::varchar(100) AS capability_uuid, NULL::varchar(20) AS spiral_code,
       NULL::bigint AS service_a_id, NULL::bigint AS service_b_id,
       0::integer AS shared_count, 0::integer AS only_a, 0::integer AS only_b, 0::integer AS overlap_pct
WHERE FALSE;

SET search_path TO platform, public;
INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '20_capability_coverage_views',
    'Generic capability coverage helper views',
    '2.2.0',
    'Adds SQL views for capability requirements, coverage, completeness, evidence, and overlap API support'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
