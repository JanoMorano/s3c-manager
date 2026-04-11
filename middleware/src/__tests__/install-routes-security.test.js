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
jest.mock('../db/pool', () => ({
    getPlatformPool: jest.fn(),
    getPool: jest.fn(),
}));
jest.mock('../services/install.service', () => ({
    getInstallRow: jest.fn(),
    detectInstallMode: jest.fn(),
    acquireLock: jest.fn(),
    bootstrapAdmin: jest.fn(),
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
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const pool = require('../db/pool');
        pool.getPlatformPool.mockReturnValue({ query: queryMock });
        pool.getPool.mockReturnValue({ query: queryMock });

        const installSvc = require('../services/install.service');
        installSvc.detectInstallMode.mockResolvedValue({ mode: 'fresh', status: 'NOT_INSTALLED', row: null });
        installSvc.getInstallRow.mockResolvedValue({ id: 1, install_status: 'INSTALL_FAILED', lock_token: 'lock-1' });
        installSvc.acquireLock.mockResolvedValue({ ok: true, token: 'lock-1' });
        installSvc.bootstrapAdmin.mockResolvedValue({ ok: true, userId: 2 });
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
        ['POST /reset', 'post', '/api/v1/install/reset', { confirm: true }],
        ['POST /check-db', 'post', '/api/v1/install/check-db', {}],
    ])('%s requires authentication', async (_label, method, path, body) => {
        const app = buildApp();
        const response = await request(app)[method](path).send(body);

        expect(response.status).toBe(401);
    });

    test('POST /execute requires authentication on a fresh install', async () => {
        const app = buildApp();

        const response = await request(app)
            .post('/api/v1/install/execute')
            .send({
                activate_c3: false,
                seed_demo: false,
                performed_by: 'installer',
            });

        expect(response.status).toBe(401);
    });
});
