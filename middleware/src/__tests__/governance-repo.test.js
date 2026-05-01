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

    test('creates and updates governance reviews', async () => {
        const query = jest.fn()
            .mockResolvedValueOnce({ rows: [{ id: 7 }] })
            .mockResolvedValueOnce({ rows: [{ id: 11, service_id: 'SVC-IAM', status: 'pending' }] })
            .mockResolvedValueOnce({ rows: [{ id: 11, service_id: 'SVC-IAM', status: 'in_review' }] });
        const { getPool } = require('../db/pool');
        getPool.mockReturnValue({ query });

        const repo = require('../db/governance.repo');
        const created = await repo.createReview({
            service_id: 'SVC-IAM',
            review_type: 'publish',
            status: 'pending',
            requested_by: 'admin@example.com',
            assigned_to: 'owner@example.com',
            due_at: '2026-06-01T00:00:00Z',
        });
        const updated = await repo.updateReview(11, {
            status: 'in_review',
            assigned_to: 'reviewer@example.com',
            completed_at: null,
        });

        expect(created.id).toBe(11);
        expect(updated.status).toBe('in_review');
        expect(query.mock.calls[0][0]).toContain('FROM data.service_catalog');
        expect(query.mock.calls[1][0]).toContain('INSERT INTO data.governance_review');
        expect(query.mock.calls[2][0]).toContain('UPDATE data.governance_review');
    });

    test('ignores empty workflow array filters when listing reviews and decisions', async () => {
        const query = jest.fn()
            .mockResolvedValueOnce({ rows: [{ id: 11, service_id: 'SVC-IAM', status: 'pending' }] })
            .mockResolvedValueOnce({ rows: [{ id: 44, service_id: 'SVC-IAM', decision: 'approved' }] });
        const { getPool } = require('../db/pool');
        getPool.mockReturnValue({ query });

        const repo = require('../db/governance.repo');
        await repo.listReviews({ status: [], limit: 25, offset: 0 });
        await repo.listDecisions({ decision: [], limit: 25, offset: 0 });

        expect(query.mock.calls[0][0]).not.toContain('gr.status = ANY');
        expect(query.mock.calls[0][1]).toEqual([25, 0]);
        expect(query.mock.calls[1][0]).not.toContain('gd.decision = ANY');
        expect(query.mock.calls[1][1]).toEqual([25, 0]);
    });

    test('creates governance decisions for a resolved service', async () => {
        const query = jest.fn()
            .mockResolvedValueOnce({ rows: [{ id: 7 }] })
            .mockResolvedValueOnce({ rows: [{ id: 44, service_id: 'SVC-IAM', decision: 'approved' }] });
        const { getPool } = require('../db/pool');
        getPool.mockReturnValue({ query });

        const repo = require('../db/governance.repo');
        const decision = await repo.createDecision({
            service_id: 'SVC-IAM',
            decision_type: 'publish_approval',
            decision: 'approved',
            rationale: 'Ready',
            decided_by: 'admin@example.com',
        });

        expect(decision.id).toBe(44);
        expect(query.mock.calls[0][0]).toContain('FROM data.service_catalog');
        expect(query.mock.calls[1][0]).toContain('INSERT INTO data.governance_decision');
        expect(query.mock.calls[1][1]).toEqual(expect.arrayContaining([7, 'publish_approval', 'approved', 'Ready', 'admin@example.com']));
    });
});
