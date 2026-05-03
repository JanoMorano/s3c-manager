'use strict';

const servicesRepo = require('./services.repo');
const offeringsRepo = require('./offerings.repo');
const supportModelRepo = require('./support-model.repo');
const audienceRepo = require('./audience.repo');
const operationalLinksRepo = require('./operational-links.repo');
const flavoursRepo = require('./flavours.repo');
const relationsRepo = require('./relations.repo');
const auditRepo = require('./audit.repo');
const governanceRepo = require('./governance.repo');
const { getPool } = require('./pool');
const { getServiceReadiness } = require('../services/readiness');

function toNumber(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function hasText(value) {
    return typeof value === 'string' ? value.trim().length > 0 : value != null;
}

async function safeRead(read, fallback) {
    try {
        const result = await read();
        return result ?? fallback;
    } catch {
        return fallback;
    }
}

async function getRoleAssignments(serviceId) {
    const result = await getPool().query(`
        SELECT
            ra.id,
            ra.role_code,
            role_ref.name AS role_name,
            ra.display_name,
            ra.email,
            ra.organization_name,
            ra.valid_from,
            ra.valid_to
        FROM data.service_role_assignment ra
        JOIN data.service_catalog sc
          ON sc.id = ra.service_id
         AND sc.is_deleted = FALSE
        LEFT JOIN data.ref_service_role role_ref
          ON role_ref.code = ra.role_code
        WHERE sc.service_id = $1
        ORDER BY
            CASE WHEN ra.valid_to IS NULL THEN 0 ELSE 1 END,
            COALESCE(role_ref.sort_order, 999),
            ra.role_code ASC,
            ra.valid_from DESC
    `, [serviceId]);
    return result.rows;
}

async function getSlaRecords(serviceId) {
    const result = await getPool().query(`
        SELECT
            sl.id,
            sl.support_window_code,
            sl.availability_pct,
            sl.restoration_hours,
            sl.delivery_days,
            sl.priority_model_raw,
            sl.sla_note_raw,
            sl.source_field,
            sl.created_at,
            sl.updated_at,
            sf.flavour_code,
            sf.title AS flavour_title
        FROM data.service_sla sl
        INNER JOIN data.service_catalog sc
          ON sc.id = sl.service_id
         AND sc.service_id = $1
         AND sc.is_deleted = FALSE
        LEFT JOIN data.service_flavour sf
          ON sf.id = sl.flavour_id
         AND sf.is_deleted = FALSE
        ORDER BY CASE WHEN sl.flavour_id IS NULL THEN 0 ELSE 1 END, sl.id
    `, [serviceId]);
    return result.rows;
}

async function getC3Mappings(serviceId) {
    const result = await getPool().query(`
        SELECT
            scm.id,
            scm.c3_uuid,
            scm.mapping_type_code,
            scm.pace_code,
            scm.c3_level,
            scm.c3_domain,
            scm.c3_source,
            scm.is_primary,
            scm.mapping_note,
            scm.synced_at,
            scm.sync_status,
            ct.title AS c3_title,
            ct.external_id AS c3_external_id,
            ct.item_type AS c3_item_type,
            ct.item_status AS c3_item_status,
            rmt.name AS mapping_type_name,
            rpc.name AS pace_name
        FROM data.service_c3_mapping scm
        JOIN data.service_catalog sc
          ON sc.id = scm.service_id
         AND sc.is_deleted = FALSE
        LEFT JOIN data.c3_taxonomy ct
          ON ct.uuid = scm.c3_uuid
        LEFT JOIN data.ref_c3_mapping_type rmt
          ON rmt.code = scm.mapping_type_code
        LEFT JOIN data.ref_pace_category rpc
          ON rpc.code = scm.pace_code
        WHERE sc.service_id = $1
        ORDER BY scm.is_primary DESC, scm.c3_level DESC, scm.c3_domain ASC, ct.title ASC
    `, [serviceId]);
    return result.rows;
}

function currentRole(assignments, roleCode, fallbackName = null) {
    const found = assignments.find((item) => item.role_code === roleCode && item.valid_to == null);
    if (found) return found;
    if (!hasText(fallbackName)) return null;
    return {
        id: null,
        role_code: roleCode,
        role_name: null,
        display_name: fallbackName,
        email: null,
        organization_name: null,
        valid_from: null,
        valid_to: null,
    };
}

function buildOwners(service, assignments) {
    return {
        primary: currentRole(assignments, 'service_owner', service.service_owner),
        steward: currentRole(assignments, 'service_area_owner', service.vlastnik),
        delivery_manager: currentRole(assignments, 'service_delivery_manager', service.manager),
        reviewer: currentRole(assignments, 'service_reviewer', null),
        review_owner_user_id: service.review_owner_user_id ?? null,
        assignments,
    };
}

function buildPortfolio(service) {
    const code = service.portfolio_code ?? service.portfolio_group ?? null;
    const title = service.portfolio_title ?? service.portfolio_group_name ?? null;
    return {
        id: service.portfolio_id ?? null,
        code,
        title,
        group_code: service.portfolio_group ?? null,
        group_name: service.portfolio_group_name ?? null,
    };
}

function buildLifecycle(service) {
    return {
        stage_code: service.lifecycle_stage_code ?? null,
        state: service.lifecycle_state ?? null,
        service_status: service.service_status ?? null,
        service_status_name: service.service_status_name ?? null,
        criticality_code: service.criticality_code ?? null,
        requestable: service.requestable ?? null,
        review_due_at: service.review_due_at ?? service.next_review_due_at ?? null,
    };
}

function buildOfferings(offerings) {
    const primary = offerings.find((item) => item.is_default) ?? offerings[0] ?? null;
    return {
        count: offerings.length,
        requestable_count: offerings.filter((item) => item.requestable).length,
        primary,
        items: offerings,
    };
}

function buildSla(service, records) {
    const availability = toNumber(service.sla_availability);
    const restoration = toNumber(service.sla_restoration);
    const delivery = toNumber(service.sla_delivery);
    return {
        availability_pct: availability,
        restoration_hours: restoration,
        delivery_days: delivery,
        restoration_text: service.sla_restoration_text ?? null,
        delivery_text: service.sla_delivery_text ?? null,
        record_count: records.length,
        has_sla: availability != null || restoration != null || delivery != null || records.length > 0,
        records,
    };
}

function isActiveFlavour(flavour) {
    return ['available', 'active'].includes(String(flavour.flavour_status_code ?? '').toLowerCase());
}

function buildPricing(service, flavours, offerings) {
    const pricedFlavours = flavours.filter((item) => toNumber(item.price_value) != null);
    const hasServicePricingNote = hasText(service.pricing_note_raw) || hasText(service.service_cost_raw);
    const hasPrices = pricedFlavours.length > 0 || hasServicePricingNote;
    const requestable = Boolean(service.requestable) || offerings.some((item) => item.requestable);

    return {
        has_prices: hasPrices,
        requestable_without_price: requestable && !hasPrices,
        flavour_count: flavours.length,
        active_flavour_count: flavours.filter(isActiveFlavour).length,
        priced_flavour_count: pricedFlavours.length,
        currency_codes: [...new Set(flavours.map((item) => item.currency_code).filter(Boolean))],
        billing_period_codes: [...new Set(flavours.map((item) => item.billing_period_code).filter(Boolean))],
        service_cost_raw: service.service_cost_raw ?? null,
        pricing_note_raw: service.pricing_note_raw ?? null,
        flavours,
    };
}

function buildDependencies(serviceId, relations, rawDependencies) {
    const outgoing = relations
        .filter((item) => item.from_service_id === serviceId)
        .map((item) => ({ ...item, direction: 'outgoing' }));
    const incoming = relations
        .filter((item) => item.to_service_id === serviceId)
        .map((item) => ({ ...item, direction: 'incoming' }));

    return {
        total_count: relations.length,
        incoming_count: incoming.length,
        outgoing_count: outgoing.length,
        mandatory_count: relations.filter((item) => item.is_mandatory).length,
        unverified_count: relations.filter((item) => item.is_verified === false).length,
        incoming,
        outgoing,
        items: relations,
        raw_dependencies: rawDependencies ?? [],
    };
}

function normalizeC3Mappings(service, mappings) {
    if (mappings.length > 0) return mappings;
    if (!service.c3_uuid) return [];
    return [{
        id: null,
        c3_uuid: service.c3_uuid,
        mapping_type_code: service.c3_is_primary ? 'primary' : null,
        pace_code: null,
        c3_level: service.c3_level ?? null,
        c3_domain: service.c3_domain ?? null,
        c3_source: service.c3_source ?? null,
        is_primary: Boolean(service.c3_is_primary),
        mapping_note: null,
        synced_at: service.c3_synced_at ?? null,
        sync_status: service.c3_sync_status ?? null,
        c3_title: service.c3_reference ?? service.c3_uuid,
        c3_external_id: service.c3_reference ?? null,
        c3_item_type: 'CP',
        c3_item_status: null,
        mapping_type_name: null,
        pace_name: null,
    }];
}

function buildCapabilityMappings(service, mappings) {
    return normalizeC3Mappings(service, mappings)
        .filter((item) => item.c3_item_type == null || item.c3_item_type === 'CP' || Number(item.c3_level) === 3)
        .map((item) => ({
            mapping_id: item.id,
            c3_uuid: item.c3_uuid,
            code: item.c3_external_id ?? null,
            title: item.c3_title ?? item.c3_external_id ?? item.c3_uuid,
            mapping_type_code: item.mapping_type_code ?? null,
            mapping_type_name: item.mapping_type_name ?? null,
            pace_code: item.pace_code ?? null,
            pace_name: item.pace_name ?? null,
            c3_level: item.c3_level ?? null,
            c3_domain: item.c3_domain ?? null,
            is_primary: Boolean(item.is_primary),
            status: item.c3_item_status ?? null,
        }));
}

function buildGovernanceRisks(items) {
    const highSeverity = new Set(['P0', 'P1', 'critical', 'high']);
    return {
        count: items.length,
        high_count: items.filter((item) => highSeverity.has(String(item.severity ?? ''))).length,
        items,
    };
}

function buildAuditSummary(rows) {
    return {
        count: rows.length,
        last_action: rows[0] ?? null,
        recent: rows,
    };
}

function addMissing(actions, key, title, description, href, severity = 'warning') {
    actions.push({ key, title, description, href, severity });
}

function buildMissingActions({
    service,
    portfolio,
    lifecycle,
    owners,
    offerings,
    supportModels,
    sla,
    pricing,
    dependencies,
    capabilityMappings,
    readiness,
}) {
    const actions = [];
    const serviceHref = `/services/${service.service_id}/edit`;

    if (!owners.primary) {
        addMissing(actions, 'owner', 'Add service owner', 'Assign a primary owner so decisions and reviews have accountability.', `${serviceHref}#ownership`, 'blocker');
    }
    if (!portfolio.id && !portfolio.code) {
        addMissing(actions, 'portfolio', 'Place service in a portfolio', 'Portfolio assignment enables governance filtering and lifecycle review.', `${serviceHref}#governance`);
    }
    if (!lifecycle.stage_code && !lifecycle.state) {
        addMissing(actions, 'lifecycle', 'Set lifecycle stage', 'Lifecycle is required to distinguish draft, active, retiring, and retired services.', `${serviceHref}#governance`);
    }
    if (offerings.count === 0) {
        addMissing(actions, 'offering', 'Define at least one offering', 'Offerings explain how the service is consumed and requested.', `${serviceHref}#offerings`, 'blocker');
    }
    if (Boolean(service.requestable) && supportModels.length === 0) {
        addMissing(actions, 'support_model', 'Add support model', 'Requestable services need a support owner, resolver group, and support hours.', `${serviceHref}#support`);
    }
    if (!sla.has_sla) {
        addMissing(actions, 'sla', 'Add SLA summary', 'Availability, restoration, delivery, or SLA records are missing.', `${serviceHref}#sla`);
    }
    if (pricing.requestable_without_price) {
        addMissing(actions, 'pricing', 'Complete pricing', 'Requestable services need a price, cost note, or explicit pricing rationale.', `${serviceHref}#pricing`);
    }
    if (dependencies.total_count === 0) {
        addMissing(actions, 'dependencies', 'Classify dependencies', 'Dependency direction and impact are required for readiness and change decisions.', `${serviceHref}#dependencies`);
    }
    if (capabilityMappings.length === 0) {
        addMissing(actions, 'capability_mapping', 'Map primary capability', 'Capability or C3 mapping is required for coverage and FMN governance.', `${serviceHref}#c3`, 'blocker');
    }
    if (!lifecycle.review_due_at) {
        addMissing(actions, 'review_due', 'Set review due date', 'A review date keeps ownership and readiness decisions current.', `${serviceHref}#governance`);
    }
    if (readiness?.blockers?.length) {
        addMissing(actions, 'readiness_blockers', 'Resolve readiness blockers', readiness.blockers.join(' '), `/services/${service.service_id}#readiness`, 'blocker');
    }

    return actions;
}

async function getServiceOverview(serviceId) {
    const service = await servicesRepo.findByServiceId(serviceId);
    if (!service) return null;

    const catalogId = service.id;
    const [
        offerings,
        supportModels,
        audiencePolicies,
        operationalLinks,
        flavours,
        relations,
        roleAssignments,
        slaRecords,
        c3MappingsRaw,
        readiness,
        governanceRisksRaw,
        auditRows,
    ] = await Promise.all([
        safeRead(() => offeringsRepo.listByService(catalogId), []),
        safeRead(() => supportModelRepo.listByService(catalogId), []),
        safeRead(() => audienceRepo.listByService(catalogId), []),
        safeRead(() => operationalLinksRepo.listByService(catalogId), []),
        safeRead(() => flavoursRepo.findByService(serviceId), []),
        safeRead(() => relationsRepo.findByService(serviceId), []),
        safeRead(() => getRoleAssignments(serviceId), []),
        safeRead(() => getSlaRecords(serviceId), []),
        safeRead(() => getC3Mappings(serviceId), []),
        safeRead(() => getServiceReadiness(serviceId), null),
        safeRead(() => governanceRepo.listServiceRisks({ serviceId, limit: 10, offset: 0 }), []),
        safeRead(() => auditRepo.findByRecord('ServiceCatalog', serviceId, 10), []),
    ]);

    const portfolio = buildPortfolio(service);
    const lifecycle = buildLifecycle(service);
    const owners = buildOwners(service, roleAssignments);
    const offeringsSummary = buildOfferings(offerings);
    const sla = buildSla(service, slaRecords);
    const pricing = buildPricing(service, flavours, offerings);
    const dependencies = buildDependencies(serviceId, relations, service.dependencies ?? service.dependencies_json ?? []);
    const c3Mappings = normalizeC3Mappings(service, c3MappingsRaw);
    const capabilityMappings = buildCapabilityMappings(service, c3Mappings);
    const governanceRisks = buildGovernanceRisks(governanceRisksRaw);
    const auditSummary = buildAuditSummary(auditRows);
    const missingActions = buildMissingActions({
        service,
        portfolio,
        lifecycle,
        owners,
        offerings: offeringsSummary,
        supportModels,
        sla,
        pricing,
        dependencies,
        capabilityMappings,
        readiness,
    });

    return {
        service: {
            id: service.id,
            service_id: service.service_id,
            title: service.title,
            summary: service.summary ?? null,
            service_type: service.service_type ?? null,
            service_type_name: service.service_type_name ?? null,
            service_status: service.service_status ?? null,
            service_status_name: service.service_status_name ?? null,
            updated_at: service.updated_at ?? null,
        },
        portfolio,
        lifecycle,
        owners,
        offerings: offeringsSummary,
        flavours,
        audience_policies: audiencePolicies,
        support_model: supportModels,
        operational_links: operationalLinks,
        sla,
        pricing,
        dependencies,
        capability_mappings: capabilityMappings,
        c3_mappings: c3Mappings,
        readiness,
        governance_risks: governanceRisks,
        audit_summary: auditSummary,
        missing_actions: missingActions,
    };
}

module.exports = {
    getServiceOverview,
};
