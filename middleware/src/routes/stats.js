'use strict';
const express    = require('express');
const NodeCache  = require('node-cache');
const { getPool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { canAdmin } = require('../middleware/rbac');
const { isModuleApiEnabled } = require('../middleware/module-gates');
const { findAllForExport, updateScore } = require('../db/services.repo');
const flRepo       = require('../db/flavours.repo');
const { serviceScore } = require('../services/scoring');
const config = require('../config');

const router = express.Router();
router.use(requireAuth);

const cache = new NodeCache({ stdTTL: config.cache.dashboardTtl, checkperiod: 60 });

function csvEscapeCell(value) {
    const normalized = String(value ?? '')
        .replace(/\r\n|\r|\n/g, ' ')
        .replace(/^\s*([=+\-@])/, "'$1")
        .replace(/"/g, '""');
    return `"${normalized}"`;
}

async function loadDashboardStats() {
    const CACHE_KEY = 'dashboard_stats';
    const cached = cache.get(CACHE_KEY);
    if (cached) return { ...cached, _cached: true };

    const c3Enabled = await isModuleApiEnabled('C3_TAXONOMY');

    const [stats, byType, byPortfolio, byDomain, byOwner, expensiveFlavours, c3Coverage, byLifecycle] = await Promise.all([
        getPool().query(`
            SELECT
                COUNT(*) FILTER (WHERE is_deleted = FALSE AND is_stub = FALSE) AS total_services,
                COUNT(*) FILTER (WHERE is_deleted = FALSE AND is_stub = FALSE AND service_status_code = 'active') AS active_services,
                COUNT(*) FILTER (WHERE is_deleted = FALSE AND is_stub = FALSE AND service_status_code = 'draft') AS draft_services,
                COUNT(*) FILTER (WHERE is_deleted = FALSE AND is_stub = FALSE AND service_status_code = 'deprecated') AS deprecated_services,
                COUNT(*) FILTER (WHERE is_deleted = FALSE AND is_stub = FALSE AND service_status_code = 'retired') AS retired_services,
                COUNT(*) FILTER (WHERE is_deleted = FALSE AND is_stub = FALSE AND requestable = TRUE) AS requestable_services,
                (SELECT COUNT(*) FROM data.service_relation WHERE is_deleted = FALSE) AS total_relations,
                (SELECT COUNT(*) FROM data.service_flavour WHERE is_deleted = FALSE) AS total_flavours
            FROM data.service_catalog
        `),
        getPool().query(`
            SELECT service_type_code AS service_type, COUNT(*) AS count
            FROM data.service_catalog
            WHERE is_deleted = FALSE
            GROUP BY service_type_code
            ORDER BY service_type_code
        `),
        getPool().query(`
            SELECT portfolio_group_code AS portfolio_group, COUNT(*) AS count
            FROM data.service_catalog
            WHERE is_deleted = FALSE AND is_stub = FALSE
            GROUP BY portfolio_group_code
            ORDER BY portfolio_group_code
        `),
        getPool().query(`
            SELECT sao.domain_code,
                   COUNT(DISTINCT sao.service_id) AS service_count
            FROM data.service_available_on sao
            INNER JOIN data.service_catalog sc
                ON sc.id = sao.service_id AND sc.is_deleted = FALSE AND sc.is_stub = FALSE
            GROUP BY sao.domain_code
            ORDER BY service_count DESC
        `),
        getPool().query(`
            SELECT
                sra.display_name,
                sra.email,
                COUNT(DISTINCT sc.id) AS service_count
            FROM data.service_role_assignment sra
            JOIN data.service_catalog sc
                ON sc.id = sra.service_id AND sc.is_deleted = FALSE AND sc.is_stub = FALSE
            WHERE sra.role_code = 'service_owner'
              AND sra.valid_to  IS NULL
            GROUP BY sra.display_name, sra.email
            ORDER BY service_count DESC, sra.display_name
        `),
        getPool().query(`
            SELECT
                sc.service_id,
                sf.flavour_code,
                COALESCE(NULLIF(sf.title, ''), sc.title) AS flavour_title,
                sf.service_unit,
                sf.price_value,
                sf.currency_code
            FROM data.service_flavour sf
            JOIN data.service_catalog sc
                ON sc.id = sf.service_id
            WHERE sc.is_deleted = FALSE
              AND sc.is_stub = FALSE
              AND sf.is_deleted = FALSE
              AND sf.price_value IS NOT NULL
            ORDER BY sf.price_value DESC, sc.service_id, sf.flavour_code
            LIMIT 10
        `),
        c3Enabled
            ? getPool().query(`
                WITH mapped AS (
                    SELECT DISTINCT c3_uuid
                    FROM data.service_c3_mapping
                    WHERE c3_uuid IS NOT NULL
                )
                SELECT
                    COALESCE(ct.item_type, 'UNSPECIFIED') AS item_type,
                    COUNT(*) AS total_count,
                    SUM(CASE WHEN mapped.c3_uuid IS NOT NULL THEN 1 ELSE 0 END) AS mapped_count
                FROM data.c3_taxonomy ct
                LEFT JOIN mapped
                    ON mapped.c3_uuid = ct.uuid
                GROUP BY COALESCE(ct.item_type, 'UNSPECIFIED')
                ORDER BY COALESCE(ct.item_type, 'UNSPECIFIED')
            `)
            : Promise.resolve({ rows: [] }),
        getPool().query(`
            SELECT
                COALESCE(lifecycle_state, 'unset') AS lifecycle_state,
                COUNT(*)::integer AS count
            FROM data.service_catalog
            WHERE is_deleted = FALSE AND is_stub = FALSE
            GROUP BY lifecycle_state
            ORDER BY lifecycle_state
        `),
    ]);

    const result = {
        summary:        stats.rows[0],
        by_type:        byType.rows,
        by_portfolio:   byPortfolio.rows,
        by_domain:      byDomain.rows,
        by_owner:       byOwner.rows,
        expensive_flavours: expensiveFlavours.rows,
        c3_coverage:    c3Coverage.rows,
        by_lifecycle:   byLifecycle.rows,
        _cached:        false,
    };

    cache.set(CACHE_KEY, result);
    return result;
}

async function loadCompletenessRows() {
    const result = await getPool().query(`
        SELECT
            sc.id, sc.service_id, sc.title,
            sc.service_type_code  AS service_type,
            sc.service_status_code AS service_status,
            sc.portfolio_group_code AS portfolio_group,
            sc.short_description    AS summary,
            sc.completeness_score,
            sc.sla_availability,
            sc.updated_at,
            CASE WHEN scm.c3_uuid IS NOT NULL THEN TRUE ELSE FALSE END AS has_c3_mapping,
            (SELECT COUNT(*) FROM data.service_flavour sf
             WHERE sf.service_id = sc.id
               AND sf.is_deleted = FALSE
               AND LOWER(COALESCE(sf.flavour_status_code,'')) IN ('available','active')) AS flavour_count
        FROM data.service_catalog sc
        LEFT JOIN data.service_c3_mapping scm
            ON scm.service_id = sc.id AND scm.is_primary = TRUE
        WHERE sc.is_deleted = FALSE AND sc.is_stub = FALSE
        ORDER BY sc.title ASC
    `);
    return result.rows;
}

async function loadMissingOwners() {
    const result = await getPool().query(`
        SELECT sc.service_id, sc.title, sc.service_status_code AS service_status, sc.updated_at
        FROM data.service_catalog sc
        WHERE sc.is_deleted = FALSE
          AND sc.is_stub = FALSE
          AND NOT EXISTS (
              SELECT 1
              FROM data.service_role_assignment sra
              WHERE sra.service_id = sc.id
                AND sra.role_code = 'service_owner'
                AND sra.valid_to IS NULL
          )
        ORDER BY sc.updated_at DESC NULLS LAST, sc.title ASC
        LIMIT 10
    `);
    return result.rows;
}

function normalizeNumber(value) {
    return Number(value ?? 0);
}

function percent(part, total) {
    const numerator = normalizeNumber(part);
    const denominator = normalizeNumber(total);
    return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function buildHeadlinePayload(dashboard) {
    const summary = dashboard.summary ?? {};
    const c3Totals = (dashboard.c3_coverage ?? []).reduce((acc, row) => {
        acc.total += normalizeNumber(row.total_count);
        acc.mapped += normalizeNumber(row.mapped_count);
        return acc;
    }, { total: 0, mapped: 0 });

    return {
        kpis: [
            {
                key: 'services_count',
                label: 'Services in catalogue',
                value: normalizeNumber(summary.total_services),
                unit: 'count',
                hint: `${normalizeNumber(summary.active_services)} active`,
            },
            {
                key: 'publishable_readiness_percent',
                label: 'Publishable readiness',
                value: percent(summary.requestable_services, summary.total_services),
                unit: 'percent',
                hint: `${normalizeNumber(summary.requestable_services)} requestable`,
            },
            {
                key: 'top_framework_coverage_percent',
                label: 'Top framework coverage',
                value: percent(c3Totals.mapped, c3Totals.total),
                unit: 'percent',
                hint: `${c3Totals.mapped}/${c3Totals.total} C3 mapped`,
            },
        ],
        _cached: Boolean(dashboard._cached),
    };
}

function buildOperationsPayload(dashboard, completeness, missingOwners) {
    const activeCompleteness = [...completeness].filter((service) => service.service_status !== 'retired');
    const incompleteMetadata = activeCompleteness
        .filter((service) => normalizeNumber(service.completeness_score) < 70)
        .sort((a, b) => normalizeNumber(a.completeness_score) - normalizeNumber(b.completeness_score))
        .slice(0, 10);
    const topCompleteness = activeCompleteness
        .sort((a, b) => normalizeNumber(b.completeness_score) - normalizeNumber(a.completeness_score))
        .slice(0, 10);
    const deprecatedRetired = completeness
        .filter((service) => ['deprecated', 'retired'].includes(service.service_status))
        .slice(0, 10);
    const withPricing = activeCompleteness.filter((service) => normalizeNumber(service.flavour_count) > 0);
    const withoutPricing = activeCompleteness.filter((service) => normalizeNumber(service.flavour_count) === 0).slice(0, 10);
    const c3MappingGap = (dashboard.c3_coverage ?? [])
        .map((row) => ({
            item_type: row.item_type,
            total_count: normalizeNumber(row.total_count),
            mapped_count: normalizeNumber(row.mapped_count),
            gap_count: Math.max(0, normalizeNumber(row.total_count) - normalizeNumber(row.mapped_count)),
        }))
        .sort((a, b) => b.gap_count - a.gap_count);

    return {
        summary: dashboard.summary,
        sections: {
            incomplete_metadata: incompleteMetadata,
            missing_owners: missingOwners,
            top_completeness: topCompleteness,
            deprecated_retired: deprecatedRetired,
            pricing_patrol: {
                total_services: activeCompleteness.length,
                with_pricing: withPricing.length,
                coverage_percent: percent(withPricing.length, activeCompleteness.length),
                missing: withoutPricing,
            },
            c3_mapping_gap: c3MappingGap,
        },
    };
}

// ─── GET /stats/dashboard-headline ───────────────────────────────────────────
router.get('/dashboard-headline', async (req, res, next) => {
    try {
        const dashboard = await loadDashboardStats();
        res.json(buildHeadlinePayload(dashboard));
    } catch (err) { next(err); }
});

// ─── GET /stats/operations ───────────────────────────────────────────────────
router.get('/operations', async (req, res, next) => {
    try {
        const [dashboard, completeness, missingOwners] = await Promise.all([
            loadDashboardStats(),
            loadCompletenessRows(),
            loadMissingOwners(),
        ]);
        res.json(buildOperationsPayload(dashboard, completeness, missingOwners));
    } catch (err) { next(err); }
});

// ─── GET /stats/dashboard ─────────────────────────────────────────────────────
router.get('/dashboard', async (req, res, next) => {
    try {
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', 'Tue, 26 May 2026 00:00:00 GMT');
        res.setHeader('Link', '</api/v1/stats/dashboard-headline>; rel="successor-version"');
        res.json(await loadDashboardStats());
    } catch (err) { next(err); }
});

// ─── GET /stats/completeness ──────────────────────────────────────────────────
// Returns a service overview for manual audit. completeness_score was removed from schema v4,
// so the endpoint returns base fields that help assess record completeness.
router.get('/completeness', async (req, res, next) => {
    try {
        const res2 = await getPool().query(`
            SELECT
                sc.id, sc.service_id, sc.title,
                sc.service_type_code  AS service_type,
                sc.service_status_code AS service_status,
                sc.portfolio_group_code AS portfolio_group,
                sc.short_description    AS summary,
                sc.completeness_score,
                sc.sla_availability,
                sc.updated_at,
                CASE WHEN scm.c3_uuid IS NOT NULL THEN TRUE ELSE FALSE END AS has_c3_mapping,
                (SELECT COUNT(*) FROM data.service_flavour sf
                 WHERE sf.service_id = sc.id
                   AND sf.is_deleted = FALSE
                   AND LOWER(COALESCE(sf.flavour_status_code,'')) IN ('available','active')) AS flavour_count
            FROM data.service_catalog sc
            LEFT JOIN data.service_c3_mapping scm
                ON scm.service_id = sc.id AND scm.is_primary = TRUE
            WHERE sc.is_deleted = FALSE AND sc.is_stub = FALSE
            ORDER BY sc.title ASC
        `);
        res.json(res2.rows);
    } catch (err) { next(err); }
});

// ─── GET /stats/export ────────────────────────────────────────────────────────
// Returns data as JSON for client-side export (SheetJS in FE)
// or accepts ?format=csv for server-side CSV.
// SECURITY: bulk export restricted to admin users.
router.get('/export', canAdmin, async (req, res, next) => {
    try {
        const services = await findAllForExport();
        const format   = req.query.format || 'json';

        if (format === 'csv') {
            const cols = [
                'service_id', 'title', 'service_type', 'service_status',
                'unit_of_measure', 'sla_availability',
                'sla_delivery', 'sla_restoration',
                'portfolio_group', 'summary',   // aliases in SC_COLUMNS; do not change
            ];
            const header = cols.join(';');
            const rows   = services.map(s => cols.map(c => {
                const val = s[c] ?? '';
                return csvEscapeCell(val);
            }).join(';'));
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="service-catalogue.csv"');
            return res.send('\uFEFF' + [header, ...rows].join('\n')); // BOM for Excel
        }

        res.json(services);
    } catch (err) { next(err); }
});

// ─── GET /stats/domains ───────────────────────────────────────────────────────
// Service counts by domain (ServiceAvailableOn M:N).
router.get('/domains', async (req, res, next) => {
    try {
        const result = await getPool().query(`
            SELECT
                sao.domain_code,
                COUNT(DISTINCT sao.service_id) AS service_count
            FROM data.service_available_on sao
            INNER JOIN data.service_catalog sc
                ON sc.id = sao.service_id AND sc.is_deleted = FALSE AND sc.is_stub = FALSE
            GROUP BY sao.domain_code
            ORDER BY service_count DESC
        `);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// ─── POST /stats/recalculate (admin) ─────────────────────────────────────────
// Recalculates completeness_score for all active non-stub services.
// Synchronous by design; suitable for catalogues up to roughly 500 services.
router.post('/recalculate', canAdmin, async (req, res, next) => {
    try {
        const services = await findAllForExport();
        let updated = 0;
        const errors  = [];

        for (const svc of services) {
            try {
                const flavours = await flRepo.findByService(svc.service_id);
                const score    = serviceScore(svc, flavours);
                await updateScore(svc.service_id, score);
                updated++;
            } catch (err) {
                errors.push({ service_id: svc.service_id, error: err.message });
            }
        }

        cache.flushAll();
        res.json({
            message:  `Přepočet dokončen: ${updated} služeb aktualizováno`,
            updated,
            errors:   errors.length ? errors : undefined,
        });
    } catch (err) { next(err); }
});

module.exports = router;
