'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({ requireAuth: (req, res, next) => next() }));
jest.mock('../middleware/rbac', () => ({ canAdmin: (req, res, next) => next() }));
jest.mock('../middleware/module-gates', () => ({ isModuleApiEnabled: jest.fn(async () => true) }));
jest.mock('../config', () => ({ cache: { dashboardTtl: 60 } }));
jest.mock('../db/services.repo', () => ({ findAllForExport: jest.fn(async () => []), updateScore: jest.fn(async () => {}) }));
jest.mock('../db/flavours.repo', () => ({ findByService: jest.fn(async () => []) }));
jest.mock('../services/scoring', () => ({ serviceScore: jest.fn(() => 0) }));
jest.mock('../db/pool', () => {
    const query = jest.fn();
    return {
        __query: query,
        getPool: () => ({ query }),
    };
});

describe('stats routes', () => {
    beforeEach(() => {
        jest.resetModules();
        const { __query } = require('../db/pool');
        __query.mockReset();
    });

    test('GET /dashboard returns expensive flavours and C3 coverage', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({ rows: [{ total_services: 10, active_services: 8, draft_services: 1, deprecated_services: 1, retired_services: 0, total_relations: 14, total_flavours: 5 }] })
            .mockResolvedValueOnce({ rows: [{ service_type: 'CF', count: 4 }] })
            .mockResolvedValueOnce({ rows: [{ portfolio_group: 'Application Services', count: 4 }] })
            .mockResolvedValueOnce({ rows: [{ domain_code: 'NEXUS', service_count: 3 }] })
            .mockResolvedValueOnce({ rows: [{ display_name: 'Owner One', email: 'owner@example.com', service_count: 4 }] })
            .mockResolvedValueOnce({ rows: [{ service_id: 'SVC-1', flavour_code: 'BASE', flavour_title: 'Base', service_unit: 'Per User', price_value: 1000, currency_code: 'EUR' }] })
            .mockResolvedValueOnce({ rows: [{ item_type: 'BP', total_count: 20, mapped_count: 5 }] });

        const router = require('../routes/stats');
        const app = express();
        app.use('/api/v1/stats', router);

        const response = await request(app).get('/api/v1/stats/dashboard');
        expect(response.status).toBe(200);
        expect(response.body.expensive_flavours[0].service_id).toBe('SVC-1');
        expect(response.body.c3_coverage[0].item_type).toBe('BP');
        expect(response.body.by_owner[0].display_name).toBe('Owner One');
    });
});
