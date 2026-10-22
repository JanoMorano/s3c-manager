'use strict';

const { serviceScoreDetailed } = require('../services/scoring');

describe('completeness scoring', () => {
    test('counts a priced offering from flavours.repo (price_value)', () => {
        const result = serviceScoreDetailed({ title: 'Service' }, [{ price_value: 120 }]);
        expect(result.passed).toContain('has_rate');
    });

    test('has_rate fails when no flavour has a price', () => {
        const result = serviceScoreDetailed({ title: 'Service' }, [{ price_value: null }]);
        expect(result.failed).toContain('has_rate');
    });
});
