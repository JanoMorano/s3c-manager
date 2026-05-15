'use strict';

const { getPlatformPool } = require('../db/pool');
const {
    isModuleMandatoryByDefault,
    normalizeModuleCode,
} = require('../modules/manifest');

const MODULE_STATUS_TTL_MS = 5000;
const moduleStatusCache = new Map();

async function readModuleStatus(moduleCode) {
    const normalizedCode = normalizeModuleCode(moduleCode);
    const cached = moduleStatusCache.get(normalizedCode);
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
    `, [normalizedCode]);

    const value = result.rows[0] ?? null;
    moduleStatusCache.set(normalizedCode, {
        value,
        checkedAt: Date.now(),
    });
    return value;
}

async function isModuleApiEnabled(moduleCode) {
    const normalizedCode = normalizeModuleCode(moduleCode);
    const moduleRow = await readModuleStatus(normalizedCode);
    if (!moduleRow) return isModuleMandatoryByDefault(normalizedCode);
    return Boolean(moduleRow.enabled && moduleRow.api_enabled);
}

function invalidateModuleStatus(moduleCode = null) {
    if (moduleCode) {
        moduleStatusCache.delete(normalizeModuleCode(moduleCode));
        return;
    }
    moduleStatusCache.clear();
}

function requireModuleApiEnabled(moduleCode, message = 'Požadovaný modul není aktivní.') {
    return async (req, res, next) => {
        try {
            const enabled = await isModuleApiEnabled(moduleCode);
            if (!enabled) {
                const resolvedMessage = typeof message === 'function' ? message(req) : message;
                return res.status(404).json({ error: resolvedMessage });
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
