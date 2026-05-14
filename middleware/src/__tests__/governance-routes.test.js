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
    listOwnerLoad: jest.fn(),
    listOwnerAssignments: jest.fn(),
    listReviews: jest.fn(),
    createReview: jest.fn(),
    updateReview: jest.fn(),
    listDecisions: jest.fn(),
    createDecision: jest.fn(),
}));

jest.mock('../db/audit.repo', () => ({
    log: jest.fn(),
}));

jest.mock('../services/readiness', () => ({
    getServiceReadiness: jest.fn(),
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

    test('GET /reviews supports my review filter from authenticated identity', async () => {
        const repo = require('../db/governance.repo');
        repo.listReviews.mockResolvedValue([]);

        const response = await request(buildApp())
            .get('/api/v1/governance/reviews?mine=1&status=pending,in_review');

        expect(response.status).toBe(200);
        expect(repo.listReviews).toHaveBeenCalledWith(expect.objectContaining({
            mine: true,
            mineIdentities: ['admin@example.com', 'admin'],
            overdue: false,
            status: ['pending', 'in_review'],
        }));
    });

    test('GET /reviews supports overdue review filter', async () => {
        const repo = require('../db/governance.repo');
        repo.listReviews.mockResolvedValue([]);

        const response = await request(buildApp())
            .get('/api/v1/governance/reviews?overdue=1');

        expect(response.status).toBe(200);
        expect(repo.listReviews).toHaveBeenCalledWith(expect.objectContaining({
            overdue: true,
        }));
    });

});
