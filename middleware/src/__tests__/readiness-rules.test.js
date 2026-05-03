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

jest.mock('../db/readiness.repo', () => ({
    listRules: jest.fn(),
    getServiceState: jest.fn(),
    getServiceStateByCatalogId: jest.fn(),
    listServiceStates: jest.fn(),
    listExceptionsForService: jest.fn(),
    createException: jest.fn(),
    deleteException: jest.fn(),
}));

jest.mock('../db/audit.repo', () => ({
    log: jest.fn(),
}));

function rule(overrides) {
    return {
        rule_key: 'service_has_owner',
        title: 'Service has owner',
        description: 'Owner is required.',
        severity: 'P0',
        enabled: true,
        blocking: true,
        applies_to_lifecycle_stage: null,
        ...overrides,
    };
}

function state(overrides = {}) {
    return {
        service_pk: 7,
        service_id: 'SVC-IAM',
        title: 'Identity Access Management',
        service_status: 'active',
        lifecycle_stage_code: 'active',
        lifecycle_state: 'live',
        requestable: true,
        review_due_at: '2026-06-30',
        next_review_due_at: '2026-06-30',
        owner_count: 1,
        offering_count: 1,
        active_flavour_count: 1,
        relation_count: 1,
        dependency_relation_count: 1,
        primary_mapping_count: 1,
        primary_c3_uuid: 'cap-iam',
        primary_c3_title: 'Provide Identity Services',
        primary_c3_code: 'C3-IAM',
        primary_c3_completeness_status: 'complete',
        primary_c3_app_count: 1,
        primary_c3_data_object_count: 1,
        primary_c3_tin_count: 1,
        primary_c3_c3_service_count: 1,
        primary_c3_service_mapping_count: 1,
        has_single_primary_mapping: true,
        has_complete_primary_capability: true,
        has_active_flavour: true,
        sla_availability: 99.9,
        sla_restoration: 4,
        sla_delivery: 2,
        sla_record_count: 1,
        priced_flavour_count: 1,
        has_price_note: false,
        ...overrides,
    };
}

const minimumRules = [
    rule({ rule_key: 'service_has_owner', title: 'Service has owner', severity: 'P0', blocking: true }),
    rule({ rule_key: 'service_has_offering', title: 'Service has offering', severity: 'P0', blocking: true }),
    rule({ rule_key: 'service_has_lifecycle_stage', title: 'Service has lifecycle stage', severity: 'P1', blocking: true }),
    rule({ rule_key: 'service_has_primary_capability_mapping', title: 'Service has primary capability', severity: 'P1', blocking: true }),
    rule({ rule_key: 'service_has_sla', title: 'Service has SLA', severity: 'P1', blocking: true }),
    rule({ rule_key: 'service_has_dependency_classification', title: 'Service has dependencies', severity: 'P2', blocking: false }),
    rule({ rule_key: 'service_has_review_date', title: 'Service has review date', severity: 'P2', blocking: false }),
    rule({ rule_key: 'requestable_service_has_pricing', title: 'Requestable service has pricing', severity: 'P2', blocking: false }),
];

describe('readiness rule evaluation', () => {
    test('returns stable rule results with blockers, warnings, disabled rules, and valid exceptions', () => {
        const { evaluateServiceReadinessState } = require('../services/readiness');

        const result = evaluateServiceReadinessState(
            state({
                owner_count: 0,
                sla_availability: null,
                sla_restoration: null,
                sla_delivery: null,
                sla_record_count: 0,
                dependency_relation_count: 0,
                priced_flavour_count: 0,
            }),
            [
                ...minimumRules,
                rule({ rule_key: 'disabled_rule', title: 'Disabled rule', enabled: false, blocking: true }),
            ],
            [
                {
                    rule_key: 'service_has_sla',
                    reason: 'Migration wave approved',
                    expires_at: '2026-05-30T00:00:00Z',
                    approved_by: 'cto@example.com',
                },
            ],
            new Date('2026-04-29T00:00:00Z')
        );

        expect(result.rules).toEqual(expect.arrayContaining([
            expect.objectContaining({
                rule_key: 'service_has_owner',
                status: 'failed',
                severity: 'P0',
                blocking: true,
                exception: null,
            }),
            expect.objectContaining({
                rule_key: 'service_has_sla',
                status: 'exception',
                blocking: true,
                exception: expect.objectContaining({ reason: 'Migration wave approved' }),
            }),
            expect.objectContaining({
                rule_key: 'service_has_dependency_classification',
                status: 'failed',
                blocking: false,
            }),
            expect.objectContaining({
                rule_key: 'disabled_rule',
                status: 'disabled',
            }),
        ]));
        expect(result.is_publishable).toBe(false);
        expect(result.blockers).toContain('Service has owner');
        expect(result.blockers).not.toContain('Service has SLA');
        expect(result.warnings).toContain('Service has dependencies');
    });

    test('treats expired exceptions as failed rules', () => {
        const { evaluateServiceReadinessState } = require('../services/readiness');

        const result = evaluateServiceReadinessState(
            state({ sla_availability: null, sla_restoration: null, sla_delivery: null, sla_record_count: 0 }),
            [rule({ rule_key: 'service_has_sla', title: 'Service has SLA', blocking: true })],
            [{ rule_key: 'service_has_sla', reason: 'Old waiver', expires_at: '2026-04-01T00:00:00Z' }],
            new Date('2026-04-29T00:00:00Z')
        );

        expect(result.rules[0]).toEqual(expect.objectContaining({
            rule_key: 'service_has_sla',
            status: 'failed',
            exception: expect.objectContaining({ expired: true }),
        }));
        expect(result.is_publishable).toBe(false);
    });
});

describe('readiness routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCanEditAllows = true;
    });

    function buildApp() {
        const router = require('../routes/readiness');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/readiness', router);
        return app;
    }

    test('GET /services/:id returns named rule results', async () => {
        const repo = require('../db/readiness.repo');
        repo.getServiceState.mockResolvedValue(state({ owner_count: 0 }));
        repo.listRules.mockResolvedValue(minimumRules);
        repo.listExceptionsForService.mockResolvedValue([]);

        const response = await request(buildApp()).get('/api/v1/readiness/services/SVC-IAM');

        expect(response.status).toBe(200);
        expect(response.body.service_id).toBe('SVC-IAM');
        expect(response.body.rules[0]).toEqual(expect.objectContaining({
            rule_key: 'service_has_owner',
            status: 'failed',
            severity: 'P0',
            blocking: true,
        }));
        expect(repo.getServiceState).toHaveBeenCalledWith('SVC-IAM');
    });

    test('GET /summary groups blockers, warnings, and ready services', async () => {
        const repo = require('../db/readiness.repo');
        repo.listRules.mockResolvedValue(minimumRules);
        repo.listServiceStates.mockResolvedValue([
            state({ service_id: 'SVC-BLOCKED', owner_count: 0 }),
            state({ service_id: 'SVC-WARN', dependency_relation_count: 0 }),
            state({ service_id: 'SVC-READY' }),
        ]);
        repo.listExceptionsForService.mockResolvedValue([]);

        const response = await request(buildApp()).get('/api/v1/readiness/summary');

        expect(response.status).toBe(200);
        expect(response.body.counts).toEqual(expect.objectContaining({
            blockers: 1,
            warnings: 1,
            ready: 1,
        }));
        expect(response.body.groups.blockers[0].service_id).toBe('SVC-BLOCKED');
        expect(response.body.groups.warnings[0].service_id).toBe('SVC-WARN');
        expect(response.body.groups.ready[0].service_id).toBe('SVC-READY');
    });

    test('POST /services/:id/exceptions creates and audits a rule exception', async () => {
        const repo = require('../db/readiness.repo');
        const audit = require('../db/audit.repo');
        repo.createException.mockResolvedValue({
            id: 12,
            service_id: 7,
            rule_key: 'service_has_sla',
            reason: 'Contract migration',
            expires_at: '2026-06-01T00:00:00Z',
            approved_by: 'admin@example.com',
        });

        const response = await request(buildApp())
            .post('/api/v1/readiness/services/SVC-IAM/exceptions')
            .send({ rule_key: 'service_has_sla', reason: 'Contract migration', expires_at: '2026-06-01T00:00:00Z' });

        expect(response.status).toBe(201);
        expect(response.body.item.rule_key).toBe('service_has_sla');
        expect(repo.createException).toHaveBeenCalledWith('SVC-IAM', 'service_has_sla', expect.objectContaining({
            reason: 'Contract migration',
            approved_by: 'admin@example.com',
        }));
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
            tableName: 'ReadinessException',
            action: 'INSERT',
            recordLabel: 'SVC-IAM:service_has_sla',
        }));
    });

    test('POST /services/:id/exceptions requires edit access', async () => {
        const repo = require('../db/readiness.repo');
        mockCanEditAllows = false;

        const response = await request(buildApp())
            .post('/api/v1/readiness/services/SVC-IAM/exceptions')
            .send({ rule_key: 'service_has_sla', reason: 'Contract migration' });

        expect(response.status).toBe(403);
        expect(repo.createException).not.toHaveBeenCalled();
    });

    test('DELETE /services/:id/exceptions/:ruleKey removes and audits an exception', async () => {
        const repo = require('../db/readiness.repo');
        const audit = require('../db/audit.repo');
        repo.deleteException.mockResolvedValue(true);

        const response = await request(buildApp())
            .delete('/api/v1/readiness/services/SVC-IAM/exceptions/service_has_sla');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ removed: true });
        expect(repo.deleteException).toHaveBeenCalledWith('SVC-IAM', 'service_has_sla');
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
            tableName: 'ReadinessException',
            action: 'DELETE',
            recordLabel: 'SVC-IAM:service_has_sla',
        }));
    });
});
