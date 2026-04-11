'use strict';

const request = require('supertest');

jest.mock('../config', () => ({
    app: { env: 'test', port: 4000 },
    cors: { origins: ['http://localhost:3000'] },
    rateLimit: { api: { windowMs: 60000, max: 500 } },
    retention: { enabled: true, runnerName: 'inline-app', heartbeatTtlSeconds: 180 },
    db: { server: 'postgres' },
    dbPlatform: { database: 'service_catalogue' },
    dbData: { database: 'service_catalogue' },
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
}));

jest.mock('../db/pool', () => {
    const query = jest.fn();
    const pool = { query };
    return {
        __query: query,
        initDb: jest.fn(async () => {}),
        closePools: jest.fn(async () => {}),
        getPool: () => pool,
    };
});

jest.mock('../routes/auth', () => { const express = require('express'); return express.Router(); });
jest.mock('../routes/services', () => { const express = require('express'); return express.Router(); });
jest.mock('../routes/flavours', () => { const express = require('express'); return express.Router(); });
jest.mock('../routes/relations', () => { const express = require('express'); return express.Router(); });
jest.mock('../routes/stats', () => { const express = require('express'); return express.Router(); });
jest.mock('../routes/taxonomy', () => { const express = require('express'); return express.Router(); });
jest.mock('../routes/import', () => { const express = require('express'); return express.Router(); });
jest.mock('../routes/admin', () => { const express = require('express'); return express.Router(); });
jest.mock('../routes/graph', () => { const express = require('express'); return express.Router(); });
jest.mock('../routes/exports', () => { const express = require('express'); return express.Router(); });
jest.mock('../routes/ref', () => {
    const express = require('express');
    return { router: express.Router() };
});

describe('server health endpoints', () => {
    beforeEach(() => {
        jest.resetModules();
        const { __query } = require('../db/pool');
        __query.mockReset();
        __query.mockImplementation(async (sqlText) => {
            if (sqlText.includes('FROM data.import_batch')) {
                return { rows: [{ id: 11, filename: 'ncia.json', row_count: 123, ok_count: 123, warn_count: 0, error_count: 0 }] };
            }
            if (sqlText.includes('FROM data.v_retentionjobauditexport')) {
                return { rows: [{ id: 21, status: 'success', trigger_source: 'inline-app' }] };
            }
            if (sqlText.includes('FROM data.v_retentionrunnerheartbeat')) {
                return { rows: [{ runner_name: 'inline-app', last_seen_at: new Date().toISOString(), last_job_status: 'success' }] };
            }
            return { rows: [{ ok: 1 }] };
        });
    });

    test('GET /health/import returns import pipeline and retention runner status', async () => {
        const app = require('../server');
        const response = await request(app).get('/health/import');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(response.body.runner_heartbeat_fresh).toBe(true);
        expect(response.body.last_import_batch.id).toBe(11);
        expect(response.body.last_retention_job.id).toBe(21);
        expect(response.body.retention_runner.runner_name).toBe('inline-app');
    });

    test('GET /api/health/live returns liveness payload', async () => {
        const app = require('../server');
        const response = await request(app).get('/api/health/live');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(typeof response.body.uptime).toBe('number');
    });

    test('GET /api/health/ready returns readiness payload with DB state', async () => {
        const app = require('../server');
        const response = await request(app).get('/api/health/ready');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(response.body.database).toBe('connected');
        expect(response.body.timestamp).toBeTruthy();
    });
});
