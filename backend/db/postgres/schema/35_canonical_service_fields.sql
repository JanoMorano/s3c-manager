-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 35_canonical_service_fields.sql | schema: data
--
-- One source of truth for service lifecycle, review date and portfolio:
--   lifecycle_stage_code  (canonical)  <- lifecycle_state, service_status_code (legacy mirrors)
--   review_due_at         (canonical)  <- next_review_due_at                    (legacy mirror)
--   portfolio_id          (canonical)  <- portfolio_group_code                  (legacy mirror)
--
-- Legacy columns stay because imports, the lifecycle workflow and older readers
-- still write them. A trigger keeps them in sync in both directions, so readers
-- can use the canonical columns without COALESCE fallbacks. Precedence when
-- several change in one statement: canonical > lifecycle_state > service_status_code.
-- Idempotent.
-- =============================================================================

SET search_path TO data, public;

-- ── Value mappings ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_lifecycle_stage_from_state(p_state TEXT)
RETURNS VARCHAR(50) LANGUAGE sql IMMUTABLE SET search_path = data, public AS $$
    SELECT CASE LOWER(BTRIM(COALESCE(p_state, '')))
        WHEN 'draft' THEN 'draft'
        WHEN 'design' THEN 'design'
        WHEN 'planned' THEN 'design'
        WHEN 'under_review' THEN 'design'
        WHEN 'approved' THEN 'active'
        WHEN 'live' THEN 'active'
        WHEN 'production' THEN 'active'
        WHEN 'published' THEN 'active'
        WHEN 'active' THEN 'active'
        WHEN 'deprecated' THEN 'retiring'
        WHEN 'retiring' THEN 'retiring'
        WHEN 'retired' THEN 'retired'
        ELSE NULL
    END
$$;

CREATE OR REPLACE FUNCTION fn_lifecycle_state_from_stage(p_stage TEXT)
RETURNS VARCHAR(50) LANGUAGE sql IMMUTABLE SET search_path = data, public AS $$
    SELECT CASE p_stage
        WHEN 'draft' THEN 'draft'
        WHEN 'design' THEN 'draft'
        WHEN 'active' THEN 'live'
        WHEN 'retiring' THEN 'deprecated'
        WHEN 'retired' THEN 'retired'
        ELSE NULL
    END
$$;

CREATE OR REPLACE FUNCTION fn_service_status_from_stage(p_stage TEXT)
RETURNS VARCHAR(50) LANGUAGE sql IMMUTABLE SET search_path = data, public AS $$
    SELECT CASE p_stage
        WHEN 'draft' THEN 'draft'
        WHEN 'design' THEN 'planned'
        WHEN 'active' THEN 'active'
        WHEN 'retiring' THEN 'deprecated'
        WHEN 'retired' THEN 'retired'
        ELSE NULL
    END
$$;

-- ── Sync trigger ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_service_catalog_sync_canonical()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = data, public AS $$
DECLARE
    stage_changed  BOOLEAN;
    state_changed  BOOLEAN;
    status_changed BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        stage_changed  := NEW.lifecycle_stage_code IS NOT NULL;
        state_changed  := NEW.lifecycle_state IS NOT NULL;
        status_changed := NEW.service_status_code IS NOT NULL;
    ELSE
        stage_changed  := NEW.lifecycle_stage_code IS DISTINCT FROM OLD.lifecycle_stage_code;
        state_changed  := NEW.lifecycle_state IS DISTINCT FROM OLD.lifecycle_state;
        status_changed := NEW.service_status_code IS DISTINCT FROM OLD.service_status_code;
    END IF;

    -- Lifecycle: canonical stage wins, then the lifecycle workflow, then catalogue status.
    IF NOT stage_changed THEN
        IF state_changed AND fn_lifecycle_stage_from_state(NEW.lifecycle_state) IS NOT NULL THEN
            NEW.lifecycle_stage_code := fn_lifecycle_stage_from_state(NEW.lifecycle_state);
            stage_changed := TRUE;
        ELSIF status_changed AND fn_lifecycle_stage_from_state(NEW.service_status_code) IS NOT NULL THEN
            NEW.lifecycle_stage_code := fn_lifecycle_stage_from_state(NEW.service_status_code);
            stage_changed := TRUE;
        END IF;
    END IF;

    IF stage_changed AND NEW.lifecycle_stage_code IS NOT NULL THEN
        IF NOT state_changed OR fn_lifecycle_stage_from_state(NEW.lifecycle_state) IS DISTINCT FROM NEW.lifecycle_stage_code THEN
            NEW.lifecycle_state := fn_lifecycle_state_from_stage(NEW.lifecycle_stage_code);
        END IF;
        -- Stubs keep their external_reference status.
        IF COALESCE(NEW.service_status_code, '') <> 'external_reference'
           AND (NOT status_changed OR fn_lifecycle_stage_from_state(NEW.service_status_code) IS DISTINCT FROM NEW.lifecycle_stage_code) THEN
            NEW.service_status_code := fn_service_status_from_stage(NEW.lifecycle_stage_code);
        END IF;
    END IF;

    -- Review date.
    IF TG_OP = 'INSERT' THEN
        NEW.review_due_at := COALESCE(NEW.review_due_at, NEW.next_review_due_at);
    ELSIF NEW.review_due_at IS DISTINCT FROM OLD.review_due_at THEN
        NULL;
    ELSIF NEW.next_review_due_at IS DISTINCT FROM OLD.next_review_due_at THEN
        NEW.review_due_at := NEW.next_review_due_at;
    END IF;
    NEW.next_review_due_at := NEW.review_due_at;

    -- Portfolio.
    IF (TG_OP = 'INSERT' AND NEW.portfolio_id IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.portfolio_id IS DISTINCT FROM OLD.portfolio_id) THEN
        NEW.portfolio_group_code := (
            SELECT sp.portfolio_code
            FROM service_portfolio sp
            JOIN ref_portfolio_group rpg ON rpg.code = sp.portfolio_code
            WHERE sp.id = NEW.portfolio_id
        );
    ELSIF (TG_OP = 'INSERT' AND NEW.portfolio_group_code IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.portfolio_group_code IS DISTINCT FROM OLD.portfolio_group_code) THEN
        NEW.portfolio_id := (
            SELECT sp.id FROM service_portfolio sp WHERE sp.portfolio_code = NEW.portfolio_group_code
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_catalog_sync_canonical ON service_catalog;
CREATE TRIGGER trg_service_catalog_sync_canonical
    BEFORE INSERT OR UPDATE ON service_catalog
    FOR EACH ROW EXECUTE FUNCTION fn_service_catalog_sync_canonical();

-- New portfolio groups get a portfolio row so portfolio_id can always be resolved.
CREATE OR REPLACE FUNCTION fn_ref_portfolio_group_sync_portfolio()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = data, public AS $$
BEGIN
    INSERT INTO service_portfolio (portfolio_code, title, status_code)
    VALUES (NEW.code, NEW.name, 'active')
    ON CONFLICT (portfolio_code) DO UPDATE SET title = EXCLUDED.title, updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ref_portfolio_group_sync_portfolio ON ref_portfolio_group;
CREATE TRIGGER trg_ref_portfolio_group_sync_portfolio
    AFTER INSERT OR UPDATE OF name ON ref_portfolio_group
    FOR EACH ROW EXECUTE FUNCTION fn_ref_portfolio_group_sync_portfolio();

-- ── Backfill existing rows ───────────────────────────────────────────────────

INSERT INTO service_portfolio (portfolio_code, title, status_code)
SELECT code, name, 'active'
FROM ref_portfolio_group
ON CONFLICT (portfolio_code) DO NOTHING;

UPDATE service_catalog
SET lifecycle_stage_code = COALESCE(
        lifecycle_stage_code,
        fn_lifecycle_stage_from_state(lifecycle_state),
        fn_lifecycle_stage_from_state(service_status_code)
    ),
    review_due_at = COALESCE(review_due_at, next_review_due_at),
    portfolio_id = COALESCE(
        portfolio_id,
        (SELECT sp.id FROM service_portfolio sp WHERE sp.portfolio_code = service_catalog.portfolio_group_code)
    )
WHERE (lifecycle_stage_code IS NULL AND COALESCE(lifecycle_state, service_status_code) IS NOT NULL)
   OR (review_due_at IS NULL AND next_review_due_at IS NOT NULL)
   OR (review_due_at IS DISTINCT FROM next_review_due_at)
   OR (portfolio_id IS NULL AND portfolio_group_code IS NOT NULL);

-- ── Owner load on canonical fields ───────────────────────────────────────────

CREATE OR REPLACE VIEW v_owner_load AS
WITH service_base AS (
    SELECT
        sc.id AS service_pk,
        COALESCE(NULLIF(owner.email, ''), NULLIF(owner.display_name, ''), 'unassigned') AS owner_key,
        COALESCE(NULLIF(owner.display_name, ''), 'Unassigned') AS owner_name,
        owner.email AS owner_email,
        CASE WHEN sc.lifecycle_stage_code = 'active' THEN 1 ELSE 0 END AS live_flag,
        CASE WHEN sc.criticality_code = 'mission_critical' THEN 1 ELSE 0 END AS critical_flag,
        CASE WHEN sc.review_due_at IS NULL OR sc.review_due_at < CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS overdue_review_flag,
        CASE WHEN support.support_model_count = 0 OR owner.email IS NULL AND owner.display_name IS NULL THEN 1 ELSE 0 END AS readiness_blocker_flag,
        CASE WHEN mapping.c3_mapping_count = 0 THEN 1 ELSE 0 END AS c3_gap_flag
    FROM service_catalog sc
    LEFT JOIN LATERAL (
        SELECT sra.display_name, sra.email
        FROM service_role_assignment sra
        WHERE sra.service_id = sc.id
          AND sra.role_code = 'service_owner'
          AND sra.valid_to IS NULL
        ORDER BY sra.created_at DESC
        LIMIT 1
    ) owner ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS support_model_count
        FROM service_support_model sm
        WHERE sm.service_id = sc.id
    ) support ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS c3_mapping_count
        FROM service_c3_mapping scm
        WHERE scm.service_id = sc.id
    ) mapping ON TRUE
    WHERE sc.is_deleted = FALSE
      AND sc.is_stub = FALSE
), owner_stats AS (
    SELECT
        owner_key,
        owner_name,
        owner_email,
        COUNT(*)::integer AS owned_services,
        SUM(live_flag)::integer AS live_services,
        SUM(critical_flag)::integer AS critical_services,
        SUM(readiness_blocker_flag)::integer AS readiness_blockers,
        SUM(overdue_review_flag)::integer AS overdue_reviews,
        SUM(c3_gap_flag)::integer AS c3_gaps
    FROM service_base
    GROUP BY owner_key, owner_name, owner_email
)
SELECT
    owner_key,
    owner_name,
    owner_email,
    owned_services,
    live_services,
    critical_services,
    readiness_blockers,
    overdue_reviews,
    c3_gaps,
    (
        owned_services * 1
        + live_services * 2
        + critical_services * 3
        + readiness_blockers * 4
        + overdue_reviews * 3
        + c3_gaps * 2
    )::integer AS owner_load_score
FROM owner_stats;

SET search_path TO platform, public;

INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '35_canonical_service_fields',
    'Canonical service lifecycle, review date and portfolio',
    '3.2.0',
    'Makes lifecycle_stage_code, review_due_at and portfolio_id canonical; legacy mirrors kept in sync by trigger; v_owner_load reads canonical fields.'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    schema_version  = EXCLUDED.schema_version,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
