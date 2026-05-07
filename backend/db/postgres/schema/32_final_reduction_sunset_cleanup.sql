-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 32_final_reduction_sunset_cleanup.sql | final v1.2 sunset cleanup
-- =============================================================================

SET search_path TO data, public;

DROP VIEW IF EXISTS v_gap_duplication_advisor;
DROP VIEW IF EXISTS v_contract_renewal_risk;
DROP VIEW IF EXISTS v_contract_overlap;
DROP VIEW IF EXISTS v_service_risk_radar;
DROP VIEW IF EXISTS v_owner_load;

CREATE VIEW v_owner_load AS
WITH service_base AS (
    SELECT
        sc.id AS service_pk,
        COALESCE(NULLIF(owner.email, ''), NULLIF(owner.display_name, ''), 'unassigned') AS owner_key,
        COALESCE(NULLIF(owner.display_name, ''), 'Unassigned') AS owner_name,
        owner.email AS owner_email,
        CASE WHEN LOWER(COALESCE(sc.lifecycle_state, '')) = 'live' OR sc.service_status_code = 'active' THEN 1 ELSE 0 END AS live_flag,
        CASE WHEN sc.service_type_code IN ('CF', 'CFS') THEN 1 ELSE 0 END AS critical_flag,
        CASE WHEN sc.next_review_due_at IS NULL OR sc.next_review_due_at < CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS overdue_review_flag,
        CASE WHEN support.support_model_count = 0 OR owner.email IS NULL AND owner.display_name IS NULL THEN 1 ELSE 0 END AS readiness_blocker_flag,
        CASE WHEN mapping.c3_mapping_count = 0 THEN 1 ELSE 0 END AS c3_gap_flag
    FROM service_catalog sc
    LEFT JOIN LATERAL (
        SELECT sra.display_name, sra.email
        FROM service_role_assignment sra
        WHERE sra.service_id = sc.id
          AND sra.role_code = 'service_owner'
          AND sra.valid_to IS NULL
        ORDER BY sra.created_at DESC
        LIMIT 1
    ) owner ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS support_model_count
        FROM service_support_model sm
        WHERE sm.service_id = sc.id
    ) support ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS c3_mapping_count
        FROM service_c3_mapping scm
        WHERE scm.service_id = sc.id
    ) mapping ON TRUE
    WHERE sc.is_deleted = FALSE
      AND sc.is_stub = FALSE
), owner_stats AS (
    SELECT
        owner_key,
        owner_name,
        owner_email,
        COUNT(*)::integer AS owned_services,
        SUM(live_flag)::integer AS live_services,
        SUM(critical_flag)::integer AS critical_services,
        SUM(readiness_blocker_flag)::integer AS readiness_blockers,
        SUM(overdue_review_flag)::integer AS overdue_reviews,
        SUM(c3_gap_flag)::integer AS c3_gaps
    FROM service_base
    GROUP BY owner_key, owner_name, owner_email
)
SELECT
    owner_key,
    owner_name,
    owner_email,
    owned_services,
    live_services,
    critical_services,
    readiness_blockers,
    overdue_reviews,
    c3_gaps,
    (
        owned_services * 1
        + live_services * 2
        + critical_services * 3
        + readiness_blockers * 4
        + overdue_reviews * 3
        + c3_gaps * 2
    )::integer AS owner_load_score
FROM owner_stats;

DROP TABLE IF EXISTS governance_finding_dismissal;
DROP TABLE IF EXISTS governance_finding;
DROP TABLE IF EXISTS contract_capability_link;
DROP TABLE IF EXISTS contract_service_link;
DROP TABLE IF EXISTS contract;
DROP TABLE IF EXISTS vendor;

SET search_path TO platform, public;
INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '32_final_reduction_sunset_cleanup',
    'Final v1.2 reduction sunset cleanup',
    '2.8.0',
    'Removes retired risk/advisor/procurement DB objects and keeps owner load as a service/readiness/C3 view'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
