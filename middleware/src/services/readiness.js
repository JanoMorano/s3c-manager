'use strict';

const repo = require('../db/readiness.repo');

function isActiveServiceStatus(status) {
    return String(status ?? '').toLowerCase() === 'active';
}

function toCount(value) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function hasValue(value) {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
}

function hasNonExpiredException(exception, now = new Date()) {
    if (!exception) return false;
    if (!exception.expires_at) return true;
    const expiresAt = new Date(exception.expires_at);
    return Number.isNaN(expiresAt.getTime()) ? false : expiresAt >= now;
}

function normalizeException(exception, now = new Date()) {
    if (!exception) return null;
    return {
        id: exception.id ?? null,
        rule_key: exception.rule_key,
        reason: exception.reason ?? null,
        expires_at: exception.expires_at ?? null,
        approved_by: exception.approved_by ?? null,
        created_at: exception.created_at ?? null,
        expired: !hasNonExpiredException(exception, now),
    };
}

function lifecycleMatches(rule, row) {
    const stages = rule.applies_to_lifecycle_stage;
    if (!Array.isArray(stages) || stages.length === 0) return true;
    const current = [row.lifecycle_stage_code, row.lifecycle_state, row.service_status]
        .filter(Boolean)
        .map((item) => String(item).toLowerCase());
    return stages.map((item) => String(item).toLowerCase()).some((stage) => current.includes(stage));
}

const RULE_EVALUATORS = {
    service_has_owner: (row) => toCount(row.owner_count) > 0,
    service_has_offering: (row) => toCount(row.offering_count) > 0 || toCount(row.active_flavour_count) > 0,
    service_has_lifecycle_stage: (row) => hasValue(row.lifecycle_stage_code) || hasValue(row.lifecycle_state) || hasValue(row.service_status),
    service_has_primary_capability_mapping: (row) => toCount(row.primary_mapping_count) === 1 && hasValue(row.primary_c3_uuid),
    service_has_complete_primary_capability: (row) => Boolean(row.has_complete_primary_capability),
    service_has_sla: (row) => (
        hasValue(row.sla_availability)
        || hasValue(row.sla_restoration)
        || hasValue(row.sla_delivery)
        || toCount(row.sla_record_count) > 0
    ),
    service_has_dependency_classification: (row) => toCount(row.dependency_relation_count) > 0,
    service_has_relations: (row) => toCount(row.relation_count) > 0,
    service_has_review_date: (row) => hasValue(row.review_due_at) || hasValue(row.next_review_due_at),
    requestable_service_has_pricing: (row) => {
        if (!row.requestable) return true;
        return toCount(row.priced_flavour_count) > 0 || Boolean(row.has_price_note);
    },
};

function evaluateOneRule(row, rule, exception, now = new Date()) {
    const base = {
        rule_key: rule.rule_key,
        title: rule.title,
        description: rule.description ?? null,
        title_text: rule.title_text ?? rule.title,
        why_text: rule.why_text ?? rule.description ?? null,
        howto_text: rule.howto_text ?? null,
        evidence_hint: rule.evidence_hint ?? null,
        severity: rule.severity ?? 'P2',
        blocking: Boolean(rule.blocking),
        enabled: Boolean(rule.enabled),
        status: 'passed',
        message: rule.title,
        exception: null,
    };

    if (!rule.enabled) {
        return { ...base, status: 'disabled', blocking: false, message: `${rule.title} is disabled` };
    }

    if (!lifecycleMatches(rule, row)) {
        return { ...base, status: 'skipped', blocking: false, message: `${rule.title} does not apply to this lifecycle stage` };
    }

    const evaluator = RULE_EVALUATORS[rule.rule_key];
    const passed = evaluator ? Boolean(evaluator(row)) : true;
    if (passed) return base;

    const normalizedException = normalizeException(exception, now);
    if (normalizedException && !normalizedException.expired) {
        return {
            ...base,
            status: 'exception',
            message: rule.title,
            exception: normalizedException,
        };
    }

    return {
        ...base,
        status: 'failed',
        message: rule.title,
        exception: normalizedException,
    };
}

function buildLegacyReadiness(row, ruleResults = []) {
    const blockers = ruleResults
        .filter((item) => item.status === 'failed' && item.blocking)
        .map((item) => item.message);
    const warnings = ruleResults
        .filter((item) => item.status === 'failed' && !item.blocking)
        .map((item) => item.message);

    return {
        service_pk: row.service_pk,
        service_id: row.service_id,
        title: row.title,
        service_status: row.service_status,
        primary_mapping_count: toCount(row.primary_mapping_count),
        primary_c3_uuid: row.primary_c3_uuid ?? null,
        primary_c3_title: row.primary_c3_title ?? null,
        primary_c3_code: row.primary_c3_code ?? null,
        primary_c3_completeness_status: row.primary_c3_completeness_status ?? 'incomplete',
        primary_c3_app_count: toCount(row.primary_c3_app_count),
        primary_c3_data_object_count: toCount(row.primary_c3_data_object_count),
        primary_c3_tin_count: toCount(row.primary_c3_tin_count),
        primary_c3_c3_service_count: toCount(row.primary_c3_c3_service_count),
        primary_c3_service_mapping_count: toCount(row.primary_c3_service_mapping_count),
        active_flavour_count: toCount(row.active_flavour_count),
        relation_count: toCount(row.relation_count),
        dependency_relation_count: toCount(row.dependency_relation_count),
        has_single_primary_mapping: Boolean(row.has_single_primary_mapping),
        has_complete_primary_capability: Boolean(row.has_complete_primary_capability),
        has_active_flavour: Boolean(row.has_active_flavour),
        is_publishable: blockers.length === 0,
        blockers,
        warnings,
    };
}

function evaluateServiceReadinessState(row, rules, exceptions = [], now = new Date()) {
    if (!row) return null;
    const exceptionByRule = new Map((exceptions || []).map((item) => [item.rule_key, item]));
    const ruleResults = (rules || []).map((rule) => evaluateOneRule(row, rule, exceptionByRule.get(rule.rule_key), now));
    return {
        ...buildLegacyReadiness(row, ruleResults),
        lifecycle_stage_code: row.lifecycle_stage_code ?? null,
        lifecycle_state: row.lifecycle_state ?? null,
        owner_count: toCount(row.owner_count),
        offering_count: toCount(row.offering_count),
        sla_record_count: toCount(row.sla_record_count),
        priced_flavour_count: toCount(row.priced_flavour_count),
        rules: ruleResults,
    };
}

// Backward-compatible helper used by older call sites/tests.
function buildServiceReadiness(row, rules = {}) {
    if (!row) return null;
    const legacyRules = [
        {
            rule_key: 'service_has_primary_capability_mapping',
            title: toCount(row.primary_mapping_count) > 1
                ? 'Služba má více než jednu primary C3 capability.'
                : 'Služba zatím nemá primary C3 capability.',
            severity: 'P1',
            enabled: true,
            blocking: Boolean(rules.requirePrimaryMapping),
        },
        {
            rule_key: 'service_has_complete_primary_capability',
            title: 'Primární C3 capability není complete. Doplň Applications, TIN, Data Objects a C3 Services.',
            severity: 'P1',
            enabled: true,
            blocking: Boolean(rules.requireCompletePrimaryCapability),
        },
        {
            rule_key: 'service_has_offering',
            title: 'Služba zatím nemá aktivní nebo available flavour.',
            severity: 'P2',
            enabled: true,
            blocking: Boolean(rules.requireActiveFlavour),
        },
        {
            rule_key: 'service_has_dependency_classification',
            title: 'Služba zatím nemá evidované dependencies.',
            severity: 'P2',
            enabled: true,
            blocking: Boolean(rules.requireDependencies),
        },
        {
            rule_key: 'service_has_relations',
            title: 'Služba zatím nemá žádné service relations.',
            severity: 'P2',
            enabled: true,
            blocking: Boolean(rules.requireRelations),
        },
    ];
    const adaptedRow = {
        ...row,
        owner_count: 1,
        offering_count: toCount(row.active_flavour_count),
        lifecycle_stage_code: row.service_status,
        sla_record_count: 1,
        priced_flavour_count: 1,
        requestable: false,
    };
    return evaluateServiceReadinessState(adaptedRow, legacyRules, []);
}

async function getServiceReadiness(serviceId) {
    const row = await repo.getServiceState(serviceId);
    if (!row) return null;
    const [rules, exceptions] = await Promise.all([
        repo.listRules(),
        repo.listExceptionsForService(row.service_pk),
    ]);
    return evaluateServiceReadinessState(row, rules, exceptions);
}

async function getServiceReadinessByCatalogId(catalogId) {
    const row = await repo.getServiceStateByCatalogId(catalogId);
    if (!row) return null;
    const [rules, exceptions] = await Promise.all([
        repo.listRules(),
        repo.listExceptionsForService(row.service_pk),
    ]);
    return evaluateServiceReadinessState(row, rules, exceptions);
}

async function getReadinessSummary(filters = {}) {
    const [rules, rows] = await Promise.all([
        repo.listRules(),
        repo.listServiceStates(filters),
    ]);

    const items = [];
    for (const row of rows) {
        const exceptions = await repo.listExceptionsForService(row.service_pk);
        const readiness = evaluateServiceReadinessState(row, rules, exceptions);
        if (readiness) items.push(readiness);
    }

    const groups = {
        blockers: items.filter((item) => item.blockers.length > 0),
        warnings: items.filter((item) => item.blockers.length === 0 && item.warnings.length > 0),
        ready: items.filter((item) => item.blockers.length === 0 && item.warnings.length === 0),
    };

    return {
        items,
        groups,
        counts: {
            total: items.length,
            blockers: groups.blockers.length,
            warnings: groups.warnings.length,
            ready: groups.ready.length,
        },
    };
}

async function getServiceStateByCatalogId(catalogId) {
    return repo.getServiceStateByCatalogId(catalogId);
}

module.exports = {
    buildServiceReadiness,
    evaluateServiceReadinessState,
    getServiceReadiness,
    getServiceReadinessByCatalogId,
    getReadinessSummary,
    getServiceStateByCatalogId,
    isActiveServiceStatus,
};
