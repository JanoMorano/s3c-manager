'use strict';

jest.mock('../db/services.repo', () => ({
    findByServiceId: jest.fn(),
    updateScore: jest.fn(),
    listActiveServiceIds: jest.fn(),
}));
jest.mock('../db/flavours.repo', () => ({ findByService: jest.fn() }));
jest.mock('../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

const repo = require('../db/services.repo');
const flRepo = require('../db/flavours.repo');
const logger = require('../utils/logger');
const { refreshServiceScore, refreshServiceScoreSafely } = require('../services/completeness');

describe('completeness refresh', () => {
    beforeEach(() => jest.clearAllMocks());

    test('stores the score computed from the service and its flavours', async () => {
        repo.findByServiceId.mockResolvedValue({ service_id: 'SVC-1', title: 'Service' });
        flRepo.findByService.mockResolvedValue([{ price_value: 10 }]);
        const score = await refreshServiceScore('SVC-1');
        expect(repo.updateScore).toHaveBeenCalledWith('SVC-1', score);
        expect(score).toBeGreaterThan(0);
    });

    test('the safe variant logs a failure instead of throwing', async () => {
        repo.findByServiceId.mockRejectedValue(new Error('db down'));
        await expect(refreshServiceScoreSafely('SVC-1')).resolves.toBeUndefined();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('db down'));
    });
});
