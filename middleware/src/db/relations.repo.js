'use strict';

const { getPool } = require('./pool');

const IMPACT_MAX_DEPTH = 10;
const IMPACT_DEFAULT_DEPTH = 3;
const IMPACT_KIND_GROUPS = {
    services: ['service'],
    capabilities: ['c3_capability'],
    c3: ['c3_capability', 'c3_application', 'c3_data_object', 'c3_tin', 'c3_service'],
    applications: ['c3_application'],
    data_objects: ['c3_data_object'],
    tins: ['c3_tin'],
    c3_services: ['c3_service'],
};

async function getCatalogId(serviceId) {
    const result = await getPool().query(`
        SELECT id
        FROM data.service_catalog
        WHERE service_id = $1
          AND is_deleted = FALSE
    `, [serviceId]);

    const id = result.rows[0]?.id ?? null;
    if (!id) {
        const err = new Error(`ServiceCatalog not found: ${serviceId}`);
        err.status = 404;
        throw err;
    }
    return id;
}

const REL_SELECT = `
    SELECT
        sr.id,
        sr.relation_type_code AS relation_type,
        sr.relation_label,
        sr.relation_note,
        sr.pace_code,
        sr.is_mandatory,
        sr.impact_mode,
        sr.impact_level,
        sr.source_field,
        sr.raw_text,
        sr.parse_confidence,
        sr.is_inferred,
        sr.is_verified,
        sr.is_deleted,
        sr.created_at,
        sr.created_by,
        f.service_id AS from_service_id,
        t.service_id AS to_service_id,
        f.title AS from_title,
        t.title AS to_title
    FROM data.service_relation sr
    JOIN data.service_catalog f ON f.id = sr.from_service_id AND f.is_deleted = FALSE
    JOIN data.service_catalog t ON t.id = sr.to_service_id AND t.is_deleted = FALSE
`;

async function findByService(serviceId) {
    const result = await getPool().query(`
        ${REL_SELECT}
        WHERE sr.is_deleted = FALSE
          AND (
            sr.from_service_id = (SELECT id FROM data.service_catalog WHERE service_id = $1 AND is_deleted = FALSE)
            OR sr.to_service_id = (SELECT id FROM data.service_catalog WHERE service_id = $1 AND is_deleted = FALSE)
          )
        ORDER BY sr.relation_type_code, f.title
    `, [serviceId]);
    return result.rows;
}

async function findAll({ serviceId, relationType } = {}) {
    const conditions = ['sr.is_deleted = FALSE'];
    const values = [];

    if (serviceId) {
        values.push(serviceId);
        const idx = values.length;
        conditions.push(`(
            sr.from_service_id = (SELECT id FROM data.service_catalog WHERE service_id = $${idx} AND is_deleted = FALSE)
            OR sr.to_service_id = (SELECT id FROM data.service_catalog WHERE service_id = $${idx} AND is_deleted = FALSE)
        )`);
    }

    if (relationType) {
        values.push(relationType);
        conditions.push(`sr.relation_type_code = $${values.length}`);
    }

    const result = await getPool().query(`
        ${REL_SELECT}
        WHERE ${conditions.join(' AND ')}
        ORDER BY f.title, sr.relation_type_code
    `, values);

    return result.rows;
}

async function findById(id) {
    const result = await getPool().query(`
        ${REL_SELECT}
        WHERE sr.id = $1
          AND sr.is_deleted = FALSE
    `, [id]);
    return result.rows[0] || null;
}

async function create(data, performedBy) {
    const [fromId, toId] = await Promise.all([
        getCatalogId(data.from_service_id),
        getCatalogId(data.to_service_id),
    ]);

    const result = await getPool().query(`
        INSERT INTO data.service_relation
            (from_service_id, to_service_id, relation_type_code, relation_label,
             pace_code, is_mandatory, impact_mode, impact_level, relation_note, created_by,
             source_field, raw_text, parse_confidence, is_inferred, is_verified)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
    `, [
        fromId,
        toId,
        data.relation_type || data.relation_type_code || 'depends_on',
        data.relation_label || null,
        data.pace_code || null,
        data.is_mandatory != null ? !!data.is_mandatory : true,
        data.impact_mode || 'hard_stop',
        data.impact_level || 'high',
        data.relation_note || null,
        performedBy,
        data.source_field || null,
        data.raw_text || null,
        data.parse_confidence ?? null,
        data.is_inferred ?? false,
        data.is_verified ?? false,
    ]);

    return result.rows[0].id;
}

async function update(id, data) {
    const fields = [];
    const values = [];

    function push(field, value) {
        values.push(value);
        fields.push(`${field} = $${values.length}`);
    }

    push('updated_at', new Date());
    push('relation_type_code', data.relation_type || data.relation_type_code || 'depends_on');
    push('relation_label', data.relation_label || null);
    push('pace_code', data.pace_code || null);
    push('is_mandatory', data.is_mandatory != null ? !!data.is_mandatory : true);
    push('impact_mode', data.impact_mode || 'hard_stop');
    push('impact_level', data.impact_level || 'high');
    push('relation_note', data.relation_note || null);

    if (data.is_verified !== undefined) {
        push('is_verified', data.is_verified);
    }

    values.push(id);
    await getPool().query(`
        UPDATE data.service_relation
        SET ${fields.join(', ')}
        WHERE id = $${values.length}
    `, values);

    return findById(id);
}

async function remove(id) {
    await getPool().query(`
        UPDATE data.service_relation
        SET is_deleted = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    `, [id]);
}

function normalizeImpactDepth(value) {
    const parsed = Number.parseInt(String(value ?? IMPACT_DEFAULT_DEPTH), 10);
    if (!Number.isFinite(parsed)) return IMPACT_DEFAULT_DEPTH;
    return Math.max(1, Math.min(IMPACT_MAX_DEPTH, parsed));
}

function normalizeImpactDirection(value) {
    return String(value ?? 'downstream').toLowerCase() === 'upstream' ? 'upstream' : 'downstream';
}

function expandImpactIncludes(include = []) {
    const requested = Array.isArray(include) ? include : [include].filter(Boolean);
    if (!requested.length || requested.includes('all')) return null;
    const kinds = new Set();
    requested.forEach((item) => {
        (IMPACT_KIND_GROUPS[item] || []).forEach((kind) => kinds.add(kind));
    });
    return kinds.size ? kinds : null;
}

function normalizeImpactOptions(options = {}) {
    return {
        direction: normalizeImpactDirection(options.direction),
        depth: normalizeImpactDepth(options.depth),
        include: Array.isArray(options.include) ? options.include.filter(Boolean) : [],
    };
}

function edgeSortKey(edge) {
    return [
        edge.relation_kind || '',
        edge.target_title || edge.target_key || edge.target_node_id || '',
        edge.source_title || edge.source_key || edge.source_node_id || '',
        edge.edge_id || '',
    ].join('|');
}

function nodeSortKey(node) {
    return [
        String(node.depth ?? 0).padStart(3, '0'),
        node.title || node.node_key || node.node_id || '',
        node.node_id || '',
    ].join('|');
}

function traverseImpactGraph(root, nodes, edges, options = {}) {
    const normalized = normalizeImpactOptions(options);
    const includeKinds = expandImpactIncludes(normalized.include);
    const nodeById = new Map((nodes || []).map((node) => [node.node_id, node]));
    const adjacency = new Map();

    (edges || []).forEach((edge) => {
        const source = normalized.direction === 'downstream' ? edge.source_node_id : edge.target_node_id;
        if (!source) return;
        if (!adjacency.has(source)) adjacency.set(source, []);
        adjacency.get(source).push(edge);
    });

    for (const edgeList of adjacency.values()) {
        edgeList.sort((left, right) => edgeSortKey(left).localeCompare(edgeSortKey(right)));
    }

    const rootNode = {
        ...root,
        depth: 0,
        path: [root.node_id],
        relation_path: [],
    };
    const visited = new Set([root.node_id]);
    const depthByNode = new Map([[root.node_id, 0]]);
    const pathByNode = new Map([[root.node_id, [root.node_id]]]);
    const relationPathByNode = new Map([[root.node_id, []]]);
    const traversalEdges = [];
    const queue = [{ nodeId: root.node_id, depth: 0 }];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || current.depth >= normalized.depth) continue;
        const edgeList = adjacency.get(current.nodeId) || [];

        for (const edge of edgeList) {
            const nextId = normalized.direction === 'downstream' ? edge.target_node_id : edge.source_node_id;
            if (!nextId || visited.has(nextId) || !nodeById.has(nextId)) continue;
            visited.add(nextId);
            const nextDepth = current.depth + 1;
            const currentPath = pathByNode.get(current.nodeId) || [root.node_id];
            const currentRelationPath = relationPathByNode.get(current.nodeId) || [];
            depthByNode.set(nextId, nextDepth);
            pathByNode.set(nextId, [...currentPath, nextId]);
            relationPathByNode.set(nextId, [...currentRelationPath, edge.relation_kind]);
            traversalEdges.push(edge);
            queue.push({ nodeId: nextId, depth: nextDepth });
        }
    }

    const allowedNodeIds = new Set([root.node_id]);
    [...visited].forEach((nodeId) => {
        const node = nodeById.get(nodeId);
        if (!node) return;
        if (!includeKinds || includeKinds.has(node.node_kind) || nodeId === root.node_id) {
            allowedNodeIds.add(nodeId);
        }
    });

    const resultNodes = [...allowedNodeIds]
        .map((nodeId) => {
            const node = nodeId === root.node_id ? rootNode : nodeById.get(nodeId);
            return {
                ...node,
                depth: depthByNode.get(nodeId) ?? 0,
                path: pathByNode.get(nodeId) || [root.node_id],
                relation_path: relationPathByNode.get(nodeId) || [],
            };
        })
        .sort((left, right) => nodeSortKey(left).localeCompare(nodeSortKey(right)));

    const resultEdges = traversalEdges
        .filter((edge) => allowedNodeIds.has(edge.source_node_id) && allowedNodeIds.has(edge.target_node_id))
        .sort((left, right) => edgeSortKey(left).localeCompare(edgeSortKey(right)));

    const paths = resultNodes
        .filter((node) => node.node_id !== root.node_id)
        .map((node) => ({
            node_id: node.node_id,
            depth: node.depth,
            path: node.path,
            relation_path: node.relation_path,
        }));

    const depthReached = paths.reduce((max, path) => Math.max(max, path.depth), 0);

    return {
        root,
        direction: normalized.direction,
        max_depth: normalized.depth,
        depth_reached: depthReached,
        total_impacted: Math.max(0, resultNodes.length - 1),
        nodes: resultNodes,
        edges: resultEdges,
        paths,
    };
}

async function resolveImpactRoot(kind, id) {
    const prefixedId = kind === 'service' ? `svc:${id}` : `c3:${id}`;
    const result = await getPool().query(`
        SELECT *
        FROM data.v_impact_node
        WHERE node_kind = $1
          AND (
            node_id = $2
            OR node_key = $3
            OR node_uuid = $3
          )
        ORDER BY
            CASE
                WHEN node_id = $2 THEN 0
                WHEN node_key = $3 THEN 1
                ELSE 2
            END,
            title
        LIMIT 1
    `, [kind, prefixedId, id]);

    const root = result.rows[0];
    if (!root) {
        const err = new Error(`Impact root not found: ${id}`);
        err.status = 404;
        throw err;
    }
    return root;
}

async function getImpactGraph(rootKind, id, options = {}) {
    const normalized = normalizeImpactOptions(options);
    const root = await resolveImpactRoot(rootKind, id);
    const [nodesResult, edgesResult] = await Promise.all([
        getPool().query('SELECT * FROM data.v_impact_node'),
        getPool().query('SELECT * FROM data.v_impact_edge'),
    ]);
    return traverseImpactGraph(root, nodesResult.rows, edgesResult.rows, normalized);
}

async function getServiceImpact(serviceId, options = {}) {
    return getImpactGraph('service', serviceId, options);
}

async function getCapabilityImpact(capabilityId, options = {}) {
    return getImpactGraph('c3_capability', capabilityId, options);
}

module.exports = {
    findByService,
    findAll,
    findById,
    create,
    update,
    remove,
    traverseImpactGraph,
    getServiceImpact,
    getCapabilityImpact,
};
