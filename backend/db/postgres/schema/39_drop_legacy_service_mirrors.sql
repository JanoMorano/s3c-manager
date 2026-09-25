-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 39_drop_legacy_service_mirrors.sql | schema: data
--
-- Completes the field consolidation of 35/36: the legacy mirror columns of
-- data.service_catalog are removed and every reader uses the canonical source.
--
--   lifecycle_state, service_status_code -> lifecycle_stage_code (+ is_stub)
--   next_review_due_at                   -> review_due_at
--   portfolio_group_code                 -> portfolio_id -> service_portfolio.portfolio_code
--   sla_availability, sla_restoration_hours, sla_delivery_days,
--   sla_restoration_text, sla_delivery_text
--                                        -> primary service-level service_sla row
--
-- The API keeps the derived fields (service_status, lifecycle_state,
-- portfolio_group, sla_*); they are computed from the canonical columns.
-- The views that read the mirrors are recreated here with the same output
-- columns; the mirror sync triggers of 35/36 are removed.
-- =============================================================================

SET search_path TO data, public;

-- ── Derived catalogue status ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_service_status_code(p_stage TEXT, p_is_stub BOOLEAN)
RETURNS VARCHAR(50) LANGUAGE sql IMMUTABLE SET search_path = data, public AS $$
    SELECT CASE WHEN p_is_stub THEN 'external_reference'::varchar(50)
                ELSE fn_service_status_from_stage(p_stage)::varchar(50) END
$$;

-- ── Views reading the mirrors (dependants first) ─────────────────────────────

DROP VIEW IF EXISTS v_capability_governance_overlap;
DROP VIEW IF EXISTS v_capability_governance_gap;
DROP VIEW IF EXISTS v_capability_governance_coverage;
DROP VIEW IF EXISTS v_capability_governance_mapping;
DROP VIEW IF EXISTS v_servicepublishreadiness;
DROP VIEW IF EXISTS v_stubcompletionqueue;
DROP VIEW IF EXISTS v_graphoverviewnodes;
DROP VIEW IF EXISTS v_impact_node;
DROP VIEW IF EXISTS v_c3_board_lane;

-- ── Mirror sync triggers (35, 36) ────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_service_catalog_sync_canonical ON service_catalog;
DROP FUNCTION IF EXISTS fn_service_catalog_sync_canonical();
DROP TRIGGER IF EXISTS trg_service_catalog_sync_sla ON service_catalog;
DROP FUNCTION IF EXISTS fn_service_catalog_sync_sla();
DROP TRIGGER IF EXISTS trg_service_sla_sync_catalog ON service_sla;
DROP FUNCTION IF EXISTS fn_service_sla_sync_catalog();

-- ── Mirror columns (indexes and foreign keys on them are dropped with them) ──

ALTER TABLE service_catalog
    DROP COLUMN IF EXISTS lifecycle_state,
    DROP COLUMN IF EXISTS service_status_code,
    DROP COLUMN IF EXISTS next_review_due_at,
    DROP COLUMN IF EXISTS portfolio_group_code,
    DROP COLUMN IF EXISTS sla_availability,
    DROP COLUMN IF EXISTS sla_restoration_hours,
    DROP COLUMN IF EXISTS sla_delivery_days,
    DROP COLUMN IF EXISTS sla_restoration_text,
    DROP COLUMN IF EXISTS sla_delivery_text;

CREATE INDEX IF NOT EXISTS ix_service_catalog_stage_type
    ON service_catalog(lifecycle_stage_code, service_type_code)
    INCLUDE (service_id, title, portfolio_id, is_deleted);

-- ── Recreated views (definitions from 09, 11, 12, 25, 27, 34 on canonical columns) ─

CREATE OR REPLACE VIEW v_stubcompletionqueue AS
SELECT
    sc.id,
    sc.service_id,
    sc.title,
    fn_service_status_code(sc.lifecycle_stage_code, sc.is_stub) AS service_status_code,
    sc.is_stub,
    sc.notes_json,
    sc.created_at,
    sc.updated_at,
    (
        SELECT COUNT(*)
        FROM data.service_relation sr
        WHERE sr.is_deleted = FALSE
          AND sr.from_service_id = sc.id
    ) AS outgoing_relation_count,
    (
        SELECT COUNT(*)
        FROM data.service_relation sr
        WHERE sr.is_deleted = FALSE
          AND sr.to_service_id = sc.id
    ) AS incoming_relation_count,
    (
        SELECT string_agg(refs.related_service_id, ',')
        FROM (
            SELECT DISTINCT t.service_id AS related_service_id
            FROM data.service_relation sr
            JOIN data.service_catalog t ON t.id = sr.to_service_id
            WHERE sr.is_deleted = FALSE
              AND sr.from_service_id = sc.id
            UNION
            SELECT DISTINCT f.service_id AS related_service_id
            FROM data.service_relation sr
            JOIN data.service_catalog f ON f.id = sr.from_service_id
            WHERE sr.is_deleted = FALSE
              AND sr.to_service_id = sc.id
        ) refs
    ) AS related_service_ids
FROM data.service_catalog sc
WHERE sc.is_deleted = FALSE
  AND sc.is_stub = TRUE;

CREATE OR REPLACE VIEW v_servicepublishreadiness AS
WITH active_flavours AS (
    SELECT
        sf.service_id,
        COUNT(*) AS active_flavour_count
    FROM service_flavour sf
    WHERE sf.is_deleted = FALSE
      AND lower(COALESCE(sf.flavour_status_code, '')) IN ('available', 'active')
    GROUP BY sf.service_id
),
relation_counts AS (
    SELECT
        sc.id AS service_id,
        COUNT(sr.id) AS relation_count,
        SUM(CASE WHEN sr.relation_type_code IN ('depends_on', 'prerequisite', 'underlying', 'requires_account', 'uses') THEN 1 ELSE 0 END) AS dependency_relation_count
    FROM service_catalog sc
    LEFT JOIN service_relation sr
      ON sr.is_deleted = FALSE
     AND (sr.from_service_id = sc.id OR sr.to_service_id = sc.id)
    WHERE sc.is_deleted = FALSE
    GROUP BY sc.id
),
primary_mapping AS (
    SELECT
        scm.service_id,
        COUNT(*) AS primary_mapping_count,
        MAX(CASE WHEN scm.is_primary = TRUE THEN scm.c3_uuid END) AS primary_c3_uuid
    FROM service_c3_mapping scm
    JOIN service_catalog sc
      ON sc.id = scm.service_id
     AND sc.is_deleted = FALSE
    WHERE scm.is_primary = TRUE
    GROUP BY scm.service_id
)
SELECT
    sc.id AS service_pk,
    sc.service_id,
    sc.title,
    fn_service_status_code(sc.lifecycle_stage_code, sc.is_stub) AS service_status,
    pm.primary_mapping_count,
    pm.primary_c3_uuid,
    cap.title AS primary_c3_title,
    cap.external_id AS primary_c3_code,
    comp.completeness_status AS primary_c3_completeness_status,
    comp.app_count AS primary_c3_app_count,
    comp.data_object_count AS primary_c3_data_object_count,
    comp.tin_count AS primary_c3_tin_count,
    comp.c3_service_count AS primary_c3_c3_service_count,
    comp.service_mapping_count AS primary_c3_service_mapping_count,
    COALESCE(af.active_flavour_count, 0) AS active_flavour_count,
    COALESCE(rc.relation_count, 0) AS relation_count,
    COALESCE(rc.dependency_relation_count, 0) AS dependency_relation_count,
    CASE WHEN COALESCE(pm.primary_mapping_count, 0) = 1 AND pm.primary_c3_uuid IS NOT NULL THEN TRUE ELSE FALSE END AS has_single_primary_mapping,
    CASE WHEN comp.completeness_status = 'complete' THEN TRUE ELSE FALSE END AS has_complete_primary_capability,
    CASE WHEN COALESCE(af.active_flavour_count, 0) > 0 THEN TRUE ELSE FALSE END AS has_active_flavour,
    CASE
        WHEN COALESCE(pm.primary_mapping_count, 0) = 1
         AND pm.primary_c3_uuid IS NOT NULL
         AND comp.completeness_status = 'complete'
         AND COALESCE(af.active_flavour_count, 0) > 0
        THEN TRUE ELSE FALSE
    END AS is_publishable
FROM service_catalog sc
LEFT JOIN primary_mapping pm
  ON pm.service_id = sc.id
LEFT JOIN c3_taxonomy cap
  ON cap.uuid = pm.primary_c3_uuid
LEFT JOIN v_c3capabilitycompleteness comp
  ON comp.uuid = pm.primary_c3_uuid
LEFT JOIN active_flavours af
  ON af.service_id = sc.id
LEFT JOIN relation_counts rc
  ON rc.service_id = sc.id
WHERE sc.is_deleted = FALSE
  AND sc.is_stub = FALSE;

CREATE OR REPLACE VIEW v_graphoverviewnodes AS
SELECT
    sc.id AS service_pk,
    CONCAT('svc:', sc.service_id) AS id,
    'service' AS node_kind,
    sc.title,
    sc.service_id,
    sc.service_type_code AS service_type,
    fn_service_status_code(sc.lifecycle_stage_code, sc.is_stub) AS service_status,
    sp.portfolio_code AS portfolio_group,
    (
        SELECT string_agg(sao.domain_code, ',')
        FROM service_available_on sao
        WHERE sao.service_id = sc.id
    ) AS available_on,
    sla.availability_pct AS sla_availability,
    sc.graph_x,
    sc.graph_y
FROM service_catalog sc
LEFT JOIN service_portfolio sp ON sp.id = sc.portfolio_id
LEFT JOIN service_sla sla ON sla.id = fn_service_primary_sla_id(sc.id)
WHERE sc.is_deleted = FALSE;

CREATE OR REPLACE VIEW v_capability_governance_mapping AS
SELECT
    scm.id AS mapping_id,
    sc.id AS service_pk,
    sc.service_id,
    sc.title AS service_title,
    fn_service_status_code(sc.lifecycle_stage_code, sc.is_stub) AS service_status,
    sc.lifecycle_stage_code,
    fn_lifecycle_state_from_stage(sc.lifecycle_stage_code) AS lifecycle_state,
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

CREATE OR REPLACE VIEW data.v_impact_node AS
SELECT
    CONCAT('svc:', sc.service_id) AS node_id,
    'service'::text AS node_kind,
    sc.service_id::text AS node_key,
    sc.id::text AS node_uuid,
    sc.title::text AS title,
    data.fn_service_status_code(sc.lifecycle_stage_code, sc.is_stub)::text AS status,
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

CREATE OR REPLACE VIEW v_c3_board_lane AS
SELECT
    c.uuid,
    c.title,
    c.item_type,
    c.external_id,
    c.item_status,
    COALESCE(bs.board_state,
        CASE
            WHEN LOWER(COALESCE(c.item_status, c.ss_overall_status, c.ss_baseline_status, '')) IN ('reviewed', 'approved', 'baselined') THEN 'reviewed'
            WHEN EXISTS (
                SELECT 1
                FROM service_c3_mapping scm
                JOIN service_catalog sc ON sc.id = scm.service_id
                WHERE scm.c3_uuid = c.uuid
                  AND sc.is_deleted = FALSE
                  AND sc.lifecycle_stage_code = 'active'
            ) THEN 'used'
            WHEN EXISTS (
                SELECT 1
                FROM service_c3_mapping scm
                WHERE scm.c3_uuid = c.uuid
            ) THEN 'mapped'
            WHEN COALESCE(NULLIF(BTRIM(c.item_status), ''), NULLIF(BTRIM(c.ss_overall_status), ''), NULLIF(BTRIM(c.ss_baseline_status), '')) IS NOT NULL THEN 'validated'
            ELSE 'imported'
        END
    ) AS board_state,
    COALESCE(bs.validation_status, NULLIF(BTRIM(c.item_status), ''), NULLIF(BTRIM(c.ss_overall_status), ''), NULLIF(BTRIM(c.ss_baseline_status), '')) AS validation_status,
    bs.board_state_reason,
    bs.reviewed_at,
    bs.reviewed_by,
    COALESCE(bs.updated_at, c.synced_at, c.modification_date, CURRENT_TIMESTAMP) AS updated_at
FROM c3_taxonomy c
LEFT JOIN c3_board_state bs ON bs.c3_uuid = c.uuid;

SET search_path TO platform, public;

INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '39_drop_legacy_service_mirrors',
    'Drop legacy service mirror columns',
    '3.6.0',
    'Removes lifecycle_state, service_status_code, next_review_due_at, portfolio_group_code and catalogue sla_* columns; views read canonical fields.'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    schema_version  = EXCLUDED.schema_version,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
