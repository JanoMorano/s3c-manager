'use strict';
/**
 * routes/graph.js — Graph endpoints
 *
 * Mounting point: /api/v1/graph
 *
 * GET /api/v1/graph/impact/:serviceId
 *   Alias for /api/v1/services/:id/impact
 *   Impact BFS (reverse): who depends on the selected service?
 *   Query params: ?depth=N (default 5, max 10)
 *   Response: { root, nodes[], edges[], depth_reached, total_impacted }
 *
 * Rationale: zadani_projektu.md section 6 specifies /graph/impact/:serviceId
 * as part of the API contract. The BFS implementation lives here separately
 * instead of aliasing services.js to keep the API surface clean.
 */

const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { canEdit } = require('../middleware/rbac');
const { isModuleApiEnabled } = require('../middleware/module-gates');
const { MODULE_CODES } = require('../modules/manifest');
const { getPool } = require('../db/pool');
const { logGraphLayoutChange } = require('../db/audit.repo');
const relationsRepo = require('../db/relations.repo');
const { filterLinksForCapabilities, linkEdge, linkTargetNode, listC3EntityLinks } = require('../db/c3-entity-links.repo');
const { parseCsvFilter, parseTextFilter } = require('../utils/query-filters');
const { RELATION_TYPE_CODES } = require('../../../shared/service-catalogue/relationTypes');

router.use(requireAuth);

async function buildOverviewPayload(query, options = {}) {
    const compact = options.compact === true;
    const includeC3 = options.includeC3 !== false;
    const pool = getPool();
    const search = parseTextFilter(query.search);
    const statuses = parseCsvFilter(query.status, { maxItems: 10 });
    const portfolios = parseCsvFilter(query.portfolio, { maxItems: 10 });
    const serviceTypes = parseCsvFilter(query.type, { maxItems: 10 });
    const domains = parseCsvFilter(query.domain, { maxItems: 12 });
    const relationTypes = parseCsvFilter(query.relation_type, {
        maxItems: RELATION_TYPE_CODES.length,
        allowed: RELATION_TYPE_CODES,
    });

    const serviceNodesResult = await pool.query(`
        SELECT
            id,
            node_kind,
            title,
            service_id,
            NULL::varchar(100) AS c3_uuid,
            service_type,
            service_status,
            portfolio_group,
            available_on,
            sla_availability,
            graph_x,
            graph_y,
            NULL::varchar(20) AS item_type,
            NULL::varchar(100) AS parent_uuid,
            service_pk
        FROM data.v_graphoverviewnodes
        ORDER BY portfolio_group, service_id
    `);

    const serviceEdgesResult = await pool.query(`
        SELECT
               CONCAT('svc:', f.service_id, '->svc:', t.service_id, ':', sr.relation_type_code, ':', sr.id) AS id,
               CONCAT('svc:', f.service_id) AS source,
               CONCAT('svc:', t.service_id) AS target,
               'service_relation' AS edge_kind,
               sr.relation_type_code AS relation_type,
               ${compact ? 'NULL::varchar(500)' : 'sr.relation_label'} AS relation_label,
               NULL::varchar(50) AS mapping_type_code,
               sr.is_mandatory,
               ${compact ? 'NULL::varchar(50)' : 'sr.impact_level'} AS impact_level,
               sr.pace_code,
               sr.is_verified,
               ${compact ? 'NULL::double precision' : 'sr.parse_confidence'} AS parse_confidence,
               ${compact ? 'NULL::varchar(1000)' : 'sr.relation_note'} AS relation_note
        FROM data.service_relation sr
        JOIN data.service_catalog f ON f.id = sr.from_service_id AND f.is_deleted = FALSE
        JOIN data.service_catalog t ON t.id = sr.to_service_id   AND t.is_deleted = FALSE
        WHERE sr.is_deleted = FALSE
    `);

    const filteredServiceNodes = serviceNodesResult.rows.filter((node) => {
        if (search) {
            const haystack = `${node.service_id ?? ''} ${node.title ?? ''}`.toLowerCase();
            if (!haystack.includes(search.toLowerCase())) return false;
        }
        if (statuses.length > 0 && !statuses.includes(node.service_status)) return false;
        if (portfolios.length > 0 && !portfolios.includes(node.portfolio_group)) return false;
        if (serviceTypes.length > 0 && !serviceTypes.includes(node.service_type)) return false;
        if (domains.length > 0) {
            const nodeDomains = String(node.available_on ?? '').split(',').map((item) => item.trim()).filter(Boolean);
            if (!domains.every((domain) => nodeDomains.includes(domain))) return false;
        }
        return true;
    });
    const visibleServiceIds = new Set(filteredServiceNodes.map((node) => node.id));
    const serviceEdges = serviceEdgesResult.rows.filter((edge) =>
        visibleServiceIds.has(edge.source) &&
        visibleServiceIds.has(edge.target) &&
        (relationTypes.length === 0 || relationTypes.includes(edge.relation_type))
    );

    if (!includeC3) {
        return {
            nodes: filteredServiceNodes.map(({ service_pk: _servicePk, ...node }) => node),
            edges: serviceEdges,
        };
    }

    const visibleServiceKeys = filteredServiceNodes
        .map((node) => String(node.service_id ?? '').trim())
        .filter(Boolean);

    const mappingEdgesResult = await pool.query(`
        SELECT
            CONCAT('svc:', sc.service_id, '->c3:', scm.c3_uuid, ':', scm.mapping_type_code, ':', scm.id) AS id,
            CONCAT('svc:', sc.service_id) AS source,
            CONCAT('c3:', scm.c3_uuid) AS target,
            'service_c3_mapping' AS edge_kind,
            scm.mapping_type_code AS relation_type,
            ${compact ? 'NULL::varchar(500)' : 'scm.mapping_note'} AS relation_label,
            scm.mapping_type_code,
            FALSE AS is_mandatory,
            NULL::varchar(50) AS impact_level,
            scm.pace_code,
               TRUE AS is_verified,
               1.0::double precision AS parse_confidence,
               ${compact ? 'NULL::varchar(1000)' : 'scm.mapping_note'} AS relation_note
        FROM data.service_c3_mapping scm
        JOIN data.service_catalog sc ON sc.id = scm.service_id AND sc.is_deleted = FALSE
        WHERE sc.service_id = ANY($1::varchar[])
    `, [visibleServiceKeys]);

    const mappedCapabilityUuids = [...new Set(mappingEdgesResult.rows.map((edge) => String(edge.target ?? '').replace(/^c3:/, '')).filter(Boolean))];
    if (mappedCapabilityUuids.length === 0) {
        return {
            nodes: filteredServiceNodes.map(({ service_pk: _servicePk, ...node }) => ({
                ...node,
                code: node.service_id,
                status: node.service_status,
            })),
            edges: [...serviceEdges, ...mappingEdgesResult.rows.filter((edge) => visibleServiceIds.has(edge.source))],
        };
    }

    const [relatedCapabilitiesResult, c3Links] = await Promise.all([
        pool.query(`
            WITH RECURSIVE related AS (
                SELECT c.uuid, c.parent_uuid, c.external_id, c.title, c.item_type, c.item_status
                FROM data.c3_taxonomy c
                WHERE c.uuid = ANY($1::varchar[])
                UNION
                SELECT parent.uuid, parent.parent_uuid, parent.external_id, parent.title, parent.item_type, parent.item_status
                FROM data.c3_taxonomy parent
                JOIN related child ON child.parent_uuid = parent.uuid
            )
            SELECT DISTINCT
                r.uuid,
                r.parent_uuid,
                r.external_id,
                r.title,
                r.item_type,
                r.item_status,
                COALESCE(comp.completeness_status, 'incomplete') AS completeness_status
            FROM related r
            LEFT JOIN data.v_c3capabilitycompleteness comp ON comp.uuid = r.uuid
        `, [mappedCapabilityUuids]),
        listC3EntityLinks(pool, { capabilityUuids: mappedCapabilityUuids }),
    ]);

    const nodeMap = new Map();
    const upsertNode = (node) => {
        if (!nodeMap.has(node.id)) nodeMap.set(node.id, node);
    };

    filteredServiceNodes.forEach(({ service_pk: _servicePk, ...node }) => {
        upsertNode({
            ...node,
            code: node.service_id,
            status: node.service_status,
        });
    });

    relatedCapabilitiesResult.rows.forEach((row) => {
        upsertNode({
            id: `c3:${row.uuid}`,
            node_kind: 'c3_capability',
            title: row.title || row.external_id || row.uuid,
            code: row.external_id || row.uuid,
            status: row.item_status,
            service_id: null,
            c3_uuid: row.uuid,
            service_type: null,
            service_status: null,
            portfolio_group: null,
            available_on: null,
            sla_availability: null,
            graph_x: null,
            graph_y: null,
            item_type: row.item_type,
            parent_uuid: row.parent_uuid,
            completeness_status: row.completeness_status,
        });
    });

    c3Links.forEach((link) => {
        upsertNode({
            ...linkTargetNode(link, 'title'),
            service_id: null,
            c3_uuid: null,
            service_type: null,
            service_status: null,
            portfolio_group: null,
            available_on: null,
            sla_availability: null,
            graph_x: null,
            graph_y: null,
            item_type: null,
            parent_uuid: null,
        });
    });

    const c3ParentEdges = relatedCapabilitiesResult.rows
        .filter((row) => row.parent_uuid)
        .map((row) => ({
            id: `c3:${row.uuid}->c3:${row.parent_uuid}:parent`,
            source: `c3:${row.uuid}`,
            target: `c3:${row.parent_uuid}`,
            edge_kind: 'c3_parent',
            relation_type: 'c3_parent',
            relation_label: null,
            mapping_type_code: null,
            is_mandatory: false,
            impact_level: null,
            pace_code: null,
            is_verified: true,
            parse_confidence: 1,
            relation_note: null,
        }));

    const filteredEdges = [
        ...serviceEdges,
        ...mappingEdgesResult.rows.filter((edge) => visibleServiceIds.has(edge.source)),
        ...c3ParentEdges.filter((edge) => relationTypes.length === 0 || relationTypes.includes(edge.relation_type)),
        ...c3Links.map((link) => ({
            ...linkEdge(link),
            relation_label: null,
            mapping_type_code: null,
            is_mandatory: false,
            impact_level: null,
            pace_code: null,
            is_verified: true,
            parse_confidence: 1,
            relation_note: null,
        })),
    ];

    return {
        nodes: [...nodeMap.values()],
        edges: filteredEdges,
    };
}

async function buildC3RelationPayload(query) {
    const pool = getPool();
    const search = parseTextFilter(query.search);
    const domainCode = String(query.domain_code ?? '').trim() || null;
    const l3PageId = String(query.l3_page_id ?? '').trim() || null;
    const itemTypes = parseCsvFilter(query.item_type, {
        maxItems: 10,
        allowed: ['BP', 'BR', 'CI', 'CO', 'CP', 'CR', 'IP', 'UA', 'OTHER'],
    });

    const [capabilityResult, allC3Links, builderResult] = await Promise.all([
        pool.query(`
            SELECT
                c.uuid,
                c.external_id,
                c.title,
                c.item_type,
                c.item_status,
                comp.completeness_status
            FROM data.c3_taxonomy c
            LEFT JOIN data.v_c3capabilitycompleteness comp
              ON comp.uuid = c.uuid
            ORDER BY c.title
        `),
        listC3EntityLinks(pool),
        pool.query(`
            SELECT
                b.page_id,
                b.parent_id,
                b.level,
                b.domain_code,
                linked.uuid AS linked_c3_uuid
            FROM data.v_c3capabilitybuilderlist b
            LEFT JOIN LATERAL (
                SELECT
                    t.uuid
                FROM data.c3_taxonomy t
                WHERE t.external_id = b.page_id
                   OR t.uuid = b.uuid
                ORDER BY
                    CASE
                        WHEN t.external_id = b.page_id THEN 0
                        WHEN t.uuid = b.uuid THEN 1
                        ELSE 2
                    END,
                    t.id
                LIMIT 1
            ) linked
            ON TRUE
        `),
    ]);

    let builderRows = builderResult.rows;
    if (domainCode) {
        builderRows = builderRows.filter((row) => String(row.domain_code ?? '') === domainCode);
    }
    if (l3PageId) {
        const childrenByParent = new Map();
        builderRows.forEach((row) => {
            const key = row.parent_id ?? '__root__';
            if (!childrenByParent.has(key)) childrenByParent.set(key, []);
            childrenByParent.get(key).push(row);
        });
        const subtreePageIds = new Set();
        const queue = [l3PageId];
        while (queue.length > 0) {
            const current = queue.shift();
            if (!current || subtreePageIds.has(current)) continue;
            subtreePageIds.add(current);
            const children = childrenByParent.get(current) ?? [];
            children.forEach((child) => queue.push(child.page_id));
        }
        builderRows = builderRows.filter((row) => subtreePageIds.has(row.page_id));
    }

    const capabilityFilterUuids = new Set(
        builderRows
            .map((row) => row.linked_c3_uuid)
            .filter(Boolean)
    );
    const useBuilderFilter = Boolean(domainCode || l3PageId);

    const capabilities = capabilityResult.rows.filter((row) => {
        if (itemTypes.length > 0 && !itemTypes.includes(String(row.item_type ?? 'OTHER'))) return false;
        if (useBuilderFilter && !capabilityFilterUuids.has(row.uuid)) return false;
        return true;
    });
    const visibleCapabilityUuids = new Set(capabilities.map((row) => row.uuid));

    const c3Links = filterLinksForCapabilities(allC3Links, visibleCapabilityUuids);

    const nodeMap = new Map();
    const upsertNode = (node) => {
        if (!nodeMap.has(node.id)) nodeMap.set(node.id, node);
    };

    capabilities.forEach((row) => {
        upsertNode({
            id: `c3:${row.uuid}`,
            node_kind: 'c3_capability',
            label: row.title || row.external_id || row.uuid,
            code: row.external_id || row.uuid,
            status: row.item_status,
            item_type: row.item_type,
            completeness_status: row.completeness_status || 'incomplete',
            c3_uuid: row.uuid,
        });
    });
    c3Links.forEach((link) => upsertNode(linkTargetNode(link)));

    const edges = c3Links.map(linkEdge);

    if (search) {
        const q = search.toLowerCase();
        const directlyMatched = new Set(
            [...nodeMap.values()]
                .filter((node) => `${node.label ?? ''} ${node.code ?? ''}`.toLowerCase().includes(q))
                .map((node) => node.id)
        );
        const visibleIds = new Set(directlyMatched);
        edges.forEach((edge) => {
            if (directlyMatched.has(edge.source) || directlyMatched.has(edge.target)) {
                visibleIds.add(edge.source);
                visibleIds.add(edge.target);
            }
        });
        return {
            nodes: [...nodeMap.values()].filter((node) => visibleIds.has(node.id)),
            edges: edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
        };
    }

    return {
        nodes: [...nodeMap.values()],
        edges,
    };
}

// ─── GET /api/v1/graph/overview ──────────────────────────────────────────────
// Returns all active services and all of their relations in one call.
// Used by the global overview graph.
// Response: { nodes: GraphNode[], edges: GraphEdge[] }
router.get('/c3-relations', async (req, res, next) => {
    try {
        const c3Enabled = await isModuleApiEnabled(MODULE_CODES.C3);
        if (!c3Enabled) {
            return res.status(404).json({ error: 'C3 Taxonomy modul není aktivní.' });
        }
        const payload = await buildC3RelationPayload(req.query);
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/overview', async (req, res, next) => {
    try {
        const includeC3 = req.query.include_c3 !== '0' && await isModuleApiEnabled(MODULE_CODES.C3);
        const payload = await buildOverviewPayload(req.query, { compact: false, includeC3 });
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/overview/compact', async (req, res, next) => {
    try {
        const includeC3 = req.query.include_c3 !== '0' && await isModuleApiEnabled(MODULE_CODES.C3);
        const payload = await buildOverviewPayload(req.query, { compact: true, includeC3 });
        res.json(payload);
    } catch (err) { next(err); }
});

router.put('/overview/layout', canEdit, async (req, res, next) => {
    try {
        const positions = Array.isArray(req.body?.positions) ? req.body.positions : null;
        if (!positions) return res.status(422).json({ error: 'positions musí být pole' });

        const servicePositions = positions
            .filter(p => p && p.node_kind === 'service' && p.service_id && Number.isFinite(p.x) && Number.isFinite(p.y));

        for (const pos of servicePositions) {
            const previous = await getPool().query(`
                SELECT id, graph_x, graph_y
                FROM data.service_catalog
                WHERE service_id = $1 AND is_deleted = FALSE
            `, [pos.service_id]);
            const previousRow = previous.rows[0];

            await getPool().query(`
                UPDATE data.service_catalog
                SET graph_x = $2,
                    graph_y = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE service_id = $1 AND is_deleted = FALSE
            `, [pos.service_id, pos.x, pos.y]);

            if (previousRow) {
                await logGraphLayoutChange({
                    servicePk: previousRow.id,
                    nodeKind: 'service',
                    oldX: previousRow.graph_x,
                    oldY: previousRow.graph_y,
                    newX: pos.x,
                    newY: pos.y,
                    changedBy: req.user?.username || 'system',
                });
            }
        }

        res.json({ saved: servicePositions.length });
    } catch (err) { next(err); }
});

// ─── GET /api/v1/graph/impact/:serviceId ─────────────────────────────────────
// Impact BFS (directed, reverse): who depends on the selected service?
// If X fails, which services are impacted?
// Traversal follows incoming edges (from_service_id where to_service_id = X.id).
router.get('/impact/:serviceId', async (req, res, next) => {
    try {
        const maxDepth = Math.min(10, parseInt(req.query.depth, 10) || 5);
        const payload = await relationsRepo.getServiceImpact(req.params.serviceId, {
            direction: 'downstream',
            depth: maxDepth,
            include: ['services'],
        });
        res.json(payload);
    } catch (err) { next(err); }
});

module.exports = router;
