'use strict';

const express = require('express');
const request = require('supertest');
let mockCurrentRole = 'viewer';

jest.mock('../db/pool', () => {
    const query = jest.fn();
    const pool = { query };
    return {
        __query: query,
        getPool: () => pool,
        getPlatformPool: () => pool,
    };
});

jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        req.user = {
            id: 42,
            username: mockCurrentRole === 'admin' ? 'admin' : 'viewer',
            role: mockCurrentRole,
        };
        next();
    },
}));
const mockFindAllForExport = jest.fn(async () => [{ service_id: 'SVC-1' }]);
jest.mock('../db/services.repo', () => ({ findAllForExport: mockFindAllForExport }));

jest.mock('../middleware/rbac', () => ({
    canAdmin: (req, res, next) => {
        if (req.user?.role === 'admin') {
            return next();
        }

        return res.status(403).json({ error: 'Forbidden' });
    },
}));

describe('export routes', () => {
    beforeEach(() => {
        jest.resetModules();
        mockCurrentRole = 'viewer';
        const { __query } = require('../db/pool');
        __query.mockReset();
        mockFindAllForExport.mockClear();
    });

    test('GET /manifest returns manifest payload with scope', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({ rows: [{ bundle_key: 'service_catalog_bundle', contract_version: '2026-03-30.c3-v3' }] })
            .mockResolvedValueOnce({ rows: [{ route_key: 'export.bundle', feature_area: 'export', canonical_path: '/api/v1/export/bundle', export_endpoint: '/api/v1/export/bundle' }] });

        const router = require('../routes/exports');
        const app = express();
        app.use('/api/v1/export', router);

        const response = await request(app).get('/api/v1/export/manifest?scope=pricing');
        expect(response.status).toBe(200);
        expect(response.body.scope).toBe('pricing');
        expect(response.body.contract_version).toBe('2026-03-30.c3-v3');
        expect(response.headers['x-cache-tags']).toContain('export:manifest:pricing');
    });

    test('GET /bundle returns expanded export payload', async () => {
        const { __query } = require('../db/pool');
        mockCurrentRole = 'admin';
        __query
            .mockResolvedValueOnce({ rows: [{ contract_version: '2026-03-30.c3-v3', schema_version: 'canonical-23' }] })
            .mockResolvedValueOnce({ rows: [{ route_key: 'export.bundle' }] })
            .mockResolvedValueOnce({ rows: [{ uuid: 'c3-1' }] })
            .mockResolvedValueOnce({ rows: [{ uuid: 'c3-1' }] })
            .mockResolvedValueOnce({ rows: [{ edge_kind: 'parent_child' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'svc:SVC-1' }] })
            .mockResolvedValueOnce({ rows: [{ flavour_code: 'BASE' }] })
            .mockResolvedValueOnce({ rows: [{ sla_pk: 1 }] })
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            .mockResolvedValueOnce({ rows: [{ id: 11 }] })
            .mockResolvedValueOnce({ rows: [{ id: 21 }] })
            .mockResolvedValueOnce({ rows: [{ policy_key: 'import_issue' }] })
            .mockResolvedValueOnce({ rows: [{ id: 31 }] })
            .mockResolvedValueOnce({ rows: [{ id: 41 }] })
            .mockResolvedValueOnce({ rows: [] });

        const router = require('../routes/exports');
        const app = express();
        app.use('/api/v1/export', router);

        const response = await request(app).get('/api/v1/export/bundle');
        expect(response.status).toBe(200);
        expect(response.body.contract_version).toBe('2026-03-30.c3-v3');
        expect(response.body.schema_version).toBe('canonical-23');
        expect(response.body.import_rows).toHaveLength(1);
        expect(response.body.import_issues).toHaveLength(1);
        expect(response.body.retention_policies).toHaveLength(1);
        expect(response.headers['x-cache-tags']).toContain('export:bundle');
        expect(mockFindAllForExport).toHaveBeenCalledTimes(1);
    });

    test('GET /capability-map-hierarchy returns hierarchy export', async () => {
        const { __query } = require('../db/pool');
        __query.mockResolvedValueOnce({ rows: [{ uuid: 'c3-1', parent_title: 'Root' }] });

        const router = require('../routes/exports');
        const app = express();
        app.use('/api/v1/export', router);

        const response = await request(app).get('/api/v1/export/capability-map-hierarchy');
        expect(response.status).toBe(200);
        expect(response.body[0].uuid).toBe('c3-1');
        expect(response.headers['x-cache-tags']).toContain('export:capability-map');
    });

    test('GET /c3-relationships returns relationship export', async () => {
        const { __query } = require('../db/pool');
        __query.mockResolvedValueOnce({ rows: [{ edge_kind: 'parent_child', source_id: 'c3-parent' }] });

        const router = require('../routes/exports');
        const app = express();
        app.use('/api/v1/export', router);

        const response = await request(app).get('/api/v1/export/c3-relationships');
        expect(response.status).toBe(200);
        expect(response.body[0].edge_kind).toBe('parent_child');
        expect(response.headers['x-cache-tags']).toContain('export:c3-relationships');
    });

    test('GET /governance-report returns portfolio readiness capability and decision bundle', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({ rows: [{ portfolio_code: 'CORE' }] })
            .mockResolvedValueOnce({ rows: [{ service_id: 'SVC-IAM', readiness_state: 'ready' }] })
            .mockResolvedValueOnce({ rows: [{ capability_uuid: 'cap-iam' }] })
            .mockResolvedValueOnce({ rows: [{ id: 44, decision: 'approved' }] });

        const router = require('../routes/exports');
        const app = express();
        app.use('/api/v1/export', router);

        const response = await request(app).get('/api/v1/export/governance-report');

        expect(response.status).toBe(200);
        expect(response.body.portfolios).toHaveLength(1);
        expect(response.body.readiness).toHaveLength(1);
        expect(response.body.capability_coverage).toHaveLength(1);
        expect(response.body.decisions).toHaveLength(1);
        expect(response.headers['x-cache-tags']).toContain('export:governance-report');
    });

    test('GET /backstage/catalog-info exports Backstage YAML', async () => {
        mockFindAllForExport.mockResolvedValueOnce([
            {
                service_id: 'SVC-IAM',
                title: 'Identity Access Management',
                service_type: 'platform',
                lifecycle_stage_code: 'active',
                service_owner: 'group:identity-platform',
            },
        ]);

        const router = require('../routes/exports');
        const app = express();
        app.use('/api/v1/export', router);

        const response = await request(app).get('/api/v1/export/backstage/catalog-info');

        expect(response.status).toBe(200);
        expect(response.type).toContain('yaml');
        expect(response.text).toContain('kind: Component');
        expect(response.text).toContain('s3c/service-id: SVC-IAM');
    });

    test('GET /bundle rejects non-admin access', async () => {
        const { __query } = require('../db/pool');

        const router = require('../routes/exports');
        const app = express();
        app.use('/api/v1/export', router);

        const response = await request(app).get('/api/v1/export/bundle');
        expect(response.status).toBe(403);
        expect(__query).not.toHaveBeenCalled();
        expect(mockFindAllForExport).not.toHaveBeenCalled();
    });

});
