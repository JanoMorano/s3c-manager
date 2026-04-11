'use strict';

const express = require('express');
const request = require('supertest');

const queryMock = jest.fn();

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
}));
jest.mock('../config', () => ({
    app: { env: 'test', port: 4000 },
    rateLimit: { auth: { windowMs: 60000, max: 10 } },
    install: {
        setupToken: 'bootstrap-secret',
    },
    jwt: {
        secret: 'test-secret',
        expiryMinutes: 60,
        refreshDays: 7,
        issuer: 'service-catalogue',
        audience: 'service-catalogue-ui',
    },
    auth: {
        sso: {
            enabled: false,
            header: 'x-remote-user',
            displayNameHeader: 'x-remote-name',
            emailHeader: 'x-remote-email',
            givenNameHeader: 'x-remote-given-name',
            surnameHeader: 'x-remote-surname',
            departmentHeader: 'x-remote-department',
        },
    },
}));
jest.mock('../middleware/module-gates', () => ({
    invalidateModuleStatus: jest.fn(),
    requireModuleApiEnabled: jest.fn(() => (req, res, next) => next()),
}));
const mockRequireAuth = jest.fn((req, res, next) => {
    req.user = {
        id: 42,
        username: 'viewer',
        role: 'viewer',
    };
    next();
});
const mockCanAdmin = jest.fn((req, res, next) => res.status(403).json({ error: 'Forbidden' }));
jest.mock('../middleware/auth', () => ({
    requireAuth: (...args) => mockRequireAuth(...args),
}));
jest.mock('../middleware/rbac', () => ({
    canAdmin: (...args) => mockCanAdmin(...args),
}));
jest.mock('../db/pool', () => ({
    getPlatformPool: jest.fn(),
    getPool: jest.fn(),
}));
jest.mock('../services/install.service', () => ({
    getInstallRow: jest.fn(),
    detectInstallMode: jest.fn(),
    acquireLock: jest.fn(),
    bootstrapAdmin: jest.fn(),
    hasActiveAdminAccount: jest.fn(),
    executeInstall: jest.fn(),
    checkConnectivity: jest.fn(),
    getInstallSummary: jest.fn(),
    getModules: jest.fn(),
    releaseLock: jest.fn(),
    transitionTo: jest.fn(),
}));
jest.mock('../utils/platform-config', () => ({
    getConfigValues: jest.fn(),
    upsertConfigValue: jest.fn(),
    invalidateConfigValues: jest.fn(),
}));

function buildApp() {
    const router = require('../routes/install');
    const app = express();
    app.use(express.json());
    app.use('/api/v1/install', router);
    return app;
}

describe('install route security', () => {
    const validHeaders = { 'x-install-setup-token': 'bootstrap-secret' };
    const preReadyInstallRow = {
        id: 1,
        install_status: 'NOT_INSTALLED',
        lock_token: null,
        install_lock: false,
        locked_by: null,
    };

    function expectNoPrivilegedInstallSideEffects() {
        const installSvc = require('../services/install.service');
        expect(installSvc.acquireLock).not.toHaveBeenCalled();
        expect(installSvc.bootstrapAdmin).not.toHaveBeenCalled();
        expect(installSvc.executeInstall).not.toHaveBeenCalled();
        expect(installSvc.checkConnectivity).not.toHaveBeenCalled();
        expect(installSvc.transitionTo).not.toHaveBeenCalled();
        expect(installSvc.releaseLock).not.toHaveBeenCalled();
        expect(queryMock).not.toHaveBeenCalled();
    }

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockRequireAuth.mockClear();
        mockCanAdmin.mockClear();

        const pool = require('../db/pool');
        pool.getPlatformPool.mockReturnValue({ query: queryMock });
        pool.getPool.mockReturnValue({ query: queryMock });

        const installSvc = require('../services/install.service');
        installSvc.detectInstallMode.mockResolvedValue({ mode: 'fresh', status: 'NOT_INSTALLED', row: null });
        installSvc.getInstallRow.mockResolvedValue(preReadyInstallRow);
        installSvc.acquireLock.mockResolvedValue({ ok: true, token: 'lock-1' });
        installSvc.bootstrapAdmin.mockResolvedValue({ ok: true, userId: 2 });
        installSvc.hasActiveAdminAccount.mockResolvedValue(true);
        installSvc.executeInstall.mockResolvedValue({ ok: true, summary: { status: 'READY' } });
        installSvc.checkConnectivity.mockResolvedValue({
            db_reachable: true,
            db_write_access: true,
            platform_schema: true,
            errors: [],
        });
        installSvc.getInstallSummary.mockResolvedValue({ status: 'READY', modules: [] });
        installSvc.getModules.mockResolvedValue([]);
        installSvc.releaseLock.mockResolvedValue(undefined);
        installSvc.transitionTo.mockResolvedValue(undefined);

        queryMock.mockResolvedValue({ rows: [] });
    });

    test.each([
        ['POST /start', 'post', '/api/v1/install/start', { performed_by: 'attacker' }],
        ['POST /bootstrap-admin', 'post', '/api/v1/install/bootstrap-admin', {
            username: 'attacker',
            displayName: 'Attacker',
            email: 'attacker@example.local',
            password: 'Secret123!',
        }],
        ['POST /config', 'post', '/api/v1/install/config', {
            app_name: 'S3C',
            base_url: 'http://localhost:8080',
        }],
        ['POST /modules', 'post', '/api/v1/install/modules', { activate_c3: true }],
        ['POST /reset', 'post', '/api/v1/install/reset', { confirm: true }],
        ['POST /check-db', 'post', '/api/v1/install/check-db', {}],
    ])('%s requires a valid install setup token before READY', async (_label, method, path, body) => {
        const app = buildApp();
        const response = await request(app)[method](path).send(body);

        expect(response.status).toBe(401);
        expectNoPrivilegedInstallSideEffects();
    });

    test('GET /status remains public without a setup token', async () => {
        const app = buildApp();

        const response = await request(app).get('/api/v1/install/status');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(expect.objectContaining({
            status: 'NOT_INSTALLED',
        }));
    });

    test('POST /execute requires a valid install setup token on a fresh install', async () => {
        const app = buildApp();

        const response = await request(app)
            .post('/api/v1/install/execute')
            .send({
                activate_c3: false,
                seed_demo: false,
                performed_by: 'installer',
            });

        expect(response.status).toBe(401);
        expectNoPrivilegedInstallSideEffects();
    });

    test('POST /execute rejects install completion before the first admin exists', async () => {
        const app = buildApp();
        await request(app)
            .post('/api/v1/install/start')
            .set(validHeaders)
            .send({ performed_by: 'installer' });
        const installSvc = require('../services/install.service');
        installSvc.hasActiveAdminAccount.mockResolvedValue(false);

        const response = await request(app)
            .post('/api/v1/install/execute')
            .set(validHeaders)
            .send({
                activate_c3: false,
                seed_demo: false,
                performed_by: 'installer',
            });

        expect(response.status).toBe(422);
        expect(response.body.error).toMatch(/admin účet/i);
        expect(installSvc.executeInstall).not.toHaveBeenCalled();
    });

    test('POST /start accepts a valid install setup token before READY', async () => {
        const app = buildApp();

        const response = await request(app)
            .post('/api/v1/install/start')
            .set(validHeaders)
            .send({ performed_by: 'installer' });

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
    });

    test.each([
        ['POST /start', '/api/v1/install/start', { performed_by: 'installer' }, 'acquireLock'],
        ['POST /check-db', '/api/v1/install/check-db', {}, 'checkConnectivity'],
        ['POST /bootstrap-admin', '/api/v1/install/bootstrap-admin', {
            username: 'admin',
            displayName: 'Admin',
            email: 'admin@example.com',
            password: 'Admin123!',
        }, 'bootstrapAdmin'],
        ['POST /config', '/api/v1/install/config', {
            app_name: 'S3C',
            base_url: 'http://localhost:8080',
        }, 'queryMock'],
        ['POST /modules', '/api/v1/install/modules', { activate_c3: true }, 'queryMock'],
        ['POST /execute', '/api/v1/install/execute', { activate_c3: false, seed_demo: false, performed_by: 'installer' }, 'executeInstall'],
        ['POST /reset', '/api/v1/install/reset', { confirm: true }, 'queryMock'],
    ])('%s rejects setup-token-only access when READY', async (_label, path, body, sideEffect) => {
        const installSvc = require('../services/install.service');
        installSvc.getInstallRow.mockResolvedValue({
            id: 1,
            install_status: 'READY',
            lock_token: null,
            install_lock: false,
            locked_by: null,
        });

        const app = buildApp();
        const response = await request(app)
            .post(path)
            .set(validHeaders)
            .send(body);

        expect(response.status).toBe(403);
        expect(mockRequireAuth).toHaveBeenCalled();
        expect(mockCanAdmin).toHaveBeenCalled();
        if (sideEffect === 'queryMock') {
            expect(queryMock).not.toHaveBeenCalled();
        } else {
            expect(installSvc[sideEffect]).not.toHaveBeenCalled();
        }
    });

    test('POST /check-db accepts a valid install setup token before READY', async () => {
        const app = buildApp();

        const response = await request(app)
            .post('/api/v1/install/check-db')
            .set(validHeaders)
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
    });

    test('POST /modules accepts a valid install setup token before READY', async () => {
        const app = buildApp();

        const response = await request(app)
            .post('/api/v1/install/modules')
            .set(validHeaders)
            .send({ activate_c3: true });

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(response.body.modules).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'SERVICE_CATALOGUE_CORE' }),
            expect.objectContaining({ code: 'C3_TAXONOMY' }),
        ]));
    });
});
