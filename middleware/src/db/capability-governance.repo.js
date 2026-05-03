'use strict';

const { getPool } = require('./pool');
const { buildSlug } = require('../utils/capability-slug');

function toInt(value) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

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

function isMissingC3Shape(err) {
    return err && ['42P01', '42703'].includes(err.code);
}

function normalizeText(value) {
    const text = String(value ?? '').trim();
    return text || null;
}

function normalizeReadiness(value) {
    const text = normalizeText(value)?.toLowerCase();
    if (!text) return null;
    if (['ready', 'publishable'].includes(text)) return 'ready';
    if (['blocked', 'not_ready', 'not-ready', 'warning'].includes(text)) return 'blocked';
    return text;
}

function buildCoverageWhere(filters, params) {
    const capWhere = ['1=1'];
    const mapWhere = ['m.capability_uuid = cap.capability_uuid'];

    const spiral = normalizeText(filters.spiral ?? filters.spiral_code);
    if (spiral) {
        params.push(spiral);
        const placeholder = `$${params.length}`;
        capWhere.push(`cap.spiral_code = ${placeholder}`);
        mapWhere.push(`m.spiral_code IS NOT DISTINCT FROM ${placeholder}`);
    } else {
        mapWhere.push('m.spiral_code IS NOT DISTINCT FROM cap.spiral_code');
    }

    const domain = normalizeText(filters.domain);
    if (domain) {
        params.push(`%${domain}%`);
        capWhere.push(`(
            cap.parent_title ILIKE $${params.length}
            OR cap.parent_code ILIKE $${params.length}
            OR cap.parent_abbreviation ILIKE $${params.length}
        )`);
    }

    const lifecycle = normalizeText(filters.lifecycle);
    if (lifecycle) {
        params.push(lifecycle);
        mapWhere.push(`(
            m.lifecycle_stage_code = $${params.length}
            OR m.lifecycle_state = $${params.length}
            OR m.service_status = $${params.length}
        )`);
    }

    const owner = normalizeText(filters.owner);
    if (owner) {
        params.push(`%${owner}%`);
        mapWhere.push(`(
            m.owner_name ILIKE $${params.length}
            OR m.owner_email ILIKE $${params.length}
        )`);
    }

    const readiness = normalizeReadiness(filters.readiness);
    if (readiness) {
        params.push(readiness);
        mapWhere.push(`m.readiness_state = $${params.length}`);
    }

    return { capWhere, mapWhere };
}

function normalizeServices(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function rowToCoverageItem(row) {
    const parent = {
        uuid: row.parent_uuid ?? null,
        page_id: row.parent_code ?? null,
        title: row.parent_title ?? null,
        abbreviation: row.parent_abbreviation ?? null,
    };
    const slug = buildSlug({ title: row.capability_title, abbreviation: row.capability_abbreviation }, parent);
    const serviceCount = toInt(row.service_count);
    const readyCount = toInt(row.ready_service_count);
    const blockedCount = toInt(row.blocked_service_count);
    const gapCount = toInt(row.gap_count);
    const readinessState = serviceCount === 0
        ? 'uncovered'
        : blockedCount > 0 || gapCount > 0
            ? 'not_ready'
            : 'ready';

    return {
        capability_uuid: row.capability_uuid,
        capability_code: row.capability_code,
        capability_title: row.capability_title,
        slug,
        parent,
        domain: row.parent_title ?? row.parent_code ?? null,
        spiral_code: row.spiral_code ?? null,
        coverage_percent: toInt(row.coverage_percent),
        total_requirements: toInt(row.total_requirements),
        covered_requirement_count: toInt(row.covered_requirement_count),
        gap_count: gapCount,
        service_count: serviceCount,
        primary_service_count: toInt(row.primary_service_count),
        supporting_service_count: toInt(row.supporting_service_count),
        enabling_service_count: toInt(row.enabling_service_count),
        dependent_service_count: toInt(row.dependent_service_count),
        ready_service_count: readyCount,
        blocked_service_count: blockedCount,
        incomplete_primary_mapping_count: toInt(row.incomplete_primary_mapping_count),
        readiness_state: readinessState,
        governance_state: row.governance_state ?? readinessState,
        services: normalizeServices(row.services),
    };
}

function emptyCoverage(filters = {}) {
    return {
        items: [],
        counts: { total: 0, uncovered: 0, over_covered: 0, not_ready: 0, ready: 0 },
        filters,
    };
}

async function listCoverage(filters = {}) {
    const params = [];
    const { capWhere, mapWhere } = buildCoverageWhere(filters, params);
    params.push(normalizeLimit(filters.limit));
    const limit = `$${params.length}`;
    params.push(normalizeOffset(filters.offset));
    const offset = `$${params.length}`;

    try {
        const result = await getPool().query(`
            SELECT
                cap.*,
                COALESCE(services.services, '[]'::jsonb) AS services
            FROM data.v_capability_governance_coverage cap
            LEFT JOIN LATERAL (
                SELECT jsonb_agg(DISTINCT jsonb_build_object(
                    'service_id', m.service_id,
                    'title', m.service_title,
                    'normalized_role', m.normalized_role,
                    'readiness_state', m.readiness_state,
                    'lifecycle_state', m.lifecycle_state,
                    'service_status', m.service_status,
                    'owner_name', m.owner_name,
                    'owner_email', m.owner_email
                )) AS services
                FROM data.v_capability_governance_mapping m
                WHERE ${mapWhere.join(' AND ')}
            ) services ON TRUE
            WHERE ${capWhere.join(' AND ')}
            ORDER BY
                cap.coverage_percent ASC,
                cap.gap_count DESC,
                cap.service_count DESC,
                cap.capability_title ASC
            LIMIT ${limit} OFFSET ${offset}
        `, params);

        const items = result.rows.map(rowToCoverageItem);
        return {
            items,
            counts: {
                total: items.length,
                uncovered: items.filter((item) => item.service_count === 0).length,
                over_covered: items.filter((item) => item.service_count > 1).length,
                not_ready: items.filter((item) => item.readiness_state !== 'ready').length,
                ready: items.filter((item) => item.readiness_state === 'ready').length,
            },
            filters,
        };
    } catch (err) {
        if (isMissingC3Shape(err)) return emptyCoverage(filters);
        throw err;
    }
}

async function listGaps(filters = {}) {
    const coverage = await listCoverage({ ...filters, limit: filters.limit ?? 500 });
    const items = coverage.items
        .filter((item) => (
            item.service_count === 0
            || item.gap_count > 0
            || item.incomplete_primary_mapping_count > 0
            || item.blocked_service_count > 0
        ))
        .map((item) => ({
            ...item,
            gap_type: item.service_count === 0
                ? 'uncovered'
                : item.gap_count > 0
                    ? 'requirement_gap'
                    : item.incomplete_primary_mapping_count > 0
                        ? 'incomplete_primary_mapping'
                        : 'readiness_gap',
            recommended_action: item.service_count === 0
                ? 'Map at least one service to this capability.'
                : item.gap_count > 0
                    ? 'Map services to uncovered C3 requirements.'
                    : item.incomplete_primary_mapping_count > 0
                        ? 'Repair incomplete primary service mappings.'
                        : 'Resolve service readiness blockers.',
        }));

    return {
        items,
        counts: { total: items.length, uncovered: items.filter((item) => item.gap_type === 'uncovered').length },
        filters,
    };
}

async function listOverlaps(filters = {}) {
    const coverage = await listCoverage({ ...filters, limit: filters.limit ?? 500 });
    const items = coverage.items
        .filter((item) => item.service_count > 1)
        .map((item) => ({
            ...item,
            overlap_score: Math.min(100, (item.service_count * 25) + (item.primary_service_count * 10)),
            recommended_action: 'Review duplicate service support and document intended ownership.',
        }))
        .sort((a, b) => b.overlap_score - a.overlap_score || b.service_count - a.service_count);

    return {
        items,
        counts: { total: items.length },
        filters,
    };
}

async function getSpiralReadiness(code, filters = {}) {
    const spiralCode = normalizeText(code) ?? 'Spiral_7';
    const coverage = await listCoverage({ ...filters, spiral: spiralCode, limit: filters.limit ?? 500 });
    return {
        spiral: { code: spiralCode, name: spiralCode.replace('_', ' ') },
        items: coverage.items,
        counts: {
            total: coverage.items.length,
            ready: coverage.items.filter((item) => item.readiness_state === 'ready').length,
            not_ready: coverage.items.filter((item) => item.readiness_state === 'not_ready').length,
            uncovered: coverage.items.filter((item) => item.readiness_state === 'uncovered').length,
            over_covered: coverage.items.filter((item) => item.service_count > 1).length,
        },
        filters: { ...filters, spiral: spiralCode },
    };
}

module.exports = {
    listCoverage,
    listGaps,
    listOverlaps,
    getSpiralReadiness,
};
