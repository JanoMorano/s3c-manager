'use strict';

jest.mock('../db/pool', () => ({
    getPool: jest.fn(),
}));

describe('phase 1 transactional repos', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    function buildClient() {
        return {
            query: jest.fn()
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({ rows: [{ id: 1, support_owner_name: 'Ops Team' }] })
                .mockResolvedValueOnce({}),
            release: jest.fn(),
        };
    }

    test('support model repo uses the raw pool connection from the wrapper', async () => {
        const client = buildClient();
        const connect = jest.fn().mockResolvedValue(client);
        const { getPool } = require('../db/pool');
        getPool.mockReturnValue({ raw: { connect } });

        const repo = require('../db/support-model.repo');
        const result = await repo.replaceForService(101, [
            { support_owner_name: 'Ops Team', resolver_group: 'L2' },
        ]);

        expect(connect).toHaveBeenCalledTimes(1);
        expect(client.query).toHaveBeenCalledWith('BEGIN');
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM data.service_support_model'), [101]);
        expect(result).toEqual([{ id: 1, support_owner_name: 'Ops Team' }]);
        expect(client.release).toHaveBeenCalledTimes(1);
    });

    test('audience repo uses the raw pool connection from the wrapper', async () => {
        const client = {
            query: jest.fn()
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({ rows: [{ id: 2, audience_type: 'Internal' }] })
                .mockResolvedValueOnce({}),
            release: jest.fn(),
        };
        const connect = jest.fn().mockResolvedValue(client);
        const { getPool } = require('../db/pool');
        getPool.mockReturnValue({ raw: { connect } });

        const repo = require('../db/audience.repo');
        const result = await repo.replaceForService(101, [
            { audience_type: 'Internal', business_unit: 'Engineering' },
        ]);

        expect(connect).toHaveBeenCalledTimes(1);
        expect(client.query).toHaveBeenCalledWith('BEGIN');
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM data.service_audience_policy'), [101]);
        expect(result).toEqual([{ id: 2, audience_type: 'Internal' }]);
        expect(client.release).toHaveBeenCalledTimes(1);
    });
});
