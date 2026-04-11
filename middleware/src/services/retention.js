'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const { getPool } = require('../db/pool');

let timer = null;
let running = false;

async function touchHeartbeat({
    status = 'idle',
    lastRunStartedAt = null,
    lastRunCompletedAt = null,
    lastJobStatus = null,
    lastErrorMessage = null,
} = {}) {
    await getPool().query(`
        SELECT data.upsert_retention_runner_heartbeat($1, $2, $3, $4, $5, $6, $7)
    `, [
        config.retention.runnerName,
        config.retention.runnerKind,
        status,
        lastRunStartedAt,
        lastRunCompletedAt,
        lastJobStatus,
        lastErrorMessage,
    ]);
}

async function runRetentionCycle(triggerSource = 'app-inline') {
    if (!config.retention.enabled || running) return null;

    const startedAt = new Date();
    running = true;

    try {
        await touchHeartbeat({
            status: 'running',
            lastRunStartedAt: startedAt,
            lastErrorMessage: null,
        });

        const result = await getPool().query(`
            SELECT *
            FROM data.run_retention_purge($1)
        `, [`${triggerSource}:${config.retention.runnerName}`]);

        const summary = result.rows[0] ?? null;
        const finishedAt = summary?.completed_at ?? new Date();
        const jobStatus = summary?.status ?? 'success';
        const jobError = summary?.error_message ?? null;

        await touchHeartbeat({
            status: jobStatus === 'failed' ? 'failed' : 'idle',
            lastRunStartedAt: summary?.started_at ?? startedAt,
            lastRunCompletedAt: finishedAt,
            lastJobStatus: jobStatus,
            lastErrorMessage: jobError,
        });

        if (jobStatus === 'failed') {
            logger.error(`Retention purge failed: ${jobError || 'unknown error'}`);
        } else if (jobStatus !== 'skipped') {
            logger.info(`Retention purge completed: issues=${summary?.deleted_import_issue ?? 0}, rows=${summary?.deleted_import_row ?? 0}, batches=${summary?.deleted_import_batch ?? 0}`);
        }

        return summary;
    } catch (err) {
        const finishedAt = new Date();
        try {
            await touchHeartbeat({
                status: 'failed',
                lastRunStartedAt: startedAt,
                lastRunCompletedAt: finishedAt,
                lastJobStatus: 'failed',
                lastErrorMessage: err.message,
            });
        } catch (heartbeatErr) {
            logger.error(`Retention heartbeat update failed: ${heartbeatErr.message}`);
        }
        logger.error(`Retention scheduler error: ${err.message}`);
        return null;
    } finally {
        running = false;
    }
}

function scheduleNextRun() {
    if (!config.retention.enabled) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
        await runRetentionCycle('scheduled');
        scheduleNextRun();
    }, Math.max(1, config.retention.purgeIntervalSeconds) * 1000);
}

async function startRetentionScheduler() {
    if (!config.retention.enabled) {
        logger.info('Retention scheduler disabled');
        return;
    }

    await touchHeartbeat({
        status: 'idle',
        lastErrorMessage: null,
    });
    await runRetentionCycle('startup');
    scheduleNextRun();
}

async function stopRetentionScheduler() {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
    if (!config.retention.enabled) return;

    try {
        await touchHeartbeat({
            status: 'stopped',
            lastJobStatus: 'stopped',
            lastErrorMessage: null,
        });
    } catch (err) {
        logger.error(`Retention scheduler shutdown heartbeat failed: ${err.message}`);
    }
}

module.exports = {
    startRetentionScheduler,
    stopRetentionScheduler,
    runRetentionCycle,
};
