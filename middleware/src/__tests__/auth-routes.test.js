'use strict';

const bcrypt = require('bcrypt');
const express = require('express');
const request = require('supertest');

const queryMock = jest.fn();
const TRUSTED_PROXY_SECRET = 'proxy-secret';
const TRUSTED_PROXY_HEADER = 'x-sso-proxy-secret';

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
            trustedProxyHeader: TRUSTED_PROXY_HEADER,
            trustedProxySharedSecret: TRUSTED_PROXY_SECRET,
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
        require('../config').auth.sso.trustedProxySharedSecret = TRUSTED_PROXY_SECRET;
        require('../config').auth.sso.trustedProxyHeader = TRUSTED_PROXY_HEADER;
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
            .set(TRUSTED_PROXY_HEADER, TRUSTED_PROXY_SECRET)
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

    test.each([
        ['missing trusted proxy secret header', undefined],
        ['mismatched trusted proxy secret header', 'wrong-secret'],
    ])('GET /sso rejects %s and does not query users', async (_label, presentedSecret) => {
        const req = request(buildApp()).get('/api/v1/auth/sso');
        if (presentedSecret !== undefined) {
            req.set(TRUSTED_PROXY_HEADER, presentedSecret);
        }

        const response = await req
            .set('x-remote-user', 'DOMAIN\\jnovak')
            .set('x-remote-name', 'Jan Novak')
            .set('x-remote-email', 'jan.novak@example.local');

        expect(response.status).toBe(403);
        expect(response.body.error).toMatch(/trusted-proxy secret/i);
        expect(queryMock).not.toHaveBeenCalled();
    });

    test('GET /sso rejects when trusted proxy boundary secret is not configured', async () => {
        const config = require('../config');
        const previousSecret = config.auth.sso.trustedProxySharedSecret;
        config.auth.sso.trustedProxySharedSecret = '';

        try {
            const response = await request(buildApp())
                .get('/api/v1/auth/sso')
                .set(TRUSTED_PROXY_HEADER, TRUSTED_PROXY_SECRET)
                .set('x-remote-user', 'DOMAIN\\jnovak');

            expect(response.status).toBe(403);
            expect(response.body.error).toMatch(/trusted-proxy boundary is not configured/i);
            expect(queryMock).not.toHaveBeenCalled();
        } finally {
            config.auth.sso.trustedProxySharedSecret = previousSecret;
        }
    });

    test('GET /sso rejects when trusted proxy boundary header is blank', async () => {
        const config = require('../config');
        const previousHeader = config.auth.sso.trustedProxyHeader;
        config.auth.sso.trustedProxyHeader = '';

        try {
            const response = await request(buildApp())
                .get('/api/v1/auth/sso')
                .set(TRUSTED_PROXY_HEADER, TRUSTED_PROXY_SECRET)
                .set('x-remote-user', 'DOMAIN\\jnovak');

            expect(response.status).toBe(403);
            expect(response.body.error).toMatch(/trusted-proxy boundary header is not configured/i);
            expect(queryMock).not.toHaveBeenCalled();
        } finally {
            config.auth.sso.trustedProxyHeader = previousHeader;
        }
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

    test('POST /login sets httpOnly auth cookies on successful local login', async () => {
        const passwordHash = await bcrypt.hash('Secret123!', 4);
        queryMock
            .mockResolvedValueOnce({
                rows: [{
                    id: 11,
                    username: 'localadmin',
                    display_name: 'Local Admin',
                    role: 'admin',
                    is_active: true,
                    auth_provider: 'local',
                    password_hash: passwordHash,
                    preferred_lang: 'cz',
                    preferred_theme: 'dark',
                }],
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 11,
                    username: 'localadmin',
                    display_name: 'Local Admin',
                    role: 'admin',
                    is_active: true,
                    auth_provider: 'local',
                    preferred_lang: 'cz',
                    preferred_theme: 'dark',
                }],
            });

        const response = await request(buildApp())
            .post('/api/v1/auth/login')
            .send({ username: 'localadmin', password: 'Secret123!' });

        expect(response.status).toBe(200);
        expect(response.body.user).toEqual(expect.objectContaining({
            username: 'localadmin',
            role: 'admin',
        }));
        expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
            expect.stringMatching(/^sc_access_token=.*HttpOnly.*SameSite=Lax/i),
            expect.stringMatching(/^sc_refresh_token=.*HttpOnly.*SameSite=Lax/i),
        ]));
    });

    test('POST /refresh accepts refresh token from cookie and rotates auth cookies', async () => {
        const refreshToken = require('jsonwebtoken').sign({ sub: 7 }, 'test-secret', {
            expiresIn: '7d',
            issuer: 'service-catalogue',
            audience: 'service-catalogue-ui',
        });

        queryMock
            .mockResolvedValueOnce({
                rows: [{
                    id: 55,
                    user_id: 7,
                    expires_at: '2099-01-01T00:00:00.000Z',
                    revoked_at: null,
                }],
            })
            .mockResolvedValueOnce({
                rows: [{
                    id: 7,
                    username: 'jnovak',
                    display_name: 'Jan Novak',
                    email: 'jan.novak@example.local',
                    role: 'editor',
                    is_active: true,
                    auth_provider: 'local',
                    external_principal: null,
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
            .mockResolvedValueOnce({ rows: [] });

        const response = await request(buildApp())
            .post('/api/v1/auth/refresh')
            .set('Cookie', `sc_refresh_token=${encodeURIComponent(refreshToken)}`)
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.access_token).toBeTruthy();
        expect(response.body.refresh_token).toBeTruthy();
        expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
            expect.stringMatching(/^sc_access_token=.*HttpOnly.*SameSite=Lax/i),
            expect.stringMatching(/^sc_refresh_token=.*HttpOnly.*SameSite=Lax/i),
        ]));
        expect(queryMock).toHaveBeenNthCalledWith(
            1,
            'SELECT id, user_id, expires_at, revoked_at FROM platform.refresh_tokens WHERE token_hash = $1',
            [expect.any(String)]
        );
    });

    test('POST /logout revokes refresh token from cookie and clears auth cookies without request body', async () => {
        const response = await request(buildApp())
            .post('/api/v1/auth/logout')
            .set('Cookie', 'sc_refresh_token=refresh-cookie-token');

        expect(response.status).toBe(200);
        expect(response.body.message).toMatch(/odhlášení úspěšné/i);
        expect(queryMock).toHaveBeenCalledWith(
            'UPDATE platform.refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
            [expect.any(String)]
        );
        expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
            expect.stringMatching(/^sc_access_token=;.*HttpOnly.*SameSite=Lax/i),
            expect.stringMatching(/^sc_refresh_token=;.*HttpOnly.*SameSite=Lax/i),
        ]));
    });

    test('requireAuth ignores DEBUG_BYPASS_AUTH in secure mode', async () => {
        const original = process.env.DEBUG_BYPASS_AUTH;
        process.env.DEBUG_BYPASS_AUTH = 'true';

        try {
            jest.resetModules();

            jest.doMock('../config', () => ({
                jwt: {
                    secret: 'test-secret',
                    expiryMinutes: 60,
                    refreshDays: 7,
                    issuer: 'service-catalogue',
                    audience: 'service-catalogue-ui',
                },
            }));
            jest.doMock('../db/pool', () => ({
                getPlatformPool: jest.fn(),
            }));
            jest.unmock('../middleware/auth');

            await new Promise((resolve, reject) => {
                jest.isolateModules(() => {
                    try {
                        const { requireAuth } = require('../middleware/auth');
                        const req = {
                            headers: {},
                            path: '/api/v1/services',
                            ip: '127.0.0.1',
                            get: () => null,
                        };
                        const res = {
                            status: jest.fn(() => res),
                            json: jest.fn(() => res),
                        };
                        const next = jest.fn();

                        (async () => {
                            await requireAuth(req, res, next);
                            expect(req.user).toBeUndefined();
                            expect(next).not.toHaveBeenCalled();
                            expect(res.status).toHaveBeenCalledWith(401);
                            resolve();
                        })().catch(reject);

                    } catch (err) {
                        reject(err);
                    }
                });
            });
        } finally {
            process.env.DEBUG_BYPASS_AUTH = original;
            jest.resetModules();
        }
    });
});
