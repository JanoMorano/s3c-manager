'use strict';

const { buildSlug, parseSlug, SLUG_PATTERN } = require('../utils/capability-slug');

describe('capability slug util', () => {
    test('builds stable Air BMC slug', () => {
        const node = { title: 'Air Battlespace Management Capabilities', abbreviation: 'Air-BMC' };
        const parent = { title: 'Battlespace Management Capabilities', abbreviation: 'BMC' };
        expect(buildSlug(node, parent)).toBe('cap-bmc-air-bmc');
    });

    test('parses slug fragments', () => {
        expect(parseSlug('cap-bmc-air-bmc')).toEqual({ lvl2_abbr: 'bmc', lvl3_abbr: 'air-bmc' });
        expect(parseSlug('bad')).toBeNull();
    });

    test('known slugs match regex and are unique', () => {
        const slugs = ['cap-bmc-air-bmc', 'cap-cis-cis-sec', 'cap-imc-info-collect'];
        expect(new Set(slugs).size).toBe(slugs.length);
        slugs.forEach((slug) => expect(slug).toMatch(SLUG_PATTERN));
    });
});
