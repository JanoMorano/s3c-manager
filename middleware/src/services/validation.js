'use strict';
/**
 * ServiceCatalog validation — canonical schema v2.1.
 */
const { accepted: VALID_REL_TYPES } = require('../../../shared/service-catalogue/relationTypes.json');

// Must match ref_ServiceType.code in the DB
const VALID_TYPES = ['CF', 'CFS', 'ES', 'SS', 'MS', 'AS'];

// Must match ref_ServiceStatus.code in the DB (excluding external_reference, which is stub-only)
const VALID_STATUSES = ['draft', 'planned', 'active', 'deprecated', 'retired'];

const SERVICE_ID_REGEX = /^[A-Za-z0-9_.-]{2,50}$/;

// ── Phase 7: Lifecycle governance ────────────────────────────────────────────

const LIFECYCLE_STATES = ['draft', 'live', 'deprecated', 'retired'];

/**
 * Allowed forward and backward transitions.
 * null/'' means "no current lifecycle" → any state is permitted.
 */
const LIFECYCLE_TRANSITIONS = {
    draft:      ['live'],
    live:       ['deprecated', 'retired'],
    deprecated: ['live', 'retired'],
    retired:    ['deprecated'],
};

function normalizeLifecycleState(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return '';
    if (['draft', 'planned', 'design', 'under_review', 'approved'].includes(normalized)) return 'draft';
    if (['live', 'active', 'published', 'production'].includes(normalized)) return 'live';
    if (['deprecated', 'retiring'].includes(normalized)) return 'deprecated';
    if (normalized === 'retired') return 'retired';
    return normalized;
}

function validateLifecycleTransition(from, to) {
    if (!to) return [];
    const fromState = normalizeLifecycleState(from);
    const toState = normalizeLifecycleState(to);
    if (!LIFECYCLE_STATES.includes(toState) || toState !== String(to).trim().toLowerCase()) {
        return [{ field: 'lifecycle_state', message: `Neplatný lifecycle stav: '${to}'. Povolené hodnoty: ${LIFECYCLE_STATES.join(', ')}` }];
    }
    // No current state → any target is allowed (first assignment)
    if (!fromState || fromState === toState) return [];
    const allowed = LIFECYCLE_TRANSITIONS[fromState];
    if (!allowed) return []; // unknown from state — permissive
    if (!allowed.includes(toState)) {
        return [{
            field: 'lifecycle_state',
            message: `Nelze přejít ze stavu '${fromState}' do '${toState}'. Povolené přechody: ${allowed.join(', ')}`,
        }];
    }
    return [];
}

/**
 * Gate: service cannot go live unless minimum operational data is present.
 */
function validateLifecycleReadiness(merged) {
    const errors = [];
    if (merged.lifecycle_state === 'live') {
        if (merged.requestable === true && !hasRequestChannel(merged)) {
            errors.push({
                field: 'lifecycle_state',
                message: 'Přechod do stavu live není možný: služba je requestable, ale nemá nakonfigurovaný request channel.',
            });
        }
    }
    return errors;
}

function validateLifecycleOperationalReadiness(merged, context = {}) {
    const errors = [];
    if (merged.lifecycle_state !== 'live') return errors;

    const offeringCount = Number(context.offeringCount ?? 0);
    const supportModelCount = Number(context.supportModelCount ?? 0);

    if (merged.requestable === true && offeringCount <= 0) {
        errors.push({
            field: 'lifecycle_state',
            message: 'Přechod do stavu live není možný: requestable služba musí mít alespoň jeden offering.',
        });
    }

    if (merged.requestable === true && supportModelCount <= 0) {
        errors.push({
            field: 'lifecycle_state',
            message: 'Přechod do stavu live není možný: requestable služba musí mít nakonfigurovaný support model.',
        });
    }

    return errors;
}

function hasRequestChannel(data) {
    return !!(
        (typeof data.request_channel_type === 'string' && data.request_channel_type.trim()) ||
        (typeof data.request_channel_url === 'string' && data.request_channel_url.trim())
    );
}

function validateRequestability(data) {
    const errors = [];
    if (data.requestable === true && !hasRequestChannel(data)) {
        errors.push({
            field: 'requestable',
            message: 'Requestable služba musí mít request_channel_type nebo request_channel_url',
        });
    }
    return errors;
}

function isValidUrl(value) {
    if (value == null || value === '') return true;
    try {
        const url = new URL(String(value));
        return ['http:', 'https:'].includes(url.protocol);
    } catch {
        return false;
    }
}

/**
 * Validation for CREATE (all required fields)
 */
function validateCreate(data) {
    const errors = [];

    if (!data.title      || data.title.trim().length < 2)            errors.push({ field: 'title',        message: 'Název je povinný (min. 2 znaky)' });
    if (!data.service_id || !SERVICE_ID_REGEX.test(data.service_id)) errors.push({ field: 'service_id',   message: 'ServiceID musí být 2–50 znaků (A-Z, 0-9, -, _, .)' });
    if (!VALID_TYPES.includes(data.service_type))                     errors.push({ field: 'service_type', message: `ServiceType musí být: ${VALID_TYPES.join(', ')}` });

    if (data.service_status && !VALID_STATUSES.includes(data.service_status))
        errors.push({ field: 'service_status', message: `Status musí být: ${VALID_STATUSES.join(', ')}` });

    if (data.title              && data.title.length > 255)             errors.push({ field: 'title',           message: 'Název max. 255 znaků' });
    if (data.description        && data.description.length > 500000)             errors.push({ field: 'description',        message: 'Popis příliš dlouhý' });
    if (data.detailed_description && data.detailed_description.length > 500000)  errors.push({ field: 'description',        message: 'Popis příliš dlouhý' }); // compat alias
    if (data.unit_of_measure    && data.unit_of_measure.length > 200)   errors.push({ field: 'unit_of_measure',  message: 'Jednotka max. 200 znaků' });
    if (data.portfolio_group_code && data.portfolio_group_code.length > 100)     errors.push({ field: 'portfolio_group_code', message: 'Portfolio group max. 100 znaků' });
    if (data.request_channel_url && !isValidUrl(data.request_channel_url))
        errors.push({ field: 'request_channel_url', message: 'Request channel URL musí být validní http/https URL' });

    errors.push(...validateRequestability(data));
    if (data.lifecycle_state !== undefined) {
        errors.push(...validateLifecycleTransition(null, data.lifecycle_state));
    }

    return errors;
}

/**
 * Validation for UPDATE (only provided fields)
 */
function validateUpdate(data, existing = {}) {
    const errors = [];
    const merged = { ...existing, ...data };

    if (data.title          !== undefined && (!data.title || data.title.trim().length < 2))
        errors.push({ field: 'title',        message: 'Název je povinný (min. 2 znaky)' });
    if (data.service_type   !== undefined && !VALID_TYPES.includes(data.service_type))
        errors.push({ field: 'service_type', message: `ServiceType musí být: ${VALID_TYPES.join(', ')}` });
    if (data.service_status !== undefined && !VALID_STATUSES.includes(data.service_status))
        errors.push({ field: 'service_status', message: `Status musí být: ${VALID_STATUSES.join(', ')}` });
    if (data.request_channel_url !== undefined && data.request_channel_url !== null && data.request_channel_url !== '' && !isValidUrl(data.request_channel_url))
        errors.push({ field: 'request_channel_url', message: 'Request channel URL musí být validní http/https URL' });

    errors.push(...validateRequestability(merged));

    // Phase 7: lifecycle transition + readiness gate
    if (data.lifecycle_state !== undefined) {
        errors.push(...validateLifecycleTransition(existing.lifecycle_state ?? null, data.lifecycle_state));
        if (!errors.some(e => e.field === 'lifecycle_state')) {
            errors.push(...validateLifecycleReadiness(merged));
        }
    }

    return errors;
}

function validateOffering(data, { isCreate = true, existing = {} } = {}) {
    const errors = [];
    const merged = { ...existing, ...data };

    if (isCreate && (!data.offering_code || !String(data.offering_code).trim())) {
        errors.push({ field: 'offering_code', message: 'Offering code je povinný' });
    }
    if (isCreate && (!data.title || !String(data.title).trim())) {
        errors.push({ field: 'title', message: 'Název offeringu je povinný' });
    }
    if (data.offering_code !== undefined && !String(data.offering_code).trim()) {
        errors.push({ field: 'offering_code', message: 'Offering code nesmí být prázdný' });
    }
    if (data.title !== undefined && !String(data.title).trim()) {
        errors.push({ field: 'title', message: 'Název offeringu nesmí být prázdný' });
    }
    if (merged.request_channel_url && !isValidUrl(merged.request_channel_url)) {
        errors.push({ field: 'request_channel_url', message: 'Request channel URL musí být validní http/https URL' });
    }

    errors.push(...validateRequestability(merged));
    return errors;
}

function validateSupportModel(items) {
    const errors = [];
    if (!Array.isArray(items)) {
        return [{ field: 'items', message: 'Support model payload musí být pole' }];
    }

    items.forEach((item, index) => {
        if (item == null || typeof item !== 'object') {
            errors.push({ field: `items[${index}]`, message: 'Support model item musí být objekt' });
            return;
        }
    });
    return errors;
}

function validateAudiencePolicy(items) {
    const errors = [];
    if (!Array.isArray(items)) {
        return [{ field: 'items', message: 'Audience payload musí být pole' }];
    }

    items.forEach((item, index) => {
        if (item == null || typeof item !== 'object') {
            errors.push({ field: `items[${index}]`, message: 'Audience item musí být objekt' });
        }
    });
    return errors;
}

function validateOperationalLink(data, { isCreate = true } = {}) {
    const errors = [];
    if (isCreate && (!data.title || !String(data.title).trim())) {
        errors.push({ field: 'title', message: 'Název linku je povinný' });
    }
    if (isCreate && (!data.url || !String(data.url).trim())) {
        errors.push({ field: 'url', message: 'URL linku je povinná' });
    }
    if (data.title !== undefined && !String(data.title).trim()) {
        errors.push({ field: 'title', message: 'Název linku nesmí být prázdný' });
    }
    if (data.url !== undefined && !isValidUrl(data.url)) {
        errors.push({ field: 'url', message: 'URL linku musí být validní http/https URL' });
    }
    return errors;
}

/**
 * Validation for a ServiceFlavour record
 */
function validateFlavour(data, isCreate = true) {
    const errors = [];
    if (isCreate && (!data.title && !data.flavour_name))
        errors.push({ field: 'title', message: 'Název varianty je povinný' });
    // Accept both price_value (canonical) and service_rate_eur (legacy alias)
    const rate = data.price_value ?? data.service_rate_eur ?? null;
    if (rate !== undefined && rate !== null && isNaN(parseFloat(rate)))
        errors.push({ field: 'price_value', message: 'Cena musí být číslo' });
    if (rate !== undefined && rate !== null && parseFloat(rate) < 0)
        errors.push({ field: 'price_value', message: 'Cena nemůže být záporná' });
     return errors;
}

/**
 * Validation for a ServiceRelation record
 */
function validateRelation(data) {
    const errors = [];
    if (!data.from_service_id) errors.push({ field: 'from_service_id', message: 'Zdrojová služba je povinná' });
    if (!data.to_service_id)   errors.push({ field: 'to_service_id',   message: 'Cílová služba je povinná' });
    if (data.from_service_id === data.to_service_id)
        errors.push({ field: 'to_service_id', message: 'Služba nemůže mít relaci na samu sebe' });
    if (data.relation_type && !VALID_REL_TYPES.includes(data.relation_type))
        errors.push({ field: 'relation_type', message: `Typ relace musí být: ${VALID_REL_TYPES.join(', ')}` });
    return errors;
}

module.exports = {
    validateCreate,
    validateUpdate,
    validateFlavour,
    validateRelation,
    validateOffering,
    validateSupportModel,
    validateAudiencePolicy,
    validateOperationalLink,
    validateLifecycleTransition,
    validateLifecycleReadiness,
    validateLifecycleOperationalReadiness,
    normalizeLifecycleState,
    LIFECYCLE_TRANSITIONS,
    LIFECYCLE_STATES,
    VALID_TYPES,
    VALID_STATUSES,
};
