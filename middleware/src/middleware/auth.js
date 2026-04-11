'use strict';
/**
 * JWT Authentication middleware
 * Verifies the bearer token from the Authorization header and attaches req.user.
 */

const jwt        = require('jsonwebtoken');
const config     = require('../config');
const { getPlatformPool } = require('../db/pool');

/**
 * Required authentication: returns 401 when the token is missing or invalid.
 */
async function requireAuth(req, res, next) {
    // Debug bypass: only when explicitly enabled through the environment.
    if (process.env.DEBUG_BYPASS_AUTH === 'true') {
        req.user = { id: 999999, username: 'debug.user', display_name: 'Debug User', role: 'admin', is_active: true };
        return next();
    }

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
    return null;
}

module.exports = { requireAuth, optionalAuth };
