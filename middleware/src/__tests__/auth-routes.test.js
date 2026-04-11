'use strict';

const express = require('express');
const request = require('supertest');

const queryMock = jest.fn();

jest.mock('express-rate-limit', () => () => (req, res, next) => next());
jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        req.user = {
            id: 1,
            username: 'admin',
            display_name: 'Admin',
            preferred_lang: 'cz',
            preferred_theme: 'dark',
        };
        next();
    },
}));
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
}));
jest.mock('../config', () => ({
    rateLimit: { auth: { windowMs: 60000, max: 10 } },
    jwt: {
        secret: 'test-secret',
        expiryMinutes: 60,
        refreshDays: 7,
        issuer: 'service-catalogue',
        audience: 'service-catalogue-ui',
    },
    auth: {
        sso: {
            enabled: true,
            header: 'x-remote-user',
            displayNameHeader: 'x-remote-name',
            emailHeader: 'x-remote-email',
            givenNameHeader: 'x-remote-given-name',
            surnameHeader: 'x-remote-surname',
            departmentHeader: 'x-remote-department',
        },
    },
}));
jest.mock('../utils/platform-config', () => ({
    getConfigValues: jest.fn(),
}));
jest.mock('../db/pool', () => ({
    getPlatformPool: jest.fn(),
}));

function buildApp() {
    const router = require('../routes/auth');
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', router);
    return app;
}

describe('auth routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        queryMock.mockReset();
        const pool = require('../db/pool');
        const { getConfigValues } = require('../utils/platform-config');
        pool.getPlatformPool.mockReturnValue({ query: queryMock });
        getConfigValues.mockResolvedValue({
            'auth.sso.enabled': { config_value: 'true' },
            'auth.sso.header': { config_value: 'x-remote-user' },
            'auth.sso.display_name_header': { config_value: 'x-remote-name' },
            'auth.sso.email_header': { config_value: 'x-remote-email' },
            'auth.sso.given_name_header': { config_value: 'x-remote-given-name' },
            'auth.sso.surname_header': { config_value: 'x-remote-surname' },
            'auth.sso.department_header': { config_value: 'x-remote-department' },
        });
    });

    test('GET /sso logs in matching AD user', async () => {
        queryMock
            .mockResolvedValueOnce({
                rows: [{
                    id: 7,
                    username: 'jnovak',
                    display_name: 'Jan Novak',
                    email: 'jan.novak@example.local',
                    role: 'editor',
                    is_active: true,
                    auth_provider: 'ad',
                    external_principal: 'DOMAIN\\jnovak',
                    preferred_lang: 'cz',
                    preferred_theme: 'dark',
                    given_name: 'Jan',
                    surname: 'Novak',
                    phone: null,
                    department: 'Architecture',
                    avatar_color: null,
                    last_login_at: null,
                    last_sso_login_at: null,
                }],
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 7,
                    username: 'jnovak',
                    display_name: 'Jan Novak',
                    email: 'jan.novak@example.local',
                    role: 'editor',
                    is_active: true,
                    auth_provider: 'ad',
                    external_principal: 'DOMAIN\\jnovak',
                    preferred_lang: 'cz',
                    preferred_theme: 'dark',
                    given_name: 'Jan',
                    surname: 'Novak',
                    phone: null,
                    department: 'Architecture',
                    avatar_color: null,
                    last_login_at: '2026-03-31T10:00:00.000Z',
                    last_sso_login_at: '2026-03-31T10:00:00.000Z',
                }],
            });

        const response = await request(buildApp())
            .get('/api/v1/auth/sso')
            .set('x-remote-user', 'DOMAIN\\jnovak')
            .set('x-remote-name', 'Jan Novak')
            .set('x-remote-email', 'jan.novak@example.local');

        expect(response.status).toBe(200);
        expect(response.body.user).toEqual(expect.objectContaining({
            username: 'jnovak',
            role: 'editor',
            auth_provider: 'ad',
        }));
        expect(response.body.access_token).toBeTruthy();
        expect(response.body.refresh_token).toBeTruthy();
    });

    test('POST /login rejects AD account for local password login', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{
                id: 7,
                username: 'jnovak',
                display_name: 'Jan Novak',
                role: 'editor',
                is_active: true,
                auth_provider: 'ad',
                password_hash: null,
                preferred_lang: 'cz',
                preferred_theme: 'dark',
            }],
        });

        const response = await request(buildApp())
            .post('/api/v1/auth/login')
            .send({ username: 'jnovak', password: 'Secret123!' });

        expect(response.status).toBe(401);
        expect(response.body.error).toMatch(/doménové přihlášení/i);
    });
});
