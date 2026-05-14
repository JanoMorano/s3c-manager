'use strict';

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const {
    DEMO_CAPABILITY_MAP_SPIRALS,
    DEMO_UUIDS,
    seedDemoData,
    buildDemoFlavours,
    buildDemoGovernanceFixtures,
    buildDemoOfferings,
    buildDemoRelations,
    buildDemoServiceC3Mappings,
    buildDemoServices,
    removeDemoData,
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
    const lifecycleStates = new Set(services.map((service) => service.lifecycle_state));
    const portfolios = new Set(services.map((service) => service.portfolio_group_code));

    expect([...statuses]).toEqual(expect.arrayContaining(['active', 'planned', 'draft', 'deprecated', 'retired']));
    expect([...lifecycleStates]).toEqual(expect.arrayContaining(['draft', 'live', 'deprecated', 'retired']));
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
        expect.objectContaining({ c3_uuid: DEMO_UUIDS.CAP_CP, type: 'primary', is_primary: true, service_id: 'DEMO-PIS-001' }),
        expect.objectContaining({ c3_uuid: DEMO_UUIDS.CAP_IDENTITY, type: 'primary', is_primary: true, service_id: 'DEMO-IAM-002' }),
        expect.objectContaining({ c3_uuid: DEMO_UUIDS.CAP_DATA, type: 'primary', is_primary: true, service_id: 'DEMO-DAP-003' }),
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

test('demo C3 mappings give every demo service one level 3 portfolio capability and full C3 context', () => {
    const services = buildDemoServices('en').map((service) => service.service_id);
    const mappings = buildDemoServiceC3Mappings();
    const requiredContextDomains = [
        'BusinessProcesses',
        'BusinessRoles',
        'COIServices',
        'CommunicationsServices',
        'CoreServices',
        'InformationProducts',
        'UserApplications',
    ];

    for (const serviceId of services) {
        const serviceMappings = mappings.filter((mapping) => mapping.service_id === serviceId);
        const level3PortfolioMappings = serviceMappings.filter((mapping) => mapping.domain === 'Capabilities' && mapping.level === 3);
        const contextDomains = new Set(serviceMappings.map((mapping) => mapping.domain));

        expect(level3PortfolioMappings).toHaveLength(1);
        expect(level3PortfolioMappings[0].is_primary).toBe(true);
        for (const domain of requiredContextDomains) {
            expect(contextDomains.has(domain)).toBe(true);
        }
    }
});

test('demo seed emits 3 level 2 and 4 level 3 portfolio capability rows', async () => {
    const queries = [];
    const pool = {
        query: jest.fn(async (sql, params = []) => {
            queries.push({ sql: String(sql), params });
            return { rows: [], rowCount: 0 };
        }),
    };

    const result = await seedDemoData(pool, { locale: 'en' });
    const builderRows = queries.filter((query) => query.sql.includes('INSERT INTO data.c3_capability_builder'));
    const level2PortfolioRows = builderRows.filter((query) => query.params[4] === 2 && query.params[5] === 'Capabilities' && query.params[6] === 'Spiral_7');
    const level3PortfolioRows = builderRows.filter((query) => query.params[4] === 3 && query.params[5] === 'Capabilities' && query.params[6] === 'Spiral_7');

    expect(result).toEqual({ ok: true });
    expect(level2PortfolioRows.map((query) => query.params[0]).sort()).toEqual([
        'DEMO-CP-L2-DATA-S7',
        'DEMO-CP-L2-OPS-S7',
        'DEMO-CP-L2-S7',
    ]);
    expect(level3PortfolioRows.map((query) => query.params[0]).sort()).toEqual([
        'DEMO-CP-001',
        'DEMO-CP-002',
        'DEMO-CP-003',
        'DEMO-CP-004',
    ]);
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

test('removeDemoData clears demo C3 mappings, capabilities and capability-map objects across Spirals 4-7', async () => {
    const queries = [];
    const pool = {
        query: jest.fn(async (sql, params = []) => {
            queries.push({ sql: String(sql), params });
            return { rows: [], rowCount: 0 };
        }),
    };

    const result = await removeDemoData(pool);
    const sqlText = queries.map((query) => query.sql).join('\n');

    expect(result).toEqual({ ok: true });
    expect(sqlText).toContain('DELETE FROM data.service_c3_mapping');
    expect(sqlText).toContain('DELETE FROM data.c3_entity_spiral_membership');
    expect(sqlText).toContain('DELETE FROM data.c3_capability_builder');
    expect(sqlText).toContain('DELETE FROM data.c3_taxonomy');
    expect(sqlText).toContain('DELETE FROM data.c3_application');
    expect(sqlText).toContain('DELETE FROM data.c3_data_object');
    expect(sqlText).toContain('DELETE FROM data.c3_service');
    expect(sqlText).toContain('DELETE FROM data.c3_technology_interaction');
    expect(sqlText).toContain('c3_application_id IN');
    expect(sqlText).toContain('c3_tin_id IN');
    expect(sqlText).toContain('c3_data_object_id IN');
    expect(sqlText).toContain('c3_service_id IN');

    const builderCleanup = queries.find((query) => query.sql.includes('remove-demo-spirals-4-7') || query.sql.includes('fmn_spiral = ANY'));
    expect(builderCleanup?.params[0]).toEqual(DEMO_CAPABILITY_MAP_SPIRALS);
    expect(builderCleanup?.sql).toContain("page_id LIKE 'DEMO-%'");
    expect(builderCleanup?.sql).toContain("uuid LIKE 'demo-%'");
    expect(builderCleanup?.sql).toContain("title LIKE '[DEMO]%'");

    const membershipCleanup = queries.find((query) => query.sql.includes('c3_entity_spiral_membership'));
    expect(membershipCleanup?.params[0]).toEqual(DEMO_CAPABILITY_MAP_SPIRALS);
    expect(membershipCleanup?.params[1]).toEqual(expect.arrayContaining([DEMO_UUIDS.CAP_CP, DEMO_UUIDS.CAP_RPA]));
});
