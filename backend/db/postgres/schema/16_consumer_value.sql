-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 16_consumer_value.sql | schema: data
-- Additive: consumer_value field on service_catalog.
-- =============================================================================

SET search_path TO data, public;

ALTER TABLE service_catalog
    ADD COLUMN IF NOT EXISTS consumer_value TEXT NULL;

-- Migration tracking
INSERT INTO platform.schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '16_consumer_value',
    'Consumer value additive column',
    '2.2.1',
    'Adds additive consumer_value field to data.service_catalog'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    schema_version  = EXCLUDED.schema_version,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
