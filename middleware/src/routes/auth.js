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
const { getConfigValues } = require('../utils/platform-config');
const audit = require('../db/audit.repo');

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

const loginLimiter = rateLimit({
    windowMs: config.rateLimit.auth.windowMs,
    max: config.rateLimit.auth.max,
    message: { error: 'Příliš mnoho pokusů o přihlášení. Zkuste to za 15 minut.' },
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

function deriveIdentityCandidates(principal) {
    const raw = normalizeIdentity(principal);
    const noDomain = raw.includes('\\') ? raw.split('\\').pop() : raw;
    const alias = noDomain.includes('@') ? noDomain.split('@')[0] : noDomain;
    return [...new Set([raw, noDomain, alias].filter(Boolean))];
}

function buildUserResponse(user) {
    return {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        auth_provider: user.auth_provider ?? 'local',
        preferred_lang: user.preferred_lang || 'cz',
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

async function issueLoginResponse(user, req, { isSso = false, ssoProfile = null } = {}) {
    const effectiveDisplayName = ssoProfile?.display_name || user.display_name || null;
    const tokens = generateTokens(user.id, user.username, user.role, effectiveDisplayName);
    await storeRefreshToken(user.id, tokens.refresh);
    await updateLoginState(user.id, req, { isSso, ssoProfile });

    const currentUser = await loadUserById(user.id);
    return {
        access_token: tokens.access,
        refresh_token: tokens.refresh,
        expires_in: config.jwt.expiryMinutes * 60,
        user: buildUserResponse(currentUser || user),
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
            return res.status(400).json({ error: 'Chybí username nebo password' });
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
            return res.status(401).json({ error: 'Nesprávné přihlašovací údaje' });
        }
        if (!user.is_active) {
            logAuthFailure(req, { username, userId: user.id, reason: 'account_disabled' });
            return res.status(403).json({ error: 'Účet deaktivován' });
        }
        if (user.auth_provider === 'ad') {
            logAuthFailure(req, { username, userId: user.id, reason: 'ad_account_local_attempt' });
            return res.status(401).json({ error: 'Tento účet používá doménové přihlášení přes AD/SSO.' });
        }
        if (!user.password_hash) {
            logAuthFailure(req, { username, userId: user.id, reason: 'no_password_hash' });
            return res.status(401).json({ error: 'Tento účet nemá nastavené lokální heslo.' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            logAuthFailure(req, { username, userId: user.id, reason: 'invalid_password' });
            return res.status(401).json({ error: 'Nesprávné přihlašovací údaje' });
        }

        const response = await issueLoginResponse(user, req);
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

        const ssoProfile = buildSsoProfile(req, runtimeConfig);
        if (!ssoProfile?.principal) {
            return res.status(401).json({ error: 'Doménová identita nebyla předána do aplikace.' });
        }

        const user = await findSsoUser(ssoProfile.principal);
        if (!user) {
            logAuthFailure(req, { username: ssoProfile.principal, reason: 'sso_user_not_found' });
            return res.status(403).json({ error: 'Doménový uživatel nemá v aplikaci aktivní účet.' });
        }
        if (!user.is_active) {
            logAuthFailure(req, { username: user.username, userId: user.id, reason: 'sso_account_disabled' });
            return res.status(403).json({ error: 'Účet je deaktivován.' });
        }

        const response = await issueLoginResponse(user, req, { isSso: true, ssoProfile });
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
        const { refresh_token } = req.body;
        if (!refresh_token) return res.status(400).json({ error: 'Chybí refresh_token' });

        let payload;
        try {
            payload = jwt.verify(refresh_token, config.jwt.secret, {
                issuer: config.jwt.issuer,
                audience: config.jwt.audience,
            });
        } catch {
            return res.status(401).json({ error: 'Neplatný nebo vypršený refresh token' });
        }

        const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');
        const tokenRes = await getPlatformPool().query(
            'SELECT id, user_id, expires_at, revoked_at FROM platform.refresh_tokens WHERE token_hash = $1',
            [tokenHash]
        );
        const tokenRow = tokenRes.rows[0];

        if (!tokenRow || tokenRow.revoked_at || new Date(tokenRow.expires_at) < new Date()) {
            return res.status(401).json({ error: 'Refresh token je neplatný nebo byl odvolán' });
        }

        const user = await loadUserById(payload.sub);
        if (!user || !user.is_active) return res.status(401).json({ error: 'Uživatel nenalezen' });

        const newTokens = generateTokens(user.id, user.username, user.role, user.display_name);

        await getPlatformPool().query(
            'UPDATE platform.refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
            [tokenHash]
        );

        await storeRefreshToken(user.id, newTokens.refresh);

        res.json({
            access_token: newTokens.access,
            refresh_token: newTokens.refresh,
            expires_in: config.jwt.expiryMinutes * 60,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/auth/logout
 */
router.post('/logout', requireAuth, async (req, res, next) => {
    try {
        const { refresh_token } = req.body;
        if (refresh_token) {
            const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
            await getPlatformPool().query(
                'UPDATE platform.refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
                [hash]
            );
        }
        res.json({ message: 'Odhlášení úspěšné' });
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

        if (!user) return res.status(404).json({ error: 'Uživatel nenalezen' });

        res.json({
            id: user.id,
            username: user.username,
            display_name: user.display_name ?? null,
            email: user.email ?? null,
            role: user.role,
            auth_provider: user.auth_provider ?? 'local',
            external_principal: user.external_principal ?? null,
            preferred_lang: user.preferred_lang ?? 'cz',
            preferred_theme: user.preferred_theme ?? 'dark',
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

        res.json({ message: 'Profil uložen' });
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
            return res.status(400).json({ error: 'Chybí current_password nebo new_password' });
        }
        if (new_password.length < 8) {
            return res.status(400).json({ error: 'Nové heslo musí mít alespoň 8 znaků' });
        }

        const result = await getPlatformPool().query(
            'SELECT password_hash, auth_provider FROM platform.users WHERE id = $1',
            [req.user.id]
        );
        const user = result.rows[0];
        if (!user || user.auth_provider === 'ad' || !user.password_hash) {
            return res.status(400).json({ error: 'Tento účet používá doménové přihlášení a lokální heslo změnit nelze.' });
        }

        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Nesprávné aktuální heslo' });

        const newHash = await bcrypt.hash(new_password, 12);
        await getPlatformPool().query(
            'UPDATE platform.users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [req.user.id, newHash]
        );

        logger.info(`Password change: ${req.user.username}`);
        res.json({ message: 'Heslo bylo změněno' });
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
        await getPlatformPool().query(
            'UPDATE platform.users SET preferred_lang = $2, preferred_theme = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [req.user.id, preferred_lang || req.user.preferred_lang, preferred_theme || req.user.preferred_theme]
        );
        res.json({ message: 'Preference uloženy' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
