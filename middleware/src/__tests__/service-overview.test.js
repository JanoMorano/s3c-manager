'use strict';

jest.mock('../db/services.repo', () => ({
    findByServiceId: jest.fn(),
}));
jest.mock('../db/offerings.repo', () => ({
    listByService: jest.fn(),
}));
jest.mock('../db/support-model.repo', () => ({
    listByService: jest.fn(),
}));
jest.mock('../db/audience.repo', () => ({
    listByService: jest.fn(),
}));
jest.mock('../db/operational-links.repo', () => ({
    listByService: jest.fn(),
}));
jest.mock('../db/flavours.repo', () => ({
    findByService: jest.fn(),
}));
jest.mock('../db/relations.repo', () => ({
    findByService: jest.fn(),
}));
jest.mock('../db/audit.repo', () => ({
    findByRecord: jest.fn(),
}));
jest.mock('../services/readiness', () => ({
    getServiceReadiness: jest.fn(),
}));
jest.mock('../db/pool', () => ({
    getPool: jest.fn(() => ({ query: jest.fn() })),
}));

const servicesRepo = require('../db/services.repo');
const offeringsRepo = require('../db/offerings.repo');
const supportModelRepo = require('../db/support-model.repo');
const audienceRepo = require('../db/audience.repo');
const operationalLinksRepo = require('../db/operational-links.repo');
const flavoursRepo = require('../db/flavours.repo');
const relationsRepo = require('../db/relations.repo');
const auditRepo = require('../db/audit.repo');
const readiness = require('../services/readiness');
const { getPool } = require('../db/pool');

function setupPoolRows({ roles = [], sla = [], mappings = [] } = {}) {
    const query = jest.fn(async (sql) => {
        const text = String(sql);
        if (text.includes('FROM data.service_role_assignment')) return { rows: roles };
        if (text.includes('FROM data.service_sla')) return { rows: sla };
        if (text.includes('FROM data.service_c3_mapping')) return { rows: mappings };
        return { rows: [] };
    });
    getPool.mockReturnValue({ query });
    return query;
}

function baseService(overrides = {}) {
    return {
        id: 42,
        service_id: 'SVC-IAM',
        title: 'Identity Access Management',
        summary: 'Identity and access service.',
        service_status: 'active',
        service_status_name: 'Active',
        service_type: 'platform',
        portfolio_id: 3,
        portfolio_code: 'APP',
        portfolio_title: 'Application Services',
        portfolio_group: 'APP',
        portfolio_group_name: 'Application Services',
        lifecycle_state: 'live',
        lifecycle_stage_code: 'active',
        criticality_code: 'mission_critical',
        requestable: true,
        review_due_at: '2026-06-30',
        next_review_due_at: '2026-06-30',
        service_owner: 'Alice Owner',
        vlastnik: 'Bob Steward',
        manager: 'Carol Delivery',
        sla_availability: 99.9,
        sla_restoration: 4,
        sla_delivery: 2,
        c3_uuid: 'cap-iam',
        c3_reference: 'C3-IAM',
        c3_level: 3,
        c3_domain: 'FMN',
        c3_is_primary: true,
        updated_at: '2026-04-28T10:00:00Z',
        ...overrides,
    };
}

describe('service overview repository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setupPoolRows();
    });

    test('builds a complete Service 360 aggregate', async () => {
        servicesRepo.findByServiceId.mockResolvedValue(baseService());
        offeringsRepo.listByService.mockResolvedValue([
            {
                id: 10,
                offering_code: 'STD',
                title: 'Standard Access',
                is_default: true,
                requestable: true,
                approval_required: true,
                request_channel_type: 'portal',
                request_channel_url: 'https://request.example/iam',
                lead_time_text: '2 business days',
                status: 'active',
            },
        ]);
        supportModelRepo.listByService.mockResolvedValue([
            { id: 20, support_owner_name: 'IAM Support', resolver_group: 'IAM-L2', support_hours_code: '24x7' },
        ]);
        audienceRepo.listByService.mockResolvedValue([
            { id: 30, audience_type: 'internal', business_unit: 'All' },
        ]);
        operationalLinksRepo.listByService.mockResolvedValue([
            { id: 40, link_type: 'monitoring', title: 'Dashboard', url: 'https://monitor.example' },
        ]);
        flavoursRepo.findByService.mockResolvedValue([
            {
                id: 50,
                flavour_code: 'IAM-BASIC',
                title: 'Basic',
                price_value: 10,
                currency_code: 'EUR',
                billing_period_code: 'monthly',
                flavour_status_code: 'available',
                is_orderable: true,
            },
        ]);
        relationsRepo.findByService.mockResolvedValue([
            {
                id: 60,
                from_service_id: 'SVC-IAM',
                to_service_id: 'SVC-DIR',
                relation_type: 'depends_on',
                is_mandatory: true,
                impact_level: 'high',
                is_verified: true,
            },
            {
                id: 61,
                from_service_id: 'SVC-PORTAL',
                to_service_id: 'SVC-IAM',
                relation_type: 'uses',
                is_mandatory: false,
                impact_level: 'medium',
                is_verified: false,
            },
        ]);
        setupPoolRows({
            roles: [
                { id: 1, role_code: 'service_owner', display_name: 'Alice Owner', email: 'alice@example.com', organization_name: 'Apps', valid_to: null },
                { id: 2, role_code: 'service_reviewer', display_name: 'Rita Reviewer', email: 'rita@example.com', organization_name: 'Architecture', valid_to: null },
            ],
            sla: [
                { id: 70, support_window_code: '24x7', availability_pct: 99.9, restoration_hours: 4, delivery_days: 2 },
            ],
            mappings: [
                {
                    id: 80,
                    c3_uuid: 'cap-iam',
                    mapping_type_code: 'primary',
                    is_primary: true,
                    pace_code: 'P1',
                    c3_level: 3,
                    c3_domain: 'FMN',
                    c3_title: 'Provide Identity Services',
                    c3_external_id: 'C3-IAM',
                    c3_item_type: 'CP',
                    c3_item_status: 'active',
                },
            ],
        });
        readiness.getServiceReadiness.mockResolvedValue({
            service_id: 'SVC-IAM',
            is_publishable: true,
            blockers: [],
            warnings: [],
        });
        auditRepo.findByRecord.mockResolvedValue([
            { id: 90, action: 'UPDATE', performed_by: 'admin', performed_at: '2026-04-28T12:00:00Z' },
        ]);

        const { getServiceOverview } = require('../db/service-overview.repo');
        const overview = await getServiceOverview('SVC-IAM');

        expect(overview.service).toEqual(expect.objectContaining({
            service_id: 'SVC-IAM',
            title: 'Identity Access Management',
        }));
        expect(overview.portfolio).toEqual(expect.objectContaining({
            code: 'APP',
            title: 'Application Services',
        }));
        expect(overview.lifecycle).toEqual(expect.objectContaining({
            stage_code: 'active',
            criticality_code: 'mission_critical',
            review_due_at: '2026-06-30',
        }));
        expect(overview.owners.primary).toEqual(expect.objectContaining({
            display_name: 'Alice Owner',
            role_code: 'service_owner',
        }));
        expect(overview.offerings).toEqual(expect.objectContaining({
            count: 1,
            primary: expect.objectContaining({ offering_code: 'STD' }),
        }));
        expect(overview.pricing).toEqual(expect.objectContaining({
            has_prices: true,
            priced_flavour_count: 1,
        }));
        expect(overview.dependencies).toEqual(expect.objectContaining({
            incoming_count: 1,
            outgoing_count: 1,
        }));
        expect(overview.capability_mappings[0]).toEqual(expect.objectContaining({
            c3_uuid: 'cap-iam',
            title: 'Provide Identity Services',
            is_primary: true,
        }));
        expect(overview.readiness).toEqual(expect.objectContaining({ is_publishable: true }));
        expect(overview.governance_risks.count).toBe(0);
        expect(overview.audit_summary.recent).toHaveLength(1);
        expect(overview.missing_actions).toEqual([]);
    });

    test('returns null for an unknown service id', async () => {
        servicesRepo.findByServiceId.mockResolvedValue(null);

        const { getServiceOverview } = require('../db/service-overview.repo');
        const overview = await getServiceOverview('MISSING');

        expect(overview).toBeNull();
        expect(offeringsRepo.listByService).not.toHaveBeenCalled();
    });

    test('surfaces missing governance data as action items', async () => {
        servicesRepo.findByServiceId.mockResolvedValue(baseService({
            portfolio_id: null,
            portfolio_code: null,
            portfolio_title: null,
            portfolio_group: null,
            portfolio_group_name: null,
            lifecycle_state: null,
            lifecycle_stage_code: null,
            review_due_at: null,
            next_review_due_at: null,
            service_owner: null,
            vlastnik: null,
            manager: null,
            sla_availability: null,
            sla_restoration: null,
            sla_delivery: null,
            c3_uuid: null,
            c3_reference: null,
            requestable: true,
        }));
        offeringsRepo.listByService.mockResolvedValue([]);
        supportModelRepo.listByService.mockResolvedValue([]);
        audienceRepo.listByService.mockResolvedValue([]);
        operationalLinksRepo.listByService.mockResolvedValue([]);
        flavoursRepo.findByService.mockResolvedValue([]);
        relationsRepo.findByService.mockResolvedValue([]);
        setupPoolRows({ roles: [], sla: [], mappings: [] });
        readiness.getServiceReadiness.mockResolvedValue({
            service_id: 'SVC-IAM',
            is_publishable: false,
            blockers: ['Service has no primary C3 capability.'],
            warnings: [],
        });
        auditRepo.findByRecord.mockResolvedValue([]);

        const { getServiceOverview } = require('../db/service-overview.repo');
        const overview = await getServiceOverview('SVC-IAM');

        expect(overview.missing_actions).toEqual(expect.arrayContaining([
            expect.objectContaining({ key: 'owner' }),
            expect.objectContaining({ key: 'portfolio' }),
            expect.objectContaining({ key: 'offering' }),
            expect.objectContaining({ key: 'sla' }),
            expect.objectContaining({ key: 'pricing' }),
            expect.objectContaining({ key: 'dependencies' }),
            expect.objectContaining({ key: 'capability_mapping' }),
            expect.objectContaining({ key: 'review_due' }),
        ]));
        expect(overview.readiness.is_publishable).toBe(false);
        expect(overview.governance_risks.high_count).toBe(1);
        expect(overview.offerings.count).toBe(0);
        expect(overview.pricing.requestable_without_price).toBe(true);
    });
});
