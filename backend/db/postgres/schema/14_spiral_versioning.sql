-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 14_spiral_versioning.sql | schema: data
-- Adds the fmn_spiral column to C3 entities and seeds the Spiral_7 baseline.
-- =============================================================================

SET search_path TO data, public;

-- ── fmn_spiral on C3 data tables ─────────────────────────────────────────────

ALTER TABLE c3_taxonomy
    ADD COLUMN IF NOT EXISTS fmn_spiral VARCHAR(20) NULL;

ALTER TABLE c3_application
    ADD COLUMN IF NOT EXISTS fmn_spiral VARCHAR(20) NULL;

ALTER TABLE c3_data_object
    ADD COLUMN IF NOT EXISTS fmn_spiral VARCHAR(20) NULL;

ALTER TABLE c3_service
    ADD COLUMN IF NOT EXISTS fmn_spiral VARCHAR(20) NULL;

ALTER TABLE c3_technology_interaction
    ADD COLUMN IF NOT EXISTS fmn_spiral VARCHAR(20) NULL;

ALTER TABLE c3_capability_builder
    ADD COLUMN IF NOT EXISTS fmn_spiral VARCHAR(20) NULL;

-- ── Indexes for spiral-based filtering ───────────────────────────────────────

CREATE INDEX IF NOT EXISTS ix_c3_taxonomy_fmn_spiral
    ON c3_taxonomy(fmn_spiral)
    WHERE fmn_spiral IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_c3_application_fmn_spiral
    ON c3_application(fmn_spiral)
    WHERE fmn_spiral IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_c3_data_object_fmn_spiral
    ON c3_data_object(fmn_spiral)
    WHERE fmn_spiral IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_c3_service_fmn_spiral
    ON c3_service(fmn_spiral)
    WHERE fmn_spiral IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_c3_technology_interaction_fmn_spiral
    ON c3_technology_interaction(fmn_spiral)
    WHERE fmn_spiral IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_c3_capability_builder_fmn_spiral
    ON c3_capability_builder(fmn_spiral)
    WHERE fmn_spiral IS NOT NULL;

-- ── Spiral baseline seed ─────────────────────────────────────────────────────

INSERT INTO ref_spiral_baseline (
    spiral_code,
    spiral_label,
    is_active,
    notes
)
VALUES
    (
        'Spiral_4',
        'Spiral 4',
        FALSE,
        'Historical Spiral 4 baseline; inactive until explicitly enabled.'
    ),
    (
        'Spiral_5',
        'Spiral 5',
        FALSE,
        'Spiral 5 baseline used by FMN Air C2 procedural/service instruction parity.'
    ),
    (
        'Spiral_7',
        'Spiral 7',
        FALSE,
        'Spiral 7 baseline; activate through admin → Taxonomy → Spiral management.'
    )
ON CONFLICT (spiral_code) DO UPDATE SET
    spiral_label = EXCLUDED.spiral_label,
    notes = EXCLUDED.notes;

-- ── Migration tracking ───────────────────────────────────────────────────────

INSERT INTO platform.schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '14_spiral_versioning',
    'FMN Spiral versioning — fmn_spiral columns on C3 entity tables, Spiral_4/5/7 seed',
    '2.1.0',
    'fmn_spiral VARCHAR(20) added to c3_taxonomy, c3_application, c3_data_object, c3_service, c3_technology_interaction, c3_capability_builder; Spiral_4/5/7 seeded into ref_spiral_baseline'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
