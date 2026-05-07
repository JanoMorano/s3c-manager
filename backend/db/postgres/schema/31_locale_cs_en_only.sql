-- =============================================================================
-- SERVICE CATALOGUE - PostgreSQL canonical schema
-- 31_locale_cs_en_only.sql | reduce UI locales to Czech and English
-- =============================================================================

SET search_path TO platform, public;

UPDATE users
SET preferred_lang = CASE
    WHEN split_part(lower(replace(coalesce(preferred_lang, ''), '_', '-')), '-', 1) = 'en' THEN 'en'
    ELSE 'cs'
END
WHERE preferred_lang IS NULL
   OR preferred_lang NOT IN ('cs', 'en');

DO $$
BEGIN
    ALTER TABLE users
        DROP CONSTRAINT IF EXISTS chk_users_preferred_lang;

    ALTER TABLE users
        ADD CONSTRAINT chk_users_preferred_lang
        CHECK (preferred_lang IN ('cs', 'en') OR preferred_lang IS NULL);
END $$;

INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '31_locale_cs_en_only',
    'Reduce supported UI locales to Czech and English',
    '2.2.0-reduction',
    'Migrates sk/de/legacy locale preferences to the canonical cs/en product decision and enforces the new allowed set.'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
