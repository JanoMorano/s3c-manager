'use strict';
/**
 * JWT Authentication middleware
 * Verifies token from Authorization header OR secure auth cookie and attaches req.user.
 */

const jwt        = require('jsonwebtoken');
const config     = require('../config');
const { getPlatformPool } = require('../db/pool');

/**
 * Required authentication: returns 401 when the token is missing or invalid.
 */
async function requireAuth(req, res, next) {
    // DEBUG_BYPASS_AUTH removed — was a security risk (admin backdoor).
    // For development/testing, use a proper test account via /auth/login.

    try {
        const token = extractToken(req);
        if (!token) return res.status(401).json({ error: 'Přístup odmítnut: chybí token' });

        let payload;
        try {
            payload = jwt.verify(token, config.jwt.secret, {
                issuer:   config.jwt.issuer,
                audience: config.jwt.audience,
            });
        } catch (err) {
            if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token vypršel, přihlaste se znovu' });
            return res.status(401).json({ error: 'Neplatný token' });
        }

        // Load current user data from the DB because roles may have changed.
        const result = await getPlatformPool().query(`
            SELECT
                id,
                username,
                display_name,
                role,
                is_active,
                auth_provider,
                preferred_lang,
                preferred_theme
            FROM platform.users
            WHERE id = $1
        `, [payload.sub]);
        const user = result.rows[0];

        if (!user)           return res.status(401).json({ error: 'Uživatel nenalezen' });
        if (!user.is_active) return res.status(403).json({ error: 'Účet deaktivován' });

        req.user = user;
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
                role,
                is_active,
                auth_provider
            FROM platform.users
            WHERE id = $1
        `, [payload.sub]);
        req.user = result.rows[0] || null;
        next();
    } catch {
        req.user = null;
        next();
    }
}

function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
    const cookieToken = getCookie(req, 'sc_access_token');
    if (cookieToken) return cookieToken;
    return null;
}

function parseCookies(req) {
    const raw = String(req.headers.cookie || '');
    if (!raw) return {};
    const out = {};
    for (const part of raw.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key) continue;
        try {
            out[key] = decodeURIComponent(value);
        } catch {
            out[key] = value;
        }
    }
    return out;
}

function getCookie(req, name) {
    const cookies = parseCookies(req);
    const value = cookies[name];
    return typeof value === 'string' && value.length > 0 ? value : null;
}

module.exports = { requireAuth, optionalAuth };
