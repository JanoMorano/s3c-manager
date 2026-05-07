-- =============================================================================
-- SERVICE CATALOGUE - Reduction low-risk cleanup
-- 29_reduction_low_risk_cleanup.sql | retired request/notification/preferences
-- =============================================================================

-- Preconditions:
-- - UI and API callers were retired in reduction stages 1-8.
-- - A PostgreSQL backup/export exists before applying this cleanup.
-- - Objects with active import, readiness, audit, auth, C3, or export-bundle readers are not dropped here.

SET search_path TO platform, public;

DROP TABLE IF EXISTS user_notification;
DROP TABLE IF EXISTS notification;
DROP TABLE IF EXISTS user_preferences;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS chk_users_persona;

ALTER TABLE users
    DROP COLUMN IF EXISTS preferred_persona;

SET search_path TO data, public;

DROP TABLE IF EXISTS service_request;
DROP SEQUENCE IF EXISTS service_request_number_seq;

DROP VIEW IF EXISTS v_importbatcharchiveexport;
DROP VIEW IF EXISTS v_importrowarchiveexport;
DROP VIEW IF EXISTS v_importissuearchiveexport;
DROP VIEW IF EXISTS v_taxonomymappingauditarchiveexport;
DROP VIEW IF EXISTS v_graphlayoutauditarchiveexport;

SET search_path TO platform, public;

INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '29_reduction_low_risk_cleanup',
    'Reduction low-risk cleanup',
    '2.9.0',
    'Drops retired notification/request/preference objects, preferred_persona, and orphan archive export views.'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
