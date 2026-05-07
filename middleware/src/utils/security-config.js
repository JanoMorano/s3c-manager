'use strict';

const WEAK_SECRET_PATTERNS = [
    /change[-_ ]?me/i,
    /change[-_ ]?this/i,
    /changeme/i,
    /please[-_ ]?change/i,
    /replace[-_ ]?me/i,
    /example/i,
    /default/i,
    /password/i,
    /postgres/i,
    /secret/i,
];

function isWeakJwtSecret(value, { minLength = 32 } = {}) {
    const secret = String(value || '').trim();
    if (secret.length < minLength) return true;
    return WEAK_SECRET_PATTERNS.some((pattern) => pattern.test(secret));
}

function assertProductionSecrets(config) {
    const env = String(config?.app?.env || '').trim().toLowerCase();
    if (env !== 'production') return;

    if (isWeakJwtSecret(config?.jwt?.secret)) {
        throw new Error(
            'Refusing to start in production: JWT_SECRET is weak or placeholder-like. ' +
            'Set a unique random value with at least 32 characters before starting the app.'
        );
    }
}

module.exports = {
    assertProductionSecrets,
    isWeakJwtSecret,
};
