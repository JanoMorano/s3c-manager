-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 18_user_persona.sql | platform user persona preference
-- =============================================================================

SET search_path TO platform, public;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS preferred_persona VARCHAR(32) NOT NULL DEFAULT 'service_owner';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_users_persona'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT chk_users_persona
            CHECK (preferred_persona IN ('consumer','service_owner','capability_manager','admin'));
    END IF;
END $$;

INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '18_user_persona',
    'Persona preference for user-driven UX lenses',
    '2.2.0',
    'Adds preferred_persona to platform.users for Consumer, Service Owner, Capability Manager, and Administrator journeys'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
