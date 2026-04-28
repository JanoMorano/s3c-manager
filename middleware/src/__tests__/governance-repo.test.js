'use strict';

jest.mock('../db/pool', () => ({
    getPool: jest.fn(),
}));

describe('governance repo', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('lists owner load sorted by score descending and filtered by owner', async () => {
        const query = jest.fn().mockResolvedValue({
            rows: [{ owner_key: 'owner@example.com', owner_load_score: 42 }],
        });
        const { getPool } = require('../db/pool');
        getPool.mockReturnValue({ query });

        const repo = require('../db/governance.repo');
        const rows = await repo.listOwnerLoad({ owner: 'owner@example.com', limit: 10, offset: 0 });

        expect(rows).toEqual([{ owner_key: 'owner@example.com', owner_load_score: 42 }]);
        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0][0]).toContain('FROM data.v_owner_load');
        expect(query.mock.calls[0][0]).toContain('owner_load_score DESC');
        expect(query.mock.calls[0][1]).toContain('owner@example.com');
    });

    test('lists owner role assignments across services for the selected owner', async () => {
        const query = jest.fn().mockResolvedValue({
            rows: [{ owner_key: 'owner@example.com', service_id: 'SVC-IAM', role_code: 'service_owner' }],
        });
        const { getPool } = require('../db/pool');
        getPool.mockReturnValue({ query });

        const repo = require('../db/governance.repo');
        const rows = await repo.listOwnerAssignments({ owner: 'owner@example.com', limit: 25, offset: 0 });

        expect(rows).toEqual([{ owner_key: 'owner@example.com', service_id: 'SVC-IAM', role_code: 'service_owner' }]);
        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0][0]).toContain('FROM data.service_role_assignment sra');
        expect(query.mock.calls[0][0]).toContain('JOIN data.service_catalog sc');
        expect(query.mock.calls[0][0]).toContain('LEFT JOIN data.ref_service_role role_ref');
        expect(query.mock.calls[0][1]).toContain('owner@example.com');
    });

    test('filters service risks by severity', async () => {
        const query = jest.fn().mockResolvedValue({
            rows: [{ finding_key: 'service:1:missing-owner', severity: 'P0' }],
        });
        const { getPool } = require('../db/pool');
        getPool.mockReturnValue({ query });

        const repo = require('../db/governance.repo');
        const rows = await repo.listServiceRisks({ severity: ['P0'], limit: 25, offset: 0 });

        expect(rows).toHaveLength(1);
        expect(query.mock.calls[0][0]).toContain('FROM data.v_service_risk_radar');
        expect(query.mock.calls[0][1]).toContainEqual(['P0']);
    });

    test('dismissing a generated advisor finding persists the finding and writes dismissal audit', async () => {
        const query = jest.fn()
            .mockResolvedValueOnce({
                rows: [{
                    finding_id: null,
                    finding_key: 'owner:owner@example.com:overloaded',
                    finding_type: 'owner_load',
                    severity: 'P2',
                    source_entity_type: 'owner',
                    source_entity_id: 'owner@example.com',
                    title: 'Owner load: Owner',
                    reason: 'Owner has load score 42.',
                    suggested_action: 'Delegate ownership.',
                    target_url: '/operations/owner-load?owner=owner@example.com',
                    score: 42,
                }],
            })
            .mockResolvedValueOnce({ rows: [{ finding_id: 123 }] })
            .mockResolvedValueOnce({ rows: [{ dismissal_id: 77, finding_id: 123 }] });
        const { getPool } = require('../db/pool');
        getPool.mockReturnValue({ query });

        const repo = require('../db/governance.repo');
        const result = await repo.dismissFinding({
            findingId: 'owner:owner@example.com:overloaded',
            reason: 'Ownership delegated',
            actor: 'admin@example.com',
        });

        expect(result).toEqual({ dismissal_id: 77, finding_id: 123 });
        expect(query.mock.calls[1][0]).toContain('INSERT INTO data.governance_finding');
        expect(query.mock.calls[2][0]).toContain('INSERT INTO data.governance_finding_dismissal');
        expect(query.mock.calls[2][1]).toEqual([123, 'admin@example.com', 'Ownership delegated']);
    });
});
