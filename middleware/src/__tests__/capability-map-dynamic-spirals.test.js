'use strict';

const express = require('express');
const request = require('supertest');

const mockQuery = jest.fn();

jest.mock('../db/pool', () => {
    const pool = { query: mockQuery };
    return {
        getPool: () => pool,
        getPlatformPool: () => pool,
    };
});

jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        req.user = { id: 1, username: 'admin', email: 'admin@example.test', role: 'admin' };
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
jest.mock('../utils/c3-capability-builder-seed', () => ({ ensureCapabilityBuilderSeeded: jest.fn(async () => {}) }));
jest.mock('../config', () => ({
    cache: {
        c3TaxonomyTtl: 0,
        c3DashboardTtl: 0,
        c3CapabilityMapTtl: 0,
    },
    init: {
        seedCapabilityMap: false,
    },
}));

function app() {
    jest.resetModules();
    const router = require('../routes/taxonomy');
    const server = express();
    server.use(express.json());
    server.use('/api/v1/taxonomy', router);
    return server;
}

describe('dynamic capability map spirals', () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    test('GET /c3/capability-map-spiral99 returns a capability map payload for a custom spiral', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ config_value: 'C3 Taxonomy Catalogue — Baseline 99' }] })
            .mockResolvedValueOnce({ rows: [{ code: 'BattleManagement', label: 'Battle Management', sort_order: 1, heading_color: '#111', background_color: '#eee' }] })
            .mockResolvedValueOnce({ rows: [{ id: 99, page_id: 'CP-9901', uuid: '00000000-0000-4000-8000-000000000099', title: 'Spiral 99 Root', parent_id: null, level: 1, domain_code: 'BattleManagement' }] });

        const response = await request(app()).get('/api/v1/taxonomy/c3/capability-map-spiral99');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(expect.objectContaining({
            page_title: 'C3 Taxonomy Catalogue — Baseline 99',
            summary: expect.objectContaining({ total: 1, domain_count: 1 }),
        }));
        expect(mockQuery.mock.calls[2][1]).toEqual(['Spiral_99']);
    });

    test('POST /c3-capability-builder stores new items under the selected custom spiral', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ code: 'BattleManagement', label: 'Battle Management', sort_order: 1 }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 123 }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ id: 123, page_id: 'CP-9901', title: 'Spiral 99 Root' }] });

        const response = await request(app())
            .post('/api/v1/taxonomy/c3-capability-builder')
            .send({
                page_id: 'CP-9901',
                uuid: '00000000-0000-4000-8000-000000000099',
                title: 'Spiral 99 Root',
                parent_id: null,
                level: 1,
                state: 'draft',
                domain_code: 'BattleManagement',
                spiral: 'Spiral_99',
            });

        expect(response.status).toBe(201);
        const insertCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO data.c3_capability_builder'));
        expect(insertCall?.[0]).toContain('fmn_spiral');
        expect(insertCall?.[1]).toContain('Spiral_99');
    });
});
