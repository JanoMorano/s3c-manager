'use strict';

/**
 * Saved graph node positions per view (41_graph_node_layout.sql).
 *
 * view_key names one graph view, e.g. 'service-overview/portfolio',
 * 'service-overview/dependency', 'service/SVC-001' or 'c3-relations';
 * node_id is the graph node id ('svc:SVC-001', 'c3:<uuid>', …).
 */

const { getPool } = require('./pool');

// Service overview positions stored before per-view layouts (former graph_x/graph_y).
const SERVICE_OVERVIEW_VIEW = 'service-overview/portfolio';

const VIEW_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,119}$/;
const NODE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:/>-]{0,199}$/;
const MAX_POSITIONS = 2000;

// Audit node_kind: 'service' for service nodes, otherwise the node id prefix.
const NODE_KIND_SQL = (column) => `CASE WHEN ${column} LIKE 'svc:%' THEN 'service' ELSE left(split_part(${column}, ':', 1), 30) END`;

function isValidViewKey(viewKey) {
    return typeof viewKey === 'string' && VIEW_KEY_PATTERN.test(viewKey);
}

/** Keeps well-formed positions ({ node_id, x, y } with finite numbers), last one per node wins. */
function normalizePositions(positions) {
    if (!Array.isArray(positions)) return null;
    const byNode = new Map();
    positions.forEach((position) => {
        if (!position || typeof position.node_id !== 'string' || !NODE_ID_PATTERN.test(position.node_id)) return;
        const x = Number(position.x);
        const y = Number(position.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        byNode.set(position.node_id, { node_id: position.node_id, x, y });
    });
    return [...byNode.values()].slice(0, MAX_POSITIONS);
}

async function getLayout(viewKey, pool = getPool()) {
    const result = await pool.query(`
        SELECT node_id, x, y, updated_by, updated_at
        FROM data.graph_node_layout
        WHERE view_key = $1
        ORDER BY node_id
    `, [viewKey]);
    return result.rows;
}

/** Upserts positions of one view and audits every changed node. Returns the number of saved nodes. */
async function saveLayout(viewKey, positions, changedBy, pool = getPool()) {
    if (positions.length === 0) return 0;
    // One statement: data-modifying CTEs see the same snapshot, so the audit
    // records the positions before this save.
    await pool.query(`
            WITH input AS (
                SELECT node_id, x, y
                FROM jsonb_to_recordset($2::jsonb) AS p(node_id varchar, x double precision, y double precision)
            ),
            previous AS (
                SELECT i.node_id, l.x AS old_x, l.y AS old_y, i.x AS new_x, i.y AS new_y
                FROM input i
                LEFT JOIN data.graph_node_layout l ON l.view_key = $1 AND l.node_id = i.node_id
                WHERE l.x IS DISTINCT FROM i.x OR l.y IS DISTINCT FROM i.y
            ),
            audit AS (
                INSERT INTO data.graph_layout_audit (service_id, node_kind, view_key, node_id, old_x, old_y, new_x, new_y, changed_by)
                SELECT sc.id, ${NODE_KIND_SQL('p.node_id')}, $1, p.node_id, p.old_x, p.old_y, p.new_x, p.new_y, $3
                FROM previous p
                LEFT JOIN data.service_catalog sc
                  ON p.node_id LIKE 'svc:%' AND sc.service_id = substr(p.node_id, 5)
            )
            INSERT INTO data.graph_node_layout (view_key, node_id, x, y, updated_by, updated_at)
            SELECT $1, node_id, x, y, $3, CURRENT_TIMESTAMP
            FROM input
            ON CONFLICT (view_key, node_id) DO UPDATE SET
                x = EXCLUDED.x,
                y = EXCLUDED.y,
                updated_by = EXCLUDED.updated_by,
                updated_at = EXCLUDED.updated_at
            WHERE data.graph_node_layout.x IS DISTINCT FROM EXCLUDED.x
               OR data.graph_node_layout.y IS DISTINCT FROM EXCLUDED.y
        `, [viewKey, JSON.stringify(positions), changedBy || 'system']);
    return positions.length;
}

/** Removes the saved positions of a view (back to the automatic layout). */
async function resetLayout(viewKey, changedBy, pool = getPool()) {
    const result = await pool.query(`
        WITH removed AS (
            DELETE FROM data.graph_node_layout
            WHERE view_key = $1
            RETURNING node_id, x, y
        )
        INSERT INTO data.graph_layout_audit (service_id, node_kind, view_key, node_id, old_x, old_y, new_x, new_y, changed_by)
        SELECT sc.id, ${NODE_KIND_SQL('r.node_id')}, $1, r.node_id, r.x, r.y, NULL, NULL, $2
        FROM removed r
        LEFT JOIN data.service_catalog sc
          ON r.node_id LIKE 'svc:%' AND sc.service_id = substr(r.node_id, 5)
    `, [viewKey, changedBy || 'system']);
    return result.rowCount;
}

module.exports = {
    SERVICE_OVERVIEW_VIEW,
    isValidViewKey,
    normalizePositions,
    getLayout,
    saveLayout,
    resetLayout,
};
