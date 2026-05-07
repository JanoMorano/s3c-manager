'use strict';

const express = require('express');
const request = require('supertest');

const mockAuthState = {
    authenticated: true,
    role: 'admin',
    preferred_lang: 'cz',
};

jest.mock('../db/pool', () => {
    const query = jest.fn();
    const pool = { query };
    return {
        __query: query,
        getPool: () => pool,
        getPlatformPool: () => pool,
    };
});

jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        if (!mockAuthState.authenticated) {
            return res.status(401).json({ error: 'Neautorizovaný přístup' });
        }
        req.user = {
            id: 1,
            username: 'admin',
            display_name: 'Admin',
            role: mockAuthState.role,
            preferred_lang: mockAuthState.preferred_lang,
            preferred_theme: 'dark',
        };
        return next();
    },
}));
jest.mock('../middleware/rbac', () => ({
    canAdmin: (req, res, next) => {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        return next();
    },
    canEdit: (req, res, next) => {
        if (req.user?.role === 'admin' || req.user?.role === 'editor') {
            return next();
        }
        return res.status(403).json({ error: 'Forbidden' });
    },
}));
jest.mock('../middleware/module-gates', () => ({
    isModuleApiEnabled: jest.fn(async () => true),
    requireModuleApiEnabled: () => (req, res, next) => next(),
}));
jest.mock('../db/audit.repo', () => ({ logTaxonomyMappingChange: jest.fn() }));
jest.mock('../config', () => ({
    cache: {
        c3TaxonomyTtl: 60,
        c3DashboardTtl: 60,
        c3CapabilityMapTtl: 60,
    },
    init: {
        seedCapabilityMap: false,
    },
}));

function buildEocdOnlyZip(entryCount) {
    const buffer = Buffer.alloc(22);
    buffer.writeUInt32LE(0x06054b50, 0);
    buffer.writeUInt16LE(0, 4);
    buffer.writeUInt16LE(0, 6);
    buffer.writeUInt16LE(entryCount, 8);
    buffer.writeUInt16LE(entryCount, 10);
    buffer.writeUInt32LE(0, 12);
    buffer.writeUInt32LE(0, 16);
    buffer.writeUInt16LE(0, 20);
    return buffer;
}

describe('taxonomy authenticated c3 endpoints', () => {
    beforeEach(() => {
        jest.resetModules();
        mockAuthState.authenticated = true;
        mockAuthState.role = 'admin';
        mockAuthState.preferred_lang = 'cz';
        const { __query } = require('../db/pool');
        __query.mockReset();
    });

    test.each([
        {
            path: '/api/v1/taxonomy/c3/types',
            setup: (queryMock) => queryMock.mockResolvedValueOnce({ rows: [{ code: 'ZZ' }] }),
            expectBody: (body) => {
                expect(body).toEqual(expect.arrayContaining([
                    expect.objectContaining({ code: 'BP', name: 'BP' }),
                    expect.objectContaining({ code: 'ZZ', name: 'ZZ' }),
                ]));
            },
        },
        {
            path: '/api/v1/taxonomy/c3/statuses',
            setup: (queryMock) => queryMock.mockResolvedValueOnce({ rows: [{ code: 'zzz' }] }),
            expectBody: (body) => {
                expect(body).toEqual(expect.arrayContaining(['active', 'archived', 'zzz']));
            },
        },
        {
            path: '/api/v1/taxonomy/c3/parent-options?item_type=BP',
            setup: (queryMock) => queryMock.mockResolvedValueOnce({ rows: [{ title: 'Parent A' }] }),
            expectBody: (body) => {
                expect(body).toEqual(['Parent A']);
            },
        },
        {
            path: '/api/v1/taxonomy/security-classifications',
            setup: (queryMock) => queryMock.mockResolvedValueOnce({ rows: [{ code: 'OPEN', name: 'Open', sort_order: 1 }] }),
            expectBody: (body) => {
                expect(body[0]).toEqual(expect.objectContaining({ code: 'OPEN' }));
            },
        },
        {
            path: '/api/v1/taxonomy/c3',
            setup: (queryMock) => queryMock.mockResolvedValueOnce({
                rows: [{
                    uuid: 'u1',
                    title: 'Capability',
                    item_type: 'BP',
                    external_id: 'BP-1',
                    source_external_id: 'BP-1',
                    application: 'App',
                    parent_code: null,
                    references_raw: null,
                    datasets_raw: null,
                    parent_uuid: null,
                }],
            }),
            expectBody: (body) => {
                expect(Array.isArray(body)).toBe(true);
                expect(body[0]).toEqual(expect.objectContaining({ title: 'Capability' }));
            },
        },
        {
            path: '/api/v1/taxonomy/c3-services/SRV-1',
            setup: (queryMock) => queryMock.mockResolvedValueOnce({ rows: [{ service_code: 'SRV-1', title: 'Service One' }] }),
            expectBody: (body) => {
                expect(body).toEqual(expect.objectContaining({ service_code: 'SRV-1' }));
            },
        },
        {
            path: '/api/v1/taxonomy/c3-applications/APL-1',
            setup: (queryMock) => queryMock.mockResolvedValueOnce({ rows: [{ application_code: 'APL-1', title: 'App One' }] }),
            expectBody: (body) => {
                expect(body).toEqual(expect.objectContaining({ application_code: 'APL-1' }));
            },
        },
        {
            path: '/api/v1/taxonomy/c3-data-objects/DOB-1',
            setup: (queryMock) => queryMock.mockResolvedValueOnce({ rows: [{ data_object_code: 'DOB-1', title: 'Data One' }] }),
            expectBody: (body) => {
                expect(body).toEqual(expect.objectContaining({ data_object_code: 'DOB-1' }));
            },
        },
        {
            path: '/api/v1/taxonomy/c3-technology-interactions/TIN-1',
            setup: (queryMock) => queryMock.mockResolvedValueOnce({ rows: [{ technology_interaction_code: 'TIN-1', title: 'TIN One' }] }),
            expectBody: (body) => {
                expect(body).toEqual(expect.objectContaining({ technology_interaction_code: 'TIN-1' }));
            },
        },
    ])('authenticated C3 read endpoint $path returns data', async ({ path, setup, expectBody }) => {
        const { __query } = require('../db/pool');
        setup(__query);
        mockAuthState.authenticated = true;

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get(path);
        expect(response.status).toBe(200);
        expectBody(response.body);
    });

    test.each([
        '/api/v1/taxonomy/c3/types',
        '/api/v1/taxonomy/c3/statuses',
        '/api/v1/taxonomy/c3/parent-options?item_type=BP',
        '/api/v1/taxonomy/security-classifications',
        '/api/v1/taxonomy/c3',
        '/api/v1/taxonomy/c3-services/SRV-1',
        '/api/v1/taxonomy/c3-applications/APL-1',
        '/api/v1/taxonomy/c3-data-objects/DOB-1',
        '/api/v1/taxonomy/c3-technology-interactions/TIN-1',
    ])('C3 read endpoint %s rejects unauthenticated requests', async (path) => {
        const { __query } = require('../db/pool');
        mockAuthState.authenticated = false;

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get(path);
        expect(response.status).toBe(401);
        expect(__query).not.toHaveBeenCalled();
    });

    test('GET /c3 supports authenticated item type filtering for capability pickers', async () => {
        const { __query } = require('../db/pool');
        __query.mockResolvedValueOnce({
            rows: [
                {
                    uuid: 'cp-1',
                    title: 'Command capability',
                    item_type: 'CP',
                    level_num: 3,
                    external_id: 'CP-1',
                    source_external_id: null,
                    application: null,
                    parent_code: null,
                    references_raw: null,
                    datasets_raw: null,
                    parent_uuid: null,
                },
                {
                    uuid: 'bp-1',
                    title: 'Business process',
                    item_type: 'BP',
                    level_num: 3,
                    external_id: 'BP-1',
                    source_external_id: null,
                    application: null,
                    parent_code: null,
                    references_raw: null,
                    datasets_raw: null,
                    parent_uuid: null,
                },
            ],
        });
        mockAuthState.authenticated = true;

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get('/api/v1/taxonomy/c3?item_type=CP&limit=10');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            expect.objectContaining({ uuid: 'cp-1', item_type: 'CP' }),
        ]);
    });

    test.each([
        ['/api/v1/taxonomy/c3/dashboard'],
        ['/api/v1/taxonomy/c3/capability-map'],
        ['/api/v1/taxonomy/c3/capability-map-spiral7'],
        ['/api/v1/taxonomy/c3/capability-map-spiral6'],
        ['/api/v1/taxonomy/c3-capability-builder/domains'],
    ])('protected endpoint %s rejects unauthenticated requests and does not hit handler', async (path) => {
        const { __query } = require('../db/pool');
        mockAuthState.authenticated = false;

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get(path);
        expect(response.status).toBe(401);
        expect(__query).not.toHaveBeenCalled();
    });

    test('POST /c3/xlsx returns 400 for oversized ZIP entry counts', async () => {
        const router = require('../routes/taxonomy');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/taxonomy', router);

        const response = await request(app)
            .post('/api/v1/taxonomy/c3/xlsx')
            .set('Content-Type', 'application/zip')
            .send(buildEocdOnlyZip(129));

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/zip entry count/i);
    });

    test('POST /c3/:target/xml-archimate dry-run parses ArchiMate XML', async () => {
        const xml = require('node:fs').readFileSync(require('node:path').join(__dirname, 'fixtures/spiral6-business-roles-sample.xml'), 'utf8');
        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app)
            .post('/api/v1/taxonomy/c3/business-roles/xml-archimate?dry_run=true')
            .set('Content-Type', 'application/xml')
            .send(xml);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(expect.objectContaining({
            ok: true,
            source: 'xml-archimate',
            dry_run: true,
            target_key: 'business-roles',
            rowsParsed: 1,
        }));
        expect(response.body.preview[0]).toEqual(expect.objectContaining({
            title: 'Business Roles',
            item_type: 'BR',
        }));
    });

    test('GET /c3-capability-builder/domains returns domains for authenticated users', async () => {
        const { __query } = require('../db/pool');
        __query.mockResolvedValueOnce({
            rows: [
                { code: 'BusinessProcesses', label: 'BUSINESS PROCESSES', css_class: 'dom-bp', heading_color: '#e65c00', background_color: '#ffd0a0' },
            ],
        });

        mockAuthState.authenticated = true;
        mockAuthState.role = 'admin';

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get('/api/v1/taxonomy/c3-capability-builder/domains');
        expect(response.status).toBe(200);
        expect(response.body[0]).toEqual(expect.objectContaining({ code: 'BusinessProcesses' }));
    });

    test('GET /c3/dashboard returns aggregate payload', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({ rows: [{ total_items: 10, mapped_items: 7, unmapped_items: 3, total_mappings: 9, item_type_count: 6, application_count: 4 }] })
            .mockResolvedValueOnce({ rows: [{ name: 'active', value: 5 }] })
            .mockResolvedValueOnce({ rows: [{ name: 'BP', value: 4 }] })
            .mockResolvedValueOnce({ rows: [{ name: 'App', value: 4 }] })
            .mockResolvedValueOnce({ rows: [{ name: 'Parent', value: 3 }] })
            .mockResolvedValueOnce({ rows: [{ uuid: 'u1', title: 'Need', item_type: 'BP' }] })
            .mockResolvedValueOnce({ rows: [{ uuid: 'u2', title: 'Top', mapping_count: 3 }] })
            .mockResolvedValueOnce({ rows: [{ name: 'App', value: 4, mapped: 3 }] })
            .mockResolvedValueOnce({ rows: [{ name: 'manual', value: 2 }] });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get('/api/v1/taxonomy/c3/dashboard');
        expect(response.status).toBe(200);
        expect(response.body.summary.total_items).toBe(10);
        expect(response.body.by_type[0].name).toBe('BP');

        const executedSql = __query.mock.calls.map(([sqlText]) => String(sqlText)).join('\n---\n');
        expect(executedSql).toContain('WHERE is_mapped = FALSE');
        expect(executedSql).toContain('SUM(CASE WHEN is_mapped = TRUE THEN 1 ELSE 0 END) AS mapped');
        expect(executedSql).not.toContain('WHERE is_mapped = 0');
        expect(executedSql).not.toContain('WHEN is_mapped = 1');
    });

    test('GET /c3/capability-map returns canonical builder payload including title', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({ rows: [{ config_value: 'C3 Taxonomy Catalogue — Baseline 7' }] })
            .mockResolvedValueOnce({
                rows: [
                    { code: 'BusinessProcesses', css_class: 'dom-bp', heading_color: '#e65c00', background_color: '#ffd0a0', label: 'BUSINESS PROCESSES', sort_order: 1 },
                ],
            })
            .mockResolvedValueOnce({
                rows: [
                    { id: 1, page_id: 'BP-1000', title: 'Business Processes', level: 1, domain_code: 'BusinessProcesses' },
                ],
            });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get('/api/v1/taxonomy/c3/capability-map');
        expect(response.status).toBe(200);
        expect(response.body.page_title).toBe('C3 Taxonomy Catalogue — Baseline 7');
        expect(response.body.summary.total).toBe(1);
        expect(response.body.items[0].page_id).toBe('BP-1000');
    });

    test('GET /c3/capability-map-spiral6 returns static Spiral 6 payload', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [
                    { code: 'BusinessProcesses', css_class: 'dom-bp', heading_color: '#e65c00', background_color: '#ffd0a0', label: 'BUSINESS PROCESSES', sort_order: 1 },
                ],
            })
            .mockResolvedValueOnce({
                rows: [
                    { id: 1, page_id: 'BP-1000', title: 'Business Processes', level: 1, domain_code: 'BusinessProcesses', fmn_spiral: 'Spiral_6' },
                ],
            });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get('/api/v1/taxonomy/c3/capability-map-spiral6');
        expect(response.status).toBe(200);
        expect(response.body.page_title).toBe('C3 Taxonomy Catalogue — Baseline 6');
        expect(response.body.summary.total).toBe(1);
        expect(response.body.summary.domain_count).toBe(1);
        expect(response.body.items[0].page_id).toBe('BP-1000');
    });

    test('GET /security-classifications returns ref data', async () => {
        const { __query } = require('../db/pool');
        __query.mockResolvedValueOnce({
            rows: [
                { code: 'OPEN',    name: 'Open',     sort_order: 1 },
                { code: 'ELEVATED', name: 'Elevated', sort_order: 3 },
            ],
        });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get('/api/v1/taxonomy/security-classifications');
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(response.body[0].code).toBe('OPEN');
    });

    test('POST /c3-applications/csv imports C3 Application rows', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 11 }] });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/taxonomy', router);

        const csv = [
            'Application,UUID,"Modification date",Order,"SS overall status","SS baseline status","Item status","Data source","External id","Data qualifier",Title,"Source description","Revised description",Description,Revised',
            'APL-1,uuid-1,"4 May 2024 13:33:06",1,"Approved (Baselined)",Baselined,Approved,"C3 Taxonomy",UA-1000,"Qualifier","User Applications","Source text","Revised text","Description",false',
        ].join('\n');

        const response = await request(app)
            .post('/api/v1/taxonomy/c3-application/csv')
            .set('Content-Type', 'text/csv')
            .send(csv);

        expect(response.status).toBe(200);
        expect(response.body.inserted).toBe(1);
        expect(response.body.failed).toBe(0);
    });

    test('POST /c3-technology-interactions/csv handles duplicate headers', async () => {
        const { __query } = require('../db/pool');
        __query.mockImplementation(async (queryText) => {
            const normalized = String(queryText).toLowerCase();
            if (normalized.includes('from data.c3_technology_interaction') && normalized.includes('where uuid =')) return { rows: [] };
            if (normalized.includes('insert into data.c3_technology_interaction')) return { rows: [{ id: 10 }] };
            if (normalized.includes('delete from data.c3_technology_interaction_service_link')) return { rows: [] };
            if (normalized.includes('from data.c3_service')) return { rows: [{ id: 101 }] };
            if (normalized.includes('insert into data.c3_technology_interaction_service_link')) return { rows: [] };
            if (normalized.includes('from data.c3_application')) return { rows: [{ id: 201 }] };
            if (normalized.includes('insert into data.c3_technology_interaction_application_link')) return { rows: [] };
            if (normalized.includes('from data.c3_data_object')) return { rows: [{ id: 301 }] };
            if (normalized.includes('insert into data.c3_technology_interaction_data_object_link')) return { rows: [] };
            if (normalized.includes('insert into data.c3_entity_import_run')) return { rows: [{ id: 11 }] };
            return { rows: [] };
        });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/taxonomy', router);

        const csv = [
            '"Technology Interaction",UUID,"Modification date",Order,"SS overall status","SS baseline status","Item status","CIAV review status","MCSMA review status","Service Instructions",Title,"Technology interaction type","Technology interaction maturity","Technology Interactions",Description,Conditionality,Services,Applications,Services,"Technology Interactions","Technology Interactions",Services,Applications,"Data Objects"',
            'TIN-1,uuid-ti-1,"26 September 2025 07:02:23",1,"Approved (Unlocked)",Unlocked,Approved,Completed,Completed,"Instrukce","Geospatial Data Dissemination",Federation,Mature,"","Desc","Cond","SRV-1","APL-1","SRV-2","TIN-2","TIN-3","SRV-3","APL-2","DOB-1"',
        ].join('\n');

        const response = await request(app)
            .post('/api/v1/taxonomy/c3-technology-interactions/csv')
            .set('Content-Type', 'text/csv')
            .send(csv);

        expect(response.status).toBe(200);
        expect(response.body.inserted).toBe(1);
        expect(response.body.failed).toBe(0);
    });

    test('POST /c3-data-objects/dry-run returns validation error for missing title', async () => {
        mockAuthState.preferred_lang = 'en';
        const router = require('../routes/taxonomy');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/taxonomy', router);

        const response = await request(app)
            .post('/api/v1/taxonomy/c3-data-objects/dry-run')
            .set('accept-language', 'en-US,en;q=0.9')
            .send({
                items: [{ 'Data Object': 'DOB-1', UUID: 'uuid-1' }],
            });

        expect(response.status).toBe(200);
        expect(response.body.error_count).toBe(1);
        expect(response.body.issues[0].issue_code).toBe('MISSING_TITLE');
        expect(response.body.issues[0].message).toBe('Title is required.');
    });

    test('GET /c3-services returns admin list view', async () => {
        const { __query } = require('../db/pool');
        __query.mockResolvedValueOnce({
            rows: [
                { id: 1, service_code: 'SRV-1', uuid: 'uuid-1', title: 'Service One', item_status: 'Approved' },
            ],
        });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get('/api/v1/taxonomy/c3-services');
        expect(response.status).toBe(200);
        expect(response.body[0].service_code).toBe('SRV-1');
    });

    test('POST /c3-capability-builder creates builder item', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({
                rows: [
                    { code: 'BusinessProcesses', css_class: 'dom-bp', heading_color: '#e65c00', background_color: '#ffd0a0', label: 'BUSINESS PROCESSES', sort_order: 1 },
                ],
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 55 }] })
            .mockResolvedValueOnce({
                rows: [
                    { id: 55, page_id: 'BP-1016', title: 'Accounting', level: 4, domain_code: 'BusinessProcesses' },
                ],
            });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/taxonomy', router);

        const response = await request(app)
            .post('/api/v1/taxonomy/c3-capability-builder')
            .send({
                page_id: 'BP-1016',
                uuid: '4ec1702a-929e-42a8-807b-cb7c82e1ab47',
                title: 'Accounting',
                parent_id: null,
                level: 1,
                state: 'approved',
                domain_code: 'BusinessProcesses',
            });

        expect(response.status).toBe(201);
        expect(response.body.id).toBe(55);
        expect(response.body.page_id).toBe('BP-1016');
    });

    test('POST /c3-capability-builder/csv imports capability map rows', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({
                rows: [{ code: 'BusinessProcesses', css_class: 'dom-bp', heading_color: '#e65c00', background_color: '#ffd0a0', label: 'BUSINESS PROCESSES', sort_order: 1 }],
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 91 }] });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/taxonomy', router);

        const csv = [
            'Page ID,UUID,Title,Parent ID,Level,State,Domain',
            'BP-1000,uuid-cap-1,Business Processes,,1,approved,BusinessProcesses',
        ].join('\n');

        const response = await request(app)
            .post('/api/v1/taxonomy/c3-capability-builder/csv')
            .set('Content-Type', 'text/csv')
            .send(csv);

        expect(response.status).toBe(200);
        expect(response.body.inserted).toBe(1);
        expect(response.body.target).toBe('c3-capability-builder');
    });

    test('GET /import-runs/latest returns latest summary with admin path', async () => {
        const { __query } = require('../db/pool');
        __query.mockResolvedValueOnce({
            rows: [
                { id: 9, target_key: 'c3-services', source_name: 'Services.csv', row_count: 12, inserted_count: 11, updated_count: 1, failed_count: 0, created_at: '2026-03-30T10:00:00Z' },
            ],
        });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get('/api/v1/taxonomy/import-runs/latest');
        expect(response.status).toBe(200);
        expect(response.body[0].label).toBe('C3 Services');
        expect(response.body[0].admin_path).toBe('/c3/services');
    });

    test('GET /c3/capability-map-spiral7 returns builder payload (spiral7, builder endpoint)', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({ rows: [{ config_value: 'C3 Taxonomy Catalogue — Baseline 7' }] })
            .mockResolvedValueOnce({
                rows: [
                    { code: 'BusinessProcesses', css_class: 'dom-bp', heading_color: '#e65c00', background_color: '#ffd0a0', label: 'BUSINESS PROCESSES', sort_order: 1 },
                ],
            })
            .mockResolvedValueOnce({
                rows: [
                    { id: 1, page_id: 'BP-1000', title: 'Business Processes', level: 1, domain_code: 'BusinessProcesses', parent_id: null, fmn_spiral: 'Spiral_7' },
                    { id: 2, page_id: 'BP-1001', title: 'Finance', level: 2, domain_code: 'BusinessProcesses', parent_id: 1, fmn_spiral: 'Spiral_7' },
                ],
            });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get('/api/v1/taxonomy/c3/capability-map');
        expect(response.status).toBe(200);
        expect(response.body.page_title).toBe('C3 Taxonomy Catalogue — Baseline 7');
        expect(response.body.summary.total).toBe(2);
    });

    test('GET /c3/capability-map-spiral6 returns empty state without crash when builder has no Spiral_6 data', async () => {
        const { __query } = require('../db/pool');
        // Spiral-6 endpoint reads from static JSON file (shared/c3/capability-map-spiral6.json)
        // and then joins with builder table to compute mapping state.
        // Simulate the builder query returning zero rows (no Spiral_6 data).
        __query.mockResolvedValueOnce({ rows: [] }); // builder items for Spiral_6 = empty

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get('/api/v1/taxonomy/c3/capability-map-spiral6');
        expect(response.status).toBe(200);
        // Static Spiral 6 items always present (loaded from JSON file)
        expect(response.body.summary).toBeDefined();
        expect(response.body.items).toBeDefined();
        // Items come from static JSON — may still be > 0 (static data)
        // Key assertion: no 500, valid JSON, domains present
        expect(response.body.page_title).toBe('C3 Taxonomy Catalogue — Baseline 6');
        expect(Array.isArray(response.body.items)).toBe(true);
    });

    test('GET /import-runs/:id returns run detail and issue list', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({
                rows: [
                    { id: 14, target_key: 'c3-technology-interactions', source_name: 'Technology Interactions.csv', row_count: 10 },
                ],
            })
            .mockResolvedValueOnce({
                rows: [
                    { id: 1, run_id: 14, issue_code: 'UNRESOLVED_SERVICE_REF', row_number: 4, severity: 'warn' },
                ],
            });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get('/api/v1/taxonomy/import-runs/14');
        expect(response.status).toBe(200);
        expect(response.body.label).toBe('C3 Technology Interactions');
        expect(response.body.issues).toHaveLength(1);
        expect(response.body.issues[0].issue_code).toBe('UNRESOLVED_SERVICE_REF');
    });
});
