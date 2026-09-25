-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 33_readiness_rule_explanations.sql | schema: data
-- Readiness rule explanation texts (why / how-to / evidence hint).
--
-- Live part of 28_enterprise_governance_contracts.sql, which was never wired
-- into init-db-postgres.sh. The retired notification, preference and service
-- request objects from 28 are intentionally not recreated. Idempotent, safe to
-- re-run on installs that already applied 28.
-- =============================================================================

SET search_path TO data, public;

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

SET search_path TO platform, public;

INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '33_readiness_rule_explanations',
    'Readiness rule explanations',
    '3.1.0',
    'Adds why/how-to/evidence explanation texts to readiness rules (split from 28).'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    schema_version  = EXCLUDED.schema_version,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
