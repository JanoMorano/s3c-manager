-- =============================================================================
-- SERVICE CATALOGUE - PostgreSQL canonical schema
-- 24_readiness_rules.sql | configurable readiness rules and exceptions
-- =============================================================================

SET search_path TO data, public;

CREATE TABLE IF NOT EXISTS readiness_rule (
    rule_key                    VARCHAR(120) PRIMARY KEY,
    title                       VARCHAR(255) NOT NULL,
    description                 TEXT,
    severity                    VARCHAR(20) NOT NULL DEFAULT 'P2',
    enabled                     BOOLEAN NOT NULL DEFAULT TRUE,
    blocking                    BOOLEAN NOT NULL DEFAULT FALSE,
    applies_to_lifecycle_stage  VARCHAR(80)[] NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_readiness_rule_severity
        CHECK (severity IN ('P0', 'P1', 'P2', 'info'))
);

CREATE TABLE IF NOT EXISTS readiness_exception (
    id              BIGSERIAL PRIMARY KEY,
    service_id      BIGINT NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
    rule_key        VARCHAR(120) NOT NULL REFERENCES readiness_rule(rule_key) ON DELETE CASCADE,
    reason          TEXT NOT NULL,
    expires_at      TIMESTAMPTZ NULL,
    approved_by     VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_readiness_exception_service_rule UNIQUE (service_id, rule_key)
);

CREATE INDEX IF NOT EXISTS ix_readiness_rule_enabled
    ON readiness_rule(enabled, blocking, severity);

CREATE INDEX IF NOT EXISTS ix_readiness_exception_service
    ON readiness_exception(service_id, rule_key);

CREATE INDEX IF NOT EXISTS ix_readiness_exception_expiry
    ON readiness_exception(expires_at)
    WHERE expires_at IS NOT NULL;

INSERT INTO readiness_rule
    (rule_key, title, description, severity, enabled, blocking, applies_to_lifecycle_stage)
VALUES
    (
        'service_has_owner',
        'Service has owner',
        'A service needs an active owner assignment before it can be governed or published.',
        'P0',
        TRUE,
        TRUE,
        NULL
    ),
    (
        'service_has_offering',
        'Service has offering',
        'A service needs at least one structured offering or active flavour.',
        'P0',
        TRUE,
        TRUE,
        NULL
    ),
    (
        'service_has_lifecycle_stage',
        'Service has lifecycle stage',
        'Lifecycle stage or state is required for readiness and review queues.',
        'P1',
        TRUE,
        TRUE,
        NULL
    ),
    (
        'service_has_primary_capability_mapping',
        'Service has primary capability mapping',
        'A primary C3 or capability mapping is required for capability coverage governance.',
        'P1',
        TRUE,
        TRUE,
        NULL
    ),
    (
        'service_has_sla',
        'Service has SLA',
        'Availability, restoration, delivery target, or SLA record is required.',
        'P1',
        TRUE,
        TRUE,
        NULL
    ),
    (
        'service_has_dependency_classification',
        'Service has dependency classification',
        'Dependencies should be classified so change and readiness impact can be assessed.',
        'P2',
        TRUE,
        FALSE,
        NULL
    ),
    (
        'service_has_review_date',
        'Service has review date',
        'Review due date keeps ownership and readiness decisions current.',
        'P2',
        TRUE,
        FALSE,
        NULL
    ),
    (
        'requestable_service_has_pricing',
        'Requestable service has pricing',
        'Requestable services should have pricing, cost note, or an explicit exception.',
        'P2',
        TRUE,
        FALSE,
        NULL
    )
ON CONFLICT (rule_key) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    severity = EXCLUDED.severity,
    enabled = EXCLUDED.enabled,
    blocking = EXCLUDED.blocking,
    applies_to_lifecycle_stage = EXCLUDED.applies_to_lifecycle_stage,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO platform.schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '24_readiness_rules',
    'Configurable readiness rules',
    '2.4.0',
    'Adds readiness rules and auditable service-level exceptions'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
