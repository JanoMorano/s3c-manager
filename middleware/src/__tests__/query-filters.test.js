'use strict';

const { parseCsvFilter, parseTextFilter, parseIntFilter } = require('../utils/query-filters');

describe('query filter parsing', () => {
    test('parseCsvFilter deduplicates and trims values', () => {
        expect(parseCsvFilter('draft, active ,draft')).toEqual(['draft', 'active']);
    });

    test('parseCsvFilter applies allowed list', () => {
        expect(parseCsvFilter('draft,unknown,active', { allowed: ['draft', 'active'] })).toEqual(['draft', 'active']);
    });

    test('parseTextFilter limits length', () => {
        expect(parseTextFilter('abcdef', { maxLength: 3 })).toBe('abc');
    });

    test('parseIntFilter clamps into range', () => {
        expect(parseIntFilter('999', { fallback: 10, min: 1, max: 100 })).toBe(100);
    });
});
