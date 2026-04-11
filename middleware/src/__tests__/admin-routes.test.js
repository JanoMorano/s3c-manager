'use strict';

const express = require('express');
const request = require('supertest');

const queryMock = jest.fn();

jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'admin' };
        next();
    },
}));
jest.mock('../middleware/rbac', () => ({
    canAdmin: (req, res, next) => next(),
    canEdit: (req, res, next) => next(),
}));
jest.mock('../db/audit.repo', () => ({
    log: jest.fn(),
}));
jest.mock('bcrypt', () => ({
    hash: jest.fn().mockResolvedValue('hashed-password'),
}));
jest.mock('../utils/platform-config', () => ({
    getConfigValues: jest.fn(),
    upsertConfigValue: jest.fn(),
    invalidateConfigValues: jest.fn(),
}));
jest.mock('../db/pool', () => ({
    getPlatformPool: jest.fn(),
    getPool: jest.fn(),
}));

function buildApp() {
    const router = require('../routes/admin');
    const app = express();
    app.use(express.json());
    app.use('/api/v1/admin', router);
    return app;
}

describe('admin routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        queryMock.mockReset();
        const pool = require('../db/pool');
        const { getConfigValues, upsertConfigValue, invalidateConfigValues } = require('../utils/platform-config');
        pool.getPlatformPool.mockReturnValue({ query: queryMock });
        pool.getPool.mockReturnValue({ query: queryMock });
        getConfigValues.mockResolvedValue({});
        upsertConfigValue.mockResolvedValue(undefined);
        invalidateConfigValues.mockImplementation(() => {});
    });

    test('GET /users returns user list with mapped labels', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{
                id: 7,
                username: 'jnovak',
                display_name: 'Jan Novak',
                email: 'jan.novak@example.local',
                role: 'editor',
                is_active: true,
                auth_provider: 'ad',
                external_principal: 'DOMAIN\\jnovak',
                last_login_at: null,
                last_sso_login_at: null,
                created_at: null,
                updated_at: null,
                given_name: 'Jan',
                surname: 'Novak',
                department: 'Architecture',
            }],
        });

        const response = await request(buildApp()).get('/api/v1/admin/users');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toEqual(expect.objectContaining({
            username: 'jnovak',
            role: 'editor',
            role_label: 'Content Admin - RW',
            auth_provider: 'ad',
            auth_provider_label: 'AD / SSO',
        }));
    });

    test('GET /users does not select password hashes for list responses', async () => {
        queryMock.mockResolvedValueOnce({ rows: [] });

        const response = await request(buildApp()).get('/api/v1/admin/users');

        expect(response.status).toBe(200);
        expect(queryMock).toHaveBeenCalledTimes(1);
        expect(queryMock.mock.calls[0][0]).not.toMatch(/password_hash/i);
    });

    test('POST /users rejects local account without password', async () => {
        const response = await request(buildApp())
            .post('/api/v1/admin/users')
            .send({
                username: 'new.user',
                role: 'viewer',
                auth_provider: 'local',
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/heslo/i);
    });

    test('GET /web-settings returns runtime SSO settings', async () => {
        const { getConfigValues } = require('../utils/platform-config');
        getConfigValues.mockResolvedValueOnce({
            'auth.sso.enabled': { config_value: 'true' },
            'auth.sso.header': { config_value: 'x-ms-client-principal-name' },
            'auth.sso.display_name_header': { config_value: 'x-ms-client-name' },
            'auth.sso.email_header': { config_value: 'x-ms-client-email' },
            'auth.sso.given_name_header': { config_value: 'x-ms-given-name' },
            'auth.sso.surname_header': { config_value: 'x-ms-surname' },
            'auth.sso.department_header': { config_value: 'x-ms-department' },
        });

        const response = await request(buildApp()).get('/api/v1/admin/web-settings');

        expect(response.status).toBe(200);
        expect(response.body.items).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'auth.sso.header',
                value: 'x-ms-client-principal-name',
            }),
            expect.objectContaining({
                key: 'auth.sso.enabled',
                value: 'true',
            }),
        ]));
    });

    test('GET /seed-status returns none mode for clean deploy without C3 seeds', async () => {
        queryMock
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [{
                    services: 0,
                    applications: 0,
                    data_objects: 0,
                    technology_interactions: 0,
                    ti_service_links: 0,
                    ti_application_links: 0,
                    ti_data_object_links: 0,
                }],
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ total_rows: 0, modified_rows: 0 }] });

        const response = await request(buildApp()).get('/api/v1/admin/seed-status');

        expect(response.status).toBe(200);
        expect(response.body.taxonomy.mode).toBe('none');
        expect(response.body.taxonomy.total).toBe(0);
        expect(response.body.capability_map.mode).toBe('none');
        expect(response.body.capability_map.total_rows).toBe(0);
    });
});
