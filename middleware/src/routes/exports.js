'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getPool, getPlatformPool } = require('../db/pool');
const { findAllForExport } = require('../db/services.repo');
const { applyCacheTags } = require('../utils/cache-tags');

router.use(requireAuth);

router.get('/route-metadata', async (req, res, next) => {
    try {
        applyCacheTags(res, ['export', 'routes'], ['export:routes']);
        const result = await getPlatformPool().query(`
            SELECT route_key, feature_area, canonical_path, legacy_paths_json, route_kind, export_endpoint
            FROM platform.v_canonical_route_metadata
            ORDER BY feature_area, route_key
        `);
        res.json(result.rows);
    } catch (err) { next(err); }
});

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
            routes: routes.rows,
        });
    } catch (err) { next(err); }
});

router.get('/taxonomy', async (req, res, next) => {
    try {
        applyCacheTags(res, ['export', 'c3'], ['export:taxonomy']);
        const result = await getPool().query(`SELECT * FROM data.v_taxonomyexport ORDER BY order_num, title`);
        res.json(result.rows);
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

router.get('/graph-overview', async (req, res, next) => {
    try {
        applyCacheTags(res, ['export', 'graph', 'domains'], ['export:graph']);
        const [nodes, relations, mappings] = await Promise.all([
            getPool().query(`SELECT * FROM data.v_graphoverviewnodes ORDER BY portfolio_group, service_id`),
            getPool().query(`
                SELECT
                    f.service_id AS from_service_id,
                    t.service_id AS to_service_id,
                    sr.relation_type_code,
                    sr.relation_label,
                    sr.is_mandatory,
                    sr.impact_level,
                    sr.pace_code,
                    sr.is_verified,
                    sr.parse_confidence,
                    sr.relation_note
                FROM data.service_relation sr
                JOIN data.service_catalog f ON f.id = sr.from_service_id AND f.is_deleted = FALSE
                JOIN data.service_catalog t ON t.id = sr.to_service_id AND t.is_deleted = FALSE
                WHERE sr.is_deleted = FALSE
            `),
            getPool().query(`
                SELECT sc.service_id, scm.c3_uuid, scm.mapping_type_code, scm.is_primary, scm.sync_status
                FROM data.service_c3_mapping scm
                JOIN data.service_catalog sc ON sc.id = scm.service_id AND sc.is_deleted = FALSE
            `),
        ]);
        res.json({
            nodes: nodes.rows,
            service_relations: relations.rows,
            taxonomy_mappings: mappings.rows,
        });
    } catch (err) { next(err); }
});

router.get('/pricing', async (req, res, next) => {
    try {
        applyCacheTags(res, ['export', 'pricing'], ['export:pricing']);
        const result = await getPool().query(`SELECT * FROM data.v_pricingexport ORDER BY service_id, display_order, flavour_code`);
        res.json(result.rows);
    } catch (err) { next(err); }
});

router.get('/sla', async (req, res, next) => {
    try {
        applyCacheTags(res, ['export', 'sla'], ['export:sla']);
        const result = await getPool().query(`SELECT * FROM data.v_slaexport ORDER BY service_id, flavour_code, sla_pk`);
        res.json(result.rows);
    } catch (err) { next(err); }
});

router.get('/archive-audit-reporting', async (req, res, next) => {
    try {
        applyCacheTags(res, ['export', 'import'], ['export:archive-audit']);
        const [batchArchive, rowArchive, issueArchive, taxonomyAuditArchive, graphAuditArchive, retentionJobs] = await Promise.all([
            getPool().query(`SELECT * FROM data.v_importbatcharchiveexport ORDER BY archived_at DESC, id DESC`),
            getPool().query(`SELECT * FROM data.v_importrowarchiveexport ORDER BY archived_at DESC, id DESC`),
            getPool().query(`SELECT * FROM data.v_importissuearchiveexport ORDER BY archived_at DESC, id DESC`),
            getPool().query(`SELECT * FROM data.v_taxonomymappingauditarchiveexport ORDER BY archived_at DESC, id DESC`),
            getPool().query(`SELECT * FROM data.v_graphlayoutauditarchiveexport ORDER BY archived_at DESC, id DESC`),
            getPool().query(`SELECT * FROM data.v_retentionjobauditexport ORDER BY started_at DESC, id DESC`),
        ]);

        res.json({
            import_batch_archive: batchArchive.rows,
            import_row_archive: rowArchive.rows,
            import_issue_archive: issueArchive.rows,
            taxonomy_mapping_audit_archive: taxonomyAuditArchive.rows,
            graph_layout_audit_archive: graphAuditArchive.rows,
            retention_job_audit: retentionJobs.rows,
        });
    } catch (err) { next(err); }
});

router.get('/bundle', async (req, res, next) => {
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
            canonical_routes: routeMetadata.rows,
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
