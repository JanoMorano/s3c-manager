-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 36_service_sla_canonical.sql | schema: data
--
-- One source of truth for the service-level SLA: the primary service_sla row
-- of a service (flavour_id IS NULL, lowest id). The service_catalog columns
-- sla_availability, sla_restoration_hours, sla_delivery_days,
-- sla_restoration_text and sla_delivery_text become a mirror kept in sync by
-- triggers in both directions, so the service editor, imports and the SLA
-- records API always show the same values. Offering/flavour SLAs are untouched.
-- Idempotent.
-- =============================================================================

SET search_path TO data, public;

ALTER TABLE service_sla
    ADD COLUMN IF NOT EXISTS restoration_text TEXT NULL,
    ADD COLUMN IF NOT EXISTS delivery_text TEXT NULL;

CREATE INDEX IF NOT EXISTS ix_service_sla_service_level
    ON service_sla(service_id, id)
    WHERE flavour_id IS NULL;

-- Primary service-level SLA row of a service, or NULL.
CREATE OR REPLACE FUNCTION fn_service_primary_sla_id(p_service_id BIGINT)
RETURNS BIGINT LANGUAGE sql STABLE SET search_path = data, public AS $$
    SELECT MIN(id) FROM service_sla WHERE service_id = p_service_id AND flavour_id IS NULL
$$;

-- ── service_catalog → service_sla ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_service_catalog_sync_sla()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = data, public AS $$
DECLARE
    primary_id BIGINT;
BEGIN
    -- Changes coming from the service_sla trigger must not bounce back.
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW.sla_availability      IS NOT DISTINCT FROM OLD.sla_availability
       AND NEW.sla_restoration_hours IS NOT DISTINCT FROM OLD.sla_restoration_hours
       AND NEW.sla_delivery_days     IS NOT DISTINCT FROM OLD.sla_delivery_days
       AND NEW.sla_restoration_text  IS NOT DISTINCT FROM OLD.sla_restoration_text
       AND NEW.sla_delivery_text     IS NOT DISTINCT FROM OLD.sla_delivery_text THEN
        RETURN NEW;
    END IF;

    primary_id := fn_service_primary_sla_id(NEW.id);

    IF primary_id IS NOT NULL THEN
        UPDATE service_sla
        SET availability_pct  = NEW.sla_availability,
            restoration_hours = NEW.sla_restoration_hours,
            delivery_days     = NEW.sla_delivery_days,
            restoration_text  = NEW.sla_restoration_text,
            delivery_text     = NEW.sla_delivery_text,
            updated_at        = CURRENT_TIMESTAMP
        WHERE id = primary_id;
    ELSIF COALESCE(NEW.sla_availability::text, NEW.sla_restoration_hours::text, NEW.sla_delivery_days::text,
                   NEW.sla_restoration_text, NEW.sla_delivery_text) IS NOT NULL THEN
        INSERT INTO service_sla
            (service_id, flavour_id, availability_pct, restoration_hours, delivery_days,
             restoration_text, delivery_text, source_field)
        VALUES
            (NEW.id, NULL, NEW.sla_availability, NEW.sla_restoration_hours, NEW.sla_delivery_days,
             NEW.sla_restoration_text, NEW.sla_delivery_text, 'service_catalog');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_catalog_sync_sla ON service_catalog;
CREATE TRIGGER trg_service_catalog_sync_sla
    AFTER INSERT OR UPDATE ON service_catalog
    FOR EACH ROW EXECUTE FUNCTION fn_service_catalog_sync_sla();

-- ── service_sla → service_catalog mirror ─────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_service_sla_sync_catalog()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = data, public AS $$
DECLARE
    target_service BIGINT;
    primary_row    service_sla%ROWTYPE;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NULL;
    END IF;

    target_service := CASE WHEN TG_OP = 'DELETE' THEN OLD.service_id ELSE NEW.service_id END;
    IF TG_OP <> 'DELETE' AND NEW.flavour_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR OLD.flavour_id IS NOT NULL) THEN
        RETURN NULL;
    END IF;
    IF TG_OP = 'DELETE' AND OLD.flavour_id IS NOT NULL THEN
        RETURN NULL;
    END IF;

    SELECT * INTO primary_row FROM service_sla WHERE id = fn_service_primary_sla_id(target_service);

    UPDATE service_catalog
    SET sla_availability      = primary_row.availability_pct,
        sla_restoration_hours = primary_row.restoration_hours,
        sla_delivery_days     = primary_row.delivery_days,
        sla_restoration_text  = primary_row.restoration_text,
        sla_delivery_text     = primary_row.delivery_text
    WHERE id = target_service
      AND (sla_availability      IS DISTINCT FROM primary_row.availability_pct
        OR sla_restoration_hours IS DISTINCT FROM primary_row.restoration_hours
        OR sla_delivery_days     IS DISTINCT FROM primary_row.delivery_days
        OR sla_restoration_text  IS DISTINCT FROM primary_row.restoration_text
        OR sla_delivery_text     IS DISTINCT FROM primary_row.delivery_text);

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_sla_sync_catalog ON service_sla;
CREATE TRIGGER trg_service_sla_sync_catalog
    AFTER INSERT OR UPDATE OR DELETE ON service_sla
    FOR EACH ROW EXECUTE FUNCTION fn_service_sla_sync_catalog();

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Services with catalog SLA values but no service-level row get one; existing
-- primary rows take over catalog values only where they are empty. Then the
-- catalog mirror is refreshed from the primary row.

INSERT INTO service_sla
    (service_id, flavour_id, availability_pct, restoration_hours, delivery_days,
     restoration_text, delivery_text, source_field)
SELECT sc.id, NULL, sc.sla_availability, sc.sla_restoration_hours, sc.sla_delivery_days,
       sc.sla_restoration_text, sc.sla_delivery_text, 'service_catalog'
FROM service_catalog sc
WHERE COALESCE(sc.sla_availability::text, sc.sla_restoration_hours::text, sc.sla_delivery_days::text,
               sc.sla_restoration_text, sc.sla_delivery_text) IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM service_sla sl WHERE sl.service_id = sc.id AND sl.flavour_id IS NULL
  );

UPDATE service_sla sl
SET availability_pct  = COALESCE(sl.availability_pct, sc.sla_availability),
    restoration_hours = COALESCE(sl.restoration_hours, sc.sla_restoration_hours),
    delivery_days     = COALESCE(sl.delivery_days, sc.sla_delivery_days),
    restoration_text  = COALESCE(sl.restoration_text, sc.sla_restoration_text),
    delivery_text     = COALESCE(sl.delivery_text, sc.sla_delivery_text)
FROM service_catalog sc
WHERE sc.id = sl.service_id
  AND sl.id = fn_service_primary_sla_id(sc.id);

UPDATE service_catalog sc
SET sla_availability      = sl.availability_pct,
    sla_restoration_hours = sl.restoration_hours,
    sla_delivery_days     = sl.delivery_days,
    sla_restoration_text  = sl.restoration_text,
    sla_delivery_text     = sl.delivery_text
FROM service_sla sl
WHERE sl.id = fn_service_primary_sla_id(sc.id)
  AND (sc.sla_availability      IS DISTINCT FROM sl.availability_pct
    OR sc.sla_restoration_hours IS DISTINCT FROM sl.restoration_hours
    OR sc.sla_delivery_days     IS DISTINCT FROM sl.delivery_days
    OR sc.sla_restoration_text  IS DISTINCT FROM sl.restoration_text
    OR sc.sla_delivery_text     IS DISTINCT FROM sl.delivery_text);

SET search_path TO platform, public;

INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '36_service_sla_canonical',
    'Canonical service-level SLA in service_sla',
    '3.3.0',
    'Primary service-level service_sla row is canonical; service_catalog sla_* columns are a trigger-synced mirror.'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    schema_version  = EXCLUDED.schema_version,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
