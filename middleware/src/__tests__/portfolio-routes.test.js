'use strict';

const express = require('express');
const request = require('supertest');

let mockCurrentRole = 'admin';

jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        req.user = { username: 'tester', email: 'tester@example.com', role: mockCurrentRole };
        next();
    },
}));

jest.mock('../middleware/rbac', () => {
    const ROLE_LEVELS = { viewer: 1, editor: 2, admin: 3 };
    function requireRole(minRole) {
        return (req, res, next) => {
            const userLevel = ROLE_LEVELS[req.user?.role] || 0;
            const required = ROLE_LEVELS[minRole] || 99;
            if (userLevel < required) return res.status(403).json({ error: 'forbidden' });
            next();
        };
    }
    return {
        canView: requireRole('viewer'),
        canEdit: requireRole('editor'),
        canAdmin: requireRole('admin'),
    };
});

jest.mock('../db/portfolio.repo', () => ({
    list: jest.fn(),
    getByCode: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
}));

jest.mock('../db/audit.repo', () => ({
    log: jest.fn(),
}));

describe('portfolio routes', () => {
    function buildApp() {
        const router = require('../routes/portfolio');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/portfolio', router);
        return app;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        mockCurrentRole = 'admin';
    });

    test('GET /portfolio returns filtered portfolio rows', async () => {
        const repo = require('../db/portfolio.repo');
        repo.list.mockResolvedValue([
            {
                portfolio_code: 'APP',
                title: 'Application Services',
                status_code: 'active',
                service_count: 7,
                overdue_review_count: 2,
            },
        ]);

        const response = await request(buildApp())
            .get('/api/v1/portfolio?status=active&owner_group_id=3&lifecycle=live');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            items: [
                expect.objectContaining({
                    portfolio_code: 'APP',
                    service_count: 7,
                    overdue_review_count: 2,
                }),
            ],
            count: 1,
        });
        expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({
            status: 'active',
            ownerGroupId: 3,
            lifecycle: 'live',
        }));
    });

    test('GET /portfolio/:code returns one portfolio with services', async () => {
        const repo = require('../db/portfolio.repo');
        repo.getByCode.mockResolvedValue({
            portfolio_code: 'APP',
            title: 'Application Services',
            services: [{ service_id: 'SVC-IAM', title: 'Identity Access Management' }],
        });

        const response = await request(buildApp()).get('/api/v1/portfolio/APP');

        expect(response.status).toBe(200);
        expect(response.body.item).toEqual(expect.objectContaining({
            portfolio_code: 'APP',
            services: [expect.objectContaining({ service_id: 'SVC-IAM' })],
        }));
    });

    test('GET /portfolio/:code returns 404 for unknown portfolio', async () => {
        const repo = require('../db/portfolio.repo');
        repo.getByCode.mockResolvedValue(null);

        const response = await request(buildApp()).get('/api/v1/portfolio/MISSING');

        expect(response.status).toBe(404);
    });

    test('POST /portfolio creates portfolio and writes audit log', async () => {
        const repo = require('../db/portfolio.repo');
        const audit = require('../db/audit.repo');
        repo.create.mockResolvedValue({
            id: 12,
            portfolio_code: 'C2',
            title: 'Command Services',
            status_code: 'active',
        });

        const response = await request(buildApp())
            .post('/api/v1/portfolio')
            .send({
                portfolio_code: 'C2',
                title: 'Command Services',
                description: 'Operational command portfolio',
                status_code: 'active',
                owner_group_id: 4,
            });

        expect(response.status).toBe(201);
        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
            portfolio_code: 'C2',
            title: 'Command Services',
            status_code: 'active',
            owner_group_id: 4,
        }));
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
            tableName: 'ServicePortfolio',
            recordLabel: 'C2',
            action: 'INSERT',
            performedBy: 'tester@example.com',
        }));
    });

    test('PATCH /portfolio/:code updates portfolio and writes audit log', async () => {
        const repo = require('../db/portfolio.repo');
        const audit = require('../db/audit.repo');
        repo.update.mockResolvedValue({
            portfolio_code: 'APP',
            title: 'Application Portfolio',
            status_code: 'active',
        });

        const response = await request(buildApp())
            .patch('/api/v1/portfolio/APP')
            .send({ title: 'Application Portfolio' });

        expect(response.status).toBe(200);
        expect(repo.update).toHaveBeenCalledWith('APP', { title: 'Application Portfolio' });
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
            tableName: 'ServicePortfolio',
            recordLabel: 'APP',
            action: 'UPDATE',
            performedBy: 'tester@example.com',
        }));
    });

    test('viewer cannot create portfolio rows', async () => {
        mockCurrentRole = 'viewer';

        const response = await request(buildApp())
            .post('/api/v1/portfolio')
            .send({ portfolio_code: 'APP', title: 'Application Services' });

        expect(response.status).toBe(403);
    });
});
