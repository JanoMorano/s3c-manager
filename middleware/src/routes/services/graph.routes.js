'use strict';

/** Graph of one service (services, offerings, C3 capabilities and entities). */

const express = require('express');
const { listC3EntityLinks, linkTargetNode, linkEdge } = require('../../db/c3-entity-links.repo');
const {
    SERVICE_STATUS_SQL,
    PORTFOLIO_JOIN,
    PRIMARY_SLA_JOIN,
    OVERVIEW_LAYOUT_JOIN,
} = require('../../db/service-fields');
const { getServiceReadiness } = require('../../services/readiness');
const { getPool } = require('../../db/pool');
const logger = require('../../utils/logger');

const router = express.Router();

// ─── GET /services/:id/graph ──────────────────────────────────────────────────
// BFS through ServiceRelation. from/to_service_id are BIGINT FKs to ServiceCatalog.id.
// The API works with string business keys (service_id); BFS joins through ServiceCatalog.
router.get('/:id/graph', async (req, res, next) => {
    try {
        const rootId = req.params.id;
        const depth  = Math.min(3, Math.max(1, parseInt(req.query.depth || '2')));
        const mode = String(req.query.mode ?? 'legacy').trim().toLowerCase();
        const pool   = getPool();

        // ── BFS through ServiceRelation (string business keys through JOIN) ───
        const visited = new Set([rootId]);
        let frontier  = [rootId];

        for (let d = 0; d < depth && frontier.length > 0; d++) {
            // JOIN through ServiceCatalog to convert BIGINT FK → string service_id.
            const relResult = await pool.query(`
                SELECT f.service_id AS a, t.service_id AS b
                FROM data.service_relation sr
                JOIN data.service_catalog f ON f.id = sr.from_service_id AND f.is_deleted = FALSE
                JOIN data.service_catalog t ON t.id = sr.to_service_id   AND t.is_deleted = FALSE
                WHERE sr.is_deleted = FALSE
                  AND (f.service_id = ANY($1::varchar[])
                    OR t.service_id = ANY($1::varchar[]))
            `, [frontier]);

            frontier = [];
            for (const row of relResult.rows) {
                for (const nid of [row.a, row.b]) {
                    if (nid != null && !visited.has(nid)) {
                        visited.add(nid);
                        frontier.push(nid);
                    }
                }
            }
        }

        const nodeIds = [...visited];
        const serviceNodesResult = await pool.query(`
            SELECT sc.service_id, sc.title,
                   sc.service_type_code   AS service_type,
                   ${SERVICE_STATUS_SQL} AS service_status,
                   sp.portfolio_code AS portfolio_group,
                   sla.availability_pct AS sla_availability, gl.x AS graph_x, gl.y AS graph_y
            FROM data.service_catalog sc
            ${PORTFOLIO_JOIN}
            ${PRIMARY_SLA_JOIN}
            ${OVERVIEW_LAYOUT_JOIN}
            WHERE sc.service_id = ANY($1::varchar[])
              AND sc.is_deleted = FALSE
        `, [nodeIds]);

        if (serviceNodesResult.rows.length === 0) {
            return res.status(404).json({ error: 'Služba nenalezena' });
        }

        const serviceEdgesResult = await pool.query(`
            SELECT f.service_id AS from_service_id, t.service_id AS to_service_id,
                   sr.relation_type_code AS relation_type, sr.relation_label,
                   sr.is_mandatory, sr.impact_level, sr.pace_code,
                   sr.is_verified, sr.parse_confidence, sr.relation_note
            FROM data.service_relation sr
            JOIN data.service_catalog f ON f.id = sr.from_service_id AND f.is_deleted = FALSE
            JOIN data.service_catalog t ON t.id = sr.to_service_id   AND t.is_deleted = FALSE
            WHERE sr.is_deleted = FALSE
              AND f.service_id = ANY($1::varchar[])
              AND t.service_id = ANY($1::varchar[])
        `, [nodeIds]);

        if (mode !== 'v2') {
            return res.json({
                nodes: serviceNodesResult.rows,
                edges: serviceEdgesResult.rows,
            });
        }

        const mappingResult = await pool.query(`
            SELECT
                scm.id,
                sc.service_id,
                scm.c3_uuid,
                scm.mapping_type_code,
                scm.is_primary,
                scm.mapping_note,
                scm.pace_code,
                cap.title AS c3_title,
                cap.external_id AS c3_code,
                cap.item_type,
                cap.item_status,
                comp.completeness_status
            FROM data.service_c3_mapping scm
            JOIN data.service_catalog sc
              ON sc.id = scm.service_id
             AND sc.is_deleted = FALSE
            LEFT JOIN data.c3_taxonomy cap
              ON cap.uuid = scm.c3_uuid
            LEFT JOIN data.v_c3capabilitycompleteness comp
              ON comp.uuid = scm.c3_uuid
            WHERE sc.service_id = ANY($1::varchar[])
        `, [nodeIds]);

        const flavourResult = await pool.query(`
            SELECT
                sf.id,
                sc.service_id,
                sf.flavour_code,
                sf.title,
                sf.price_value,
                sf.currency_code,
                sf.flavour_status_code
            FROM data.service_flavour sf
            JOIN data.service_catalog sc
              ON sc.id = sf.service_id
             AND sc.is_deleted = FALSE
            WHERE sc.service_id = ANY($1::varchar[])
              AND sf.is_deleted = FALSE
        `, [nodeIds]);

        const capabilityUuids = [...new Set(mappingResult.rows.map((row) => row.c3_uuid).filter(Boolean))];
        const c3Links = await listC3EntityLinks(pool, { capabilityUuids });

        let readiness = null;
        try {
            readiness = await getServiceReadiness(rootId);
        } catch (readinessErr) {
            logger.warn(`service graph: readiness context unavailable for ${rootId}: ${readinessErr.message}`);
        }
        const nodeMap = new Map();

        const upsertNode = (node) => {
            if (!nodeMap.has(node.id)) nodeMap.set(node.id, node);
        };

        serviceNodesResult.rows.forEach((row) => {
            upsertNode({
                id: `svc:${row.service_id}`,
                node_kind: 'service',
                label: row.title,
                code: row.service_id,
                status: row.service_status,
                service_id: row.service_id,
                service_type: row.service_type,
                portfolio_group: row.portfolio_group,
                graph_x: row.graph_x,
                graph_y: row.graph_y,
                is_root: row.service_id === rootId,
            });
        });

        flavourResult.rows.forEach((row) => {
            upsertNode({
                id: `flv:${row.id}`,
                node_kind: 'flavour',
                label: row.title || row.flavour_code,
                code: row.flavour_code,
                status: row.flavour_status_code,
                service_id: row.service_id,
                price_label: row.price_value != null ? `${row.price_value} ${row.currency_code ?? ''}`.trim() : null,
            });
        });

        mappingResult.rows.forEach((row) => {
            upsertNode({
                id: `c3:${row.c3_uuid}`,
                node_kind: 'c3_capability',
                label: row.c3_title || row.c3_code || row.c3_uuid,
                code: row.c3_code || row.c3_uuid,
                status: row.item_status,
                c3_uuid: row.c3_uuid,
                item_type: row.item_type,
                completeness_status: row.completeness_status || 'incomplete',
            });
        });

        c3Links.forEach((link) => upsertNode(linkTargetNode(link)));

        const edges = [
            ...serviceEdgesResult.rows.map((edge, index) => ({
                id: `svc-rel:${index}:${edge.from_service_id}:${edge.to_service_id}:${edge.relation_type}`,
                source: `svc:${edge.from_service_id}`,
                target: `svc:${edge.to_service_id}`,
                edge_kind: 'service_relation',
                relation_type: edge.relation_type,
                relation_label: edge.relation_label,
                is_mandatory: edge.is_mandatory,
                impact_level: edge.impact_level,
                pace_code: edge.pace_code,
                is_verified: edge.is_verified,
                parse_confidence: edge.parse_confidence,
                relation_note: edge.relation_note,
            })),
            ...flavourResult.rows.map((row) => ({
                id: `svc-flv:${row.service_id}:${row.id}`,
                source: `svc:${row.service_id}`,
                target: `flv:${row.id}`,
                edge_kind: 'service_flavour',
                relation_type: 'service_flavour',
                relation_label: row.flavour_code,
            })),
            ...mappingResult.rows.map((row) => ({
                id: `svc-c3:${row.service_id}:${row.id}`,
                source: `svc:${row.service_id}`,
                target: `c3:${row.c3_uuid}`,
                edge_kind: 'service_c3_mapping',
                relation_type: row.mapping_type_code,
                relation_label: row.mapping_note,
                is_primary: Boolean(row.is_primary),
                pace_code: row.pace_code,
            })),
            ...c3Links.map(linkEdge),
        ];

        res.json({
            mode: 'v2',
            root_service_id: rootId,
            readiness,
            nodes: [...nodeMap.values()],
            edges,
        });
    } catch (err) { next(err); }
});

module.exports = router;
