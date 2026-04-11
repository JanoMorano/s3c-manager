-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL C3 dashboard seed
-- data/c3/c3_dashboard.sql
--
-- Seed 1: ref_c3_capability_domain — always, without file dependencies
-- Seed 2: c3_capability_builder    — only if INIT_WITH_C3_CAPABILITY_MAP_SEED=true
--                                    reads /shared/c3/capability-map-<spiral>.json
-- =============================================================================

SET search_path TO data, public;

-- ── Domain config — embedded, no file dependency ─────────────────────────────
-- A clean installation must succeed even without files in shared/c3/.

INSERT INTO ref_c3_capability_domain (
    code,
    css_class,
    heading_color,
    background_color,
    label,
    sort_order,
    is_active
)
VALUES
    ('Capabilities',           'dom-cap',  '#1b8f52', '#b8ddd0', 'CAPABILITIES',                    0, TRUE),
    ('BusinessProcesses',      'dom-bp',   '#e65c00', '#ffd0a0', 'BUSINESS PROCESSES',              1, TRUE),
    ('BusinessRoles',          'dom-br',   '#c2185b', '#f8bbd0', 'BUSINESS ROLES',                  2, TRUE),
    ('InformationProducts',    'dom-ip',   '#1565c0', '#bbdefb', 'INFORMATION PRODUCTS',            3, TRUE),
    ('UserApplications',       'dom-ua',   '#7b1fa2', '#e1bee7', 'USER APPLICATIONS',               4, TRUE),
    ('COIServices',            'dom-coi',  '#f57f17', '#ffe082', 'COMMUNITY OF INTEREST SERVICES',  5, TRUE),
    ('CoreServices',           'dom-core', '#283593', '#c5cae9', 'CORE SERVICES',                   6, TRUE),
    ('CommunicationsServices', 'dom-com',  '#37474f', '#cfd8dc', 'COMMUNICATIONS SERVICES',         7, TRUE)
ON CONFLICT (code) DO UPDATE SET
    css_class        = EXCLUDED.css_class,
    heading_color    = EXCLUDED.heading_color,
    background_color = EXCLUDED.background_color,
    label            = EXCLUDED.label,
    sort_order       = EXCLUDED.sort_order,
    is_active        = TRUE,
    updated_at       = CURRENT_TIMESTAMP;

-- ── Capability builder seed — controlled by INIT_WITH_C3_CAPABILITY_MAP_SEED ─
-- Reads /shared/c3/capability-map-<spiral>.json for the active baseline.
-- If the seed flag is not true, the whole block is skipped and the table stays empty.

DO $$
DECLARE
    v_seed_version   TEXT    := 'c3_poster_v2_html';
    v_seed_file      TEXT;
    v_active_spiral  TEXT;
    v_seed_capability_builder BOOLEAN :=
        COALESCE(NULLIF(current_setting('app.seed_capability_builder', true), '')::boolean, FALSE);
BEGIN
    IF NOT v_seed_capability_builder THEN
        RAISE NOTICE 'C3 capability builder seed skipped (INIT_WITH_C3_CAPABILITY_MAP_SEED=false). The table remains empty.';
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM c3_capability_builder_seed_state WHERE seed_version = v_seed_version
    ) THEN
        RAISE NOTICE 'C3 dashboard seed "%" already exists, skipping.', v_seed_version;
        RETURN;
    END IF;

    -- Resolve the active spiral baseline; fallback to Spiral_7
    SELECT spiral_code INTO v_active_spiral
    FROM ref_spiral_baseline
    WHERE is_active = TRUE
    LIMIT 1;

    v_active_spiral := COALESCE(v_active_spiral, 'Spiral_7');
    v_seed_file     := '/shared/c3/capability-map-' || lower(replace(v_active_spiral, '_', '')) || '.json';

    RAISE NOTICE 'C3 capability builder seed: spiral=%, file=%', v_active_spiral, v_seed_file;

    IF (SELECT COUNT(*) FROM c3_capability_builder) > 0 THEN
        RAISE NOTICE 'C3 capability builder seed skipped — target table is not empty.';
        RETURN;
    END IF;

    INSERT INTO c3_capability_builder (
        page_id,
        uuid,
        title,
        parent_id,
        level,
        state,
        domain_code,
        fmn_spiral
    )
    SELECT
        src."pageId",
        src.uuid,
        src.title,
        src."parentId",
        src.level,
        src.state,
        src.domain,
        v_active_spiral
    FROM jsonb_to_recordset(pg_read_file(v_seed_file)::jsonb) AS src(
        "pageId" TEXT,
        uuid     TEXT,
        title    TEXT,
        "parentId" TEXT,
        level    INTEGER,
        state    TEXT,
        domain   TEXT
    );

    INSERT INTO c3_capability_builder_seed_state (seed_version, seed_source)
    VALUES (v_seed_version, v_seed_file)
    ON CONFLICT (seed_version) DO NOTHING;

    RAISE NOTICE 'C3 capability builder seed finished — spiral=%', v_active_spiral;
END
$$;
