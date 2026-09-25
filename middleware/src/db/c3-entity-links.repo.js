'use strict';

/**
 * Read access to data.v_c3_entity_link (read model over data.c3_entity_link,
 * 42_c3_entity_link_table.sql): one row
 * per link from a C3 capability or technology interaction (TIN) to an entity.
 * Graph readers use it instead of querying the seven link tables separately.
 */

const TARGET_NODE = Object.freeze({
    application: { prefix: 'app', nodeKind: 'c3_application' },
    data_object: { prefix: 'do', nodeKind: 'c3_data_object' },
    tin: { prefix: 'tin', nodeKind: 'c3_tin' },
    c3_service: { prefix: 'c3svc', nodeKind: 'c3_service' },
});

const EDGE_ID_PREFIX = Object.freeze({
    capability_application: 'cap-app',
    capability_data_object: 'cap-do',
    capability_tin: 'cap-tin',
    capability_c3_service: 'cap-svc',
    tin_application: 'tin-app',
    tin_data_object: 'tin-do',
    tin_c3_service: 'tin-svc',
});

const LINK_COLUMNS = `
    link_kind, source_kind, source_uuid, source_id,
    target_kind, target_id, target_uuid, target_code, target_title, target_item_status
`;

/**
 * Links of the given capabilities plus the links of the TINs they reach.
 * Without capabilityUuids, returns every link.
 */
async function listC3EntityLinks(pool, { capabilityUuids = null } = {}) {
    if (capabilityUuids === null) {
        const result = await pool.query(`SELECT ${LINK_COLUMNS} FROM data.v_c3_entity_link`);
        return result.rows;
    }
    if (capabilityUuids.length === 0) return [];
    const result = await pool.query(`
        SELECT ${LINK_COLUMNS}
        FROM data.v_c3_entity_link
        WHERE (source_kind = 'capability' AND source_uuid = ANY($1::varchar[]))
           OR (source_kind = 'tin' AND source_id IN (
                SELECT target_id
                FROM data.v_c3_entity_link
                WHERE link_kind = 'capability_tin'
                  AND source_uuid = ANY($1::varchar[])
           ))
    `, [capabilityUuids]);
    return result.rows;
}

/** Keeps links of visible capabilities and of the TINs those capabilities link to. */
function filterLinksForCapabilities(links, visibleCapabilityUuids) {
    const capabilityLinks = links.filter((link) => link.source_kind === 'capability' && visibleCapabilityUuids.has(link.source_uuid));
    const visibleTinUuids = new Set(capabilityLinks.filter((link) => link.target_kind === 'tin').map((link) => link.target_uuid));
    return [
        ...capabilityLinks,
        ...links.filter((link) => link.source_kind === 'tin' && visibleTinUuids.has(link.source_uuid)),
    ];
}

function linkSourceNodeId(link) {
    return link.source_kind === 'tin' ? `tin:${link.source_uuid}` : `c3:${link.source_uuid}`;
}

function linkTargetNodeId(link) {
    return `${TARGET_NODE[link.target_kind].prefix}:${link.target_uuid}`;
}

/** Target entity as a graph node; `labelKey` is 'label' or 'title' depending on the payload. */
function linkTargetNode(link, labelKey = 'label') {
    return {
        id: linkTargetNodeId(link),
        node_kind: TARGET_NODE[link.target_kind].nodeKind,
        [labelKey]: link.target_title,
        code: link.target_code,
        status: link.target_item_status,
        entity_uuid: link.target_uuid,
    };
}

function linkEdge(link) {
    return {
        id: `${EDGE_ID_PREFIX[link.link_kind]}:${link.source_uuid}:${link.target_uuid}`,
        source: linkSourceNodeId(link),
        target: linkTargetNodeId(link),
        edge_kind: link.link_kind,
        relation_type: link.link_kind,
    };
}

module.exports = {
    listC3EntityLinks,
    filterLinksForCapabilities,
    linkTargetNode,
    linkEdge,
};
