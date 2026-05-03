'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { canView } = require('../middleware/rbac');
const repo = require('../db/relations.repo');
const { parseCsvFilter, parseTextFilter, parseIntFilter } = require('../utils/query-filters');

const router = express.Router();

const DIRECTIONS = new Set(['downstream', 'upstream']);
const INCLUDE_VALUES = [
    'all',
    'services',
    'capabilities',
    'c3',
    'applications',
    'data_objects',
    'tins',
    'c3_services',
];

router.use(requireAuth, canView);

function parseOptions(req, res) {
    const direction = parseTextFilter(req.query.direction, { maxLength: 20 }) || 'downstream';
    if (!DIRECTIONS.has(direction)) {
        res.status(400).json({ error: 'direction must be downstream or upstream' });
        return null;
    }

    return {
        direction,
        depth: parseIntFilter(req.query.depth, { fallback: 3, min: 1, max: 10 }),
        include: parseCsvFilter(req.query.include, { maxItems: 12, allowed: INCLUDE_VALUES }),
    };
}

router.get('/services/:id', async (req, res, next) => {
    try {
        const options = parseOptions(req, res);
        if (!options) return;
        const serviceId = parseTextFilter(req.params.id, { maxLength: 120 });
        if (!serviceId) return res.status(400).json({ error: 'service id is required' });
        res.json(await repo.getServiceImpact(serviceId, options));
    } catch (err) { next(err); }
});

router.get('/capabilities/:id', async (req, res, next) => {
    try {
        const options = parseOptions(req, res);
        if (!options) return;
        const capabilityId = parseTextFilter(req.params.id, { maxLength: 120 });
        if (!capabilityId) return res.status(400).json({ error: 'capability id is required' });
        res.json(await repo.getCapabilityImpact(capabilityId, options));
    } catch (err) { next(err); }
});

module.exports = router;
