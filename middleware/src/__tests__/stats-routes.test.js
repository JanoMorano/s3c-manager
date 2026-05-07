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
            .mockResolvedValueOnce({ rows: [{ total_services: 10, active_services: 8, draft_services: 1, deprecated_services: 1, retired_services: 0, requestable_services: 3, total_relations: 14, total_flavours: 5 }] })
            .mockResolvedValueOnce({ rows: [{ service_type: 'CF', count: 4 }] })
            .mockResolvedValueOnce({ rows: [{ portfolio_group: 'Application Services', count: 4 }] })
            .mockResolvedValueOnce({ rows: [{ domain_code: 'NEXUS', service_count: 3 }] })
            .mockResolvedValueOnce({ rows: [{ display_name: 'Owner One', email: 'owner@example.com', service_count: 4 }] })
            .mockResolvedValueOnce({ rows: [{ service_id: 'SVC-1', flavour_code: 'BASE', flavour_title: 'Base', service_unit: 'Per User', price_value: 1000, currency_code: 'EUR' }] })
            .mockResolvedValueOnce({ rows: [{ item_type: 'BP', total_count: 20, mapped_count: 5 }] })
            .mockResolvedValueOnce({ rows: [{ lifecycle_state: 'live', count: 6 }] });

        const router = require('../routes/stats');
        const app = express();
        app.use('/api/v1/stats', router);

        const response = await request(app).get('/api/v1/stats/dashboard');
        expect(response.status).toBe(200);
        expect(response.body.expensive_flavours[0].service_id).toBe('SVC-1');
        expect(response.body.c3_coverage[0].item_type).toBe('BP');
        expect(response.body.by_owner[0].display_name).toBe('Owner One');
        expect(response.headers.deprecation).toBe('true');
    });

    test('GET /dashboard-headline returns exactly three numeric KPIs', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({ rows: [{ total_services: 10, active_services: 8, draft_services: 1, deprecated_services: 1, retired_services: 0, requestable_services: 5, total_relations: 14, total_flavours: 5 }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ item_type: 'CP', total_count: 20, mapped_count: 10 }] })
            .mockResolvedValueOnce({ rows: [] });

        const router = require('../routes/stats');
        const app = express();
        app.use('/api/v1/stats', router);

        const response = await request(app).get('/api/v1/stats/dashboard-headline');
        expect(response.status).toBe(200);
        expect(response.body.kpis).toHaveLength(3);
        expect(response.body.kpis.map((kpi) => kpi.key)).toEqual([
            'services_count',
            'publishable_readiness_percent',
            'top_framework_coverage_percent',
        ]);
        response.body.kpis.forEach((kpi) => expect(typeof kpi.value).toBe('number'));
    });

    test('GET /operations returns governance sections', async () => {
        const { __query } = require('../db/pool');
        __query.mockImplementation((sql) => {
            const text = String(sql);
            if (text.includes('NOT EXISTS') && text.includes('service_role_assignment')) {
                return Promise.resolve({ rows: [{ service_id: 'SVC-3', title: 'No Owner', service_status: 'active' }] });
            }
            if (text.includes('sc.completeness_score') && text.includes('LEFT JOIN data.service_c3_mapping')) {
                return Promise.resolve({ rows: [
                    { service_id: 'SVC-1', title: 'One', service_status: 'active', summary: null, completeness_score: 35, flavour_count: 0 },
                    { service_id: 'SVC-2', title: 'Two', service_status: 'deprecated', summary: 'x', completeness_score: 90, flavour_count: 1 },
                ] });
            }
            if (text.includes('COUNT(*) FILTER')) {
                return Promise.resolve({ rows: [{ total_services: 2, active_services: 1, draft_services: 1, deprecated_services: 0, retired_services: 0, requestable_services: 1, total_relations: 0, total_flavours: 1 }] });
            }
            if (text.includes('FROM data.c3_taxonomy')) {
                return Promise.resolve({ rows: [{ item_type: 'CP', total_count: 3, mapped_count: 1 }] });
            }
            return Promise.resolve({ rows: [] });
        });

        const router = require('../routes/stats');
        const app = express();
        app.use('/api/v1/stats', router);

        const response = await request(app).get('/api/v1/stats/operations');
        expect(response.status).toBe(200);
        expect(Object.keys(response.body.sections)).toEqual(expect.arrayContaining([
            'incomplete_metadata',
            'missing_owners',
            'top_completeness',
            'deprecated_retired',
            'offering_evidence',
            'c3_mapping_gap',
        ]));
        expect(response.body.sections.offering_evidence.coverage_percent).toBe(50);
        expect(response.body.sections.c3_mapping_gap[0].gap_count).toBe(2);
    });

});
