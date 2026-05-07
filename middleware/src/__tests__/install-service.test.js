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

    test('bootstrapAdmin creates the first admin and persists the password-change flag', async () => {
        const query = jest.fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 7 }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        const result = await svc.bootstrapAdmin({ query }, {
            username: 'Admin',
            displayName: 'Admin User',
            email: 'ADMIN@example.com',
            password: 'Admin1234!',
            mustChangePassword: false,
        }, 'installer');

        expect(result).toEqual({
            ok: true,
            userId: 7,
            username: 'admin',
            mode: 'created',
        });
        expect(query).toHaveBeenCalledTimes(4);
        expect(query.mock.calls[1][0]).toContain('INSERT INTO platform.users');
        expect(query.mock.calls[1][1]).toEqual([
            'admin',
            'Admin User',
            'admin@example.com',
            'hashed-password',
        ]);
        expect(query.mock.calls[2][0]).toContain('auth.admin_must_change_password');
        expect(query.mock.calls[2][1]).toEqual(['false']);
        expect(query.mock.calls[3][1][2]).toBe('ADMIN_BOOTSTRAP');
    });

    test('bootstrapAdmin updates the in-progress bootstrap admin instead of rejecting it', async () => {
        const query = jest.fn()
            .mockResolvedValueOnce({ rows: [{ id: 7, username: 'admin' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 7 }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        const result = await svc.bootstrapAdmin({ query }, {
            username: 'NewAdmin',
            displayName: 'New Admin',
            email: 'new-admin@example.com',
            password: 'NewAdmin123!',
            mustChangePassword: true,
        }, 'NewAdmin');

        expect(result).toEqual({
            ok: true,
            userId: 7,
            username: 'newadmin',
            mode: 'updated',
        });
        expect(query).toHaveBeenCalledTimes(5);
        expect(query.mock.calls[2][0]).toContain('UPDATE platform.users');
        expect(query.mock.calls[2][1]).toEqual([
            'newadmin',
            'New Admin',
            'new-admin@example.com',
            'hashed-password',
            7,
        ]);
        expect(query.mock.calls[3][0]).toContain('auth.admin_must_change_password');
        expect(query.mock.calls[3][1]).toEqual(['true']);
        expect(query.mock.calls[4][1][2]).toBe('ADMIN_BOOTSTRAP_UPDATE');
    });

    test('bootstrapAdmin rejects an update when the chosen username belongs to another account', async () => {
        const query = jest.fn()
            .mockResolvedValueOnce({ rows: [{ id: 7, username: 'admin' }] })
            .mockResolvedValueOnce({ rows: [{ id: 9 }] });

        const result = await svc.bootstrapAdmin({ query }, {
            username: 'manager',
            displayName: 'Manager',
            email: 'manager@example.com',
            password: 'Manager123!',
            mustChangePassword: true,
        }, 'installer');

        expect(result).toEqual({
            ok: false,
            error: 'Zvolené uživatelské jméno už používá jiný účet.',
        });
        expect(query).toHaveBeenCalledTimes(2);
    });
});
