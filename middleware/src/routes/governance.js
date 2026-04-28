'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { canView, canEdit } = require('../middleware/rbac');
const repo = require('../db/governance.repo');
const { parseCsvFilter, parseTextFilter, parseIntFilter } = require('../utils/query-filters');

const router = express.Router();

router.use(requireAuth, canView);

function paging(req) {
    return {
        limit: parseIntFilter(req.query.limit, { fallback: 50, min: 1, max: 500 }),
        offset: parseIntFilter(req.query.offset, { fallback: 0, min: 0, max: 100000 }),
    };
}

function sendItems(res, items) {
    res.json({ items, count: items.length });
}

function actorFrom(req) {
    return req.user?.email || req.user?.username || req.user?.display_name || 'unknown';
}

router.get('/risk-radar', async (req, res, next) => {
    try {
        const items = await repo.listServiceRisks({
            ...paging(req),
            severity: parseCsvFilter(req.query.severity, { allowed: ['P0', 'P1', 'P2', 'info'] }),
            ruleCode: parseTextFilter(req.query.rule_code || req.query.ruleCode, { maxLength: 80 }),
            serviceId: parseTextFilter(req.query.service_id || req.query.serviceId, { maxLength: 80 }),
            q: parseTextFilter(req.query.q, { maxLength: 120 }),
        });
        sendItems(res, items);
    } catch (err) { next(err); }
});

router.get('/owner-load', async (req, res, next) => {
    try {
        const items = await repo.listOwnerLoad({
            ...paging(req),
            owner: parseTextFilter(req.query.owner, { maxLength: 255 }),
            minScore: req.query.min_score ?? req.query.minScore ?? null,
        });
        sendItems(res, items);
    } catch (err) { next(err); }
});

router.get('/owner-load/assignments', async (req, res, next) => {
    try {
        const owner = parseTextFilter(req.query.owner, { maxLength: 255 });
        if (!owner) {
            return res.status(400).json({ error: 'owner query parameter is required' });
        }
        const items = await repo.listOwnerAssignments({
            ...paging(req),
            owner,
        });
        sendItems(res, items);
    } catch (err) { next(err); }
});

router.get('/contract-overlap', async (req, res, next) => {
    try {
        const items = await repo.listContractOverlap({
            ...paging(req),
            scope: parseTextFilter(req.query.scope, { maxLength: 80 }),
            key: parseTextFilter(req.query.key, { maxLength: 255 }),
        });
        sendItems(res, items);
    } catch (err) { next(err); }
});

router.get('/renewal-calendar', async (req, res, next) => {
    try {
        const items = await repo.listRenewalRisks({
            ...paging(req),
            horizonDays: req.query.horizon_days ?? req.query.horizonDays ?? null,
            vendor: parseTextFilter(req.query.vendor, { maxLength: 255 }),
        });
        sendItems(res, items);
    } catch (err) { next(err); }
});

router.get('/advisor', async (req, res, next) => {
    try {
        const items = await repo.listAdvisorFindings({
            ...paging(req),
            severity: parseCsvFilter(req.query.severity, { allowed: ['P0', 'P1', 'P2', 'info'] }),
            findingType: parseCsvFilter(req.query.type || req.query.finding_type || req.query.findingType, {
                allowed: ['risk', 'owner_load', 'contract_overlap', 'renewal', 'advisor'],
            }),
            q: parseTextFilter(req.query.q, { maxLength: 120 }),
        });
        sendItems(res, items);
    } catch (err) { next(err); }
});

router.post('/findings/:id/dismiss', canEdit, async (req, res, next) => {
    try {
        const reason = parseTextFilter(req.body?.reason, { maxLength: 1000 });
        if (!reason) {
            return res.status(400).json({ error: 'Dismissal reason is required' });
        }

        const item = await repo.dismissFinding({
            findingId: req.params.id,
            reason,
            actor: actorFrom(req),
        });
        res.json({ item });
    } catch (err) { next(err); }
});

module.exports = router;
