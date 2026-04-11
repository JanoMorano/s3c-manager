'use strict';

const { getPlatformPool } = require('../db/pool');

const MODULE_STATUS_TTL_MS = 5000;
const moduleStatusCache = new Map();

async function readModuleStatus(moduleCode) {
    const cached = moduleStatusCache.get(moduleCode);
    if (cached && (Date.now() - cached.checkedAt) < MODULE_STATUS_TTL_MS) {
        return cached.value;
    }

    const result = await getPlatformPool().query(`
        SELECT
            module_code,
            enabled,
            ui_visible,
            api_enabled,
            schema_installed,
            reference_seed_installed
        FROM platform.module_registry
        WHERE module_code = $1
        LIMIT 1
    `, [moduleCode]);

    const value = result.rows[0] ?? null;
    moduleStatusCache.set(moduleCode, {
        value,
        checkedAt: Date.now(),
    });
    return value;
}

async function isModuleApiEnabled(moduleCode) {
    const moduleRow = await readModuleStatus(moduleCode);
    if (!moduleRow) return false;
    return Boolean(moduleRow.enabled && moduleRow.api_enabled);
}

function invalidateModuleStatus(moduleCode = null) {
    if (moduleCode) {
        moduleStatusCache.delete(moduleCode);
        return;
    }
    moduleStatusCache.clear();
}

function requireModuleApiEnabled(moduleCode, message = 'Požadovaný modul není aktivní.') {
    return async (req, res, next) => {
        try {
            const enabled = await isModuleApiEnabled(moduleCode);
            if (!enabled) {
                return res.status(404).json({ error: message });
            }
            return next();
        } catch (err) {
            return next(err);
        }
    };
}

module.exports = {
    isModuleApiEnabled,
    invalidateModuleStatus,
    requireModuleApiEnabled,
};
