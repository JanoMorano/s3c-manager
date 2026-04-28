'use strict';

const { getPool } = require('./pool');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function normalizeLimit(value) {
    const parsed = Number.parseInt(String(value ?? DEFAULT_LIMIT), 10);
    if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
    return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function normalizeOffset(value) {
    const parsed = Number.parseInt(String(value ?? 0), 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, parsed);
}

function normalizeArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return [value].filter(Boolean);
}

function like(value) {
    return `%${String(value).trim()}%`;
}

function addLimitOffset(params, filters) {
    params.push(normalizeLimit(filters.limit));
    const limitPlaceholder = `$${params.length}`;
    params.push(normalizeOffset(filters.offset));
    const offsetPlaceholder = `$${params.length}`;
    return `LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;
}

async function listServiceRisks(filters = {}) {
    const where = [];
    const params = [];
    const severity = normalizeArray(filters.severity);

    if (severity.length) {
        params.push(severity);
        where.push(`severity = ANY($${params.length}::text[])`);
    }
    if (filters.ruleCode) {
        params.push(filters.ruleCode);
        where.push(`rule_code = $${params.length}`);
    }
    if (filters.serviceId) {
        params.push(filters.serviceId);
        where.push(`service_id = $${params.length}`);
    }
    if (filters.q) {
        params.push(like(filters.q));
        where.push(`(title ILIKE $${params.length} OR reason ILIKE $${params.length} OR service_id ILIKE $${params.length})`);
    }

    const limitOffset = addLimitOffset(params, filters);
    const result = await getPool().query(`
        SELECT *
        FROM data.v_service_risk_radar
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY
            CASE severity WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
            score DESC,
            title ASC
        ${limitOffset}
    `, params);
    return result.rows;
}

async function listOwnerLoad(filters = {}) {
    const where = [];
    const params = [];

    if (filters.owner) {
        params.push(filters.owner);
        params.push(like(filters.owner));
        where.push(`(LOWER(owner_key) = LOWER($${params.length - 1}) OR LOWER(COALESCE(owner_email, '')) = LOWER($${params.length - 1}) OR owner_name ILIKE $${params.length})`);
    }
    if (filters.minScore != null) {
        params.push(Number(filters.minScore));
        where.push(`owner_load_score >= $${params.length}`);
    }

    const limitOffset = addLimitOffset(params, filters);
    const result = await getPool().query(`
        SELECT *
        FROM data.v_owner_load
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY owner_load_score DESC, owned_services DESC, owner_name ASC
        ${limitOffset}
    `, params);
    return result.rows;
}

async function listOwnerAssignments(filters = {}) {
    const where = [
        'sc.is_deleted = FALSE',
        'sc.is_stub = FALSE',
        'sra.valid_to IS NULL',
    ];
    const params = [];

    if (filters.owner) {
        params.push(filters.owner);
        params.push(like(filters.owner));
        where.push(`(
            LOWER(COALESCE(NULLIF(sra.email, ''), NULLIF(sra.display_name, ''), 'unassigned')) = LOWER($${params.length - 1})
            OR LOWER(COALESCE(sra.email, '')) = LOWER($${params.length - 1})
            OR sra.display_name ILIKE $${params.length}
        )`);
    }

    const limitOffset = addLimitOffset(params, filters);
    const result = await getPool().query(`
        SELECT
            sra.id AS assignment_id,
            COALESCE(NULLIF(sra.email, ''), NULLIF(sra.display_name, ''), 'unassigned') AS owner_key,
            sra.display_name,
            sra.email,
            sra.organization_name,
            sra.role_code,
            role_ref.name AS role_name,
            sc.id AS service_pk,
            sc.service_id,
            sc.title AS service_title,
            sc.service_status_code,
            sc.lifecycle_state,
            sra.valid_from,
            sra.valid_to
        FROM data.service_role_assignment sra
        JOIN data.service_catalog sc
          ON sc.id = sra.service_id
        LEFT JOIN data.ref_service_role role_ref
          ON role_ref.code = sra.role_code
        WHERE ${where.join(' AND ')}
        ORDER BY
            COALESCE(role_ref.sort_order, 999),
            sra.role_code ASC,
            sc.title ASC
        ${limitOffset}
    `, params);
    return result.rows;
}

async function listContractOverlap(filters = {}) {
    const where = [];
    const params = [];

    if (filters.scope) {
        params.push(filters.scope);
        where.push(`overlap_scope = $${params.length}`);
    }
    if (filters.key) {
        params.push(filters.key);
        where.push(`overlap_key = $${params.length}`);
    }

    const limitOffset = addLimitOffset(params, filters);
    const result = await getPool().query(`
        SELECT *
        FROM data.v_contract_overlap
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY
            CASE severity WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
            contract_count DESC,
            annual_cost_total DESC,
            overlap_title ASC
        ${limitOffset}
    `, params);
    return result.rows;
}

async function listRenewalRisks(filters = {}) {
    const where = [];
    const params = [];

    if (filters.horizonDays != null) {
        params.push(Number(filters.horizonDays));
        where.push(`days_to_renewal <= $${params.length}`);
    }
    if (filters.vendor) {
        params.push(like(filters.vendor));
        where.push(`(vendor_code ILIKE $${params.length} OR vendor_name ILIKE $${params.length})`);
    }

    const limitOffset = addLimitOffset(params, filters);
    const result = await getPool().query(`
        SELECT *
        FROM data.v_contract_renewal_risk
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY days_to_renewal ASC, annual_cost DESC NULLS LAST, title ASC
        ${limitOffset}
    `, params);
    return result.rows;
}

async function listAdvisorFindings(filters = {}) {
    const where = [];
    const params = [];
    const severity = normalizeArray(filters.severity);
    const findingType = normalizeArray(filters.findingType);

    if (severity.length) {
        params.push(severity);
        where.push(`severity = ANY($${params.length}::text[])`);
    }
    if (findingType.length) {
        params.push(findingType);
        where.push(`finding_type = ANY($${params.length}::text[])`);
    }
    if (filters.q) {
        params.push(like(filters.q));
        where.push(`(title ILIKE $${params.length} OR reason ILIKE $${params.length} OR suggested_action ILIKE $${params.length})`);
    }

    const limitOffset = addLimitOffset(params, filters);
    const result = await getPool().query(`
        SELECT advisor.*
        FROM data.v_gap_duplication_advisor advisor
        LEFT JOIN data.governance_finding gf
          ON gf.finding_key = advisor.finding_key
         AND gf.status = 'dismissed'
        WHERE gf.finding_id IS NULL
        ${where.length ? `AND ${where.join(' AND ')}` : ''}
        ORDER BY
            CASE advisor.severity WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
            advisor.score DESC,
            advisor.title ASC
        ${limitOffset}
    `, params);
    return result.rows;
}

async function findFindingByIdOrKey(findingId) {
    const result = await getPool().query(`
        SELECT
            finding_id,
            finding_key,
            finding_type,
            severity,
            source_entity_type,
            source_entity_id,
            title::text,
            reason::text,
            suggested_action::text,
            target_url::text,
            score
        FROM data.governance_finding
        WHERE finding_id::text = $1 OR finding_key = $1
        UNION ALL
        SELECT
            NULL::bigint AS finding_id,
            finding_key,
            finding_type,
            severity,
            source_entity_type,
            source_entity_id,
            title::text,
            reason::text,
            suggested_action::text,
            target_url::text,
            score
        FROM data.v_gap_duplication_advisor
        WHERE finding_key = $1
        LIMIT 1
    `, [findingId]);

    const row = result.rows[0];
    if (!row) {
        const err = new Error('Governance finding not found');
        err.status = 404;
        throw err;
    }
    return row;
}

async function persistDismissedFinding(row) {
    if (row.finding_id) {
        const result = await getPool().query(`
            UPDATE data.governance_finding
            SET status = 'dismissed',
                updated_at = CURRENT_TIMESTAMP
            WHERE finding_id = $1
            RETURNING finding_id
        `, [row.finding_id]);
        return result.rows[0].finding_id;
    }

    const result = await getPool().query(`
        INSERT INTO data.governance_finding (
            finding_key,
            finding_type,
            severity,
            status,
            source_entity_type,
            source_entity_id,
            source_entity_key,
            title,
            reason,
            suggested_action,
            target_url,
            score,
            last_seen_at,
            updated_at
        )
        VALUES ($1, $2, $3, 'dismissed', $4, $5, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (finding_key) DO UPDATE SET
            finding_type = EXCLUDED.finding_type,
            severity = EXCLUDED.severity,
            status = 'dismissed',
            source_entity_type = EXCLUDED.source_entity_type,
            source_entity_id = EXCLUDED.source_entity_id,
            source_entity_key = EXCLUDED.source_entity_key,
            title = EXCLUDED.title,
            reason = EXCLUDED.reason,
            suggested_action = EXCLUDED.suggested_action,
            target_url = EXCLUDED.target_url,
            score = EXCLUDED.score,
            last_seen_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        RETURNING finding_id
    `, [
        row.finding_key,
        row.finding_type,
        row.severity,
        row.source_entity_type,
        row.source_entity_id,
        row.title,
        row.reason,
        row.suggested_action,
        row.target_url,
        row.score,
    ]);
    return result.rows[0].finding_id;
}

async function dismissFinding({ findingId, reason, actor }) {
    const row = await findFindingByIdOrKey(findingId);
    const persistedFindingId = await persistDismissedFinding(row);
    const result = await getPool().query(`
        INSERT INTO data.governance_finding_dismissal (
            finding_id,
            dismissed_by,
            dismissed_reason
        )
        VALUES ($1, $2, $3)
        RETURNING dismissal_id, finding_id
    `, [persistedFindingId, actor, reason]);

    return result.rows[0];
}

module.exports = {
    listServiceRisks,
    listOwnerLoad,
    listOwnerAssignments,
    listContractOverlap,
    listRenewalRisks,
    listAdvisorFindings,
    dismissFinding,
};
