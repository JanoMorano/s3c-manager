'use strict';
const express = require('express');
const repo    = require('../db/services.repo');
const flRepo  = require('../db/flavours.repo');
const relRepo = require('../db/relations.repo');
const offeringsRepo = require('../db/offerings.repo');
const supportModelRepo = require('../db/support-model.repo');
const audienceRepo = require('../db/audience.repo');
const operationalLinksRepo = require('../db/operational-links.repo');
const serviceOverviewRepo = require('../db/service-overview.repo');
const audit   = require('../db/audit.repo');
const { requireAuth } = require('../middleware/auth');
const { canEdit, canAdmin } = require('../middleware/rbac');
const { isModuleApiEnabled } = require('../middleware/module-gates');
const {
    validateCreate,
    validateUpdate,
    validateOffering,
    validateSupportModel,
    validateAudiencePolicy,
    validateOperationalLink,
    validateLifecycleOperationalReadiness,
} = require('../services/validation');
const {
    getServiceReadiness,
} = require('../services/readiness');
const { serviceScore, serviceScoreDetailed } = require('../services/scoring');
const { getPool } = require('../db/pool');
const { listLevel3Capabilities } = require('../utils/capability-slug');
const logger = require('../utils/logger');

const router = express.Router();
router.use(requireAuth);

// ─── Body normalizer ──────────────────────────────────────────────────────────
// Maps camelCase frontend DTO keys → snake_case repo keys.
// Backwards-compatible: if body already uses snake_case those values are preserved.
// If both forms are present the snake_case value wins.
//
// camelCase  →  snake_case
// ─────────────────────────────────────────────────────────────────────────────
const _CAMEL_TO_SNAKE = {
    localId:                'source_local_id',
    spId:                   'source_sp_id',
    etag:                   'source_etag',
    serviceId:              'service_id',
    portfolioGroup:         'portfolio_group_code',
    serviceType:            'service_type',
    serviceOwner:           'service_owner',
    serviceStatus:          'service_status',
    catalogueVersion:       'catalogue_version',
    valueProposition:       'value_proposition',
    serviceFeatures:        'service_features',
    detailedDescription:    'description',
    unitOfMeasure:          'unit_of_measure',
    chargingBasis:          'charging_basis',
    rateNote:               'rate_note',
    orderingNote:           'ordering_note',
    serviceArea:            'service_area_raw',
    securityClassification: 'security_classification',
    availableOn:            'available_on',
    customerType:           'customer_type',
    sourceUrl:              'service_url',
    slaAvailability:        'sla_availability',
    slaRestoration:         'sla_restoration',
    slaDelivery:            'sla_delivery',
    graphX:                 'graph_x',
    graphY:                 'graph_y',
    prerequisites:          'prerequisites_json',
    dependencies:           'dependencies_json',
    trainingRefs:           'training_refs',
    retiredNote:            'retired_note',
    shortDescription:       'short_description',
    cpServiceTypeRaw:       'cp_service_type_raw',
    isAvailableStatusAmbiguous: 'is_available_status_ambiguous',
    c3Uuid:                 'c3_uuid',
    c3ParentId:             'c3_parent_id',
    c3Level:                'c3_level',
    c3Domain:               'c3_domain',
    c3Source:               'c3_source',
    c3Reference:            'c3_reference',
    c3SyncedAt:             'c3_synced_at',
    c3SyncStatus:           'c3_sync_status',
    c3MappingSpId:          'c3_mapping_sp_id',
    c3MappingEtag:          'c3_mapping_etag',
    businessSummary:        'business_summary',
    requestable:            'requestable',
    lifecycleState:         'lifecycle_state',
    targetAudienceSummary:  'target_audience_summary',
    requestChannelType:     'request_channel_type',
    requestChannelUrl:      'request_channel_url',
    approvalRequired:       'approval_required',
    fulfillmentLeadTimeText:'fulfillment_lead_time_text',
    reviewOwnerUserId:      'review_owner_user_id',
    nextReviewDueAt:        'next_review_due_at',
};

/**
 * Translate a request body from camelCase DTO shape to snake_case repo shape.
 * Idempotent — safe to call on bodies that are already snake_case.
 * @param {Object} body — req.body (not mutated)
 * @returns {Object}    — new object with snake_case keys
 */
function _normalizeBody(body) {
    if (!body || typeof body !== 'object') return body || {};
    // Clone so we never mutate req.body
    const out = { ...body };
    for (const [camel, snake] of Object.entries(_CAMEL_TO_SNAKE)) {
        if (camel === snake) continue;
        if (camel in out) {
            // snake_case wins if the original body already supplied it
            if (!(snake in body)) out[snake] = out[camel];
            delete out[camel];
        }
    }
    // Normalize _code suffix aliases — frontend may send service_type_code / service_status_code
    if (!out.service_type  && out.service_type_code)  out.service_type  = out.service_type_code;
    if (!out.service_status && out.service_status_code) out.service_status = out.service_status_code;
    return out;
}

function _csvEscapeCell(value) {
    const normalized = String(value ?? '')
        .replace(/\r\n|\r|\n/g, ' ')
        .replace(/^\s*([=+\-@])/, "'$1")
        .replace(/"/g, '""');
    return `"${normalized}"`;
}

function _normalizeOfferingBody(body) {
    const normalized = _normalizeBody(body);
    return {
        ...normalized,
        offering_code: normalized.offering_code ?? normalized.offeringCode ?? null,
        is_default: normalized.is_default ?? normalized.isDefault,
        approval_required: normalized.approval_required ?? normalized.approvalRequired,
        request_channel_type: normalized.request_channel_type ?? normalized.requestChannelType ?? null,
        request_channel_url: normalized.request_channel_url ?? normalized.requestChannelUrl ?? null,
        lead_time_text: normalized.lead_time_text ?? normalized.leadTimeText ?? null,
        support_tier_code: normalized.support_tier_code ?? normalized.supportTierCode ?? null,
        display_order: normalized.display_order ?? normalized.displayOrder ?? null,
    };
}

function _normalizeSupportModelItem(item) {
    return {
        offering_id: item.offering_id ?? item.offeringId ?? null,
        support_owner_name: item.support_owner_name ?? item.supportOwnerName ?? null,
        resolver_group: item.resolver_group ?? item.resolverGroup ?? null,
        support_hours_code: item.support_hours_code ?? item.supportHoursCode ?? null,
        support_channel: item.support_channel ?? item.supportChannel ?? null,
        escalation_path: item.escalation_path ?? item.escalationPath ?? null,
        maintenance_window: item.maintenance_window ?? item.maintenanceWindow ?? null,
        review_cadence: item.review_cadence ?? item.reviewCadence ?? null,
    };
}

function _normalizeAudienceItem(item) {
    return {
        offering_id: item.offering_id ?? item.offeringId ?? null,
        audience_type: item.audience_type ?? item.audienceType ?? null,
        business_unit: item.business_unit ?? item.businessUnit ?? null,
        region_code: item.region_code ?? item.regionCode ?? null,
        eligibility_rule: item.eligibility_rule ?? item.eligibilityRule ?? null,
        notes: item.notes ?? null,
    };
}

function _normalizeOperationalLinkBody(body) {
    return {
        offering_id: body.offering_id ?? body.offeringId ?? null,
        link_type: body.link_type ?? body.linkType ?? null,
        title: body.title ?? null,
        url: body.url ?? null,
        sort_order: body.sort_order ?? body.sortOrder ?? null,
    };
}

function _normalizeCollectionBody(body, itemNormalizer) {
    const rawItems = Array.isArray(body)
        ? body
        : Array.isArray(body?.items)
            ? body.items
            : (body && typeof body === 'object' && Object.keys(body).length > 0 ? [body] : []);
    return rawItems.map((item) => itemNormalizer(item || {}));
}

function _dbErrorStatus(err) {
    if (err?.code === '23505') return 409;
    if (err?.code === '23503' || err?.code === '23514') return 422;
    return 500;
}

function _dbErrorPayload(err, fallbackMessage) {
    if (err?.code === '23505') return { error: 'Záznam porušuje unikátní omezení', detail: err.detail || fallbackMessage };
    if (err?.code === '23503') return { error: 'Neplatná reference na navázaný záznam', detail: err.detail || fallbackMessage };
    if (err?.code === '23514') return { error: 'Záznam porušuje databázové validační omezení', detail: err.detail || fallbackMessage };
    return { error: fallbackMessage };
}

async function _resolveCatalogIdOr404(serviceId, res) {
    const catalogId = await repo.getCatalogId(serviceId);
    if (!catalogId) {
        res.status(404).json({ error: 'Služba nenalezena' });
        return null;
    }
    return catalogId;
}

async function _validateOfferingOwnership(catalogId, offeringId) {
    if (offeringId == null || offeringId === '') return true;
    const offering = await offeringsRepo.findById(parseInt(offeringId, 10), catalogId);
    return !!offering;
}

async function _validateLiveReadiness(catalogId, existing, body) {
    const merged = { ...existing, ...body };
    if (merged.lifecycle_state !== 'live') return [];

    const [offerings, supportModels] = await Promise.all([
        offeringsRepo.listByService(catalogId),
        supportModelRepo.listByService(catalogId),
    ]);

    return validateLifecycleOperationalReadiness(merged, {
        offeringCount: offerings.length,
        supportModelCount: supportModels.length,
    });
}

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
            requestable,
        });
        res.set('X-Total-Count', result.total)
           .set('X-Page', result.page)
           .set('X-Per-Page', result.limit)
           .json(result);
    } catch (err) { next(err); }
});

// ─── GET /services/export/csv ────────────────────────────────────────────────
router.get('/export/csv', async (req, res, next) => {
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
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="service-catalogue-export.csv"');
        res.send(csv);
    } catch (err) { next(err); }
});

// ─── GET /services/:id/overview ──────────────────────────────────────────────
router.get('/:id/overview', async (req, res, next) => {
    try {
        const item = await serviceOverviewRepo.getServiceOverview(req.params.id);
        if (!item) return res.status(404).json({ error: 'Služba nenalezena' });
        res.json({ item });
    } catch (err) { next(err); }
});

// ─── GET /services/:id ────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
    try {
        const serviceId = req.params.id;

        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const catalogId = svc.id;
        const offerings = await offeringsRepo.listByService(catalogId);
        const supportModel = await supportModelRepo.listByService(catalogId);
        const audiencePolicies = await audienceRepo.listByService(catalogId);
        const operationalLinks = await operationalLinksRepo.listByService(catalogId);
        const flavours = await flRepo.findByService(serviceId);
        const relations = await relRepo.findByService(serviceId);
        const score = serviceScore(svc, flavours);
        const primaryOffering = offerings.find((item) => item.is_default) || offerings[0] || null;

        const businessView = {
            business_summary: svc.business_summary ?? svc.summary ?? null,
            consumer_value: svc.consumer_value ?? null,
            requestable: svc.requestable,
            lifecycle_state: svc.lifecycle_state,
            target_audience_summary: svc.target_audience_summary,
            request_channel_type: svc.request_channel_type,
            request_channel_url: svc.request_channel_url,
            approval_required: svc.approval_required,
            fulfillment_lead_time_text: svc.fulfillment_lead_time_text,
            primary_offering: primaryOffering,
            support_model: supportModel,
            audience_policies: audiencePolicies,
            operational_links: operationalLinks,
        };

        const technicalView = {
            service_type: svc.service_type,
            service_status: svc.service_status,
            completeness_score: score,
            relation_count: svc.relation_count,
            flavour_count: svc.flavour_count,
            has_c3_mapping: Boolean(svc.c3_uuid),
            has_primary_offering: Boolean(primaryOffering),
        };

        res.json({
            ...svc,
            completeness_score: score,
            flavours,
            relations,
            offerings,
            primary_offering: primaryOffering,
            support_model: supportModel,
            audience_policies: audiencePolicies,
            operational_links: operationalLinks,
            business_view: businessView,
            technical_view: technicalView,
        });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/offerings ─────────────────────────────────────────────
router.get('/:id/offerings', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const items = await offeringsRepo.listByService(catalogId);
        res.json({ items });
    } catch (err) { next(err); }
});

// ─── POST /services/:id/offerings ────────────────────────────────────────────
router.post('/:id/offerings', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const body = _normalizeOfferingBody(req.body || {});
        const errors = validateOffering(body, { isCreate: true });
        if (errors.length) return res.status(422).json({ errors });

        try {
            const item = await offeringsRepo.create(catalogId, body);
            await audit.log?.({
                tableName: 'ServiceOffering',
                recordId: item.id,
                recordLabel: `${serviceId}:${item.offering_code}`,
                action: 'INSERT',
                newValues: body,
                performedBy: req.user.username,
                clientIp: req.ip,
            });
            res.status(201).json(item);
        } catch (err) {
            return res.status(_dbErrorStatus(err)).json(_dbErrorPayload(err, 'Offering se nepodařilo vytvořit'));
        }
    } catch (err) { next(err); }
});

// ─── PUT /services/:id/offerings/:offeringId ─────────────────────────────────
router.put('/:id/offerings/:offeringId', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const offeringId = parseInt(req.params.offeringId, 10);
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const existing = await offeringsRepo.findById(offeringId, catalogId);
        if (!existing) return res.status(404).json({ error: 'Offering nenalezen' });

        const body = _normalizeOfferingBody(req.body || {});
        const errors = validateOffering(body, { isCreate: false, existing });
        if (errors.length) return res.status(422).json({ errors });

        try {
            const item = await offeringsRepo.update(offeringId, catalogId, body);
            await audit.log?.({
                tableName: 'ServiceOffering',
                recordId: offeringId,
                recordLabel: `${serviceId}:${existing.offering_code}`,
                action: 'UPDATE',
                newValues: body,
                performedBy: req.user.username,
                clientIp: req.ip,
            });
            res.json(item);
        } catch (err) {
            return res.status(_dbErrorStatus(err)).json(_dbErrorPayload(err, 'Offering se nepodařilo upravit'));
        }
    } catch (err) { next(err); }
});

// ─── DELETE /services/:id/offerings/:offeringId ──────────────────────────────
router.delete('/:id/offerings/:offeringId', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const offeringId = parseInt(req.params.offeringId, 10);
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const existing = await offeringsRepo.findById(offeringId, catalogId);
        if (!existing) return res.status(404).json({ error: 'Offering nenalezen' });

        const removed = await offeringsRepo.remove(offeringId, catalogId);
        if (!removed) return res.status(404).json({ error: 'Offering nenalezen' });

        await audit.log?.({
            tableName: 'ServiceOffering',
            recordId: offeringId,
            recordLabel: `${serviceId}:${existing.offering_code}`,
            action: 'DELETE',
            performedBy: req.user.username,
            clientIp: req.ip,
        });
        res.json({ message: `Offering '${existing.offering_code}' smazán` });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/support-model ─────────────────────────────────────────
router.get('/:id/support-model', async (req, res, next) => {
    try {
        const catalogId = await _resolveCatalogIdOr404(req.params.id, res);
        if (!catalogId) return;
        const items = await supportModelRepo.listByService(catalogId);
        res.json({ items });
    } catch (err) { next(err); }
});

// ─── PUT /services/:id/support-model ─────────────────────────────────────────
router.put('/:id/support-model', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const items = _normalizeCollectionBody(req.body, _normalizeSupportModelItem);
        const errors = validateSupportModel(items);
        for (let index = 0; index < items.length; index += 1) {
            if (!(await _validateOfferingOwnership(catalogId, items[index].offering_id))) {
                errors.push({ field: `items[${index}].offering_id`, message: 'Offering nepatří k vybrané službě' });
            }
        }
        if (errors.length) return res.status(422).json({ errors });

        try {
            const saved = await supportModelRepo.replaceForService(catalogId, items);
            await audit.log?.({
                tableName: 'ServiceSupportModel',
                recordId: null,
                recordLabel: serviceId,
                action: 'UPDATE',
                newValues: { items },
                performedBy: req.user.username,
                clientIp: req.ip,
            });
            res.json({ items: saved });
        } catch (err) {
            return res.status(_dbErrorStatus(err)).json(_dbErrorPayload(err, 'Support model se nepodařilo uložit'));
        }
    } catch (err) { next(err); }
});

// ─── GET /services/:id/audience ──────────────────────────────────────────────
router.get('/:id/audience', async (req, res, next) => {
    try {
        const catalogId = await _resolveCatalogIdOr404(req.params.id, res);
        if (!catalogId) return;
        const items = await audienceRepo.listByService(catalogId);
        res.json({ items });
    } catch (err) { next(err); }
});

// ─── PUT /services/:id/audience ──────────────────────────────────────────────
router.put('/:id/audience', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const items = _normalizeCollectionBody(req.body, _normalizeAudienceItem);
        const errors = validateAudiencePolicy(items);
        for (let index = 0; index < items.length; index += 1) {
            if (!(await _validateOfferingOwnership(catalogId, items[index].offering_id))) {
                errors.push({ field: `items[${index}].offering_id`, message: 'Offering nepatří k vybrané službě' });
            }
        }
        if (errors.length) return res.status(422).json({ errors });

        try {
            const saved = await audienceRepo.replaceForService(catalogId, items);
            await audit.log?.({
                tableName: 'ServiceAudiencePolicy',
                recordId: null,
                recordLabel: serviceId,
                action: 'UPDATE',
                newValues: { items },
                performedBy: req.user.username,
                clientIp: req.ip,
            });
            res.json({ items: saved });
        } catch (err) {
            return res.status(_dbErrorStatus(err)).json(_dbErrorPayload(err, 'Audience policy se nepodařilo uložit'));
        }
    } catch (err) { next(err); }
});

// ─── GET /services/:id/operational-links ─────────────────────────────────────
router.get('/:id/operational-links', async (req, res, next) => {
    try {
        const catalogId = await _resolveCatalogIdOr404(req.params.id, res);
        if (!catalogId) return;
        const items = await operationalLinksRepo.listByService(catalogId);
        res.json({ items });
    } catch (err) { next(err); }
});

// ─── POST /services/:id/operational-links ────────────────────────────────────
router.post('/:id/operational-links', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const body = _normalizeOperationalLinkBody(req.body || {});
        const errors = validateOperationalLink(body, { isCreate: true });
        if (!(await _validateOfferingOwnership(catalogId, body.offering_id))) {
            errors.push({ field: 'offering_id', message: 'Offering nepatří k vybrané službě' });
        }
        if (errors.length) return res.status(422).json({ errors });

        try {
            const item = await operationalLinksRepo.create(catalogId, body);
            await audit.log?.({
                tableName: 'ServiceOperationalLink',
                recordId: item.id,
                recordLabel: serviceId,
                action: 'INSERT',
                newValues: body,
                performedBy: req.user.username,
                clientIp: req.ip,
            });
            res.status(201).json(item);
        } catch (err) {
            return res.status(_dbErrorStatus(err)).json(_dbErrorPayload(err, 'Operational link se nepodařilo vytvořit'));
        }
    } catch (err) { next(err); }
});

// ─── PUT /services/:id/operational-links/:linkId ─────────────────────────────
router.put('/:id/operational-links/:linkId', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const linkId = parseInt(req.params.linkId, 10);
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const existing = await operationalLinksRepo.findById(linkId, catalogId);
        if (!existing) return res.status(404).json({ error: 'Operational link nenalezen' });

        const body = _normalizeOperationalLinkBody(req.body || {});
        const errors = validateOperationalLink(body, { isCreate: false });
        if (!(await _validateOfferingOwnership(catalogId, body.offering_id))) {
            errors.push({ field: 'offering_id', message: 'Offering nepatří k vybrané službě' });
        }
        if (errors.length) return res.status(422).json({ errors });

        try {
            const item = await operationalLinksRepo.update(linkId, catalogId, body);
            await audit.log?.({
                tableName: 'ServiceOperationalLink',
                recordId: linkId,
                recordLabel: serviceId,
                action: 'UPDATE',
                newValues: body,
                performedBy: req.user.username,
                clientIp: req.ip,
            });
            res.json(item);
        } catch (err) {
            return res.status(_dbErrorStatus(err)).json(_dbErrorPayload(err, 'Operational link se nepodařilo upravit'));
        }
    } catch (err) { next(err); }
});

// ─── DELETE /services/:id/operational-links/:linkId ──────────────────────────
router.delete('/:id/operational-links/:linkId', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const linkId = parseInt(req.params.linkId, 10);
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const existing = await operationalLinksRepo.findById(linkId, catalogId);
        if (!existing) return res.status(404).json({ error: 'Operational link nenalezen' });

        const removed = await operationalLinksRepo.remove(linkId, catalogId);
        if (!removed) return res.status(404).json({ error: 'Operational link nenalezen' });

        await audit.log?.({
            tableName: 'ServiceOperationalLink',
            recordId: linkId,
            recordLabel: serviceId,
            action: 'DELETE',
            performedBy: req.user.username,
            clientIp: req.ip,
        });
        res.json({ message: `Operational link ${linkId} smazán` });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/score ──────────────────────────────────────────────────
router.get('/:id/score', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const flavours = await flRepo.findByService(serviceId);
        const detail   = serviceScoreDetailed(svc, flavours);
        res.json(detail);
    } catch (err) { next(err); }
});

// ─── GET /services/:id/readiness ─────────────────────────────────────────────
router.get('/:id/readiness', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const readiness = await getServiceReadiness(serviceId);
        if (!readiness) {
            return res.status(404).json({ error: 'Readiness pro službu nebyla nalezena' });
        }
        res.json(readiness);
    } catch (err) { next(err); }
});

// ─── GET /services/:id/frameworks ────────────────────────────────────────────
// Lightweight framework coverage summary used by Service Detail v2. The generic
// coverage engine in /capabilities remains the source of truth; this endpoint
// adapts mapped Level-3 capabilities to service-detail cards.
router.get('/:id/frameworks', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const pool = getPool();
        const serviceResult = await pool.query(`
            SELECT id, service_id, title
            FROM data.service_catalog
            WHERE service_id = $1 AND is_deleted = FALSE
        `, [serviceId]);
        const service = serviceResult.rows[0];
        if (!service) return res.status(404).json({ error: 'Služba nenalezena' });

        const mappedCapabilities = await pool.query(`
            SELECT DISTINCT ct.uuid
            FROM data.service_c3_mapping scm
            JOIN data.c3_taxonomy ct ON ct.uuid = scm.c3_uuid
            WHERE scm.service_id = $1
              AND ct.item_type = 'CP'
              AND ct.level_num = 3
        `, [service.id]);
        const mappedUuids = new Set(mappedCapabilities.rows.map((row) => row.uuid));
        if (mappedUuids.size === 0) return res.json([]);

        const capabilities = (await listLevel3Capabilities(pool)).filter((capability) => mappedUuids.has(capability.uuid));
        const rows = [];
        for (const capability of capabilities) {
            const coverage = await pool.query(`
                SELECT spiral_code, total_requirements, covered_count, coverage_percent
                FROM data.v_capability_lvl3_coverage
                WHERE capability_uuid = $1
                ORDER BY CASE WHEN spiral_code = 'Spiral_5' THEN 0 ELSE 1 END, spiral_code DESC
                LIMIT 1
            `, [capability.uuid]);
            const summary = coverage.rows[0] ?? { total_requirements: 0, covered_count: 0, coverage_percent: 0, spiral_code: 'Spiral_5' };
            const missing = await pool.query(`
                SELECT r.code, r.title, r.entity_kind AS kind
                FROM data.v_capability_requirement r
                WHERE r.capability_uuid = $1
                  AND NOT EXISTS (
                      SELECT 1 FROM data.service_c3_mapping scm
                      WHERE scm.service_id = $2
                        AND (scm.c3_uuid = r.capability_uuid OR scm.c3_uuid = r.entity_uuid)
                  )
                ORDER BY r.entity_kind, r.code
                LIMIT 10
            `, [capability.uuid, service.id]);
            rows.push({
                framework_code: capability.slug === 'cap-bmc-air-bmc' ? 'FMN_AIR_C2' : capability.slug.toUpperCase().replace(/-/g, '_'),
                title: capability.title,
                capability_slug: capability.slug,
                spiral_code: summary.spiral_code,
                coverage_percent: Number(summary.coverage_percent ?? 0),
                core_total: Number(summary.total_requirements ?? 0),
                core_covered: Number(summary.covered_count ?? 0),
                missing_core: missing.rows,
            });
        }
        res.json(rows);
    } catch (err) { next(err); }
});

// ─── POST /services/:id/preview-mapping ──────────────────────────────────────
router.post('/:id/preview-mapping', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const { capability_uuid: capabilityUuid } = req.body ?? {};
        if (!capabilityUuid) return res.status(400).json({ error: 'capability_uuid is required' });
        const pool = getPool();
        const serviceResult = await pool.query(`
            SELECT id, service_id, title
            FROM data.service_catalog
            WHERE service_id = $1 AND is_deleted = FALSE
        `, [serviceId]);
        const service = serviceResult.rows[0];
        if (!service) return res.status(404).json({ error: 'Služba nenalezena' });

        const capabilityResult = await pool.query(`
            SELECT uuid, external_id, title
            FROM data.c3_taxonomy
            WHERE uuid = $1 AND item_type = 'CP'
        `, [capabilityUuid]);
        const capability = capabilityResult.rows[0];
        if (!capability) return res.status(404).json({ error: 'Capability mapping target not found' });

        const beforeResult = await pool.query(`
            SELECT spiral_code, total_requirements, covered_count, coverage_percent
            FROM data.v_capability_lvl3_coverage
            WHERE capability_uuid = $1
            ORDER BY spiral_code
        `, [capabilityUuid]);
        const requirements = await pool.query(`
            SELECT r.code, r.title, r.entity_kind AS kind, r.entity_uuid
            FROM data.v_capability_requirement r
            WHERE r.capability_uuid = $1
              AND NOT EXISTS (
                  SELECT 1 FROM data.service_c3_mapping scm
                  WHERE scm.service_id = $2
                    AND (scm.c3_uuid = r.capability_uuid OR scm.c3_uuid = r.entity_uuid)
              )
            ORDER BY r.entity_kind, r.code
        `, [capabilityUuid, service.id]);
        const capabilities = await listLevel3Capabilities(pool);
        const slug = capabilities.find((item) => item.uuid === capabilityUuid)?.slug ?? null;
        const coverageDelta = beforeResult.rows.map((row) => {
            const total = Number(row.total_requirements ?? 0);
            const beforeCovered = Number(row.covered_count ?? 0);
            const afterCovered = total;
            return {
                capability_uuid: capabilityUuid,
                capability_title: capability.title,
                capability_slug: slug,
                spiral_code: row.spiral_code,
                before_coverage_percent: Number(row.coverage_percent ?? 0),
                after_coverage_percent: total > 0 ? Math.round((afterCovered / total) * 100) : 0,
                newly_covered_count: Math.max(0, afterCovered - beforeCovered),
            };
        });
        const duplicates = await pool.query(`
            SELECT DISTINCT sc.service_id, sc.title
            FROM data.service_c3_mapping scm
            JOIN data.service_catalog sc ON sc.id = scm.service_id
            WHERE scm.c3_uuid = $1
              AND sc.service_id <> $2
              AND sc.is_deleted = FALSE
            ORDER BY sc.service_id
            LIMIT 10
        `, [capabilityUuid, serviceId]);
        res.json({
            read_only: true,
            mapping_intent: req.body,
            coverage_delta_per_lvl3: coverageDelta,
            newly_covered_requirements: requirements.rows,
            potential_duplicate_coverage: duplicates.rows,
            affected_spirals: [...new Set(coverageDelta.map((row) => row.spiral_code))],
            classification: requirements.rows.length > 0 ? 'gap_closer' : 'metadata_enrichment',
        });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/c3-mappings ───────────────────────────────────────────
// Returns all C3 taxonomy mappings for the selected service, not only the primary one.
router.get('/:id/c3-mappings', async (req, res, next) => {
    try {
        const c3Enabled = await isModuleApiEnabled('C3_TAXONOMY');
        if (!c3Enabled) {
            return res.json({ mappings: [] });
        }

        const serviceId = req.params.id;
        const pool = getPool();

        const result = await pool.query(`
            SELECT
                scm.id,
                scm.c3_uuid,
                scm.mapping_type_code,
                scm.pace_code,
                scm.c3_level,
                scm.c3_domain,
                scm.c3_source,
                scm.is_primary,
                scm.mapping_note,
                scm.synced_at,
                scm.sync_status,
                ct.title          AS c3_title,
                ct.external_id    AS c3_external_id,
                ct.item_type      AS c3_item_type,
                ct.item_status    AS c3_item_status,
                NULL::VARCHAR(500) AS c3_short_title,
                rmt.name          AS mapping_type_name,
                rpc.name          AS pace_name
            FROM data.service_c3_mapping scm
            JOIN data.service_catalog sc
                ON sc.id = scm.service_id AND sc.is_deleted = FALSE
            LEFT JOIN data.c3_taxonomy ct
                ON ct.uuid = scm.c3_uuid
            LEFT JOIN data.ref_c3_mapping_type rmt
                ON rmt.code = scm.mapping_type_code
            LEFT JOIN data.ref_pace_category rpc
                ON rpc.code = scm.pace_code
            WHERE sc.service_id = $1
            ORDER BY scm.is_primary DESC, scm.c3_level DESC, scm.c3_domain ASC
        `, [serviceId]);

        res.json({ mappings: result.rows });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/graph ──────────────────────────────────────────────────
// BFS through ServiceRelation. from/to_service_id are BIGINT FKs to ServiceCatalog.id.
// The API works with string business keys (service_id); BFS joins through ServiceCatalog.
router.get('/:id/graph', async (req, res, next) => {
    try {
        const rootId = req.params.id;
        const depth  = Math.min(3, Math.max(1, parseInt(req.query.depth || '2')));
        const mode = String(req.query.mode ?? 'legacy').trim().toLowerCase();
        const pool   = getPool();

        // ── BFS through ServiceRelation (string business keys through JOIN) ───
        const visited = new Set([rootId]);
        let frontier  = [rootId];

        for (let d = 0; d < depth && frontier.length > 0; d++) {
            // JOIN through ServiceCatalog to convert BIGINT FK → string service_id.
            const relResult = await pool.query(`
                SELECT f.service_id AS a, t.service_id AS b
                FROM data.service_relation sr
                JOIN data.service_catalog f ON f.id = sr.from_service_id AND f.is_deleted = FALSE
                JOIN data.service_catalog t ON t.id = sr.to_service_id   AND t.is_deleted = FALSE
                WHERE sr.is_deleted = FALSE
                  AND (f.service_id = ANY($1::varchar[])
                    OR t.service_id = ANY($1::varchar[]))
            `, [frontier]);

            frontier = [];
            for (const row of relResult.rows) {
                for (const nid of [row.a, row.b]) {
                    if (nid != null && !visited.has(nid)) {
                        visited.add(nid);
                        frontier.push(nid);
                    }
                }
            }
        }

        const nodeIds = [...visited];
        const serviceNodesResult = await pool.query(`
            SELECT sc.service_id, sc.title,
                   sc.service_type_code   AS service_type,
                   sc.service_status_code AS service_status,
                   sc.portfolio_group_code AS portfolio_group,
                   sc.sla_availability, sc.graph_x, sc.graph_y
            FROM data.service_catalog sc
            WHERE sc.service_id = ANY($1::varchar[])
              AND sc.is_deleted = FALSE
        `, [nodeIds]);

        if (serviceNodesResult.rows.length === 0) {
            return res.status(404).json({ error: 'Služba nenalezena' });
        }

        const serviceEdgesResult = await pool.query(`
            SELECT f.service_id AS from_service_id, t.service_id AS to_service_id,
                   sr.relation_type_code AS relation_type, sr.relation_label,
                   sr.is_mandatory, sr.impact_level, sr.pace_code,
                   sr.is_verified, sr.parse_confidence, sr.relation_note
            FROM data.service_relation sr
            JOIN data.service_catalog f ON f.id = sr.from_service_id AND f.is_deleted = FALSE
            JOIN data.service_catalog t ON t.id = sr.to_service_id   AND t.is_deleted = FALSE
            WHERE sr.is_deleted = FALSE
              AND f.service_id = ANY($1::varchar[])
              AND t.service_id = ANY($1::varchar[])
        `, [nodeIds]);

        if (mode !== 'v2') {
            return res.json({
                nodes: serviceNodesResult.rows,
                edges: serviceEdgesResult.rows,
            });
        }

        const mappingResult = await pool.query(`
            SELECT
                scm.id,
                sc.service_id,
                scm.c3_uuid,
                scm.mapping_type_code,
                scm.is_primary,
                scm.mapping_note,
                scm.pace_code,
                cap.title AS c3_title,
                cap.external_id AS c3_code,
                cap.item_type,
                cap.item_status,
                comp.completeness_status
            FROM data.service_c3_mapping scm
            JOIN data.service_catalog sc
              ON sc.id = scm.service_id
             AND sc.is_deleted = FALSE
            LEFT JOIN data.c3_taxonomy cap
              ON cap.uuid = scm.c3_uuid
            LEFT JOIN data.v_c3capabilitycompleteness comp
              ON comp.uuid = scm.c3_uuid
            WHERE sc.service_id = ANY($1::varchar[])
        `, [nodeIds]);

        const flavourResult = await pool.query(`
            SELECT
                sf.id,
                sc.service_id,
                sf.flavour_code,
                sf.title,
                sf.price_value,
                sf.currency_code,
                sf.flavour_status_code
            FROM data.service_flavour sf
            JOIN data.service_catalog sc
              ON sc.id = sf.service_id
             AND sc.is_deleted = FALSE
            WHERE sc.service_id = ANY($1::varchar[])
              AND sf.is_deleted = FALSE
        `, [nodeIds]);

        const capabilityUuids = [...new Set(mappingResult.rows.map((row) => row.c3_uuid).filter(Boolean))];
        const capabilityLinks = {
            applications: [],
            tins: [],
            dataObjects: [],
            c3Services: [],
        };
        const tinRelations = {
            applications: [],
            dataObjects: [],
            c3Services: [],
        };

        if (capabilityUuids.length > 0) {
            const [capApps, capTins, capDos, capSvcs] = await Promise.all([
                pool.query(`
                    SELECT l.capability_uuid,
                           a.uuid AS entity_uuid,
                           a.title,
                           a.application_code AS code,
                           a.item_status
                    FROM data.c3_capability_application_link l
                    JOIN data.c3_application a ON a.id = l.c3_application_id
                    WHERE l.capability_uuid = ANY($1::varchar[])
                `, [capabilityUuids]),
                pool.query(`
                    SELECT l.capability_uuid,
                           t.id AS entity_id,
                           t.uuid AS entity_uuid,
                           t.title,
                           t.technology_interaction_code AS code,
                           t.item_status
                    FROM data.c3_capability_tin_link l
                    JOIN data.c3_technology_interaction t ON t.id = l.c3_tin_id
                    WHERE l.capability_uuid = ANY($1::varchar[])
                `, [capabilityUuids]),
                pool.query(`
                    SELECT l.capability_uuid,
                           d.uuid AS entity_uuid,
                           d.title,
                           d.data_object_code AS code,
                           d.item_status
                    FROM data.c3_capability_data_object_link l
                    JOIN data.c3_data_object d ON d.id = l.c3_data_object_id
                    WHERE l.capability_uuid = ANY($1::varchar[])
                `, [capabilityUuids]),
                pool.query(`
                    SELECT l.capability_uuid,
                           s.uuid AS entity_uuid,
                           s.title,
                           s.service_code AS code,
                           s.item_status
                    FROM data.c3_capability_c3_service_link l
                    JOIN data.c3_service s ON s.id = l.c3_service_id
                    WHERE l.capability_uuid = ANY($1::varchar[])
                `, [capabilityUuids]),
            ]);

            capabilityLinks.applications = capApps.rows;
            capabilityLinks.tins = capTins.rows;
            capabilityLinks.dataObjects = capDos.rows;
            capabilityLinks.c3Services = capSvcs.rows;

            const tinIds = [...new Set(capTins.rows.map((row) => row.entity_id).filter(Boolean))];
            if (tinIds.length > 0) {
                const [tinApps, tinDos, tinSvcs] = await Promise.all([
                    pool.query(`
                        SELECT ti.uuid AS tin_uuid,
                               app.uuid AS entity_uuid,
                               app.title,
                               app.application_code AS code,
                               app.item_status
                        FROM data.c3_technology_interaction_application_link link_
                        JOIN data.c3_technology_interaction ti ON ti.id = link_.technology_interaction_id
                        JOIN data.c3_application app ON app.id = link_.c3_application_id
                        WHERE link_.technology_interaction_id = ANY($1::bigint[])
                    `, [tinIds]),
                    pool.query(`
                        SELECT ti.uuid AS tin_uuid,
                               dob.uuid AS entity_uuid,
                               dob.title,
                               dob.data_object_code AS code,
                               dob.item_status
                        FROM data.c3_technology_interaction_data_object_link link_
                        JOIN data.c3_technology_interaction ti ON ti.id = link_.technology_interaction_id
                        JOIN data.c3_data_object dob ON dob.id = link_.c3_data_object_id
                        WHERE link_.technology_interaction_id = ANY($1::bigint[])
                    `, [tinIds]),
                    pool.query(`
                        SELECT ti.uuid AS tin_uuid,
                               svc.uuid AS entity_uuid,
                               svc.title,
                               svc.service_code AS code,
                               svc.item_status
                        FROM data.c3_technology_interaction_service_link link_
                        JOIN data.c3_technology_interaction ti ON ti.id = link_.technology_interaction_id
                        JOIN data.c3_service svc ON svc.id = link_.c3_service_id
                        WHERE link_.technology_interaction_id = ANY($1::bigint[])
                    `, [tinIds]),
                ]);

                tinRelations.applications = tinApps.rows;
                tinRelations.dataObjects = tinDos.rows;
                tinRelations.c3Services = tinSvcs.rows;
            }
        }

        const readiness = await getServiceReadiness(rootId);
        const nodeMap = new Map();

        const upsertNode = (node) => {
            if (!nodeMap.has(node.id)) nodeMap.set(node.id, node);
        };

        serviceNodesResult.rows.forEach((row) => {
            upsertNode({
                id: `svc:${row.service_id}`,
                node_kind: 'service',
                label: row.title,
                code: row.service_id,
                status: row.service_status,
                service_id: row.service_id,
                service_type: row.service_type,
                portfolio_group: row.portfolio_group,
                graph_x: row.graph_x,
                graph_y: row.graph_y,
                is_root: row.service_id === rootId,
            });
        });

        flavourResult.rows.forEach((row) => {
            upsertNode({
                id: `flv:${row.id}`,
                node_kind: 'flavour',
                label: row.title || row.flavour_code,
                code: row.flavour_code,
                status: row.flavour_status_code,
                service_id: row.service_id,
                price_label: row.price_value != null ? `${row.price_value} ${row.currency_code ?? ''}`.trim() : null,
            });
        });

        mappingResult.rows.forEach((row) => {
            upsertNode({
                id: `c3:${row.c3_uuid}`,
                node_kind: 'c3_capability',
                label: row.c3_title || row.c3_code || row.c3_uuid,
                code: row.c3_code || row.c3_uuid,
                status: row.item_status,
                c3_uuid: row.c3_uuid,
                item_type: row.item_type,
                completeness_status: row.completeness_status || 'incomplete',
            });
        });

        capabilityLinks.applications.forEach((row) => {
            upsertNode({
                id: `app:${row.entity_uuid}`,
                node_kind: 'c3_application',
                label: row.title,
                code: row.code,
                status: row.item_status,
                entity_uuid: row.entity_uuid,
            });
        });
        capabilityLinks.tins.forEach((row) => {
            upsertNode({
                id: `tin:${row.entity_uuid}`,
                node_kind: 'c3_tin',
                label: row.title,
                code: row.code,
                status: row.item_status,
                entity_uuid: row.entity_uuid,
            });
        });
        capabilityLinks.dataObjects.forEach((row) => {
            upsertNode({
                id: `do:${row.entity_uuid}`,
                node_kind: 'c3_data_object',
                label: row.title,
                code: row.code,
                status: row.item_status,
                entity_uuid: row.entity_uuid,
            });
        });
        capabilityLinks.c3Services.forEach((row) => {
            upsertNode({
                id: `c3svc:${row.entity_uuid}`,
                node_kind: 'c3_service',
                label: row.title,
                code: row.code,
                status: row.item_status,
                entity_uuid: row.entity_uuid,
            });
        });
        tinRelations.applications.forEach((row) => {
            upsertNode({
                id: `app:${row.entity_uuid}`,
                node_kind: 'c3_application',
                label: row.title,
                code: row.code,
                status: row.item_status,
                entity_uuid: row.entity_uuid,
            });
        });
        tinRelations.dataObjects.forEach((row) => {
            upsertNode({
                id: `do:${row.entity_uuid}`,
                node_kind: 'c3_data_object',
                label: row.title,
                code: row.code,
                status: row.item_status,
                entity_uuid: row.entity_uuid,
            });
        });
        tinRelations.c3Services.forEach((row) => {
            upsertNode({
                id: `c3svc:${row.entity_uuid}`,
                node_kind: 'c3_service',
                label: row.title,
                code: row.code,
                status: row.item_status,
                entity_uuid: row.entity_uuid,
            });
        });

        const edges = [
            ...serviceEdgesResult.rows.map((edge, index) => ({
                id: `svc-rel:${index}:${edge.from_service_id}:${edge.to_service_id}:${edge.relation_type}`,
                source: `svc:${edge.from_service_id}`,
                target: `svc:${edge.to_service_id}`,
                edge_kind: 'service_relation',
                relation_type: edge.relation_type,
                relation_label: edge.relation_label,
                is_mandatory: edge.is_mandatory,
                impact_level: edge.impact_level,
                pace_code: edge.pace_code,
                is_verified: edge.is_verified,
                parse_confidence: edge.parse_confidence,
                relation_note: edge.relation_note,
            })),
            ...flavourResult.rows.map((row) => ({
                id: `svc-flv:${row.service_id}:${row.id}`,
                source: `svc:${row.service_id}`,
                target: `flv:${row.id}`,
                edge_kind: 'service_flavour',
                relation_type: 'service_flavour',
                relation_label: row.flavour_code,
            })),
            ...mappingResult.rows.map((row) => ({
                id: `svc-c3:${row.service_id}:${row.id}`,
                source: `svc:${row.service_id}`,
                target: `c3:${row.c3_uuid}`,
                edge_kind: 'service_c3_mapping',
                relation_type: row.mapping_type_code,
                relation_label: row.mapping_note,
                is_primary: Boolean(row.is_primary),
                pace_code: row.pace_code,
            })),
            ...capabilityLinks.applications.map((row) => ({
                id: `cap-app:${row.capability_uuid}:${row.entity_uuid}`,
                source: `c3:${row.capability_uuid}`,
                target: `app:${row.entity_uuid}`,
                edge_kind: 'capability_application',
                relation_type: 'capability_application',
            })),
            ...capabilityLinks.tins.map((row) => ({
                id: `cap-tin:${row.capability_uuid}:${row.entity_uuid}`,
                source: `c3:${row.capability_uuid}`,
                target: `tin:${row.entity_uuid}`,
                edge_kind: 'capability_tin',
                relation_type: 'capability_tin',
            })),
            ...capabilityLinks.dataObjects.map((row) => ({
                id: `cap-do:${row.capability_uuid}:${row.entity_uuid}`,
                source: `c3:${row.capability_uuid}`,
                target: `do:${row.entity_uuid}`,
                edge_kind: 'capability_data_object',
                relation_type: 'capability_data_object',
            })),
            ...capabilityLinks.c3Services.map((row) => ({
                id: `cap-svc:${row.capability_uuid}:${row.entity_uuid}`,
                source: `c3:${row.capability_uuid}`,
                target: `c3svc:${row.entity_uuid}`,
                edge_kind: 'capability_c3_service',
                relation_type: 'capability_c3_service',
            })),
            ...tinRelations.applications.map((row) => ({
                id: `tin-app:${row.tin_uuid}:${row.entity_uuid}`,
                source: `tin:${row.tin_uuid}`,
                target: `app:${row.entity_uuid}`,
                edge_kind: 'tin_application',
                relation_type: 'tin_application',
            })),
            ...tinRelations.dataObjects.map((row) => ({
                id: `tin-do:${row.tin_uuid}:${row.entity_uuid}`,
                source: `tin:${row.tin_uuid}`,
                target: `do:${row.entity_uuid}`,
                edge_kind: 'tin_data_object',
                relation_type: 'tin_data_object',
            })),
            ...tinRelations.c3Services.map((row) => ({
                id: `tin-svc:${row.tin_uuid}:${row.entity_uuid}`,
                source: `tin:${row.tin_uuid}`,
                target: `c3svc:${row.entity_uuid}`,
                edge_kind: 'tin_c3_service',
                relation_type: 'tin_c3_service',
            })),
        ];

        res.json({
            mode: 'v2',
            root_service_id: rootId,
            readiness,
            nodes: [...nodeMap.values()],
            edges,
        });
    } catch (err) { next(err); }
});

// ─── POST /services/validate ──────────────────────────────────────────────────
router.post('/validate', async (req, res, next) => {
    try {
        const body     = _normalizeBody(req.body);
        const isCreate = body._mode !== 'update';
        const errors   = isCreate ? validateCreate(body) : validateUpdate(body);
        const score    = serviceScore(body);
        res.json({ valid: errors.length === 0, errors, score });
    } catch (err) { next(err); }
});

// ─── POST /services ───────────────────────────────────────────────────────────
router.post('/', canEdit, async (req, res, next) => {
    try {
        const body   = _normalizeBody(req.body);
        const errors = validateCreate(body);
        if (errors.length) return res.status(422).json({ errors });

        if (await repo.serviceIdExists(body.service_id)) {
            return res.status(409).json({ error: `ServiceID '${body.service_id}' již existuje` });
        }

        // FK validation — service_type must exist in ref_ServiceType
        const typeCheck = await getPool().query('SELECT 1 AS ok FROM data.ref_service_type WHERE code = $1', [body.service_type]);
        if (!typeCheck.rows.length) {
            return res.status(422).json({ errors: [{ field: 'service_type', message: `ServiceType '${body.service_type}' neexistuje v číselníku` }] });
        }
        // FK validation — portfolio_group_code must exist if provided
        const pgCode = body.portfolio_group_code || body.portfolio_group || null;
        if (pgCode) {
            const pgCheck = await getPool().query('SELECT 1 AS ok FROM data.ref_portfolio_group WHERE code = $1 AND is_active = TRUE', [pgCode]);
            if (!pgCheck.rows.length) {
                return res.status(422).json({ errors: [{ field: 'portfolio_group_code', message: `PortfolioGroup '${pgCode}' neexistuje v číselníku` }] });
            }
        }

        // FK validation — global_service_group_code (optional, FK na ref_GlobalServiceGroup)
        const gsgCode = body.global_service_group_code || null;
        if (gsgCode) {
            const gsgCheck = await getPool().query('SELECT 1 AS ok FROM data.ref_global_service_group WHERE code = $1', [gsgCode]);
            if (!gsgCheck.rows.length) {
                return res.status(422).json({ errors: [{ field: 'global_service_group_code', message: `GlobalServiceGroup '${gsgCode}' neexistuje v číselníku` }] });
            }
        }

        // FK validation — service_line_code (optional, FK na ref_ServiceLine)
        const slCode = body.service_line_code || null;
        if (slCode) {
            const slCheck = await getPool().query('SELECT 1 AS ok FROM data.ref_service_line WHERE code = $1', [slCode]);
            if (!slCheck.rows.length) {
                return res.status(422).json({ errors: [{ field: 'service_line_code', message: `ServiceLine '${slCode}' neexistuje v číselníku` }] });
            }
        }

        const newSvcId = await repo.create(body, req.user.username);
        const newSvc   = await repo.findByServiceId(newSvcId);

        // Domains M:N — set after row exists
        if (Array.isArray(body.available_on)) {
            await repo.setDomains(newSvcId, body.available_on);
        }

        const flavoursForScore = await flRepo.findByService(body.service_id).catch(() => []);
        const score = serviceScore(newSvc, flavoursForScore);
        await repo.updateScore(body.service_id, score);

        await audit.log({ tableName: 'ServiceCatalog', recordId: null, recordLabel: newSvc.service_id, action: 'INSERT', newValues: body, performedBy: req.user.username, clientIp: req.ip });
        await audit.addChangelog(newSvcId, 'create', `Vytvořena služba "${newSvc.title}"`, null, req.user.username);

        logger.info(`CREATE service ${newSvcId} by ${req.user.username}`);
        res.status(201).json({ ...newSvc, completeness_score: score });
    } catch (err) { next(err); }
});

// ─── PUT /services/:id ────────────────────────────────────────────────────────
router.put('/:id', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;

        const existing = await repo.findByServiceId(serviceId);
        if (!existing) return res.status(404).json({ error: 'Služba nenalezena' });

        const body   = _normalizeBody(req.body);
        const errors = validateUpdate(body, existing);
        if (!errors.length) {
            errors.push(...await _validateLiveReadiness(existing.id, existing, body));
        }
        if (errors.length) return res.status(422).json({ errors });

        const requestedStatus = body.service_status ?? body.service_status_code ?? null;
        const isActivating = requestedStatus === 'active' && existing.service_status !== 'active';
        if (isActivating) {
            const readiness = await getServiceReadiness(serviceId);
            if (!readiness?.is_publishable) {
                return res.status(409).json({
                    error: 'Službu nelze přepnout do stavu active, dokud nesplňuje publish readiness.',
                    readiness,
                });
            }
        }

        const updated = await repo.update(serviceId, body, req.user.username);

        // Domains M:N — only if available_on explicitly sent in body
        if (Array.isArray(body.available_on)) {
            await repo.setDomains(serviceId, body.available_on);
        }

        const flavours = await flRepo.findByService(serviceId);
        const score    = serviceScore(updated || existing, flavours);
        await repo.updateScore(serviceId, score);

        const changedFields = Object.keys(body).filter(k => body[k] !== existing[k]);
        const oldVals = {};
        const newVals = {};
        changedFields.forEach(k => { oldVals[k] = existing[k]; newVals[k] = body[k]; });

        await audit.log({ tableName: 'ServiceCatalog', recordId: null, recordLabel: serviceId, action: 'UPDATE', oldValues: oldVals, newValues: newVals, changedFields, performedBy: req.user.username, clientIp: req.ip });
        await audit.addChangelog(serviceId, 'update', `Upraven záznam "${existing.title}" (${changedFields.join(', ')})`, null, req.user.username);

        res.json({ ...(updated || existing), completeness_score: score });
    } catch (err) { next(err); }
});

// ─── DELETE /services/:id ─────────────────────────────────────────────────────
router.delete('/:id', canAdmin, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const dependents = await relRepo.findAll({ serviceId });
        if (dependents.length > 0 && !req.query.force) {
            return res.status(409).json({
                error: `Nelze smazat: ${dependents.length} jiných služeb závisí na '${serviceId}'. Použijte ?force=true pro vynucené smazání.`,
                dependents: dependents.map(d => ({
                    service_id: d.from_service_id === serviceId ? d.to_service_id : d.from_service_id,
                    title:      d.from_service_id === serviceId ? d.to_title     : d.from_title
                }))
            });
        }

        await repo.softDelete(serviceId, req.user.username);
        await audit.log({ tableName: 'ServiceCatalog', recordId: null, recordLabel: serviceId, action: 'SOFT_DELETE', oldValues: { service_status: svc.service_status }, performedBy: req.user.username, clientIp: req.ip });
        await audit.addChangelog(serviceId, 'delete', `Smazána služba "${svc.title}"`, null, req.user.username);

        logger.info(`DELETE service ${serviceId} by ${req.user.username}`);
        res.json({ message: `Služba '${serviceId}' smazána` });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/history ────────────────────────────────────────────────
router.get('/:id/history', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const history = await audit.findByRecord('ServiceCatalog', serviceId, 100);
        res.json(history);
    } catch (err) { next(err); }
});

// ─── GET /services/:id/relations ──────────────────────────────────────────────
// Returns a typed edge list for the selected service (project brief API contract, section 6).
// Includes outgoing and incoming edges with relation_type, confidence, and source_field.
router.get('/:id/relations', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const relations = await relRepo.findByService(serviceId);

        // Add direction: outgoing = from==serviceId, incoming = to==serviceId.
        const enriched = relations.map(r => ({
            ...r,
            direction: r.from_service_id === serviceId ? 'outgoing' : 'incoming',
        }));

        res.json(enriched);
    } catch (err) { next(err); }
});

// ─── GET /services/:id/flavours ───────────────────────────────────────────────
// Dedicated endpoint for pricing variants of the selected service (project brief API contract, section 6).
router.get('/:id/flavours', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const flavours = await flRepo.findByService(serviceId);
        res.json(flavours);
    } catch (err) { next(err); }
});

// ─── GET /services/:id/raw-fields ────────────────────────────────────────────
// Returns ServiceRawField records for the selected service (audit trail / re-parse source).
router.get('/:id/raw-fields', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const pool = getPool();

        // Verify that the service exists.
        const svcCheck = await pool.query('SELECT id FROM data.service_catalog WHERE service_id = $1 AND is_deleted = FALSE', [serviceId]);
        if (!svcCheck.rows.length) return res.status(404).json({ error: 'Služba nenalezena' });
        const svcPk = svcCheck.rows[0].id;

        const result = await pool.query(`
                SELECT id, field_name, raw_value, parser_version, notes, created_at
                FROM data.service_raw_field
                WHERE service_id = $1
                ORDER BY field_name
            `, [svcPk]);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// ─── PUT /services/:id/domains ────────────────────────────────────────────────
// Body: { domains: string[] }  — e.g. { domains: ["RELAY", "CLOUD"] }
// Replaces the full M:N domain set for the selected service.
router.put('/:id/domains', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const existing = await repo.findByServiceId(serviceId);
        if (!existing) return res.status(404).json({ error: 'Služba nenalezena' });

        const domains = req.body.domains;
        if (!Array.isArray(domains)) {
            return res.status(422).json({ error: 'domains musí být pole stringů' });
        }

        await repo.setDomains(serviceId, domains);
        await audit.log({ tableName: 'ServiceAvailableOn', recordId: null, recordLabel: serviceId, action: 'UPDATE', newValues: { domains }, performedBy: req.user.username, clientIp: req.ip });

        const updated = await repo.findByServiceId(serviceId);
        res.json({ service_id: serviceId, available_on: updated.available_on });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/roles ──────────────────────────────────────────────────
// Returns the full role assignment history for the selected service, including closed assignments.
router.get('/:id/roles', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const result = await getPool().query(`
                SELECT ra.id, ra.role_code, ra.display_name, ra.email, ra.organization_name,
                       ra.valid_from, ra.valid_to
                FROM data.service_role_assignment ra
                JOIN data.service_catalog sc ON sc.id = ra.service_id AND sc.is_deleted = FALSE
                WHERE sc.service_id = $1
                ORDER BY ra.role_code, ra.valid_from DESC
            `, [serviceId]);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// ─── PUT /services/:id/roles ──────────────────────────────────────────────────
// Body: { roleCode: string, displayName: string, email?: string, orgName?: string }
// roleCode: 'service_owner' | 'service_area_owner' | 'service_delivery_manager'
// displayName null/'' closes the active record (valid_to = now).
const VALID_ROLE_CODES = ['service_owner', 'service_area_owner', 'service_delivery_manager'];

router.put('/:id/roles', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const existing = await repo.findByServiceId(serviceId);
        if (!existing) return res.status(404).json({ error: 'Služba nenalezena' });

        const { roleCode, displayName = null, email = null, orgName = null } = req.body;
        if (!roleCode || !VALID_ROLE_CODES.includes(roleCode)) {
            return res.status(422).json({ error: `roleCode musí být: ${VALID_ROLE_CODES.join(', ')}` });
        }

        await repo.setRole(serviceId, roleCode, displayName || null, email || null, orgName || null);
        await audit.log({ tableName: 'ServiceRoleAssignment', recordId: null, recordLabel: serviceId, action: 'UPDATE', newValues: { roleCode, displayName, email }, performedBy: req.user.username, clientIp: req.ip });

        const updated = await repo.findByServiceId(serviceId);
        res.json({
            service_id: serviceId,
            service_owner: updated.service_owner,
            vlastnik:       updated.vlastnik,
            manager:        updated.manager,
        });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/sla ────────────────────────────────────────────────────
// Returns detailed SLA records from ServiceSla, not only summary scalar fields in ServiceCatalog.
// flavour_id = null means the SLA applies to the whole service; otherwise it applies to a specific flavour.
router.get('/:id/sla', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const result = await getPool().query(`
                SELECT
                    sl.id,
                    sl.support_window_code,
                    sl.availability_pct,
                    sl.restoration_hours,
                    sl.delivery_days,
                    sl.priority_model_raw,
                    sl.sla_note_raw,
                    sl.source_field,
                    sl.created_at,
                    sl.updated_at,
                    sf.flavour_code,
                    sf.title           AS flavour_title
                FROM data.service_sla sl
                INNER JOIN data.service_catalog sc
                    ON sc.id = sl.service_id
                   AND sc.service_id = $1
                   AND sc.is_deleted = FALSE
                LEFT JOIN data.service_flavour sf
                    ON sf.id = sl.flavour_id AND sf.is_deleted = FALSE
                ORDER BY CASE WHEN sl.flavour_id IS NULL THEN 0 ELSE 1 END, sl.id
            `, [serviceId]);

        res.json({
            service_id:    serviceId,
            sla_summary: {
                sla_availability:     svc.sla_availability,
                sla_restoration:      svc.sla_restoration,
                sla_delivery:         svc.sla_delivery,
            },
            sla_records: result.rows,
        });
    } catch (err) { next(err); }
});

// ─── POST /services/:id/sla ───────────────────────────────────────────────────
// Creates a new SLA record for the selected service or a specific flavour.
// Body: { support_window_code?, availability_pct?, restoration_hours?, delivery_days?,
//         priority_model_raw?, sla_note_raw?, flavour_id? }
router.post('/:id/sla', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const b = req.body || {};
        const pool = getPool();

        // Resolve BIGINT service id
        const svcIdRow = await pool.query('SELECT id FROM data.service_catalog WHERE service_id = $1 AND is_deleted = FALSE', [serviceId]);
        const svcBigId = svcIdRow.rows[0]?.id;
        if (!svcBigId) return res.status(404).json({ error: 'Služba nenalezena (id)' });

        // Resolve optional flavour_id (BIGINT) from string code or numeric id
        let flavourBigId = null;
        if (b.flavour_id != null) {
            const flRow = await pool.query('SELECT id FROM data.service_flavour WHERE id = $1 AND is_deleted = FALSE', [parseInt(b.flavour_id, 10)]);
            if (!flRow.rows.length) return res.status(422).json({ error: `flavour_id ${b.flavour_id} nenalezen` });
            flavourBigId = flRow.rows[0].id;
        }

        const avail   = b.availability_pct   != null ? parseFloat(b.availability_pct)   : null;
        const restH   = b.restoration_hours  != null ? parseFloat(b.restoration_hours)  : null;
        const delD    = b.delivery_days      != null ? parseFloat(b.delivery_days)      : null;

        const ins = await pool.query(`
                INSERT INTO data.service_sla
                    (service_id, flavour_id, support_window_code, availability_pct,
                     restoration_hours, delivery_days, priority_model_raw, sla_note_raw)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `, [svcBigId, flavourBigId, b.support_window_code ?? null, avail, restH, delD, b.priority_model_raw ?? null, b.sla_note_raw ?? null]);
        const newId = ins.rows[0]?.id;

        await audit.log({ tableName: 'ServiceSla', recordId: null, recordLabel: serviceId, action: 'INSERT', newValues: b, performedBy: req.user.username, clientIp: req.ip });

        const row = await pool.query(`
                SELECT sl.id, sl.support_window_code, sl.availability_pct,
                       sl.restoration_hours, sl.delivery_days,
                       sl.priority_model_raw, sl.sla_note_raw, sl.source_field,
                       sl.created_at, sl.updated_at,
                       sf.flavour_code, sf.title AS flavour_title
                FROM data.service_sla sl
                LEFT JOIN data.service_flavour sf ON sf.id = sl.flavour_id AND sf.is_deleted = FALSE
                WHERE sl.id = $1
            `, [newId]);
        res.status(201).json(row.rows[0]);
    } catch (err) { next(err); }
});

// ─── DELETE /services/:id/sla/:slaId ──────────────────────────────────────────
router.delete('/:id/sla/:slaId', canEdit, async (req, res, next) => {
    try {
        const { id: serviceId, slaId } = req.params;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const pool = getPool();
        const check = await pool.query(`
            SELECT sl.id
            FROM data.service_sla sl
            JOIN data.service_catalog sc ON sc.id = sl.service_id AND sc.service_id = $2
            WHERE sl.id = $1
        `, [parseInt(slaId, 10), serviceId]);
        if (!check.rows.length) return res.status(404).json({ error: 'SLA záznam nenalezen' });

        await pool.query('DELETE FROM data.service_sla WHERE id = $1', [parseInt(slaId, 10)]);

        await audit.log({ tableName: 'ServiceSla', recordId: null, recordLabel: serviceId, action: 'DELETE', performedBy: req.user.username, clientIp: req.ip });
        res.json({ message: `SLA záznam ${slaId} smazán` });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/impact ─────────────────────────────────────────────────
// Impact BFS (directed, reverse): who depends on the selected service?
// If X fails, which services are impacted?
// Traversal recursively follows incoming edges (from_service_id where to = X.id).
// Query param: ?depth=N (default 5, max 10) limits BFS depth.
// Response: { root, nodes[], edges[], depth_reached }
router.get('/:id/impact', async (req, res, next) => {
    try {
        const serviceId  = req.params.id;
        const maxDepth   = Math.min(10, parseInt(req.query.depth) || 5);
        const pool       = getPool();

        // Verify that the root service exists.
        const rootCheck = await pool.query(`
                SELECT sc.service_id, sc.title,
                       sc.service_type_code   AS service_type,
                       sc.service_status_code AS service_status,
                       sc.portfolio_group_code AS portfolio_group
                FROM data.service_catalog sc
                WHERE sc.service_id = $1 AND sc.is_deleted = FALSE
            `, [serviceId]);
        if (!rootCheck.rows.length) {
            return res.status(404).json({ error: 'Služba nenalezena' });
        }

        // Directed reverse BFS: follow incoming edges (who depends on me).
        const visited     = new Set([serviceId]);
        let   frontier    = [serviceId];
        let   depthReached = 0;
        const collectedEdges = [];

        for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
            depthReached = depth + 1;
            // Find who (from_service_id) depends on anything from the current frontier (to_service_id).
            const edgeResult = await pool.query(`
                SELECT f.service_id AS from_sid,
                       t.service_id AS to_sid,
                       sr.relation_type_code AS relation_type,
                       sr.impact_level
                FROM data.service_relation sr
                JOIN data.service_catalog f ON f.id = sr.from_service_id AND f.is_deleted = FALSE
                JOIN data.service_catalog t ON t.id = sr.to_service_id   AND t.is_deleted = FALSE
                WHERE sr.is_deleted = FALSE
                  AND t.service_id = ANY($1::varchar[])
            `, [frontier]);

            frontier = [];
            for (const row of edgeResult.rows) {
                collectedEdges.push(row);
                if (!visited.has(row.from_sid)) {
                    visited.add(row.from_sid);
                    frontier.push(row.from_sid);
                }
            }
        }

        // Fetch node details for all visited nodes
        const impactedIds = [...visited].filter(id => id !== serviceId);
        let   nodes       = [];

        if (impactedIds.length > 0) {
            const nodesResult = await pool.query(`
                SELECT sc.service_id, sc.title,
                       sc.service_type_code    AS service_type,
                       sc.service_status_code  AS service_status,
                       sc.portfolio_group_code AS portfolio_group,
                       sc.sla_availability
                FROM data.service_catalog sc
                WHERE sc.service_id = ANY($1::varchar[])
                  AND sc.is_deleted = FALSE
            `, [impactedIds]);
            nodes = nodesResult.rows;
        }

        res.json({
            root:          rootCheck.rows[0],
            nodes,
            edges:         collectedEdges,
            depth_reached: depthReached,
            total_impacted: nodes.length,
        });
    } catch (err) { next(err); }
});

module.exports = router;
