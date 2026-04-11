'use strict';

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const { buildDemoServices, resolveDemoSeedLocale } = require('../utils/demo-data-seed');

test('buildDemoServices returns English demo copy when requested', () => {
    const services = buildDemoServices('en');

    expect(services).toHaveLength(3);
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
