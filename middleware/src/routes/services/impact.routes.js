'use strict';

/** Impact analysis over service relations. */

const express = require('express');
const { SERVICE_STATUS_SQL, PORTFOLIO_JOIN, PRIMARY_SLA_JOIN } = require('../../db/service-fields');
const { getPool } = require('../../db/pool');

const router = express.Router();

// ─── GET /services/:id/impact ─────────────────────────────────────────────────
// Impact BFS (directed, reverse): who depends on the selected service?
// If X fails, which services are impacted?
// Traversal recursively follows incoming edges (from_service_id where to = X.id).
// Query param: ?depth=N (default 5, max 10) limits BFS depth.
// Response: { root, nodes[], edges[], depth_reached }
router.get('/:id/impact', async (req, res, next) => {
    try {
        const serviceId  = req.params.id;
        const maxDepth   = Math.min(10, parseInt(req.query.depth) || 5);
        const pool       = getPool();

        // Verify that the root service exists.
        const rootCheck = await pool.query(`
                SELECT sc.service_id, sc.title,
                       sc.service_type_code   AS service_type,
                       ${SERVICE_STATUS_SQL} AS service_status,
                       sp.portfolio_code AS portfolio_group
                FROM data.service_catalog sc
                ${PORTFOLIO_JOIN}
                WHERE sc.service_id = $1 AND sc.is_deleted = FALSE
            `, [serviceId]);
        if (!rootCheck.rows.length) {
            return res.status(404).json({ error: 'Služba nenalezena' });
        }

        // Directed reverse BFS: follow incoming edges (who depends on me).
        const visited     = new Set([serviceId]);
        let   frontier    = [serviceId];
        let   depthReached = 0;
        const collectedEdges = [];

        for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
            depthReached = depth + 1;
            // Find who (from_service_id) depends on anything from the current frontier (to_service_id).
            const edgeResult = await pool.query(`
                SELECT f.service_id AS from_sid,
                       t.service_id AS to_sid,
                       sr.relation_type_code AS relation_type,
                       sr.impact_level
                FROM data.service_relation sr
                JOIN data.service_catalog f ON f.id = sr.from_service_id AND f.is_deleted = FALSE
                JOIN data.service_catalog t ON t.id = sr.to_service_id   AND t.is_deleted = FALSE
                WHERE sr.is_deleted = FALSE
                  AND t.service_id = ANY($1::varchar[])
            `, [frontier]);

            frontier = [];
            for (const row of edgeResult.rows) {
                collectedEdges.push(row);
                if (!visited.has(row.from_sid)) {
                    visited.add(row.from_sid);
                    frontier.push(row.from_sid);
                }
            }
        }

        // Fetch node details for all visited nodes
        const impactedIds = [...visited].filter(id => id !== serviceId);
        let   nodes       = [];

        if (impactedIds.length > 0) {
            const nodesResult = await pool.query(`
                SELECT sc.service_id, sc.title,
                       sc.service_type_code    AS service_type,
                       ${SERVICE_STATUS_SQL}  AS service_status,
                       sp.portfolio_code AS portfolio_group,
                       sla.availability_pct AS sla_availability
                FROM data.service_catalog sc
                ${PORTFOLIO_JOIN}
                ${PRIMARY_SLA_JOIN}
                WHERE sc.service_id = ANY($1::varchar[])
                  AND sc.is_deleted = FALSE
            `, [impactedIds]);
            nodes = nodesResult.rows;
        }

        res.json({
            root:          rootCheck.rows[0],
            nodes,
            edges:         collectedEdges,
            depth_reached: depthReached,
            total_impacted: nodes.length,
        });
    } catch (err) { next(err); }
});

module.exports = router;
