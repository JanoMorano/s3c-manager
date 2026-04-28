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
    canEdit: (req, res, next) => next(),
}));

jest.mock('../db/governance.repo', () => ({
    listServiceRisks: jest.fn(),
    listOwnerLoad: jest.fn(),
    listOwnerAssignments: jest.fn(),
    listContractOverlap: jest.fn(),
    listRenewalRisks: jest.fn(),
    listAdvisorFindings: jest.fn(),
    dismissFinding: jest.fn(),
}));

describe('governance routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    function buildApp() {
        const router = require('../routes/governance');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/governance', router);
        return app;
    }

    test('GET /risk-radar returns filtered findings', async () => {
        const repo = require('../db/governance.repo');
        repo.listServiceRisks.mockResolvedValue([
            { finding_key: 'service:1:missing-owner', severity: 'P0' },
        ]);

        const response = await request(buildApp())
            .get('/api/v1/governance/risk-radar?severity=P0&limit=10');

        expect(response.status).toBe(200);
        expect(response.body.items).toEqual([
            { finding_key: 'service:1:missing-owner', severity: 'P0' },
        ]);
        expect(repo.listServiceRisks).toHaveBeenCalledWith(expect.objectContaining({
            severity: ['P0'],
            limit: 10,
            offset: 0,
        }));
    });

    test('GET /owner-load returns owner score rows', async () => {
        const repo = require('../db/governance.repo');
        repo.listOwnerLoad.mockResolvedValue([
            { owner_key: 'owner@example.com', owner_load_score: 42 },
        ]);

        const response = await request(buildApp())
            .get('/api/v1/governance/owner-load?owner=owner@example.com');

        expect(response.status).toBe(200);
        expect(response.body.items[0].owner_load_score).toBe(42);
        expect(repo.listOwnerLoad).toHaveBeenCalledWith(expect.objectContaining({
            owner: 'owner@example.com',
        }));
    });

    test('GET /owner-load/assignments returns role assignments for one owner', async () => {
        const repo = require('../db/governance.repo');
        repo.listOwnerAssignments.mockResolvedValue([
            {
                owner_key: 'owner@example.com',
                service_id: 'SVC-IAM',
                role_code: 'service_owner',
            },
        ]);

        const response = await request(buildApp())
            .get('/api/v1/governance/owner-load/assignments?owner=owner@example.com');

        expect(response.status).toBe(200);
        expect(response.body.items).toEqual([
            {
                owner_key: 'owner@example.com',
                service_id: 'SVC-IAM',
                role_code: 'service_owner',
            },
        ]);
        expect(repo.listOwnerAssignments).toHaveBeenCalledWith(expect.objectContaining({
            owner: 'owner@example.com',
            limit: 50,
            offset: 0,
        }));
    });

    test('POST /findings/:id/dismiss stores dismissal reason and actor', async () => {
        const repo = require('../db/governance.repo');
        repo.dismissFinding.mockResolvedValue({ finding_id: 123, dismissal_id: 77 });

        const response = await request(buildApp())
            .post('/api/v1/governance/findings/owner%3Aowner%40example.com%3Aoverloaded/dismiss')
            .send({ reason: 'Ownership delegated' });

        expect(response.status).toBe(200);
        expect(response.body.item).toEqual({ finding_id: 123, dismissal_id: 77 });
        expect(repo.dismissFinding).toHaveBeenCalledWith({
            findingId: 'owner:owner@example.com:overloaded',
            reason: 'Ownership delegated',
            actor: 'admin@example.com',
        });
    });
});
