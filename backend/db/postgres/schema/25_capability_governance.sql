-- =============================================================================
-- SERVICE CATALOGUE - PostgreSQL canonical schema
-- 25_capability_governance.sql | capability and C3 coverage governance views
-- =============================================================================

SET search_path TO data, public;

CREATE OR REPLACE VIEW v_capability_governance_mapping AS
SELECT
    scm.id AS mapping_id,
    sc.id AS service_pk,
    sc.service_id,
    sc.title AS service_title,
    sc.service_status_code AS service_status,
    sc.lifecycle_stage_code,
    sc.lifecycle_state,
    scm.c3_uuid AS capability_uuid,
    ct.external_id AS capability_code,
    ct.title AS capability_title,
    ct.item_type AS capability_item_type,
    parent.uuid AS parent_uuid,
    parent.external_id AS parent_code,
    parent.title AS parent_title,
    parent.abbreviation AS parent_abbreviation,
    COALESCE(m.spiral_code, ct.fmn_spiral) AS spiral_code,
    scm.c3_domain AS mapping_domain,
    scm.mapping_type_code,
    scm.pace_code,
    scm.is_primary,
    CASE
        WHEN scm.is_primary = TRUE OR scm.mapping_type_code = 'fully_fulfills' THEN 'primary'
        WHEN scm.mapping_type_code = 'supports' THEN 'supporting'
        WHEN scm.mapping_type_code = 'enables' THEN 'enabling'
        ELSE 'dependent'
    END AS normalized_role,
    owner.display_name AS owner_name,
    owner.email AS owner_email,
    CASE WHEN COALESCE(readiness.is_publishable, FALSE) = TRUE THEN 'ready' ELSE 'blocked' END AS readiness_state
FROM service_c3_mapping scm
JOIN service_catalog sc
  ON sc.id = scm.service_id
 AND sc.is_deleted = FALSE
 AND sc.is_stub = FALSE
LEFT JOIN c3_taxonomy ct
  ON ct.uuid = scm.c3_uuid
LEFT JOIN c3_taxonomy parent
  ON parent.uuid = ct.parent_uuid
LEFT JOIN c3_entity_spiral_membership m
  ON m.entity_uuid = ct.uuid
 AND m.entity_kind = 'taxonomy'
 AND m.status_in_spiral IS DISTINCT FROM 'removed'
LEFT JOIN LATERAL (
    SELECT sra.display_name, sra.email
    FROM service_role_assignment sra
    WHERE sra.service_id = sc.id
      AND sra.role_code = 'service_owner'
      AND sra.valid_to IS NULL
    ORDER BY sra.created_at DESC
    LIMIT 1
) owner ON TRUE
LEFT JOIN v_servicepublishreadiness readiness
  ON readiness.service_pk = sc.id
WHERE ct.item_type = 'CP';

CREATE OR REPLACE VIEW v_capability_governance_coverage AS
WITH capabilities AS (
    SELECT
        c.uuid AS capability_uuid,
        c.external_id AS capability_code,
        c.title AS capability_title,
        c.abbreviation AS capability_abbreviation,
        c.item_status,
        c.level_num,
        parent.uuid AS parent_uuid,
        parent.external_id AS parent_code,
        parent.title AS parent_title,
        parent.abbreviation AS parent_abbreviation,
        COALESCE(m.spiral_code, c.fmn_spiral) AS spiral_code
    FROM c3_taxonomy c
    LEFT JOIN c3_taxonomy parent
      ON parent.uuid = c.parent_uuid
    LEFT JOIN c3_entity_spiral_membership m
      ON m.entity_uuid = c.uuid
     AND m.entity_kind = 'taxonomy'
     AND m.status_in_spiral IS DISTINCT FROM 'removed'
    WHERE c.item_type = 'CP'
      AND c.level_num = 3
),
mapping_counts AS (
    SELECT
        capability_uuid,
        spiral_code,
        COUNT(DISTINCT service_pk)::integer AS service_count,
        COUNT(DISTINCT service_pk) FILTER (WHERE normalized_role = 'primary')::integer AS primary_service_count,
        COUNT(DISTINCT service_pk) FILTER (WHERE normalized_role = 'supporting')::integer AS supporting_service_count,
        COUNT(DISTINCT service_pk) FILTER (WHERE normalized_role = 'enabling')::integer AS enabling_service_count,
        COUNT(DISTINCT service_pk) FILTER (WHERE normalized_role = 'dependent')::integer AS dependent_service_count,
        COUNT(DISTINCT service_pk) FILTER (WHERE readiness_state = 'ready')::integer AS ready_service_count,
        COUNT(DISTINCT service_pk) FILTER (WHERE readiness_state <> 'ready')::integer AS blocked_service_count
    FROM v_capability_governance_mapping
    GROUP BY capability_uuid, spiral_code
),
incomplete_primary AS (
    SELECT
        primary_c3_uuid AS capability_uuid,
        COUNT(*)::integer AS incomplete_primary_mapping_count
    FROM v_servicepublishreadiness
    WHERE primary_c3_uuid IS NOT NULL
      AND (
        has_single_primary_mapping = FALSE
        OR has_complete_primary_capability = FALSE
        OR is_publishable = FALSE
      )
    GROUP BY primary_c3_uuid
)
SELECT
    cap.capability_uuid,
    cap.capability_code,
    cap.capability_title,
    cap.capability_abbreviation,
    cap.item_status,
    cap.level_num,
    cap.parent_uuid,
    cap.parent_code,
    cap.parent_title,
    cap.parent_abbreviation,
    cap.spiral_code,
    COALESCE(req.total_requirements, 0)::integer AS total_requirements,
    COALESCE(req.covered_count, 0)::integer AS covered_requirement_count,
    COALESCE(req.coverage_percent, CASE WHEN COALESCE(map.service_count, 0) > 0 THEN 100 ELSE 0 END)::integer AS coverage_percent,
    COALESCE(map.service_count, 0)::integer AS service_count,
    COALESCE(map.primary_service_count, 0)::integer AS primary_service_count,
    COALESCE(map.supporting_service_count, 0)::integer AS supporting_service_count,
    COALESCE(map.enabling_service_count, 0)::integer AS enabling_service_count,
    COALESCE(map.dependent_service_count, 0)::integer AS dependent_service_count,
    COALESCE(map.ready_service_count, 0)::integer AS ready_service_count,
    COALESCE(map.blocked_service_count, 0)::integer AS blocked_service_count,
    COALESCE(incomplete.incomplete_primary_mapping_count, 0)::integer AS incomplete_primary_mapping_count,
    GREATEST(COALESCE(req.total_requirements, 0) - COALESCE(req.covered_count, 0), 0)::integer AS gap_count,
    CASE
        WHEN COALESCE(map.service_count, 0) = 0 THEN 'uncovered'
        WHEN COALESCE(map.service_count, 0) > 1 THEN 'over_covered'
        WHEN COALESCE(map.blocked_service_count, 0) > 0 THEN 'not_ready'
        ELSE 'ready'
    END AS governance_state
FROM capabilities cap
LEFT JOIN v_capability_lvl3_coverage req
  ON req.capability_uuid = cap.capability_uuid
 AND req.spiral_code IS NOT DISTINCT FROM cap.spiral_code
LEFT JOIN mapping_counts map
  ON map.capability_uuid = cap.capability_uuid
 AND map.spiral_code IS NOT DISTINCT FROM cap.spiral_code
LEFT JOIN incomplete_primary incomplete
  ON incomplete.capability_uuid = cap.capability_uuid;

CREATE OR REPLACE VIEW v_capability_governance_gap AS
SELECT
    capability_uuid,
    capability_code,
    capability_title,
    parent_title,
    spiral_code,
    governance_state,
    coverage_percent,
    service_count,
    gap_count,
    incomplete_primary_mapping_count,
    CASE
        WHEN service_count = 0 THEN 'Map at least one service to this capability.'
        WHEN gap_count > 0 THEN 'Map services to uncovered C3 requirements.'
        WHEN incomplete_primary_mapping_count > 0 THEN 'Repair incomplete primary service mappings.'
        ELSE 'Monitor capability coverage.'
    END AS recommended_action
FROM v_capability_governance_coverage
WHERE service_count = 0
   OR gap_count > 0
   OR incomplete_primary_mapping_count > 0
   OR blocked_service_count > 0;

CREATE OR REPLACE VIEW v_capability_governance_overlap AS
SELECT
    capability_uuid,
    capability_code,
    capability_title,
    parent_title,
    spiral_code,
    service_count,
    primary_service_count,
    supporting_service_count,
    enabling_service_count,
    dependent_service_count,
    coverage_percent,
    LEAST(100, service_count * 25 + primary_service_count * 10)::integer AS overlap_score,
    'Review duplicate service support and document intended ownership.'::text AS recommended_action
FROM v_capability_governance_coverage
WHERE service_count > 1;

SET search_path TO platform, public;
INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '25_capability_governance',
    'Capability governance coverage cockpit',
    '2.5.0',
    'Adds normalized capability mapping roles and coverage/gap/overlap governance views'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
