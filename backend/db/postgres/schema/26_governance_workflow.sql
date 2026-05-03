-- =============================================================================
-- SERVICE CATALOGUE - PostgreSQL canonical schema
-- 26_governance_workflow.sql | governance reviews and decisions
-- =============================================================================

SET search_path TO data, public;

CREATE TABLE IF NOT EXISTS governance_review (
    id            BIGSERIAL PRIMARY KEY,
    service_id    BIGINT NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
    review_type   VARCHAR(80) NOT NULL,
    status        VARCHAR(40) NOT NULL DEFAULT 'pending',
    requested_by  VARCHAR(255),
    assigned_to   VARCHAR(255),
    due_at        TIMESTAMPTZ NULL,
    completed_at  TIMESTAMPTZ NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_governance_review_status
        CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'deferred', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS governance_decision (
    id             BIGSERIAL PRIMARY KEY,
    service_id     BIGINT NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
    decision_type  VARCHAR(80) NOT NULL,
    decision       VARCHAR(40) NOT NULL,
    rationale      TEXT NULL,
    decided_by     VARCHAR(255),
    decided_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_governance_decision_status
        CHECK (decision IN ('approved', 'rejected', 'deferred', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS ix_governance_review_service_status
    ON governance_review(service_id, status, due_at);

CREATE INDEX IF NOT EXISTS ix_governance_review_assignee
    ON governance_review(assigned_to, status)
    WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_governance_decision_service
    ON governance_decision(service_id, decided_at DESC);

SET search_path TO platform, public;
INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '26_governance_workflow',
    'Governance workflow reviews and decisions',
    '2.6.0',
    'Adds governance reviews, decision log, statuses, and service-linked workflow history'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
