'use strict';

jest.mock('../db/readiness.repo', () => ({
    listRules: jest.fn(),
    listServiceStates: jest.fn(),
    listExceptionsForService: jest.fn(),
    listExceptionsForServices: jest.fn(),
}));

const repo = require('../db/readiness.repo');
const {
    getReadinessIndex,
    getReadinessSummary,
    servicePksForReadinessFilter,
} = require('../services/readiness');

const RULES = [
    { rule_key: 'service_has_owner', title: 'Service has owner', enabled: true, blocking: true, severity: 'P0' },
    { rule_key: 'service_has_relations', title: 'Service has relations', enabled: true, blocking: false, severity: 'P2' },
];

function state(pk, overrides = {}) {
    return {
        service_pk: String(pk),
        service_id: `SVC-${pk}`,
        title: `Service ${pk}`,
        lifecycle_stage_code: 'active',
        owner_count: 1,
        relation_count: 1,
        ...overrides,
    };
}

describe('readiness index', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        repo.listRules.mockResolvedValue(RULES);
        repo.listServiceStates.mockResolvedValue([
            state(1, { owner_count: 0 }),                  // blocked
            state(2, { relation_count: 0 }),               // warning only
            state(3),                                      // ready
            state(4, { owner_count: 0 }),                  // blocked, but excepted
        ]);
        repo.listExceptionsForServices.mockResolvedValue([
            { service_id: '4', rule_key: 'service_has_owner', reason: 'Owner transfer', expires_at: null },
        ]);
    });

    test('evaluates every service with one batched exceptions query', async () => {
        const index = await getReadinessIndex();

        expect(repo.listServiceStates).toHaveBeenCalledWith(expect.objectContaining({ all: true }));
        expect(repo.listExceptionsForServices).toHaveBeenCalledTimes(1);
        expect(repo.listExceptionsForService).not.toHaveBeenCalled();
        expect(index.get('1')).toEqual({ state: 'blocked', blocker_count: 1, warning_count: 0 });
        expect(index.get('2')).toEqual({ state: 'warning', blocker_count: 0, warning_count: 1 });
        expect(index.get('3').state).toBe('ready');
        expect(index.get('4').state).toBe('ready');
    });

    test('maps list filter values to service ids', async () => {
        await expect(servicePksForReadinessFilter('blocked')).resolves.toEqual(['1']);
        await expect(servicePksForReadinessFilter('attention')).resolves.toEqual(['1', '2']);
        await expect(servicePksForReadinessFilter('publishable')).resolves.toEqual(['2', '3', '4']);
        await expect(servicePksForReadinessFilter('ready')).resolves.toEqual(['3', '4']);
        await expect(servicePksForReadinessFilter('missing_owner')).resolves.toBeNull();
    });

    test('summary counts cover all services even when the item list is paged', async () => {
        const summary = await getReadinessSummary({ limit: 1 });

        expect(summary.counts).toEqual({ total: 4, blockers: 1, warnings: 1, ready: 2 });
        expect(summary.items).toHaveLength(1);
        expect(summary.groups.ready).toHaveLength(1);
    });
});
