'use strict';

const fs = require('fs');
const path = require('path');

describe('governance import/export profiles', () => {
    test('defines direct and reference profiles explicitly', () => {
        const { PROFILES, getProfile } = require('../utils/service-catalogue-profile');

        expect(Object.keys(PROFILES)).toEqual(expect.arrayContaining([
            's3c-service-catalogue-json',
            's3c-service-catalogue-csv',
            'backstage-catalog-info',
            'archimate-reference',
            'itop-reference',
            'servicenow-csdm-reference',
        ]));
        expect(getProfile('backstage-catalog-info')).toEqual(expect.objectContaining({
            key: 'backstage-catalog-info',
            mode: 'direct',
        }));
        expect(getProfile('itop-reference')).toEqual(expect.objectContaining({
            mode: 'reference',
        }));
    });

    test('parses Backstage catalog-info into service import items', () => {
        const { parseBackstageCatalogInfo } = require('../utils/backstage-catalog');
        const yaml = fs.readFileSync(path.join(__dirname, '../../../testdata/examples/backstage-catalog-info.yaml'), 'utf8');

        const result = parseBackstageCatalogInfo(yaml);

        expect(result.items).toEqual([
            expect.objectContaining({
                service_id: 'SVC-IAM',
                title: 'Identity Access Management',
                service_type: 'service',
                service_status: 'production',
                service_owner: 'group:identity-platform',
                portfolio_group_code: 'mission-access',
            }),
        ]);
        expect(result.relations).toEqual([]);
    });

    test('generates Backstage catalog-info from service rows', () => {
        const { generateBackstageCatalogInfo } = require('../utils/backstage-catalog');

        const yaml = generateBackstageCatalogInfo([
            {
                service_id: 'SVC-IAM',
                title: 'Identity Access Management',
                summary: 'Governed identity and access service.',
                service_type: 'platform',
                lifecycle_stage_code: 'active',
                service_owner: 'group:identity-platform',
                portfolio_group: 'mission-access',
            },
        ]);

        expect(yaml).toContain('kind: Component');
        expect(yaml).toContain('name: svc-iam');
        expect(yaml).toContain('s3c/service-id: SVC-IAM');
        expect(yaml).toContain('owner: group:identity-platform');
    });
});
