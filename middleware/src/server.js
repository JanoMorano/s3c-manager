'use strict';

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const morgan      = require('morgan');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');

const config  = require('./config');
const logger  = require('./utils/logger');
const { attachRequestContext, sanitizeUrlForLog } = require('./utils/request-context');
const { initDb, closePools, getPool } = require('./db/pool');
const { startRetentionScheduler, stopRetentionScheduler } = require('./services/retention');
const { requireModuleApiEnabled } = require('./middleware/module-gates');
const { tReq } = require('./utils/i18n');
const { assertProductionSecrets, isWeakJwtSecret } = require('./utils/security-config');

// Routes
const authRoutes      = require('./routes/auth');
const installRoutes   = require('./routes/install');
const servicesRoutes  = require('./routes/services');
const flavoursRoutes  = require('./routes/flavours');
const relationsRoutes = require('./routes/relations');
const statsRoutes     = require('./routes/stats');
const dashboardRoutes = require('./routes/dashboard');
const { router: capabilitiesRoutes } = require('./routes/capabilities');
const spiralsRoutes   = require('./routes/spirals');
const taxonomyRoutes  = require('./routes/taxonomy');
const importRoutes    = require('./routes/import');
const adminRoutes     = require('./routes/admin');
const graphRoutes     = require('./routes/graph');
const exportRoutes    = require('./routes/exports');
const searchRoutes    = require('./routes/search');
const governanceRoutes = require('./routes/governance');
const portfolioRoutes = require('./routes/portfolio');
const readinessRoutes = require('./routes/readiness');
const impactRoutes    = require('./routes/impact');
const { router: refRoutes }  = require('./routes/ref');
const { router: capLinksRoutes } = require('./routes/capability-links');
const groupsRoutes = require('./routes/groups');
const installSvc      = require('./services/install.service');

const app = express();
const requireC3ModuleApiEnabled = requireModuleApiEnabled('C3_TAXONOMY', (req) => tReq(req, 'taxonomy.errors.module_inactive'));

// Important for reverse proxy setups (nginx, Docker, Kubernetes)
app.set('trust proxy', 1);

app.use(attachRequestContext);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            baseUri:    ["'self'"],
            connectSrc: ["'self'"],
            fontSrc:    ["'self'", 'data:'],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            objectSrc:  ["'none'"],
            scriptSrc:  ["'self'"],
            styleSrc:   ["'self'", "'unsafe-inline'"],
            imgSrc:     ["'self'", 'data:'],
        }
    },
    crossOriginEmbedderPolicy: false
}));

// SECURITY: Strip SSO identity headers from direct client requests.
// Only the trusted reverse proxy should send these. This prevents clients
// from injecting fake identity headers when accessing the app directly.
app.use((req, res, next) => {
    const ssoConf = config.auth?.sso;
    if (!ssoConf?.enabled) return next();

    // Only strip on non-SSO routes; the /auth/sso endpoint validates trust separately.
    if (req.path === '/api/v1/auth/sso') return next();

    // Remove all SSO headers from non-SSO requests to prevent injection.
    const ssoHeaders = [
        ssoConf.header, ssoConf.displayNameHeader, ssoConf.emailHeader,
        ssoConf.givenNameHeader, ssoConf.surnameHeader, ssoConf.departmentHeader,
    ].filter(Boolean);
    for (const h of ssoHeaders) {
        delete req.headers[h.toLowerCase()];
    }
    next();
});

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (config.cors.origins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: Origin '${origin}' není povolen`));
    },
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','Accept-Language','X-Request-Id'],
    exposedHeaders: ['X-Total-Count','X-Page','X-Per-Page','X-Request-Id','Deprecation','Sunset','Link'],
    credentials: true,
    maxAge: 86400
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

morgan.token('id', (req) => req.id || '-');
morgan.token('safe-url', (req) => sanitizeUrlForLog(req.originalUrl || req.url));

app.use(morgan(
    ':id :method :safe-url :status :res[content-length] - :response-time ms',
    {
        stream: { write: msg => logger.http(msg.trim()) },
        skip: req => req.path.startsWith('/health')
    }
));

app.use('/api/', rateLimit({
    windowMs: config.rateLimit.api.windowMs,
    max:      config.rateLimit.api.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Příliš mnoho požadavků. Zkuste to znovu za chvíli.' }
}));

// Install wizard — always available (before and after installation)
app.use('/api/v1/install',   installRoutes);

app.use('/api/v1/auth',      authRoutes);
app.use('/api/v1/services',  servicesRoutes);
app.use('/api/v1/flavours',  flavoursRoutes);
app.use('/api/v1/relations', relationsRoutes);
app.use('/api/v1/stats',     statsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/capabilities', capabilitiesRoutes);
app.use('/api/v1/spirals',   spiralsRoutes);
app.use('/api/v1/taxonomy',  taxonomyRoutes);
app.use('/api/v1/import',    importRoutes);
app.use('/api/v1/admin',     adminRoutes);
app.use('/api/v1/admin',     groupsRoutes);
app.use('/api/v1/graph',     graphRoutes);
app.use('/api/v1/export',    exportRoutes);
app.use('/api/v1/search',    searchRoutes);
app.use('/api/v1/governance', governanceRoutes);
app.use('/api/v1/portfolio', portfolioRoutes);
app.use('/api/v1/readiness', readinessRoutes);
app.use('/api/v1/impact',    impactRoutes);
app.use('/api/v1/ref',       refRoutes);
// capability links: /api/v1/taxonomy/c3/:uuid/links/*
app.use('/api/v1/taxonomy/c3/:uuid/links', requireC3ModuleApiEnabled, capLinksRoutes);

function respondLive(req, res) {
    res.json({ status: 'ok', uptime: process.uptime(), request_id: req.id });
}

async function respondReady(req, res) {
    try {
        const pool = getPool();
        const result = await pool.query('SELECT 1 AS ok');
        if (result.rows[0]?.ok !== 1) {
            throw new Error('Unexpected DB response');
        }
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
            request_id: req.id,
        });
    } catch (err) {
        logger.error(`${req.id} Health readiness check failed: ${err.message}`);
        res.status(503).json({
            status: 'not ready',
            error: config.app.env === 'production' ? 'Readiness check failed' : err.message,
            request_id: req.id,
        });
    }
}

async function respondImportHealth(req, res) {
    try {
        const pool = getPool();
        const [lastBatch, lastRetentionJob, runnerHeartbeat] = await Promise.all([
            pool.query(`
                SELECT
                    id, filename, imported_at, imported_by, row_count, ok_count, warn_count, error_count
                FROM data.import_batch
                ORDER BY imported_at DESC
                LIMIT 1
            `),
            pool.query(`
                SELECT
                    id,
                    trigger_source,
                    status,
                    started_at,
                    completed_at,
                    error_message
                FROM data.v_retentionjobauditexport
                ORDER BY started_at DESC, id DESC
                LIMIT 1
            `),
            pool.query(`
                SELECT
                    runner_name,
                    runner_kind,
                    status,
                    last_seen_at,
                    last_run_started_at,
                    last_run_completed_at,
                    last_job_status,
                    last_error_message
                FROM data.v_retentionrunnerheartbeat
                WHERE runner_name = $1
                ORDER BY last_seen_at DESC
                LIMIT 1
            `, [config.retention.runnerName]),
        ]);

        const runner = runnerHeartbeat.rows[0] ?? null;
        const lastSeenMs = runner?.last_seen_at ? new Date(runner.last_seen_at).getTime() : 0;
        const heartbeatFresh = !!runner && (Date.now() - lastSeenMs) <= (config.retention.heartbeatTtlSeconds * 1000);
        const overallStatus = !config.retention.enabled
            ? 'disabled'
            : runner && heartbeatFresh && runner.last_job_status !== 'failed'
                ? 'ok'
                : runner
                    ? 'warn'
                    : 'unknown';

        res.json({
            status: overallStatus,
            retention_enabled: config.retention.enabled,
            runner_heartbeat_fresh: heartbeatFresh,
            last_import_batch: lastBatch.rows[0] ?? null,
            last_retention_job: lastRetentionJob.rows[0] ?? null,
            retention_runner: runner,
            request_id: req.id,
        });
    } catch (err) {
        logger.error(`${req.id} Import health check failed: ${err.message}`);
        res.status(503).json({
            status: 'error',
            error: config.app.env === 'production' ? 'Import health check failed' : err.message,
            request_id: req.id,
        });
    }
}

app.get('/health/live', respondLive);
app.get('/api/health/live', respondLive);
app.get('/health/ready', respondReady);
app.get('/api/health/ready', respondReady);
app.get('/health', respondReady);
app.get('/api/health', respondReady);
app.get('/health/import', respondImportHealth);
app.get('/api/health/import', respondImportHealth);

app.use((req, res) => {
    res.status(404).json({
        error: `Endpoint ${req.method} ${req.path} neexistuje`,
        request_id: req.id,
    });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    logger.error(`${req.id || '-'} ${req.method} ${sanitizeUrlForLog(req.originalUrl || req.path)} → ${status}: ${err.message}`);

    const exposeStack = config.app.env !== 'production' && req.query?.debug_stack === '1';
    res.status(status).json({
        error: status === 500 ? 'Interní chyba serveru' : err.message,
        request_id: req.id,
        ...(exposeStack ? { stack: err.stack } : {}),
    });
});

async function logInstallStateOnStart() {
    try {
        const { getPlatformPool } = require('./db/pool');
        const pool = getPlatformPool();
        const { mode, status } = await installSvc.detectInstallMode(pool);

        if (status === 'READY') {
            logger.info(`✅ Install state: READY — normal operation`);
        } else {
            logger.warn(`⚠️  Install state: ${status} (mode: ${mode}) — application is waiting for installation to finish`);
            logger.warn(`   → Frontend will be redirected to /install`);
        }
    } catch (err) {
        logger.warn(`Install state check failed — ${err.message}`);
        logger.warn(`If this is a fresh install, run init-db-postgres.sh or deploy through Compose.`);
    }
}

/**
 * Releases a stale install lock on startup. If middleware crashed during
 * installation, the lock may remain in the database. On the next start
 * we safely release it.
 * Rule: release only if the status is NOT READY, which means installation
 * never completed.
 */
async function clearStaleLockOnStartup() {
    try {
        const { getPlatformPool } = require('./db/pool');
        const pool = getPlatformPool();
        const row = await installSvc.getInstallRow(pool);

        if (!row) return; // fresh DB without seed — system_installation does not exist yet

        if (row.install_status === 'READY') return; // normal operation, do not touch the lock

        if (row.install_lock) {
            logger.warn(`install: stale lock detected (status: ${row.install_status}, lockedBy: ${row.locked_by}) — releasing`);
            // Release via direct UPDATE (without token) — startup is authoritative here
            await pool.query(`
                UPDATE platform.system_installation
                SET install_lock       = FALSE,
                    lock_token         = NULL,
                    lock_acquired_at   = NULL,
                    locked_by          = NULL,
                    updated_at         = CURRENT_TIMESTAMP
                WHERE id = 1
            `);
            logger.info('install: stale lock released — the install wizard can be started again');
        }
    } catch (err) {
        // Startup remains non-blocking even if stale lock release fails
        logger.warn(`install: stale lock release failed — ${err.message}`);
    }
}

function logRuntimeSecurityWarnings() {
    const weakMarkers = ['change-me', 'changeme', 'postgres', 'password', 'secret'];
    const jwtSecret = String(config.jwt?.secret || '');
    const dbPassword = String(config.db?.password || '');

    if (isWeakJwtSecret(jwtSecret)) {
        logger.warn('security: JWT_SECRET appears weak or placeholder-like; use at least 32 random characters before production use');
    }

    if (config.app.env === 'production' && weakMarkers.some((marker) => dbPassword.toLowerCase() === marker)) {
        logger.warn('security: database password appears placeholder-like; rotate before production use');
    }

    if (!config.install?.setupToken && config.app.env !== 'test') {
        logger.warn('security: INSTALL_SETUP_TOKEN is not configured; pre-READY install write routes are protected only after authentication is available');
    }
}

async function start() {
    assertProductionSecrets(config);
    await initDb(); // internally calls process.exit(1) on failure
    logRuntimeSecurityWarnings();
    await clearStaleLockOnStartup(); // release stale lock before any other step
    // Upgrade detection — explicit on startup, not a read-side effect
    try {
        const { getPlatformPool } = require('./db/pool');
        await installSvc.checkAndApplyUpgradeIfNeeded(getPlatformPool());
    } catch { /* must not block startup */ }
    await logInstallStateOnStart();
    await startRetentionScheduler();

    logger.info(`DB connected: ${config.db.server} -> ${config.dbPlatform.database} + ${config.dbData.database}`);

    app.listen(config.app.port, () => {
        logger.info(`✅ Service Catalogue API is running on port ${config.app.port} [${config.app.env}]`);
    });
}

process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Rejection: ${reason}`);
    process.exit(1);
});

process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await stopRetentionScheduler();
    await closePools();
    process.exit(0);
});

if (require.main === module) {
    start();
}

module.exports = app;
