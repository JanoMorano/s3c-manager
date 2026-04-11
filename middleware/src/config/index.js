'use strict';

const fs = require('fs');
require('dotenv').config();

function required(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

function readTrimmedFile(filePath) {
    const normalized = String(filePath || '').trim();
    if (!normalized) return null;

    try {
        const value = fs.readFileSync(normalized, 'utf8').trim();
        if (!value) {
            throw new Error('secret file is empty');
        }
        return value;
    } catch (err) {
        throw new Error(`Unable to read secret file ${normalized}: ${err.message}`);
    }
}

function readSecret({ envNames = [], fileNames = [], requiredValue = false }) {
    for (const fileName of fileNames) {
        const filePath = String(process.env[fileName] || '').trim();
        if (!filePath) continue;
        const fileValue = readTrimmedFile(filePath);
        if (fileValue) return fileValue;
    }

    for (const envName of envNames) {
        const value = String(process.env[envName] || '').trim();
        if (value) return value;
    }

    if (requiredValue) {
        const names = [...envNames, ...fileNames].join(', ');
        throw new Error(`Missing required secret. Set one of: ${names}`);
    }

    return null;
}

function parseBool(value, defaultValue = false) {
    if (value == null || value === '') return defaultValue;
    return String(value).toLowerCase() === 'true';
}

function parseNumber(value, defaultValue) {
    const parsed = parseInt(value ?? '', 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
}

const pgHost = process.env.DB_HOST || process.env.POSTGRES_HOST || 'postgres';
const pgPort = parseNumber(process.env.DB_PORT || process.env.POSTGRES_PORT, 5432);
const pgDatabase = process.env.DB_NAME || process.env.POSTGRES_DB || 'service_catalogue';
const pgUser = process.env.DB_USER || process.env.POSTGRES_USER || 'postgres';
const pgPassword = readSecret({
    envNames: ['DB_PASSWORD', 'POSTGRES_PASSWORD'],
    fileNames: ['DB_PASSWORD_FILE', 'POSTGRES_PASSWORD_FILE'],
}) || 'postgres';
const trustedProxyHeaderEnv = process.env.AUTH_SSO_TRUSTED_PROXY_HEADER;

const config = {
    app: {
        env: process.env.NODE_ENV || 'development',
        port: parseNumber(process.env.PORT, 4000),
        name: 'Service Catalogue API',
    },

    db: {
        client: 'pg',
        connectionString: String(process.env.DATABASE_URL || '').trim() || null,
        host: pgHost,
        port: pgPort,
        database: pgDatabase,
        user: pgUser,
        password: pgPassword,
        server: pgHost,
        ssl: (() => {
            const enabled = parseBool(process.env.DB_SSL, false);
            if (!enabled) return false;
            const rejectUnauthorized = !parseBool(process.env.DB_SSL_INSECURE_SKIP_VERIFY, false);
            return { rejectUnauthorized };
        })(),
        pool: {
            max: parseNumber(process.env.DB_POOL_MAX, 10),
            min: parseNumber(process.env.DB_POOL_MIN, 2),
            idleTimeoutMillis: parseNumber(process.env.DB_IDLE_TIMEOUT_MS, 30000),
            connectionTimeoutMillis: parseNumber(process.env.DB_CONNECT_TIMEOUT_MS, 2000),
        },
    },

    dbPlatform: {
        database: pgDatabase,
        schema: 'platform',
    },

    dbData: {
        database: pgDatabase,
        schema: 'data',
    },

    jwt: {
        secret: readSecret({
            envNames: ['JWT_SECRET'],
            fileNames: ['JWT_SECRET_FILE'],
            requiredValue: true,
        }),
        expiryMinutes: parseNumber(process.env.JWT_EXPIRY_MINUTES, 60),
        refreshDays: parseNumber(process.env.REFRESH_TOKEN_EXPIRY_DAYS, 7),
        issuer: 'service-catalogue',
        audience: 'service-catalogue-ui',
    },

    auth: {
        sso: {
            enabled: process.env.AUTH_SSO_ENABLED === 'true',
            header: process.env.AUTH_SSO_HEADER || 'x-remote-user',
            displayNameHeader: process.env.AUTH_SSO_DISPLAY_NAME_HEADER || 'x-remote-name',
            emailHeader: process.env.AUTH_SSO_EMAIL_HEADER || 'x-remote-email',
            givenNameHeader: process.env.AUTH_SSO_GIVEN_NAME_HEADER || 'x-remote-given-name',
            surnameHeader: process.env.AUTH_SSO_SURNAME_HEADER || 'x-remote-surname',
            departmentHeader: process.env.AUTH_SSO_DEPARTMENT_HEADER || 'x-remote-department',
            trustedProxyHeader: trustedProxyHeaderEnv === undefined ? 'x-sso-proxy-secret' : String(trustedProxyHeaderEnv).trim(),
            trustedProxySharedSecret: String(process.env.AUTH_SSO_TRUSTED_PROXY_SHARED_SECRET || '').trim(),
        },
    },

    install: {
        setupToken: String(process.env.INSTALL_SETUP_TOKEN || '').trim(),
    },

    cors: {
        origins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
            .split(/[,;]/)
            .map((item) => item.trim())
            .filter(Boolean),
    },

    cache: {
        dashboardTtl: parseNumber(process.env.CACHE_DASHBOARD_TTL, 300),
        c3TaxonomyTtl: parseNumber(process.env.CACHE_C3_TTL, 86400),
        c3DashboardTtl: parseNumber(process.env.CACHE_C3_DASHBOARD_TTL, 600),
        c3CapabilityMapTtl: parseNumber(process.env.CACHE_C3_CAPABILITY_MAP_TTL, 600),
        listTypeTtl: parseNumber(process.env.CACHE_LIST_TYPE_TTL, 3600),
    },

    retention: {
        enabled: process.env.ENABLE_RETENTION_SCHEDULER !== 'false',
        runnerName: process.env.RETENTION_RUNNER_NAME || 'inline-app',
        runnerKind: process.env.RETENTION_RUNNER_KIND || 'app-inline',
        purgeIntervalSeconds: parseNumber(process.env.RETENTION_PURGE_INTERVAL_SECONDS, 86400),
        heartbeatTtlSeconds: parseNumber(process.env.RETENTION_HEARTBEAT_TTL_SECONDS, 180),
    },

    init: {
        seedCapabilityMap: parseBool(process.env.INIT_WITH_C3_CAPABILITY_MAP_SEED, false),
    },

    sp: {
        siteUrl: process.env.SP_SITE_URL || '',
        catalogList: process.env.SP_CATALOG_LIST || 'ServiceCatalog',
        flavourList: process.env.SP_FLAVOUR_LIST || 'ServiceFlavours',
        relationList: process.env.SP_RELATION_LIST || 'ServiceRelations',
    },

    rateLimit: {
        auth: {
            windowMs: 15 * 60 * 1000,
            max: 20,
        },
        api: {
            windowMs: 60 * 1000,
            max: parseNumber(process.env.RATE_LIMIT_API_MAX, 500),
        },
    },

    logging: {
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    },
};

module.exports = config;
