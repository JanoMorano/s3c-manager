'use strict';

const { getPool } = require('./pool');

function toInteger(value) {
    if (value == null || value === '') return null;
    const parsed = parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
    if (value == null) return null;
    const normalized = String(value).trim();
    return normalized || null;
}

function portfolioSelect() {
    return `
        SELECT
            sp.id,
            sp.portfolio_code,
            sp.title,
            sp.description,
            sp.status_code,
            sp.owner_group_id,
            ag.group_name AS owner_group_name,
            sp.created_at,
            sp.updated_at,
            COUNT(sc.id)::integer AS service_count,
            COUNT(sc.id) FILTER (
                WHERE COALESCE(sc.lifecycle_stage_code, sc.lifecycle_state) IN ('draft', 'design', 'under_review')
            )::integer AS draft_service_count,
            COUNT(sc.id) FILTER (
                WHERE COALESCE(sc.lifecycle_stage_code, sc.lifecycle_state) IN ('active', 'live', 'approved', 'production')
            )::integer AS active_service_count,
            COUNT(sc.id) FILTER (
                WHERE COALESCE(sc.lifecycle_stage_code, sc.lifecycle_state) IN ('retiring', 'deprecated')
            )::integer AS retiring_service_count,
            COUNT(sc.id) FILTER (
                WHERE COALESCE(sc.lifecycle_stage_code, sc.lifecycle_state) = 'retired'
            )::integer AS retired_service_count,
            COUNT(sc.id) FILTER (WHERE sc.requestable = TRUE)::integer AS requestable_service_count,
            COUNT(sc.id) FILTER (
                WHERE COALESCE(sc.review_due_at, sc.next_review_due_at) IS NOT NULL
                  AND COALESCE(sc.review_due_at, sc.next_review_due_at) < CURRENT_TIMESTAMP
            )::integer AS overdue_review_count
        FROM data.service_portfolio sp
        LEFT JOIN platform.app_group ag
            ON ag.id = sp.owner_group_id
        LEFT JOIN data.service_catalog sc
            ON sc.is_deleted = FALSE
           AND sc.is_stub = FALSE
           AND (
                sc.portfolio_id = sp.id
                OR (sc.portfolio_id IS NULL AND sc.portfolio_group_code = sp.portfolio_code)
           )
    `;
}

function portfolioGroupBy() {
    return `
        GROUP BY
            sp.id,
            sp.portfolio_code,
            sp.title,
            sp.description,
            sp.status_code,
            sp.owner_group_id,
            ag.group_name,
            sp.created_at,
            sp.updated_at
    `;
}

async function list({ status, ownerGroupId, lifecycle } = {}) {
    const filters = [];
    const values = [];

    function bind(value) {
        values.push(value);
        return `$${values.length}`;
    }

    const normalizedStatus = normalizeText(status);
    if (normalizedStatus) {
        filters.push(`sp.status_code = ${bind(normalizedStatus)}`);
    }

    const parsedOwnerGroupId = toInteger(ownerGroupId);
    if (parsedOwnerGroupId != null) {
        filters.push(`sp.owner_group_id = ${bind(parsedOwnerGroupId)}`);
    }

    const normalizedLifecycle = normalizeText(lifecycle);
    if (normalizedLifecycle) {
        filters.push(`EXISTS (
            SELECT 1
            FROM data.service_catalog sc_filter
            WHERE sc_filter.is_deleted = FALSE
              AND sc_filter.is_stub = FALSE
              AND (
                    sc_filter.portfolio_id = sp.id
                    OR (sc_filter.portfolio_id IS NULL AND sc_filter.portfolio_group_code = sp.portfolio_code)
              )
              AND COALESCE(sc_filter.lifecycle_stage_code, sc_filter.lifecycle_state) = ${bind(normalizedLifecycle)}
        )`);
    }

    const result = await getPool().query(`
        ${portfolioSelect()}
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ${portfolioGroupBy()}
        ORDER BY sp.title, sp.portfolio_code
    `, values);

    return result.rows;
}

async function getByCode(code) {
    const portfolioCode = normalizeText(code);
    if (!portfolioCode) return null;

    const portfolioResult = await getPool().query(`
        ${portfolioSelect()}
        WHERE sp.portfolio_code = $1
        ${portfolioGroupBy()}
        LIMIT 1
    `, [portfolioCode]);

    const portfolio = portfolioResult.rows[0];
    if (!portfolio) return null;

    const servicesResult = await getPool().query(`
        SELECT
            sc.id,
            sc.service_id,
            sc.title,
            sc.service_type_code AS service_type,
            sc.service_status_code AS service_status,
            COALESCE(sc.lifecycle_stage_code, sc.lifecycle_state) AS lifecycle_stage_code,
            sc.criticality_code,
            COALESCE(sc.review_due_at, sc.next_review_due_at) AS review_due_at,
            sc.requestable,
            (
                SELECT display_name
                FROM data.service_role_assignment
                WHERE service_id = sc.id
                  AND role_code = 'service_owner'
                  AND valid_to IS NULL
                LIMIT 1
            ) AS service_owner
        FROM data.service_catalog sc
        WHERE sc.is_deleted = FALSE
          AND sc.is_stub = FALSE
          AND (
                sc.portfolio_id = $1
                OR (sc.portfolio_id IS NULL AND sc.portfolio_group_code = $2)
          )
        ORDER BY sc.title, sc.service_id
    `, [portfolio.id, portfolio.portfolio_code]);

    return {
        ...portfolio,
        services: servicesResult.rows,
    };
}

async function create(data) {
    const result = await getPool().query(`
        INSERT INTO data.service_portfolio (
            portfolio_code,
            title,
            description,
            status_code,
            owner_group_id
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING portfolio_code
    `, [
        normalizeText(data.portfolio_code),
        normalizeText(data.title),
        normalizeText(data.description),
        normalizeText(data.status_code) || 'active',
        toInteger(data.owner_group_id),
    ]);

    return getByCode(result.rows[0].portfolio_code);
}

async function update(code, data) {
    const values = [normalizeText(code)];
    const setClauses = ['updated_at = CURRENT_TIMESTAMP'];
    const fieldMap = {
        title: 'title',
        description: 'description',
        status_code: 'status_code',
        owner_group_id: 'owner_group_id',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        const rawValue = key === 'owner_group_id' ? toInteger(data[key]) : normalizeText(data[key]);
        values.push(rawValue);
        setClauses.push(`${column} = $${values.length}`);
    }

    if (setClauses.length === 1) {
        return getByCode(values[0]);
    }

    await getPool().query(`
        UPDATE data.service_portfolio
        SET ${setClauses.join(', ')}
        WHERE portfolio_code = $1
    `, values);

    return getByCode(values[0]);
}

module.exports = {
    list,
    getByCode,
    create,
    update,
};
