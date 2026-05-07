'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { canAdmin } = require('../middleware/rbac');
const { getPool, getPlatformPool } = require('../db/pool');
const { findAllForExport } = require('../db/services.repo');
const { applyCacheTags } = require('../utils/cache-tags');
const { generateBackstageCatalogInfo } = require('../utils/backstage-catalog');

router.use(requireAuth);

const KEPT_EXPORT_ENDPOINTS = new Set([
    '/api/v1/export/bundle',
    '/api/v1/export/manifest',
    '/api/v1/export/governance-report',
    '/api/v1/export/capability-map-hierarchy',
    '/api/v1/export/c3-relationships',
    '/api/v1/export/capabilities/coverage',
    '/api/v1/export/backstage/catalog-info',
]);

function isKeptExportRoute(row) {
    return KEPT_EXPORT_ENDPOINTS.has(row?.export_endpoint) || KEPT_EXPORT_ENDPOINTS.has(row?.canonical_path);
}

function filterKeptExportRoutes(rows) {
    return rows.filter(isKeptExportRoute);
}

router.get('/manifest', async (req, res, next) => {
    try {
        const scope = String(req.query.scope || 'bundle').toLowerCase();
        applyCacheTags(res, ['export', 'routes'], [`export:manifest:${scope}`, 'export:manifest']);
        const [manifest, routes] = await Promise.all([
            getPlatformPool().query(`
                SELECT *
                FROM platform.v_export_bundle_manifest
                ORDER BY updated_at DESC
                LIMIT 1
            `),
            getPlatformPool().query(`
                SELECT route_key, feature_area, canonical_path, export_endpoint
                FROM platform.v_canonical_route_metadata
                WHERE feature_area IN ('export', 'c3', 'pricing', 'sla', 'service', 'import')
                ORDER BY feature_area, route_key
            `),
        ]);
        res.json({
            ...(manifest.rows[0] ?? {}),
            scope,
            routes: filterKeptExportRoutes(routes.rows),
        });
    } catch (err) { next(err); }
});

router.get('/capability-map-hierarchy', async (req, res, next) => {
    try {
        applyCacheTags(res, ['export', 'c3'], ['export:capability-map']);
        const result = await getPool().query(`
            SELECT * FROM data.v_c3capabilitymaphierarchyexport
            ORDER BY item_type, parent_title, order_num, title
        `);
        res.json(result.rows);
    } catch (err) { next(err); }
});

router.get('/c3-relationships', async (req, res, next) => {
    try {
        applyCacheTags(res, ['export', 'c3', 'graphC3'], ['export:c3-relationships']);
        const result = await getPool().query(`
            SELECT * FROM data.v_c3relationshipexport
            ORDER BY edge_kind, source_label, target_label
        `);
        res.json(result.rows);
    } catch (err) { next(err); }
});

router.get('/capabilities/coverage', async (req, res, next) => {
    try {
        applyCacheTags(res, ['export', 'capabilities'], ['export:capability-coverage']);
        const result = await getPool().query(`
            SELECT *
            FROM data.v_capability_governance_coverage
            ORDER BY capability_title
        `);
        res.json({ exported_at: new Date().toISOString(), items: result.rows });
    } catch (err) { next(err); }
});

router.get('/governance-report', async (req, res, next) => {
    try {
        applyCacheTags(res, ['export', 'governance', 'portfolio', 'readiness', 'capabilities'], ['export:governance-report']);
        const [portfolios, readiness, coverage, decisions] = await Promise.all([
            getPool().query('SELECT * FROM data.service_portfolio ORDER BY portfolio_code'),
            getPool().query('SELECT * FROM data.v_servicepublishreadiness ORDER BY service_id'),
            getPool().query('SELECT * FROM data.v_capability_governance_coverage ORDER BY capability_title'),
            getPool().query(`
                SELECT gd.*, sc.service_id, sc.title AS service_title
                FROM data.governance_decision gd
                JOIN data.service_catalog sc ON sc.id = gd.service_id
                WHERE sc.is_deleted = FALSE
                ORDER BY gd.decided_at DESC, gd.id DESC
            `),
        ]);
        res.json({
            profile_key: 's3c-governance-report',
            exported_at: new Date().toISOString(),
            portfolios: portfolios.rows,
            readiness: readiness.rows,
            capability_coverage: coverage.rows,
            decisions: decisions.rows,
        });
    } catch (err) { next(err); }
});

router.get('/backstage/catalog-info', async (req, res, next) => {
    try {
        applyCacheTags(res, ['export', 'service'], ['export:backstage-catalog-info']);
        const services = await findAllForExport();
        res.type('text/yaml').send(generateBackstageCatalogInfo(services));
    } catch (err) { next(err); }
});

// SECURITY: full bundle export is admin-only — contains audit trails and internal data.
router.get('/bundle', canAdmin, async (req, res, next) => {
    try {
        applyCacheTags(res, ['export', 'pricing', 'sla', 'c3', 'routes', 'import'], ['export:bundle']);
        const [manifest, routeMetadata, services, taxonomy, capabilityMapHierarchy, c3Relationships, graph, pricing, sla, importBatches, importRows, importIssues, retentionPolicies, taxonomyAudit, graphAudit] = await Promise.all([
            getPlatformPool().query(`SELECT * FROM platform.v_export_bundle_manifest ORDER BY updated_at DESC LIMIT 1`),
            getPlatformPool().query(`SELECT * FROM platform.v_canonical_route_metadata ORDER BY feature_area, route_key`),
            findAllForExport(),
            getPool().query(`SELECT * FROM data.v_taxonomyexport ORDER BY order_num, title`),
            getPool().query(`SELECT * FROM data.v_c3capabilitymaphierarchyexport ORDER BY item_type, parent_title, order_num, title`),
            getPool().query(`SELECT * FROM data.v_c3relationshipexport ORDER BY edge_kind, source_label, target_label`),
            getPool().query(`SELECT * FROM data.v_graphoverviewnodes ORDER BY portfolio_group, service_id`),
            getPool().query(`SELECT * FROM data.v_pricingexport ORDER BY service_id, display_order, flavour_code`),
            getPool().query(`SELECT * FROM data.v_slaexport ORDER BY service_id, flavour_code, sla_pk`),
            getPool().query(`SELECT * FROM data.v_importbatchexport ORDER BY imported_at DESC`),
            getPool().query(`SELECT * FROM data.v_importrowexport ORDER BY batch_imported_at DESC, row_number ASC`),
            getPool().query(`SELECT * FROM data.v_importissueexport ORDER BY batch_imported_at DESC, created_at DESC`),
            getPool().query(`SELECT * FROM data.v_auditretentionpolicy ORDER BY policy_key`),
            getPool().query(`SELECT * FROM data.taxonomy_mapping_audit ORDER BY changed_at DESC`),
            getPool().query(`SELECT * FROM data.graph_layout_audit ORDER BY changed_at DESC`),
        ]);

        const payload = {
            contract_version: manifest.rows[0]?.contract_version ?? '2026-03-30.c3-v3',
            schema_version: manifest.rows[0]?.schema_version ?? 'canonical-23',
            exported_at: new Date().toISOString(),
            manifest: manifest.rows[0] ?? null,
            canonical_routes: filterKeptExportRoutes(routeMetadata.rows),
            services,
            taxonomy: taxonomy.rows,
            capability_map_hierarchy: capabilityMapHierarchy.rows,
            c3_relationships: c3Relationships.rows,
            graph_nodes: graph.rows,
            pricing: pricing.rows,
            sla: sla.rows,
            import_batches: importBatches.rows,
            import_rows: importRows.rows,
            import_issues: importIssues.rows,
            retention_policies: retentionPolicies.rows,
            taxonomy_mapping_audit: taxonomyAudit.rows,
            graph_layout_audit: graphAudit.rows,
        };

        await getPlatformPool().query(`
            INSERT INTO platform.export_bundle_audit
                (bundle_key, contract_version, schema_version, requested_by, requested_ip, record_counts_json)
            VALUES
                ($1, $2, $3, $4, $5, $6)
        `, [
            manifest.rows[0]?.bundle_key ?? 'service_catalog_bundle',
            payload.contract_version,
            payload.schema_version,
            req.user?.username ?? 'system',
            req.ip ?? null,
            JSON.stringify({
                services: Array.isArray(services) ? services.length : 0,
                taxonomy: taxonomy.rows.length,
                capability_map_hierarchy: capabilityMapHierarchy.rows.length,
                c3_relationships: c3Relationships.rows.length,
                graph_nodes: graph.rows.length,
                pricing: pricing.rows.length,
                sla: sla.rows.length,
                import_batches: importBatches.rows.length,
                import_rows: importRows.rows.length,
                import_issues: importIssues.rows.length,
            }),
        ]);

        res.json(payload);
    } catch (err) { next(err); }
});

module.exports = router;
