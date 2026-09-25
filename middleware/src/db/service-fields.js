'use strict';

/**
 * Canonical service fields (39_drop_legacy_service_mirrors.sql).
 *
 * The database stores one column per concept:
 *   lifecycle_stage_code  (+ is_stub)  — lifecycle / catalogue status
 *   review_due_at                       — next review
 *   portfolio_id                        — portfolio
 *   primary service-level service_sla   — SLA
 *
 * The API still exposes the derived legacy fields (service_status,
 * lifecycle_state, portfolio_group, sla_*) for compatibility, and accepts them
 * as input: canonicalizeServiceInput maps them to the canonical columns.
 */

const { toLifecycleStage } = require('../utils/lifecycle');

// SQL expressions for derived read fields; `sc` is data.service_catalog.
const SERVICE_STATUS_SQL = 'data.fn_service_status_code(sc.lifecycle_stage_code, sc.is_stub)';
const LIFECYCLE_STATE_SQL = 'data.fn_lifecycle_state_from_stage(sc.lifecycle_stage_code)';
// Joins providing `sp` (portfolio) and `sla` (primary service-level SLA).
const PORTFOLIO_JOIN = 'LEFT JOIN data.service_portfolio sp ON sp.id = sc.portfolio_id';
const PRIMARY_SLA_JOIN = 'LEFT JOIN data.service_sla sla ON sla.id = data.fn_service_primary_sla_id(sc.id)';

const SLA_INPUT_KEYS = Object.freeze({
    sla_availability: 'availability_pct',
    sla_restoration: 'restoration_hours',
    sla_restoration_hours: 'restoration_hours',
    sla_delivery: 'delivery_days',
    sla_delivery_days: 'delivery_days',
    sla_restoration_text: 'restoration_text',
    sla_delivery_text: 'delivery_text',
});

function has(data, key) {
    return Object.prototype.hasOwnProperty.call(data, key);
}

function parseNumber(value, parser) {
    if (value == null || value === '') return null;
    const parsed = parser(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function textIfNonNumeric(value) {
    if (value == null || typeof value === 'number') return null;
    const normalized = String(value).trim();
    if (!normalized) return null;
    return Number.isNaN(parseInt(normalized, 10)) ? normalized : null;
}

/**
 * Splits service input into canonical catalogue fields and an SLA patch.
 * Returns { fields, portfolioCode, sla } where
 *   fields        — input with legacy keys replaced by canonical ones,
 *   portfolioCode — portfolio code to resolve into portfolio_id (or undefined),
 *   sla           — patch for the primary service-level SLA row (or null).
 */
function canonicalizeServiceInput(data = {}) {
    const fields = { ...data };

    // Lifecycle: lifecycle_stage_code > lifecycle_state > service_status.
    const lifecycleSource = ['lifecycle_stage_code', 'lifecycle_state', 'service_status', 'service_status_code']
        .find((key) => has(data, key) && data[key] !== undefined);
    if (lifecycleSource) {
        const raw = data[lifecycleSource];
        // Stubs are marked by is_stub; their status 'external_reference' has no lifecycle stage.
        fields.lifecycle_stage_code = raw == null || raw === '' || raw === 'external_reference'
            ? null
            : (toLifecycleStage(raw) ?? raw);
    }
    ['lifecycle_state', 'service_status', 'service_status_code'].forEach((key) => delete fields[key]);

    // Review date.
    if (!has(data, 'review_due_at') && has(data, 'next_review_due_at')) {
        fields.review_due_at = data.next_review_due_at;
    }
    delete fields.next_review_due_at;

    // Portfolio: portfolio_id wins; a portfolio code is resolved by the caller.
    let portfolioCode;
    if (!has(data, 'portfolio_id')) {
        const codeKey = ['portfolio_group_code', 'portfolio_group', 'portfolio_code'].find((key) => has(data, key));
        if (codeKey) portfolioCode = data[codeKey] || null;
    }
    ['portfolio_group_code', 'portfolio_group', 'portfolio_code'].forEach((key) => delete fields[key]);

    // SLA.
    let sla = null;
    for (const [key, column] of Object.entries(SLA_INPUT_KEYS)) {
        if (!has(data, key)) continue;
        sla = sla ?? {};
        const value = data[key];
        if (column === 'availability_pct') sla[column] = parseNumber(value, parseFloat);
        else if (column === 'restoration_hours' || column === 'delivery_days') {
            sla[column] = parseNumber(value, (v) => parseInt(v, 10));
            // Non-numeric text such as "4h RTO" is kept as the SLA text.
            const textColumn = column === 'restoration_hours' ? 'restoration_text' : 'delivery_text';
            const textKey = column === 'restoration_hours' ? 'sla_restoration_text' : 'sla_delivery_text';
            if (!has(data, textKey)) sla[textColumn] = textIfNonNumeric(value);
        } else sla[column] = value === '' ? null : value ?? null;
        delete fields[key];
    }

    return { fields, portfolioCode, sla };
}

/** Resolves a portfolio code to service_portfolio.id (null when unknown or empty). */
async function resolvePortfolioId(pool, portfolioCode) {
    if (!portfolioCode) return null;
    const result = await pool.query('SELECT id FROM data.service_portfolio WHERE portfolio_code = $1', [portfolioCode]);
    return result.rows[0]?.id ?? null;
}

/** Updates the primary service-level SLA row of a service, creating it when needed. */
async function upsertPrimarySla(pool, catalogId, sla) {
    if (!sla || Object.keys(sla).length === 0) return;
    const columns = Object.keys(sla);
    const existing = await pool.query('SELECT data.fn_service_primary_sla_id($1) AS id', [catalogId]);
    const primaryId = existing.rows[0]?.id ?? null;
    if (primaryId) {
        const sets = columns.map((column, index) => `${column} = $${index + 2}`);
        await pool.query(
            `UPDATE data.service_sla SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [primaryId, ...columns.map((column) => sla[column])],
        );
        return;
    }
    if (columns.every((column) => sla[column] == null)) return;
    await pool.query(
        `INSERT INTO data.service_sla (service_id, flavour_id, source_field, ${columns.join(', ')})
         VALUES ($1, NULL, 'service_catalog', ${columns.map((_, index) => `$${index + 2}`).join(', ')})`,
        [catalogId, ...columns.map((column) => sla[column])],
    );
}

module.exports = {
    SERVICE_STATUS_SQL,
    LIFECYCLE_STATE_SQL,
    PORTFOLIO_JOIN,
    PRIMARY_SLA_JOIN,
    canonicalizeServiceInput,
    resolvePortfolioId,
    upsertPrimarySla,
};
