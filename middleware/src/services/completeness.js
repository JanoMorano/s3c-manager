'use strict';

/**
 * Keeps data.service_catalog.completeness_score in line with the scoring
 * function the service detail uses, so SQL-based views (list filters,
 * dashboard inbox, portfolio, stats) see the same number.
 */

const repo = require('../db/services.repo');
const flRepo = require('../db/flavours.repo');
const logger = require('../utils/logger');
const { serviceScore } = require('./scoring');

async function refreshServiceScore(serviceId) {
    const service = await repo.findByServiceId(serviceId);
    if (!service) return null;
    const flavours = await flRepo.findByService(serviceId).catch(() => []);
    const score = serviceScore(service, flavours);
    await repo.updateScore(serviceId, score);
    return score;
}

// Recomputes every service; meant for startup, runs sequentially to keep the
// pool free for requests.
async function refreshAllServiceScores() {
    const serviceIds = await repo.listActiveServiceIds();
    let updated = 0;
    for (const serviceId of serviceIds) {
        try {
            if (await refreshServiceScore(serviceId) != null) updated += 1;
        } catch (err) {
            logger.warn(`completeness refresh failed for ${serviceId}: ${err.message}`);
        }
    }
    return { total: serviceIds.length, updated };
}

// For write endpoints whose changes feed the score (roles, domains, SLA,
// flavours, C3 mappings, imports): a failed refresh is logged, never surfaced,
// and the next refresh repairs it.
async function refreshServiceScoreSafely(serviceId) {
    if (!serviceId) return;
    try {
        await refreshServiceScore(serviceId);
    } catch (err) {
        logger.warn(`completeness refresh failed for ${serviceId}: ${err.message}`);
    }
}

module.exports = {
    refreshServiceScore,
    refreshAllServiceScores,
    refreshServiceScoreSafely,
};
