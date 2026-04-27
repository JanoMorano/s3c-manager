'use strict';
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { getPlatformPool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const config = require('../config');
const logger = require('../utils/logger');
const { getConfigValues, upsertConfigValue } = require('../utils/platform-config');
const audit = require('../db/audit.repo');
const { normalizeLocale } = require('../../../shared/i18n/locales');
const { tReq } = require('../utils/i18n');

/** Records a failed authentication attempt into audit_log (fire-and-forget). */
function logAuthFailure(req, { username, userId = 0, reason }) {
    audit.log({
        tableName: 'users',
        recordId: userId,
        recordLabel: username || null,
        action: 'AUTH_FAILURE',
        newValues: { reason },
        performedBy: username || 'unknown',
        clientIp: req.ip || null,
        userAgent: req.get('user-agent') || null,
    }).catch(err => logger.warn({ err }, 'audit_log: AUTH_FAILURE write failed'));
}

const router = express.Router();
const ACCESS_COOKIE_NAME = 'sc_access_token';
const REFRESH_COOKIE_NAME = 'sc_refresh_token';
const LOCALE_COOKIE_NAME = 'sc_locale';
const MUST_CHANGE_PASSWORD_KEY = 'auth.admin_must_change_password';

const loginLimiter = rateLimit({
    windowMs: config.rateLimit.auth.windowMs,
    max: config.rateLimit.auth.max,
    message: (req) => ({ error: tReq(req, 'auth.rate_limit.login') }),
    standardHeaders: true,
    legacyHeaders: false,
});

function generateTokens(userId, username, role, displayName) {
    const payload = { sub: userId, username, role, display_name: displayName ?? null };
    const access = jwt.sign(payload, config.jwt.secret, {
        expiresIn: `${config.jwt.expiryMinutes}m`,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
    });
    const refresh = jwt.sign({ sub: userId }, config.jwt.secret, {
        expiresIn: `${config.jwt.refreshDays}d`,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
    });
    return { access, refresh };
}

function normalizeIdentity(value) {
    return String(value ?? '').trim().toLowerCase();
}

function canUserBeForcedToChangePassword(user) {
    return user?.role === 'admin' && (user?.auth_provider ?? 'local') === 'local';
}

async function isPasswordChangeRequiredForUser(user) {
    if (!canUserBeForcedToChangePassword(user)) return false;
    const rows = await getConfigValues([MUST_CHANGE_PASSWORD_KEY]);
    const raw = String(rows?.[MUST_CHANGE_PASSWORD_KEY]?.config_value ?? '').trim().toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(raw);
}

function isHttpsRequest(req) {
    const forwardedProto = String(req.get('x-forwarded-proto') || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
    return Boolean(req.secure) || forwardedProto === 'https';
}

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

function getAuthCookieOptions(req, maxAgeMs) {
    return {
        httpOnly: true,
        secure: isHttpsRequest(req),
        sameSite: 'lax',
        path: '/',
        maxAge: maxAgeMs,
    };
}

function getAuthCookieClearOptions(req) {
    return {
        httpOnly: true,
        secure: isHttpsRequest(req),
        sameSite: 'lax',
        path: '/',
    };
}

function setAuthCookies(req, res, { accessToken, refreshToken }) {
    res.cookie(ACCESS_COOKIE_NAME, accessToken, getAuthCookieOptions(req, config.jwt.expiryMinutes * 60 * 1000));
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getAuthCookieOptions(req, config.jwt.refreshDays * 24 * 60 * 60 * 1000));
}

function getLocaleCookieOptions(req) {
    return {
        secure: isHttpsRequest(req),
        sameSite: 'lax',
        path: '/',
        maxAge: 365 * 24 * 60 * 60 * 1000,
    };
}

function setLocaleCookie(req, res, locale) {
    res.cookie(LOCALE_COOKIE_NAME, normalizeLocale(locale), getLocaleCookieOptions(req));
}

function clearAuthCookies(req, res) {
    const clearOptions = getAuthCookieClearOptions(req);
    res.clearCookie(ACCESS_COOKIE_NAME, clearOptions);
    res.clearCookie(REFRESH_COOKIE_NAME, clearOptions);
}

const SSO_CONFIG_KEYS = {
    enabled: 'auth.sso.enabled',
    header: 'auth.sso.header',
    displayNameHeader: 'auth.sso.display_name_header',
    emailHeader: 'auth.sso.email_header',
    givenNameHeader: 'auth.sso.given_name_header',
    surnameHeader: 'auth.sso.surname_header',
    departmentHeader: 'auth.sso.department_header',
};

async function getSsoRuntimeConfig() {
    const rows = await getConfigValues(Object.values(SSO_CONFIG_KEYS));
    const readValue = (key, fallback) => String(rows[key]?.config_value ?? fallback ?? '').trim() || fallback;
    const enabledValue = String(rows[SSO_CONFIG_KEYS.enabled]?.config_value ?? String(config.auth.sso.enabled)).trim().toLowerCase();

    return {
        enabled: ['true', '1', 'yes', 'on'].includes(enabledValue),
        header: readValue(SSO_CONFIG_KEYS.header, config.auth.sso.header),
        displayNameHeader: readValue(SSO_CONFIG_KEYS.displayNameHeader, config.auth.sso.displayNameHeader),
        emailHeader: readValue(SSO_CONFIG_KEYS.emailHeader, config.auth.sso.emailHeader),
        givenNameHeader: readValue(SSO_CONFIG_KEYS.givenNameHeader, config.auth.sso.givenNameHeader),
        surnameHeader: readValue(SSO_CONFIG_KEYS.surnameHeader, config.auth.sso.surnameHeader),
        departmentHeader: readValue(SSO_CONFIG_KEYS.departmentHeader, config.auth.sso.departmentHeader),
    };
}

/**
 * GET /api/v1/auth/modes
 * Public, read-only authentication mode discovery for the login page.
 * It intentionally does not process identity headers; SSO is attempted only
 * after an administrator enables it in Admin → Web / ADFS settings.
 */
router.get('/modes', async (req, res, next) => {
    try {
        const runtimeConfig = await getSsoRuntimeConfig();
        res.json({
            local: true,
            sso: runtimeConfig.enabled,
        });
    } catch (err) {
        next(err);
    }
});

function deriveIdentityCandidates(principal) {
    const raw = normalizeIdentity(principal);
    const noDomain = raw.includes('\\') ? raw.split('\\').pop() : raw;
    const alias = noDomain.includes('@') ? noDomain.split('@')[0] : noDomain;
    return [...new Set([raw, noDomain, alias].filter(Boolean))];
}

function buildUserResponse(user, { mustChangePassword = false } = {}) {
    return {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        auth_provider: user.auth_provider ?? 'local',
        must_change_password: mustChangePassword,
        preferred_lang: normalizeLocale(user.preferred_lang),
        preferred_theme: user.preferred_theme || 'dark',
    };
}

async function storeRefreshToken(userId, refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + config.jwt.refreshDays * 24 * 60 * 60 * 1000);
    await getPlatformPool().query(
        'INSERT INTO platform.refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [userId, tokenHash, expiresAt]
    );
}

async function loadUserById(userId) {
    const result = await getPlatformPool().query(`
        SELECT
            id,
            username,
            display_name,
            email,
            role,
            is_active,
            auth_provider,
            external_principal,
            preferred_lang,
            preferred_theme,
            COALESCE(preferred_persona, 'service_owner') AS preferred_persona,
            given_name,
            surname,
            phone,
            department,
            avatar_color,
            last_login_at,
            last_sso_login_at
        FROM platform.users
        WHERE id = $1
    `, [userId]);
    return result.rows[0] ?? null;
}

async function updateLoginState(userId, req, { isSso = false, ssoProfile = null } = {}) {
    await getPlatformPool().query(`
        UPDATE platform.users
        SET
            last_login_at = CURRENT_TIMESTAMP,
            last_login_ip = $2,
            last_sso_login_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE last_sso_login_at END,
            display_name = COALESCE($4, display_name),
            email = COALESCE($5, email),
            given_name = COALESCE($6, given_name),
            surname = COALESCE($7, surname),
            department = COALESCE($8, department),
            external_principal = CASE
                WHEN $3 THEN COALESCE(NULLIF(external_principal, ''), $9, external_principal)
                ELSE external_principal
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    `, [
        userId,
        req.ip || null,
        isSso,
        ssoProfile?.display_name ?? null,
        ssoProfile?.email ?? null,
        ssoProfile?.given_name ?? null,
        ssoProfile?.surname ?? null,
        ssoProfile?.department ?? null,
        ssoProfile?.principal ?? null,
    ]);
}

async function issueLoginResponse(user, req, res, { isSso = false, ssoProfile = null } = {}) {
    const effectiveDisplayName = ssoProfile?.display_name || user.display_name || null;
    const tokens = generateTokens(user.id, user.username, user.role, effectiveDisplayName);
    await storeRefreshToken(user.id, tokens.refresh);
    await updateLoginState(user.id, req, { isSso, ssoProfile });
    setAuthCookies(req, res, { accessToken: tokens.access, refreshToken: tokens.refresh });
    const currentUser = await loadUserById(user.id);
    const resolvedUser = currentUser || user;
    const mustChangePassword = await isPasswordChangeRequiredForUser(resolvedUser);
    setLocaleCookie(req, res, resolvedUser.preferred_lang);
    return {
        access_token: tokens.access,
        expires_in: config.jwt.expiryMinutes * 60,
        user: buildUserResponse(resolvedUser, { mustChangePassword }),
    };
}

function buildSsoProfile(req, runtimeConfig) {
    const principal = req.get(runtimeConfig.header);
    if (!principal) return null;

    const displayName = req.get(runtimeConfig.displayNameHeader);
    const email = req.get(runtimeConfig.emailHeader);
    const givenName = req.get(runtimeConfig.givenNameHeader);
    const surname = req.get(runtimeConfig.surnameHeader);
    const department = req.get(runtimeConfig.departmentHeader);

    return {
        principal: String(principal).trim(),
        display_name: displayName ? String(displayName).trim() : null,
        email: email ? String(email).trim().toLowerCase() : null,
        given_name: givenName ? String(givenName).trim() : null,
        surname: surname ? String(surname).trim() : null,
        department: department ? String(department).trim() : null,
    };
}

function getTrustedProxyBoundaryConfig() {
    return {
        header: String(config.auth.sso.trustedProxyHeader ?? '').trim(),
        sharedSecret: String(config.auth.sso.trustedProxySharedSecret || '').trim(),
    };
}

function validateTrustedProxyBoundary(req) {
    const { header, sharedSecret } = getTrustedProxyBoundaryConfig();
    if (!header) {
        return {
            status: 403,
            error: tReq(req, 'auth.sso.errors.boundary_header_missing'),
        };
    }

    if (!sharedSecret) {
        return {
            status: 403,
            error: tReq(req, 'auth.sso.errors.boundary_secret_missing'),
        };
    }

    const presentedSecret = String(req.get(header) || '').trim();
    if (!presentedSecret) {
        return {
            status: 403,
            error: tReq(req, 'auth.sso.errors.boundary_secret_required'),
        };
    }

    const expected = Buffer.from(sharedSecret);
    const presented = Buffer.from(presentedSecret);
    const matches = expected.length === presented.length && crypto.timingSafeEqual(expected, presented);
    if (!matches) {
        return {
            status: 403,
            error: tReq(req, 'auth.sso.errors.boundary_secret_invalid'),
        };
    }

    return null;
}

async function findSsoUser(principal) {
    const [candidate1 = '', candidate2 = '', candidate3 = ''] = deriveIdentityCandidates(principal);
    const result = await getPlatformPool().query(`
        SELECT
            id,
            username,
            display_name,
            email,
            role,
            is_active,
            auth_provider,
            external_principal,
            preferred_lang,
            preferred_theme,
            given_name,
            surname,
            phone,
            department,
            avatar_color,
            last_login_at,
            last_sso_login_at
        FROM platform.users
        WHERE auth_provider = 'ad'
          AND is_active = TRUE
          AND (
                LOWER(COALESCE(external_principal, '')) IN ($1, $2, $3)
             OR LOWER(username) IN ($1, $2, $3)
          )
        ORDER BY
            CASE
                WHEN LOWER(COALESCE(external_principal, '')) = $1 THEN 0
                WHEN LOWER(username) = $2 THEN 1
                WHEN LOWER(username) = $1 THEN 2
                ELSE 3
            END,
            id ASC
        LIMIT 1
    `, [candidate1, candidate2, candidate3]);
    return result.rows[0] ?? null;
}

/**
 * POST /api/v1/auth/login
 * Local username/password login.
 */
router.post('/login', loginLimiter, async (req, res, next) => {
    try {
        const username = String(req.body.username ?? '').toLowerCase().trim();
        const password = String(req.body.password ?? '');

        if (!username || !password) {
            return res.status(400).json({ error: tReq(req, 'auth.login.errors.missing_credentials') });
        }

        const result = await getPlatformPool().query(`
            SELECT
                id,
                username,
                display_name,
                role,
                is_active,
                auth_provider,
                password_hash,
                preferred_lang,
                preferred_theme
            FROM platform.users
            WHERE LOWER(username) = $1
        `, [username]);

        const user = result.rows[0];
        if (!user) {
            logAuthFailure(req, { username, reason: 'user_not_found' });
            return res.status(401).json({ error: tReq(req, 'auth.login.errors.invalid_credentials') });
        }
        if (!user.is_active) {
            logAuthFailure(req, { username, userId: user.id, reason: 'account_disabled' });
            return res.status(403).json({ error: tReq(req, 'auth.errors.account_deactivated') });
        }
        if (user.auth_provider === 'ad') {
            logAuthFailure(req, { username, userId: user.id, reason: 'ad_account_local_attempt' });
            return res.status(401).json({ error: tReq(req, 'auth.login.errors.ad_account') });
        }
        if (!user.password_hash) {
            logAuthFailure(req, { username, userId: user.id, reason: 'no_password_hash' });
            return res.status(401).json({ error: tReq(req, 'auth.login.errors.local_password_missing') });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            logAuthFailure(req, { username, userId: user.id, reason: 'invalid_password' });
            return res.status(401).json({ error: tReq(req, 'auth.login.errors.invalid_credentials') });
        }

        const response = await issueLoginResponse(user, req, res);
        logger.info(`Login: ${user.username} (${user.role}) from ${req.ip}`);
        res.json(response);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/auth/sso
 * Silent login through trusted headers from reverse proxy / IIS / ADFS.
 */
router.get('/sso', async (req, res, next) => {
    try {
        const runtimeConfig = await getSsoRuntimeConfig();
        if (!runtimeConfig.enabled) return res.status(204).end();

        const boundaryError = validateTrustedProxyBoundary(req);
        if (boundaryError) {
            return res.status(boundaryError.status).json({ error: boundaryError.error });
        }

        const ssoProfile = buildSsoProfile(req, runtimeConfig);
        if (!ssoProfile?.principal) {
            return res.status(401).json({ error: tReq(req, 'auth.sso.errors.missing_identity') });
        }

        const user = await findSsoUser(ssoProfile.principal);
        if (!user) {
            logAuthFailure(req, { username: ssoProfile.principal, reason: 'sso_user_not_found' });
            return res.status(403).json({ error: tReq(req, 'auth.sso.errors.no_active_account') });
        }
        if (!user.is_active) {
            logAuthFailure(req, { username: user.username, userId: user.id, reason: 'sso_account_disabled' });
            return res.status(403).json({ error: tReq(req, 'auth.sso.errors.account_deactivated') });
        }

        const response = await issueLoginResponse(user, req, res, { isSso: true, ssoProfile });
        logger.info(`SSO login: ${user.username} (${user.role}) from ${req.ip}`);
        res.json(response);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/auth/refresh
 */
router.post('/refresh', async (req, res, next) => {
    try {
        const { refresh_token } = req.body || {};
        const cookieRefreshToken = readCookie(req, REFRESH_COOKIE_NAME);
        const refreshToken = String(refresh_token || cookieRefreshToken || '').trim();
        if (!refreshToken) return res.status(400).json({ error: tReq(req, 'auth.refresh.errors.missing_token') });

        let payload;
        try {
            payload = jwt.verify(refreshToken, config.jwt.secret, {
                issuer: config.jwt.issuer,
                audience: config.jwt.audience,
            });
        } catch {
            return res.status(401).json({ error: tReq(req, 'auth.refresh.errors.invalid_token') });
        }

        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const tokenRes = await getPlatformPool().query(
            'SELECT id, user_id, expires_at, revoked_at FROM platform.refresh_tokens WHERE token_hash = $1',
            [tokenHash]
        );
        const tokenRow = tokenRes.rows[0];

        if (!tokenRow || tokenRow.revoked_at || new Date(tokenRow.expires_at) < new Date()) {
            return res.status(401).json({ error: tReq(req, 'auth.refresh.errors.revoked_token') });
        }

        const user = await loadUserById(payload.sub);
        if (!user || !user.is_active) return res.status(401).json({ error: tReq(req, 'auth.refresh.errors.user_not_found') });

        const newTokens = generateTokens(user.id, user.username, user.role, user.display_name);

        await getPlatformPool().query(
            'UPDATE platform.refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
            [tokenHash]
        );

        await storeRefreshToken(user.id, newTokens.refresh);
        setAuthCookies(req, res, { accessToken: newTokens.access, refreshToken: newTokens.refresh });

        res.json({
            access_token: newTokens.access,
            expires_in: config.jwt.expiryMinutes * 60,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/auth/logout
 * Idempotent logout: clears auth cookies even when the access token is already expired.
 */
router.post('/logout', async (req, res, next) => {
    try {
        const { refresh_token } = req.body || {};
        const cookieRefreshToken = readCookie(req, REFRESH_COOKIE_NAME);
        const refreshToken = String(refresh_token || cookieRefreshToken || '').trim();
        if (refreshToken) {
            const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
            await getPlatformPool().query(
                'UPDATE platform.refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
                [hash]
            );
        }
        clearAuthCookies(req, res);
        res.json({ message: tReq(req, 'auth.logout.success') });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/auth/me
 */
router.get('/me', requireAuth, async (req, res, next) => {
    try {
        let user;
        try {
            user = await loadUserById(req.user.id);
        } catch {
            const result = await getPlatformPool().query(`
                SELECT
                    id,
                    username,
                    display_name,
                    email,
                    role,
                    preferred_lang,
                    preferred_theme
                FROM platform.users
                WHERE id = $1
            `, [req.user.id]);
            user = result.rows[0];
        }

        if (!user) return res.status(404).json({ error: tReq(req, 'auth.refresh.errors.user_not_found') });

        res.json({
            id: user.id,
            username: user.username,
            display_name: user.display_name ?? null,
            email: user.email ?? null,
            role: user.role,
            auth_provider: user.auth_provider ?? 'local',
            must_change_password: await isPasswordChangeRequiredForUser(user),
            external_principal: user.external_principal ?? null,
            preferred_lang: normalizeLocale(user.preferred_lang),
            preferred_theme: user.preferred_theme ?? 'dark',
            preferred_persona: user.preferred_persona ?? 'service_owner',
            given_name: user.given_name ?? null,
            surname: user.surname ?? null,
            phone: user.phone ?? null,
            department: user.department ?? null,
            avatar_color: user.avatar_color ?? null,
            last_login_at: user.last_login_at ?? null,
            last_sso_login_at: user.last_sso_login_at ?? null,
        });
    } catch (err) {
        next(err);
    }
});

const VALID_PERSONAS = new Set(['consumer', 'service_owner', 'capability_manager', 'admin']);

router.get('/me/persona', requireAuth, async (req, res, next) => {
    try {
        const result = await getPlatformPool().query(`
            SELECT COALESCE(preferred_persona, 'service_owner') AS preferred_persona
            FROM platform.users
            WHERE id = $1
        `, [req.user.id]);
        const persona = result.rows[0]?.preferred_persona ?? 'service_owner';
        res.json({ persona });
    } catch (err) { next(err); }
});

router.put('/me/persona', requireAuth, async (req, res, next) => {
    try {
        const persona = String(req.body?.persona ?? '').trim();
        if (!VALID_PERSONAS.has(persona)) {
            return res.status(400).json({ error: 'Invalid persona' });
        }
        await getPlatformPool().query(`
            UPDATE platform.users
            SET preferred_persona = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [req.user.id, persona]);
        res.json({ persona });
    } catch (err) { next(err); }
});

/**
 * PATCH /api/v1/auth/me
 */
router.patch('/me', requireAuth, async (req, res, next) => {
    try {
        const { display_name, email, given_name, surname, phone, department, avatar_color } = req.body;

        await getPlatformPool().query(`
            UPDATE platform.users
            SET
                display_name = $2,
                email = CASE WHEN $3 IS NOT NULL THEN $3 ELSE email END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [req.user.id, display_name ?? req.user.display_name, email !== undefined ? email : null]);

        if (given_name !== undefined || surname !== undefined || phone !== undefined || department !== undefined || avatar_color !== undefined) {
            try {
                await getPlatformPool().query(`
                    UPDATE platform.users
                    SET
                        given_name = COALESCE($2, given_name),
                        surname = COALESCE($3, surname),
                        phone = COALESCE($4, phone),
                        department = COALESCE($5, department),
                        avatar_color = COALESCE($6, avatar_color),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [req.user.id, given_name ?? null, surname ?? null, phone ?? null, department ?? null, avatar_color ?? null]);
            } catch {
                // migration 12 not present
            }
        }

        res.json({ message: tReq(req, 'auth.profile.saved') });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/auth/change-password
 */
router.post('/change-password', requireAuth, async (req, res, next) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ error: tReq(req, 'auth.password.errors.missing_fields') });
        }
        if (new_password.length < 10) {
            return res.status(400).json({ error: tReq(req, 'auth.password.errors.too_short') });
        }
        const hasUpper = /[A-Z]/.test(new_password);
        const hasLower = /[a-z]/.test(new_password);
        const hasDigit = /[0-9]/.test(new_password);
        const hasSpecial = /[^A-Za-z0-9]/.test(new_password);
        if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
            return res.status(400).json({ error: tReq(req, 'auth.password.errors.policy') });
        }

        const result = await getPlatformPool().query(
            'SELECT password_hash, auth_provider, role FROM platform.users WHERE id = $1',
            [req.user.id]
        );
        const user = result.rows[0];
        if (!user || user.auth_provider === 'ad' || !user.password_hash) {
            return res.status(400).json({ error: tReq(req, 'auth.password.errors.ad_account') });
        }

        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid) return res.status(401).json({ error: tReq(req, 'auth.password.errors.invalid_current') });

        const newHash = await bcrypt.hash(new_password, 12);
        await getPlatformPool().query(
            'UPDATE platform.users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [req.user.id, newHash]
        );

        if (canUserBeForcedToChangePassword(user)) {
            await upsertConfigValue({
                configKey: MUST_CHANGE_PASSWORD_KEY,
                configValue: 'false',
                configType: 'boolean',
                description: 'Admin must change password on first login',
                updatedBy: req.user.username || 'system',
            });
        }

        logger.info(`Password change: ${req.user.username}`);
        res.json({ message: tReq(req, 'auth.password.success') });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/v1/auth/preferences
 */
router.put('/preferences', requireAuth, async (req, res, next) => {
    try {
        const { preferred_lang, preferred_theme } = req.body;
        const normalizedPreferredLang = normalizeLocale(preferred_lang ?? req.user.preferred_lang);
        const normalizedPreferredTheme = preferred_theme || req.user.preferred_theme;
        await getPlatformPool().query(
            'UPDATE platform.users SET preferred_lang = $2, preferred_theme = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [req.user.id, normalizedPreferredLang, normalizedPreferredTheme]
        );
        setLocaleCookie(req, res, normalizedPreferredLang);
        res.json({ message: tReq(req, 'auth.preferences.saved'), preferred_lang: normalizedPreferredLang });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
