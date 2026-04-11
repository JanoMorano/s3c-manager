-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL C3 taxonomy seed
-- data/c3/c3_taxonomy.sql
-- Source: baseline or XLSX import snapshot depending on the init parameter
-- =============================================================================

SET search_path TO data, public;

DO $$
DECLARE
    v_seed_key TEXT := current_setting('app.taxonomy_seed_key', true);
    v_seed_source TEXT := current_setting('app.taxonomy_seed_source', true);
    v_seed_path TEXT := current_setting('app.taxonomy_seed_path', true);
BEGIN
    IF EXISTS (
        SELECT 1
        FROM c3_entity_seed_snapshot_state
        WHERE seed_key = v_seed_key
    ) THEN
        RAISE NOTICE 'C3 taxonomy seed "%" already exists, skipping.', v_seed_key;
    ELSE
        TRUNCATE TABLE
            c3_capability_c3_service_link,
            c3_capability_data_object_link,
            c3_capability_tin_link,
            c3_capability_application_link
        RESTART IDENTITY;

        DELETE FROM c3_taxonomy;

        INSERT INTO c3_taxonomy (
            id, uuid, application, title, description, source_description,
            revised_description, external_id, source_external_id, data_qualifier,
            data_source, ss_overall_status, ss_baseline_status, item_status,
            order_num, modification_date, revised, synced_at, abbreviation,
            synonym, script_raw, datasets_raw, standards_raw, references_raw,
            provenance_raw, item_type, level_num, parent_code, parent_uuid
        ) OVERRIDING SYSTEM VALUE
        SELECT
            src.id,
            src.uuid,
            src.application,
            src.title,
            src.description,
            src.source_description,
            src.revised_description,
            src.external_id,
            src.source_external_id,
            src.data_qualifier,
            src.data_source,
            src.ss_overall_status,
            src.ss_baseline_status,
            src.item_status,
            src.order_num,
            parse_seed_timestamptz(src.modification_date),
            src.revised,
            parse_seed_timestamptz(src.synced_at),
            src.abbreviation,
            src.synonym,
            src.script_raw,
            src.datasets_raw,
            src.standards_raw,
            src.references_raw,
            src.provenance_raw,
            src.item_type,
            src.level_num,
            src.parent_code,
            src.parent_uuid
        FROM jsonb_to_recordset(pg_read_file(v_seed_path)::jsonb) AS src(
            id BIGINT,
            uuid TEXT,
            application TEXT,
            title TEXT,
            description TEXT,
            source_description TEXT,
            revised_description TEXT,
            external_id TEXT,
            source_external_id TEXT,
            data_qualifier TEXT,
            data_source TEXT,
            ss_overall_status TEXT,
            ss_baseline_status TEXT,
            item_status TEXT,
            order_num INTEGER,
            modification_date TEXT,
            revised BOOLEAN,
            synced_at TEXT,
            abbreviation TEXT,
            synonym TEXT,
            script_raw TEXT,
            datasets_raw TEXT,
            standards_raw TEXT,
            references_raw TEXT,
            provenance_raw TEXT,
            item_type TEXT,
            level_num INTEGER,
            parent_code TEXT,
            parent_uuid TEXT
        );

        PERFORM setval(pg_get_serial_sequence('data.c3_taxonomy', 'id'), COALESCE((SELECT MAX(id) FROM c3_taxonomy), 1), TRUE);

        INSERT INTO c3_entity_seed_snapshot_state (seed_key, seed_source)
        VALUES (v_seed_key, v_seed_source)
        ON CONFLICT (seed_key) DO NOTHING;
    END IF;
END
$$;
