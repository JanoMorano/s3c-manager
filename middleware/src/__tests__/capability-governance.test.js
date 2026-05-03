'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        req.user = { username: 'admin', role: 'admin' };
        next();
    },
}));

jest.mock('../db/pool', () => ({
    getPool: jest.fn(),
}));

jest.mock('../db/capability-governance.repo', () => ({
    listCoverage: jest.fn(),
    listGaps: jest.fn(),
    listOverlaps: jest.fn(),
    getSpiralReadiness: jest.fn(),
}));

function buildApp() {
    const { router } = require('../routes/capabilities');
    const app = express();
    app.use(express.json());
    app.use('/api/v1/capabilities', router);
    return app;
}

describe('capability governance routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GET /coverage returns capability coverage cockpit rows and passes filters', async () => {
        const repo = require('../db/capability-governance.repo');
        repo.listCoverage.mockResolvedValue({
            items: [
                {
                    capability_uuid: 'cap-iam',
                    capability_code: 'C3-IAM',
                    capability_title: 'Identity capability',
                    slug: 'cap-bmc-identity',
                    spiral_code: 'Spiral_7',
                    domain: 'BMC',
                    service_count: 2,
                    ready_service_count: 1,
                    blocked_service_count: 1,
                    coverage_percent: 67,
                    gap_count: 2,
                    services: [{ service_id: 'SVC-IAM', title: 'Identity Access Management', readiness_state: 'ready' }],
                },
            ],
            counts: { total: 1, uncovered: 0, over_covered: 1, not_ready: 1 },
            filters: { spiral: 'Spiral_7', domain: 'BMC', lifecycle: 'live', owner: 'owner@example.com', readiness: 'blocked' },
        });

        const response = await request(buildApp())
            .get('/api/v1/capabilities/coverage?spiral=Spiral_7&domain=BMC&lifecycle=live&owner=owner%40example.com&readiness=blocked');

        expect(response.status).toBe(200);
        expect(response.body.items[0]).toEqual(expect.objectContaining({
            capability_uuid: 'cap-iam',
            service_count: 2,
            coverage_percent: 67,
        }));
        expect(repo.listCoverage).toHaveBeenCalledWith(expect.objectContaining({
            spiral: 'Spiral_7',
            domain: 'BMC',
            lifecycle: 'live',
            owner: 'owner@example.com',
            readiness: 'blocked',
        }));
    });

    test('GET /gaps handles empty or C3-disabled data without crashing', async () => {
        const repo = require('../db/capability-governance.repo');
        repo.listGaps.mockResolvedValue({ items: [], counts: { total: 0 }, filters: {} });

        const response = await request(buildApp()).get('/api/v1/capabilities/gaps');

        expect(response.status).toBe(200);
        expect(response.body.items).toEqual([]);
        expect(response.body.counts.total).toBe(0);
    });

    test('GET /overlaps returns duplicate service candidates', async () => {
        const repo = require('../db/capability-governance.repo');
        repo.listOverlaps.mockResolvedValue({
            items: [
                {
                    capability_uuid: 'cap-iam',
                    capability_title: 'Identity capability',
                    service_count: 3,
                    overlap_score: 92,
                    services: ['SVC-IAM', 'SVC-SSO', 'SVC-IDP'],
                    recommended_action: 'Review duplicate service support.',
                },
            ],
            counts: { total: 1 },
            filters: {},
        });

        const response = await request(buildApp()).get('/api/v1/capabilities/overlaps');

        expect(response.status).toBe(200);
        expect(response.body.items[0].services).toContain('SVC-SSO');
        expect(repo.listOverlaps).toHaveBeenCalledWith(expect.objectContaining({}));
    });

    test('GET /spirals/:code/readiness returns spiral readiness summary', async () => {
        const repo = require('../db/capability-governance.repo');
        repo.getSpiralReadiness.mockResolvedValue({
            spiral: { code: 'Spiral_7', name: 'FMN Spiral 7' },
            counts: { total: 2, ready: 1, not_ready: 1, uncovered: 1 },
            items: [{ capability_uuid: 'cap-iam', capability_title: 'Identity capability', readiness_state: 'not_ready' }],
        });

        const response = await request(buildApp()).get('/api/v1/capabilities/spirals/Spiral_7/readiness');

        expect(response.status).toBe(200);
        expect(response.body.spiral.code).toBe('Spiral_7');
        expect(repo.getSpiralReadiness).toHaveBeenCalledWith('Spiral_7', expect.objectContaining({}));
    });
});
