'use strict';

const express = require('express');
const request = require('supertest');

let mockCanEditAllows = true;

jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        req.user = { username: 'admin', email: 'admin@example.com', role: 'admin' };
        next();
    },
}));

jest.mock('../middleware/rbac', () => ({
    canView: (req, res, next) => next(),
    canEdit: (req, res, next) => {
        if (!mockCanEditAllows) return res.status(403).json({ error: 'Forbidden' });
        return next();
    },
}));

jest.mock('../db/governance.repo', () => ({
    listServiceRisks: jest.fn(),
    listOwnerLoad: jest.fn(),
    listOwnerAssignments: jest.fn(),
    listContractOverlap: jest.fn(),
    listRenewalRisks: jest.fn(),
    listAdvisorFindings: jest.fn(),
    dismissFinding: jest.fn(),
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

function buildApp() {
    const router = require('../routes/governance');
    const app = express();
    app.use(express.json());
    app.use('/api/v1/governance', router);
    return app;
}

describe('governance workflow routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCanEditAllows = true;
    });

    test('POST /reviews creates a review request and audits it', async () => {
        const repo = require('../db/governance.repo');
        const audit = require('../db/audit.repo');
        repo.createReview.mockResolvedValue({
            id: 10,
            service_id: 'SVC-IAM',
            review_type: 'publish',
            status: 'pending',
            requested_by: 'admin@example.com',
            assigned_to: 'owner@example.com',
        });

        const response = await request(buildApp())
            .post('/api/v1/governance/reviews')
            .send({
                service_id: 'SVC-IAM',
                review_type: 'publish',
                assigned_to: 'owner@example.com',
                due_at: '2026-06-01T00:00:00Z',
            });

        expect(response.status).toBe(201);
        expect(response.body.item.id).toBe(10);
        expect(repo.createReview).toHaveBeenCalledWith(expect.objectContaining({
            service_id: 'SVC-IAM',
            review_type: 'publish',
            status: 'pending',
            requested_by: 'admin@example.com',
            assigned_to: 'owner@example.com',
        }));
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
            tableName: 'GovernanceReview',
            action: 'INSERT',
            recordLabel: 'SVC-IAM:publish',
        }));
    });

    test('PATCH /reviews/:id updates assignment and status transition with audit', async () => {
        const repo = require('../db/governance.repo');
        const audit = require('../db/audit.repo');
        repo.updateReview.mockResolvedValue({
            id: 10,
            service_id: 'SVC-IAM',
            review_type: 'publish',
            status: 'in_review',
            assigned_to: 'reviewer@example.com',
        });

        const response = await request(buildApp())
            .patch('/api/v1/governance/reviews/10')
            .send({ status: 'in_review', assigned_to: 'reviewer@example.com' });

        expect(response.status).toBe(200);
        expect(repo.updateReview).toHaveBeenCalledWith(10, expect.objectContaining({
            status: 'in_review',
            assigned_to: 'reviewer@example.com',
            completed_at: null,
        }));
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
            tableName: 'GovernanceReview',
            action: 'UPDATE',
            recordId: 10,
        }));
    });

    test('POST /decisions rejects approval while readiness blockers remain', async () => {
        const repo = require('../db/governance.repo');
        const { getServiceReadiness } = require('../services/readiness');
        getServiceReadiness.mockResolvedValue({ service_id: 'SVC-IAM', blockers: ['Service has owner'] });

        const response = await request(buildApp())
            .post('/api/v1/governance/decisions')
            .send({
                service_id: 'SVC-IAM',
                decision_type: 'publish_approval',
                decision: 'approved',
                rationale: 'Ready for release',
            });

        expect(response.status).toBe(409);
        expect(response.body.error).toContain('readiness blockers');
        expect(repo.createDecision).not.toHaveBeenCalled();
    });

    test('POST /decisions creates an audited deferral decision with rationale', async () => {
        const repo = require('../db/governance.repo');
        const audit = require('../db/audit.repo');
        const { getServiceReadiness } = require('../services/readiness');
        getServiceReadiness.mockResolvedValue({ service_id: 'SVC-IAM', blockers: ['Service has owner'] });
        repo.createDecision.mockResolvedValue({
            id: 44,
            service_id: 'SVC-IAM',
            decision_type: 'deferral',
            decision: 'deferred',
            rationale: 'Owner remediation is tracked.',
            decided_by: 'admin@example.com',
        });

        const response = await request(buildApp())
            .post('/api/v1/governance/decisions')
            .send({
                service_id: 'SVC-IAM',
                decision_type: 'deferral',
                decision: 'deferred',
                rationale: 'Owner remediation is tracked.',
            });

        expect(response.status).toBe(201);
        expect(response.body.item.id).toBe(44);
        expect(repo.createDecision).toHaveBeenCalledWith(expect.objectContaining({
            service_id: 'SVC-IAM',
            decision_type: 'deferral',
            decision: 'deferred',
            rationale: 'Owner remediation is tracked.',
            decided_by: 'admin@example.com',
        }));
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
            tableName: 'GovernanceDecision',
            action: 'INSERT',
            recordLabel: 'SVC-IAM:deferral',
        }));
    });

    test('POST /decisions requires edit access', async () => {
        const repo = require('../db/governance.repo');
        mockCanEditAllows = false;

        const response = await request(buildApp())
            .post('/api/v1/governance/decisions')
            .send({
                service_id: 'SVC-IAM',
                decision_type: 'publish_approval',
                decision: 'approved',
            });

        expect(response.status).toBe(403);
        expect(repo.createDecision).not.toHaveBeenCalled();
    });
});
