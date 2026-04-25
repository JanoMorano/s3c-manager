'use strict';
/**
 * install.service.js — installation state machine
 *
 * Authoritative logic for:
 *   - installation state detection (Fresh / Repair / Upgrade)
 *   - state transitions
 *   - install lock (parallel installations are forbidden)
 *   - admin bootstrap
 *   - module activation
 *   - schema and seed application
 *   - audit logging of installation events
 *
 * NEVER derive the state directly in frontend code — the frontend only reads and calls the API.
 */

const crypto = require('crypto');
const bcrypt  = require('bcrypt');
const { getPlatformPool } = require('../db/pool');
const logger  = require('../utils/logger');

const INSTALL_APP_VERSION  = process.env.APP_VERSION  || '1.0.2';
const INSTALL_SCHEMA_VERSION = process.env.SCHEMA_VERSION || '2.2.1';
const BCRYPT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateLockToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function logInstallEvent(pool, action, details, performedBy = 'system') {
    try {
        const eventName = String(action || 'INSTALL_EVENT').slice(0, 255);
        const actor = String(performedBy || 'system').slice(0, 200);
        const payload = JSON.stringify({
            event: eventName,
            ...(details && typeof details === 'object' ? details : {}),
        });

        await pool.query(`
            INSERT INTO platform.audit_log
                (table_name, record_id, record_label, action, new_values, performed_by)
            VALUES
                ($1, $2, $3, $4, $5, $6)
        `, ['system_installation', 1, eventName, 'UPDATE', payload, actor]);
    } catch (err) {
        // audit logging must never block the install flow
        logger.warn(`install.service: audit log write failed — ${err.message}`);
    }
}

// ---------------------------------------------------------------------------
// Read current install state
// ---------------------------------------------------------------------------

/**
 * Returns the current system_installation row (always id=1).
 * If the table does not exist -> NOT_INSTALLED (fresh DB without 13_install_system.sql).
 */
async function getInstallRow(pool) {
    try {
        const result = await pool.query(`
            SELECT * FROM platform.system_installation WHERE id = 1
        `);
        return result.rows[0] || null;
    } catch (err) {
        if (err.code === '42P01') {
            // table does not exist -> fresh DB, the init script has not run yet
            return null;
        }
        throw err;
    }
}

/**
 * Detects installation mode:
 *   fresh   -> no DB or NOT_INSTALLED
 *   repair  -> INSTALL_FAILED / REPAIR_REQUIRED
 *   upgrade -> UPGRADE_REQUIRED (image version > DB schema version)
 *   ready   -> READY (normal operation)
 *
 * IMPORTANT: This function is PURE READ — it performs no DB writes.
 * Transition to UPGRADE_REQUIRED happens explicitly through checkAndApplyUpgradeIfNeeded().
 */
async function detectInstallMode(pool) {
    const row = await getInstallRow(pool);

    if (!row || row.install_status === 'NOT_INSTALLED') {
        return { mode: 'fresh', status: row?.install_status ?? 'NOT_INSTALLED', row };
    }

    if (['INSTALL_FAILED', 'REPAIR_REQUIRED'].includes(row.install_status)) {
        return { mode: 'repair', status: row.install_status, row };
    }

    if (row.install_status === 'UPGRADE_REQUIRED') {
        return { mode: 'upgrade', status: row.install_status, row };
    }

    if (row.install_status === 'READY') {
        return { mode: 'ready', status: 'READY', row };
    }

    // INSTALL_IN_PROGRESS, CORE_INSTALLED, MODULES_CONFIGURED, DATA_IMPORT_IN_PROGRESS
    return { mode: 'fresh', status: row.install_status, row };
}

/**
 * Checks whether the image schema version matches the DB. If not, transitions to UPGRADE_REQUIRED.
 * Call EXPLICITLY — not inside detectInstallMode, because that would create a side effect in a read operation.
 * Suitable call site: middleware startup after initDb().
 */
async function checkAndApplyUpgradeIfNeeded(pool) {
    try {
        const row = await getInstallRow(pool);
        if (!row || row.install_status !== 'READY') return; // nothing to do

        const currentRelease = await getCurrentRelease(pool);
        if (currentRelease && currentRelease.schema_version !== INSTALL_SCHEMA_VERSION) {
            logger.warn(`install.service: schema version mismatch — DB: ${currentRelease.schema_version}, image: ${INSTALL_SCHEMA_VERSION}`);
            logger.warn(`install.service: switching to UPGRADE_REQUIRED`);
            await transitionTo(pool, 'UPGRADE_REQUIRED', 'system');
        }
    } catch (err) {
        logger.warn(`install.service: checkAndApplyUpgradeIfNeeded failed — ${err.message}`);
    }
}

async function getCurrentRelease(pool) {
    try {
        const result = await pool.query(`
            SELECT * FROM platform.release_metadata
            WHERE is_current = TRUE
            ORDER BY applied_at DESC
            LIMIT 1
        `);
        return result.rows[0] || null;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

async function transitionTo(pool, newStatus, performedBy = 'system', extraFields = {}) {
    const updates = {
        install_status: newStatus,
        updated_at: 'CURRENT_TIMESTAMP',
        ...extraFields,
    };

    const setClauses = Object.keys(extraFields).map((k, i) => `${k} = $${i + 2}`);
    const values = [newStatus, ...Object.values(extraFields)];

    let sql = `
        UPDATE platform.system_installation
        SET install_status = $1,
            updated_at = CURRENT_TIMESTAMP
            ${setClauses.length ? ', ' + setClauses.join(', ') : ''}
        WHERE id = 1
    `;

    await pool.query(sql, values);
    await logInstallEvent(pool, newStatus, { performed_by: performedBy }, performedBy);
    logger.info(`install.service: state -> ${newStatus} (by: ${performedBy})`);
}

// ---------------------------------------------------------------------------
// Install lock
// ---------------------------------------------------------------------------

/**
 * Attempts to acquire the installation lock.
 * Returns { ok: true, token } or { ok: false, reason }.
 */
async function acquireLock(pool, lockedBy = 'installer') {
    const token = generateLockToken();

    const result = await pool.query(`
        UPDATE platform.system_installation
        SET install_lock = TRUE,
            lock_token = $1,
            lock_acquired_at = CURRENT_TIMESTAMP,
            locked_by = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
          AND (install_lock = FALSE OR lock_acquired_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes')
        RETURNING id
    `, [token, lockedBy]);

    if (result.rowCount === 0) {
        const row = await getInstallRow(pool);
        return {
            ok: false,
            reasonKey: 'install.errors.locked',
            reasonParams: {
                lockedBy: row?.locked_by ?? 'unknown',
                lockAcquiredAt: row?.lock_acquired_at ?? '',
            },
            reason: `Instalace je již zamčena uživatelem "${row?.locked_by}" od ${row?.lock_acquired_at}`,
        };
    }

    return { ok: true, token };
}

async function releaseLock(pool, token) {
    await pool.query(`
        UPDATE platform.system_installation
        SET install_lock = FALSE,
            lock_token = NULL,
            lock_acquired_at = NULL,
            locked_by = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
          AND lock_token = $1
    `, [token]);
}

// ---------------------------------------------------------------------------
// Connectivity check
// ---------------------------------------------------------------------------

async function checkConnectivity(pool) {
    const results = {
        db_reachable: false,
        db_write_access: false,
        platform_schema: false,
        errors: [],
    };

    try {
        await pool.query('SELECT 1');
        results.db_reachable = true;
    } catch (err) {
        results.errors.push(`DB nedostupná: ${err.message}`);
        return results;
    }

    try {
        await pool.query('SELECT COUNT(*) FROM platform.app_config');
        results.platform_schema = true;
    } catch (err) {
        results.errors.push(`platform schema chybí: ${err.message}`);
    }

    try {
        await pool.query(`
            INSERT INTO platform.audit_log
                (table_name, record_id, action, performed_by)
            VALUES ('_connectivity_check', 0, 'INSERT', 'install_check')
            RETURNING id
        `);
        // Delete the test record immediately
        await pool.query(`
            DELETE FROM platform.audit_log
            WHERE table_name = '_connectivity_check' AND performed_by = 'install_check'
        `);
        results.db_write_access = true;
    } catch (err) {
        results.errors.push(`Write access selhal: ${err.message}`);
    }

    return results;
}

// ---------------------------------------------------------------------------
// Admin bootstrap
// ---------------------------------------------------------------------------

/**
 * Creates the first administrative user.
 * The password is hashed with bcrypt and never stored in plaintext.
 * Returns { ok, userId } or { ok: false, error }.
 */
async function bootstrapAdmin(pool, { username, displayName, email, password, mustChangePassword = false }, performedBy = 'installer') {
    // Check whether an admin already exists
    const existing = await pool.query(`
        SELECT id FROM platform.users
        WHERE role = 'admin' AND is_active = TRUE
        LIMIT 1
    `);
    if (existing.rows.length > 0) {
        return { ok: false, error: 'Admin účet již existuje. Použijte repair flow pro reset.' };
    }

    // Password policy — minimum length and character-class combination
    if (!password || password.length < 10) {
        return { ok: false, error: 'Heslo musí mít alespoň 10 znaků.' };
    }
    const hasUpper   = /[A-Z]/.test(password);
    const hasLower   = /[a-z]/.test(password);
    const hasDigit   = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
        return { ok: false, error: 'Heslo musí obsahovat velká písmena, malá písmena, číslice a speciální znak.' };
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await pool.query(`
        INSERT INTO platform.users
            (username, display_name, email, role, is_active, auth_provider, password_hash)
        VALUES ($1, $2, $3, 'admin', TRUE, 'local', $4)
        RETURNING id
    `, [
        username.trim().toLowerCase(),
        displayName.trim(),
        email.trim().toLowerCase(),
        passwordHash,
    ]);

    const userId = result.rows[0].id;

    // Persist the must_change_password flag in app_config
    if (mustChangePassword) {
        await pool.query(`
            INSERT INTO platform.app_config (config_key, config_value, config_type, description)
            VALUES ('auth.admin_must_change_password', 'true', 'boolean', 'Admin must change password on first login')
            ON CONFLICT (config_key) DO UPDATE SET config_value = 'true', updated_at = CURRENT_TIMESTAMP
        `);
    }

    await logInstallEvent(pool, 'ADMIN_BOOTSTRAP', {
        user_id: userId,
        username: username.trim().toLowerCase(),
    }, performedBy);

    logger.info(`install.service: admin bootstrap OK — user ID ${userId}`);
    return { ok: true, userId };
}

async function hasActiveAdminAccount(pool) {
    const result = await pool.query(`
        SELECT COUNT(*) AS cnt
        FROM platform.users
        WHERE role = 'admin' AND is_active = TRUE
    `);
    return Number.parseInt(result.rows[0]?.cnt || '0', 10) > 0;
}

// ---------------------------------------------------------------------------
// Module activation
// ---------------------------------------------------------------------------

async function activateModule(pool, moduleCode, performedBy = 'installer') {
    const result = await pool.query(`
        UPDATE platform.module_registry
        SET enabled = TRUE,
            activated_at = CURRENT_TIMESTAMP,
            activated_by = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE module_code = $1
        RETURNING id, module_code
    `, [moduleCode, performedBy]);

    if (result.rowCount === 0) {
        return { ok: false, error: `Modul '${moduleCode}' nenalezen v registry.` };
    }

    await pool.query(`
        INSERT INTO platform.module_installation_history
            (module_code, action, status, app_version, schema_version, performed_by)
        VALUES ($1, 'ACTIVATE', 'SUCCESS', $2, $3, $4)
    `, [moduleCode, INSTALL_APP_VERSION, INSTALL_SCHEMA_VERSION, performedBy]);

    await logInstallEvent(pool, `MODULE_ACTIVATE:${moduleCode}`, { module_code: moduleCode }, performedBy);
    return { ok: true };
}

async function markModuleSchemaInstalled(pool, moduleCode, performedBy = 'system') {
    await pool.query(`
        UPDATE platform.module_registry
        SET schema_installed = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE module_code = $1
    `, [moduleCode]);

    await pool.query(`
        INSERT INTO platform.module_installation_history
            (module_code, action, status, app_version, schema_version, performed_by)
        VALUES ($1, 'SCHEMA_MIGRATE', 'SUCCESS', $2, $3, $4)
    `, [moduleCode, INSTALL_APP_VERSION, INSTALL_SCHEMA_VERSION, performedBy]);
}

async function markModuleReferenceSeedInstalled(pool, moduleCode, performedBy = 'system') {
    await pool.query(`
        UPDATE platform.module_registry
        SET reference_seed_installed = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE module_code = $1
    `, [moduleCode]);

    await pool.query(`
        INSERT INTO platform.module_installation_history
            (module_code, action, status, app_version, schema_version, performed_by)
        VALUES ($1, 'SEED_APPLY', 'SUCCESS', $2, $3, $4)
    `, [moduleCode, INSTALL_APP_VERSION, INSTALL_SCHEMA_VERSION, performedBy]);
}

async function getModules(pool) {
    const result = await pool.query(`
        SELECT * FROM platform.module_registry
        ORDER BY install_order
    `);
    return result.rows;
}

// ---------------------------------------------------------------------------
// Execute install — core schema + seed markers
// Actual DB schemas are applied by the init script during container startup.
// This function only registers state in module_registry and advances states.
// ---------------------------------------------------------------------------

async function executeInstall(pool, { activateC3, seedDemoData = false, importJobId = null, locale = null }, lockToken, performedBy = 'installer') {
    try {
        await transitionTo(pool, 'INSTALL_IN_PROGRESS', performedBy, {
            started_at: new Date().toISOString(),
        });

        // SERVICE_CATALOGUE_CORE is always mandatory
        await activateModule(pool, 'SERVICE_CATALOGUE_CORE', performedBy);
        await markModuleSchemaInstalled(pool, 'SERVICE_CATALOGUE_CORE', performedBy);
        await markModuleReferenceSeedInstalled(pool, 'SERVICE_CATALOGUE_CORE', performedBy);

        await pool.query(`
            UPDATE platform.module_registry
            SET ui_visible = TRUE, api_enabled = TRUE, updated_at = CURRENT_TIMESTAMP
            WHERE module_code = 'SERVICE_CATALOGUE_CORE'
        `);

        await transitionTo(pool, 'CORE_INSTALLED', performedBy);

        // C3 module — optional
        if (activateC3) {
            await activateModule(pool, 'C3_TAXONOMY', performedBy);
            await markModuleSchemaInstalled(pool, 'C3_TAXONOMY', performedBy);
            await markModuleReferenceSeedInstalled(pool, 'C3_TAXONOMY', performedBy);

            await pool.query(`
                UPDATE platform.module_registry
                SET ui_visible = TRUE, api_enabled = TRUE, updated_at = CURRENT_TIMESTAMP
                WHERE module_code = 'C3_TAXONOMY'
            `);
        }

        await transitionTo(pool, 'MODULES_CONFIGURED', performedBy);

        // Record release metadata
        await pool.query(`
            UPDATE platform.release_metadata
            SET is_current = FALSE
            WHERE is_current = TRUE
        `);
        await pool.query(`
            INSERT INTO platform.release_metadata
                (release_version, schema_version, release_notes, applied_by, is_current)
            VALUES ($1, $2, 'Instalace provedena přes install wizard', $3, TRUE)
        `, [INSTALL_APP_VERSION, INSTALL_SCHEMA_VERSION, performedBy]);

        // Demo data (optional)
        if (seedDemoData) {
            try {
                const { seedDemoData: runSeed } = require('../utils/demo-data-seed');
                logger.info('install.service: seeding demo data…');
                const seedResult = await runSeed(pool, { locale });
                if (seedResult && !seedResult.ok) {
                    logger.warn(`install.service: demo data seeding failed — ${seedResult.error}`);
                } else {
                    logger.info('install.service: demo data seeded successfully');
                }
            } catch (seedErr) {
                logger.warn(`install.service: demo data seeding failed (noncritical) — ${seedErr.message}`);
            }
        }

        // Switch to READY
        await transitionTo(pool, 'READY', performedBy, {
            completed_at: new Date().toISOString(),
            performed_by: performedBy,
        });

        await releaseLock(pool, lockToken);

        const modules = await getModules(pool);
        const summary = await getInstallSummary(pool);
        return {
            ok: true,
            status: 'READY',
            app_version: INSTALL_APP_VERSION,
            schema_version: INSTALL_SCHEMA_VERSION,
            modules_activated: modules.filter(m => m.enabled).map(m => m.module_code),
            summary,
        };
    } catch (err) {
        logger.error(`install.service: executeInstall failed — ${err.message}`);
        await logInstallEvent(pool, 'INSTALL_FAILED', { error: err.message }, performedBy);

        try {
            await transitionTo(pool, 'INSTALL_FAILED', performedBy, {
                failed_at: new Date().toISOString(),
                failure_reason: err.message,
            });
            await releaseLock(pool, lockToken);
        } catch (innerErr) {
            logger.error(`install.service: unable to persist INSTALL_FAILED — ${innerErr.message}`);
        }

        return { ok: false, error: err.message };
    }
}

// ---------------------------------------------------------------------------
// Install summary
// ---------------------------------------------------------------------------

async function getInstallSummary(pool) {
    const row       = await getInstallRow(pool);
    const modules   = await getModules(pool);
    const release   = await getCurrentRelease(pool);

    return {
        status: row?.install_status ?? 'UNKNOWN',
        mode:   row?.install_mode   ?? null,
        app_version:    INSTALL_APP_VERSION,
        schema_version: INSTALL_SCHEMA_VERSION,
        db_schema_version: release?.schema_version ?? null,
        completed_at:   row?.completed_at ?? null,
        failed_at:      row?.failed_at    ?? null,
        failure_reason: row?.failure_reason ?? null,
        performed_by:   row?.performed_by  ?? null,
        modules: modules.map(m => ({
            code:              m.module_code,
            label:             m.module_label,
            is_mandatory:      m.is_mandatory,
            enabled:           m.enabled,
            schema_installed:  m.schema_installed,
            seed_installed:    m.reference_seed_installed,
            ui_visible:        m.ui_visible,
            api_enabled:       m.api_enabled,
            version:           m.version,
        })),
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

module.exports = {
    detectInstallMode,
    checkAndApplyUpgradeIfNeeded,
    getInstallRow,
    getInstallSummary,
    acquireLock,
    releaseLock,
    transitionTo,
    checkConnectivity,
    bootstrapAdmin,
    hasActiveAdminAccount,
    activateModule,
    getModules,
    executeInstall,
    INSTALL_APP_VERSION,
    INSTALL_SCHEMA_VERSION,
};
