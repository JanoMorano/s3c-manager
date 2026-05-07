'use strict';

const crypto = require('crypto');

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;
const SENSITIVE_QUERY_KEYS = new Set([
    'access_token',
    'authorization',
    'code',
    'id_token',
    'password',
    'refresh_token',
    'secret',
    'token',
]);

function normalizeIncomingRequestId(value) {
    const candidate = Array.isArray(value) ? value[0] : value;
    const normalized = String(candidate || '').trim();
    return SAFE_REQUEST_ID.test(normalized) ? normalized : null;
}

function createRequestId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return crypto.randomBytes(16).toString('hex');
}

function attachRequestContext(req, res, next) {
    const requestId = normalizeIncomingRequestId(req.headers[REQUEST_ID_HEADER]) || createRequestId();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
}

function sanitizeUrlForLog(originalUrl = '') {
    const raw = String(originalUrl || '/');
    const [path, query = ''] = raw.split('?');
    if (!query) return path || '/';

    const params = new URLSearchParams(query);
    for (const key of Array.from(params.keys())) {
        if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
            params.set(key, '[redacted]');
        }
    }

    const safeQuery = params.toString();
    return safeQuery ? `${path || '/'}?${safeQuery}` : (path || '/');
}

module.exports = {
    attachRequestContext,
    sanitizeUrlForLog,
};
