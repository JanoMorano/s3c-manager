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
const { getPool } = require('../db/pool');
const { logGraphLayoutChange } = require('../db/audit.repo');
const relationsRepo = require('../db/relations.repo');
const { parseCsvFilter, parseTextFilter } = require('../utils/query-filters');

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
        maxItems: 10,
        allowed: ['depends_on', 'prerequisite', 'underlying', 'replaces', 'related_to', 'provided_by', 'supports', 'consumes', 'implements', 'exposes_data', 'uses_application', 'c3_parent'],
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
            nodes: filteredServiceNodes.map(({ service_pk, ...node }) => node),
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
            nodes: filteredServiceNodes.map(({ service_pk, ...node }) => ({
                ...node,
                code: node.service_id,
                status: node.service_status,
            })),
            edges: [...serviceEdges, ...mappingEdgesResult.rows.filter((edge) => visibleServiceIds.has(edge.source))],
        };
    }

    const [
        relatedCapabilitiesResult,
        capabilityLinksAppsResult,
        capabilityLinksTinsResult,
        capabilityLinksDosResult,
        capabilityLinksSvcsResult,
    ] = await Promise.all([
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
        pool.query(`
            SELECT
                l.capability_uuid,
                app.uuid AS entity_uuid,
                app.application_code AS code,
                app.title,
                app.item_status
            FROM data.c3_capability_application_link l
            JOIN data.c3_application app ON app.id = l.c3_application_id
            WHERE l.capability_uuid = ANY($1::varchar[])
        `, [mappedCapabilityUuids]),
        pool.query(`
            SELECT
                l.capability_uuid,
                tin.id AS entity_id,
                tin.uuid AS entity_uuid,
                tin.technology_interaction_code AS code,
                tin.title,
                tin.item_status
            FROM data.c3_capability_tin_link l
            JOIN data.c3_technology_interaction tin ON tin.id = l.c3_tin_id
            WHERE l.capability_uuid = ANY($1::varchar[])
        `, [mappedCapabilityUuids]),
        pool.query(`
            SELECT
                l.capability_uuid,
                dob.uuid AS entity_uuid,
                dob.data_object_code AS code,
                dob.title,
                dob.item_status
            FROM data.c3_capability_data_object_link l
            JOIN data.c3_data_object dob ON dob.id = l.c3_data_object_id
            WHERE l.capability_uuid = ANY($1::varchar[])
        `, [mappedCapabilityUuids]),
        pool.query(`
            SELECT
                l.capability_uuid,
                svc.uuid AS entity_uuid,
                svc.service_code AS code,
                svc.title,
                svc.item_status
            FROM data.c3_capability_c3_service_link l
            JOIN data.c3_service svc ON svc.id = l.c3_service_id
            WHERE l.capability_uuid = ANY($1::varchar[])
        `, [mappedCapabilityUuids]),
    ]);

    const tinEntityIds = [...new Set(capabilityLinksTinsResult.rows.map((row) => row.entity_id).filter(Boolean))];
    const [tinAppsResult, tinDosResult, tinSvcsResult] = tinEntityIds.length > 0
        ? await Promise.all([
            pool.query(`
                SELECT
                    ti.uuid AS tin_uuid,
                    app.uuid AS entity_uuid,
                    app.application_code AS code,
                    app.title,
                    app.item_status
                FROM data.c3_technology_interaction_application_link link_
                JOIN data.c3_technology_interaction ti ON ti.id = link_.technology_interaction_id
                JOIN data.c3_application app ON app.id = link_.c3_application_id
                WHERE link_.technology_interaction_id = ANY($1::bigint[])
            `, [tinEntityIds]),
            pool.query(`
                SELECT
                    ti.uuid AS tin_uuid,
                    dob.uuid AS entity_uuid,
                    dob.data_object_code AS code,
                    dob.title,
                    dob.item_status
                FROM data.c3_technology_interaction_data_object_link link_
                JOIN data.c3_technology_interaction ti ON ti.id = link_.technology_interaction_id
                JOIN data.c3_data_object dob ON dob.id = link_.c3_data_object_id
                WHERE link_.technology_interaction_id = ANY($1::bigint[])
            `, [tinEntityIds]),
            pool.query(`
                SELECT
                    ti.uuid AS tin_uuid,
                    svc.uuid AS entity_uuid,
                    svc.service_code AS code,
                    svc.title,
                    svc.item_status
                FROM data.c3_technology_interaction_service_link link_
                JOIN data.c3_technology_interaction ti ON ti.id = link_.technology_interaction_id
                JOIN data.c3_service svc ON svc.id = link_.c3_service_id
                WHERE link_.technology_interaction_id = ANY($1::bigint[])
            `, [tinEntityIds]),
        ])
        : [{ rows: [] }, { rows: [] }, { rows: [] }];

    const nodeMap = new Map();
    const upsertNode = (node) => {
        if (!nodeMap.has(node.id)) nodeMap.set(node.id, node);
    };

    filteredServiceNodes.forEach(({ service_pk, ...node }) => {
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

    const entityDefinitions = [
        { rows: capabilityLinksAppsResult.rows, prefix: 'app', node_kind: 'c3_application' },
        { rows: capabilityLinksTinsResult.rows, prefix: 'tin', node_kind: 'c3_tin' },
        { rows: capabilityLinksDosResult.rows, prefix: 'do', node_kind: 'c3_data_object' },
        { rows: capabilityLinksSvcsResult.rows, prefix: 'c3svc', node_kind: 'c3_service' },
        { rows: tinAppsResult.rows, prefix: 'app', node_kind: 'c3_application' },
        { rows: tinDosResult.rows, prefix: 'do', node_kind: 'c3_data_object' },
        { rows: tinSvcsResult.rows, prefix: 'c3svc', node_kind: 'c3_service' },
    ];

    entityDefinitions.forEach(({ rows, prefix, node_kind }) => {
        rows.forEach((row) => {
            upsertNode({
                id: `${prefix}:${row.entity_uuid}`,
                node_kind,
                title: row.title,
                code: row.code,
                status: row.item_status,
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
                entity_uuid: row.entity_uuid,
            });
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
        ...capabilityLinksAppsResult.rows.map((row) => ({
            id: `cap-app:${row.capability_uuid}:${row.entity_uuid}`,
            source: `c3:${row.capability_uuid}`,
            target: `app:${row.entity_uuid}`,
            edge_kind: 'capability_application',
            relation_type: 'capability_application',
            relation_label: null,
            mapping_type_code: null,
            is_mandatory: false,
            impact_level: null,
            pace_code: null,
            is_verified: true,
            parse_confidence: 1,
            relation_note: null,
        })),
        ...capabilityLinksTinsResult.rows.map((row) => ({
            id: `cap-tin:${row.capability_uuid}:${row.entity_uuid}`,
            source: `c3:${row.capability_uuid}`,
            target: `tin:${row.entity_uuid}`,
            edge_kind: 'capability_tin',
            relation_type: 'capability_tin',
            relation_label: null,
            mapping_type_code: null,
            is_mandatory: false,
            impact_level: null,
            pace_code: null,
            is_verified: true,
            parse_confidence: 1,
            relation_note: null,
        })),
        ...capabilityLinksDosResult.rows.map((row) => ({
            id: `cap-do:${row.capability_uuid}:${row.entity_uuid}`,
            source: `c3:${row.capability_uuid}`,
            target: `do:${row.entity_uuid}`,
            edge_kind: 'capability_data_object',
            relation_type: 'capability_data_object',
            relation_label: null,
            mapping_type_code: null,
            is_mandatory: false,
            impact_level: null,
            pace_code: null,
            is_verified: true,
            parse_confidence: 1,
            relation_note: null,
        })),
        ...capabilityLinksSvcsResult.rows.map((row) => ({
            id: `cap-svc:${row.capability_uuid}:${row.entity_uuid}`,
            source: `c3:${row.capability_uuid}`,
            target: `c3svc:${row.entity_uuid}`,
            edge_kind: 'capability_c3_service',
            relation_type: 'capability_c3_service',
            relation_label: null,
            mapping_type_code: null,
            is_mandatory: false,
            impact_level: null,
            pace_code: null,
            is_verified: true,
            parse_confidence: 1,
            relation_note: null,
        })),
        ...tinAppsResult.rows.map((row) => ({
            id: `tin-app:${row.tin_uuid}:${row.entity_uuid}`,
            source: `tin:${row.tin_uuid}`,
            target: `app:${row.entity_uuid}`,
            edge_kind: 'tin_application',
            relation_type: 'tin_application',
            relation_label: null,
            mapping_type_code: null,
            is_mandatory: false,
            impact_level: null,
            pace_code: null,
            is_verified: true,
            parse_confidence: 1,
            relation_note: null,
        })),
        ...tinDosResult.rows.map((row) => ({
            id: `tin-do:${row.tin_uuid}:${row.entity_uuid}`,
            source: `tin:${row.tin_uuid}`,
            target: `do:${row.entity_uuid}`,
            edge_kind: 'tin_data_object',
            relation_type: 'tin_data_object',
            relation_label: null,
            mapping_type_code: null,
            is_mandatory: false,
            impact_level: null,
            pace_code: null,
            is_verified: true,
            parse_confidence: 1,
            relation_note: null,
        })),
        ...tinSvcsResult.rows.map((row) => ({
            id: `tin-svc:${row.tin_uuid}:${row.entity_uuid}`,
            source: `tin:${row.tin_uuid}`,
            target: `c3svc:${row.entity_uuid}`,
            edge_kind: 'tin_c3_service',
            relation_type: 'tin_c3_service',
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

    const [capabilityResult, capAppResult, capTinResult, capDoResult, capSvcResult, tinAppResult, tinDoResult, tinSvcResult, builderResult] = await Promise.all([
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
        pool.query(`
            SELECT
                l.capability_uuid,
                app.uuid AS entity_uuid,
                app.application_code AS code,
                app.title,
                app.item_status
            FROM data.c3_capability_application_link l
            JOIN data.c3_application app ON app.id = l.c3_application_id
        `),
        pool.query(`
            SELECT
                l.capability_uuid,
                tin.uuid AS entity_uuid,
                tin.technology_interaction_code AS code,
                tin.title,
                tin.item_status
            FROM data.c3_capability_tin_link l
            JOIN data.c3_technology_interaction tin ON tin.id = l.c3_tin_id
        `),
        pool.query(`
            SELECT
                l.capability_uuid,
                dob.uuid AS entity_uuid,
                dob.data_object_code AS code,
                dob.title,
                dob.item_status
            FROM data.c3_capability_data_object_link l
            JOIN data.c3_data_object dob ON dob.id = l.c3_data_object_id
        `),
        pool.query(`
            SELECT
                l.capability_uuid,
                svc.uuid AS entity_uuid,
                svc.service_code AS code,
                svc.title,
                svc.item_status
            FROM data.c3_capability_c3_service_link l
            JOIN data.c3_service svc ON svc.id = l.c3_service_id
        `),
        pool.query(`
            SELECT
                ti.uuid AS tin_uuid,
                app.uuid AS entity_uuid,
                app.application_code AS code,
                app.title,
                app.item_status
            FROM data.c3_technology_interaction_application_link link_
            JOIN data.c3_technology_interaction ti ON ti.id = link_.technology_interaction_id
            JOIN data.c3_application app ON app.id = link_.c3_application_id
        `),
        pool.query(`
            SELECT
                ti.uuid AS tin_uuid,
                dob.uuid AS entity_uuid,
                dob.data_object_code AS code,
                dob.title,
                dob.item_status
            FROM data.c3_technology_interaction_data_object_link link_
            JOIN data.c3_technology_interaction ti ON ti.id = link_.technology_interaction_id
            JOIN data.c3_data_object dob ON dob.id = link_.c3_data_object_id
        `),
        pool.query(`
            SELECT
                ti.uuid AS tin_uuid,
                svc.uuid AS entity_uuid,
                svc.service_code AS code,
                svc.title,
                svc.item_status
            FROM data.c3_technology_interaction_service_link link_
            JOIN data.c3_technology_interaction ti ON ti.id = link_.technology_interaction_id
            JOIN data.c3_service svc ON svc.id = link_.c3_service_id
        `),
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

    const capabilityApps = capAppResult.rows.filter((row) => visibleCapabilityUuids.has(row.capability_uuid));
    const capabilityTins = capTinResult.rows.filter((row) => visibleCapabilityUuids.has(row.capability_uuid));
    const capabilityDos = capDoResult.rows.filter((row) => visibleCapabilityUuids.has(row.capability_uuid));
    const capabilitySvcs = capSvcResult.rows.filter((row) => visibleCapabilityUuids.has(row.capability_uuid));
    const visibleTinUuids = new Set(capabilityTins.map((row) => row.entity_uuid));

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
    capabilityApps.forEach((row) => {
        upsertNode({
            id: `app:${row.entity_uuid}`,
            node_kind: 'c3_application',
            label: row.title,
            code: row.code,
            status: row.item_status,
            entity_uuid: row.entity_uuid,
        });
    });
    capabilityTins.forEach((row) => {
        upsertNode({
            id: `tin:${row.entity_uuid}`,
            node_kind: 'c3_tin',
            label: row.title,
            code: row.code,
            status: row.item_status,
            entity_uuid: row.entity_uuid,
        });
    });
    capabilityDos.forEach((row) => {
        upsertNode({
            id: `do:${row.entity_uuid}`,
            node_kind: 'c3_data_object',
            label: row.title,
            code: row.code,
            status: row.item_status,
            entity_uuid: row.entity_uuid,
        });
    });
    capabilitySvcs.forEach((row) => {
        upsertNode({
            id: `c3svc:${row.entity_uuid}`,
            node_kind: 'c3_service',
            label: row.title,
            code: row.code,
            status: row.item_status,
            entity_uuid: row.entity_uuid,
        });
    });
    tinAppResult.rows
        .filter((row) => visibleTinUuids.has(row.tin_uuid))
        .forEach((row) => {
            upsertNode({
                id: `app:${row.entity_uuid}`,
                node_kind: 'c3_application',
                label: row.title,
                code: row.code,
                status: row.item_status,
                entity_uuid: row.entity_uuid,
            });
        });
    tinDoResult.rows
        .filter((row) => visibleTinUuids.has(row.tin_uuid))
        .forEach((row) => {
            upsertNode({
                id: `do:${row.entity_uuid}`,
                node_kind: 'c3_data_object',
                label: row.title,
                code: row.code,
                status: row.item_status,
                entity_uuid: row.entity_uuid,
            });
        });
    tinSvcResult.rows
        .filter((row) => visibleTinUuids.has(row.tin_uuid))
        .forEach((row) => {
            upsertNode({
                id: `c3svc:${row.entity_uuid}`,
                node_kind: 'c3_service',
                label: row.title,
                code: row.code,
                status: row.item_status,
                entity_uuid: row.entity_uuid,
            });
        });

    const edges = [
        ...capabilityApps.map((row) => ({
            id: `cap-app:${row.capability_uuid}:${row.entity_uuid}`,
            source: `c3:${row.capability_uuid}`,
            target: `app:${row.entity_uuid}`,
            edge_kind: 'capability_application',
            relation_type: 'capability_application',
        })),
        ...capabilityTins.map((row) => ({
            id: `cap-tin:${row.capability_uuid}:${row.entity_uuid}`,
            source: `c3:${row.capability_uuid}`,
            target: `tin:${row.entity_uuid}`,
            edge_kind: 'capability_tin',
            relation_type: 'capability_tin',
        })),
        ...capabilityDos.map((row) => ({
            id: `cap-do:${row.capability_uuid}:${row.entity_uuid}`,
            source: `c3:${row.capability_uuid}`,
            target: `do:${row.entity_uuid}`,
            edge_kind: 'capability_data_object',
            relation_type: 'capability_data_object',
        })),
        ...capabilitySvcs.map((row) => ({
            id: `cap-svc:${row.capability_uuid}:${row.entity_uuid}`,
            source: `c3:${row.capability_uuid}`,
            target: `c3svc:${row.entity_uuid}`,
            edge_kind: 'capability_c3_service',
            relation_type: 'capability_c3_service',
        })),
        ...tinAppResult.rows
            .filter((row) => visibleTinUuids.has(row.tin_uuid))
            .map((row) => ({
                id: `tin-app:${row.tin_uuid}:${row.entity_uuid}`,
                source: `tin:${row.tin_uuid}`,
                target: `app:${row.entity_uuid}`,
                edge_kind: 'tin_application',
                relation_type: 'tin_application',
            })),
        ...tinDoResult.rows
            .filter((row) => visibleTinUuids.has(row.tin_uuid))
            .map((row) => ({
                id: `tin-do:${row.tin_uuid}:${row.entity_uuid}`,
                source: `tin:${row.tin_uuid}`,
                target: `do:${row.entity_uuid}`,
                edge_kind: 'tin_data_object',
                relation_type: 'tin_data_object',
            })),
        ...tinSvcResult.rows
            .filter((row) => visibleTinUuids.has(row.tin_uuid))
            .map((row) => ({
                id: `tin-svc:${row.tin_uuid}:${row.entity_uuid}`,
                source: `tin:${row.tin_uuid}`,
                target: `c3svc:${row.entity_uuid}`,
                edge_kind: 'tin_c3_service',
                relation_type: 'tin_c3_service',
            })),
    ];

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
        const c3Enabled = await isModuleApiEnabled('C3_TAXONOMY');
        if (!c3Enabled) {
            return res.status(404).json({ error: 'C3 Taxonomy modul není aktivní.' });
        }
        const payload = await buildC3RelationPayload(req.query);
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/overview', async (req, res, next) => {
    try {
        const includeC3 = req.query.include_c3 !== '0' && await isModuleApiEnabled('C3_TAXONOMY');
        const payload = await buildOverviewPayload(req.query, { compact: false, includeC3 });
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/overview/compact', async (req, res, next) => {
    try {
        const includeC3 = req.query.include_c3 !== '0' && await isModuleApiEnabled('C3_TAXONOMY');
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
