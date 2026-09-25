'use strict';

const { filterLinksForCapabilities, linkEdge, linkTargetNode, listC3EntityLinks } = require('../db/c3-entity-links.repo');

const link = (overrides) => ({
    link_kind: 'capability_application',
    source_kind: 'capability',
    source_uuid: 'cap-1',
    source_id: null,
    target_kind: 'application',
    target_id: 10,
    target_uuid: 'app-1',
    target_code: 'APP-1',
    target_title: 'App one',
    target_item_status: 'active',
    ...overrides,
});

describe('C3 entity links', () => {
    test('maps links to the graph edge and node shapes used by the graph readers', () => {
        expect(linkEdge(link())).toEqual({
            id: 'cap-app:cap-1:app-1',
            source: 'c3:cap-1',
            target: 'app:app-1',
            edge_kind: 'capability_application',
            relation_type: 'capability_application',
        });
        expect(linkEdge(link({ link_kind: 'tin_c3_service', source_kind: 'tin', source_uuid: 'tin-1', target_kind: 'c3_service', target_uuid: 'svc-1' })))
            .toMatchObject({ id: 'tin-svc:tin-1:svc-1', source: 'tin:tin-1', target: 'c3svc:svc-1' });
        expect(linkTargetNode(link({ target_kind: 'data_object', target_uuid: 'do-1' }), 'title')).toEqual({
            id: 'do:do-1',
            node_kind: 'c3_data_object',
            title: 'App one',
            code: 'APP-1',
            status: 'active',
            entity_uuid: 'do-1',
        });
    });

    test('keeps links of visible capabilities and of the TINs they reach', () => {
        const links = [
            link({ link_kind: 'capability_tin', target_kind: 'tin', target_uuid: 'tin-1' }),
            link({ source_uuid: 'cap-hidden' }),
            link({ link_kind: 'tin_application', source_kind: 'tin', source_uuid: 'tin-1', target_uuid: 'app-2' }),
            link({ link_kind: 'tin_application', source_kind: 'tin', source_uuid: 'tin-other', target_uuid: 'app-3' }),
        ];
        const kept = filterLinksForCapabilities(links, new Set(['cap-1']));
        expect(kept.map((item) => `${item.source_uuid}->${item.target_uuid}`)).toEqual(['cap-1->tin-1', 'tin-1->app-2']);
    });

    test('returns no links without querying for an empty capability list', async () => {
        const pool = { query: jest.fn() };
        await expect(listC3EntityLinks(pool, { capabilityUuids: [] })).resolves.toEqual([]);
        expect(pool.query).not.toHaveBeenCalled();
    });
});
