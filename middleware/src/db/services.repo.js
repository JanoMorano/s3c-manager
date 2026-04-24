'use strict';

const { getPool } = require('./pool');

const SC_COLUMNS = `
    sc.id,
    sc.service_id,
    sc.title,
    sc.portfolio_group_code AS portfolio_group,
    COALESCE(pg.name, sc.portfolio_group_code) AS portfolio_group_name,
    sc.service_type_code AS service_type,
    COALESCE(st.name, sc.service_type_code) AS service_type_name,
    sc.service_status_code AS service_status,
    COALESCE(ss.name, sc.service_status_code) AS service_status_name,
    sc.catalogue_version,
    sc.short_description AS summary,
    sc.description AS detailed_description,
    sc.global_service_group_code,
    COALESCE(gsg.name, sc.global_service_group_code) AS global_service_group_name,
    sc.service_line_code,
    COALESCE(sl.name, sc.service_line_code) AS service_line_name,
    sc.value_proposition,
    sc.service_features,
    sc.business_purpose,
    sc.unit_of_measure,
    sc.charging_basis,
    sc.rate_note,
    sc.ordering_note,
    sc.exclusions,
    sc.service_area_raw AS service_area,
    sc.security_classification_code AS security_classification,
    (
        SELECT string_agg(sao.domain_code, ',')
        FROM data.service_available_on sao
        WHERE sao.service_id = sc.id
    ) AS available_on,
    sc.customer_type_json AS customer_type,
    sc.service_url AS source_url,
    sc.sla_availability,
    sc.sla_restoration_hours AS sla_restoration,
    sc.sla_delivery_days AS sla_delivery,
    sc.sla_restoration_text,
    sc.sla_delivery_text,
    sc.scope_text,
    sc.operational_notes_raw,
    sc.support_locations_raw,
    sc.request_process_raw,
    sc.support_availability_raw,
    sc.service_cost_raw,
    sc.additional_information_raw,
    sc.service_features_raw,
    sc.ext_tools_raw,
    sc.legacy_ssl_mapping_raw,
    sc.budget_activity_code,
    sc.other_info_raw,
    sc.pricing_note_raw,
    sc.graph_x,
    sc.graph_y,
    sc.options_json AS options,
    sc.notes_json AS notes,
    sc.training_refs_json AS training_refs,
    sc.retired_note,
    sc.source_local_id,
    sc.source_sp_id,
    sc.source_etag,
    sc.prerequisites_json,
    sc.dependencies_json,
    sc.organizational_element_code,
    sc.is_deleted,
    sc.is_stub,
    sc.cp_service_type_raw,
    sc.is_available_status_ambiguous,
    sc.created_at,
    sc.created_by,
    sc.updated_at,
    sc.updated_by,
    sc.created_at_source,
    sc.modified_at_source,
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

function rawTextIfNonNumeric(value) {
    if (value == null) return null;
    if (typeof value === 'number') return null;
    const normalized = String(value).trim();
    if (!normalized) return null;
    return Number.isNaN(parseInt(normalized, 10)) ? normalized : null;
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
    domain,
    search,
    ownerName,
    sort = 'title',
    order = 'ASC',
} = {}) {
    const offset = (page - 1) * limit;
    const statusValues = splitCsv(status);
    const serviceTypeValues = splitCsv(serviceType);
    const domainValues = splitCsv(domain);
    const sortColMap = {
        service_id: 'service_id',
        title: 'title',
        service_status: 'service_status_code',
        service_type: 'service_type_code',
        portfolio_group: 'portfolio_group_code',
        updated_at: 'updated_at',
    };
    const sortCol = sortColMap[sort] || 'title';
    const sortDir = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const filters = ['sc.is_deleted = FALSE', 'sc.is_stub = FALSE'];
    const values = [];

    function bind(value) {
        values.push(value);
        return `$${values.length}`;
    }

    if (statusValues.length) {
        filters.push(`sc.service_status_code = ANY(${bind(statusValues)}::varchar[])`);
    }
    if (serviceTypeValues.length) {
        filters.push(`sc.service_type_code = ANY(${bind(serviceTypeValues)}::varchar[])`);
    }
    if (portfolioGroup) {
        filters.push(`sc.portfolio_group_code = ${bind(portfolioGroup)}`);
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
            sc.title ILIKE ${searchPlaceholder}
            OR sc.service_id ILIKE ${searchPlaceholder}
            OR sc.short_description ILIKE ${searchPlaceholder}
            OR sc.description ILIKE ${searchPlaceholder}
        )`);
    }
    if (ownerName) {
        filters.push(`EXISTS (
            SELECT 1
            FROM data.service_role_assignment sra
            WHERE sra.service_id = sc.id
              AND sra.role_code = 'service_owner'
              AND sra.display_name = ${bind(ownerName)}
              AND sra.valid_to IS NULL
        )`);
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
            sc.short_description,
            sc.service_type_code AS service_type,
            sc.service_status_code AS service_status,
            sc.unit_of_measure,
            sc.charging_basis,
            (
                SELECT string_agg(sao.domain_code, ',')
                FROM data.service_available_on sao
                WHERE sao.service_id = sc.id
            ) AS available_on,
            sc.sla_availability,
            sc.sla_delivery_days AS sla_delivery,
            sc.sla_restoration_hours AS sla_restoration,
            sc.portfolio_group_code AS portfolio_group,
            COALESCE(pg.name, sc.portfolio_group_code) AS portfolio_group_name,
            COALESCE(sl.name, sc.service_line_code) AS service_line_name,
            COALESCE(gsg.name, sc.global_service_group_code) AS global_service_group_name,
            sc.graph_x,
            sc.graph_y,
            sc.updated_at,
            scm.c3_uuid,
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
        LEFT JOIN data.service_c3_mapping scm
            ON scm.service_id = sc.id AND scm.is_primary = TRUE
        LEFT JOIN data.ref_portfolio_group pg
            ON pg.code = sc.portfolio_group_code
        LEFT JOIN data.ref_service_line sl
            ON sl.code = sc.service_line_code
        LEFT JOIN data.ref_global_service_group gsg
            ON gsg.code = sc.global_service_group_code
        WHERE ${whereClause}
        ORDER BY sc.${sortCol} ${sortDir}
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
        LEFT JOIN data.ref_portfolio_group pg
            ON pg.code = sc.portfolio_group_code
        LEFT JOIN data.ref_service_line sl
            ON sl.code = sc.service_line_code
        LEFT JOIN data.ref_global_service_group gsg
            ON gsg.code = sc.global_service_group_code
        LEFT JOIN data.ref_service_type st
            ON st.code = sc.service_type_code
        LEFT JOIN data.ref_service_status ss
            ON ss.code = sc.service_status_code
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
        LEFT JOIN data.ref_portfolio_group pg
            ON pg.code = sc.portfolio_group_code
        LEFT JOIN data.ref_service_line sl
            ON sl.code = sc.service_line_code
        LEFT JOIN data.ref_global_service_group gsg
            ON gsg.code = sc.global_service_group_code
        LEFT JOIN data.ref_service_type st
            ON st.code = sc.service_type_code
        LEFT JOIN data.ref_service_status ss
            ON ss.code = sc.service_status_code
        WHERE sc.is_deleted = FALSE
          AND sc.is_stub = FALSE
        ORDER BY sc.portfolio_group_code, sc.service_type_code, sc.title
    `);
    return result.rows;
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

async function create(data, performedBy) {
    const createServiceStatus = Object.prototype.hasOwnProperty.call(data, 'service_status')
        ? (data.service_status === '' ? null : data.service_status)
        : (data.service_status_code ?? 'active');
    const createIsStub = data.is_stub != null ? !!data.is_stub : false;

    await getPool().query(`
        INSERT INTO data.service_catalog (
            service_id, title, portfolio_group_code,
            service_type_code, service_status_code, catalogue_version,
            global_service_group_code, service_line_code, organizational_element_code,
            short_description, description,
            value_proposition, service_features,
            business_purpose, scope_text,
            operational_notes_raw, support_locations_raw, request_process_raw,
            support_availability_raw, service_cost_raw, additional_information_raw,
            service_features_raw, ext_tools_raw, legacy_ssl_mapping_raw,
            budget_activity_code, other_info_raw, pricing_note_raw,
            unit_of_measure, charging_basis, rate_note, ordering_note,
            exclusions, service_area_raw, security_classification_code,
            cp_service_type_raw, is_available_status_ambiguous, is_stub,
            customer_type_json, service_url,
            sla_availability, sla_restoration_hours, sla_delivery_days,
            sla_restoration_text, sla_delivery_text,
            graph_x, graph_y,
            options_json, notes_json, training_refs_json, retired_note,
            source_local_id, source_sp_id, source_etag,
            prerequisites_json, dependencies_json,
            created_at_source, modified_at_source,
            created_by, updated_by
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
            $41, $42, $43, $44, $45, $46, $47, $48, $49, $50,
            $51, $52, $53, $54, $55, $56, $57, $58, $59
        )
    `, [
        data.service_id,
        data.title,
        data.portfolio_group_code || data.portfolio_group || null,
        data.service_type || data.service_type_code,
        createServiceStatus,
        data.catalogue_version || null,
        data.global_service_group_code || null,
        data.service_line_code || null,
        data.organizational_element_code || null,
        data.short_description || data.summary || null,
        data.description || data.detailed_description || null,
        data.value_proposition || null,
        data.service_features || null,
        data.business_purpose || null,
        data.scope_text || null,
        data.operational_notes_raw || null,
        data.support_locations_raw || null,
        data.request_process_raw || null,
        data.support_availability_raw || null,
        data.service_cost_raw || null,
        data.additional_information_raw || null,
        data.service_features_raw || null,
        data.ext_tools_raw || null,
        data.legacy_ssl_mapping_raw || null,
        data.budget_activity_code || null,
        data.other_info_raw || null,
        data.pricing_note_raw || null,
        data.unit_of_measure || null,
        data.charging_basis || null,
        data.rate_note || null,
        data.ordering_note || null,
        data.exclusions || null,
        data.service_area_raw || data.service_area || null,
        data.security_classification || data.security_classification_code || null,
        data.cp_service_type_raw || null,
        data.is_available_status_ambiguous ?? false,
        createIsStub,
        serializeJson(data.customer_type),
        data.service_url || data.source_url || null,
        parseDecimal(data.sla_availability),
        parseInteger(data.sla_restoration ?? data.sla_restoration_hours),
        parseInteger(data.sla_delivery ?? data.sla_delivery_days),
        rawTextIfNonNumeric(data.sla_restoration ?? data.sla_restoration_hours),
        rawTextIfNonNumeric(data.sla_delivery ?? data.sla_delivery_days),
        data.graph_x ?? null,
        data.graph_y ?? null,
        serializeJson(data.options),
        serializeJson(data.notes),
        serializeJson(data.training_refs),
        data.retired_note || null,
        data.source_local_id || data.localId || null,
        data.source_sp_id ?? data.spId ?? null,
        data.source_etag || data.etag || null,
        serializeJson(data.prerequisites_json) || null,
        serializeJson(data.dependencies_json) || null,
        sanitizeDate(data.created_at_source),
        sanitizeDate(data.modified_at_source),
        performedBy,
        performedBy,
    ]);

    return data.service_id;
}

async function update(serviceId, data, performedBy) {
    const skipFields = new Set([
        'id', 'service_id', 'created_at', 'created_by', 'is_deleted',
        'completeness_score', 'prerequisites', 'dependencies',
        'c3_uuid', 'c3_parent_id', 'c3_parent_uuid', 'c3_level', 'c3_domain',
        'c3_source', 'c3_reference', 'c3_synced_at', 'c3_sync_status', 'c3_is_primary',
        'flavour_count', 'relation_count',
    ]);

    const colMap = {
        service_type: 'service_type_code',
        service_status: 'service_status_code',
        security_classification: 'security_classification_code',
        customer_type: 'customer_type_json',
        options: 'options_json',
        notes: 'notes_json',
        training_refs: 'training_refs_json',
        sla_restoration: 'sla_restoration_hours',
        sla_delivery: 'sla_delivery_days',
        portfolio_group: 'portfolio_group_code',
        source_url: 'service_url',
        summary: 'short_description',
        detailed_description: 'description',
        service_area: 'service_area_raw',
    };

    const allowedFields = new Set([
        'title', 'portfolio_group', 'portfolio_group_code', 'service_type', 'service_status',
        'catalogue_version', 'value_proposition', 'service_features', 'summary',
        'short_description', 'detailed_description', 'description', 'unit_of_measure',
        'charging_basis', 'rate_note', 'ordering_note', 'exclusions', 'service_area',
        'service_area_raw', 'security_classification', 'customer_type', 'source_url',
        'service_url', 'sla_availability', 'sla_restoration', 'sla_delivery', 'graph_x',
        'graph_y', 'options', 'notes', 'training_refs', 'retired_note', 'cp_service_type_raw',
        'is_available_status_ambiguous', 'source_local_id', 'source_sp_id', 'source_etag',
        'prerequisites_json', 'dependencies_json', 'business_purpose', 'scope_text',
        'operational_notes_raw', 'support_locations_raw', 'request_process_raw',
        'support_availability_raw', 'service_cost_raw', 'additional_information_raw',
        'service_features_raw', 'ext_tools_raw', 'legacy_ssl_mapping_raw',
        'budget_activity_code', 'other_info_raw', 'pricing_note_raw',
        'global_service_group_code', 'service_line_code', 'organizational_element_code',
        'sla_restoration_text', 'sla_delivery_text', 'created_at_source', 'modified_at_source',
    ]);

    const jsonFields = new Set(['customer_type', 'options', 'notes', 'training_refs', 'prerequisites_json', 'dependencies_json']);
    const integerFields = new Set(['sla_restoration', 'sla_delivery', 'source_sp_id']);
    const decimalFields = new Set(['sla_availability']);
    const dateFields = new Set(['created_at_source', 'modified_at_source']);
    const booleanFields = new Set(['is_available_status_ambiguous']);

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

    if (('sla_restoration' in data || 'sla_restoration_hours' in data) && !('sla_restoration_text' in data)) {
        values.push(rawTextIfNonNumeric(data.sla_restoration ?? data.sla_restoration_hours));
        setClauses.push(`sla_restoration_text = $${values.length}`);
    }
    if (('sla_delivery' in data || 'sla_delivery_days' in data) && !('sla_delivery_text' in data)) {
        values.push(rawTextIfNonNumeric(data.sla_delivery ?? data.sla_delivery_days));
        setClauses.push(`sla_delivery_text = $${values.length}`);
    }

    if (setClauses.length === 2) return null;

    values.push(serviceId);
    await getPool().query(`
        UPDATE data.service_catalog
        SET ${setClauses.join(', ')}
        WHERE service_id = $${values.length}
          AND is_deleted = FALSE
    `, values);

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
    create,
    update,
    softDelete,
    updateScore,
    serviceIdExists,
    setDomains,
    setRole,
};
