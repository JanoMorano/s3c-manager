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

async function resolveServicePk(serviceId) {
    const result = await getPool().query(`
        SELECT id
        FROM data.service_catalog
        WHERE service_id = $1
          AND is_deleted = FALSE
    `, [serviceId]);
    const servicePk = result.rows[0]?.id;
    if (!servicePk) {
        const err = new Error(`Service not found: ${serviceId}`);
        err.status = 404;
        throw err;
    }
    return servicePk;
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

async function listReviews(filters = {}) {
    const where = ['sc.is_deleted = FALSE'];
    const params = [];
    const status = normalizeArray(filters.status);

    if (status.length) {
        params.push(status);
        where.push(`gr.status = ANY($${params.length}::text[])`);
    }
    if (filters.serviceId) {
        params.push(filters.serviceId);
        where.push(`sc.service_id = $${params.length}`);
    }
    if (filters.assignedTo) {
        params.push(like(filters.assignedTo));
        where.push(`gr.assigned_to ILIKE $${params.length}`);
    }
    if (filters.overdue) {
        where.push('gr.due_at IS NOT NULL');
        where.push('gr.completed_at IS NULL');
        where.push('gr.due_at < CURRENT_TIMESTAMP');
    }
    if (filters.mine) {
        const identities = Array.isArray(filters.mineIdentities)
            ? filters.mineIdentities.map((value) => String(value ?? '').trim()).filter(Boolean)
            : [];
        if (identities.length === 0) {
            where.push('FALSE');
        } else {
            params.push(identities.map((value) => value.toLowerCase()));
            const exactPlaceholder = `$${params.length}`;
            params.push(identities.map(like));
            const likePlaceholder = `$${params.length}`;
            where.push(`(
                LOWER(COALESCE(gr.assigned_to, '')) = ANY(${exactPlaceholder}::text[])
                OR LOWER(COALESCE(gr.requested_by, '')) = ANY(${exactPlaceholder}::text[])
                OR gr.assigned_to ILIKE ANY(${likePlaceholder}::text[])
                OR gr.requested_by ILIKE ANY(${likePlaceholder}::text[])
            )`);
        }
    }

    const limitOffset = addLimitOffset(params, filters);
    const result = await getPool().query(`
        SELECT
            gr.id,
            sc.service_id,
            sc.title AS service_title,
            gr.review_type,
            gr.status,
            gr.requested_by,
            gr.assigned_to,
            gr.due_at,
            gr.completed_at,
            gr.created_at,
            gr.updated_at,
            CASE WHEN gr.due_at IS NOT NULL AND gr.completed_at IS NULL AND gr.due_at < CURRENT_TIMESTAMP THEN TRUE ELSE FALSE END AS overdue
        FROM data.governance_review gr
        JOIN data.service_catalog sc
          ON sc.id = gr.service_id
        WHERE ${where.join(' AND ')}
        ORDER BY
            CASE gr.status
                WHEN 'pending' THEN 0
                WHEN 'in_review' THEN 1
                WHEN 'deferred' THEN 2
                WHEN 'approved' THEN 3
                WHEN 'rejected' THEN 4
                ELSE 5
            END,
            gr.due_at ASC NULLS LAST,
            gr.created_at DESC
        ${limitOffset}
    `, params);
    return result.rows;
}

async function createReview(data) {
    const servicePk = await resolveServicePk(data.service_id);
    const result = await getPool().query(`
        WITH inserted AS (
            INSERT INTO data.governance_review (
                service_id,
                review_type,
                status,
                requested_by,
                assigned_to,
                due_at
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        )
        SELECT
            gr.id,
            sc.service_id,
            sc.title AS service_title,
            gr.review_type,
            gr.status,
            gr.requested_by,
            gr.assigned_to,
            gr.due_at,
            gr.completed_at,
            gr.created_at,
            gr.updated_at
        FROM inserted gr
        JOIN data.service_catalog sc
          ON sc.id = gr.service_id
    `, [
        servicePk,
        data.review_type,
        data.status || 'pending',
        data.requested_by || null,
        data.assigned_to || null,
        data.due_at || null,
    ]);
    return result.rows[0];
}

async function updateReview(id, updates) {
    const assignments = [];
    const params = [];

    for (const [field, value] of Object.entries(updates)) {
        if (!['status', 'assigned_to', 'due_at', 'completed_at'].includes(field)) continue;
        params.push(value);
        assignments.push(`${field} = $${params.length}`);
    }

    if (!assignments.length) {
        const err = new Error('No supported review fields supplied');
        err.status = 400;
        throw err;
    }

    params.push(Number(id));
    const result = await getPool().query(`
        WITH updated AS (
            UPDATE data.governance_review
            SET ${assignments.join(', ')},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $${params.length}
            RETURNING *
        )
        SELECT
            gr.id,
            sc.service_id,
            sc.title AS service_title,
            gr.review_type,
            gr.status,
            gr.requested_by,
            gr.assigned_to,
            gr.due_at,
            gr.completed_at,
            gr.created_at,
            gr.updated_at
        FROM updated gr
        JOIN data.service_catalog sc
          ON sc.id = gr.service_id
    `, params);

    if (!result.rows[0]) {
        const err = new Error(`Governance review not found: ${id}`);
        err.status = 404;
        throw err;
    }
    return result.rows[0];
}

async function listDecisions(filters = {}) {
    const where = ['sc.is_deleted = FALSE'];
    const params = [];
    const decision = normalizeArray(filters.decision);

    if (filters.serviceId) {
        params.push(filters.serviceId);
        where.push(`sc.service_id = $${params.length}`);
    }
    if (filters.decisionType) {
        params.push(filters.decisionType);
        where.push(`gd.decision_type = $${params.length}`);
    }
    if (decision.length) {
        params.push(decision);
        where.push(`gd.decision = ANY($${params.length}::text[])`);
    }

    const limitOffset = addLimitOffset(params, filters);
    const result = await getPool().query(`
        SELECT
            gd.id,
            sc.service_id,
            sc.title AS service_title,
            gd.decision_type,
            gd.decision,
            gd.rationale,
            gd.decided_by,
            gd.decided_at,
            gd.created_at
        FROM data.governance_decision gd
        JOIN data.service_catalog sc
          ON sc.id = gd.service_id
        WHERE ${where.join(' AND ')}
        ORDER BY gd.decided_at DESC, gd.id DESC
        ${limitOffset}
    `, params);
    return result.rows;
}

async function createDecision(data) {
    const servicePk = await resolveServicePk(data.service_id);
    const result = await getPool().query(`
        WITH inserted AS (
            INSERT INTO data.governance_decision (
                service_id,
                decision_type,
                decision,
                rationale,
                decided_by,
                decided_at
            )
            VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, CURRENT_TIMESTAMP))
            RETURNING *
        )
        SELECT
            gd.id,
            sc.service_id,
            sc.title AS service_title,
            gd.decision_type,
            gd.decision,
            gd.rationale,
            gd.decided_by,
            gd.decided_at,
            gd.created_at
        FROM inserted gd
        JOIN data.service_catalog sc
          ON sc.id = gd.service_id
    `, [
        servicePk,
        data.decision_type,
        data.decision,
        data.rationale || null,
        data.decided_by || null,
        data.decided_at || null,
    ]);
    return result.rows[0];
}

module.exports = {
    listOwnerLoad,
    listOwnerAssignments,
    listReviews,
    createReview,
    updateReview,
    listDecisions,
    createDecision,
};
