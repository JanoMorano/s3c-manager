'use strict';

jest.mock('../db/pool', () => ({
    getPool: jest.fn(),
}));

describe('spiral membership repo', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('recordMembership upserts by entity kind, uuid, and spiral', async () => {
        const row = {
            entity_kind: 'application',
            entity_uuid: 'app-uuid',
            spiral_code: 'Spiral_7',
        };
        const query = jest.fn().mockResolvedValue({ rows: [row] });
        const { getPool } = require('../db/pool');
        getPool.mockReturnValue({ query });

        const repo = require('../db/spiral-membership.repo');
        const result = await repo.recordMembership({
            entityKind: 'application',
            entityUuid: 'app-uuid',
            spiralCode: 'Spiral_7',
            statusInSpiral: 'new',
            ssOverallStatus: 'Approved',
            ssBaselineStatus: 'Baseline',
            itemStatus: 'active',
            sourceRunId: 42,
        });

        expect(result).toBe(row);
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('ON CONFLICT (entity_kind, entity_uuid, spiral_code) DO UPDATE'),
            ['application', 'app-uuid', 'Spiral_7', 'new', 'Approved', 'Baseline', 'active', 42],
        );
    });

    test('recordMembership ignores incomplete input', async () => {
        const query = jest.fn();
        const { getPool } = require('../db/pool');
        getPool.mockReturnValue({ query });

        const repo = require('../db/spiral-membership.repo');
        const result = await repo.recordMembership({
            entityKind: 'application',
            entityUuid: null,
            spiralCode: 'Spiral_7',
        });

        expect(result).toBeNull();
        expect(query).not.toHaveBeenCalled();
    });

    test('recordMembershipBatch attaches run id and returns saved rows', async () => {
        const query = jest.fn()
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            .mockResolvedValueOnce({ rows: [{ id: 2 }] });
        const { getPool } = require('../db/pool');
        getPool.mockReturnValue({ query });

        const repo = require('../db/spiral-membership.repo');
        const result = await repo.recordMembershipBatch([
            { entityKind: 'application', entityUuid: 'app-1', spiralCode: 'Spiral_7' },
            { entityKind: 'data_object', entityUuid: 'do-1', spiralCode: 'Spiral_7' },
        ], { sourceRunId: 99 });

        expect(result).toEqual([{ id: 1 }, { id: 2 }]);
        expect(query).toHaveBeenCalledTimes(2);
        expect(query.mock.calls[0][1][7]).toBe(99);
        expect(query.mock.calls[1][1][7]).toBe(99);
    });

    test('listMembership returns rows ordered by spiral', async () => {
        const rows = [{ spiral_code: 'Spiral_6' }, { spiral_code: 'Spiral_7' }];
        const query = jest.fn().mockResolvedValue({ rows });
        const { getPool } = require('../db/pool');
        getPool.mockReturnValue({ query });

        const repo = require('../db/spiral-membership.repo');
        const result = await repo.listMembership('capability', 'cap-uuid');

        expect(result).toBe(rows);
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('ORDER BY spiral_code'),
            ['capability', 'cap-uuid'],
        );
    });
});
