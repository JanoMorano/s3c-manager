'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { canView, canEdit } = require('../middleware/rbac');
const readinessRepo = require('../db/readiness.repo');
const audit = require('../db/audit.repo');
const {
    getServiceReadiness,
    getReadinessSummary,
} = require('../services/readiness');
const { parseIntFilter, parseTextFilter } = require('../utils/query-filters');

const router = express.Router();

router.use(requireAuth, canView);

function actorFrom(req) {
    return req.user?.email || req.user?.username || req.user?.display_name || 'unknown';
}

router.get('/services/:id', async (req, res, next) => {
    try {
        const readiness = await getServiceReadiness(req.params.id);
        if (!readiness) return res.status(404).json({ error: 'Služba nenalezena' });
        res.json(readiness);
    } catch (err) { next(err); }
});

router.get('/summary', async (req, res, next) => {
    try {
        const summary = await getReadinessSummary({
            limit: parseIntFilter(req.query.limit, { fallback: 100, min: 1, max: 500 }),
            offset: parseIntFilter(req.query.offset, { fallback: 0, min: 0, max: 100000 }),
            lifecycle: parseTextFilter(req.query.lifecycle, { maxLength: 80 }),
            owner: parseTextFilter(req.query.owner, { maxLength: 255 }),
        });
        res.json(summary);
    } catch (err) { next(err); }
});

router.post('/services/:id/exceptions', canEdit, async (req, res, next) => {
    try {
        const ruleKey = parseTextFilter(req.body?.rule_key || req.body?.ruleKey, { maxLength: 120 });
        const reason = parseTextFilter(req.body?.reason, { maxLength: 1000 });
        if (!ruleKey) return res.status(400).json({ error: 'rule_key is required' });
        if (!reason) return res.status(400).json({ error: 'reason is required' });

        const item = await readinessRepo.createException(req.params.id, ruleKey, {
            reason,
            expires_at: req.body?.expires_at || req.body?.expiresAt || null,
            approved_by: actorFrom(req),
        });

        await audit.log?.({
            tableName: 'ReadinessException',
            recordId: item?.id ?? null,
            recordLabel: `${req.params.id}:${ruleKey}`,
            action: 'INSERT',
            newValues: item,
            performedBy: actorFrom(req),
            clientIp: req.ip,
        });

        res.status(201).json({ item });
    } catch (err) { next(err); }
});

router.delete('/services/:id/exceptions/:ruleKey', canEdit, async (req, res, next) => {
    try {
        const removed = await readinessRepo.deleteException(req.params.id, req.params.ruleKey);

        await audit.log?.({
            tableName: 'ReadinessException',
            recordId: null,
            recordLabel: `${req.params.id}:${req.params.ruleKey}`,
            action: 'DELETE',
            performedBy: actorFrom(req),
            clientIp: req.ip,
        });

        res.json({ removed });
    } catch (err) { next(err); }
});

module.exports = router;
