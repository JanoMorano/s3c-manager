'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseArchimateXml, TYPE_TO_TARGET } = require('../parsers/archimate');

describe('ArchiMate XML parser', () => {
    test('parses a representative BusinessRole element', () => {
        const xml = fs.readFileSync(path.join(__dirname, 'fixtures/spiral6-business-roles-sample.xml'), 'utf8');
        const result = parseArchimateXml(xml, { targetKey: 'business-roles' });

        expect(result.row_count).toBe(1);
        expect(result.rows[0]).toMatchObject({
            uuid: '53f66c2a-e187-4956-9038-e9ce9fa3e8f0',
            title: 'Business Roles',
            description: 'Business roles represent skills and responsibilities.',
            external_id: 'BR-1000',
            item_type: 'BR',
            target_key: 'business-roles',
            provenance_raw: 'HQ SACT',
            data_qualifier: 'Unmarked',
        });
    });

    test('maps supported xsi:type values to taxonomy targets', () => {
        expect(TYPE_TO_TARGET.BusinessProcess).toEqual({ targetKey: 'business-processes', itemType: 'BP' });
        expect(TYPE_TO_TARGET.BusinessRole).toEqual({ targetKey: 'business-roles', itemType: 'BR' });
        expect(TYPE_TO_TARGET.COIService).toEqual({ targetKey: 'coi-services', itemType: 'CI' });
        expect(TYPE_TO_TARGET.CommunicationsService).toEqual({ targetKey: 'communications-services', itemType: 'CO' });
        expect(TYPE_TO_TARGET.CoreService).toEqual({ targetKey: 'core-services', itemType: 'CR' });
        expect(TYPE_TO_TARGET.UserApplication).toEqual({ targetKey: 'user-applications', itemType: 'UA' });
        expect(TYPE_TO_TARGET.Capability).toEqual({ targetKey: 'capabilities', itemType: 'CP' });
    });

    test('tolerates unknown propertyDefinitionRef values as warnings', () => {
        const xml = fs.readFileSync(path.join(__dirname, 'fixtures/spiral6-business-roles-sample.xml'), 'utf8');
        const result = parseArchimateXml(xml, { targetKey: 'business-roles' });

        expect(result.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ issue_code: 'UNKNOWN_ARCHIMATE_PROPERTY', field_name: 'propid-999' }),
        ]));
    });

    test('rejects non-ArchiMate XML with an informative error', () => {
        expect(() => parseArchimateXml('<root><item /></root>')).toThrow('ArchiMate parser: input is not an ArchiMate model with elements');
    });
});
