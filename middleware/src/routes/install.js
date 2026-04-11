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
const { canAdmin }    = require('../middleware/rbac');
const { invalidateModuleStatus } = require('../middleware/module-gates');

const router = express.Router();
const INSTALL_SETUP_TOKEN_HEADER = 'x-install-setup-token';

// Rate limit for install endpoints; protects against brute-force attempts.
// max: 500 because the wizard calls several endpoints per session, React StrictMode
// may double-invoke calls, and repeated dev restarts/tests can exhaust lower limits.
// Installation safety is primarily enforced by the lock mechanism, not by rate limits.
const installLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    message: { error: 'Příliš mnoho instalačních požadavků. Zkuste to za chvíli.' },
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
                error: 'Instalace již byla dokončena. Pro repair nebo upgrade použijte admin sekci.',
                status: 'READY',
            });
        }
        next();
    } catch (err) {
        // If the DB is not available, allow the request through for fresh installs.
        next();
    }
}

async function requireAdminWhenReady(req, res, next) {
    try {
        const pool = getPlatformPool();
        const row = await installSvc.getInstallRow(pool);
        if (!row || row.install_status !== 'READY') return next();

        return requireAuth(req, res, (authErr) => {
            if (authErr) return next(authErr);
            return canAdmin(req, res, next);
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
                return canAdmin(req, res, next);
            });
        }

        const expectedToken = String(config.install?.setupToken ?? '').trim();
        if (!expectedToken || readInstallSetupToken(req) !== expectedToken) {
            return res.status(401).json({ error: 'Chybí nebo je neplatný setup token.' });
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
router.get('/status', async (req, res, next) => {
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
        } catch {}

        return res.json({
            mode,
            status,
            install_locked: isLocked,
            locked_by: isLocked ? row?.locked_by : null,
            app_version:    installSvc.INSTALL_APP_VERSION,
            schema_version: installSvc.INSTALL_SCHEMA_VERSION,
            admin_exists: adminExists,
            modules: modules.map(m => ({
                code:         m.module_code,
                label:        m.module_label,
                is_mandatory: m.is_mandatory,
                enabled:      m.enabled,
                ui_visible:   m.ui_visible,
                api_enabled:  m.api_enabled,
            })),
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
            db_error: 'DB není ještě dostupná nebo nebyla inicializována.',
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
            return res.status(409).json({ error: lockResult.reason });
        }

        currentLockToken = lockResult.token;

        logger.info(`install/start: lock acquired by "${performedBy}"`);
        return res.json({ ok: true, message: 'Instalace zahájena.' });
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// POST /api/v1/install/check-db
// Connectivity check: returns results for wizard step 5.
// ---------------------------------------------------------------------------
router.post('/check-db', requireInstallWriteAccess, async (req, res, next) => {
    try {
        const pool = getPlatformPool();
        const results = await installSvc.checkConnectivity(pool);

        const allOk = results.db_reachable && results.db_write_access && results.platform_schema;
        return res.status(allOk ? 200 : 503).json({
            ok: allOk,
            checks: results,
        });
    } catch (err) {
        return res.status(503).json({
            ok: false,
            checks: {
                db_reachable: false,
                db_write_access: false,
                platform_schema: false,
                errors: [err.message],
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
            return res.status(400).json({ error: 'Chybí povinné pole: username, displayName, email, password.' });
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
            username: username.trim().toLowerCase(),
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
        const pool = getPlatformPool();
        const activateC3 = req.body?.activate_c3 === true;

        // SERVICE_CATALOGUE_CORE is always active; the UI cannot change it.
        logger.info(`install/modules: SERVICE_CATALOGUE_CORE=mandatory, C3=${activateC3}`);

        // Move to the MODULES_CONFIGURED transition state for visibility.
        // Actual activation happens in /execute.
        return res.json({
            ok: true,
            modules: [
                { code: 'SERVICE_CATALOGUE_CORE', mandatory: true, will_activate: true },
                { code: 'C3_TAXONOMY', mandatory: false, will_activate: activateC3 },
            ],
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
                error: 'Instalace nebyla zahájena. Nejprve zavolejte /install/start.',
            });
        }

        const adminExists = await installSvc.hasActiveAdminAccount(pool);
        if (!adminExists) {
            return res.status(422).json({
                error: 'První admin účet musí být vytvořen v install wizardu před dokončením instalace.',
            });
        }

        logger.info(`install/execute: started by "${performedBy}", C3=${activateC3}, seedDemo=${seedDemo}`);

        const result = await installSvc.executeInstall(
            pool,
            { activateC3, seedDemoData: seedDemo },
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
            return res.status(400).json({ error: 'Musíte potvrdit: { "confirm": true }' });
        }

        const pool = getPlatformPool();
        const row  = await installSvc.getInstallRow(pool);

        if (!row) {
            return res.status(404).json({ error: 'Instalační stav nenalezen.' });
        }

        if (row.install_status === 'INSTALL_IN_PROGRESS') {
            return res.status(409).json({ error: 'Instalace probíhá.' });
        }

        // Reset to REPAIR_REQUIRED and release the lock if one exists.
        await installSvc.releaseLock(pool, row.lock_token);
        await installSvc.transitionTo(pool, 'REPAIR_REQUIRED', 'repair-request');
        currentLockToken = null;
        invalidateModuleStatus();

        return res.json({ ok: true, status: 'REPAIR_REQUIRED', message: 'Systém přepnut do repair módu.' });
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
            return res.status(400).json({ error: 'Musíte potvrdit: { "confirm": true }' });
        }

        const pool = getPlatformPool();
        const row  = await installSvc.getInstallRow(pool);

        if (!row) {
            return res.status(404).json({ error: 'Instalační stav nenalezen.' });
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
        return res.json({ ok: true, status: 'NOT_INSTALLED', message: 'Instalační stav resetován. Spusťte wizard znovu.' });
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// POST /api/v1/install/seed-demo — post-install demo data seeding.
// Requires READY state (opposite of checkNotReady). Available to admin users.
// ---------------------------------------------------------------------------
router.post('/seed-demo', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const pool = getPlatformPool();

        // Verify that the system is READY.
        const row = await installSvc.getInstallRow(pool);
        if (!row || row.install_status !== 'READY') {
            return res.status(409).json({
                error: `Demo data lze seedovat pouze ve stavu READY. Aktuální stav: ${row?.install_status ?? 'neznámý'}`,
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
            result = await seedDemoData(pool);
        }

        if (!result.ok) {
            return res.status(500).json({ error: result.error });
        }

        return res.json({ ok: true, action, message: action === 'remove' ? 'Testovací data odstraněna.' : 'Testovací data vytvořena.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
