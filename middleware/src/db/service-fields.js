'use strict';

/**
 * Canonical service fields (39_drop_legacy_service_mirrors.sql).
 *
 * The database stores one column per concept:
 *   lifecycle_stage_code  (+ is_stub)  — lifecycle / catalogue status
 *   review_due_at                       — next review
 *   portfolio_id                        — portfolio
 *   primary service-level service_sla   — SLA
 *   service_catalog_source (40_…sql)    — import provenance and raw import fields
 *   consumer_value                      — also value_proposition / business_purpose
 *   short_description                   — also business_summary
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

// Import provenance (40_service_catalog_source.sql): `src` is data.service_catalog_source.
const SOURCE_JOIN = 'LEFT JOIN data.service_catalog_source src ON src.service_catalog_id = sc.id';
const SOURCE_COLUMNS = Object.freeze([
    'source_local_id', 'source_sp_id', 'source_etag',
    'created_at_source', 'modified_at_source', 'is_available_status_ambiguous',
]);
// Keys of src.raw_fields (the former service_catalog column names).
const SOURCE_RAW_FIELDS = Object.freeze([
    'support_locations_raw', 'request_process_raw', 'support_availability_raw',
    'service_cost_raw', 'additional_information_raw', 'cp_service_type_raw',
    'service_features_raw', 'ext_tools_raw', 'legacy_ssl_mapping_raw',
    'other_info_raw', 'pricing_note_raw', 'service_area_raw',
    'customer_type_json', 'options_json', 'training_refs_json',
    'prerequisites_json', 'dependencies_json',
]);
// API input aliases of source fields.
const SOURCE_INPUT_ALIASES = Object.freeze({
    service_area: 'service_area_raw',
    customer_type: 'customer_type_json',
    options: 'options_json',
    training_refs: 'training_refs_json',
    localId: 'source_local_id',
    spId: 'source_sp_id',
    etag: 'source_etag',
});

/** SQL expression reading a raw import field; `src` comes from SOURCE_JOIN. */
function sourceRawSql(field) {
    if (!SOURCE_RAW_FIELDS.includes(field)) throw new Error(`Unknown raw import field: ${field}`);
    return `src.raw_fields->>'${field}'`;
}

// Saved position of the service in the overview portfolio grid (41_graph_node_layout.sql),
// exposed as graph_x/graph_y; `gl` is data.graph_node_layout.
const OVERVIEW_LAYOUT_JOIN = "LEFT JOIN data.graph_node_layout gl ON gl.view_key = 'service-overview/portfolio' AND gl.node_id = CONCAT('svc:', sc.service_id)";

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
 * Returns { fields, portfolioCode, sla, source, fallbacks } where
 *   fields        — input with legacy keys replaced by canonical ones,
 *   portfolioCode — portfolio code to resolve into portfolio_id (or undefined),
 *   sla           — patch for the primary service-level SLA row (or null),
 *   source        — patch for the import provenance row (or null),
 *   layout        — { x, y } overview position (or null),
 *   fallbacks     — values for catalogue columns that apply only when the
 *                   column is empty (value_proposition/business_purpose →
 *                   consumer_value, business_summary → short_description).
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

    // Description fields merged into consumer_value and short_description: the
    // legacy inputs only fill an empty field (fallbacks), so a re-import never
    // overwrites curated text.
    const fallbacks = {};
    const valueParts = ['value_proposition', 'business_purpose']
        .map((key) => (data[key] == null ? '' : String(data[key]).trim()))
        .filter((text, index, parts) => text && parts.indexOf(text) === index);
    if (valueParts.length) fallbacks.consumer_value = valueParts.join('\n\n');
    const businessSummary = data.business_summary == null ? '' : String(data.business_summary).trim();
    if (businessSummary) fallbacks.short_description = businessSummary.slice(0, 1000);
    ['value_proposition', 'business_purpose', 'business_summary'].forEach((key) => delete fields[key]);

    // Import provenance.
    let source = null;
    const sourceKeys = [...SOURCE_COLUMNS, ...SOURCE_RAW_FIELDS];
    for (const [key, value] of Object.entries(data)) {
        const target = SOURCE_INPUT_ALIASES[key] ?? key;
        if (!sourceKeys.includes(target)) continue;
        delete fields[key];
        // The canonical key wins over its alias.
        if (target !== key && has(data, target)) continue;
        source = source ?? {};
        source[target] = value;
    }

    // Overview position (graph_x/graph_y) is stored per graph view.
    let layout = null;
    if (has(data, 'graph_x') || has(data, 'graph_y')) {
        layout = { x: data.graph_x ?? null, y: data.graph_y ?? null };
        delete fields.graph_x;
        delete fields.graph_y;
    }

    return { fields, portfolioCode, sla, source, fallbacks, layout };
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

function serializeRawValue(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
}

/**
 * Updates the import provenance row of a service, creating it when needed.
 * `source` holds already normalized values keyed by SOURCE_COLUMNS or
 * SOURCE_RAW_FIELDS; raw fields set to null are removed from raw_fields.
 */
async function upsertServiceSource(pool, catalogId, source) {
    if (!source || Object.keys(source).length === 0) return;
    const columns = SOURCE_COLUMNS.filter((column) => Object.prototype.hasOwnProperty.call(source, column));
    const raw = {};
    SOURCE_RAW_FIELDS.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(source, field)) raw[field] = serializeRawValue(source[field]);
    });
    const values = columns.map((column) => (
        column === 'is_available_status_ambiguous' ? !!source[column] : source[column] ?? null
    ));
    const rawParam = `$${columns.length + 2}::jsonb`;
    await pool.query(`
        INSERT INTO data.service_catalog_source (service_catalog_id, ${[...columns, 'raw_fields'].join(', ')})
        VALUES ($1, ${[...columns.map((_, index) => `$${index + 2}`), `jsonb_strip_nulls(${rawParam})`].join(', ')})
        ON CONFLICT (service_catalog_id) DO UPDATE SET
            ${[...columns.map((column) => `${column} = EXCLUDED.${column}`),
        `raw_fields = jsonb_strip_nulls(data.service_catalog_source.raw_fields || ${rawParam})`,
        'updated_at = CURRENT_TIMESTAMP'].join(',\n            ')}
    `, [catalogId, ...values, JSON.stringify(raw)]);
}

module.exports = {
    SERVICE_STATUS_SQL,
    LIFECYCLE_STATE_SQL,
    PORTFOLIO_JOIN,
    PRIMARY_SLA_JOIN,
    SOURCE_JOIN,
    OVERVIEW_LAYOUT_JOIN,
    SOURCE_COLUMNS,
    SOURCE_RAW_FIELDS,
    sourceRawSql,
    canonicalizeServiceInput,
    resolvePortfolioId,
    upsertPrimarySla,
    upsertServiceSource,
};
