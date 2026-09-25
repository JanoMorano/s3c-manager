'use strict';

/** Service list, CSV export and catalogue quality summary. */

const express = require('express');
const repo = require('../../db/services.repo');
const audit = require('../../db/audit.repo');
const { canEdit } = require('../../middleware/rbac');
const { _csvEscapeCell } = require('./shared');

const router = express.Router();

// ─── GET /services ────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
    try {
        const { page = 1, limit = 50, search, sort, order, owner } = req.query;
        const status = Array.isArray(req.query.status) ? req.query.status.join(',') : req.query.status;
        const serviceType = Array.isArray(req.query.service_type) ? req.query.service_type.join(',') : req.query.service_type;
        const portfolioGroup = req.query.portfolio_group || req.query.portfolioGroup || undefined;
        const portfolioCode = req.query.portfolio_code || req.query.portfolioCode || undefined;
        const domain = req.query.domain || undefined;
        const lifecycleState = req.query.lifecycle_state || undefined;
        const lifecycleStageCode = req.query.lifecycle_stage_code || req.query.lifecycleStageCode || undefined;
        const criticalityCode = req.query.criticality_code || req.query.criticalityCode || undefined;
        const reviewDue = req.query.review_due || req.query.reviewDue || undefined;
        const readiness = req.query.readiness || undefined;
        const requestable = req.query.requestable ?? undefined;
        const result = await repo.findAllDirect({
            page:        Math.max(1, parseInt(page)),
            limit:       Math.min(200, Math.max(1, parseInt(limit))),
            status,
            serviceType,
            portfolioGroup,
            portfolioCode,
            domain,
            search,
            sort,
            order,
            ownerName:   owner || undefined,
            lifecycleState,
            lifecycleStageCode,
            criticalityCode,
            reviewDue,
            readiness,
            requestable,
        });
        res.set('X-Total-Count', result.total)
           .set('X-Page', result.page)
           .set('X-Per-Page', result.limit)
           .json(result);
    } catch (err) { next(err); }
});

// ─── GET /services/export/csv ────────────────────────────────────────────────
router.get('/export/csv', canEdit, async (req, res, next) => {
    try {
        const search = req.query.search;
        const status = Array.isArray(req.query.status) ? req.query.status.join(',') : req.query.status;
        const serviceType = Array.isArray(req.query.service_type) ? req.query.service_type.join(',') : req.query.service_type;
        const portfolioGroup = req.query.portfolio_group || req.query.portfolioGroup || undefined;
        const portfolioCode = req.query.portfolio_code || req.query.portfolioCode || undefined;
        const domain = req.query.domain || undefined;
        const sort = req.query.sort;
        const order = req.query.order;
        const owner = req.query.owner;
        const lifecycleState = req.query.lifecycle_state || undefined;
        const lifecycleStageCode = req.query.lifecycle_stage_code || req.query.lifecycleStageCode || undefined;
        const criticalityCode = req.query.criticality_code || req.query.criticalityCode || undefined;
        const reviewDue = req.query.review_due || req.query.reviewDue || undefined;
        const readiness = req.query.readiness || undefined;
        const requestable = req.query.requestable ?? undefined;

        const result = await repo.findAllDirect({
            page: 1,
            limit: 100000,
            status,
            serviceType,
            portfolioGroup,
            portfolioCode,
            domain,
            search,
            sort,
            order,
            ownerName: owner || undefined,
            lifecycleState,
            lifecycleStageCode,
            criticalityCode,
            reviewDue,
            readiness,
            requestable,
        });

        const rows = [
            ['service_id', 'title', 'service_type', 'service_status', 'portfolio_group', 'service_owner', 'vlastnik', 'manager', 'available_on', 'sla_availability', 'updated_at'],
            ...result.items.map((item) => [
                item.service_id,
                item.title,
                item.service_type ?? '',
                item.service_status ?? '',
                item.portfolio_group ?? '',
                item.service_owner ?? '',
                item.vlastnik ?? '',
                item.manager ?? '',
                item.available_on ?? '',
                item.sla_availability ?? '',
                item.updated_at ?? '',
            ]),
        ];

        const csv = rows.map((row) => row.map(_csvEscapeCell).join(',')).join('\n');
        await audit.log?.({
            tableName: 'ServiceCatalog',
            recordId: null,
            recordLabel: 'filtered-csv',
            action: 'EXPORT_CSV',
            newValues: {
                filters: {
                    search,
                    status,
                    service_type: serviceType,
                    portfolio_group: portfolioGroup,
                    portfolio_code: portfolioCode,
                    domain,
                    owner,
                    lifecycle_state: lifecycleState,
                    review_due: reviewDue,
                    readiness,
                    requestable,
                },
                row_count: result.items.length,
                request_id: req.id || null,
            },
            performedBy: req.user?.username || 'system',
            clientIp: req.ip,
            userAgent: req.get('user-agent') || null,
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="service-catalogue-export.csv"');
        res.send(csv);
    } catch (err) { next(err); }
});

// ─── GET /services/catalog-quality ───────────────────────────────────────────
router.get('/catalog-quality', async (req, res, next) => {
    try {
        const summary = await repo.getCatalogQualitySummary();
        res.json({
            generated_at: new Date().toISOString(),
            item: summary,
        });
    } catch (err) { next(err); }
});

module.exports = router;
