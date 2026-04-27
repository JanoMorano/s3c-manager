'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

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
        req.user = { id: 1, username: 'admin', role: 'admin', preferred_lang: 'en' };
        next();
    },
}));

jest.mock('../middleware/rbac', () => ({
    canAdmin: (req, res, next) => next(),
    canEdit: (req, res, next) => next(),
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

describe('FMN Air C2 legacy coverage route', () => {
    beforeEach(() => {
        jest.resetModules();
        const { __query } = require('../db/pool');
        __query.mockReset();
    });

    test('does not keep developer-local PDF paths or Air-C2 reference constants in taxonomy route', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '../routes/taxonomy.js'), 'utf8');

        expect(source).not.toContain('/Users/');
        expect(source).not.toContain('FMN_AIR_C2_PDF_REFERENCES');
        expect(source).not.toContain('FMN_AIR_C2_SOURCE_DOCUMENTS');
    });

    test('serves legacy Air C2 response as thin alias over generic capability coverage', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({
                rows: [{
                    uuid: 'cap-air-bmc',
                    page_id: 'CP-1004',
                    title: 'Air Battlespace Management Capabilities',
                    abbreviation: 'Air-BMC',
                    level_num: 3,
                    parent_uuid: 'cap-bmc',
                    parent_page_id: 'CP-1000',
                    parent_title: 'Battlespace Management Capabilities',
                    parent_abbreviation: 'BMC',
                    available_spirals: ['Spiral_5'],
                }],
            })
            .mockResolvedValueOnce({ rows: [{ code: 'Spiral_5' }] })
            .mockResolvedValueOnce({
                rows: [
                    {
                        code: 'TIN-344',
                        entity_kind: 'technology_interaction',
                        entity_uuid: 'tin-344',
                        title: 'Air C2 message exchange',
                        link_role: 'core',
                        covered_by: ['ABC', 'DEF'],
                    },
                    {
                        code: 'DOB-10',
                        entity_kind: 'data_object',
                        entity_uuid: 'dob-10',
                        title: 'APP-11 data object',
                        link_role: 'supporting',
                        covered_by: ['DEF'],
                    },
                ],
            })
            .mockResolvedValueOnce({
                rows: [
                    { service_id: 'ABC', title: 'ABC Planner' },
                    { service_id: 'DEF', title: 'DEF Ops' },
                ],
            });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get('/api/v1/taxonomy/c3/fmn-air-c2/coverage?service=ABC');

        expect(response.status).toBe(200);
        expect(response.headers.deprecation).toBe('true');
        expect(response.headers.link).toContain('/api/v1/capabilities/by-slug/cap-bmc-air-bmc/coverage?spiral=Spiral_5');
        expect(response.body.framework).toMatchObject({
            name: 'FMN Spiral 5 Air C2 coverage',
            spiral: 'Spiral_5',
            domain: 'Air C2',
            successor_endpoint: '/api/v1/capabilities/by-slug/cap-bmc-air-bmc/coverage?spiral=Spiral_5',
        });
        expect(JSON.stringify(response.body.framework.source_documents)).not.toContain('/Users/');
        expect(response.body.summary).toMatchObject({
            total_requirements: 2,
            resolved_requirements: 2,
            core_requirements: 1,
            matching_services: 1,
        });
        expect(response.body.requirements).toEqual(expect.arrayContaining([
            expect.objectContaining({
                code: 'DOB-10',
                entity_kind: 'data_object',
                is_resolved: true,
            }),
        ]));
        expect(response.body.services).toHaveLength(1);
        expect(response.body.services[0]).toMatchObject({
            service_id: 'ABC',
            title: 'ABC Planner',
            coverage_percent: 100,
            covered_core_count: 1,
            total_core_count: 1,
        });
    });

    test('falls back to imported long slug when abbreviation slug is not present', async () => {
        const { __query } = require('../db/pool');
        __query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [{
                    uuid: 'cap-air-bmc',
                    page_id: 'CP-1004',
                    title: 'Air Battlespace Management Capabilities',
                    abbreviation: null,
                    level_num: 3,
                    parent_uuid: 'cap-battlespace',
                    parent_page_id: 'CP-1000',
                    parent_title: 'Battlespace Management Capabilities',
                    parent_abbreviation: null,
                    available_spirals: ['Spiral_5'],
                }],
            })
            .mockResolvedValueOnce({ rows: [{ code: 'Spiral_5' }] })
            .mockResolvedValueOnce({
                rows: [{
                    code: 'TIN-344',
                    entity_kind: 'technology_interaction',
                    entity_uuid: 'tin-344',
                    title: 'Air C2 message exchange',
                    link_role: 'core',
                    covered_by: ['ABC'],
                }],
            })
            .mockResolvedValueOnce({
                rows: [{ service_id: 'ABC', title: 'ABC Planner' }],
            });

        const router = require('../routes/taxonomy');
        const app = express();
        app.use('/api/v1/taxonomy', router);

        const response = await request(app).get('/api/v1/taxonomy/c3/fmn-air-c2/coverage');

        expect(response.status).toBe(200);
        expect(response.headers.link).toContain('/api/v1/capabilities/by-slug/cap-bmc-air-bmc/coverage?spiral=Spiral_5');
        expect(response.body.framework.successor_endpoint).toBe('/api/v1/capabilities/by-slug/cap-bmc-air-bmc/coverage?spiral=Spiral_5');
        expect(response.body.services).toEqual([
            expect.objectContaining({ service_id: 'ABC', coverage_percent: 100 }),
        ]);
    });
});
