'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        req.user = { username: 'owner@example.com', email: 'owner@example.com', role: 'editor' };
        next();
    },
}));

jest.mock('../db/pool', () => {
    const query = jest.fn();
    return {
        __query: query,
        getPool: () => ({ query }),
    };
});

describe('dashboard routes', () => {
    beforeEach(() => {
        jest.resetModules();
        const { __query } = require('../db/pool');
        __query.mockReset();
    });

    test('GET /inbox returns empty state', async () => {
        const { __query } = require('../db/pool');
        __query.mockResolvedValueOnce({ rows: [] });

        const router = require('../routes/dashboard');
        const app = express();
        app.use('/api/v1/dashboard', router);

        const response = await request(app).get('/api/v1/dashboard/inbox');
        expect(response.status).toBe(200);
        expect(response.body.items).toEqual([]);
    });

    test('GET /inbox returns top actionable items filtered by current user', async () => {
        const { __query } = require('../db/pool');
        __query.mockResolvedValueOnce({
            rows: [
                {
                    id: 'review-SVC-1',
                    type: 'service_review',
                    title: 'ABC Planner',
                    description: 'Metadata readiness is below publishable threshold',
                    href: '/services/SVC-1/edit',
                    severity: 'warning',
                    created_at: '2026-04-26T10:00:00Z',
                },
            ],
        });

        const router = require('../routes/dashboard');
        const app = express();
        app.use('/api/v1/dashboard', router);

        const response = await request(app).get('/api/v1/dashboard/inbox');
        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0]).toMatchObject({
            type: 'service_review',
            title: 'ABC Planner',
            severity: 'warning',
        });
        expect(__query.mock.calls[0][1]).toEqual(['owner@example.com', 'owner@example.com']);
    });

    test('GET /summary returns decision cockpit counters', async () => {
        const { __query } = require('../db/pool');
        __query.mockResolvedValueOnce({
            rows: [{
                total_services: 12,
                services_ready_for_publish: 7,
                services_blocked_by_readiness: 5,
                overdue_reviews: 2,
                uncovered_capabilities: 4,
                over_covered_capabilities: 3,
                active_governance_reviews: 6,
                recent_decisions: 9,
            }],
        });

        const router = require('../routes/dashboard');
        const app = express();
        app.use('/api/v1/dashboard', router);

        const response = await request(app).get('/api/v1/dashboard/summary');
        expect(response.status).toBe(200);
        expect(response.body.summary).toMatchObject({
            total_services: 12,
            services_ready_for_publish: 7,
            services_blocked_by_readiness: 5,
            overdue_reviews: 2,
            uncovered_capabilities: 4,
            over_covered_capabilities: 3,
            active_governance_reviews: 6,
            recent_decisions: 9,
        });
        expect(response.body.links).toMatchObject({
            readiness_queue: '/operations/readiness',
            capability_coverage: '/capabilities/coverage',
            review_deadlines: '/operations/reviews',
            recent_decisions: '/operations/decisions',
        });
        expect(String(__query.mock.calls[0][0]).toLowerCase()).toContain('v_servicepublishreadiness');
        expect(String(__query.mock.calls[0][0]).toLowerCase()).toContain('v_capability_governance_coverage');
    });

    test('GET /summary works with empty data', async () => {
        const { __query } = require('../db/pool');
        __query.mockResolvedValueOnce({ rows: [] });

        const router = require('../routes/dashboard');
        const app = express();
        app.use('/api/v1/dashboard', router);

        const response = await request(app).get('/api/v1/dashboard/summary');
        expect(response.status).toBe(200);
        expect(response.body.summary).toEqual({
            total_services: 0,
            services_ready_for_publish: 0,
            services_blocked_by_readiness: 0,
            overdue_reviews: 0,
            uncovered_capabilities: 0,
            over_covered_capabilities: 0,
            active_governance_reviews: 0,
            recent_decisions: 0,
        });
    });
});
