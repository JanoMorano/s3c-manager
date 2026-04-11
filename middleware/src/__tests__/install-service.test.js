'use strict';

jest.mock('bcrypt', () => ({
    hash: jest.fn().mockResolvedValue('hashed-password'),
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../db/pool', () => ({
    getPlatformPool: jest.fn(),
}));

describe('install.service audit logging', () => {
    let svc;

    beforeEach(() => {
        jest.resetModules();
        svc = require('../services/install.service');
    });

    test('transitionTo writes audit entries with an audit-log compatible action', async () => {
        const query = jest.fn().mockResolvedValue({ rowCount: 1, rows: [] });

        await svc.transitionTo({ query }, 'INSTALL_IN_PROGRESS', 'admin');

        expect(query).toHaveBeenCalledTimes(2);
        expect(query.mock.calls[1][0]).toContain('INSERT INTO platform.audit_log');
        expect(query.mock.calls[1][1][1]).toBe(1);
        expect(query.mock.calls[1][1][3]).toBe('UPDATE');
    });

    test('activateModule keeps module audit events out of the constrained action column', async () => {
        const query = jest.fn()
            .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, module_code: 'SERVICE_CATALOGUE_CORE' }] })
            .mockResolvedValueOnce({ rowCount: 1, rows: [] })
            .mockResolvedValueOnce({ rowCount: 1, rows: [] });

        const result = await svc.activateModule({ query }, 'SERVICE_CATALOGUE_CORE', 'admin');

        expect(result).toEqual({ ok: true });
        expect(query).toHaveBeenCalledTimes(3);
        expect(query.mock.calls[2][0]).toContain('INSERT INTO platform.audit_log');
        expect(query.mock.calls[2][1][0]).toBe('system_installation');
        expect(query.mock.calls[2][1][2]).toBe('MODULE_ACTIVATE:SERVICE_CATALOGUE_CORE');
        expect(query.mock.calls[2][1][3]).toBe('UPDATE');
    });
});
