'use strict';

const {
    MODULE_CODES,
    getModuleDefinition,
} = require('./manifest');

function serializeDefinitionFields(definition) {
    return {
        kind:                  definition?.kind ?? null,
        depends_on:            definition?.dependsOn ?? [],
        optional_integrations: definition?.optionalIntegrations ?? [],
        api_route_prefixes:    definition?.apiRoutePrefixes ?? [],
        ui_route_prefixes:     definition?.uiRoutePrefixes ?? [],
        db_slices:             definition?.dbSlices ?? [],
        manifest_managed:      Boolean(definition),
    };
}

function serializeModuleDefinition(definition, { activateC3 = false } = {}) {
    if (!definition) return null;

    return {
        code:          definition.code,
        label:         definition.label,
        mandatory:     definition.mandatory === true,
        is_mandatory:  definition.mandatory === true,
        install_order: definition.installOrder,
        ui_visible:    definition.uiVisibleByDefault === true,
        api_enabled:   definition.apiEnabledByDefault === true,
        will_activate: definition.mandatory === true || (definition.code === MODULE_CODES.C3 && activateC3 === true),
        ...serializeDefinitionFields(definition),
    };
}

function serializeRegisteredModule(row) {
    const definition = getModuleDefinition(row?.module_code);

    return {
        code:              row?.module_code ?? null,
        label:             row?.module_label ?? definition?.label ?? null,
        mandatory:         row?.is_mandatory === true,
        is_mandatory:      row?.is_mandatory === true,
        enabled:           row?.enabled === true,
        schema_installed:  row?.schema_installed === true,
        seed_installed:    row?.reference_seed_installed === true,
        reference_seed_installed: row?.reference_seed_installed === true,
        ui_visible:        row?.ui_visible === true,
        api_enabled:       row?.api_enabled === true,
        version:           row?.version ?? null,
        install_order:     row?.install_order ?? definition?.installOrder ?? null,
        ...serializeDefinitionFields(definition),
    };
}

module.exports = {
    serializeModuleDefinition,
    serializeRegisteredModule,
};
