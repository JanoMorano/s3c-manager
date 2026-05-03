'use strict';
/**
 * JWT Authentication middleware
 * Verifies the bearer token from the Authorization header and attaches req.user.
 */

const jwt        = require('jsonwebtoken');
const config     = require('../config');
const { getPlatformPool } = require('../db/pool');
const { getConfigValues } = require('../utils/platform-config');
const { normalizeLocale } = require('../../../shared/i18n/locales');
const { tReq } = require('../utils/i18n');

const ACCESS_COOKIE_NAME = 'sc_access_token';
const MUST_CHANGE_PASSWORD_KEY = 'auth.admin_must_change_password';

function readCookie(req, name) {
    const cookieHeader = String(req.headers.cookie || '');
    if (!cookieHeader) return null;

    for (const part of cookieHeader.split(';')) {
        const [rawKey, ...rest] = part.split('=');
        const key = String(rawKey || '').trim();
        if (!key || key !== name) continue;
        return decodeURIComponent(rest.join('=').trim() || '');
    }

    return null;
}

function isAuthPasswordChangeBypassPath(req) {
    const path = String(req.originalUrl || req.path || '');
    return (
        path === '/api/v1/auth/me' ||
        path === '/api/v1/auth/logout' ||
        path === '/api/v1/auth/refresh' ||
        path === '/api/v1/auth/change-password' ||
        path.startsWith('/api/v1/auth/me?') ||
        path.startsWith('/api/v1/auth/logout?') ||
        path.startsWith('/api/v1/auth/refresh?') ||
        path.startsWith('/api/v1/auth/change-password?')
    );
}

async function isPasswordChangeRequired() {
    const rows = await getConfigValues([MUST_CHANGE_PASSWORD_KEY]);
    const raw = String(rows?.[MUST_CHANGE_PASSWORD_KEY]?.config_value ?? '').trim().toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(raw);
}

function canUserBeForcedToChangePassword(user) {
    return user?.role === 'admin' && (user?.auth_provider ?? 'local') === 'local';
}

function normalizeAuthenticatedUser(user) {
    if (!user) {
        return user;
    }

    return {
        ...user,
        preferred_lang: normalizeLocale(user.preferred_lang),
    };
}

/**
 * Required authentication: returns 401 when the token is missing or invalid.
 */
async function requireAuth(req, res, next) {
    try {
        const token = extractToken(req);
        if (!token) return res.status(401).json({ error: tReq(req, 'auth.errors.missing_token') });

        let payload;
        try {
            payload = jwt.verify(token, config.jwt.secret, {
                issuer:   config.jwt.issuer,
                audience: config.jwt.audience,
            });
        } catch (err) {
            if (err.name === 'TokenExpiredError') return res.status(401).json({ error: tReq(req, 'auth.errors.expired_token') });
            return res.status(401).json({ error: tReq(req, 'auth.errors.invalid_token') });
        }

        // Load current user data from the DB because roles may have changed.
        const result = await getPlatformPool().query(`
            SELECT
                id,
                username,
                display_name,
                email,
                role,
                is_active,
                auth_provider,
                preferred_lang,
                preferred_theme,
                COALESCE(preferred_persona, 'service_owner') AS preferred_persona
            FROM platform.users
            WHERE id = $1
        `, [payload.sub]);
        const user = result.rows[0];

        if (!user)           return res.status(401).json({ error: tReq(req, 'auth.errors.user_not_found') });
        req.user = normalizeAuthenticatedUser(user);
        if (!user.is_active) return res.status(403).json({ error: tReq(req, 'auth.errors.account_deactivated') });

        if (
            !isAuthPasswordChangeBypassPath(req) &&
            canUserBeForcedToChangePassword(user) &&
            await isPasswordChangeRequired()
        ) {
            return res.status(403).json({ error: tReq(req, 'auth.errors.password_change_required') });
        }

        next();
    } catch (err) {
        next(err);
    }
}

/**
 * Optional authentication: continues without a token (req.user = null).
 */
async function optionalAuth(req, res, next) {
    try {
        const token = extractToken(req);
        if (!token) { req.user = null; return next(); }

        const payload = jwt.verify(token, config.jwt.secret, {
            issuer: config.jwt.issuer, audience: config.jwt.audience,
        });
        const result = await getPlatformPool().query(`
            SELECT
                id,
                username,
                display_name,
                email,
                role,
                is_active,
                auth_provider,
                preferred_lang
            FROM platform.users
            WHERE id = $1
        `, [payload.sub]);
        req.user = normalizeAuthenticatedUser(result.rows[0] || null);
        next();
    } catch {
        req.user = null;
        next();
    }
}

function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
    return readCookie(req, ACCESS_COOKIE_NAME);
}

module.exports = { requireAuth, optionalAuth };
