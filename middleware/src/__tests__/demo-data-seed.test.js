'use strict';

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const {
    DEMO_UUIDS,
    buildDemoFlavours,
    buildDemoGovernanceFixtures,
    buildDemoOfferings,
    buildDemoRelations,
    buildDemoServiceC3Mappings,
    buildDemoServices,
    resolveDemoSeedLocale,
} = require('../utils/demo-data-seed');

test('buildDemoServices returns English demo copy when requested', () => {
    const services = buildDemoServices('en');

    expect(services).toHaveLength(8);
    expect(services[0].short_description).toBe('Central integration platform for exchanging data and messages between systems.');
    expect(services[0].description).toContain('robust middleware for integrating heterogeneous systems');
    expect(services[0].ordering_note).toContain('Request via ServiceNow');
    expect(services[1].business_purpose).toContain('secure access to applications and data');
    expect(services[1].sla_restoration_text).toContain('Critical authentication path');
    expect(services[2].scope_text).toContain('operational reporting');
    expect(JSON.parse(services[2].notes_json).review_notes).toContain('Planned migration');
});

test('buildDemoServices keeps Czech demo copy as the fallback locale', () => {
    const services = buildDemoServices('cs');

    expect(services[0].short_description).toContain('integrační platforma');
    expect(services[1].short_description).toContain('Správa identit');
});

test('demo service portfolio covers lifecycle and readiness states', () => {
    const services = buildDemoServices('en');
    const statuses = new Set(services.map((service) => service.service_status_code));
    const lifecycleStages = new Set(services.map((service) => service.lifecycle_stage_code));
    const portfolios = new Set(services.map((service) => service.portfolio_group_code));

    expect([...statuses]).toEqual(expect.arrayContaining(['active', 'planned', 'draft', 'deprecated', 'retired']));
    expect([...lifecycleStages]).toEqual(expect.arrayContaining(['active', 'design', 'retiring', 'retired']));
    expect(portfolios.size).toBeGreaterThanOrEqual(2);
    expect(services.filter((service) => service.requestable).length).toBeGreaterThanOrEqual(5);
    expect(services.some((service) => service.service_id === 'DEMO-RPA-004')).toBe(true);
});

test('demo fixtures cover offerings, mappings, governance workflow and impact chain', () => {
    const flavours = buildDemoFlavours();
    const offerings = buildDemoOfferings();
    const mappings = buildDemoServiceC3Mappings();
    const relations = buildDemoRelations();
    const governance = buildDemoGovernanceFixtures();

    expect(flavours).toHaveLength(12);
    expect(offerings).toHaveLength(12);
    expect(mappings).toEqual(expect.arrayContaining([
        expect.objectContaining({ c3_uuid: DEMO_UUIDS.CAP_CP, type: 'primary', is_primary: true }),
        expect.objectContaining({ c3_uuid: DEMO_UUIDS.CAP_CP, type: 'supports', is_primary: false }),
        expect.objectContaining({ c3_uuid: DEMO_UUIDS.CAP_RPA, type: 'primary', service_id: 'DEMO-RPA-004' }),
    ]));
    expect(mappings.some((mapping) => mapping.c3_uuid === DEMO_UUIDS.CAP_GAP)).toBe(false);
    expect(relations).toEqual(expect.arrayContaining([
        expect.objectContaining({ from: 'DEMO-OBS-007', to: 'DEMO-RPA-004' }),
        expect.objectContaining({ from: 'DEMO-RPA-004', to: 'DEMO-DAP-003' }),
        expect.objectContaining({ from: 'DEMO-DAP-003', to: 'DEMO-PIS-001' }),
    ]));
    expect(governance.readinessExceptions).toHaveLength(1);
    expect(governance.reviews.length).toBeGreaterThanOrEqual(4);
    expect(governance.decisions.length).toBeGreaterThanOrEqual(4);
});

test('resolveDemoSeedLocale falls back to the system locale when no explicit locale is given', () => {
    const originalLang = process.env.LANG;
    const originalLcAll = process.env.LC_ALL;
    const originalLcMessages = process.env.LC_MESSAGES;

    try {
        delete process.env.LC_ALL;
        delete process.env.LC_MESSAGES;
        process.env.LANG = 'en_US.UTF-8';

        expect(resolveDemoSeedLocale()).toBe('en');
        expect(resolveDemoSeedLocale('cz')).toBe('cs');
    } finally {
        if (typeof originalLang === 'undefined') {
            delete process.env.LANG;
        } else {
            process.env.LANG = originalLang;
        }

        if (typeof originalLcAll === 'undefined') {
            delete process.env.LC_ALL;
        } else {
            process.env.LC_ALL = originalLcAll;
        }

        if (typeof originalLcMessages === 'undefined') {
            delete process.env.LC_MESSAGES;
        } else {
            process.env.LC_MESSAGES = originalLcMessages;
        }
    }
});
