'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        req.user = { username: 'tester', role: 'admin' };
        next();
    },
}));
jest.mock('../middleware/rbac', () => ({
    canEdit: (req, res, next) => next(),
    canAdmin: (req, res, next) => next(),
}));
jest.mock('../db/flavours.repo', () => ({
    findByService: jest.fn().mockResolvedValue([]),
}));
jest.mock('../db/relations.repo', () => ({
    findByService: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
}));
jest.mock('../db/audit.repo', () => ({
    log: jest.fn(),
    addChangelog: jest.fn(),
    findByRecord: jest.fn(),
}));
jest.mock('../db/offerings.repo', () => ({
    listByService: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
}));
jest.mock('../db/support-model.repo', () => ({
    listByService: jest.fn(),
    replaceForService: jest.fn(),
}));
jest.mock('../db/audience.repo', () => ({
    listByService: jest.fn(),
    replaceForService: jest.fn(),
}));
jest.mock('../db/operational-links.repo', () => ({
    listByService: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
}));
jest.mock('../services/validation', () => ({
    validateCreate: jest.fn(() => []),
    validateUpdate: jest.fn(() => []),
    validateOffering: jest.fn(() => []),
    validateSupportModel: jest.fn(() => []),
    validateAudiencePolicy: jest.fn(() => []),
    validateOperationalLink: jest.fn(() => []),
    validateLifecycleOperationalReadiness: jest.requireActual('../services/validation').validateLifecycleOperationalReadiness,
}));
jest.mock('../services/scoring', () => ({
    serviceScore: jest.fn(() => 0),
    serviceScoreDetailed: jest.fn(() => ({ score: 0, passed: [], failed: [], breakdown: [] })),
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
    getCatalogId: jest.fn(),
}));

describe('services phase 1 routes', () => {
    function buildApp() {
        const router = require('../routes/services');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/services', router);
        return app;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        const servicesRepo = require('../db/services.repo');
        servicesRepo.getCatalogId.mockResolvedValue(101);
        servicesRepo.findByServiceId.mockResolvedValue({
            id: 101,
            service_id: 'SVC-1',
            service_status: 'draft',
            service_type: 'CF',
            summary: 'Current summary',
            business_summary: 'Business summary',
            requestable: true,
            lifecycle_state: 'draft',
            target_audience_summary: 'Internal staff',
            request_channel_type: 'portal',
            request_channel_url: 'https://example.test/request',
            approval_required: true,
            fulfillment_lead_time_text: '3 business days',
            c3_uuid: null,
            relation_count: 0,
            flavour_count: 0,
        });
    });

    test('GET /services/:id returns additive phase 2 detail blocks', async () => {
        const offeringsRepo = require('../db/offerings.repo');
        const supportModelRepo = require('../db/support-model.repo');
        const audienceRepo = require('../db/audience.repo');
        const operationalLinksRepo = require('../db/operational-links.repo');

        offeringsRepo.listByService.mockResolvedValue([
            { id: 1, service_id: 101, offering_code: 'STD', title: 'Standard', is_default: true },
        ]);
        supportModelRepo.listByService.mockResolvedValue([
            { id: 2, service_id: 101, offering_id: null, support_owner_name: 'Ops Team' },
        ]);
        audienceRepo.listByService.mockResolvedValue([
            { id: 3, service_id: 101, offering_id: null, audience_type: 'internal' },
        ]);
        operationalLinksRepo.listByService.mockResolvedValue([
            { id: 4, service_id: 101, title: 'Runbook', url: 'https://example.test/runbook' },
        ]);

        const response = await request(buildApp()).get('/api/v1/services/SVC-1');

        expect(response.status).toBe(200);
        expect(response.body.offerings).toHaveLength(1);
        expect(response.body.primary_offering).toEqual(expect.objectContaining({ offering_code: 'STD' }));
        expect(response.body.support_model).toHaveLength(1);
        expect(response.body.audience_policies).toHaveLength(1);
        expect(response.body.operational_links).toHaveLength(1);
        expect(response.body.business_view).toEqual(expect.objectContaining({
            business_summary: 'Business summary',
            requestable: true,
            lifecycle_state: 'draft',
            primary_offering: expect.objectContaining({ offering_code: 'STD' }),
        }));
        expect(response.body.technical_view).toEqual(expect.objectContaining({
            service_type: 'CF',
            service_status: 'draft',
            has_primary_offering: true,
        }));
    });

    test('GET /services/:id/offerings returns offering items', async () => {
        const offeringsRepo = require('../db/offerings.repo');
        offeringsRepo.listByService.mockResolvedValue([{ id: 1, offering_code: 'STD', title: 'Standard' }]);

        const response = await request(buildApp()).get('/api/v1/services/SVC-1/offerings');

        expect(response.status).toBe(200);
        expect(offeringsRepo.listByService).toHaveBeenCalledWith(101);
        expect(response.body.items).toHaveLength(1);
    });

    test('POST /services/:id/offerings creates a normalized offering', async () => {
        const offeringsRepo = require('../db/offerings.repo');
        offeringsRepo.create.mockResolvedValue({ id: 11, offering_code: 'STD', title: 'Standard' });

        const response = await request(buildApp())
            .post('/api/v1/services/SVC-1/offerings')
            .send({
                offeringCode: 'STD',
                title: 'Standard',
                isDefault: true,
                requestable: true,
                requestChannelUrl: 'https://example.test/request',
            });

        expect(response.status).toBe(201);
        expect(offeringsRepo.create).toHaveBeenCalledWith(101, expect.objectContaining({
            offering_code: 'STD',
            is_default: true,
            requestable: true,
            request_channel_url: 'https://example.test/request',
        }));
    });

    test('PUT /services/:id uses merged validation context', async () => {
        const servicesRepo = require('../db/services.repo');
        const validation = require('../services/validation');
        const offeringsRepo = require('../db/offerings.repo');
        const supportModelRepo = require('../db/support-model.repo');
        servicesRepo.update.mockResolvedValue({ service_id: 'SVC-1', service_status: 'draft' });
        offeringsRepo.listByService.mockResolvedValue([{ id: 1, offering_code: 'STD' }]);
        supportModelRepo.listByService.mockResolvedValue([{ id: 2, support_owner_name: 'Ops Team' }]);

        const response = await request(buildApp())
            .put('/api/v1/services/SVC-1')
            .send({ requestable: true });

        expect(response.status).toBe(200);
        expect(validation.validateUpdate).toHaveBeenCalledWith(
            { requestable: true },
            expect.objectContaining({ service_id: 'SVC-1', service_status: 'draft' }),
        );
    });

    test('PUT /services/:id blocks lifecycle live when requestable service lacks support model and offering', async () => {
        const offeringsRepo = require('../db/offerings.repo');
        const supportModelRepo = require('../db/support-model.repo');
        offeringsRepo.listByService.mockResolvedValue([]);
        supportModelRepo.listByService.mockResolvedValue([]);

        const response = await request(buildApp())
            .put('/api/v1/services/SVC-1')
            .send({ lifecycle_state: 'live', requestable: true });

        expect(response.status).toBe(422);
        expect(response.body.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({
                field: 'lifecycle_state',
                message: expect.stringContaining('offering'),
            }),
            expect.objectContaining({
                field: 'lifecycle_state',
                message: expect.stringContaining('support model'),
            }),
        ]));
    });

    test('PUT /services/:id/support-model rejects foreign offering ownership', async () => {
        const offeringsRepo = require('../db/offerings.repo');
        offeringsRepo.findById.mockResolvedValue(null);

        const response = await request(buildApp())
            .put('/api/v1/services/SVC-1/support-model')
            .send({
                items: [{ offeringId: 999, supportOwnerName: 'Ops Team' }],
            });

        expect(response.status).toBe(422);
        expect(response.body.errors[0].field).toContain('offering_id');
    });

    test('PUT /services/:id/audience replaces normalized audience items', async () => {
        const offeringsRepo = require('../db/offerings.repo');
        const audienceRepo = require('../db/audience.repo');
        offeringsRepo.findById.mockResolvedValue({ id: 3, service_id: 101 });
        audienceRepo.replaceForService.mockResolvedValue([{ id: 1, audience_type: 'internal' }]);

        const response = await request(buildApp())
            .put('/api/v1/services/SVC-1/audience')
            .send({
                items: [{ offeringId: 3, audienceType: 'internal', businessUnit: 'HQ' }],
            });

        expect(response.status).toBe(200);
        expect(audienceRepo.replaceForService).toHaveBeenCalledWith(101, [
            expect.objectContaining({
                offering_id: 3,
                audience_type: 'internal',
                business_unit: 'HQ',
            }),
        ]);
    });

    test('POST /services/:id/operational-links returns validation errors', async () => {
        const validation = require('../services/validation');
        validation.validateOperationalLink.mockReturnValueOnce([{ field: 'url', message: 'bad url' }]);

        const response = await request(buildApp())
            .post('/api/v1/services/SVC-1/operational-links')
            .send({ title: 'KB', url: 'notaurl' });

        expect(response.status).toBe(422);
        expect(response.body.errors).toEqual([{ field: 'url', message: 'bad url' }]);
    });
});
