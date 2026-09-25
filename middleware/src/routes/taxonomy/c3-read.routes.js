'use strict';

/** Authenticated C3 read endpoints: types, statuses, lists, entity detail, dashboard and capability maps. */

const express = require('express');
const { getPool } = require('../../db/pool');
const { requireAuth } = require('../../middleware/auth');
const { parseCsvFilter, parseTextFilter, parseIntFilter } = require('../../utils/query-filters');
const config = require('../../config');
const logger = require('../../utils/logger');
const { tReq } = require('../../utils/i18n');
const {
    cache,
    ALLOWED_C3_ITEM_TYPES,
    AIR_C2_SUCCESSOR_ENDPOINT,
    selectRows,
    selectOne,
    normalizeCodeParam,
} = require('./shared');
const {
    buildLegacyFmnAirC2PayloadFromCoverage,
    loadLegacyFmnAirC2Coverage,
    getC3EntityDetailByCode,
} = require('./c3-taxonomy.service');
const {
    listCapabilityBuilderDomains,
    normalizeSpiralCode,
    getCapabilityMapTitle,
    buildCapabilityMapPayload,
    buildCapabilityMapPayloadBySpiral,
} = require('./capability-map.service');

const router = express.Router();

// ── C3 read endpoints require authentication ─────────────────────────────────
// GET /api/v1/taxonomy/c3/types — authenticated read for catalogue filters.
router.get('/c3/types', requireAuth, async (req, res, next) => {
    try {
        const result = await selectRows(getPool(), `
            SELECT DISTINCT item_type AS code
            FROM data.c3_taxonomy
            WHERE item_type IS NOT NULL
            ORDER BY item_type
        `);
        const fromDb     = result.map(r => r.code);
        const BASE_TYPES = ['BP', 'BR', 'CI', 'CO', 'CP', 'CR', 'IP', 'UA'];
        const merged     = [...new Set([...BASE_TYPES, ...fromDb])].sort();
        res.json(merged.map(code => ({ code, name: code })));
    } catch (err) { next(err); }
});

// GET /api/v1/taxonomy/c3/statuses — authenticated read for editor selects.
router.get('/c3/statuses', requireAuth, async (req, res, next) => {
    try {
        const result = await selectRows(getPool(), `
            SELECT DISTINCT item_status AS code
            FROM data.c3_taxonomy
            WHERE item_status IS NOT NULL
            ORDER BY item_status
        `);
        const fromDb       = result.map(r => r.code);
        const BASE_STATUSES = ['active', 'archived', 'draft', 'pending', 'published', 'retired'];
        const merged        = [...new Set([...BASE_STATUSES, ...fromDb])].sort();
        res.json(merged);
    } catch (err) { next(err); }
});

router.get('/c3/parent-options', requireAuth, async (req, res, next) => {
    try {
        const itemType = String(req.query.item_type ?? '').trim().toUpperCase();
        const params = [];
        let sqlQuery = `
            SELECT DISTINCT parent.title AS title
            FROM data.c3_taxonomy child
            JOIN data.c3_taxonomy parent ON parent.uuid = child.parent_uuid
            WHERE parent.title IS NOT NULL
        `;
        if (itemType && ALLOWED_C3_ITEM_TYPES.includes(itemType)) {
            params.push(itemType);
            sqlQuery += ` AND child.item_type = $${params.length}`;
        }
        sqlQuery += ` ORDER BY parent.title`;
        const rows = await selectRows(getPool(), sqlQuery, params);
        res.json(rows.map((row) => row.title));
    } catch (err) { next(err); }
});

// GET /api/v1/taxonomy/security-classifications — authenticated read for editor selects.
router.get('/security-classifications', requireAuth, async (req, res, next) => {
    try {
        const cacheKey = 'ref_security_classifications';
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        const result = await selectRows(getPool(), `
            SELECT code, name, sort_order
            FROM data.ref_security_classification
            ORDER BY COALESCE(sort_order, 9999), code
        `);
        cache.set(cacheKey, result);
        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/v1/taxonomy/c3 — authenticated read-only listing.
router.get('/c3', requireAuth, async (req, res, next) => {
    try {
        const search = parseTextFilter(req.query.search);
        const itemStatuses = parseCsvFilter(req.query.item_status, { maxItems: 10 });
        const itemTypes = parseCsvFilter(req.query.item_type, { maxItems: 10, allowed: ALLOWED_C3_ITEM_TYPES });
        const applications = parseCsvFilter(req.query.application, { maxItems: 20 });
        const parentUuids = parseCsvFilter(req.query.parent_uuid, { maxItems: 20 });
        const limit = parseIntFilter(req.query.limit, { fallback: null, min: 1, max: 1000 });
        const cacheKey = `c3_taxonomy:${search}:${itemStatuses.join('|')}:${itemTypes.join('|')}:${applications.join('|')}:${parentUuids.join('|')}:${limit ?? 'all'}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        let rows = await selectRows(getPool(), `
            SELECT
                c.*,
                p.title AS parent_title,
                p.external_id AS parent_external_id,
                (
                    SELECT COUNT(*)
                    FROM data.service_c3_mapping scm
                    WHERE scm.c3_uuid = c.uuid
                ) AS mapping_count
            FROM data.c3_taxonomy c
            LEFT JOIN data.c3_taxonomy p ON p.uuid = c.parent_uuid
            ORDER BY COALESCE(c.order_num, 999999), c.title
        `);
        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter((row) =>
                String(row.title ?? '').toLowerCase().includes(q) ||
                String(row.external_id ?? '').toLowerCase().includes(q) ||
                String(row.source_external_id ?? '').toLowerCase().includes(q) ||
                String(row.application ?? '').toLowerCase().includes(q) ||
                String(row.parent_code ?? '').toLowerCase().includes(q) ||
                String(row.references_raw ?? '').toLowerCase().includes(q) ||
                String(row.datasets_raw ?? '').toLowerCase().includes(q)
            );
        }
        if (itemStatuses.length > 0) rows = rows.filter((row) => itemStatuses.includes(row.item_status));
        if (itemTypes.length > 0) rows = rows.filter((row) => itemTypes.includes(row.item_type));
        if (applications.length > 0) rows = rows.filter((row) => applications.includes(row.application));
        if (parentUuids.length > 0) rows = rows.filter((row) => parentUuids.includes(row.parent_uuid));
        if (limit != null) rows = rows.slice(0, limit);

        cache.set(cacheKey, rows);
        res.json(rows);
    } catch (err) { next(err); }
});

router.get('/c3-services/:code', requireAuth, async (req, res, next) => {
    try {
        const row = await getC3EntityDetailByCode(req, 'c3-services', normalizeCodeParam(req.params.code));
        if (!row) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.c3_service_not_found') });
        res.json(row);
    } catch (err) { next(err); }
});

router.get('/c3-applications/:code', requireAuth, async (req, res, next) => {
    try {
        const row = await getC3EntityDetailByCode(req, 'c3-application', normalizeCodeParam(req.params.code));
        if (!row) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.c3_application_not_found') });
        res.json(row);
    } catch (err) { next(err); }
});

router.get('/c3-data-objects/:code', requireAuth, async (req, res, next) => {
    try {
        const row = await getC3EntityDetailByCode(req, 'c3-data-objects', normalizeCodeParam(req.params.code));
        if (!row) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.c3_data_object_not_found') });
        res.json(row);
    } catch (err) { next(err); }
});

router.get('/c3-technology-interactions/:code', requireAuth, async (req, res, next) => {
    try {
        const row = await getC3EntityDetailByCode(req, 'c3-technology-interactions', normalizeCodeParam(req.params.code));
        if (!row) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.c3_technology_interaction_not_found') });
        res.json(row);
    } catch (err) { next(err); }
});

router.get('/c3/fmn-air-c2/coverage', requireAuth, async (req, res, next) => {
    try {
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', 'Tue, 26 May 2026 00:00:00 GMT');
        res.setHeader('Link', `<${AIR_C2_SUCCESSOR_ENDPOINT}>; rel="successor-version"`);
        const serviceSearch = parseTextFilter(req.query.service, { maxLength: 120 });
        const cacheKey = `c3_fmn_air_c2_coverage:${serviceSearch || 'all'}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);
        const coverage = await loadLegacyFmnAirC2Coverage(getPool());
        if (coverage.status !== 200) return res.status(coverage.status).json(coverage.body);
        const payload = buildLegacyFmnAirC2PayloadFromCoverage(coverage.body, serviceSearch);
        cache.set(cacheKey, payload, config.cache.c3DashboardTtl);
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/c3/dashboard', requireAuth, async (req, res, next) => {
    try {
        const cacheKey = 'c3_dashboard_aggregate:v3';
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        const [
            summaryResult,
            byStatusResult,
            byTypeResult,
            byApplicationResult,
            topParentsResult,
            needsMappingResult,
            mostMappedResult,
            coverageResult,
            syncStatusResult,
            capabilityMapHealthResult,
            spiralCoverageResult,
            importSyncDriftResult,
            linkHealthResult,
            reviewValidationResult,
        ] = await Promise.all([
            selectOne(getPool(), `SELECT * FROM data.v_c3dashboardsummary`),
            selectRows(getPool(), `
                SELECT COALESCE(item_status, 'unknown') AS name, COUNT(*) AS value
                FROM data.c3_taxonomy
                GROUP BY COALESCE(item_status, 'unknown')
                ORDER BY value DESC, name ASC
            `),
            selectRows(getPool(), `
                SELECT COALESCE(item_type, 'OTHER') AS name, COUNT(*) AS value
                FROM data.c3_taxonomy
                GROUP BY COALESCE(item_type, 'OTHER')
                ORDER BY value DESC, name ASC
            `),
            selectRows(getPool(), `
                SELECT COALESCE(application, '(unclassified)') AS name, COUNT(*) AS value
                FROM data.c3_taxonomy
                GROUP BY COALESCE(application, '(unclassified)')
                ORDER BY value DESC, name ASC
                LIMIT 10
            `),
            selectRows(getPool(), `
                SELECT COALESCE(parent_title, '(Kořenové schopnosti)') AS name, COUNT(*) AS value
                FROM data.v_c3capabilitymaphierarchyexport
                GROUP BY COALESCE(parent_title, '(Kořenové schopnosti)')
                ORDER BY value DESC, name ASC
                LIMIT 8
            `),
            selectRows(getPool(), `
                SELECT uuid, title, item_type
                FROM data.v_c3capabilitymaphierarchyexport
                WHERE is_mapped = FALSE
                ORDER BY order_num, title
                LIMIT 10
            `),
            selectRows(getPool(), `
                SELECT uuid, title, mapping_count
                FROM data.v_c3capabilitymaphierarchyexport
                ORDER BY mapping_count DESC, title ASC
                LIMIT 10
            `),
            selectRows(getPool(), `
                SELECT
                    COALESCE(application, '(unclassified)') AS name,
                    COUNT(*) AS value,
                    SUM(CASE WHEN is_mapped = TRUE THEN 1 ELSE 0 END) AS mapped
                FROM data.v_c3capabilitymaphierarchyexport
                GROUP BY COALESCE(application, '(unclassified)')
                ORDER BY value DESC, name ASC
                LIMIT 10
            `),
            selectRows(getPool(), `
                SELECT COALESCE(sync_status, 'unknown') AS name, COUNT(*) AS value
                FROM data.service_c3_mapping
                GROUP BY COALESCE(sync_status, 'unknown')
                ORDER BY value DESC, name ASC
                LIMIT 8
            `),
            selectOne(getPool(), `
                SELECT
                    COUNT(*)::INT AS total_nodes,
                    SUM(CASE WHEN COALESCE(comp.has_service_mapping, FALSE) THEN 1 ELSE 0 END)::INT AS mapped_nodes,
                    SUM(CASE WHEN COALESCE(comp.has_service_mapping, FALSE) = FALSE THEN 1 ELSE 0 END)::INT AS unmapped_nodes
                FROM data.c3_capability_builder b
                LEFT JOIN data.v_c3capabilitycompleteness comp
                  ON comp.uuid = b.uuid
            `),
            selectRows(getPool(), `
                WITH builder AS (
                    SELECT
                        CASE
                            WHEN COALESCE(b.fmn_spiral, 'Spiral_7') = 'Spiral_6' THEN 'Spiral 6'
                            WHEN COALESCE(b.fmn_spiral, 'Spiral_7') = 'Spiral_7' THEN 'Spiral 7'
                            ELSE REPLACE(COALESCE(b.fmn_spiral, 'Baseline'), '_', ' ')
                        END AS name,
                        COALESCE(comp.has_service_mapping, FALSE) AS has_service_mapping
                    FROM data.c3_capability_builder b
                    LEFT JOIN data.v_c3capabilitycompleteness comp
                      ON comp.uuid = b.uuid
                )
                SELECT
                    name,
                    COUNT(*)::INT AS value,
                    SUM(CASE WHEN has_service_mapping THEN 1 ELSE 0 END)::INT AS mapped,
                    SUM(CASE WHEN has_service_mapping = FALSE THEN 1 ELSE 0 END)::INT AS unmapped
                FROM builder
                WHERE name IN ('Spiral 6', 'Spiral 7')
                GROUP BY name
                ORDER BY CASE name
                    WHEN 'Spiral 6' THEN 1
                    WHEN 'Spiral 7' THEN 2
                    ELSE 99
                END
            `),
            selectOne(getPool(), `
                WITH latest_import AS (
                    SELECT
                        target_key,
                        source_name,
                        created_at,
                        row_count,
                        (inserted_count + updated_count)::INT AS change_count
                    FROM data.c3_entity_import_run
                    WHERE is_dry_run = FALSE
                    ORDER BY created_at DESC
                    LIMIT 1
                ),
                mapping_sync AS (
                    SELECT
                        MAX(synced_at) AS latest_sync_at,
                        COUNT(*) FILTER (WHERE synced_at IS NULL)::INT AS unsynced_mapping_count
                    FROM data.service_c3_mapping
                )
                SELECT
                    (SELECT target_key FROM latest_import) AS latest_import_target,
                    (SELECT source_name FROM latest_import) AS latest_import_source,
                    (SELECT created_at FROM latest_import) AS latest_import_at,
                    COALESCE((SELECT row_count FROM latest_import), 0)::INT AS latest_import_row_count,
                    COALESCE((SELECT change_count FROM latest_import), 0)::INT AS latest_import_change_count,
                    (SELECT latest_sync_at FROM mapping_sync) AS latest_sync_at,
                    COALESCE((SELECT unsynced_mapping_count FROM mapping_sync), 0)::INT AS unsynced_mapping_count,
                    COALESCE((
                        SELECT COUNT(*)::INT
                        FROM data.service_c3_mapping scm
                        WHERE EXISTS (
                            SELECT 1
                            FROM latest_import li
                            WHERE scm.synced_at IS NULL OR scm.synced_at < li.created_at
                        )
                    ), 0)::INT AS stale_mapping_count
            `),
            selectRows(getPool(), `
                SELECT 'Capability -> Service' AS name, COUNT(*)::INT AS value
                FROM data.c3_capability_c3_service_link
                UNION ALL
                SELECT 'Capability -> Application' AS name, COUNT(*)::INT AS value
                FROM data.c3_capability_application_link
                UNION ALL
                SELECT 'Capability -> Data Object' AS name, COUNT(*)::INT AS value
                FROM data.c3_capability_data_object_link
                UNION ALL
                SELECT 'Capability -> TIN' AS name, COUNT(*)::INT AS value
                FROM data.c3_capability_tin_link
            `),
            selectRows(getPool(), `
                SELECT 'Missing source / provenance metadata' AS name, (
                    COALESCE((
                        SELECT COUNT(*)::INT
                        FROM data.c3_taxonomy
                        WHERE COALESCE(NULLIF(BTRIM(data_source), ''), NULLIF(BTRIM(source_external_id), ''), NULLIF(BTRIM(external_id), '')) IS NULL
                    ), 0)
                    + COALESCE((
                        SELECT COUNT(*)::INT
                        FROM data.c3_application
                        WHERE COALESCE(NULLIF(BTRIM(data_source), ''), NULLIF(BTRIM(external_id), '')) IS NULL
                    ), 0)
                    + COALESCE((
                        SELECT COUNT(*)::INT
                        FROM data.c3_service
                        WHERE COALESCE(NULLIF(BTRIM(data_source), ''), NULLIF(BTRIM(external_id), '')) IS NULL
                    ), 0)
                    + COALESCE((
                        SELECT COUNT(*)::INT
                        FROM data.c3_data_object
                        WHERE COALESCE(NULLIF(BTRIM(provenance_raw), ''), NULLIF(BTRIM(references_raw), ''), NULLIF(BTRIM(standards_raw), '')) IS NULL
                    ), 0)
                )::INT AS value
                UNION ALL
                SELECT 'Missing status metadata' AS name, COUNT(*)::INT AS value
                FROM (
                    SELECT item_status, ss_overall_status, ss_baseline_status FROM data.c3_taxonomy
                    UNION ALL
                    SELECT item_status, ss_overall_status, ss_baseline_status FROM data.c3_application
                    UNION ALL
                    SELECT item_status, ss_overall_status, ss_baseline_status FROM data.c3_data_object
                    UNION ALL
                    SELECT item_status, ss_overall_status, ss_baseline_status FROM data.c3_service
                    UNION ALL
                    SELECT item_status, ss_overall_status, ss_baseline_status FROM data.c3_technology_interaction
                ) status_meta
                WHERE COALESCE(NULLIF(BTRIM(item_status), ''), NULLIF(BTRIM(ss_overall_status), ''), NULLIF(BTRIM(ss_baseline_status), '')) IS NULL
                UNION ALL
                SELECT 'Missing review metadata (TI)' AS name, COUNT(*)::INT AS value
                FROM data.c3_technology_interaction
                WHERE NULLIF(BTRIM(ciav_review_status), '') IS NULL
                   OR NULLIF(BTRIM(mcsma_review_status), '') IS NULL
            `),
        ]);

        let boardLaneResult = [];
        try {
            boardLaneResult = await selectRows(getPool(), `
                WITH counts AS (
                    SELECT board_state, COUNT(*)::INT AS value
                    FROM data.v_c3_board_lane
                    GROUP BY board_state
                ),
                cards AS (
                    SELECT
                        board_state,
                        uuid,
                        title,
                        item_type,
                        validation_status,
                        ROW_NUMBER() OVER (
                            PARTITION BY board_state
                            ORDER BY updated_at DESC NULLS LAST, title ASC NULLS LAST, uuid ASC
                        ) AS rn
                    FROM data.v_c3_board_lane
                )
                SELECT
                    state.board_state,
                    COALESCE(counts.value, 0)::INT AS value,
                    COALESCE(
                        JSONB_AGG(
                            JSONB_BUILD_OBJECT(
                                'uuid', cards.uuid,
                                'title', cards.title,
                                'item_type', cards.item_type,
                                'validation_status', cards.validation_status
                            )
                            ORDER BY cards.rn
                        ) FILTER (WHERE cards.uuid IS NOT NULL),
                        '[]'::jsonb
                    ) AS cards
                FROM (
                    VALUES
                        ('imported'::text),
                        ('validated'::text),
                        ('mapped'::text),
                        ('used'::text),
                        ('reviewed'::text)
                ) AS state(board_state)
                LEFT JOIN counts ON counts.board_state = state.board_state
                LEFT JOIN cards ON cards.board_state = state.board_state AND cards.rn <= 4
                GROUP BY state.board_state, counts.value
                ORDER BY CASE state.board_state
                    WHEN 'imported' THEN 1
                    WHEN 'validated' THEN 2
                    WHEN 'mapped' THEN 3
                    WHEN 'used' THEN 4
                    WHEN 'reviewed' THEN 5
                    ELSE 99
                END
            `);
        } catch (boardLaneErr) {
            logger.error(`C3 dashboard: board lanes unavailable: ${boardLaneErr.message}`);
            boardLaneResult = [];
        }

        const payload = {
            summary: summaryResult ?? null,
            by_status: byStatusResult,
            by_type: byTypeResult,
            by_application: byApplicationResult,
            top_parents: topParentsResult,
            needs_mapping: needsMappingResult,
            most_mapped: mostMappedResult,
            coverage_by_application: coverageResult,
            by_sync_status: syncStatusResult,
            capability_map_health: capabilityMapHealthResult ?? { total_nodes: 0, mapped_nodes: 0, unmapped_nodes: 0 },
            spiral_coverage: spiralCoverageResult,
            import_sync_drift: importSyncDriftResult ?? {
                latest_import_target: null,
                latest_import_source: null,
                latest_import_at: null,
                latest_import_row_count: 0,
                latest_import_change_count: 0,
                latest_sync_at: null,
                stale_mapping_count: 0,
                unsynced_mapping_count: 0,
            },
            link_health: linkHealthResult,
            review_validation: reviewValidationResult,
            board_lanes: boardLaneResult,
        };
        cache.set(cacheKey, payload, config.cache.c3DashboardTtl);
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/c3/capability-map', requireAuth, async (req, res, next) => {
    try {
        const payload = await buildCapabilityMapPayload();
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/c3/capability-map-spiral7', requireAuth, async (req, res, next) => {
    try {
        const payload = await buildCapabilityMapPayload();
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/c3/capability-map-spiral6', requireAuth, async (req, res, next) => {
    try {
        const pageTitle = await getCapabilityMapTitle('Spiral_6');
        const payload = await buildCapabilityMapPayloadBySpiral('Spiral_6', pageTitle);
        res.json(payload);
    } catch (err) { next(err); }
});

router.get(/^\/c3\/capability-map-spiral(\d+)$/, requireAuth, async (req, res, next) => {
    try {
        const spiral = normalizeSpiralCode(req.params[0]);
        const pageTitle = await getCapabilityMapTitle(spiral);
        const payload = await buildCapabilityMapPayloadBySpiral(spiral, pageTitle);
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/c3-capability-builder/domains', requireAuth, async (req, res, next) => {
    try {
        const domains = await listCapabilityBuilderDomains();
        res.json(domains);
    } catch (err) { next(err); }
});

module.exports = router;
