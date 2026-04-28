'use strict';

require('dotenv').config();

function firstNonEmpty(...values) {
    for (const value of values) {
        if (value != null && String(value).trim() !== '') {
            return String(value);
        }
    }
    return '';
}

function required(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
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
const pgPassword = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres';

const config = {
    app: {
        env: process.env.NODE_ENV || 'development',
        port: parseNumber(process.env.PORT, 4000),
        name: 'Service Catalogue API',
    },

    db: {
        client: 'pg',
        connectionString: process.env.DATABASE_URL || null,
        host: pgHost,
        port: pgPort,
        database: pgDatabase,
        user: pgUser,
        password: pgPassword,
        server: pgHost,
        ssl: parseBool(process.env.DB_SSL, false)
            ? { rejectUnauthorized: !parseBool(process.env.DB_SSL_INSECURE_SKIP_VERIFY, false) }
            : false,
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

    install: {
        // SECURITY: when set, all pre-READY write endpoints require this token in X-Install-Token header.
        setupToken: (process.env.INSTALL_SETUP_TOKEN || '').trim(),
    },

    jwt: {
        secret: required('JWT_SECRET'),
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
            // SECURITY: trusted proxy IPs allowed to send SSO headers.
            // Comma-separated list. Empty = no IP restriction (warn-only).
            trustedProxies: (process.env.AUTH_SSO_TRUSTED_PROXIES || '')
                .split(',').map(s => s.trim()).filter(Boolean),
            // SECURITY: shared secret the proxy must send in AUTH_SSO_SHARED_SECRET_HEADER.
            // When set, requests without matching value are hard-rejected (fail-closed).
            // When not set and no trustedProxies configured, SSO logs a warning and proceeds
            // only if AUTH_SSO_ALLOW_OPEN=true — otherwise rejects (fail-closed by default).
            sharedSecret: firstNonEmpty(
                process.env.AUTH_SSO_SHARED_SECRET,
                process.env.AUTH_SSO_TRUSTED_PROXY_SHARED_SECRET
            ),
            sharedSecretHeader: firstNonEmpty(
                process.env.AUTH_SSO_SHARED_SECRET_HEADER,
                process.env.AUTH_SSO_TRUSTED_PROXY_HEADER,
                'x-sso-secret'
            ),
            // Backward-compatible aliases used by auth route validation/tests.
            trustedProxySharedSecret: firstNonEmpty(
                process.env.AUTH_SSO_SHARED_SECRET,
                process.env.AUTH_SSO_TRUSTED_PROXY_SHARED_SECRET
            ),
            trustedProxyHeader: firstNonEmpty(
                process.env.AUTH_SSO_SHARED_SECRET_HEADER,
                process.env.AUTH_SSO_TRUSTED_PROXY_HEADER,
                'x-sso-secret'
            ),
            // Safety valve: explicitly set to 'true' to allow SSO with no boundary guards.
            // Intended only for fully isolated environments. NOT recommended.
            allowOpen: process.env.AUTH_SSO_ALLOW_OPEN === 'true',
        },
    },

    cors: {
        origins: (process.env.CORS_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://localhost:3000')
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
            max: parseNumber(process.env.RATE_LIMIT_API_MAX, 6000),
        },
    },

    logging: {
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    },
};

module.exports = config;
