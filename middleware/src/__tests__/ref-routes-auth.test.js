'use strict';

const express = require('express');
const request = require('supertest');

const mockAuthState = {
    authenticated: true,
    role: 'admin',
};

jest.mock('../db/pool', () => {
    const query = jest.fn();
    const pool = { query };
    return {
        __query: query,
        getPool: () => pool,
    };
});

jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        if (!mockAuthState.authenticated) {
            return res.status(401).json({ error: 'Neautorizovaný přístup' });
        }
        req.user = { id: 1, username: 'admin', role: mockAuthState.role };
        return next();
    },
}));

jest.mock('../middleware/rbac', () => ({
    canAdmin: (req, res, next) => {
        if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        return next();
    },
}));

function buildApp() {
    const { router } = require('../routes/ref');
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ref', router);
    return app;
}

describe('reference data routes authentication', () => {
    beforeEach(() => {
        jest.resetModules();
        mockAuthState.authenticated = true;
        mockAuthState.role = 'admin';
        const { __query } = require('../db/pool');
        __query.mockReset();
    });

    test.each([
        '/api/v1/ref',
        '/api/v1/ref/ref_ServiceStatus',
    ])('GET %s rejects unauthenticated reads', async (path) => {
        const { __query } = require('../db/pool');
        mockAuthState.authenticated = false;

        const response = await request(buildApp()).get(path);

        expect(response.status).toBe(401);
        expect(__query).not.toHaveBeenCalled();
    });

    test('GET /api/v1/ref returns table metadata for authenticated users', async () => {
        const response = await request(buildApp()).get('/api/v1/ref');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ table: 'ref_ServiceStatus', label: 'Service Status' }),
            ]),
        );
    });

    test('GET /api/v1/ref/:table returns reference rows for authenticated users', async () => {
        const { __query } = require('../db/pool');
        __query.mockResolvedValueOnce({
            rows: [{ code: 'active', name: 'Active', sort_order: 1, is_active: true }],
        });

        const response = await request(buildApp()).get('/api/v1/ref/ref_ServiceStatus');

        expect(response.status).toBe(200);
        expect(response.body.meta.table).toBe('ref_ServiceStatus');
        expect(response.body.rows).toHaveLength(1);
    });
});
