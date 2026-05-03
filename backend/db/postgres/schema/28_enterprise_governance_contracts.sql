-- =============================================================================
-- SERVICE CATALOGUE - Enterprise governance contracts
-- 28_enterprise_governance_contracts.sql | notifications, requests, preferences
-- =============================================================================

SET search_path TO platform, public;

CREATE TABLE IF NOT EXISTS notification (
    id                BIGSERIAL PRIMARY KEY,
    notification_type VARCHAR(80) NOT NULL DEFAULT 'info',
    severity          VARCHAR(20) NOT NULL DEFAULT 'info',
    title             TEXT NOT NULL,
    body              TEXT NULL,
    href              TEXT NULL,
    entity_type       VARCHAR(80) NULL,
    entity_id         TEXT NULL,
    dedupe_key        VARCHAR(255) NULL UNIQUE,
    expires_at        TIMESTAMPTZ NULL,
    created_by        VARCHAR(255) NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_notification_severity
        CHECK (severity IN ('info', 'success', 'warning', 'danger'))
);

CREATE TABLE IF NOT EXISTS user_notification (
    notification_id BIGINT NOT NULL REFERENCES notification(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivered_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at         TIMESTAMPTZ NULL,
    dismissed_at    TIMESTAMPTZ NULL,
    PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preference_key   VARCHAR(120) NOT NULL,
    preference_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by       VARCHAR(255) NULL,
    PRIMARY KEY (user_id, preference_key)
);

CREATE INDEX IF NOT EXISTS ix_user_notification_user_status
    ON user_notification(user_id, read_at, delivered_at DESC)
    WHERE dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_notification_entity
    ON notification(entity_type, entity_id)
    WHERE entity_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_user_preferences_key
    ON user_preferences(preference_key, updated_at DESC);

COMMENT ON TABLE notification IS
    'Governance and workflow notifications. Delivery is per user through platform.user_notification.';
COMMENT ON TABLE user_notification IS
    'Per-user notification inbox with read/unread and dismissal state.';
COMMENT ON TABLE user_preferences IS
    'Generic per-user preference store for view mode, density, saved views and landing choices.';

SET search_path TO data, public;

CREATE SEQUENCE IF NOT EXISTS service_request_number_seq START 1000;

CREATE TABLE IF NOT EXISTS service_request (
    id                   BIGSERIAL PRIMARY KEY,
    request_number       VARCHAR(40) NOT NULL DEFAULT ('REQ-' || LPAD(nextval('data.service_request_number_seq'::regclass)::text, 8, '0')),
    service_id           BIGINT NULL REFERENCES service_catalog(id) ON DELETE SET NULL,
    offering_id          BIGINT NULL REFERENCES service_offering(id) ON DELETE SET NULL,
    requested_by_user_id INTEGER NULL REFERENCES platform.users(id) ON DELETE SET NULL,
    requested_by_name    VARCHAR(255) NULL,
    requested_by_email   VARCHAR(255) NULL,
    status               VARCHAR(40) NOT NULL DEFAULT 'submitted',
    request_channel_type VARCHAR(80) NULL,
    request_channel_url  TEXT NULL,
    external_ticket_ref  VARCHAR(255) NULL,
    external_ticket_url  TEXT NULL,
    request_note         TEXT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_service_request_number UNIQUE (request_number),
    CONSTRAINT chk_service_request_status
        CHECK (status IN ('submitted', 'routed', 'fulfilled', 'cancelled')),
    CONSTRAINT chk_service_request_requester
        CHECK (
            requested_by_user_id IS NOT NULL
            OR NULLIF(TRIM(COALESCE(requested_by_email, '') || COALESCE(requested_by_name, '')), '') IS NOT NULL
        )
);

CREATE INDEX IF NOT EXISTS ix_service_request_service_status
    ON service_request(service_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_service_request_requester
    ON service_request(requested_by_user_id, created_at DESC)
    WHERE requested_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_service_request_requester_email
    ON service_request(LOWER(requested_by_email), created_at DESC)
    WHERE requested_by_email IS NOT NULL;

COMMENT ON TABLE service_request IS
    'Lightweight catalogue request log. It is not a ticketing system; external ticket references can be attached.';

ALTER TABLE readiness_rule
    ADD COLUMN IF NOT EXISTS title_text TEXT NULL,
    ADD COLUMN IF NOT EXISTS why_text TEXT NULL,
    ADD COLUMN IF NOT EXISTS howto_text TEXT NULL,
    ADD COLUMN IF NOT EXISTS evidence_hint TEXT NULL;

UPDATE readiness_rule
SET
    title_text = COALESCE(title_text, title),
    why_text = COALESCE(why_text, description),
    howto_text = COALESCE(howto_text,
        CASE rule_key
            WHEN 'service_has_owner' THEN 'Assign an accountable service owner in the ownership section.'
            WHEN 'service_has_offering' THEN 'Create at least one active offering or available flavour.'
            WHEN 'service_has_lifecycle_stage' THEN 'Set the service lifecycle stage and review whether the workflow state is correct.'
            WHEN 'service_has_primary_capability_mapping' THEN 'Map exactly one primary C3 capability to the service.'
            WHEN 'service_has_complete_primary_capability' THEN 'Complete the primary capability evidence: applications, TIN, data objects and C3 services.'
            WHEN 'service_has_sla' THEN 'Add SLA commitments or an explicit support model exception.'
            WHEN 'service_has_dependency_classification' THEN 'Classify dependencies and mark mandatory or operationally critical relationships.'
            WHEN 'service_has_relations' THEN 'Add upstream or downstream service relationships used for impact analysis.'
            WHEN 'service_has_review_date' THEN 'Set the next review date or governance owner.'
            WHEN 'requestable_service_has_pricing' THEN 'Add a price, rate note or approved pricing exception.'
            ELSE 'Open the service editor and add the missing evidence for this rule.'
        END),
    evidence_hint = COALESCE(evidence_hint,
        CASE rule_key
            WHEN 'service_has_owner' THEN 'service_role_assignment.role_code=service_owner'
            WHEN 'service_has_offering' THEN 'service_offering or active service_flavour'
            WHEN 'service_has_lifecycle_stage' THEN 'service_catalog.lifecycle_stage_code'
            WHEN 'service_has_primary_capability_mapping' THEN 'service_c3_mapping.is_primary=true'
            WHEN 'service_has_complete_primary_capability' THEN 'v_c3capabilitycompleteness'
            WHEN 'service_has_sla' THEN 'service_catalog SLA fields or service_sla records'
            WHEN 'service_has_dependency_classification' THEN 'service_relation dependency kinds'
            WHEN 'service_has_relations' THEN 'service_relation'
            WHEN 'service_has_review_date' THEN 'review_due_at or next_review_due_at'
            WHEN 'requestable_service_has_pricing' THEN 'service_flavour.price_value or pricing note'
            ELSE NULL
        END)
WHERE title_text IS NULL
   OR why_text IS NULL
   OR howto_text IS NULL
   OR evidence_hint IS NULL;

CREATE TABLE IF NOT EXISTS c3_board_state (
    c3_uuid            VARCHAR(100) PRIMARY KEY REFERENCES c3_taxonomy(uuid) ON DELETE CASCADE,
    board_state        VARCHAR(40) NOT NULL DEFAULT 'imported',
    validation_status  VARCHAR(40) NULL,
    board_state_reason TEXT NULL,
    reviewed_at        TIMESTAMPTZ NULL,
    reviewed_by        VARCHAR(255) NULL,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by         VARCHAR(255) NULL,
    CONSTRAINT chk_c3_board_state
        CHECK (board_state IN ('imported', 'validated', 'mapped', 'used', 'reviewed'))
);

CREATE INDEX IF NOT EXISTS ix_c3_board_state_state
    ON c3_board_state(board_state, updated_at DESC);

COMMENT ON TABLE c3_board_state IS
    'Governance board state for C3 items. Source item_status remains content/source status.';

INSERT INTO c3_board_state (c3_uuid, board_state, validation_status, board_state_reason)
SELECT
    c.uuid,
    CASE
        WHEN LOWER(COALESCE(c.item_status, c.ss_overall_status, c.ss_baseline_status, '')) IN ('reviewed', 'approved', 'baselined') THEN 'reviewed'
        WHEN EXISTS (
            SELECT 1
            FROM service_c3_mapping scm
            JOIN service_catalog sc ON sc.id = scm.service_id
            WHERE scm.c3_uuid = c.uuid
              AND sc.is_deleted = FALSE
              AND LOWER(COALESCE(sc.lifecycle_stage_code, sc.service_status_code, sc.lifecycle_state, '')) IN ('active', 'published', 'live')
        ) THEN 'used'
        WHEN EXISTS (
            SELECT 1
            FROM service_c3_mapping scm
            WHERE scm.c3_uuid = c.uuid
        ) THEN 'mapped'
        WHEN COALESCE(NULLIF(BTRIM(c.item_status), ''), NULLIF(BTRIM(c.ss_overall_status), ''), NULLIF(BTRIM(c.ss_baseline_status), '')) IS NOT NULL THEN 'validated'
        ELSE 'imported'
    END AS board_state,
    COALESCE(NULLIF(BTRIM(c.item_status), ''), NULLIF(BTRIM(c.ss_overall_status), ''), NULLIF(BTRIM(c.ss_baseline_status), '')) AS validation_status,
    'Initial state derived from C3 import metadata and service mappings.' AS board_state_reason
FROM c3_taxonomy c
ON CONFLICT (c3_uuid) DO NOTHING;

CREATE OR REPLACE VIEW v_c3_board_lane AS
SELECT
    c.uuid,
    c.title,
    c.item_type,
    c.external_id,
    c.item_status,
    COALESCE(bs.board_state,
        CASE
            WHEN LOWER(COALESCE(c.item_status, c.ss_overall_status, c.ss_baseline_status, '')) IN ('reviewed', 'approved', 'baselined') THEN 'reviewed'
            WHEN EXISTS (
                SELECT 1
                FROM service_c3_mapping scm
                JOIN service_catalog sc ON sc.id = scm.service_id
                WHERE scm.c3_uuid = c.uuid
                  AND sc.is_deleted = FALSE
                  AND LOWER(COALESCE(sc.lifecycle_stage_code, sc.service_status_code, sc.lifecycle_state, '')) IN ('active', 'published', 'live')
            ) THEN 'used'
            WHEN EXISTS (
                SELECT 1
                FROM service_c3_mapping scm
                WHERE scm.c3_uuid = c.uuid
            ) THEN 'mapped'
            WHEN COALESCE(NULLIF(BTRIM(c.item_status), ''), NULLIF(BTRIM(c.ss_overall_status), ''), NULLIF(BTRIM(c.ss_baseline_status), '')) IS NOT NULL THEN 'validated'
            ELSE 'imported'
        END
    ) AS board_state,
    COALESCE(bs.validation_status, NULLIF(BTRIM(c.item_status), ''), NULLIF(BTRIM(c.ss_overall_status), ''), NULLIF(BTRIM(c.ss_baseline_status), '')) AS validation_status,
    bs.board_state_reason,
    bs.reviewed_at,
    bs.reviewed_by,
    COALESCE(bs.updated_at, c.synced_at, c.modification_date, CURRENT_TIMESTAMP) AS updated_at
FROM c3_taxonomy c
LEFT JOIN c3_board_state bs ON bs.c3_uuid = c.uuid;

SET search_path TO platform, public;

INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '28_enterprise_governance_contracts',
    'Enterprise governance UI contracts',
    '2.8.0',
    'Adds notifications, user preferences, service request log, readiness explanations and C3 board governance state.'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
