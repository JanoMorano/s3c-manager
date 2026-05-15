'use strict';

const MODULE_CODES = Object.freeze({
    DATABASE: 'DATABASE_LAYER',
    CORE: 'PLATFORM_CORE',
    SERVICE_CATALOGUE: 'SERVICE_CATALOGUE_CORE',
    C3: 'C3_TAXONOMY',
    MANAGEMENT: 'MANAGEMENT',
});

const MODULE_ALIASES = Object.freeze({
    SERVICE_CATALOGUE: MODULE_CODES.SERVICE_CATALOGUE,
    SERVICE_CATALOG: MODULE_CODES.SERVICE_CATALOGUE,
    C3: MODULE_CODES.C3,
    CORE: MODULE_CODES.CORE,
    DB: MODULE_CODES.DATABASE,
    DATABASE: MODULE_CODES.DATABASE,
});

const MODULE_DEFINITIONS = Object.freeze([
    {
        code: MODULE_CODES.DATABASE,
        label: 'Database Layer',
        kind: 'infrastructure',
        mandatory: true,
        installOrder: 0,
        dependsOn: [],
        uiVisibleByDefault: false,
        apiEnabledByDefault: false,
        dbSlices: [
            '00_bootstrap',
            '01_platform',
            '02_ref',
            '10_indexes',
            '13_install_system',
        ],
    },
    {
        code: MODULE_CODES.CORE,
        label: 'Platform Core',
        kind: 'platform',
        mandatory: true,
        installOrder: 1,
        dependsOn: [MODULE_CODES.DATABASE],
        uiVisibleByDefault: true,
        apiEnabledByDefault: true,
        apiRoutePrefixes: [
            '/api/v1/auth',
            '/api/v1/install',
            '/api/v1/admin',
            '/api/v1/ref',
            '/api/v1/search',
        ],
        uiRoutePrefixes: [
            '/',
            '/search',
            '/login',
            '/install',
            '/user-info',
            '/administration',
        ],
        dbSlices: [
            '03_groups',
            '12_exports_retention',
            '18_user_persona',
            '31_locale_cs_en_only',
        ],
    },
    {
        code: MODULE_CODES.SERVICE_CATALOGUE,
        label: 'Service Catalogue',
        kind: 'domain',
        mandatory: true,
        installOrder: 2,
        dependsOn: [MODULE_CODES.DATABASE, MODULE_CODES.CORE],
        uiVisibleByDefault: true,
        apiEnabledByDefault: true,
        apiRoutePrefixes: [
            '/api/v1/services',
            '/api/v1/flavours',
            '/api/v1/relations',
            '/api/v1/graph',
            '/api/v1/import',
            '/api/v1/export',
            '/api/v1/stats',
        ],
        uiRoutePrefixes: [
            '/catalogue',
            '/services',
            '/management/new-service',
            '/import',
            '/admin/import',
            '/administration/import',
            '/administration/catalogue-ref',
        ],
        dbSlices: [
            '04_core',
            '05_graph',
            '06_pricing',
            '07_domains',
            '08_ownership',
            '09_import',
            '15_itil_catalogue_phase1',
            '16_consumer_value',
            '29_reduction_low_risk_cleanup',
            '30_reduction_domain_model_simplification',
            '32_final_reduction_sunset_cleanup',
        ],
    },
    {
        code: MODULE_CODES.C3,
        label: 'C3 Capability Taxonomy',
        kind: 'domain',
        mandatory: false,
        installOrder: 3,
        dependsOn: [
            MODULE_CODES.DATABASE,
            MODULE_CODES.CORE,
            MODULE_CODES.SERVICE_CATALOGUE,
        ],
        uiVisibleByDefault: false,
        apiEnabledByDefault: false,
        apiRoutePrefixes: [
            '/api/v1/capabilities',
            '/api/v1/spirals',
            '/api/v1/taxonomy/c3',
            '/api/v1/taxonomy/spiral',
            '/api/v1/taxonomy/import-runs',
            '/api/v1/graph/c3-relations',
        ],
        uiRoutePrefixes: [
            '/capabilities',
            '/c3',
            '/spirals',
            '/administration/c3-ref',
            '/administration/c3-capability-builder',
        ],
        dbSlices: [
            '11_c3',
            '14_spiral_versioning',
            '17_spiral_membership',
            '19_capability_abbreviations',
            '20_capability_coverage_views',
            '25_capability_governance',
        ],
    },
    {
        code: MODULE_CODES.MANAGEMENT,
        label: 'Management Cockpit',
        kind: 'domain',
        mandatory: true,
        installOrder: 4,
        dependsOn: [
            MODULE_CODES.DATABASE,
            MODULE_CODES.CORE,
            MODULE_CODES.SERVICE_CATALOGUE,
        ],
        optionalIntegrations: [MODULE_CODES.C3],
        uiVisibleByDefault: true,
        apiEnabledByDefault: true,
        apiRoutePrefixes: [
            '/api/v1/dashboard',
            '/api/v1/governance',
            '/api/v1/portfolio',
            '/api/v1/readiness',
            '/api/v1/impact',
        ],
        uiRoutePrefixes: [
            '/cockpit/my-tasks',
            '/operations',
            '/portfolio',
        ],
        dbSlices: [
            '21_contract_governance',
            '22_governance_views',
            '23_service_portfolio',
            '24_readiness_rules',
            '26_governance_workflow',
            '27_impact_analysis',
            '28_enterprise_governance_contracts',
        ],
    },
]);

const MODULE_BY_CODE = new Map(MODULE_DEFINITIONS.map((definition) => [definition.code, definition]));

function normalizeModuleCode(moduleCode) {
    const raw = String(moduleCode || '').trim().toUpperCase();
    return MODULE_ALIASES[raw] || raw;
}

function getModuleDefinition(moduleCode) {
    return MODULE_BY_CODE.get(normalizeModuleCode(moduleCode)) || null;
}

function isKnownModuleCode(moduleCode) {
    return Boolean(getModuleDefinition(moduleCode));
}

function isModuleMandatoryByDefault(moduleCode) {
    return getModuleDefinition(moduleCode)?.mandatory === true;
}

function getInstallableModuleDefinitions() {
    return MODULE_DEFINITIONS
        .slice()
        .sort((a, b) => a.installOrder - b.installOrder);
}

function getModuleCodesForInstall({ activateC3 = false } = {}) {
    return getInstallableModuleDefinitions()
        .filter((definition) => definition.mandatory || (definition.code === MODULE_CODES.C3 && activateC3))
        .map((definition) => definition.code);
}

module.exports = {
    MODULE_CODES,
    MODULE_DEFINITIONS,
    getInstallableModuleDefinitions,
    getModuleCodesForInstall,
    getModuleDefinition,
    isKnownModuleCode,
    isModuleMandatoryByDefault,
    normalizeModuleCode,
};
