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
});
