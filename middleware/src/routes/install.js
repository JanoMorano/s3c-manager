'use strict';
/**
 * routes/install.js — Install wizard API
 *
 * Endpoints:
 *   GET  /api/v1/install/status          — current installation state + detection mode
 *   POST /api/v1/install/start           — start installation + lock
 *   POST /api/v1/install/check-db        — connectivity check
 *   POST /api/v1/install/bootstrap-admin — create first admin
 *   POST /api/v1/install/modules         — configure modules
 *   POST /api/v1/install/execute         — execute installation (migrate+seed+state)
 *   GET  /api/v1/install/summary         — final report
 *
 * Security rules:
 *   - After READY, write endpoints are blocked (409)
 *   - Parallel installations are blocked by the install lock
 *   - Secrets must never be written to logs
 *   - Admin passwords must never be returned in response bodies
 */

const express     = require('express');
const rateLimit   = require('express-rate-limit');
const config      = require('../config');
const { getPlatformPool } = require('../db/pool');
const installSvc  = require('../services/install.service');
const logger      = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const { invalidateModuleStatus } = require('../middleware/module-gates');
const { resolveRequestLocale, tReq } = require('../utils/i18n');
const { getInstallableModuleDefinitions } = require('../modules/manifest');
const { serializeModuleDefinition } = require('../modules/module-serialization');

const router = express.Router();
const INSTALL_SETUP_TOKEN_HEADER = 'x-install-setup-token';

// Rate limit for install endpoints; protects against brute-force attempts.
// max: 500 because the wizard calls several endpoints per session, React StrictMode
// may double-invoke calls, and repeated dev restarts/tests can exhaust lower limits.
// Installation safety is primarily enforced by the lock mechanism, not by rate limits.
const installLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    message: (req) => ({ error: tReq(req, 'install.rate_limit') }),
    standardHeaders: true,
    legacyHeaders: false,
});
router.use(installLimiter);

// In-memory session state (lock token for the current wizard session).
// A DB-backed store would be better for multi-node deployments; this is enough for single-host mode.
let currentLockToken = null;

// ---------------------------------------------------------------------------
// Guard: block write operations after installation is complete.
// ---------------------------------------------------------------------------
async function checkNotReady(req, res, next) {
    try {
        const pool = getPlatformPool();
        const row  = await installSvc.getInstallRow(pool);
        if (row && row.install_status === 'READY') {
            return res.status(409).json({
                error: tReq(req, 'install.errors.already_ready'),
                status: 'READY',
            });
        }
        next();
    } catch {
        // If the DB is not available, allow the request through for fresh installs.
        next();
    }
}

function requireInstallAdminAccess(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: tReq(req, 'auth.errors.admin_required') });
    }

    return next();
}

async function requireAdminWhenReady(req, res, next) {
    try {
        const pool = getPlatformPool();
        const row = await installSvc.getInstallRow(pool);
        if (!row || row.install_status !== 'READY') return next();

        return requireAuth(req, res, (authErr) => {
            if (authErr) return next(authErr);
            return requireInstallAdminAccess(req, res, next);
        });
    } catch (err) {
        return next(err);
    }
}

function readInstallSetupToken(req) {
    const headerToken = req.get(INSTALL_SETUP_TOKEN_HEADER);
    return headerToken && String(headerToken).trim() ? String(headerToken).trim() : '';
}

async function requireInstallWriteAccess(req, res, next) {
    try {
        const pool = getPlatformPool();
        const row = await installSvc.getInstallRow(pool).catch(() => null);

        if (row?.install_status === 'READY') {
            return requireAuth(req, res, (authErr) => {
                if (authErr) return next(authErr);
                return requireInstallAdminAccess(req, res, next);
            });
        }

        const expectedToken = String(config.install?.setupToken ?? '').trim();
        if (!expectedToken || readInstallSetupToken(req) !== expectedToken) {
            return res.status(401).json({ error: tReq(req, 'install.errors.setup_token_required') });
        }

        return next();
    } catch (err) {
        return next(err);
    }
}

// ---------------------------------------------------------------------------
// GET /api/v1/install/status
// Returns current installation state, detected mode, version, and modules.
// This is the first endpoint called by the frontend.
// ---------------------------------------------------------------------------
router.get('/status', async (req, res) => {
    try {
        const pool = getPlatformPool();
        const { mode, status, row } = await installSvc.detectInstallMode(pool);
        const modules = await installSvc.getModules(pool).catch(() => []);
        const isLocked = row?.install_lock === true;

        // Admin account signal only; never return sensitive details.
        let adminExists = false;
        try {
            const adminCheck = await pool.query(`
                SELECT COUNT(*) as cnt FROM platform.users
                WHERE role = 'admin' AND is_active = TRUE
            `);
            adminExists = parseInt(adminCheck.rows[0]?.cnt || '0') > 0;
        } catch {
            adminExists = false;
        }

        return res.json({
            mode,
            status,
            install_locked: isLocked,
            locked_by: isLocked ? row?.locked_by : null,
            app_version:    installSvc.INSTALL_APP_VERSION,
            schema_version: installSvc.INSTALL_SCHEMA_VERSION,
            admin_exists: adminExists,
            modules: modules.map(installSvc.serializeModule),
        });
    } catch (err) {
        // If the DB does not exist yet, return a fresh-install state.
        logger.warn(`install/status: DB unavailable — ${err.message}`);
        return res.json({
            mode: 'fresh',
            status: 'NOT_INSTALLED',
            install_locked: false,
            app_version: installSvc.INSTALL_APP_VERSION,
            schema_version: installSvc.INSTALL_SCHEMA_VERSION,
            admin_exists: false,
            modules: [],
            db_error: tReq(req, 'install.errors.db_unavailable'),
        });
    }
});

// ---------------------------------------------------------------------------
// POST /api/v1/install/start
// Starts installation and acquires the install lock.
// Body: { performed_by?: string }
// ---------------------------------------------------------------------------
router.post('/start', requireInstallWriteAccess, checkNotReady, async (req, res, next) => {
    try {
        const pool = getPlatformPool();
        const performedBy = String(req.body?.performed_by ?? 'installer').trim().slice(0, 200);

        const lockResult = await installSvc.acquireLock(pool, performedBy);
        if (!lockResult.ok) {
            return res.status(409).json({
                error: lockResult.reasonKey ? tReq(req, lockResult.reasonKey, lockResult.reasonParams) : lockResult.reason,
            });
        }

        currentLockToken = lockResult.token;

        logger.info(`install/start: lock acquired by "${performedBy}"`);
        return res.json({ ok: true, message: tReq(req, 'install.messages.started') });
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// POST /api/v1/install/check-db
// Connectivity check: returns results for wizard step 5.
// Internal error details are logged server-side and never exposed in the response.
// ---------------------------------------------------------------------------
router.post('/check-db', requireInstallWriteAccess, async (req, res) => {
    try {
        const pool = getPlatformPool();
        const results = await installSvc.checkConnectivity(pool);

        const allOk = results.db_reachable && results.db_write_access && results.platform_schema;
        const safeChecks = {
            db_reachable: results.db_reachable,
            db_write_access: results.db_write_access,
            platform_schema: results.platform_schema,
        };
        if (!allOk) logger.warn({ checks: results }, 'install/check-db: connectivity issues');
        return res.status(allOk ? 200 : 503).json({
            ok: allOk,
            checks: safeChecks,
        });
    } catch (err) {
        logger.error({ err }, 'install/check-db: unexpected error');
        return res.status(503).json({
            ok: false,
            error: tReq(req, 'install.errors.check_db_failed'),
            checks: {
                db_reachable: false,
                db_write_access: false,
                platform_schema: false,
            },
        });
    }
});

// ---------------------------------------------------------------------------
// POST /api/v1/install/bootstrap-admin
// Creates the first administrator account.
// Body: { username, displayName, email, password, mustChangePassword? }
// Important: passwords must never be logged.
// ---------------------------------------------------------------------------
router.post('/bootstrap-admin', requireInstallWriteAccess, checkNotReady, async (req, res, next) => {
    try {
        const pool = getPlatformPool();

        const { username, displayName, email, password, mustChangePassword } = req.body || {};

        if (!username || !displayName || !email || !password) {
            return res.status(400).json({ error: tReq(req, 'install.errors.missing_required_fields') });
        }

        // Log only non-sensitive fields.
        logger.info(`install/bootstrap-admin: request for user "${username}"`);

        const result = await installSvc.bootstrapAdmin(pool, {
            username,
            displayName,
            email,
            password,    // the service owns hashing; this password is not logged here
            mustChangePassword: mustChangePassword === true,
        }, username);

        if (!result.ok) {
            return res.status(422).json({ error: result.error });
        }

        return res.json({
            ok: true,
            user_id: result.userId,
            username: result.username || username.trim().toLowerCase(),
            mode: result.mode || 'created',
        });
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// POST /api/v1/install/config
// Saves base system configuration (app_name, base_url, timezone, ...).
// Optional step; defaults are suitable for most deployments.
// ---------------------------------------------------------------------------
router.post('/config', requireInstallWriteAccess, checkNotReady, async (req, res, next) => {
    try {
        const pool = getPlatformPool();
        const { app_name, base_url, timezone, storage_path, https_mode } = req.body || {};

        const entries = [
            { key: 'app.name',         value: app_name,    type: 'string',  desc: 'Application display name' },
            { key: 'app.base_url',     value: base_url,    type: 'string',  desc: 'Application base URL' },
            { key: 'app.timezone',     value: timezone,    type: 'string',  desc: 'Application timezone (IANA)' },
            { key: 'app.storage_path', value: storage_path,type: 'string',  desc: 'File upload storage path' },
            { key: 'app.https_mode',   value: https_mode != null ? String(https_mode === true || https_mode === 'true') : null,
                                                            type: 'boolean', desc: 'Enforce HTTPS in generated links' },
        ].filter(e => e.value != null && String(e.value).trim() !== '');

        for (const entry of entries) {
            await pool.query(`
                INSERT INTO platform.app_config (config_key, config_value, config_type, description, updated_by)
                VALUES ($1, $2, $3, $4, 'install-wizard')
                ON CONFLICT (config_key) DO UPDATE
                SET config_value = EXCLUDED.config_value,
                    updated_at   = CURRENT_TIMESTAMP,
                    updated_by   = 'install-wizard'
            `, [entry.key, String(entry.value).trim(), entry.type, entry.desc]);
        }

        logger.info(`install/config: saved ${entries.length} values`);
        return res.json({ ok: true, saved: entries.length });
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// POST /api/v1/install/modules
// Configures modules.
// Body: { activate_c3: boolean }
// ---------------------------------------------------------------------------
router.post('/modules', requireInstallWriteAccess, checkNotReady, async (req, res, next) => {
    try {
        const activateC3 = req.body?.activate_c3 === true;

        logger.info(`install/modules: catalogue/core/management=mandatory, C3=${activateC3}`);
        const modules = getInstallableModuleDefinitions()
            .map((definition) => serializeModuleDefinition(definition, { activateC3 }));

        // Move to the MODULES_CONFIGURED transition state for visibility.
        // Actual activation happens in /execute.
        return res.json({
            ok: true,
            modules,
        });
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// POST /api/v1/install/execute
// Executes installation: module activation, state transitions, READY.
// Body: { activate_c3: boolean, performed_by?: string }
// ---------------------------------------------------------------------------
router.post('/execute', requireInstallWriteAccess, checkNotReady, async (req, res, next) => {
    try {
        const pool = getPlatformPool();
        const activateC3    = req.body?.activate_c3   === true;
        const seedDemo      = req.body?.seed_demo     === true;
        const performedBy   = String(req.body?.performed_by ?? 'installer').trim().slice(0, 200);

        if (!currentLockToken) {
            return res.status(409).json({
                error: tReq(req, 'install.errors.start_required'),
            });
        }

        const adminExists = await installSvc.hasActiveAdminAccount(pool);
        if (!adminExists) {
            return res.status(422).json({
                error: tReq(req, 'install.errors.admin_required_before_finish'),
            });
        }

        logger.info(`install/execute: started by "${performedBy}", C3=${activateC3}, seedDemo=${seedDemo}`);

        const result = await installSvc.executeInstall(
            pool,
            { activateC3, seedDemoData: seedDemo, locale: resolveRequestLocale(req) },
            currentLockToken,
            performedBy,
        );

        if (result.ok) {
            currentLockToken = null; // lock was released in executeInstall
            invalidateModuleStatus();
        }

        if (!result.ok) {
            return res.status(500).json({ error: result.error, status: 'INSTALL_FAILED' });
        }

        return res.json(result);
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// GET /api/v1/install/summary
// Final installation report; never contains secrets.
// ---------------------------------------------------------------------------
router.get('/summary', requireAdminWhenReady, async (req, res, next) => {
    try {
        const pool = getPlatformPool();
        const summary = await installSvc.getInstallSummary(pool);
        return res.json(summary);
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// POST /api/v1/install/repair
// Repair flow: resets the state for repair (admin-only after installation).
// Body: { confirm: true }
// ---------------------------------------------------------------------------
router.post('/repair', requireAdminWhenReady, async (req, res, next) => {
    try {
        if (req.body?.confirm !== true) {
            return res.status(400).json({ error: tReq(req, 'install.errors.confirm_required') });
        }

        const pool = getPlatformPool();
        const row  = await installSvc.getInstallRow(pool);

        if (!row) {
            return res.status(404).json({ error: tReq(req, 'install.errors.install_state_not_found') });
        }

        if (row.install_status === 'INSTALL_IN_PROGRESS') {
            return res.status(409).json({ error: tReq(req, 'install.errors.install_in_progress') });
        }

        // Reset to REPAIR_REQUIRED and release the lock if one exists.
        await installSvc.releaseLock(pool, row.lock_token);
        await installSvc.transitionTo(pool, 'REPAIR_REQUIRED', 'repair-request');
        currentLockToken = null;
        invalidateModuleStatus();

        return res.json({ ok: true, status: 'REPAIR_REQUIRED', message: tReq(req, 'install.messages.repair_completed') });
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// POST /api/v1/install/reset
// Resets a stuck installation: releases the lock and switches back to NOT_INSTALLED.
// Available only when status is not READY, which keeps fresh/failed states safe.
// Body: { confirm: true }
// ---------------------------------------------------------------------------
router.post('/reset', requireInstallWriteAccess, checkNotReady, async (req, res, next) => {
    try {
        if (req.body?.confirm !== true) {
            return res.status(400).json({ error: tReq(req, 'install.errors.confirm_required') });
        }

        const pool = getPlatformPool();
        const row  = await installSvc.getInstallRow(pool);

        if (!row) {
            return res.status(404).json({ error: tReq(req, 'install.errors.install_state_not_found') });
        }

        // Release the lock regardless of token; this is the authoritative reset path.
        await pool.query(`
            UPDATE platform.system_installation
            SET install_lock       = FALSE,
                lock_token         = NULL,
                lock_acquired_at   = NULL,
                locked_by          = NULL,
                install_status     = 'NOT_INSTALLED',
                started_at         = NULL,
                completed_at       = NULL,
                failed_at          = NULL,
                failure_reason     = NULL,
                performed_by       = NULL,
                updated_at         = CURRENT_TIMESTAMP
            WHERE id = 1
        `);

        // Reset the module registry to the default state.
        await pool.query(`
            UPDATE platform.module_registry
            SET enabled                  = FALSE,
                schema_installed         = FALSE,
                reference_seed_installed = FALSE,
                ui_visible               = FALSE,
                api_enabled              = FALSE,
                activated_at             = NULL,
                activated_by             = NULL,
                updated_at               = CURRENT_TIMESTAMP
        `);

        currentLockToken = null;
        invalidateModuleStatus();

        logger.warn('install/reset: installation state reset to NOT_INSTALLED');
        return res.json({ ok: true, status: 'NOT_INSTALLED', message: tReq(req, 'install.messages.reset_completed') });
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// POST /api/v1/install/seed-demo — post-install demo data seeding.
// Requires READY state (opposite of checkNotReady). Available to admin users.
// ---------------------------------------------------------------------------
router.post('/seed-demo', requireAuth, requireInstallAdminAccess, async (req, res, next) => {
    try {
        const pool = getPlatformPool();

        // Verify that the system is READY.
        const row = await installSvc.getInstallRow(pool);
        if (!row || row.install_status !== 'READY') {
            return res.status(409).json({
                error: tReq(req, 'install.errors.demo_ready_only', { status: row?.install_status ?? 'neznámý' }),
            });
        }

        const action = req.body?.action === 'remove' ? 'remove' : 'seed';
        const { seedDemoData, removeDemoData } = require('../utils/demo-data-seed');

        let result;
        if (action === 'remove') {
            logger.info('install/seed-demo: removing demo data');
            result = await removeDemoData(pool);
        } else {
            logger.info('install/seed-demo: seeding demo data');
            result = await seedDemoData(pool, { locale: resolveRequestLocale(req) });
        }

        if (!result.ok) {
            return res.status(500).json({ error: result.error });
        }

        return res.json({
            ok: true,
            action,
            message: action === 'remove'
                ? tReq(req, 'install.messages.demo_removed')
                : tReq(req, 'install.messages.demo_created'),
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
