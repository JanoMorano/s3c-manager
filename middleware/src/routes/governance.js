'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { canView, canEdit } = require('../middleware/rbac');
const repo = require('../db/governance.repo');
const audit = require('../db/audit.repo');
const { getServiceReadiness } = require('../services/readiness');
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

const REVIEW_STATUSES = new Set(['pending', 'in_review', 'approved', 'rejected', 'deferred', 'cancelled']);
const DECISIONS = new Set(['approved', 'rejected', 'deferred', 'cancelled']);
const DEFERRAL_DECISION_TYPES = new Set(['defer', 'deferral', 'risk_acceptance', 'waiver']);

function normalized(value) {
    return String(value ?? '').trim().toLowerCase();
}

function terminalCompletedAt(status, explicitValue) {
    if (explicitValue !== undefined) return explicitValue || null;
    return ['approved', 'rejected', 'deferred', 'cancelled'].includes(status) ? new Date().toISOString() : null;
}

function workflowFilters(req) {
    return {
        ...paging(req),
        serviceId: parseTextFilter(req.query.service_id || req.query.serviceId, { maxLength: 80 }),
        assignedTo: parseTextFilter(req.query.assigned_to || req.query.assignedTo, { maxLength: 255 }),
        status: parseCsvFilter(req.query.status, { allowed: [...REVIEW_STATUSES] }),
        decision: parseCsvFilter(req.query.decision, { allowed: [...DECISIONS] }),
        decisionType: parseTextFilter(req.query.decision_type || req.query.decisionType, { maxLength: 80 }),
    };
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

router.get('/reviews', async (req, res, next) => {
    try {
        sendItems(res, await repo.listReviews(workflowFilters(req)));
    } catch (err) { next(err); }
});

router.post('/reviews', canEdit, async (req, res, next) => {
    try {
        const serviceId = parseTextFilter(req.body?.service_id || req.body?.serviceId, { maxLength: 80 });
        const reviewType = parseTextFilter(req.body?.review_type || req.body?.reviewType, { maxLength: 80 });
        const status = normalized(req.body?.status || 'pending');
        if (!serviceId) return res.status(400).json({ error: 'service_id is required' });
        if (!reviewType) return res.status(400).json({ error: 'review_type is required' });
        if (!REVIEW_STATUSES.has(status)) return res.status(400).json({ error: 'Unsupported review status' });

        const item = await repo.createReview({
            service_id: serviceId,
            review_type: reviewType,
            status,
            requested_by: actorFrom(req),
            assigned_to: parseTextFilter(req.body?.assigned_to || req.body?.assignedTo, { maxLength: 255 }),
            due_at: req.body?.due_at || req.body?.dueAt || null,
        });

        await audit.log?.({
            tableName: 'GovernanceReview',
            recordId: item?.id ?? null,
            recordLabel: `${serviceId}:${reviewType}`,
            action: 'INSERT',
            newValues: item,
            performedBy: actorFrom(req),
            clientIp: req.ip,
            userAgent: req.get?.('user-agent'),
        });

        res.status(201).json({ item });
    } catch (err) { next(err); }
});

router.patch('/reviews/:id', canEdit, async (req, res, next) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid review id' });
        const updates = {};
        const status = req.body?.status != null ? normalized(req.body.status) : null;
        if (status) {
            if (!REVIEW_STATUSES.has(status)) return res.status(400).json({ error: 'Unsupported review status' });
            updates.status = status;
            updates.completed_at = terminalCompletedAt(status, req.body?.completed_at || req.body?.completedAt);
        }
        if (req.body?.assigned_to !== undefined || req.body?.assignedTo !== undefined) {
            updates.assigned_to = parseTextFilter(req.body?.assigned_to || req.body?.assignedTo, { maxLength: 255 });
        }
        if (req.body?.due_at !== undefined || req.body?.dueAt !== undefined) {
            updates.due_at = req.body?.due_at || req.body?.dueAt || null;
        }

        const item = await repo.updateReview(id, updates);
        await audit.log?.({
            tableName: 'GovernanceReview',
            recordId: id,
            recordLabel: item?.service_id ? `${item.service_id}:${item.review_type}` : String(id),
            action: 'UPDATE',
            newValues: item,
            changedFields: Object.keys(updates),
            performedBy: actorFrom(req),
            clientIp: req.ip,
            userAgent: req.get?.('user-agent'),
        });

        res.json({ item });
    } catch (err) { next(err); }
});

router.get('/decisions', async (req, res, next) => {
    try {
        sendItems(res, await repo.listDecisions(workflowFilters(req)));
    } catch (err) { next(err); }
});

router.post('/decisions', canEdit, async (req, res, next) => {
    try {
        const serviceId = parseTextFilter(req.body?.service_id || req.body?.serviceId, { maxLength: 80 });
        const decisionType = normalized(req.body?.decision_type || req.body?.decisionType);
        const decision = normalized(req.body?.decision);
        const rationale = parseTextFilter(req.body?.rationale, { maxLength: 4000 });
        if (!serviceId) return res.status(400).json({ error: 'service_id is required' });
        if (!decisionType) return res.status(400).json({ error: 'decision_type is required' });
        if (!DECISIONS.has(decision)) return res.status(400).json({ error: 'Unsupported decision' });
        if ((decision === 'rejected' || decision === 'deferred') && !rationale) {
            return res.status(400).json({ error: 'Rationale is required for rejected or deferred decisions' });
        }

        if (decision === 'approved' && !DEFERRAL_DECISION_TYPES.has(decisionType)) {
            const readiness = await getServiceReadiness(serviceId);
            if ((readiness?.blockers ?? []).length > 0) {
                return res.status(409).json({ error: 'Cannot approve while readiness blockers remain', blockers: readiness.blockers });
            }
        }

        const item = await repo.createDecision({
            service_id: serviceId,
            decision_type: decisionType,
            decision,
            rationale,
            decided_by: actorFrom(req),
            decided_at: req.body?.decided_at || req.body?.decidedAt || null,
        });

        await audit.log?.({
            tableName: 'GovernanceDecision',
            recordId: item?.id ?? null,
            recordLabel: `${serviceId}:${decisionType}`,
            action: 'INSERT',
            newValues: item,
            performedBy: actorFrom(req),
            clientIp: req.ip,
            userAgent: req.get?.('user-agent'),
        });

        res.status(201).json({ item });
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
