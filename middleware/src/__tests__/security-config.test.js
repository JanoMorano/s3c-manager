'use strict';

const { assertProductionSecrets, isWeakJwtSecret } = require('../utils/security-config');

describe('security config guards', () => {
    test.each([
        '',
        'short-secret',
        'change-me-to-a-long-random-secret',
        'please-change-this-before-production',
        'default-production-password-value',
    ])('detects weak JWT secret %p', (secret) => {
        expect(isWeakJwtSecret(secret)).toBe(true);
    });

    test('accepts a random-looking JWT secret with sufficient length', () => {
        expect(isWeakJwtSecret('a9ec6b7b63a348a8a1f56c75b04c7a5e7d166801c0324b63')).toBe(false);
    });

    test('fails closed for weak JWT secrets in production', () => {
        expect(() => assertProductionSecrets({
            app: { env: 'production' },
            jwt: { secret: 'change-me-to-a-long-random-secret' },
        })).toThrow(/Refusing to start in production/);
    });

    test('does not block weak JWT secrets outside production', () => {
        expect(() => assertProductionSecrets({
            app: { env: 'development' },
            jwt: { secret: 'change-me-to-a-long-random-secret' },
        })).not.toThrow();
    });
});
