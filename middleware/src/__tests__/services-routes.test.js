'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({ requireAuth: (req, res, next) => next() }));
jest.mock('../middleware/rbac', () => ({
    canEdit: (req, res, next) => next(),
    canAdmin: (req, res, next) => next(),
}));
jest.mock('../db/flavours.repo', () => ({}));
jest.mock('../db/relations.repo', () => ({}));
jest.mock('../db/audit.repo', () => ({}));
jest.mock('../services/validation', () => ({
    validateCreate: () => [],
    validateUpdate: () => [],
}));
jest.mock('../services/scoring', () => ({
    serviceScore: () => 0,
    serviceScoreDetailed: () => ({ score: 0, passed: [], failed: [], breakdown: [] }),
}));
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
}));
jest.mock('../db/pool', () => ({
    getPool: jest.fn(() => ({ query: jest.fn() })),
}));
jest.mock('../db/services.repo', () => ({
    findAllDirect: jest.fn(),
    findByServiceId: jest.fn(),
    serviceIdExists: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    updateScore: jest.fn(),
    setRole: jest.fn(),
    setDomains: jest.fn(),
}));

describe('services routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GET /services forwards multi-select status/type filters', async () => {
        const repo = require('../db/services.repo');
        repo.findAllDirect.mockResolvedValue({
            items: [],
            total: 0,
            page: 2,
            limit: 25,
        });

        const router = require('../routes/services');
        const app = express();
        app.use('/api/v1/services', router);

        const response = await request(app)
            .get('/api/v1/services?status=active,draft&service_type=CF,ES&page=2&limit=25');

        expect(response.status).toBe(200);
        expect(repo.findAllDirect).toHaveBeenCalledWith(expect.objectContaining({
            status: 'active,draft',
            serviceType: 'CF,ES',
            page: 2,
            limit: 25,
        }));
    });

    test('GET /services/export/csv returns filtered server-side csv', async () => {
        const repo = require('../db/services.repo');
        repo.findAllDirect.mockResolvedValue({
            items: [{
                service_id: 'SVC-1',
                title: '=SUM(1,1)\nService One',
                service_type: 'CF',
                service_status: 'active',
                portfolio_group: 'Application Services',
                service_owner: '+Owner',
                vlastnik: 'Area',
                manager: 'Manager',
                available_on: 'NEXUS,ORBIT',
                sla_availability: 99.9,
                updated_at: '2026-03-30T10:00:00Z',
            }],
            total: 1,
            page: 1,
            limit: 100000,
        });

        const router = require('../routes/services');
        const app = express();
        app.use('/api/v1/services', router);

        const response = await request(app)
            .get('/api/v1/services/export/csv?status=active&service_type=CF');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/csv');
        const lines = response.text.split('\n');
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain('"service_id","title","service_type"');
        expect(lines[1]).toContain('"SVC-1","\'=SUM(1,1) Service One","CF"');
        expect(lines[1]).not.toContain('\n');
    });
});
