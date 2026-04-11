'use strict';

const express = require('express');
const request = require('supertest');

const mockQuery = jest.fn();

jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        req.user = { username: 'tester' };
        next();
    },
}));
jest.mock('../middleware/rbac', () => ({ canEdit: (req, res, next) => next() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
}));
jest.mock('../parsers/flavourParser', () => ({ parseFlavours: jest.fn(() => []) }));
jest.mock('../parsers/slaParser', () => ({ parseSla: jest.fn(() => null) }));
jest.mock('../db/audit.repo', () => ({ log: jest.fn(), logTaxonomyMappingChange: jest.fn(), logGraphLayoutChange: jest.fn() }));
jest.mock('../db/flavours.repo', () => ({ upsert: jest.fn() }));
jest.mock('../db/relations.repo', () => ({
    findByService: jest.fn(async () => []),
    create: jest.fn(async () => 1),
    update: jest.fn(async () => ({})),
}));
jest.mock('../db/pool', () => ({
    getPool: () => ({ query: mockQuery }),
}));
jest.mock('../db/import.repo', () => ({
    createBatch: jest.fn(async () => 11),
    closeBatch: jest.fn(async () => {}),
    createRow: jest.fn(async () => 21),
    updateRowStatus: jest.fn(async () => {}),
    logIssue: jest.fn(async () => {}),
    upsertDomains: jest.fn(async () => {}),
    upsertRole: jest.fn(async () => {}),
    insertRelationRaw: jest.fn(async () => {}),
    insertRawField: jest.fn(async () => {}),
    upsertFlavour: jest.fn(async () => {}),
    upsertSla: jest.fn(async () => {}),
    createContractReport: jest.fn(async () => 77),
    getLatestContractReport: jest.fn(async () => null),
    getContractReportByHash: jest.fn(async () => null),
    getBatchPairingByHash: jest.fn(async () => []),
}));
jest.mock('../db/services.repo', () => {
    const existing = new Set();
    return {
        serviceIdExists: jest.fn(async (serviceId) => existing.has(serviceId)),
        create: jest.fn(async (data) => {
            existing.add(data.service_id);
            return data.service_id;
        }),
        update: jest.fn(async () => ({})),
    };
});

function mockTaxonomyLookups() {
    mockQuery.mockImplementation(async (sqlText) => {
        const normalized = String(sqlText).toLowerCase();
        if (normalized.includes('ref_global_service_group')) return { rows: [] };
        if (normalized.includes('ref_service_line')) return { rows: [] };
        if (normalized.includes('ref_organizational_element')) return { rows: [] };
        if (normalized.includes('ref_network_domain')) return { rows: [{ code: 'NEXUS', name_lc: 'nexus' }] };
        if (normalized.includes('ref_portfolio_group')) {
            return {
                rows: [
                    { code: 'Application Services', name_lc: 'application services' },
                    { code: 'Logistic Services', name_lc: 'logistic services' },
                    { code: 'Other Services', name_lc: 'other services' },
                    { code: 'Digital Workplace Services', name_lc: 'digital workplace services' },
                ],
            };
        }
        if (normalized.includes('ref_service_type')) return { rows: [{ code: 'CF', name_lc: 'customer facing' }, { code: 'CFS', name_lc: 'customer facing / support' }, { code: 'ES', name_lc: 'enabling service' }, { code: 'SS', name_lc: 'supporting service' }] };
        if (normalized.includes('ref_service_status')) return { rows: [{ code: 'active', name_lc: 'active' }, { code: 'external_reference', name_lc: 'external reference (stub)' }] };
        if (normalized.includes('ref_security_classification')) return { rows: [] };
        if (normalized.includes('v_stubcompletionqueue')) return {
            rows: [{
                id: 1,
                service_id: 'APP050',
                title: 'External reference APP050',
                service_status_code: 'external_reference',
                is_stub: true,
                related_service_ids: 'SVC-1,SVC-2',
                incoming_relation_count: 2,
                outgoing_relation_count: 0,
            }],
        };
        return { rows: [] };
    });
}

describe('import routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockReset();
        mockTaxonomyLookups();
    });

    test('POST /services accepts 3-table payload and creates stubs for missing targets', async () => {
        const repo = require('../db/services.repo');
        const relRepo = require('../db/relations.repo');
        const router = require('../routes/import');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/import', router);

        const response = await request(app)
            .post('/api/v1/import/services')
            .send({
                ServiceCatalog: [
                    {
                        ServiceID: 'SVC-1',
                        Title: 'Service One',
                        PortfolioGroup: 'Application Services',
                        ServiceType: 'Customer Facing Service',
                        ServiceStatus: 'Active',
                        RawPrerequisites: 'APP051',
                    },
                ],
                ServiceRelations: [
                    { FromServiceID: 'SVC-1', ToServiceID: 'APP050', RelationType: 'prerequisite' },
                ],
            });

        expect(response.status).toBe(200);
        expect(response.body.source).toBe('3-table-json');
        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
            service_id: 'SVC-1',
            title: 'Service One',
        }), 'tester');
        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
            service_id: 'APP050',
            is_stub: true,
            service_status: 'external_reference',
        }), 'tester');
        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
            service_id: 'APP051',
            is_stub: true,
            service_status: 'external_reference',
        }), 'tester');
        expect(relRepo.create).toHaveBeenCalled();
    });

    test('POST /services/dry-run returns preflight summary and stores contract report', async () => {
        const importRepo = require('../db/import.repo');
        const router = require('../routes/import');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/import', router);

        const response = await request(app)
            .post('/api/v1/import/services/dry-run')
            .send({
                source_name: 'ncia_full_dataset_3_tables.json',
                ServiceCatalog: [
                    {
                        ServiceID: 'SVC-1',
                        Title: 'Service One',
                        PortfolioGroup: 'Application Services',
                        ServiceType: 'Customer Facing Service',
                        ServiceStatus: 'Active',
                        RawPrerequisites: 'APP051',
                    },
                ],
                ServiceRelations: [
                    { FromServiceID: 'SVC-1', ToServiceID: 'APP050', RelationType: 'prerequisite' },
                ],
            });

        expect(response.status).toBe(200);
        expect(response.body.report_id).toBe(77);
        expect(response.body.stub_count).toBe(2);
        expect(response.body.explicit_relation_count).toBe(1);
        expect(response.body.raw_prerequisite_count).toBe(1);
        expect(response.body.source_hash_sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(importRepo.createContractReport).toHaveBeenCalledWith(expect.objectContaining({
            sourceHashSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }));
    });

    test('POST /services/csv/dry-run returns preflight summary for CSV payload', async () => {
        const importRepo = require('../db/import.repo');
        const router = require('../routes/import');
        const app = express();
        app.use('/api/v1/import', router);

        const response = await request(app)
            .post('/api/v1/import/services/csv/dry-run?source_name=services.csv')
            .set('Content-Type', 'text/csv')
            .send([
                'service_id,title,portfolio_group_code,service_type,service_status,prerequisites_json',
                'SVC-1,Service One,Application Services,Customer Facing Service,Active,APP050',
            ].join('\n'));

        expect(response.status).toBe(200);
        expect(response.body.source_name).toBe('services.csv');
        expect(response.body.stub_count).toBe(1);
        expect(response.body.source_hash_sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(importRepo.createContractReport).toHaveBeenCalledWith(expect.objectContaining({
            sourceKind: 'csv',
        }));
    });

    test('POST /services/dry-run recognizes new portfolio groups without unresolved warnings', async () => {
        const router = require('../routes/import');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/import', router);

        const response = await request(app)
            .post('/api/v1/import/services/dry-run')
            .send({
                source_name: 'portfolio-groups.json',
                items: [
                    { service_id: 'LOG001', title: 'Logistics', portfolio_group_code: 'Logistic Services' },
                    { service_id: 'OTH002', title: 'Other', portfolio_group_code: 'Other Services' },
                    { service_id: 'NDW001', title: 'NDW', portfolio_group_code: 'Digital Workplace Services\nService Status: Pipeline' },
                ],
            });

        expect(response.status).toBe(200);
        expect(response.body.unresolved_ref_count).toBe(0);
        expect(response.body.unresolved_refs).toEqual([]);
    });

    test('GET /stubs returns stub completion queue', async () => {
        const router = require('../routes/import');
        const app = express();
        app.use('/api/v1/import', router);

        const response = await request(app)
            .get('/api/v1/import/stubs?limit=10');

        expect(response.status).toBe(200);
        expect(response.body[0].service_id).toBe('APP050');
        expect(response.body[0].incoming_relation_count).toBe(2);
        expect(response.body[0].related_service_ids).toBe('SVC-1,SVC-2');
    });

    test('GET /contract-report/by-hash/:sha256 returns report and paired batches', async () => {
        const importRepo = require('../db/import.repo');
        importRepo.getContractReportByHash.mockResolvedValue({
            id: 77,
            source_name: 'ncia_full_dataset_3_tables.json',
            source_hash_sha256: 'a'.repeat(64),
            stub_count: 16,
        });
        importRepo.getBatchPairingByHash.mockResolvedValue([
            { batch_id: 11, source_hash_sha256: 'a'.repeat(64), filename: 'ncia_full_dataset_3_tables.json' },
        ]);

        const router = require('../routes/import');
        const app = express();
        app.use('/api/v1/import', router);

        const response = await request(app)
            .get(`/api/v1/import/contract-report/by-hash/${'a'.repeat(64)}`);

        expect(response.status).toBe(200);
        expect(response.body.report.id).toBe(77);
        expect(response.body.batches[0].batch_id).toBe(11);
        expect(response.body.source_hash_sha256).toBe('a'.repeat(64));
    });
});
