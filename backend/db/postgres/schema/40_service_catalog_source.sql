-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 40_service_catalog_source.sql | schema: data
--
-- Slims data.service_catalog down to curated catalogue fields.
--
-- 1. Import provenance moves to data.service_catalog_source (1:1):
--      source_local_id, source_sp_id, source_etag, created_at_source,
--      modified_at_source, is_available_status_ambiguous  → typed columns
--      *_raw / *_json import columns                      → raw_fields JSONB
--    raw_fields keys are the former column names; values are the former text.
--
-- 2. Description fields are merged (no text is lost):
--      value_proposition, business_purpose → consumer_value (distinct texts
--                                            joined by a blank line)
--      business_summary                    → short_description when empty,
--                                            otherwise prepended to description
--
-- The API keeps returning the moved raw fields (joined from the source table)
-- and accepts the merged description fields as input.
-- Idempotent: every step checks that the old column still exists.
-- =============================================================================

SET search_path TO data, public;

CREATE TABLE IF NOT EXISTS service_catalog_source (
    service_catalog_id            BIGINT        NOT NULL PRIMARY KEY
                                  REFERENCES service_catalog(id) ON DELETE CASCADE,
    source_local_id               VARCHAR(100)  NULL,
    source_sp_id                  INTEGER       NULL,
    source_etag                   VARCHAR(255)  NULL,
    created_at_source             TIMESTAMPTZ   NULL,
    modified_at_source            TIMESTAMPTZ   NULL,
    is_available_status_ambiguous BOOLEAN       NOT NULL DEFAULT FALSE,
    raw_fields                    JSONB         NOT NULL DEFAULT '{}'::jsonb,
    updated_at                    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE service_catalog_source IS
    'Import provenance of a catalogue service: source identifiers and raw imported fields (raw_fields keys = former service_catalog column names).';
COMMENT ON COLUMN service_catalog_source.is_available_status_ambiguous IS
    'TRUE when "Not Available" was mapped to planned during import.';

DO $$
DECLARE
    raw_columns CONSTANT TEXT[] := ARRAY[
        'support_locations_raw', 'request_process_raw', 'support_availability_raw',
        'service_cost_raw', 'additional_information_raw', 'cp_service_type_raw',
        'service_features_raw', 'ext_tools_raw', 'legacy_ssl_mapping_raw',
        'other_info_raw', 'pricing_note_raw', 'service_area_raw',
        'customer_type_json', 'options_json', 'training_refs_json',
        'prerequisites_json', 'dependencies_json'
    ];
    source_columns CONSTANT TEXT[] := ARRAY[
        'source_local_id', 'source_sp_id', 'source_etag',
        'created_at_source', 'modified_at_source', 'is_available_status_ambiguous'
    ];
    present TEXT[];
    raw_expr TEXT;
    col TEXT;
BEGIN
    SELECT array_agg(column_name::text) INTO present
    FROM information_schema.columns
    WHERE table_schema = 'data' AND table_name = 'service_catalog'
      AND column_name = ANY (raw_columns || source_columns);

    IF present IS NOT NULL THEN
        SELECT string_agg(format('%L, NULLIF(sc.%I::text, %L)', c, c, ''), ', ')
        INTO raw_expr
        FROM unnest(raw_columns) AS c
        WHERE c = ANY (present);

        EXECUTE format($sql$
            INSERT INTO service_catalog_source (
                service_catalog_id, source_local_id, source_sp_id, source_etag,
                created_at_source, modified_at_source, is_available_status_ambiguous, raw_fields
            )
            SELECT sc.id, %s, %s, %s, %s, %s, %s, %s
            FROM service_catalog sc
            ON CONFLICT (service_catalog_id) DO NOTHING
        $sql$,
            CASE WHEN 'source_local_id' = ANY (present) THEN 'sc.source_local_id' ELSE 'NULL' END,
            CASE WHEN 'source_sp_id' = ANY (present) THEN 'sc.source_sp_id' ELSE 'NULL' END,
            CASE WHEN 'source_etag' = ANY (present) THEN 'sc.source_etag' ELSE 'NULL' END,
            CASE WHEN 'created_at_source' = ANY (present) THEN 'sc.created_at_source' ELSE 'NULL' END,
            CASE WHEN 'modified_at_source' = ANY (present) THEN 'sc.modified_at_source' ELSE 'NULL' END,
            CASE WHEN 'is_available_status_ambiguous' = ANY (present) THEN 'COALESCE(sc.is_available_status_ambiguous, FALSE)' ELSE 'FALSE' END,
            CASE WHEN raw_expr IS NULL THEN '''{}''::jsonb' ELSE format('jsonb_strip_nulls(jsonb_build_object(%s))', raw_expr) END
        );

        FOREACH col IN ARRAY present LOOP
            EXECUTE format('ALTER TABLE service_catalog DROP COLUMN IF EXISTS %I', col);
        END LOOP;
    END IF;
END $$;

-- Services without any import provenance need no source row.
DELETE FROM service_catalog_source
WHERE raw_fields = '{}'::jsonb
  AND source_local_id IS NULL AND source_sp_id IS NULL AND source_etag IS NULL
  AND created_at_source IS NULL AND modified_at_source IS NULL
  AND is_available_status_ambiguous = FALSE;

-- Description fields.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'data' AND table_name = 'service_catalog'
                 AND column_name IN ('value_proposition', 'business_purpose')) THEN
        EXECUTE $sql$
            UPDATE service_catalog sc
            SET consumer_value = merged.text
            FROM (
                SELECT id, string_agg(part, E'\n\n' ORDER BY ord) AS text
                FROM (
                    SELECT DISTINCT ON (id, btrim(part)) id, btrim(part) AS part, ord
                    FROM service_catalog,
                         LATERAL (VALUES (1, consumer_value), (2, value_proposition), (3, business_purpose)) AS v(ord, part)
                    WHERE NULLIF(btrim(part), '') IS NOT NULL
                    ORDER BY id, btrim(part), ord
                ) parts
                GROUP BY id
            ) merged
            WHERE merged.id = sc.id
              AND merged.text IS DISTINCT FROM sc.consumer_value
        $sql$;
        ALTER TABLE service_catalog DROP COLUMN IF EXISTS value_proposition;
        ALTER TABLE service_catalog DROP COLUMN IF EXISTS business_purpose;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'data' AND table_name = 'service_catalog'
                 AND column_name = 'business_summary') THEN
        EXECUTE $sql$
            UPDATE service_catalog
            SET short_description = CASE
                    WHEN NULLIF(btrim(short_description), '') IS NULL THEN left(btrim(business_summary), 1000)
                    ELSE short_description
                END,
                description = CASE
                    WHEN NULLIF(btrim(short_description), '') IS NULL
                         AND length(btrim(business_summary)) <= 1000 THEN description
                    WHEN btrim(business_summary) = btrim(short_description)
                         OR position(btrim(business_summary) IN COALESCE(description, '')) > 0 THEN description
                    ELSE btrim(business_summary) || COALESCE(E'\n\n' || NULLIF(btrim(description), ''), '')
                END
            WHERE NULLIF(btrim(business_summary), '') IS NOT NULL
        $sql$;
        ALTER TABLE service_catalog DROP COLUMN IF EXISTS business_summary;
    END IF;
END $$;

SET search_path TO platform, public;

INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '40_service_catalog_source',
    'Service catalogue import provenance table and merged description fields',
    '3.7.0',
    'Moves import raw/source columns to data.service_catalog_source; merges value_proposition/business_purpose into consumer_value and business_summary into short_description/description.'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    schema_version  = EXCLUDED.schema_version,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
