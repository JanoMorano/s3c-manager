'use strict';

const {
    validateCreate,
    validateUpdate,
    validateOffering,
    validateOperationalLink,
    validateLifecycleTransition,
    validateLifecycleOperationalReadiness,
} = require('../services/validation');

describe('services phase 1 validation', () => {
    test('validateCreate requires request channel for requestable service', () => {
        const errors = validateCreate({
            title: 'Example service',
            service_id: 'SVC-1',
            service_type: 'CF',
            requestable: true,
        });

        expect(errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'requestable' }),
        ]));
    });

    test('validateUpdate respects existing request channel when requestable stays true', () => {
        const errors = validateUpdate(
            { requestable: true },
            { request_channel_url: 'https://example.test/request' },
        );

        expect(errors).toHaveLength(0);
    });

    test('validateOffering requires request channel for requestable offering', () => {
        const errors = validateOffering({
            offering_code: 'STD',
            title: 'Standard',
            requestable: true,
        }, { isCreate: true });

        expect(errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'requestable' }),
        ]));
    });

    test('validateOperationalLink rejects invalid URLs', () => {
        const errors = validateOperationalLink({
            title: 'Runbook',
            url: 'ftp://invalid.example.test',
        }, { isCreate: true });

        expect(errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'url' }),
        ]));
    });

    test('validateLifecycleTransition blocks invalid lifecycle jump', () => {
        const errors = validateLifecycleTransition('live', 'draft');

        expect(errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'lifecycle_state' }),
        ]));
    });

    test('validateLifecycleTransition maps legacy review states before transition checks', () => {
        expect(validateLifecycleTransition('under_review', 'live')).toHaveLength(0);
        expect(validateLifecycleTransition('approved', 'live')).toHaveLength(0);
        expect(validateLifecycleTransition('active', 'deprecated')).toHaveLength(0);
    });

    test('validateLifecycleOperationalReadiness blocks live requestable service without support model and offering', () => {
        const errors = validateLifecycleOperationalReadiness(
            { lifecycle_state: 'live', requestable: true },
            { offeringCount: 0, supportModelCount: 0 },
        );

        expect(errors).toEqual(expect.arrayContaining([
            expect.objectContaining({
                field: 'lifecycle_state',
                message: expect.stringContaining('offering'),
            }),
            expect.objectContaining({
                field: 'lifecycle_state',
                message: expect.stringContaining('support model'),
            }),
        ]));
    });
});
