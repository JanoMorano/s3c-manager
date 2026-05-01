'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        req.user = { username: 'admin', email: 'admin@example.com', role: 'admin' };
        next();
    },
}));

jest.mock('../middleware/rbac', () => ({
    canView: (req, res, next) => next(),
}));

jest.mock('../db/relations.repo', () => ({
    getServiceImpact: jest.fn(),
    getCapabilityImpact: jest.fn(),
}));

function buildApp() {
    const router = require('../routes/impact');
    const app = express();
    app.use(express.json());
    app.use('/api/v1/impact', router);
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        res.status(err.status || 500).json({ error: err.message });
    });
    return app;
}

function impactPayload() {
    return {
        root: { node_id: 'svc:SVC-IAM', node_kind: 'service', node_key: 'SVC-IAM', title: 'Identity Access Management' },
        direction: 'downstream',
        max_depth: 3,
        depth_reached: 2,
        total_impacted: 2,
        nodes: [
            { node_id: 'svc:SVC-IAM', node_kind: 'service', node_key: 'SVC-IAM', title: 'Identity Access Management', depth: 0 },
            { node_id: 'svc:SVC-PORTAL', node_kind: 'service', node_key: 'SVC-PORTAL', title: 'Employee Portal', depth: 1 },
            { node_id: 'c3:cap-iam', node_kind: 'c3_capability', node_key: 'C3-IAM', title: 'Identity capability', depth: 1 },
        ],
        edges: [
            { source_node_id: 'svc:SVC-IAM', target_node_id: 'svc:SVC-PORTAL', relation_kind: 'depends_on' },
            { source_node_id: 'svc:SVC-IAM', target_node_id: 'c3:cap-iam', relation_kind: 'primary' },
        ],
        paths: [
            { node_id: 'svc:SVC-PORTAL', depth: 1, path: ['svc:SVC-IAM', 'svc:SVC-PORTAL'] },
            { node_id: 'c3:cap-iam', depth: 1, path: ['svc:SVC-IAM', 'c3:cap-iam'] },
        ],
    };
}

describe('impact routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GET /services/:id returns service impact with normalized query options', async () => {
        const repo = require('../db/relations.repo');
        repo.getServiceImpact.mockResolvedValue(impactPayload());

        const response = await request(buildApp())
            .get('/api/v1/impact/services/SVC-IAM?direction=downstream&depth=3&include=services,c3');

        expect(response.status).toBe(200);
        expect(response.body.total_impacted).toBe(2);
        expect(repo.getServiceImpact).toHaveBeenCalledWith('SVC-IAM', {
            direction: 'downstream',
            depth: 3,
            include: ['services', 'c3'],
        });
    });

    test('GET /services/:id clamps max depth and rejects unsupported direction', async () => {
        const repo = require('../db/relations.repo');
        repo.getServiceImpact.mockResolvedValue(impactPayload());

        const ok = await request(buildApp())
            .get('/api/v1/impact/services/SVC-IAM?depth=99');
        expect(ok.status).toBe(200);
        expect(repo.getServiceImpact).toHaveBeenCalledWith('SVC-IAM', expect.objectContaining({ depth: 10 }));

        const bad = await request(buildApp())
            .get('/api/v1/impact/services/SVC-IAM?direction=sideways');
        expect(bad.status).toBe(400);
    });

    test('GET /capabilities/:id returns capability impact', async () => {
        const repo = require('../db/relations.repo');
        repo.getCapabilityImpact.mockResolvedValue({
            ...impactPayload(),
            root: { node_id: 'c3:cap-iam', node_kind: 'c3_capability', node_key: 'C3-IAM', title: 'Identity capability' },
        });

        const response = await request(buildApp())
            .get('/api/v1/impact/capabilities/C3-IAM?direction=upstream&include=services,capabilities');

        expect(response.status).toBe(200);
        expect(repo.getCapabilityImpact).toHaveBeenCalledWith('C3-IAM', {
            direction: 'upstream',
            depth: 3,
            include: ['services', 'capabilities'],
        });
    });

    test('returns repository 404 errors as HTTP 404', async () => {
        const repo = require('../db/relations.repo');
        const err = new Error('Impact root not found');
        err.status = 404;
        repo.getServiceImpact.mockRejectedValue(err);

        const response = await request(buildApp()).get('/api/v1/impact/services/MISSING');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Impact root not found');
    });
});
