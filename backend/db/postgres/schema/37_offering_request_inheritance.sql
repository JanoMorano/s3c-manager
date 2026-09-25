-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 37_offering_request_inheritance.sql | schema: data
--
-- Request/access fields exist on the service and on each offering. They are
-- now one model with inheritance: the service holds the defaults, an offering
-- field that is NULL inherits the service value, a non-NULL value overrides it.
--
--   service_offering.requestable          <- service_catalog.requestable
--   service_offering.approval_required    <- service_catalog.approval_required
--   service_offering.request_channel_type <- service_catalog.request_channel_type
--   service_offering.request_channel_url  <- service_catalog.request_channel_url
--   service_offering.lead_time_text       <- service_catalog.fulfillment_lead_time_text
--
-- Offering values equal to the service value are reset to NULL (inherit), which
-- does not change any effective value. v_service_offering_effective resolves
-- the effective values. Idempotent.
-- =============================================================================

SET search_path TO data, public;

ALTER TABLE service_offering ALTER COLUMN requestable DROP NOT NULL;
ALTER TABLE service_offering ALTER COLUMN requestable DROP DEFAULT;

UPDATE service_offering so
SET requestable = CASE WHEN so.requestable IS NOT DISTINCT FROM sc.requestable THEN NULL ELSE so.requestable END,
    approval_required = CASE WHEN so.approval_required IS NOT DISTINCT FROM sc.approval_required THEN NULL ELSE so.approval_required END,
    request_channel_type = CASE WHEN NULLIF(BTRIM(so.request_channel_type), '') IS NOT DISTINCT FROM NULLIF(BTRIM(sc.request_channel_type), '') THEN NULL ELSE so.request_channel_type END,
    request_channel_url = CASE WHEN NULLIF(BTRIM(so.request_channel_url), '') IS NOT DISTINCT FROM NULLIF(BTRIM(sc.request_channel_url), '') THEN NULL ELSE so.request_channel_url END,
    lead_time_text = CASE WHEN NULLIF(BTRIM(so.lead_time_text), '') IS NOT DISTINCT FROM NULLIF(BTRIM(sc.fulfillment_lead_time_text), '') THEN NULL ELSE so.lead_time_text END
FROM service_catalog sc
WHERE sc.id = so.service_id
  AND (so.requestable IS NOT DISTINCT FROM sc.requestable
    OR (so.approval_required IS NOT NULL AND so.approval_required IS NOT DISTINCT FROM sc.approval_required)
    OR (so.request_channel_type IS NOT NULL AND NULLIF(BTRIM(so.request_channel_type), '') IS NOT DISTINCT FROM NULLIF(BTRIM(sc.request_channel_type), ''))
    OR (so.request_channel_url IS NOT NULL AND NULLIF(BTRIM(so.request_channel_url), '') IS NOT DISTINCT FROM NULLIF(BTRIM(sc.request_channel_url), ''))
    OR (so.lead_time_text IS NOT NULL AND NULLIF(BTRIM(so.lead_time_text), '') IS NOT DISTINCT FROM NULLIF(BTRIM(sc.fulfillment_lead_time_text), '')));

COMMENT ON COLUMN service_offering.requestable IS
    'NULL = inherit service_catalog.requestable; see v_service_offering_effective.';

CREATE OR REPLACE VIEW v_service_offering_effective AS
SELECT
    so.id AS offering_id,
    so.service_id,
    COALESCE(so.requestable, sc.requestable, FALSE) AS effective_requestable,
    COALESCE(so.approval_required, sc.approval_required) AS effective_approval_required,
    COALESCE(NULLIF(BTRIM(so.request_channel_type), ''), NULLIF(BTRIM(sc.request_channel_type), '')) AS effective_request_channel_type,
    COALESCE(NULLIF(BTRIM(so.request_channel_url), ''), NULLIF(BTRIM(sc.request_channel_url), '')) AS effective_request_channel_url,
    COALESCE(NULLIF(BTRIM(so.lead_time_text), ''), NULLIF(BTRIM(sc.fulfillment_lead_time_text), '')) AS effective_lead_time_text
FROM service_offering so
JOIN service_catalog sc ON sc.id = so.service_id;

SET search_path TO platform, public;

INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '37_offering_request_inheritance',
    'Offering request fields inherit from the service',
    '3.4.0',
    'Offering requestable/approval/channel/lead time: NULL inherits the service value; v_service_offering_effective resolves effective values.'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    schema_version  = EXCLUDED.schema_version,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
