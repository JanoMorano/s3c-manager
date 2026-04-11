'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({ requireAuth: (req, res, next) => next() }));
jest.mock('../middleware/rbac', () => ({ canEdit: (req, res, next) => next() }));
jest.mock('../db/audit.repo', () => ({ logGraphLayoutChange: jest.fn(async () => {}) }));
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
                    target: 'svc:SVC-1B',
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
        expect(response.body.edges).toHaveLength(0);
    });
});
