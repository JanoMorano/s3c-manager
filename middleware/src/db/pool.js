'use strict';

const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

const DB_RETRIES = 10;
const DB_RETRY_WAIT = 5000;
const PG_SEARCH_PATH = 'data, platform, public';

let sharedPool;
let sharedPoolConnect;
let platformPool;
let dataPool;

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPoolConfig() {
    if (config.db.connectionString) {
        return {
            connectionString: config.db.connectionString,
            max: config.db.pool.max,
            idleTimeoutMillis: config.db.pool.idleTimeoutMillis,
            connectionTimeoutMillis: config.db.pool.connectionTimeoutMillis,
            ssl: config.db.ssl,
        };
    }

    return {
        host: config.db.host,
        port: config.db.port,
        database: config.db.database,
        user: config.db.user,
        password: config.db.password,
        max: config.db.pool.max,
        idleTimeoutMillis: config.db.pool.idleTimeoutMillis,
        connectionTimeoutMillis: config.db.pool.connectionTimeoutMillis,
        ssl: config.db.ssl,
    };
}

class PgPoolWrapper {
    constructor(rawPool) {
        this.raw = rawPool;
    }

    async query(text, values = []) {
        return this.raw.query(text, values);
    }
}

async function connectWithRetry() {
    const pgConfig = buildPoolConfig();
    let lastErr;

    for (let attempt = 1; attempt <= DB_RETRIES; attempt += 1) {
        const pool = new Pool(pgConfig);
        pool.on('error', (err) => logger.error(`PG pool error: ${err.message}`));
        pool.on('connect', (client) => {
            client.query(`SET search_path TO ${PG_SEARCH_PATH}`).catch((err) => {
                logger.error(`PG search_path init failed: ${err.message}`);
            });
        });
        try {
            await pool.query(`SET search_path TO ${PG_SEARCH_PATH}`);
            await pool.query('SELECT 1 AS ok');
            logger.info(`PostgreSQL connected: ${config.db.host}:${config.db.port}/${config.db.database} (attempt ${attempt})`);
            return pool;
        } catch (err) {
            lastErr = err;
            await pool.end().catch(() => {});
            logger.warn(`PostgreSQL unavailable (attempt ${attempt}/${DB_RETRIES}): ${err.message}`);
            if (attempt < DB_RETRIES) {
                await wait(DB_RETRY_WAIT);
            }
        }
    }

    logger.error(`PostgreSQL init failed after ${DB_RETRIES} attempts: ${lastErr.message}`);
    throw lastErr;
}

async function initDb() {
    try {
        sharedPool = await connectWithRetry();
        sharedPoolConnect = Promise.resolve(sharedPool);
        platformPool = new PgPoolWrapper(sharedPool);
        dataPool = new PgPoolWrapper(sharedPool);
    } catch (err) {
        logger.error(`DB init failed: ${err.message}`);
        process.exit(1);
    }
}

function getPlatformPool() {
    if (!platformPool) throw new Error('Platform pool is not initialized; call initDb() first');
    return platformPool;
}

function getDataPool() {
    if (!dataPool) throw new Error('Data pool is not initialized; call initDb() first');
    return dataPool;
}

function getPool() {
    return getDataPool();
}

async function query(text, values = []) {
    await sharedPoolConnect;
    return getDataPool().query(text, values);
}

async function closePools() {
    if (sharedPool) {
        await sharedPool.end().catch(() => {});
        sharedPool = null;
        sharedPoolConnect = null;
        platformPool = null;
        dataPool = null;
    }
}

module.exports = {
    initDb,
    closePools,
    getPool,
    getPlatformPool,
    getDataPool,
    query,
};
