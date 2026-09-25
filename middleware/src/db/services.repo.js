'use strict';

const { getPool } = require('./pool');
const { toLifecycleStage } = require('../utils/lifecycle');
const {
    SERVICE_STATUS_SQL,
    LIFECYCLE_STATE_SQL,
    PRIMARY_SLA_JOIN,
    SOURCE_JOIN,
    sourceRawSql,
    canonicalizeServiceInput,
    resolvePortfolioId,
    upsertPrimarySla,
    upsertServiceSource,
} = require('./service-fields');

const SC_COLUMNS = `
    sc.id,
    sc.service_id,
    sc.title,
    sc.portfolio_id,
    sp.portfolio_code,
    sp.title AS portfolio_title,
    sp.portfolio_code AS portfolio_group,
    COALESCE(pg.name, sp.title, sp.portfolio_code) AS portfolio_group_name,
    sc.service_type_code AS service_type,
    COALESCE(st.name, sc.service_type_code) AS service_type_name,
    ${SERVICE_STATUS_SQL} AS service_status,
    COALESCE(ss.name, ${SERVICE_STATUS_SQL}) AS service_status_name,
    sc.catalogue_version,
    sc.short_description AS summary,
    sc.description AS detailed_description,
    sc.global_service_group_code,
    COALESCE(gsg.name, sc.global_service_group_code) AS global_service_group_name,
    sc.service_line_code,
    COALESCE(sl.name, sc.service_line_code) AS service_line_name,
    sc.service_features,
    sc.consumer_value,
    sc.unit_of_measure,
    sc.charging_basis,
    sc.rate_note,
    sc.ordering_note,
    sc.exclusions,
    ${sourceRawSql('service_area_raw')} AS service_area,
    sc.security_classification_code AS security_classification,
    (
        SELECT string_agg(sao.domain_code, ',')
        FROM data.service_available_on sao
        WHERE sao.service_id = sc.id
    ) AS available_on,
    ${sourceRawSql('customer_type_json')} AS customer_type,
    sc.service_url AS source_url,
    sla.availability_pct AS sla_availability,
    sla.restoration_hours AS sla_restoration,
    sla.delivery_days AS sla_delivery,
    sla.restoration_text AS sla_restoration_text,
    sla.delivery_text AS sla_delivery_text,
    sc.scope_text,
    sc.operational_notes_raw,
    ${sourceRawSql('support_locations_raw')} AS support_locations_raw,
    ${sourceRawSql('request_process_raw')} AS request_process_raw,
    ${sourceRawSql('support_availability_raw')} AS support_availability_raw,
    ${sourceRawSql('service_cost_raw')} AS service_cost_raw,
    ${sourceRawSql('additional_information_raw')} AS additional_information_raw,
    sc.target_audience_summary,
    sc.requestable,
    ${LIFECYCLE_STATE_SQL} AS lifecycle_state,
    sc.lifecycle_stage_code,
    sc.criticality_code,
    sc.review_due_at,
    sc.request_channel_type,
    sc.request_channel_url,
    sc.approval_required,
    sc.fulfillment_lead_time_text,
    ${sourceRawSql('service_features_raw')} AS service_features_raw,
    ${sourceRawSql('ext_tools_raw')} AS ext_tools_raw,
    ${sourceRawSql('legacy_ssl_mapping_raw')} AS legacy_ssl_mapping_raw,
    sc.budget_activity_code,
    ${sourceRawSql('other_info_raw')} AS other_info_raw,
    ${sourceRawSql('pricing_note_raw')} AS pricing_note_raw,
    sc.review_owner_user_id,
    sc.graph_x,
    sc.graph_y,
    ${sourceRawSql('options_json')} AS options,
    sc.notes_json AS notes,
    ${sourceRawSql('training_refs_json')} AS training_refs,
    sc.retired_note,
    src.source_local_id,
    src.source_sp_id,
    src.source_etag,
    ${sourceRawSql('prerequisites_json')} AS prerequisites_json,
    ${sourceRawSql('dependencies_json')} AS dependencies_json,
    sc.organizational_element_code,
    sc.is_deleted,
    sc.is_stub,
    ${sourceRawSql('cp_service_type_raw')} AS cp_service_type_raw,
    COALESCE(src.is_available_status_ambiguous, FALSE) AS is_available_status_ambiguous,
    sc.created_at,
    sc.created_by,
    sc.updated_at,
    sc.updated_by,
    src.created_at_source,
    src.modified_at_source,
    sc.completeness_score,
    (
        SELECT display_name
        FROM data.service_role_assignment
        WHERE service_id = sc.id AND role_code = 'service_owner' AND valid_to IS NULL
        LIMIT 1
    ) AS service_owner,
    (
        SELECT display_name
        FROM data.service_role_assignment
        WHERE service_id = sc.id AND role_code = 'service_area_owner' AND valid_to IS NULL
        LIMIT 1
    ) AS vlastnik,
    (
        SELECT display_name
        FROM data.service_role_assignment
        WHERE service_id = sc.id AND role_code = 'service_delivery_manager' AND valid_to IS NULL
        LIMIT 1
    ) AS manager
`;

const C3M_COLUMNS = `
    scm.c3_uuid,
    scm.c3_parent_uuid AS c3_parent_id,
    scm.c3_level,
    scm.c3_domain,
    scm.c3_source,
    scm.c3_reference,
    scm.synced_at AS c3_synced_at,
    scm.sync_status AS c3_sync_status,
    scm.is_primary AS c3_is_primary
`;

function splitCsv(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function serializeJson(value) {
    if (value == null) return null;
    if (typeof value === 'string') return value || null;
    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
}

function parseDecimal(value) {
    if (value == null) return null;
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function parseInteger(value) {
    if (value == null) return null;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function parseJsonArray(value) {
    if (value == null || value === '') return [];
    if (Array.isArray(value)) return value;
    try {
        return JSON.parse(value);
    } catch {
        return [];
    }
}

function sanitizeDate(value) {
    if (value == null) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const normalized = String(value).trim();
    if (!normalized) return null;
    const odataMatch = normalized.match(/^\/Date\((-?\d+)[+-]?\d*\)\/$/);
    if (odataMatch) {
        const date = new Date(parseInt(odataMatch[1], 10));
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (normalized === '0001-01-01T00:00:00' || normalized === '0001-01-01T00:00:00Z') return null;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(normalized)) {
        const date = new Date(`${normalized}Z`);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(normalized)) {
        const date = new Date(`${normalized.replace(' ', 'T')}Z`);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
}

function hydrateService(row) {
    if (!row) return null;
    return {
        ...row,
        available_on: row.available_on
            ? row.available_on.split(',').map((item) => item.trim()).filter(Boolean)
            : [],
        customer_type: parseJsonArray(row.customer_type),
        options: parseJsonArray(row.options),
        notes: parseJsonArray(row.notes),
        training_refs: parseJsonArray(row.training_refs),
        prerequisites: parseJsonArray(row.prerequisites_json),
        dependencies: parseJsonArray(row.dependencies_json),
    };
}

async function getCatalogId(serviceId) {
    const result = await getPool().query(`
        SELECT id
        FROM data.service_catalog
        WHERE service_id = $1
          AND is_deleted = FALSE
    `, [serviceId]);
    return result.rows[0]?.id ?? null;
}

async function findAllDirect({
    page = 1,
    limit = 50,
    status,
    serviceType,
    portfolioGroup,
    portfolioCode,
    domain,
    search,
    ownerName,
    lifecycleState,
    lifecycleStageCode,
    criticalityCode,
    reviewDue,
    readiness,
    requestable,
    sort = 'title',
    order = 'ASC',
} = {}) {
    const offset = (page - 1) * limit;
    const statusValues = splitCsv(status);
    const serviceTypeValues = splitCsv(serviceType);
    const domainValues = splitCsv(domain);
    const lifecycleValues = splitCsv(lifecycleState);
    const sortColMap = {
        service_id: 'sc.service_id',
        title: 'sc.title',
        service_status: SERVICE_STATUS_SQL,
        service_type: 'sc.service_type_code',
        portfolio_group: 'sp.portfolio_code',
        updated_at: 'sc.updated_at',
    };
    const sortCol = sortColMap[sort] || 'sc.title';
    const sortDir = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const filters = ['sc.is_deleted = FALSE', 'sc.is_stub = FALSE'];
    // Legacy status and lifecycle filters are mapped to lifecycle stages.
    const statusStageValues = statusValues.map((value) => toLifecycleStage(value) ?? value);
    const values = [];

    function bind(value) {
        values.push(value);
        return `$${values.length}`;
    }

    if (statusValues.length) {
        filters.push(`sc.lifecycle_stage_code = ANY(${bind(statusStageValues)}::varchar[])`);
    }
    if (serviceTypeValues.length) {
        filters.push(`sc.service_type_code = ANY(${bind(serviceTypeValues)}::varchar[])`);
    }
    if (portfolioGroup) {
        filters.push(`EXISTS (
            SELECT 1 FROM data.service_portfolio sp_group
            WHERE sp_group.id = sc.portfolio_id AND sp_group.portfolio_code = ${bind(portfolioGroup)}
        )`);
    }
    if (portfolioCode) {
        filters.push(`EXISTS (
            SELECT 1
            FROM data.service_portfolio sp_filter
            WHERE sp_filter.id = sc.portfolio_id
              AND sp_filter.portfolio_code = ${bind(portfolioCode)}
        )`);
    }
    if (domainValues.length) {
        filters.push(`EXISTS (
            SELECT 1
            FROM data.service_available_on sao
            WHERE sao.service_id = sc.id
              AND sao.domain_code = ANY(${bind(domainValues)}::varchar[])
        )`);
    }
    if (search) {
        const searchPlaceholder = bind(`%${search}%`);
        filters.push(`(
            sc.title                      ILIKE ${searchPlaceholder}
            OR sc.service_id              ILIKE ${searchPlaceholder}
            OR sc.short_description       ILIKE ${searchPlaceholder}
            OR sc.description             ILIKE ${searchPlaceholder}
            OR sc.target_audience_summary ILIKE ${searchPlaceholder}
            OR sc.consumer_value          ILIKE ${searchPlaceholder}
            OR sc.service_line_code       ILIKE ${searchPlaceholder}
            OR EXISTS (
                SELECT 1 FROM data.service_portfolio sp_s
                WHERE sp_s.id = sc.portfolio_id AND sp_s.portfolio_code ILIKE ${searchPlaceholder}
            )
            OR sc.service_type_code       ILIKE ${searchPlaceholder}
            OR EXISTS (
                SELECT 1 FROM data.service_catalog_source src_s
                WHERE src_s.service_catalog_id = sc.id
                  AND (src_s.raw_fields->>'service_area_raw' ILIKE ${searchPlaceholder}
                       OR src_s.raw_fields->>'customer_type_json' ILIKE ${searchPlaceholder})
            )
            OR EXISTS (
                SELECT 1
                FROM data.service_audience_policy sap_s
                WHERE sap_s.service_id = sc.id
                  AND sap_s.audience_type ILIKE ${searchPlaceholder}
            )
        )`);
    }
    if (ownerName) {
        const ownerExact = bind(ownerName);
        const ownerLike = bind(`%${ownerName}%`);
        filters.push(`EXISTS (
            SELECT 1
            FROM data.service_role_assignment sra
            WHERE sra.service_id = sc.id
              AND sra.role_code IN ('service_owner', 'owner', 'steward', 'delivery_manager', 'service_delivery_manager')
              AND (
                LOWER(COALESCE(sra.display_name, '')) = LOWER(${ownerExact})
                OR LOWER(COALESCE(sra.email, '')) = LOWER(${ownerExact})
                OR sra.display_name ILIKE ${ownerLike}
                OR sra.email ILIKE ${ownerLike}
              )
              AND sra.valid_to IS NULL
        )`);
    }
    if (lifecycleValues.length) {
        filters.push(`sc.lifecycle_stage_code = ANY(${bind(lifecycleValues.map((value) => toLifecycleStage(value) ?? value))}::varchar[])`);
    }
    const lifecycleStageValues = splitCsv(lifecycleStageCode).map((value) => toLifecycleStage(value) ?? value);
    if (lifecycleStageValues.length) {
        filters.push(`sc.lifecycle_stage_code = ANY(${bind(lifecycleStageValues)}::varchar[])`);
    }
    const criticalityValues = splitCsv(criticalityCode);
    if (criticalityValues.length) {
        filters.push(`sc.criticality_code = ANY(${bind(criticalityValues)}::varchar[])`);
    }
    if (reviewDue === 'overdue') {
        filters.push(`sc.review_due_at < CURRENT_TIMESTAMP`);
    } else if (reviewDue === 'missing') {
        filters.push(`sc.review_due_at IS NULL`);
    } else if (reviewDue === 'next_30') {
        filters.push(`sc.review_due_at >= CURRENT_TIMESTAMP`);
        filters.push(`sc.review_due_at < CURRENT_TIMESTAMP + INTERVAL '30 days'`);
    } else if (reviewDue === 'next_90') {
        filters.push(`sc.review_due_at >= CURRENT_TIMESTAMP`);
        filters.push(`sc.review_due_at < CURRENT_TIMESTAMP + INTERVAL '90 days'`);
    }
    if (readiness === 'attention') {
        filters.push(`COALESCE(sc.lifecycle_stage_code, '') <> 'retired'`);
        filters.push(`COALESCE(sc.completeness_score, 0) < 80`);
    } else if (readiness === 'blocked') {
        filters.push(`COALESCE(sc.completeness_score, 0) < 50`);
    } else if (readiness === 'warning') {
        filters.push(`COALESCE(sc.completeness_score, 0) >= 50`);
        filters.push(`COALESCE(sc.completeness_score, 0) < 80`);
    } else if (readiness === 'ready') {
        filters.push(`COALESCE(sc.completeness_score, 0) >= 80`);
    } else if (readiness === 'missing_owner') {
        filters.push(`NOT EXISTS (
            SELECT 1
            FROM data.service_role_assignment sra_ready
            WHERE sra_ready.service_id = sc.id
              AND sra_ready.role_code = 'service_owner'
              AND sra_ready.valid_to IS NULL
        )`);
    } else if (readiness === 'missing_capability') {
        filters.push(`NOT EXISTS (
            SELECT 1
            FROM data.service_c3_mapping scm_ready
            WHERE scm_ready.service_id = sc.id
              AND scm_ready.is_primary = TRUE
        )`);
    } else if (readiness === 'missing_request') {
        filters.push(`(
            COALESCE(sc.requestable, FALSE) = TRUE
            OR EXISTS (
                SELECT 1
                FROM data.service_offering so_requestable
                WHERE so_requestable.service_id = sc.id
                  AND so_requestable.status <> 'deleted'
                  AND COALESCE(so_requestable.requestable, sc.requestable, FALSE) = TRUE
            )
        )`);
        filters.push(`NULLIF(BTRIM(COALESCE(sc.request_channel_type, '')), '') IS NULL`);
        filters.push(`NULLIF(BTRIM(COALESCE(sc.request_channel_url, '')), '') IS NULL`);
        filters.push(`NOT EXISTS (
            SELECT 1
            FROM data.service_offering so_channel
            WHERE so_channel.service_id = sc.id
              AND so_channel.status <> 'deleted'
              AND COALESCE(so_channel.requestable, FALSE) = TRUE
              AND (
                NULLIF(BTRIM(COALESCE(so_channel.request_channel_type, '')), '') IS NOT NULL
                OR NULLIF(BTRIM(COALESCE(so_channel.request_channel_url, '')), '') IS NOT NULL
              )
        )`);
    }
    if (requestable === true || requestable === 'true') {
        filters.push(`sc.requestable = TRUE`);
    } else if (requestable === false || requestable === 'false') {
        filters.push(`sc.requestable = FALSE`);
    }

    const whereClause = filters.join(' AND ');
    const countResult = await getPool().query(`
        SELECT COUNT(*)::integer AS total
        FROM data.service_catalog sc
        WHERE ${whereClause}
    `, values);

    const dataValues = [...values, limit, offset];
    const dataResult = await getPool().query(`
        SELECT
            sc.id,
            sc.service_id,
            sc.title,
            sc.portfolio_id,
            sp.portfolio_code,
            sp.title AS portfolio_title,
            sc.short_description,
            sc.service_type_code AS service_type,
            ${SERVICE_STATUS_SQL} AS service_status,
            sc.unit_of_measure,
            sc.charging_basis,
            (
                SELECT string_agg(sao.domain_code, ',')
                FROM data.service_available_on sao
                WHERE sao.service_id = sc.id
            ) AS available_on,
            sla.availability_pct AS sla_availability,
            sla.delivery_days AS sla_delivery,
            sla.restoration_hours AS sla_restoration,
            sp.portfolio_code AS portfolio_group,
            COALESCE(pg.name, sp.title, sp.portfolio_code) AS portfolio_group_name,
            COALESCE(sp.title, pg.name, sp.portfolio_code) AS portfolio_display_name,
            COALESCE(sl.name, sc.service_line_code) AS service_line_name,
            COALESCE(gsg.name, sc.global_service_group_code) AS global_service_group_name,
            ${LIFECYCLE_STATE_SQL} AS lifecycle_state,
            sc.lifecycle_stage_code,
            sc.criticality_code,
            sc.review_due_at,
            sc.requestable,
            sc.graph_x,
            sc.graph_y,
            sc.updated_at,
            scm.c3_uuid,
            EXISTS (
                SELECT 1
                FROM data.service_c3_mapping scm_ready
                WHERE scm_ready.service_id = sc.id
                  AND scm_ready.is_primary = TRUE
            ) AS has_c3_mapping,
            (
                SELECT COUNT(DISTINCT scm_count.c3_uuid)::integer
                FROM data.service_c3_mapping scm_count
                WHERE scm_count.service_id = sc.id
            ) AS c3_mapping_count,
            (
                SELECT MAX(ct_primary.title)
                FROM data.service_c3_mapping scm_primary
                LEFT JOIN data.c3_taxonomy ct_primary
                  ON ct_primary.uuid = scm_primary.c3_uuid
                WHERE scm_primary.service_id = sc.id
                  AND scm_primary.is_primary = TRUE
            ) AS primary_capability_title,
            (
                SELECT MAX(ct_primary.external_id)
                FROM data.service_c3_mapping scm_primary
                LEFT JOIN data.c3_taxonomy ct_primary
                  ON ct_primary.uuid = scm_primary.c3_uuid
                WHERE scm_primary.service_id = sc.id
                  AND scm_primary.is_primary = TRUE
            ) AS primary_capability_code,
            (
                SELECT MIN(sf.price_value)
                FROM data.service_flavour sf
                WHERE sf.service_id = sc.id
                  AND sf.is_deleted = FALSE
                  AND sf.price_value IS NOT NULL
            ) AS in_service_eur,
            (
                SELECT string_agg(sf.flavour_code || COALESCE(' · ' || sf.title, ''), '; ')
                FROM data.service_flavour sf
                WHERE sf.service_id = sc.id
                  AND sf.is_deleted = FALSE
            ) AS flavours_summary,
            (
                SELECT COUNT(*)::integer
                FROM data.service_flavour sf
                WHERE sf.service_id = sc.id
                  AND sf.is_deleted = FALSE
                  AND lower(coalesce(sf.flavour_status_code, '')) IN ('available', 'active')
            ) AS flavour_count,
            (
                SELECT COUNT(*)::integer
                FROM data.service_relation sr
                WHERE sr.is_deleted = FALSE
                  AND (sr.from_service_id = sc.id OR sr.to_service_id = sc.id)
            ) AS relation_count,
            (
                SELECT display_name
                FROM data.service_role_assignment
                WHERE service_id = sc.id AND role_code = 'service_owner' AND valid_to IS NULL
                LIMIT 1
            ) AS service_owner,
            (
                SELECT display_name
                FROM data.service_role_assignment
                WHERE service_id = sc.id AND role_code = 'service_area_owner' AND valid_to IS NULL
                LIMIT 1
            ) AS vlastnik,
            (
                SELECT display_name
                FROM data.service_role_assignment
                WHERE service_id = sc.id AND role_code = 'service_delivery_manager' AND valid_to IS NULL
                LIMIT 1
            ) AS manager
        FROM data.service_catalog sc
        LEFT JOIN data.service_portfolio sp
            ON sp.id = sc.portfolio_id
        LEFT JOIN data.service_c3_mapping scm
            ON scm.service_id = sc.id AND scm.is_primary = TRUE
        LEFT JOIN data.ref_portfolio_group pg
            ON pg.code = sp.portfolio_code
        ${PRIMARY_SLA_JOIN}
        ${SOURCE_JOIN}
        LEFT JOIN data.ref_service_line sl
            ON sl.code = sc.service_line_code
        LEFT JOIN data.ref_global_service_group gsg
            ON gsg.code = sc.global_service_group_code
        WHERE ${whereClause}
        ORDER BY ${sortCol} ${sortDir}
        LIMIT $${dataValues.length - 1}
        OFFSET $${dataValues.length}
    `, dataValues);

    return {
        items: dataResult.rows,
        total: countResult.rows[0]?.total ?? 0,
        page,
        limit,
    };
}

async function findByServiceId(serviceId) {
    const result = await getPool().query(`
        SELECT
            ${SC_COLUMNS},
            ${C3M_COLUMNS},
            (
                SELECT COUNT(*)::integer
                FROM data.service_flavour sf
                WHERE sf.service_id = sc.id
                  AND sf.is_deleted = FALSE
                  AND lower(coalesce(sf.flavour_status_code, '')) IN ('available', 'active')
            ) AS flavour_count,
            (
                SELECT COUNT(*)::integer
                FROM data.service_relation sr
                WHERE sr.is_deleted = FALSE
                  AND (sr.from_service_id = sc.id OR sr.to_service_id = sc.id)
            ) AS relation_count
        FROM data.service_catalog sc
        LEFT JOIN data.service_c3_mapping scm
            ON scm.service_id = sc.id AND scm.is_primary = TRUE
        LEFT JOIN data.service_portfolio sp
            ON sp.id = sc.portfolio_id
        LEFT JOIN data.ref_portfolio_group pg
            ON pg.code = sp.portfolio_code
        ${PRIMARY_SLA_JOIN}
        ${SOURCE_JOIN}
        LEFT JOIN data.ref_service_line sl
            ON sl.code = sc.service_line_code
        LEFT JOIN data.ref_global_service_group gsg
            ON gsg.code = sc.global_service_group_code
        LEFT JOIN data.ref_service_type st
            ON st.code = sc.service_type_code
        LEFT JOIN data.ref_service_status ss
            ON ss.code = ${SERVICE_STATUS_SQL}
        WHERE sc.service_id = $1
          AND sc.is_deleted = FALSE
    `, [serviceId]);

    return hydrateService(result.rows[0] || null);
}

const findById = findByServiceId;

async function findAllForExport() {
    const result = await getPool().query(`
        SELECT
            ${SC_COLUMNS},
            scm.c3_uuid,
            scm.c3_level,
            scm.c3_domain,
            (
                SELECT string_agg(
                    sf.flavour_code
                    || ': '
                    || sf.title
                    || CASE
                        WHEN sf.price_value IS NOT NULL
                            THEN ' (' || sf.price_value::text || ' ' || coalesce(sf.currency_code, 'EUR') || '/' || coalesce(sf.service_unit, '') || ')'
                        ELSE ''
                    END,
                    '; '
                )
                FROM data.service_flavour sf
                WHERE sf.service_id = sc.id
                  AND sf.is_deleted = FALSE
                  AND lower(coalesce(sf.flavour_status_code, '')) IN ('available', 'active')
            ) AS flavours_summary
        FROM data.service_catalog sc
        LEFT JOIN data.service_c3_mapping scm
            ON scm.service_id = sc.id AND scm.is_primary = TRUE
        LEFT JOIN data.service_portfolio sp
            ON sp.id = sc.portfolio_id
        LEFT JOIN data.ref_portfolio_group pg
            ON pg.code = sp.portfolio_code
        ${PRIMARY_SLA_JOIN}
        ${SOURCE_JOIN}
        LEFT JOIN data.ref_service_line sl
            ON sl.code = sc.service_line_code
        LEFT JOIN data.ref_global_service_group gsg
            ON gsg.code = sc.global_service_group_code
        LEFT JOIN data.ref_service_type st
            ON st.code = sc.service_type_code
        LEFT JOIN data.ref_service_status ss
            ON ss.code = ${SERVICE_STATUS_SQL}
        WHERE sc.is_deleted = FALSE
          AND sc.is_stub = FALSE
        ORDER BY sp.portfolio_code, sc.service_type_code, sc.title
    `);
    return result.rows;
}

async function getCatalogQualitySummary() {
    const result = await getPool().query(`
        WITH active_services AS (
            SELECT
                sc.id,
                sc.service_id,
                sc.title,
                sc.lifecycle_stage_code,
                sc.requestable,
                sc.request_channel_type,
                sc.request_channel_url,
                sc.review_due_at
            FROM data.service_catalog sc
            WHERE sc.is_deleted = FALSE
              AND sc.is_stub = FALSE
        ),
        service_facts AS (
            SELECT
                svc.*,
                EXISTS (
                    SELECT 1
                    FROM data.service_role_assignment sra
                    WHERE sra.service_id = svc.id
                      AND sra.role_code = 'service_owner'
                      AND sra.valid_to IS NULL
                ) AS has_owner,
                EXISTS (
                    SELECT 1
                    FROM data.service_relation sr
                    WHERE sr.is_deleted = FALSE
                      AND (sr.from_service_id = svc.id OR sr.to_service_id = svc.id)
                ) AS has_relation,
                EXISTS (
                    SELECT 1
                    FROM data.service_c3_mapping scm
                    WHERE scm.service_id = svc.id
                      AND scm.is_primary = TRUE
                ) AS has_primary_capability,
                EXISTS (
                    SELECT 1
                    FROM data.service_offering so
                    WHERE so.service_id = svc.id
                      AND so.status <> 'deleted'
                      AND COALESCE(so.requestable, svc.requestable, FALSE) = TRUE
                      AND (
                          NULLIF(BTRIM(COALESCE(so.request_channel_type, svc.request_channel_type, '')), '') IS NOT NULL
                          OR NULLIF(BTRIM(COALESCE(so.request_channel_url, svc.request_channel_url, '')), '') IS NOT NULL
                      )
                ) AS has_offering_request_channel
            FROM active_services svc
        ),
        duplicate_titles AS (
            SELECT LOWER(BTRIM(title)) AS title_key, MIN(title) AS title, COUNT(*)::integer AS service_count
            FROM active_services
            WHERE NULLIF(BTRIM(title), '') IS NOT NULL
            GROUP BY LOWER(BTRIM(title))
            HAVING COUNT(*) > 1
        ),
        duplicate_examples AS (
            SELECT title, service_count
            FROM duplicate_titles
            ORDER BY service_count DESC, title
            LIMIT 10
        )
        SELECT
            COUNT(*)::integer AS total_services,
            COUNT(*) FILTER (WHERE NOT has_owner)::integer AS missing_owner_count,
            COUNT(*) FILTER (WHERE NOT has_relation)::integer AS missing_relation_count,
            COUNT(*) FILTER (WHERE NOT has_primary_capability)::integer AS missing_capability_count,
            COUNT(*) FILTER (
                WHERE COALESCE(requestable, FALSE) = TRUE
                  AND NULLIF(BTRIM(COALESCE(request_channel_type, '')), '') IS NULL
                  AND NULLIF(BTRIM(COALESCE(request_channel_url, '')), '') IS NULL
                  AND NOT has_offering_request_channel
            )::integer AS missing_request_channel_count,
            COUNT(*) FILTER (WHERE review_due_at IS NULL)::integer AS missing_review_date_count,
            COUNT(*) FILTER (WHERE review_due_at < CURRENT_TIMESTAMP)::integer AS overdue_review_count,
            COUNT(*) FILTER (
                WHERE lifecycle_stage_code IN ('retiring', 'retired')
            )::integer AS deprecated_or_retired_count,
            (
                SELECT COUNT(*)::integer
                FROM duplicate_titles
            ) AS duplicate_title_group_count,
            (
                SELECT COALESCE(json_agg(json_build_object('title', title, 'count', service_count)), '[]'::json)
                FROM duplicate_examples
            ) AS duplicate_title_examples,
            (
                SELECT COUNT(*)::integer
                FROM data.service_relation sr
                WHERE sr.is_deleted = FALSE
                  AND COALESCE(sr.is_verified, FALSE) = FALSE
            ) AS unverified_relation_count
        FROM service_facts
    `);

    return result.rows[0] ?? {
        total_services: 0,
        missing_owner_count: 0,
        missing_relation_count: 0,
        missing_capability_count: 0,
        missing_request_channel_count: 0,
        missing_review_date_count: 0,
        overdue_review_count: 0,
        deprecated_or_retired_count: 0,
        duplicate_title_group_count: 0,
        duplicate_title_examples: [],
        unverified_relation_count: 0,
    };
}

async function setDomains(serviceId, domainCodes) {
    if (!Array.isArray(domainCodes)) return;

    const catalogId = await getCatalogId(serviceId);
    if (!catalogId) return;

    if (domainCodes.length === 0) {
        await getPool().query('DELETE FROM data.service_available_on WHERE service_id = $1', [catalogId]);
        return;
    }

    await getPool().query(`
        DELETE FROM data.service_available_on
        WHERE service_id = $1
          AND domain_code <> ALL($2::varchar[])
    `, [catalogId, domainCodes]);

    await getPool().query(`
        INSERT INTO data.service_available_on (service_id, domain_code, source_field)
        SELECT $1, domain_code, 'api'
        FROM unnest($2::varchar[]) AS domain_code
        ON CONFLICT (service_id, domain_code) DO NOTHING
    `, [catalogId, domainCodes]);
}

async function setRole(serviceId, roleCode, displayName, email = null, orgName = null) {
    const catalogId = await getCatalogId(serviceId);
    if (!catalogId) return;

    if (!displayName) {
        await getPool().query(`
            UPDATE data.service_role_assignment
            SET valid_to = CURRENT_TIMESTAMP
            WHERE service_id = $1
              AND role_code = $2
              AND valid_to IS NULL
        `, [catalogId, roleCode]);
        return;
    }

    await getPool().query(`
        UPDATE data.service_role_assignment
        SET valid_to = CURRENT_TIMESTAMP
        WHERE service_id = $1::bigint
          AND role_code = $2::varchar
          AND valid_to IS NULL
          AND (
            display_name <> $3::varchar
            OR (email IS NULL AND $4::varchar IS NOT NULL)
            OR (email IS NOT NULL AND $4::varchar IS NULL)
            OR email <> $4::varchar
            OR (organization_name IS NULL AND $5::varchar IS NOT NULL)
            OR (organization_name IS NOT NULL AND $5::varchar IS NULL)
            OR organization_name <> $5::varchar
          )
    `, [catalogId, roleCode, displayName, email ?? null, orgName ?? null]);

    await getPool().query(`
        INSERT INTO data.service_role_assignment
            (service_id, role_code, display_name, email, organization_name, valid_from)
        SELECT $1::bigint, $2::varchar, $3::varchar, $4::varchar, $5::varchar, CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
            SELECT 1
            FROM data.service_role_assignment
            WHERE service_id = $1::bigint
              AND role_code = $2::varchar
              AND display_name = $3::varchar
              AND (
                (email IS NULL AND $4::varchar IS NULL)
                OR email = $4::varchar
              )
              AND (
                (organization_name IS NULL AND $5::varchar IS NULL)
                OR organization_name = $5::varchar
              )
              AND valid_to IS NULL
        )
    `, [catalogId, roleCode, displayName, email ?? null, orgName ?? null]);
}

async function create(input, performedBy) {
    const { fields: data, portfolioCode, sla, source, fallbacks } = canonicalizeServiceInput(input);
    // A new service without any lifecycle/status input starts as active (previous default).
    const createStage = Object.prototype.hasOwnProperty.call(data, 'lifecycle_stage_code')
        ? data.lifecycle_stage_code
        : 'active';
    const createIsStub = data.is_stub != null ? !!data.is_stub : false;
    const pool = getPool();
    const portfolioId = data.portfolio_id ?? await resolvePortfolioId(pool, portfolioCode);

    const columns = {
        service_id: data.service_id,
        title: data.title,
        portfolio_id: portfolioId,
        service_type_code: data.service_type || data.service_type_code,
        lifecycle_stage_code: createStage,
        catalogue_version: data.catalogue_version || null,
        global_service_group_code: data.global_service_group_code || null,
        service_line_code: data.service_line_code || null,
        organizational_element_code: data.organizational_element_code || null,
        short_description: data.short_description || data.summary || fallbacks.short_description || null,
        description: data.description || data.detailed_description || null,
        service_features: data.service_features || null,
        scope_text: data.scope_text || null,
        operational_notes_raw: data.operational_notes_raw || null,
        target_audience_summary: data.target_audience_summary || null,
        requestable: data.requestable == null ? null : !!data.requestable,
        criticality_code: data.criticality_code || null,
        request_channel_type: data.request_channel_type || null,
        request_channel_url: data.request_channel_url || null,
        approval_required: data.approval_required == null ? null : !!data.approval_required,
        fulfillment_lead_time_text: data.fulfillment_lead_time_text || null,
        budget_activity_code: data.budget_activity_code || null,
        review_owner_user_id: data.review_owner_user_id == null ? null : parseInteger(data.review_owner_user_id),
        review_due_at: sanitizeDate(data.review_due_at),
        unit_of_measure: data.unit_of_measure || null,
        charging_basis: data.charging_basis || null,
        rate_note: data.rate_note || null,
        ordering_note: data.ordering_note || null,
        exclusions: data.exclusions || null,
        security_classification_code: data.security_classification || data.security_classification_code || null,
        is_stub: createIsStub,
        service_url: data.service_url || data.source_url || null,
        graph_x: data.graph_x ?? null,
        graph_y: data.graph_y ?? null,
        notes_json: serializeJson(data.notes),
        retired_note: data.retired_note || null,
        consumer_value: data.consumer_value || fallbacks.consumer_value || null,
        created_by: performedBy,
        updated_by: performedBy,
    };
    const names = Object.keys(columns);
    const inserted = await pool.query(`
        INSERT INTO data.service_catalog (${names.join(', ')})
        VALUES (${names.map((_, index) => `$${index + 1}`).join(', ')})
        RETURNING id
    `, Object.values(columns));

    const catalogId = inserted.rows[0].id;
    await upsertPrimarySla(pool, catalogId, sla);
    await upsertServiceSource(pool, catalogId, normalizeSource(source));
    return data.service_id;
}

/** Normalizes import provenance input (see service-fields SOURCE_* lists). */
function normalizeSource(source) {
    if (!source) return null;
    const normalized = {};
    for (const [key, value] of Object.entries(source)) {
        if (key === 'source_sp_id') normalized[key] = value == null || value === '' ? null : parseInteger(value);
        else if (key === 'created_at_source' || key === 'modified_at_source') normalized[key] = sanitizeDate(value);
        else if (key === 'is_available_status_ambiguous') normalized[key] = value == null ? false : !!value;
        else if (key.endsWith('_json')) normalized[key] = serializeJson(value) || null;
        else normalized[key] = value === '' ? null : value ?? null;
    }
    return normalized;
}

async function update(serviceId, input, performedBy) {
    const { fields: data, portfolioCode, sla, source, fallbacks } = canonicalizeServiceInput(input);
    const skipFields = new Set([
        'id', 'service_id', 'created_at', 'created_by', 'is_deleted',
        'completeness_score', 'prerequisites', 'dependencies',
        'c3_uuid', 'c3_parent_id', 'c3_parent_uuid', 'c3_level', 'c3_domain',
        'c3_source', 'c3_reference', 'c3_synced_at', 'c3_sync_status', 'c3_is_primary',
        'flavour_count', 'relation_count',
    ]);

    const colMap = {
        service_type: 'service_type_code',
        security_classification: 'security_classification_code',
        notes: 'notes_json',
        source_url: 'service_url',
        summary: 'short_description',
        detailed_description: 'description',
    };

    const allowedFields = new Set([
        'title', 'service_type',
        'catalogue_version', 'service_features', 'summary',
        'short_description', 'detailed_description', 'description', 'unit_of_measure',
        'charging_basis', 'rate_note', 'ordering_note', 'exclusions',
        'security_classification', 'source_url',
        'service_url', 'graph_x',
        'graph_y', 'notes', 'retired_note', 'scope_text',
        'operational_notes_raw', 'budget_activity_code',
        'global_service_group_code', 'service_line_code', 'organizational_element_code',
        'target_audience_summary', 'requestable', 'lifecycle_stage_code',
        'criticality_code', 'review_due_at', 'portfolio_id', 'request_channel_type',
        'request_channel_url', 'approval_required', 'fulfillment_lead_time_text',
        'review_owner_user_id', 'consumer_value',
    ]);

    const jsonFields = new Set(['notes']);
    const integerFields = new Set(['review_owner_user_id', 'portfolio_id']);
    const decimalFields = new Set();
    const dateFields = new Set(['review_due_at']);
    const booleanFields = new Set(['requestable', 'approval_required']);

    const values = [performedBy];
    const setClauses = ['updated_at = CURRENT_TIMESTAMP', 'updated_by = $1'];

    for (const [key, rawValue] of Object.entries(data)) {
        if (skipFields.has(key) || !allowedFields.has(key)) continue;

        let value = rawValue;
        if (jsonFields.has(key)) {
            value = serializeJson(rawValue);
        } else if (decimalFields.has(key)) {
            value = parseDecimal(rawValue);
        } else if (integerFields.has(key)) {
            value = parseInteger(rawValue);
        } else if (dateFields.has(key)) {
            value = sanitizeDate(rawValue);
        } else if (booleanFields.has(key)) {
            value = rawValue == null ? null : !!rawValue;
        }

        if (value === '') value = null;
        values.push(value ?? null);
        setClauses.push(`${colMap[key] || key} = $${values.length}`);
    }

    if (portfolioCode !== undefined && !Object.prototype.hasOwnProperty.call(data, 'portfolio_id')) {
        values.push(portfolioCode);
        setClauses.push(`portfolio_id = (SELECT sp.id FROM data.service_portfolio sp WHERE sp.portfolio_code = $${values.length})`);
    }

    for (const [column, value] of Object.entries(fallbacks)) {
        const inputKeys = column === 'short_description' ? ['short_description', 'summary'] : [column];
        if (inputKeys.some((key) => Object.prototype.hasOwnProperty.call(data, key))) continue;
        values.push(value);
        setClauses.push(`${column} = COALESCE(NULLIF(btrim(${column}), ''), $${values.length})`);
    }

    if (setClauses.length === 2 && !sla && !source) return null;

    const pool = getPool();
    values.push(serviceId);
    const updated = await pool.query(`
        UPDATE data.service_catalog
        SET ${setClauses.join(', ')}
        WHERE service_id = $${values.length}
          AND is_deleted = FALSE
        RETURNING id
    `, values);

    if (updated.rows[0]) {
        await upsertPrimarySla(pool, updated.rows[0].id, sla);
        await upsertServiceSource(pool, updated.rows[0].id, normalizeSource(source));
    }
    return findByServiceId(serviceId);
}

async function softDelete(serviceId, performedBy) {
    await getPool().query(`
        UPDATE data.service_catalog
        SET is_deleted = TRUE,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = $2
        WHERE service_id = $1
    `, [serviceId, performedBy]);
}

async function updateScore() {
    return null;
}

async function serviceIdExists(serviceId, excludeServiceId = null) {
    const result = await getPool().query(`
        SELECT 1 AS found
        FROM data.service_catalog
        WHERE service_id = $1
          AND ($2::varchar IS NULL OR service_id <> $2)
          AND is_deleted = FALSE
        LIMIT 1
    `, [serviceId, excludeServiceId || null]);
    return result.rows.length > 0;
}

module.exports = {
    findAllDirect,
    findByServiceId,
    findById,
    findAllForExport,
    getCatalogQualitySummary,
    create,
    update,
    softDelete,
    updateScore,
    serviceIdExists,
    setDomains,
    setRole,
    getCatalogId,
};
