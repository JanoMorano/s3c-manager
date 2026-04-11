'use strict';

const mockQuery = jest.fn();
const mockInfo = jest.fn();
const mockError = jest.fn();

jest.mock('../config', () => ({
    retention: {
        enabled: true,
        runnerName: 'inline-app',
        runnerKind: 'app-inline',
        purgeIntervalSeconds: 60,
        heartbeatTtlSeconds: 180,
    },
}));

jest.mock('../utils/logger', () => ({
    info: (...args) => mockInfo(...args),
    error: (...args) => mockError(...args),
    warn: jest.fn(),
    http: jest.fn(),
}));

jest.mock('../db/pool', () => ({
    getPool: () => ({ query: mockQuery }),
}));

describe('retention service', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockQuery.mockReset();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('runRetentionCycle updates heartbeat and runs PG purge function', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [{
                    job_id: 21,
                    status: 'success',
                    deleted_import_issue: 2,
                    deleted_import_row: 1,
                    deleted_import_batch: 1,
                    deleted_taxonomy_audit: 0,
                    deleted_graph_audit: 0,
                    started_at: '2026-04-07T10:00:00.000Z',
                    completed_at: '2026-04-07T10:00:01.000Z',
                    error_message: null,
                }],
            })
            .mockResolvedValueOnce({ rows: [] });

        const { runRetentionCycle } = require('../services/retention');
        const result = await runRetentionCycle('test');

        expect(result).toEqual(expect.objectContaining({
            job_id: 21,
            status: 'success',
            deleted_import_issue: 2,
        }));
        expect(mockQuery).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('upsert_retention_runner_heartbeat'),
            expect.arrayContaining(['inline-app', 'app-inline', 'running'])
        );
        expect(mockQuery).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('run_retention_purge'),
            ['test:inline-app']
        );
        expect(mockQuery).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('upsert_retention_runner_heartbeat'),
            expect.arrayContaining(['inline-app', 'app-inline', 'idle'])
        );
        expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining('Retention purge completed'));
    });

    test('startRetentionScheduler performs startup run and schedules next cycle', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [{
                    job_id: 99,
                    status: 'success',
                    deleted_import_issue: 0,
                    deleted_import_row: 0,
                    deleted_import_batch: 0,
                    deleted_taxonomy_audit: 0,
                    deleted_graph_audit: 0,
                    started_at: '2026-04-07T10:00:00.000Z',
                    completed_at: '2026-04-07T10:00:01.000Z',
                    error_message: null,
                }],
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [{
                    job_id: 100,
                    status: 'success',
                    deleted_import_issue: 0,
                    deleted_import_row: 0,
                    deleted_import_batch: 0,
                    deleted_taxonomy_audit: 0,
                    deleted_graph_audit: 0,
                    started_at: '2026-04-07T10:01:00.000Z',
                    completed_at: '2026-04-07T10:01:01.000Z',
                    error_message: null,
                }],
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        const { startRetentionScheduler, stopRetentionScheduler } = require('../services/retention');

        await startRetentionScheduler();
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('run_retention_purge'),
            ['startup:inline-app']
        );

        await jest.advanceTimersByTimeAsync(60000);

        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('run_retention_purge'),
            ['scheduled:inline-app']
        );

        await stopRetentionScheduler();
        expect(mockQuery).toHaveBeenLastCalledWith(
            expect.stringContaining('upsert_retention_runner_heartbeat'),
            expect.arrayContaining(['inline-app', 'app-inline', 'stopped'])
        );
    });
});
