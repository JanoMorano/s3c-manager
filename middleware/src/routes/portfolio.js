'use strict';

const express = require('express');
const repo = require('../db/portfolio.repo');
const audit = require('../db/audit.repo');
const { requireAuth } = require('../middleware/auth');
const { canView, canEdit } = require('../middleware/rbac');

const router = express.Router();

router.use(requireAuth, canView);

function actorFrom(req) {
    return req.user?.email || req.user?.username || req.user?.display_name || 'unknown';
}

function toInteger(value) {
    if (value == null || value === '') return null;
    const parsed = parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
    if (value == null) return null;
    const normalized = String(value).trim();
    return normalized || null;
}

function normalizeBody(body, { partial = false } = {}) {
    const normalized = {
        portfolio_code: normalizeText(body?.portfolio_code ?? body?.portfolioCode),
        title: normalizeText(body?.title),
        description: normalizeText(body?.description),
        status_code: normalizeText(body?.status_code ?? body?.statusCode) || (partial ? undefined : 'active'),
        owner_group_id: toInteger(body?.owner_group_id ?? body?.ownerGroupId),
    };

    if (partial) {
        for (const key of Object.keys(normalized)) {
            if (normalized[key] === undefined || normalized[key] === null) delete normalized[key];
        }
    }

    return normalized;
}

function validateCreatePayload(data) {
    const errors = [];
    if (!data.portfolio_code) errors.push({ field: 'portfolio_code', message: 'portfolio_code is required' });
    if (!data.title) errors.push({ field: 'title', message: 'title is required' });
    if (data.portfolio_code && !/^[A-Za-z0-9_.-]{2,100}$/.test(data.portfolio_code)) {
        errors.push({ field: 'portfolio_code', message: 'portfolio_code must be 2-100 characters using letters, numbers, dot, underscore, or dash' });
    }
    return errors;
}

function dbErrorStatus(err) {
    if (err?.code === '23505') return 409;
    if (err?.code === '23503' || err?.code === '23514') return 422;
    return 500;
}

function dbErrorPayload(err, fallbackMessage) {
    if (err?.code === '23505') return { error: 'Portfolio already exists', detail: err.detail || fallbackMessage };
    if (err?.code === '23503') return { error: 'Invalid referenced record', detail: err.detail || fallbackMessage };
    if (err?.code === '23514') return { error: 'Invalid portfolio record', detail: err.detail || fallbackMessage };
    return { error: fallbackMessage };
}

router.get('/', async (req, res, next) => {
    try {
        const items = await repo.list({
            status: req.query.status,
            ownerGroupId: toInteger(req.query.owner_group_id ?? req.query.ownerGroupId),
            lifecycle: req.query.lifecycle,
        });
        res.json({ items, count: items.length });
    } catch (err) { next(err); }
});

router.get('/services', async (req, res, next) => {
    try {
        const result = await repo.listServices({
            filter: req.query.filter,
        });
        res.json(result);
    } catch (err) { next(err); }
});

router.get('/capabilities', async (req, res, next) => {
    try {
        const items = await repo.listCapabilities();
        res.json({ items, count: items.length });
    } catch (err) { next(err); }
});

router.get('/:code', async (req, res, next) => {
    try {
        const item = await repo.getByCode(req.params.code);
        if (!item) return res.status(404).json({ error: 'Portfolio not found' });
        res.json({ item });
    } catch (err) { next(err); }
});

router.post('/', canEdit, async (req, res, next) => {
    try {
        const data = normalizeBody(req.body);
        const errors = validateCreatePayload(data);
        if (errors.length) return res.status(422).json({ errors });

        const item = await repo.create(data);
        await audit.log({
            tableName: 'ServicePortfolio',
            recordId: item?.id,
            recordLabel: item?.portfolio_code || data.portfolio_code,
            action: 'INSERT',
            newValues: item,
            performedBy: actorFrom(req),
            clientIp: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(201).json({ item });
    } catch (err) {
        const status = dbErrorStatus(err);
        if (status !== 500) return res.status(status).json(dbErrorPayload(err, 'Portfolio create failed'));
        next(err);
    }
});

router.patch('/:code', canEdit, async (req, res, next) => {
    try {
        const data = normalizeBody(req.body, { partial: true });
        const item = await repo.update(req.params.code, data);
        if (!item) return res.status(404).json({ error: 'Portfolio not found' });
        await audit.log({
            tableName: 'ServicePortfolio',
            recordId: item.id,
            recordLabel: item.portfolio_code,
            action: 'UPDATE',
            newValues: item,
            changedFields: Object.keys(data),
            performedBy: actorFrom(req),
            clientIp: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.json({ item });
    } catch (err) {
        const status = dbErrorStatus(err);
        if (status !== 500) return res.status(status).json(dbErrorPayload(err, 'Portfolio update failed'));
        next(err);
    }
});

module.exports = router;
