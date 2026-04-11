'use strict';
/**
 * routes/admin.js — management and administration
 *
 * Endpoints:
 *   GET  /api/v1/admin/logs
 *   GET  /api/v1/admin/users
 *   POST /api/v1/admin/users
 *   PUT  /api/v1/admin/users/:id
 */

const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { getPlatformPool, getPool } = require('../db/pool');
const { log } = require('../db/audit.repo');
const { requireAuth } = require('../middleware/auth');
const { canAdmin, canEdit } = require('../middleware/rbac');
const { getConfigValues, upsertConfigValue, invalidateConfigValues } = require('../utils/platform-config');

router.use(requireAuth);

const ROLE_LABELS = {
    viewer: 'User - RO',
    editor: 'Content Admin - RW',
    admin: 'Admin - ALL',
};

const ACCESS_LABELS = {
    viewer: 'Read-only přístup do katalogu',
    editor: 'Read/write + přístup do Content Admin',
    admin: 'ALL + přístup do Administration',
};

const AUTH_PROVIDER_LABELS = {
    local: 'Local login',
    ad: 'AD / SSO',
};

const SSO_SETTINGS = [
    { key: 'auth.sso.enabled', type: 'boolean', defaultValue: 'false', description: 'Enable trusted-header SSO login.' },
    { key: 'auth.sso.header', type: 'string', defaultValue: 'x-remote-user', description: 'Trusted header carrying the authenticated AD identity.' },
    { key: 'auth.sso.display_name_header', type: 'string', defaultValue: 'x-remote-name', description: 'Trusted header carrying the display name.' },
    { key: 'auth.sso.email_header', type: 'string', defaultValue: 'x-remote-email', description: 'Trusted header carrying the email address.' },
    { key: 'auth.sso.given_name_header', type: 'string', defaultValue: 'x-remote-given-name', description: 'Trusted header carrying the given name.' },
    { key: 'auth.sso.surname_header', type: 'string', defaultValue: 'x-remote-surname', description: 'Trusted header carrying the surname.' },
    { key: 'auth.sso.department_header', type: 'string', defaultValue: 'x-remote-department', description: 'Trusted header carrying the department.' },
];

const USER_SELECT = `
    SELECT
        id,
        username,
        display_name,
        email,
        role,
        is_active,
        auth_provider,
        external_principal,
        last_login_at,
        last_sso_login_at,
        created_at,
        updated_at,
        given_name,
        surname,
        department,
        password_hash
    FROM platform.users
`;

function normalizeString(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function normalizeNullableString(value) {
    const normalized = normalizeString(value);
    return normalized ? normalized : null;
}

function normalizeEmail(value) {
    const email = normalizeNullableString(value);
    return email ? email.toLowerCase() : null;
}

function normalizeRole(value) {
    const role = normalizeString(value).toLowerCase();
    return ['viewer', 'editor', 'admin'].includes(role) ? role : null;
}

function normalizeAuthProvider(value) {
    const provider = normalizeString(value).toLowerCase();
    return ['local', 'ad'].includes(provider) ? provider : null;
}

function normalizeBoolean(value, fallback = true) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
    }
    return fallback;
}

function buildDisplayName({ displayName, givenName, surname, username }) {
    const explicit = normalizeString(displayName);
    if (explicit) return explicit;
    const combined = [normalizeString(givenName), normalizeString(surname)].filter(Boolean).join(' ').trim();
    return combined || username;
}

function buildUserResponse(row) {
    return {
        id: row.id,
        username: row.username,
        display_name: row.display_name ?? null,
        email: row.email ?? null,
        role: row.role,
        role_label: ROLE_LABELS[row.role] ?? row.role,
        access_label: ACCESS_LABELS[row.role] ?? '',
        is_active: Boolean(row.is_active),
        auth_provider: row.auth_provider ?? 'local',
        auth_provider_label: AUTH_PROVIDER_LABELS[row.auth_provider] ?? row.auth_provider ?? 'local',
        external_principal: row.external_principal ?? null,
        last_login_at: row.last_login_at ?? null,
        last_sso_login_at: row.last_sso_login_at ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
        given_name: row.given_name ?? null,
        surname: row.surname ?? null,
        department: row.department ?? null,
    };
}

function normalizeSettingValue(type, value, defaultValue) {
    if (type === 'boolean') {
        return normalizeBoolean(value, String(defaultValue).toLowerCase() === 'true') ? 'true' : 'false';
    }
    const normalized = normalizeString(value);
    return normalized || defaultValue;
}

function getChangedFields(previousRow, nextRow) {
    return Object.keys(nextRow).filter((key) => {
        const previous = previousRow[key] ?? null;
        const next = nextRow[key] ?? null;
        return previous !== next;
    });
}

function handleSqlWriteError(err, res) {
    if (err && err.code === '23505') {
        return res.status(409).json({ error: 'Uživatel s tímto username nebo AD identitou už existuje.' });
    }
    throw err;
}

async function fetchUserById(id) {
    const result = await getPlatformPool().query(`${USER_SELECT} WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
}

async function auditUserChange({ action, previousRow = null, currentRow, req }) {
    await log({
        tableName: 'Users',
        recordId: currentRow.id,
        recordLabel: currentRow.username,
        action,
        oldValues: previousRow ? buildUserResponse(previousRow) : null,
        newValues: buildUserResponse(currentRow),
        changedFields: previousRow ? getChangedFields(buildUserResponse(previousRow), buildUserResponse(currentRow)) : null,
        performedBy: req.user?.username || 'system',
        clientIp: req.ip || null,
        userAgent: req.get('user-agent') || null,
    });
}

router.get('/seed-status', canEdit, async (req, res, next) => {
    try {
        const [seedRows, taxonomyCounts, entityCounts, capabilityMapSeedState] = await Promise.all([
            getPool().query(`
                SELECT seed_key, seed_source, seeded_at
                FROM data.c3_entity_seed_snapshot_state
                ORDER BY seeded_at DESC
            `),
            getPool().query(`
                SELECT COALESCE(item_type, 'UNKNOWN') AS item_type, COUNT(*) AS total
                FROM data.c3_taxonomy
                GROUP BY item_type
                ORDER BY item_type
            `),
            getPool().query(`
                SELECT
                    (SELECT COUNT(*) FROM data.c3_service) AS services,
                    (SELECT COUNT(*) FROM data.c3_application) AS applications,
                    (SELECT COUNT(*) FROM data.c3_data_object) AS data_objects,
                    (SELECT COUNT(*) FROM data.c3_technology_interaction) AS technology_interactions,
                    (SELECT COUNT(*) FROM data.c3_technology_interaction_service_link) AS ti_service_links,
                    (SELECT COUNT(*) FROM data.c3_technology_interaction_application_link) AS ti_application_links,
                    (SELECT COUNT(*) FROM data.c3_technology_interaction_data_object_link) AS ti_data_object_links
            `),
            getPool().query(`
                SELECT seed_version, seed_source, seeded_at
                FROM data.c3_capability_builder_seed_state
                ORDER BY seeded_at DESC
                LIMIT 1
            `),
        ]);

        const seeds = seedRows.rows;
        const xlsxSeed = seeds.find((row) => row.seed_key === 'c3.taxonomy.xlsx-import.v1') ?? null;
        const baselineSeed = seeds.find((row) => row.seed_key === 'c3.taxonomy.baseline.v1') ?? null;
        const activeTaxonomySeed = xlsxSeed ?? baselineSeed ?? null;
        const capabilitySeed = capabilityMapSeedState.rows[0] ?? null;
        const capabilityMapCounts = await getPool().query(`
            SELECT
                COUNT(*) AS total_rows,
                COALESCE(SUM(CASE
                    WHEN $1::timestamptz IS NOT NULL AND updated_at > ($1::timestamptz + INTERVAL '1 second') THEN 1
                    ELSE 0
                END), 0) AS modified_rows
            FROM data.c3_capability_builder
        `, [capabilitySeed?.seeded_at ?? null]);
        const capabilityCounts = capabilityMapCounts.rows[0] ?? { total_rows: 0, modified_rows: 0 };
        const modifiedRows = Number(capabilityCounts.modified_rows ?? 0);
        const totalRows = Number(capabilityCounts.total_rows ?? 0);
        const taxonomyTotal = taxonomyCounts.rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);

        res.json({
            taxonomy: {
                mode: xlsxSeed
                    ? 'xlsx-import'
                    : baselineSeed
                        ? 'baseline'
                        : taxonomyTotal === 0
                            ? 'none'
                            : 'manual',
                active_seed_key: activeTaxonomySeed?.seed_key ?? null,
                active_seed_source: activeTaxonomySeed?.seed_source ?? null,
                active_seeded_at: activeTaxonomySeed?.seeded_at ?? null,
                total: taxonomyTotal,
                by_item_type: taxonomyCounts.rows.map((row) => ({
                    item_type: row.item_type,
                    total: Number(row.total ?? 0),
                })),
            },
            entities: entityCounts.rows[0] ?? {
                services: 0,
                applications: 0,
                data_objects: 0,
                technology_interactions: 0,
                ti_service_links: 0,
                ti_application_links: 0,
                ti_data_object_links: 0,
            },
            capability_map: {
                mode: totalRows === 0 ? 'none' : !capabilitySeed ? 'manual' : modifiedRows > 0 ? 'modified' : 'baseline',
                seed_version: capabilitySeed?.seed_version ?? null,
                seed_source: capabilitySeed?.seed_source ?? null,
                seeded_at: capabilitySeed?.seeded_at ?? null,
                total_rows: totalRows,
                modified_rows: modifiedRows,
                was_modified_after_seed: modifiedRows > 0,
            },
            seeds,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/logs', canAdmin, async (req, res, next) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit || '100', 10), 1), 500);
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const offset = (page - 1) * limit;

        const [countRes, dataRes] = await Promise.all([
            getPlatformPool().query('SELECT COUNT(1) AS total FROM platform.audit_log'),
            getPlatformPool().query(`
                SELECT
                    id,
                    table_name,
                    record_id,
                    record_label,
                    action,
                    old_values,
                    new_values,
                    changed_fields,
                    performed_by,
                    client_ip,
                    user_agent,
                    performed_at
                FROM platform.audit_log
                ORDER BY performed_at DESC
                OFFSET $1
                LIMIT $2
            `, [offset, limit]),
        ]);

        res.json({
            total: Number(countRes.rows[0]?.total ?? 0),
            page,
            limit,
            items: dataRes.rows,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/users', canAdmin, async (req, res, next) => {
    try {
        const result = await getPlatformPool().query(`${USER_SELECT} ORDER BY username ASC`);
        res.json(result.rows.map(buildUserResponse));
    } catch (err) {
        next(err);
    }
});

router.get('/web-settings', canAdmin, async (req, res, next) => {
    try {
        const rows = await getConfigValues(SSO_SETTINGS.map((setting) => setting.key));
        res.json({
            items: SSO_SETTINGS.map((setting) => ({
                key: setting.key,
                type: setting.type,
                description: setting.description,
                default_value: setting.defaultValue,
                value: String(rows[setting.key]?.config_value ?? setting.defaultValue),
            })),
        });
    } catch (err) {
        next(err);
    }
});

router.put('/web-settings', canAdmin, async (req, res, next) => {
    try {
        const payload = req.body && typeof req.body === 'object' ? req.body : {};

        for (const setting of SSO_SETTINGS) {
            const configValue = normalizeSettingValue(setting.type, payload[setting.key], setting.defaultValue);
            await upsertConfigValue({
                configKey: setting.key,
                configValue,
                configType: setting.type,
                description: setting.description,
                updatedBy: req.user?.username ?? null,
            });
        }

        invalidateConfigValues(SSO_SETTINGS.map((setting) => setting.key));

        const rows = await getConfigValues(SSO_SETTINGS.map((setting) => setting.key));
        res.json({
            items: SSO_SETTINGS.map((setting) => ({
                key: setting.key,
                type: setting.type,
                description: setting.description,
                default_value: setting.defaultValue,
                value: String(rows[setting.key]?.config_value ?? setting.defaultValue),
            })),
        });
    } catch (err) {
        next(err);
    }
});

router.post('/users', canAdmin, async (req, res, next) => {
    try {
        const username = normalizeString(req.body.username).toLowerCase();
        const role = normalizeRole(req.body.role);
        const authProvider = normalizeAuthProvider(req.body.auth_provider ?? 'local');
        const isActive = normalizeBoolean(req.body.is_active, true);
        const givenName = normalizeNullableString(req.body.given_name);
        const surname = normalizeNullableString(req.body.surname);
        const displayName = buildDisplayName({
            displayName: req.body.display_name,
            givenName,
            surname,
            username,
        });
        const email = normalizeEmail(req.body.email);
        const department = normalizeNullableString(req.body.department);
        const externalPrincipal = authProvider === 'ad' ? normalizeNullableString(req.body.external_principal) : null;
        const password = normalizeString(req.body.password);

        if (!username) return res.status(400).json({ error: 'Username je povinný.' });
        if (!role) return res.status(400).json({ error: 'Role je povinná.' });
        if (!authProvider) return res.status(400).json({ error: 'Typ přihlášení je povinný.' });
        if (authProvider === 'local' && password.length < 8) {
            return res.status(400).json({ error: 'Lokální účet musí mít heslo alespoň o 8 znacích.' });
        }

        const passwordHash = authProvider === 'local' ? await bcrypt.hash(password, 12) : null;

        const insertRes = await getPlatformPool().query(`
            INSERT INTO platform.users (
                username,
                display_name,
                email,
                role,
                is_active,
                auth_provider,
                external_principal,
                password_hash,
                given_name,
                surname,
                department
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING
                id,
                username,
                display_name,
                email,
                role,
                is_active,
                auth_provider,
                external_principal,
                last_login_at,
                last_sso_login_at,
                created_at,
                updated_at,
                given_name,
                surname,
                department,
                password_hash
        `, [
            username,
            displayName,
            email,
            role,
            isActive,
            authProvider,
            externalPrincipal,
            passwordHash,
            givenName,
            surname,
            department,
        ]);

        const createdUser = insertRes.rows[0];
        await auditUserChange({ action: 'INSERT', currentRow: createdUser, req });
        res.status(201).json(buildUserResponse(createdUser));
    } catch (err) {
        try {
            return handleSqlWriteError(err, res);
        } catch (unhandledErr) {
            next(unhandledErr);
        }
    }
});

router.put('/users/:id', canAdmin, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Neplatné ID uživatele.' });

        const existingUser = await fetchUserById(id);
        if (!existingUser) return res.status(404).json({ error: 'Uživatel nenalezen.' });

        const username = normalizeString(req.body.username || existingUser.username).toLowerCase();
        const role = normalizeRole(req.body.role ?? existingUser.role);
        const authProvider = normalizeAuthProvider(req.body.auth_provider ?? existingUser.auth_provider ?? 'local');
        const isActive = normalizeBoolean(req.body.is_active, Boolean(existingUser.is_active));
        const givenName = normalizeNullableString(req.body.given_name ?? existingUser.given_name);
        const surname = normalizeNullableString(req.body.surname ?? existingUser.surname);
        const displayName = buildDisplayName({
            displayName: req.body.display_name ?? existingUser.display_name,
            givenName,
            surname,
            username,
        });
        const email = normalizeEmail(req.body.email ?? existingUser.email);
        const department = normalizeNullableString(req.body.department ?? existingUser.department);
        const externalPrincipal = authProvider === 'ad'
            ? normalizeNullableString(req.body.external_principal ?? existingUser.external_principal)
            : null;
        const password = normalizeString(req.body.password);

        if (!username) return res.status(400).json({ error: 'Username je povinný.' });
        if (!role) return res.status(400).json({ error: 'Role je povinná.' });
        if (!authProvider) return res.status(400).json({ error: 'Typ přihlášení je povinný.' });
        if (authProvider === 'local' && !existingUser.password_hash && password.length < 8) {
            return res.status(400).json({ error: 'Při převodu na lokální účet musíš zadat heslo alespoň o 8 znacích.' });
        }
        if (authProvider === 'local' && password && password.length < 8) {
            return res.status(400).json({ error: 'Nové heslo musí mít alespoň 8 znaků.' });
        }

        const passwordHash = authProvider === 'ad'
            ? null
            : (password ? await bcrypt.hash(password, 12) : existingUser.password_hash);

        const updateRes = await getPlatformPool().query(`
            UPDATE platform.users
            SET
                username = $2,
                display_name = $3,
                email = $4,
                role = $5,
                is_active = $6,
                auth_provider = $7,
                external_principal = $8,
                password_hash = $9,
                given_name = $10,
                surname = $11,
                department = $12,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING
                id,
                username,
                display_name,
                email,
                role,
                is_active,
                auth_provider,
                external_principal,
                last_login_at,
                last_sso_login_at,
                created_at,
                updated_at,
                given_name,
                surname,
                department,
                password_hash
        `, [
            id,
            username,
            displayName,
            email,
            role,
            isActive,
            authProvider,
            externalPrincipal,
            passwordHash,
            givenName,
            surname,
            department,
        ]);

        const updatedUser = updateRes.rows[0];
        await auditUserChange({ action: 'UPDATE', previousRow: existingUser, currentRow: updatedUser, req });
        res.json(buildUserResponse(updatedUser));
    } catch (err) {
        try {
            return handleSqlWriteError(err, res);
        } catch (unhandledErr) {
            next(unhandledErr);
        }
    }
});

module.exports = router;
