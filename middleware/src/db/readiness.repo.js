'use strict';

const { getPool } = require('./pool');

const SERVICE_STATE_SELECT = `
    SELECT
        sc.id AS service_pk,
        sc.service_id,
        sc.title,
        sc.service_status_code AS service_status,
        sc.lifecycle_stage_code,
        sc.lifecycle_state,
        sc.requestable,
        sc.review_due_at,
        sc.next_review_due_at,
        sc.sla_availability,
        sc.sla_restoration_hours AS sla_restoration,
        sc.sla_delivery_days AS sla_delivery,
        sc.service_cost_raw,
        sc.pricing_note_raw,
        COALESCE(owner.owner_count, 0) AS owner_count,
        COALESCE(offering.offering_count, 0) AS offering_count,
        COALESCE(sla_records.sla_record_count, 0) AS sla_record_count,
        COALESCE(pricing.priced_flavour_count, 0) AS priced_flavour_count,
        COALESCE(active_flavour.active_flavour_count, 0) AS active_flavour_count,
        COALESCE(relation.relation_count, 0) AS relation_count,
        COALESCE(relation.dependency_relation_count, 0) AS dependency_relation_count,
        COALESCE(primary_mapping.primary_mapping_count, 0) AS primary_mapping_count,
        primary_mapping.primary_c3_uuid,
        cap.title AS primary_c3_title,
        cap.external_id AS primary_c3_code,
        COALESCE(comp.completeness_status, 'incomplete') AS primary_c3_completeness_status,
        COALESCE(comp.app_count, 0) AS primary_c3_app_count,
        COALESCE(comp.data_object_count, 0) AS primary_c3_data_object_count,
        COALESCE(comp.tin_count, 0) AS primary_c3_tin_count,
        COALESCE(comp.c3_service_count, 0) AS primary_c3_c3_service_count,
        COALESCE(comp.service_mapping_count, 0) AS primary_c3_service_mapping_count,
        CASE
            WHEN COALESCE(primary_mapping.primary_mapping_count, 0) = 1
             AND primary_mapping.primary_c3_uuid IS NOT NULL
            THEN TRUE ELSE FALSE
        END AS has_single_primary_mapping,
        CASE WHEN comp.completeness_status = 'complete' THEN TRUE ELSE FALSE END AS has_complete_primary_capability,
        CASE WHEN COALESCE(active_flavour.active_flavour_count, 0) > 0 THEN TRUE ELSE FALSE END AS has_active_flavour,
        CASE
            WHEN COALESCE(sc.service_cost_raw, '') <> ''
              OR COALESCE(sc.pricing_note_raw, '') <> ''
              OR COALESCE(pricing.priced_flavour_count, 0) > 0
            THEN TRUE ELSE FALSE
        END AS has_price_note
    FROM data.service_catalog sc
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS owner_count
        FROM data.service_role_assignment sra
        WHERE sra.service_id = sc.id
          AND sra.role_code = 'service_owner'
          AND sra.valid_to IS NULL
          AND NULLIF(TRIM(COALESCE(sra.display_name, '') || COALESCE(sra.email, '')), '') IS NOT NULL
    ) owner ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS offering_count
        FROM data.service_offering so
        WHERE so.service_id = sc.id
          AND so.status <> 'deleted'
    ) offering ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS sla_record_count
        FROM data.service_sla sl
        WHERE sl.service_id = sc.id
    ) sla_records ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS active_flavour_count
        FROM data.service_flavour sf
        WHERE sf.service_id = sc.id
          AND sf.is_deleted = FALSE
          AND lower(COALESCE(sf.flavour_status_code, '')) IN ('available', 'active')
    ) active_flavour ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS priced_flavour_count
        FROM data.service_flavour sf
        WHERE sf.service_id = sc.id
          AND sf.is_deleted = FALSE
          AND sf.price_value IS NOT NULL
    ) pricing ON TRUE
    LEFT JOIN LATERAL (
        SELECT
            COUNT(sr.id)::integer AS relation_count,
            SUM(CASE WHEN sr.relation_type_code IN ('depends_on', 'prerequisite', 'underlying', 'requires_account', 'uses') THEN 1 ELSE 0 END)::integer AS dependency_relation_count
        FROM data.service_relation sr
        WHERE sr.is_deleted = FALSE
          AND (sr.from_service_id = sc.id OR sr.to_service_id = sc.id)
    ) relation ON TRUE
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*)::integer AS primary_mapping_count,
            MAX(CASE WHEN scm.is_primary = TRUE THEN scm.c3_uuid END) AS primary_c3_uuid
        FROM data.service_c3_mapping scm
        WHERE scm.service_id = sc.id
          AND scm.is_primary = TRUE
    ) primary_mapping ON TRUE
    LEFT JOIN data.c3_taxonomy cap
      ON cap.uuid = primary_mapping.primary_c3_uuid
    LEFT JOIN data.v_c3capabilitycompleteness comp
      ON comp.uuid = primary_mapping.primary_c3_uuid
`;

function normalizeLimit(value, fallback = 100) {
    const parsed = Number.parseInt(String(value ?? fallback), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(500, parsed));
}

function normalizeOffset(value) {
    const parsed = Number.parseInt(String(value ?? 0), 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, parsed);
}

async function listRules({ includeDisabled = true } = {}) {
    const where = includeDisabled ? '' : 'WHERE enabled = TRUE';
    const result = await getPool().query(`
        SELECT
            rule_key,
            title,
            description,
            title_text,
            why_text,
            howto_text,
            evidence_hint,
            severity,
            enabled,
            blocking,
            applies_to_lifecycle_stage,
            created_at,
            updated_at
        FROM data.readiness_rule
        ${where}
        ORDER BY
            CASE severity WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
            rule_key ASC
    `);
    return result.rows;
}

async function getServiceState(serviceId) {
    const result = await getPool().query(`
        ${SERVICE_STATE_SELECT}
        WHERE sc.service_id = $1
          AND sc.is_deleted = FALSE
    `, [serviceId]);
    return result.rows[0] ?? null;
}

async function getServiceStateByCatalogId(catalogId) {
    const result = await getPool().query(`
        ${SERVICE_STATE_SELECT}
        WHERE sc.id = $1
          AND sc.is_deleted = FALSE
    `, [catalogId]);
    return result.rows[0] ?? null;
}

async function listServiceStates(filters = {}) {
    const params = [];
    const where = ['sc.is_deleted = FALSE', 'sc.is_stub = FALSE'];

    if (filters.lifecycle) {
        params.push(filters.lifecycle);
        where.push(`(sc.lifecycle_stage_code = $${params.length} OR sc.lifecycle_state = $${params.length})`);
    }
    if (filters.owner) {
        params.push(`%${String(filters.owner).trim()}%`);
        where.push(`EXISTS (
            SELECT 1
            FROM data.service_role_assignment sra_filter
            WHERE sra_filter.service_id = sc.id
              AND sra_filter.valid_to IS NULL
              AND (sra_filter.display_name ILIKE $${params.length} OR sra_filter.email ILIKE $${params.length})
        )`);
    }

    params.push(normalizeLimit(filters.limit));
    const limitPlaceholder = `$${params.length}`;
    params.push(normalizeOffset(filters.offset));
    const offsetPlaceholder = `$${params.length}`;

    const result = await getPool().query(`
        ${SERVICE_STATE_SELECT}
        WHERE ${where.join(' AND ')}
        ORDER BY sc.title ASC
        LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `, params);
    return result.rows;
}

async function listExceptionsForService(servicePk) {
    const result = await getPool().query(`
        SELECT
            re.id,
            re.service_id,
            sc.service_id AS service_code,
            re.rule_key,
            re.reason,
            re.expires_at,
            re.approved_by,
            re.created_at,
            CASE WHEN re.expires_at IS NOT NULL AND re.expires_at < CURRENT_TIMESTAMP THEN TRUE ELSE FALSE END AS expired
        FROM data.readiness_exception re
        JOIN data.service_catalog sc
          ON sc.id = re.service_id
        WHERE re.service_id = $1
        ORDER BY re.rule_key ASC
    `, [servicePk]);
    return result.rows;
}

async function resolveServicePk(serviceId) {
    const result = await getPool().query(`
        SELECT id
        FROM data.service_catalog
        WHERE service_id = $1
          AND is_deleted = FALSE
    `, [serviceId]);
    return result.rows[0]?.id ?? null;
}

async function createException(serviceId, ruleKey, data) {
    const servicePk = await resolveServicePk(serviceId);
    if (!servicePk) {
        const err = new Error(`Service not found: ${serviceId}`);
        err.status = 404;
        throw err;
    }

    const result = await getPool().query(`
        INSERT INTO data.readiness_exception
            (service_id, rule_key, reason, expires_at, approved_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (service_id, rule_key) DO UPDATE
        SET reason = EXCLUDED.reason,
            expires_at = EXCLUDED.expires_at,
            approved_by = EXCLUDED.approved_by,
            created_at = CURRENT_TIMESTAMP
        RETURNING id, service_id, rule_key, reason, expires_at, approved_by, created_at
    `, [
        servicePk,
        ruleKey,
        data.reason,
        data.expires_at ?? null,
        data.approved_by ?? null,
    ]);
    return result.rows[0] ?? null;
}

async function deleteException(serviceId, ruleKey) {
    const servicePk = await resolveServicePk(serviceId);
    if (!servicePk) return false;

    const result = await getPool().query(`
        DELETE FROM data.readiness_exception
        WHERE service_id = $1
          AND rule_key = $2
        RETURNING id
    `, [servicePk, ruleKey]);
    return result.rows.length > 0;
}

module.exports = {
    listRules,
    getServiceState,
    getServiceStateByCatalogId,
    listServiceStates,
    listExceptionsForService,
    createException,
    deleteException,
};
