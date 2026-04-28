-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 22_governance_views.sql | operational governance scoring views
-- =============================================================================

SET search_path TO data, public;

CREATE OR REPLACE VIEW v_service_risk_radar AS
WITH active_services AS (
    SELECT
        sc.id AS service_pk,
        sc.service_id,
        sc.title,
        sc.service_status_code,
        sc.lifecycle_state,
        sc.service_type_code,
        sc.security_classification_code,
        sc.requestable,
        sc.request_channel_type,
        sc.request_channel_url,
        sc.sla_availability,
        sc.sla_restoration_hours,
        sc.sla_delivery_days,
        sc.next_review_due_at,
        owner.display_name AS owner_name,
        owner.email AS owner_email,
        COALESCE(support.support_model_count, 0) AS support_model_count,
        COALESCE(mapping.c3_mapping_count, 0) AS c3_mapping_count,
        c3_candidate.uuid AS c3_candidate_uuid,
        COALESCE(contract_link.contract_link_count, 0) AS contract_link_count,
        COALESCE(replacement.replacement_count, 0) AS replacement_count,
        COALESCE(dependency.dependency_count, 0) AS dependency_count,
        NULLIF(TRIM(COALESCE(sc.description, '') || ' ' || COALESCE(sc.business_summary, '') || ' ' || COALESCE(sc.operational_notes_raw, '')), '') AS documentation_text
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
    LEFT JOIN LATERAL (
        SELECT ct.uuid, ct.title
        FROM c3_taxonomy ct
        WHERE ct.uuid IS NOT NULL
          AND (
              LOWER(ct.title) = LOWER(sc.title)
              OR REPLACE(LOWER(ct.title), 'capability', 'service') = LOWER(sc.title)
              OR (
                  NULLIF(SUBSTRING(COALESCE(sc.service_id, '') FROM '([0-9]+)$'), '') IS NOT NULL
                  AND (
                      NULLIF(SUBSTRING(COALESCE(ct.external_id, '') FROM '([0-9]+)$'), '') =
                          NULLIF(SUBSTRING(COALESCE(sc.service_id, '') FROM '([0-9]+)$'), '')
                      OR NULLIF(SUBSTRING(COALESCE(ct.title, '') FROM '([0-9]+)$'), '') =
                          NULLIF(SUBSTRING(COALESCE(sc.service_id, '') FROM '([0-9]+)$'), '')
                  )
              )
              OR (
                  NULLIF(SUBSTRING(COALESCE(sc.title, '') FROM '([0-9]+)$'), '') IS NOT NULL
                  AND (
                      NULLIF(SUBSTRING(COALESCE(ct.external_id, '') FROM '([0-9]+)$'), '') =
                          NULLIF(SUBSTRING(COALESCE(sc.title, '') FROM '([0-9]+)$'), '')
                      OR NULLIF(SUBSTRING(COALESCE(ct.title, '') FROM '([0-9]+)$'), '') =
                          NULLIF(SUBSTRING(COALESCE(sc.title, '') FROM '([0-9]+)$'), '')
                  )
              )
              OR (
                  NULLIF(REGEXP_REPLACE(COALESCE(sc.service_id, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
                  AND (
                      NULLIF(REGEXP_REPLACE(COALESCE(ct.external_id, ''), '[^0-9]', '', 'g'), '') =
                          NULLIF(REGEXP_REPLACE(COALESCE(sc.service_id, ''), '[^0-9]', '', 'g'), '')
                      OR NULLIF(REGEXP_REPLACE(COALESCE(ct.title, ''), '[^0-9]', '', 'g'), '') =
                          NULLIF(REGEXP_REPLACE(COALESCE(sc.service_id, ''), '[^0-9]', '', 'g'), '')
                  )
              )
              OR (
                  NULLIF(REGEXP_REPLACE(COALESCE(sc.title, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
                  AND (
                      NULLIF(REGEXP_REPLACE(COALESCE(ct.external_id, ''), '[^0-9]', '', 'g'), '') =
                          NULLIF(REGEXP_REPLACE(COALESCE(sc.title, ''), '[^0-9]', '', 'g'), '')
                      OR NULLIF(REGEXP_REPLACE(COALESCE(ct.title, ''), '[^0-9]', '', 'g'), '') =
                          NULLIF(REGEXP_REPLACE(COALESCE(sc.title, ''), '[^0-9]', '', 'g'), '')
                  )
              )
          )
        ORDER BY
            CASE
                WHEN LOWER(ct.title) = LOWER(sc.title) THEN 0
                WHEN REPLACE(LOWER(ct.title), 'capability', 'service') = LOWER(sc.title) THEN 1
                ELSE 2
            END,
            ct.title ASC
        LIMIT 1
    ) c3_candidate ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS contract_link_count
        FROM contract_service_link csl
        JOIN contract c ON c.contract_id = csl.contract_id
        WHERE csl.service_id = sc.id
          AND c.status IN ('draft', 'active')
    ) contract_link ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS replacement_count
        FROM service_relation sr
        WHERE sr.from_service_id = sc.id
          AND sr.relation_type_code IN ('replaced_by', 'replaces')
          AND sr.is_deleted = FALSE
    ) replacement ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS dependency_count
        FROM service_relation sr
        WHERE sr.from_service_id = sc.id
          AND sr.relation_type_code IN ('depends_on', 'prerequisite', 'underlying', 'requires_account', 'uses')
          AND sr.is_deleted = FALSE
    ) dependency ON TRUE
    WHERE sc.is_deleted = FALSE
      AND sc.is_stub = FALSE
), risk_rows AS (
    SELECT
        ('service:' || service_pk || ':missing-owner')::text AS finding_key,
        'P0'::text AS severity,
        'risk'::text AS finding_type,
        service_pk,
        service_id,
        title,
        NULL::text AS target_url,
        'service'::text AS source_entity_type,
        service_pk::text AS source_entity_id,
        'missing_owner'::text AS rule_code,
        'Service has no active service owner.'::text AS reason,
        'Assign a service owner and review accountability.'::text AS suggested_action,
        100::numeric AS score
    FROM active_services
    WHERE owner_name IS NULL AND owner_email IS NULL
    UNION ALL
    SELECT
        ('service:' || service_pk || ':live-without-support-model')::text,
        'P0'::text,
        'risk'::text,
        service_pk,
        service_id,
        title,
        NULL::text,
        'service'::text,
        service_pk::text,
        'live_without_support_model'::text,
        'Live or active service has no support model.'::text,
        'Add support hours, resolver group, escalation path, and support ownership.'::text,
        95::numeric
    FROM active_services
    WHERE (LOWER(COALESCE(lifecycle_state, '')) = 'live' OR service_status_code = 'active')
      AND support_model_count = 0
    UNION ALL
    SELECT
        ('service:' || service_pk || ':requestable-without-channel')::text,
        'P0'::text,
        'risk'::text,
        service_pk,
        service_id,
        title,
        NULL::text,
        'service'::text,
        service_pk::text,
        'requestable_without_channel'::text,
        'Service is requestable but has no request channel.'::text,
        'Add request channel type or URL before users rely on the service.'::text,
        90::numeric
    FROM active_services
    WHERE requestable = TRUE
      AND NULLIF(TRIM(COALESCE(request_channel_type, '') || COALESCE(request_channel_url, '')), '') IS NULL
    UNION ALL
    SELECT
        ('service:' || service_pk || ':missing-sla-rto-rpo')::text,
        'P1'::text,
        'risk'::text,
        service_pk,
        service_id,
        title,
        NULL::text,
        'service'::text,
        service_pk::text,
        'missing_sla_rto_rpo'::text,
        'Service is missing SLA, restoration, or delivery targets.'::text,
        'Complete SLA availability, restoration hours, and delivery days where applicable.'::text,
        70::numeric
    FROM active_services
    WHERE sla_availability IS NULL
       OR sla_restoration_hours IS NULL
       OR sla_delivery_days IS NULL
    UNION ALL
    SELECT
        ('service:' || service_pk || ':review-overdue')::text,
        'P1'::text,
        'risk'::text,
        service_pk,
        service_id,
        title,
        NULL::text,
        'service'::text,
        service_pk::text,
        'review_overdue'::text,
        'Service review is missing or overdue.'::text,
        'Set the next review date and complete the service review.'::text,
        68::numeric
    FROM active_services
    WHERE next_review_due_at IS NULL
       OR next_review_due_at < CURRENT_TIMESTAMP
    UNION ALL
    SELECT
        ('service:' || service_pk || ':deprecated-without-replacement')::text,
        'P1'::text,
        'risk'::text,
        service_pk,
        service_id,
        title,
        NULL::text,
        'service'::text,
        service_pk::text,
        'deprecated_without_replacement'::text,
        'Deprecated service has no replacement relationship.'::text,
        'Link the replacement service or explain retirement path.'::text,
        65::numeric
    FROM active_services
    WHERE service_status_code = 'deprecated'
      AND replacement_count = 0
    UNION ALL
    SELECT
        ('service:' || service_pk || ':retired-c3-coverage')::text,
        'P2'::text,
        'risk'::text,
        service_pk,
        service_id,
        title,
        NULL::text,
        'service'::text,
        service_pk::text,
        'retired_c3_coverage'::text,
        'Retired service still covers at least one C3 mapping.'::text,
        'Move C3 coverage to a live replacement or remove obsolete mapping.'::text,
        48::numeric
    FROM active_services
    WHERE service_status_code = 'retired'
      AND c3_mapping_count > 0
    UNION ALL
    SELECT
        ('service:' || service_pk || ':missing-c3-mapping')::text,
        'P2'::text,
        'risk'::text,
        service_pk,
        service_id,
        title,
        CASE WHEN c3_candidate_uuid IS NOT NULL THEN ('/c3/' || c3_candidate_uuid)::text ELSE NULL::text END,
        CASE WHEN c3_candidate_uuid IS NOT NULL THEN 'c3_capability'::text ELSE 'service'::text END,
        COALESCE(c3_candidate_uuid, service_pk::text),
        'missing_c3_mapping'::text,
        'Service is not mapped to any C3 capability.'::text,
        'Map the service to the relevant C3 capability to make coverage visible.'::text,
        42::numeric
    FROM active_services
    WHERE c3_mapping_count = 0
    UNION ALL
    SELECT
        ('service:' || service_pk || ':missing-contract-coverage')::text,
        'P2'::text,
        'risk'::text,
        service_pk,
        service_id,
        title,
        NULL::text,
        'service'::text,
        service_pk::text,
        'missing_contract_coverage'::text,
        'Service has no active or draft contract coverage.'::text,
        'Link an active contract or confirm that no vendor contract is required.'::text,
        40::numeric
    FROM active_services
    WHERE contract_link_count = 0
    UNION ALL
    SELECT
        ('service:' || service_pk || ':many-dependencies-weak-docs')::text,
        'P2'::text,
        'risk'::text,
        service_pk,
        service_id,
        title,
        NULL::text,
        'service'::text,
        service_pk::text,
        'many_dependencies_weak_docs'::text,
        'Service has many operational dependencies but weak documentation.'::text,
        'Document dependency impact, failure mode, and escalation path.'::text,
        38::numeric
    FROM active_services
    WHERE dependency_count >= 5
      AND LENGTH(COALESCE(documentation_text, '')) < 250
)
SELECT
    finding_key,
    severity,
    finding_type,
    service_pk,
    service_id,
    title,
    rule_code,
    reason,
    suggested_action,
    COALESCE(
        target_url,
        CASE
            WHEN rule_code = 'missing_owner' THEN ('/services/' || service_id || '/edit#ownership')::text
            ELSE ('/services/' || service_id || '/edit')::text
        END
    ) AS target_url,
    source_entity_type,
    source_entity_id,
    score
FROM risk_rows;

CREATE OR REPLACE VIEW v_owner_load AS
WITH service_base AS (
    SELECT
        sc.id AS service_pk,
        COALESCE(NULLIF(owner.email, ''), NULLIF(owner.display_name, ''), 'unassigned') AS owner_key,
        COALESCE(NULLIF(owner.display_name, ''), 'Unassigned') AS owner_name,
        owner.email AS owner_email,
        CASE WHEN LOWER(COALESCE(sc.lifecycle_state, '')) = 'live' OR sc.service_status_code = 'active' THEN 1 ELSE 0 END AS live_flag,
        CASE WHEN sc.service_type_code IN ('CF', 'CFS') THEN 1 ELSE 0 END AS critical_flag,
        CASE WHEN sc.next_review_due_at IS NULL OR sc.next_review_due_at < CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS overdue_review_flag,
        CASE WHEN support.support_model_count = 0 OR owner.email IS NULL AND owner.display_name IS NULL THEN 1 ELSE 0 END AS readiness_blocker_flag,
        CASE WHEN contract_link.contract_link_count = 0 THEN 1 ELSE 0 END AS contract_gap_flag,
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
        SELECT COUNT(*)::integer AS contract_link_count
        FROM contract_service_link csl
        JOIN contract c ON c.contract_id = csl.contract_id
        WHERE csl.service_id = sc.id
          AND c.status IN ('draft', 'active')
    ) contract_link ON TRUE
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
        SUM(contract_gap_flag)::integer AS contract_gaps,
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
    contract_gaps,
    c3_gaps,
    (
        owned_services * 1
        + live_services * 2
        + critical_services * 3
        + readiness_blockers * 4
        + overdue_reviews * 3
        + contract_gaps * 2
        + c3_gaps * 2
    )::integer AS owner_load_score
FROM owner_stats;

CREATE OR REPLACE VIEW v_contract_overlap AS
WITH linked_targets AS (
    SELECT
        'service'::text AS overlap_scope,
        sc.id::text AS overlap_key,
        sc.title AS overlap_title,
        c.contract_id,
        c.contract_code,
        c.vendor_id,
        c.annual_cost
    FROM contract_service_link csl
    JOIN contract c ON c.contract_id = csl.contract_id
    JOIN service_catalog sc ON sc.id = csl.service_id
    WHERE c.status IN ('draft', 'active')
      AND sc.is_deleted = FALSE
      AND sc.is_stub = FALSE
    UNION ALL
    SELECT
        'capability'::text AS overlap_scope,
        ccl.capability_uuid AS overlap_key,
        COALESCE(ccl.capability_title, ccl.capability_uuid) AS overlap_title,
        c.contract_id,
        c.contract_code,
        c.vendor_id,
        c.annual_cost
    FROM contract_capability_link ccl
    JOIN contract c ON c.contract_id = ccl.contract_id
    WHERE c.status IN ('draft', 'active')
)
SELECT
    overlap_scope,
    overlap_key,
    overlap_title,
    COUNT(DISTINCT contract_id)::integer AS contract_count,
    COUNT(DISTINCT vendor_id)::integer AS vendor_count,
    STRING_AGG(DISTINCT contract_code, ', ' ORDER BY contract_code) AS contract_codes,
    COALESCE(SUM(annual_cost), 0)::numeric(14,2) AS annual_cost_total,
    CASE
        WHEN COUNT(DISTINCT contract_id) >= 3 THEN 'P1'
        ELSE 'P2'
    END AS severity
FROM linked_targets
GROUP BY overlap_scope, overlap_key, overlap_title
HAVING COUNT(DISTINCT contract_id) > 1;

CREATE OR REPLACE VIEW v_contract_renewal_risk AS
SELECT
    c.contract_id,
    c.contract_code,
    c.title,
    c.status,
    c.renewal_date,
    (c.renewal_date - CURRENT_DATE)::integer AS days_to_renewal,
    v.vendor_code,
    v.vendor_name,
    c.contract_owner_email,
    c.annual_cost,
    c.currency_code,
    CASE
        WHEN c.renewal_date < CURRENT_DATE THEN 'P0'
        WHEN c.renewal_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'P0'
        WHEN c.renewal_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'P1'
        ELSE 'P2'
    END AS severity,
    ('/operations/contracts?contract=' || c.contract_id)::text AS target_url
FROM contract c
LEFT JOIN vendor v ON v.vendor_id = c.vendor_id
WHERE c.status IN ('draft', 'active')
  AND c.renewal_date IS NOT NULL;

CREATE OR REPLACE VIEW v_gap_duplication_advisor AS
SELECT
    finding_key,
    severity,
    'risk'::text AS finding_type,
    title,
    reason,
    suggested_action,
    source_entity_type,
    source_entity_id,
    target_url,
    score
FROM v_service_risk_radar
UNION ALL
SELECT
    ('owner:' || owner_key || ':overloaded')::text AS finding_key,
    CASE WHEN owner_load_score >= 80 THEN 'P1' ELSE 'P2' END AS severity,
    'owner_load'::text AS finding_type,
    ('Owner load: ' || owner_name)::text AS title,
    ('Owner has load score ' || owner_load_score || ' across ' || owned_services || ' services.')::text AS reason,
    'Review service ownership, delegate operational responsibility, or split overloaded portfolio.'::text AS suggested_action,
    'owner'::text AS source_entity_type,
    owner_key AS source_entity_id,
    ('/operations/owner-load?owner=' || owner_key)::text AS target_url,
    owner_load_score::numeric AS score
FROM v_owner_load
WHERE owner_load_score >= 40
UNION ALL
SELECT
    ('contract-overlap:' || overlap_scope || ':' || overlap_key)::text AS finding_key,
    severity,
    'contract_overlap'::text AS finding_type,
    ('Contract overlap: ' || overlap_title)::text AS title,
    ('Target is covered by ' || contract_count || ' contracts across ' || vendor_count || ' vendors.')::text AS reason,
    'Review overlap, remove duplicate coverage, or document why parallel contracts are required.'::text AS suggested_action,
    overlap_scope AS source_entity_type,
    overlap_key AS source_entity_id,
    ('/operations/contracts?overlap=' || overlap_key)::text AS target_url,
    contract_count::numeric AS score
FROM v_contract_overlap
UNION ALL
SELECT
    ('contract:' || contract_id || ':renewal')::text AS finding_key,
    severity,
    'renewal'::text AS finding_type,
    ('Contract renewal: ' || title)::text AS title,
    ('Contract renews in ' || days_to_renewal || ' days.')::text AS reason,
    'Confirm renewal decision, owner, budget, and service coverage before the renewal window closes.'::text AS suggested_action,
    'contract'::text AS source_entity_type,
    contract_id::text AS source_entity_id,
    target_url,
    (GREATEST(0, 90 - days_to_renewal))::numeric AS score
FROM v_contract_renewal_risk
WHERE days_to_renewal <= 90;

SET search_path TO platform, public;
INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '22_governance_views',
    'Governance radar and advisor views',
    '2.3.0',
    'Adds service risk radar, owner load, contract overlap, renewal risk, and gap/duplication advisor views'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;
