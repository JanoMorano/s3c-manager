'use strict';

/** Request normalizers and helpers shared by the service routes. */

const repo = require('../../db/services.repo');
const offeringsRepo = require('../../db/offerings.repo');
const supportModelRepo = require('../../db/support-model.repo');
const { validateLifecycleOperationalReadiness, targetLifecycleStage } = require('../../services/validation');

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
    const field = body.lifecycle_stage_code !== undefined || body.lifecycle_state === undefined ? 'lifecycle_stage_code' : 'lifecycle_state';
    // Gate only the transition to active; editing an already active service is not a transition.
    if (targetLifecycleStage(existing, body) !== 'active') return [];
    if (targetLifecycleStage(existing, {}) === 'active') return [];

    const [offerings, supportModels] = await Promise.all([
        offeringsRepo.listByService(catalogId),
        supportModelRepo.listByService(catalogId),
    ]);

    return validateLifecycleOperationalReadiness(merged, {
        offeringCount: offerings.length,
        supportModelCount: supportModels.length,
    }, field);
}

module.exports = {
    _CAMEL_TO_SNAKE,
    _normalizeBody,
    _csvEscapeCell,
    _normalizeOfferingBody,
    _normalizeSupportModelItem,
    _normalizeAudienceItem,
    _normalizeOperationalLinkBody,
    _normalizeCollectionBody,
    _dbErrorStatus,
    _dbErrorPayload,
    _resolveCatalogIdOr404,
    _validateOfferingOwnership,
    _validateLiveReadiness,
};
