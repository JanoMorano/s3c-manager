'use strict';

const { C3_ROUTES, normalizeLegacyC3Path } = require('../utils/c3-routes');

describe('canonical C3 route normalization', () => {
    test('normalizes legacy list route', () => {
        expect(normalizeLegacyC3Path(C3_ROUTES.legacyList)).toBe(C3_ROUTES.list);
    });

    test('normalizes legacy dashboard route', () => {
        expect(normalizeLegacyC3Path(C3_ROUTES.legacyDashboard)).toBe(C3_ROUTES.dashboard);
    });

    test('normalizes legacy capability map route', () => {
        expect(normalizeLegacyC3Path(C3_ROUTES.legacyCapabilityMap)).toBe(C3_ROUTES.capabilityMap);
    });

    test('normalizes legacy capability map alias route', () => {
        expect(normalizeLegacyC3Path(C3_ROUTES.legacyCapabilityMapAlias)).toBe(C3_ROUTES.capabilityMap);
    });

    test('normalizes legacy detail route', () => {
        expect(normalizeLegacyC3Path('/admin/c3/123-uuid')).toBe('/c3/123-uuid');
    });

    test('normalizes legacy technology interactions route', () => {
        expect(normalizeLegacyC3Path(C3_ROUTES.legacyTechnologyInteractions)).toBe(C3_ROUTES.technologyInteractions);
    });

    test('normalizes legacy services route', () => {
        expect(normalizeLegacyC3Path(C3_ROUTES.legacyServices)).toBe(C3_ROUTES.services);
    });

    test('normalizes legacy data objects route', () => {
        expect(normalizeLegacyC3Path(C3_ROUTES.legacyDataObjects)).toBe(C3_ROUTES.dataObjects);
    });

    test('normalizes legacy applications route', () => {
        expect(normalizeLegacyC3Path(C3_ROUTES.legacyApplications)).toBe(C3_ROUTES.applications);
    });

    test('keeps canonical route unchanged', () => {
        expect(normalizeLegacyC3Path(C3_ROUTES.dashboard)).toBe(C3_ROUTES.dashboard);
    });

    test('exposes FMN Air C2 coverage route', () => {
        expect(C3_ROUTES.fmnAirC2).toBe('/c3/fmn-air-c2');
    });
});
