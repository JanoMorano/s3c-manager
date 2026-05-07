-- =============================================================================
-- SERVICE CATALOGUE - PostgreSQL canonical schema
-- 30_reduction_domain_model_simplification.sql | lifecycle/readiness/decision simplification
-- =============================================================================

SET search_path TO data, public;

-- Stage 10 keeps historical service lifecycle/status and decision rows intact.
-- The DB change here is intentionally limited to readiness rule configuration:
-- only core, user-fixable publish-readiness rules stay enabled.
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
        'Service has offering or pricing evidence',
        'A service needs at least one structured offering, active legacy flavour, pricing note, or pricing evidence.',
        'P0',
        TRUE,
        TRUE,
        NULL
    ),
    (
        'service_has_lifecycle_stage',
        'Service has lifecycle state',
        'A canonical lifecycle state is required for readiness and review queues.',
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
    )
ON CONFLICT (rule_key) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    severity = EXCLUDED.severity,
    enabled = EXCLUDED.enabled,
    blocking = EXCLUDED.blocking,
    applies_to_lifecycle_stage = EXCLUDED.applies_to_lifecycle_stage,
    updated_at = CURRENT_TIMESTAMP;

UPDATE readiness_rule
SET enabled = FALSE,
    blocking = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE rule_key NOT IN (
    'service_has_owner',
    'service_has_offering',
    'service_has_lifecycle_stage',
    'service_has_primary_capability_mapping',
    'service_has_sla'
);

SET search_path TO platform, public;
INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '30_reduction_domain_model_simplification',
    'Reduction stage 10 domain model simplification',
    '3.0.0',
    'Keeps historical lifecycle/status and decision data; reduces active readiness rules to five core user-fixable rules'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
