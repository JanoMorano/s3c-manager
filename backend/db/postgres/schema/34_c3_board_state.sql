-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 34_c3_board_state.sql | schema: data
-- C3 governance board state and board lane view.
--
-- Live part of 28_enterprise_governance_contracts.sql, which was never wired
-- into init-db-postgres.sh. Owned by the C3 taxonomy module because the table
-- references c3_taxonomy. Idempotent, safe to re-run on installs that already
-- applied 28.
-- =============================================================================

SET search_path TO data, public;

CREATE TABLE IF NOT EXISTS c3_board_state (
    c3_uuid            VARCHAR(100) PRIMARY KEY REFERENCES c3_taxonomy(uuid) ON DELETE CASCADE,
    board_state        VARCHAR(40) NOT NULL DEFAULT 'imported',
    validation_status  VARCHAR(40) NULL,
    board_state_reason TEXT NULL,
    reviewed_at        TIMESTAMPTZ NULL,
    reviewed_by        VARCHAR(255) NULL,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by         VARCHAR(255) NULL,
    CONSTRAINT chk_c3_board_state
        CHECK (board_state IN ('imported', 'validated', 'mapped', 'used', 'reviewed'))
);

CREATE INDEX IF NOT EXISTS ix_c3_board_state_state
    ON c3_board_state(board_state, updated_at DESC);

COMMENT ON TABLE c3_board_state IS
    'Governance board state for C3 items. Source item_status remains content/source status.';

INSERT INTO c3_board_state (c3_uuid, board_state, validation_status, board_state_reason)
SELECT
    c.uuid,
    CASE
        WHEN LOWER(COALESCE(c.item_status, c.ss_overall_status, c.ss_baseline_status, '')) IN ('reviewed', 'approved', 'baselined') THEN 'reviewed'
        WHEN EXISTS (
            SELECT 1
            FROM service_c3_mapping scm
            JOIN service_catalog sc ON sc.id = scm.service_id
            WHERE scm.c3_uuid = c.uuid
              AND sc.is_deleted = FALSE
              AND LOWER(COALESCE(sc.lifecycle_stage_code, sc.service_status_code, sc.lifecycle_state, '')) IN ('active', 'published', 'live')
        ) THEN 'used'
        WHEN EXISTS (
            SELECT 1
            FROM service_c3_mapping scm
            WHERE scm.c3_uuid = c.uuid
        ) THEN 'mapped'
        WHEN COALESCE(NULLIF(BTRIM(c.item_status), ''), NULLIF(BTRIM(c.ss_overall_status), ''), NULLIF(BTRIM(c.ss_baseline_status), '')) IS NOT NULL THEN 'validated'
        ELSE 'imported'
    END AS board_state,
    COALESCE(NULLIF(BTRIM(c.item_status), ''), NULLIF(BTRIM(c.ss_overall_status), ''), NULLIF(BTRIM(c.ss_baseline_status), '')) AS validation_status,
    'Initial state derived from C3 import metadata and service mappings.' AS board_state_reason
FROM c3_taxonomy c
ON CONFLICT (c3_uuid) DO NOTHING;

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
                  AND LOWER(COALESCE(sc.lifecycle_stage_code, sc.service_status_code, sc.lifecycle_state, '')) IN ('active', 'published', 'live')
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
    '34_c3_board_state',
    'C3 governance board state',
    '3.1.0',
    'Adds c3_board_state and v_c3_board_lane (split from 28).'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    schema_version  = EXCLUDED.schema_version,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
