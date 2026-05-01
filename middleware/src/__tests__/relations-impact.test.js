'use strict';

jest.mock('../db/pool', () => ({
    getPool: jest.fn(() => ({ query: jest.fn() })),
}));

describe('relations impact traversal', () => {
    test('traverses downstream impact with cycle guard and deterministic paths', () => {
        const { traverseImpactGraph } = require('../db/relations.repo');
        const nodes = [
            { node_id: 'svc:SVC-IAM', node_kind: 'service', node_key: 'SVC-IAM', title: 'Identity Access Management' },
            { node_id: 'svc:SVC-PORTAL', node_kind: 'service', node_key: 'SVC-PORTAL', title: 'Employee Portal' },
            { node_id: 'svc:SVC-DIR', node_kind: 'service', node_key: 'SVC-DIR', title: 'Directory Service' },
            { node_id: 'c3:cap-iam', node_kind: 'c3_capability', node_key: 'C3-IAM', title: 'Identity capability' },
        ];
        const edges = [
            { edge_id: 'e1', source_node_id: 'svc:SVC-IAM', target_node_id: 'svc:SVC-PORTAL', relation_kind: 'depends_on', edge_kind: 'service_relation' },
            { edge_id: 'e2', source_node_id: 'svc:SVC-PORTAL', target_node_id: 'svc:SVC-IAM', relation_kind: 'depends_on', edge_kind: 'service_relation' },
            { edge_id: 'e3', source_node_id: 'svc:SVC-IAM', target_node_id: 'c3:cap-iam', relation_kind: 'primary', edge_kind: 'service_c3_mapping' },
            { edge_id: 'e4', source_node_id: 'svc:SVC-DIR', target_node_id: 'svc:SVC-IAM', relation_kind: 'depends_on', edge_kind: 'service_relation' },
        ];

        const result = traverseImpactGraph(nodes[0], nodes, edges, {
            direction: 'downstream',
            depth: 3,
            include: ['services', 'c3'],
        });

        expect(result.nodes.map((node) => node.node_id)).toEqual([
            'svc:SVC-IAM',
            'svc:SVC-PORTAL',
            'c3:cap-iam',
        ]);
        expect(result.total_impacted).toBe(2);
        expect(result.paths).toEqual(expect.arrayContaining([
            expect.objectContaining({
                node_id: 'svc:SVC-PORTAL',
                depth: 1,
                path: ['svc:SVC-IAM', 'svc:SVC-PORTAL'],
                relation_path: ['depends_on'],
            }),
            expect.objectContaining({
                node_id: 'c3:cap-iam',
                depth: 1,
                path: ['svc:SVC-IAM', 'c3:cap-iam'],
                relation_path: ['primary'],
            }),
        ]));
        expect(result.edges).toHaveLength(2);
    });

    test('traverses upstream dependencies by reversing normalized impact edges', () => {
        const { traverseImpactGraph } = require('../db/relations.repo');
        const nodes = [
            { node_id: 'svc:SVC-PORTAL', node_kind: 'service', node_key: 'SVC-PORTAL', title: 'Employee Portal' },
            { node_id: 'svc:SVC-IAM', node_kind: 'service', node_key: 'SVC-IAM', title: 'Identity Access Management' },
        ];
        const edges = [
            { edge_id: 'e1', source_node_id: 'svc:SVC-IAM', target_node_id: 'svc:SVC-PORTAL', relation_kind: 'depends_on', edge_kind: 'service_relation' },
        ];

        const result = traverseImpactGraph(nodes[0], nodes, edges, {
            direction: 'upstream',
            depth: 2,
            include: ['services'],
        });

        expect(result.nodes.map((node) => node.node_id)).toEqual(['svc:SVC-PORTAL', 'svc:SVC-IAM']);
        expect(result.paths[0]).toEqual(expect.objectContaining({
            node_id: 'svc:SVC-IAM',
            path: ['svc:SVC-PORTAL', 'svc:SVC-IAM'],
        }));
    });
});
