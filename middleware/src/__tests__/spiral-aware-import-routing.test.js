'use strict';

const { inferSpiralCode, detectTargetKey, validateSpiralSelection } = require('../utils/spiral-routing');

describe('spiral-aware import routing', () => {
    test('infers spiral codes from common filenames', () => {
        expect(inferSpiralCode('c3-applications-spiral6.csv')).toBe('Spiral_6');
        expect(inferSpiralCode('c3-taxonomy-capabilities-spiral7.xlsx')).toBe('Spiral_7');
        expect(inferSpiralCode('baseline-5-air.xml')).toBe('Spiral_5');
    });

    test('detects target keys from filenames', () => {
        expect(detectTargetKey('c3-applications-spiral6.csv')).toBe('c3-applications');
        expect(detectTargetKey('c3-data-objects.json')).toBe('c3-data-objects');
        expect(detectTargetKey('capabilities.xml')).toBe('c3-taxonomy');
    });

    test('blocks ambiguous or conflicting spiral selection', () => {
        expect(validateSpiralSelection({ inferred: null, selected: null }).ok).toBe(false);
        expect(validateSpiralSelection({ inferred: 'Spiral_6', selected: 'Spiral_7' }).issue).toBe('spiral_conflict');
        expect(validateSpiralSelection({ inferred: 'Spiral_6', selected: 'Spiral_7', allowOverride: true }).ok).toBe(true);
    });
});
