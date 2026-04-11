'use strict';

const NodeCache = require('node-cache');
const { getPlatformPool } = require('../db/pool');

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

async function getConfigValues(configKeys) {
    const keys = [...new Set((configKeys || []).filter(Boolean))];
    const missingKeys = keys.filter((key) => !cache.has(key));

    if (missingKeys.length > 0) {
        const result = await getPlatformPool().query(`
            SELECT config_key, config_value, config_type, description
            FROM platform.app_config
            WHERE config_key = ANY($1::varchar[])
        `, [missingKeys]);

        const found = new Map(result.rows.map((row) => [row.config_key, row]));
        for (const key of missingKeys) {
            cache.set(key, found.get(key) ?? null);
        }
    }

    return keys.reduce((acc, key) => {
        acc[key] = cache.get(key) ?? null;
        return acc;
    }, {});
}

async function upsertConfigValue({ configKey, configValue, configType = 'string', description = null, updatedBy = null, isSensitive = false }) {
    await getPlatformPool().query(`
        INSERT INTO platform.app_config
            (config_key, config_value, config_type, description, is_sensitive, updated_at, updated_by)
        VALUES
            ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
        ON CONFLICT (config_key) DO UPDATE SET
            config_value = EXCLUDED.config_value,
            config_type = EXCLUDED.config_type,
            description = EXCLUDED.description,
            is_sensitive = EXCLUDED.is_sensitive,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = EXCLUDED.updated_by
    `, [
        configKey,
        configValue,
        configType,
        description,
        isSensitive,
        updatedBy ?? null,
    ]);

    cache.del(configKey);
}

function invalidateConfigValues(configKeys) {
    cache.del(configKeys);
}

module.exports = { getConfigValues, upsertConfigValue, invalidateConfigValues };
