'use strict';

const { getPool } = require('../db/pool');
const { getConfigValues } = require('../utils/platform-config');

const READINESS_CONFIG = {
    requirePrimaryMapping: 'service.publish.require_primary_mapping',
    requireCompletePrimaryCapability: 'service.publish.require_complete_primary_capability',
    requireActiveFlavour: 'service.publish.require_active_flavour',
    requireDependencies: 'service.publish.require_dependencies',
    requireRelations: 'service.publish.require_relations',
};

function toBooleanConfig(value, fallback = false) {
    if (!value || value.config_value == null) return fallback;
    return ['1', 'true', 'yes', 'y'].includes(String(value.config_value).trim().toLowerCase());
}

async function getReadinessRules() {
    const configValues = await getConfigValues(Object.values(READINESS_CONFIG));
    return {
        requirePrimaryMapping: toBooleanConfig(configValues[READINESS_CONFIG.requirePrimaryMapping], false),
        requireCompletePrimaryCapability: toBooleanConfig(configValues[READINESS_CONFIG.requireCompletePrimaryCapability], true),
        requireActiveFlavour: toBooleanConfig(configValues[READINESS_CONFIG.requireActiveFlavour], false),
        requireDependencies: toBooleanConfig(configValues[READINESS_CONFIG.requireDependencies], false),
        requireRelations: toBooleanConfig(configValues[READINESS_CONFIG.requireRelations], false),
    };
}

function isActiveServiceStatus(status) {
    return String(status ?? '').toLowerCase() === 'active';
}

function buildServiceReadiness(row, rules = {}) {
    if (!row) return null;

    const blockers = [];
    const warnings = [];

    if (!row.has_single_primary_mapping) {
        if (Number(row.primary_mapping_count ?? 0) > 1) {
            (rules.requirePrimaryMapping ? blockers : warnings).push('Služba má více než jednu primary C3 capability.');
        } else {
            (rules.requirePrimaryMapping ? blockers : warnings).push('Služba zatím nemá primary C3 capability.');
        }
    }

    if (row.primary_c3_uuid && !row.has_complete_primary_capability) {
        (rules.requireCompletePrimaryCapability ? blockers : warnings).push('Primární C3 capability není complete. Doplň Applications, TIN, Data Objects a C3 Services.');
    }

    if (!row.has_active_flavour) {
        (rules.requireActiveFlavour ? blockers : warnings).push('Služba zatím nemá aktivní nebo available flavour.');
    }

    if (Number(row.dependency_relation_count ?? 0) === 0) {
        (rules.requireDependencies ? blockers : warnings).push('Služba zatím nemá evidované dependencies.');
    }

    if (Number(row.relation_count ?? 0) === 0) {
        (rules.requireRelations ? blockers : warnings).push('Služba zatím nemá žádné service relations.');
    }

    return {
        service_pk: row.service_pk,
        service_id: row.service_id,
        title: row.title,
        service_status: row.service_status,
        primary_mapping_count: Number(row.primary_mapping_count ?? 0),
        primary_c3_uuid: row.primary_c3_uuid ?? null,
        primary_c3_title: row.primary_c3_title ?? null,
        primary_c3_code: row.primary_c3_code ?? null,
        primary_c3_completeness_status: row.primary_c3_completeness_status ?? 'incomplete',
        primary_c3_app_count: Number(row.primary_c3_app_count ?? 0),
        primary_c3_data_object_count: Number(row.primary_c3_data_object_count ?? 0),
        primary_c3_tin_count: Number(row.primary_c3_tin_count ?? 0),
        primary_c3_c3_service_count: Number(row.primary_c3_c3_service_count ?? 0),
        primary_c3_service_mapping_count: Number(row.primary_c3_service_mapping_count ?? 0),
        active_flavour_count: Number(row.active_flavour_count ?? 0),
        relation_count: Number(row.relation_count ?? 0),
        dependency_relation_count: Number(row.dependency_relation_count ?? 0),
        has_single_primary_mapping: Boolean(row.has_single_primary_mapping),
        has_complete_primary_capability: Boolean(row.has_complete_primary_capability),
        has_active_flavour: Boolean(row.has_active_flavour),
        is_publishable: blockers.length === 0,
        blockers,
        warnings,
    };
}

async function getServiceReadiness(serviceId) {
    const rules = await getReadinessRules();
    const result = await getPool().query(`
        SELECT *
        FROM data.v_servicepublishreadiness
        WHERE service_id = $1
    `, [serviceId]);
    return buildServiceReadiness(result.rows[0] ?? null, rules);
}

async function getServiceReadinessByCatalogId(catalogId) {
    const rules = await getReadinessRules();
    const result = await getPool().query(`
        SELECT *
        FROM data.v_servicepublishreadiness
        WHERE service_pk = $1
    `, [catalogId]);
    return buildServiceReadiness(result.rows[0] ?? null, rules);
}

async function getServiceStateByCatalogId(catalogId) {
    const result = await getPool().query(`
        SELECT id, service_id, title, service_status_code AS service_status
        FROM data.service_catalog
        WHERE id = $1
          AND is_deleted = FALSE
    `, [catalogId]);
    return result.rows[0] ?? null;
}

module.exports = {
    buildServiceReadiness,
    getServiceReadiness,
    getServiceReadinessByCatalogId,
    getServiceStateByCatalogId,
    isActiveServiceStatus,
};
