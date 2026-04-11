'use strict';
/**
 * ServiceCatalog validation — canonical schema v2.1.
 */

// Must match ref_ServiceType.code in the DB
const VALID_TYPES = ['CF', 'CFS', 'ES', 'SS', 'MS', 'AS'];

// Must match ref_ServiceStatus.code in the DB (excluding external_reference, which is stub-only)
const VALID_STATUSES = ['draft', 'planned', 'active', 'deprecated', 'retired'];

// Must match ref_RelationType.code in the DB
const VALID_REL_TYPES = [
    'depends_on', 'prerequisite', 'underlying',
    'requires_account', 'uses', 'provides', 'replaces',
    'integrates_with', 'related_to', 'part_of', 'replaced_by',
    'child_of',
];

const SERVICE_ID_REGEX = /^[A-Za-z0-9\-_\.]{2,50}$/;

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

    return errors;
}

/**
 * Validation for UPDATE (only provided fields)
 */
function validateUpdate(data) {
    const errors = [];

    if (data.title          !== undefined && (!data.title || data.title.trim().length < 2))
        errors.push({ field: 'title',        message: 'Název je povinný (min. 2 znaky)' });
    if (data.service_type   !== undefined && !VALID_TYPES.includes(data.service_type))
        errors.push({ field: 'service_type', message: `ServiceType musí být: ${VALID_TYPES.join(', ')}` });
    if (data.service_status !== undefined && !VALID_STATUSES.includes(data.service_status))
        errors.push({ field: 'service_status', message: `Status musí být: ${VALID_STATUSES.join(', ')}` });

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

module.exports = { validateCreate, validateUpdate, validateFlavour, validateRelation, VALID_TYPES, VALID_STATUSES };
