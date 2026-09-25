'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({ requireAuth: (req, res, next) => next() }));
jest.mock('../middleware/rbac', () => ({ canEdit: (req, res, next) => next() }));
jest.mock('../utils/query-filters', () => ({
    parseCsvFilter: (value) => (typeof value === 'string' && value ? value.split(',') : []),
    parseTextFilter: (value) => (typeof value === 'string' ? value.trim() : ''),
}));
jest.mock('../db/pool', () => {
    const query = jest.fn();
    return {
        __query: query,
        getPool: () => ({ query }),
    };
});

describe('graph routes', () => {
    beforeEach(() => {
        jest.resetModules();
        const { __query } = require('../db/pool');
        __query.mockReset();
    });

    test('GET /overview/compact?include_c3=0 returns compact payload without C3', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({
                rows: [{
                    id: 'svc:SVC-1',
                    node_kind: 'service',
                    title: 'Service One',
                    service_id: 'SVC-1',
                    c3_uuid: null,
                    service_type: 'CF',
                    service_status: 'active',
                    portfolio_group: 'Application Services',
                    available_on: 'NEXUS',
                    sla_availability: 99.9,
                    graph_x: 10,
                    graph_y: 20,
                    item_type: null,
                    parent_uuid: null,
                    service_pk: 1,
                }],
            })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'edge-1',
                    source: 'svc:SVC-1',
                    target: 'svc:SVC-1',
                    edge_kind: 'service_relation',
                    relation_type: 'depends_on',
                    relation_label: null,
                    mapping_type_code: null,
                    is_mandatory: true,
                    impact_level: null,
                    pace_code: null,
                    is_verified: true,
                    parse_confidence: null,
                    relation_note: null,
                }],
            });

        const router = require('../routes/graph');
        const app = express();
        app.use('/api/v1/graph', router);

        const response = await request(app).get('/api/v1/graph/overview/compact?include_c3=0');
        expect(response.status).toBe(200);
        expect(response.body.nodes).toHaveLength(1);
        expect(response.body.edges).toHaveLength(1);
        // Edges are limited to the visible services in SQL.
        expect(__query.mock.calls[1][1]).toEqual([[1], []]);
    });

    test('GET /overview pushes filters into SQL', async () => {
        const { __query } = require('../db/pool');
        __query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

        const router = require('../routes/graph');
        const app = express();
        app.use('/api/v1/graph', router);

        const response = await request(app)
            .get('/api/v1/graph/overview/compact?include_c3=0&search=iam&status=active&portfolio=DATA&type=CF&domain=NEXUS&relation_type=depends_on');
        expect(response.status).toBe(200);
        const [nodeSql, nodeValues] = __query.mock.calls[0];
        expect(nodeSql).toContain('ILIKE');
        expect(nodeSql).toContain('n.service_status = ANY');
        expect(nodeSql).toContain('graph_node_layout');
        expect(nodeValues).toEqual(['service-overview/portfolio', '%iam%', ['active'], ['DATA'], ['CF'], ['NEXUS']]);
        expect(__query.mock.calls[1][1]).toEqual([[], ['depends_on']]);
    });

    describe('layout', () => {
        function app() {
            const router = require('../routes/graph');
            const instance = express();
            instance.use(express.json());
            instance.use((req, _res, next) => { req.user = { username: 'editor' }; next(); });
            instance.use('/api/v1/graph', router);
            return instance;
        }

        test('GET returns the positions of one view', async () => {
            const { __query } = require('../db/pool');
            __query.mockResolvedValueOnce({ rows: [{ node_id: 'svc:SVC-1', x: 1, y: 2 }] });
            const response = await request(app()).get('/api/v1/graph/layout?view=service/SVC-1');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ view_key: 'service/SVC-1', positions: [{ node_id: 'svc:SVC-1', x: 1, y: 2 }] });
            expect(__query.mock.calls[0][1]).toEqual(['service/SVC-1']);
        });

        test('rejects an invalid view key', async () => {
            const response = await request(app()).get('/api/v1/graph/layout?view=../etc');
            expect(response.status).toBe(400);
        });

        test('PUT saves well-formed positions only', async () => {
            const { __query } = require('../db/pool');
            __query.mockResolvedValueOnce({ rowCount: 1 });
            const response = await request(app())
                .put('/api/v1/graph/layout')
                .send({
                    view: 'c3-relations',
                    positions: [
                        { node_id: 'c3:abc', x: 10, y: 20 },
                        { node_id: 'c3:abc', x: 11, y: 21 },
                        { node_id: 'bad id', x: 1, y: 1 },
                        { node_id: 'app:x', x: 'NaN', y: 1 },
                    ],
                });
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ view_key: 'c3-relations', saved: 1 });
            const [, values] = __query.mock.calls[0];
            expect(values).toEqual(['c3-relations', JSON.stringify([{ node_id: 'c3:abc', x: 11, y: 21 }]), 'editor']);
        });

        test('previous overview endpoint saves service positions to the portfolio view', async () => {
            const { __query } = require('../db/pool');
            __query.mockResolvedValueOnce({ rowCount: 1 });
            const response = await request(app())
                .put('/api/v1/graph/overview/layout')
                .send({ positions: [{ node_kind: 'service', service_id: 'SVC-1', x: 5, y: 6 }, { node_kind: 'c3', x: 1, y: 1 }] });
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ saved: 1 });
            expect(__query.mock.calls[0][1][0]).toBe('service-overview/portfolio');
        });

        test('DELETE resets a view', async () => {
            const { __query } = require('../db/pool');
            __query.mockResolvedValueOnce({ rowCount: 3 });
            const response = await request(app()).delete('/api/v1/graph/layout?view=service-overview/dependency');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ view_key: 'service-overview/dependency', removed: 3 });
        });
    });
});
