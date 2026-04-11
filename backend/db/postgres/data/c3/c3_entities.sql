-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL C3 entity seed
-- data/c3/c3_entities.sql
-- Source: shared/c3/c3-*-seed.json + TI link snapshots
-- =============================================================================

SET search_path TO data, public;

DO $$
DECLARE
    v_seed_key TEXT := 'c3.entities.baseline.v1';
    v_seed_source TEXT := '/shared/c3/c3-*-seed.json';
    v_should_seed BOOLEAN;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM c3_entity_seed_snapshot_state
        WHERE seed_key = v_seed_key
    ) THEN
        RAISE NOTICE 'C3 entity seed "%" already exists, skipping.', v_seed_key;
    ELSE
        SELECT
            COUNT(*) = 0
            AND (SELECT COUNT(*) FROM c3_application) = 0
            AND (SELECT COUNT(*) FROM c3_data_object) = 0
            AND (SELECT COUNT(*) FROM c3_service) = 0
            AND (SELECT COUNT(*) FROM c3_technology_interaction) = 0
            AND (SELECT COUNT(*) FROM c3_technology_interaction_service_link) = 0
            AND (SELECT COUNT(*) FROM c3_technology_interaction_application_link) = 0
            AND (SELECT COUNT(*) FROM c3_technology_interaction_data_object_link) = 0
        INTO v_should_seed
        FROM c3_entity_seed_snapshot_state;

        IF v_should_seed THEN
            INSERT INTO c3_service (
                id, service_code, uuid, modification_date, order_num,
                ss_overall_status, ss_baseline_status, item_status, data_source,
                external_id, data_qualifier, title, source_description,
                revised_description, description, revised, raw_json,
                synced_at, created_at, updated_at
            ) OVERRIDING SYSTEM VALUE
            SELECT
                src.id,
                src.service_code,
                src.uuid,
                parse_seed_timestamptz(src.modification_date),
                src.order_num,
                src.ss_overall_status,
                src.ss_baseline_status,
                src.item_status,
                src.data_source,
                src.external_id,
                src.data_qualifier,
                src.title,
                src.source_description,
                src.revised_description,
                src.description,
                src.revised,
                src.raw_json,
                parse_seed_timestamptz(src.synced_at),
                parse_seed_timestamptz(src.created_at),
                parse_seed_timestamptz(src.updated_at)
            FROM jsonb_to_recordset(pg_read_file('/shared/c3/c3-services-seed.json')::jsonb) AS src(
                id BIGINT,
                service_code TEXT,
                uuid TEXT,
                modification_date TEXT,
                order_num INTEGER,
                ss_overall_status TEXT,
                ss_baseline_status TEXT,
                item_status TEXT,
                data_source TEXT,
                external_id TEXT,
                data_qualifier TEXT,
                title TEXT,
                source_description TEXT,
                revised_description TEXT,
                description TEXT,
                revised BOOLEAN,
                raw_json TEXT,
                synced_at TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            INSERT INTO c3_application (
                id, application_code, uuid, modification_date, order_num,
                ss_overall_status, ss_baseline_status, item_status, data_source,
                external_id, data_qualifier, title, source_description,
                revised_description, description, revised, raw_json,
                synced_at, created_at, updated_at
            ) OVERRIDING SYSTEM VALUE
            SELECT
                src.id,
                src.application_code,
                src.uuid,
                parse_seed_timestamptz(src.modification_date),
                src.order_num,
                src.ss_overall_status,
                src.ss_baseline_status,
                src.item_status,
                src.data_source,
                src.external_id,
                src.data_qualifier,
                src.title,
                src.source_description,
                src.revised_description,
                src.description,
                src.revised,
                src.raw_json,
                parse_seed_timestamptz(src.synced_at),
                parse_seed_timestamptz(src.created_at),
                parse_seed_timestamptz(src.updated_at)
            FROM jsonb_to_recordset(pg_read_file('/shared/c3/c3-applications-seed.json')::jsonb) AS src(
                id BIGINT,
                application_code TEXT,
                uuid TEXT,
                modification_date TEXT,
                order_num INTEGER,
                ss_overall_status TEXT,
                ss_baseline_status TEXT,
                item_status TEXT,
                data_source TEXT,
                external_id TEXT,
                data_qualifier TEXT,
                title TEXT,
                source_description TEXT,
                revised_description TEXT,
                description TEXT,
                revised BOOLEAN,
                raw_json TEXT,
                synced_at TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            INSERT INTO c3_data_object (
                id, data_object_code, uuid, modification_date, order_num,
                ss_overall_status, ss_baseline_status, item_status, title,
                description, provenance_raw, references_raw, standards_raw,
                raw_json, synced_at, created_at, updated_at
            ) OVERRIDING SYSTEM VALUE
            SELECT
                src.id,
                src.data_object_code,
                src.uuid,
                parse_seed_timestamptz(src.modification_date),
                src.order_num,
                src.ss_overall_status,
                src.ss_baseline_status,
                src.item_status,
                src.title,
                src.description,
                src.provenance_raw,
                src.references_raw,
                src.standards_raw,
                src.raw_json,
                parse_seed_timestamptz(src.synced_at),
                parse_seed_timestamptz(src.created_at),
                parse_seed_timestamptz(src.updated_at)
            FROM jsonb_to_recordset(pg_read_file('/shared/c3/c3-data-objects-seed.json')::jsonb) AS src(
                id BIGINT,
                data_object_code TEXT,
                uuid TEXT,
                modification_date TEXT,
                order_num INTEGER,
                ss_overall_status TEXT,
                ss_baseline_status TEXT,
                item_status TEXT,
                title TEXT,
                description TEXT,
                provenance_raw TEXT,
                references_raw TEXT,
                standards_raw TEXT,
                raw_json TEXT,
                synced_at TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            INSERT INTO c3_technology_interaction (
                id, technology_interaction_code, uuid, modification_date, order_num,
                ss_overall_status, ss_baseline_status, item_status,
                ciav_review_status, mcsma_review_status, service_instructions,
                title, technology_interaction_type, technology_interaction_maturity,
                technology_interactions_1_raw, description, conditionality,
                services_1_raw, applications_1_raw, services_2_raw,
                technology_interactions_2_raw, technology_interactions_3_raw,
                services_3_raw, applications_2_raw, data_objects_raw,
                raw_json, synced_at, created_at, updated_at
            ) OVERRIDING SYSTEM VALUE
            SELECT
                src.id,
                src.technology_interaction_code,
                src.uuid,
                parse_seed_timestamptz(src.modification_date),
                src.order_num,
                src.ss_overall_status,
                src.ss_baseline_status,
                src.item_status,
                src.ciav_review_status,
                src.mcsma_review_status,
                src.service_instructions,
                src.title,
                src.technology_interaction_type,
                src.technology_interaction_maturity,
                src.technology_interactions_1_raw,
                src.description,
                src.conditionality,
                src.services_1_raw,
                src.applications_1_raw,
                src.services_2_raw,
                src.technology_interactions_2_raw,
                src.technology_interactions_3_raw,
                src.services_3_raw,
                src.applications_2_raw,
                src.data_objects_raw,
                src.raw_json,
                parse_seed_timestamptz(src.synced_at),
                parse_seed_timestamptz(src.created_at),
                parse_seed_timestamptz(src.updated_at)
            FROM jsonb_to_recordset(pg_read_file('/shared/c3/c3-technology-interactions-seed.json')::jsonb) AS src(
                id BIGINT,
                technology_interaction_code TEXT,
                uuid TEXT,
                modification_date TEXT,
                order_num INTEGER,
                ss_overall_status TEXT,
                ss_baseline_status TEXT,
                item_status TEXT,
                ciav_review_status TEXT,
                mcsma_review_status TEXT,
                service_instructions TEXT,
                title TEXT,
                technology_interaction_type TEXT,
                technology_interaction_maturity TEXT,
                technology_interactions_1_raw TEXT,
                description TEXT,
                conditionality TEXT,
                services_1_raw TEXT,
                applications_1_raw TEXT,
                services_2_raw TEXT,
                technology_interactions_2_raw TEXT,
                technology_interactions_3_raw TEXT,
                services_3_raw TEXT,
                applications_2_raw TEXT,
                data_objects_raw TEXT,
                raw_json TEXT,
                synced_at TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            -- ── TI Service links — derived from raw text fields ──────────────
            INSERT INTO c3_technology_interaction_service_link (
                technology_interaction_id, c3_service_id, source_slot, ref_value
            )
            SELECT DISTINCT
                ti.id,
                s.id,
                slot.source_slot,
                btrim(ref.ref_value)
            FROM c3_technology_interaction ti
            CROSS JOIN LATERAL (
                VALUES
                    ('services_1', ti.services_1_raw),
                    ('services_2', ti.services_2_raw),
                    ('services_3', ti.services_3_raw)
            ) AS slot(source_slot, raw_text)
            CROSS JOIN LATERAL regexp_split_to_table(
                regexp_replace(COALESCE(slot.raw_text, ''), E'[\\r\\n;]+', ',', 'g'), ','
            ) AS ref(ref_value)
            JOIN c3_service s ON s.service_code = btrim(ref.ref_value) OR s.uuid = btrim(ref.ref_value)
            WHERE btrim(ref.ref_value) <> '';

            -- ── TI Application links — derived from raw text fields ──────────
            INSERT INTO c3_technology_interaction_application_link (
                technology_interaction_id, c3_application_id, source_slot, ref_value
            )
            SELECT DISTINCT
                ti.id,
                a.id,
                slot.source_slot,
                btrim(ref.ref_value)
            FROM c3_technology_interaction ti
            CROSS JOIN LATERAL (
                VALUES
                    ('applications_1', ti.applications_1_raw),
                    ('applications_2', ti.applications_2_raw)
            ) AS slot(source_slot, raw_text)
            CROSS JOIN LATERAL regexp_split_to_table(
                regexp_replace(COALESCE(slot.raw_text, ''), E'[\\r\\n;]+', ',', 'g'), ','
            ) AS ref(ref_value)
            JOIN c3_application a ON a.application_code = btrim(ref.ref_value) OR a.uuid = btrim(ref.ref_value)
            WHERE btrim(ref.ref_value) <> '';

            -- ── TI Data Object links — derived from raw text fields ──────────
            INSERT INTO c3_technology_interaction_data_object_link (
                technology_interaction_id, c3_data_object_id, source_slot, ref_value
            )
            SELECT DISTINCT
                ti.id,
                d.id,
                'data_objects',
                btrim(ref.ref_value)
            FROM c3_technology_interaction ti
            CROSS JOIN LATERAL regexp_split_to_table(
                regexp_replace(COALESCE(ti.data_objects_raw, ''), E'[\\r\\n;]+', ',', 'g'), ','
            ) AS ref(ref_value)
            JOIN c3_data_object d ON d.data_object_code = btrim(ref.ref_value) OR d.uuid = btrim(ref.ref_value)
            WHERE btrim(ref.ref_value) <> '';

            PERFORM setval(pg_get_serial_sequence('data.c3_service', 'id'), COALESCE((SELECT MAX(id) FROM c3_service), 1), TRUE);
            PERFORM setval(pg_get_serial_sequence('data.c3_application', 'id'), COALESCE((SELECT MAX(id) FROM c3_application), 1), TRUE);
            PERFORM setval(pg_get_serial_sequence('data.c3_data_object', 'id'), COALESCE((SELECT MAX(id) FROM c3_data_object), 1), TRUE);
            PERFORM setval(pg_get_serial_sequence('data.c3_technology_interaction', 'id'), COALESCE((SELECT MAX(id) FROM c3_technology_interaction), 1), TRUE);
            PERFORM setval(pg_get_serial_sequence('data.c3_technology_interaction_service_link', 'id'), COALESCE((SELECT MAX(id) FROM c3_technology_interaction_service_link), 1), TRUE);
            PERFORM setval(pg_get_serial_sequence('data.c3_technology_interaction_application_link', 'id'), COALESCE((SELECT MAX(id) FROM c3_technology_interaction_application_link), 1), TRUE);
            PERFORM setval(pg_get_serial_sequence('data.c3_technology_interaction_data_object_link', 'id'), COALESCE((SELECT MAX(id) FROM c3_technology_interaction_data_object_link), 1), TRUE);

            INSERT INTO c3_entity_seed_snapshot_state (seed_key, seed_source)
            VALUES (v_seed_key, v_seed_source)
            ON CONFLICT (seed_key) DO NOTHING;
        ELSE
            RAISE NOTICE 'C3 entity seed skipped — target tables are not empty.';
        END IF;
    END IF;
END
$$;
