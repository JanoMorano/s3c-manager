'use strict';

const {
    MODULE_CODES,
    getModuleDefinition,
} = require('../modules/manifest');
const {
    serializeModuleDefinition,
    serializeRegisteredModule,
} = require('../modules/module-serialization');

describe('module serialization', () => {
    test('serializes optional C3 definition with activation plan metadata', () => {
        const payload = serializeModuleDefinition(getModuleDefinition(MODULE_CODES.C3), {
            activateC3: true,
        });

        expect(payload).toEqual(expect.objectContaining({
            code: MODULE_CODES.C3,
            mandatory: false,
            is_mandatory: false,
            kind: 'domain',
            will_activate: true,
            manifest_managed: true,
        }));
        expect(payload.depends_on).toEqual([
            MODULE_CODES.DATABASE,
            MODULE_CODES.CORE,
            MODULE_CODES.SERVICE_CATALOGUE,
        ]);
        expect(payload.api_route_prefixes).toContain('/api/v1/taxonomy/c3');
        expect(payload.ui_route_prefixes).toContain('/capabilities');
    });

    test('serializes registry row with manifest-owned management metadata', () => {
        const payload = serializeRegisteredModule({
            module_code: MODULE_CODES.MANAGEMENT,
            module_label: 'Management Cockpit',
            is_mandatory: true,
            enabled: true,
            schema_installed: true,
            reference_seed_installed: true,
            ui_visible: true,
            api_enabled: true,
            version: '1.0.0',
            install_order: 4,
        });

        expect(payload).toEqual(expect.objectContaining({
            code: MODULE_CODES.MANAGEMENT,
            mandatory: true,
            is_mandatory: true,
            enabled: true,
            kind: 'domain',
            seed_installed: true,
            manifest_managed: true,
        }));
        expect(payload.optional_integrations).toContain(MODULE_CODES.C3);
        expect(payload.db_slices).toContain('27_impact_analysis');
    });
});
