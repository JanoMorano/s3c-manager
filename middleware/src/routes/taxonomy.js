'use strict';
const crypto = require('node:crypto');
const path = require('node:path');
const express   = require('express');
const NodeCache = require('node-cache');
const { getPool, getPlatformPool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { canAdmin, canEdit } = require('../middleware/rbac');
const { requireModuleApiEnabled } = require('../middleware/module-gates');
const { logTaxonomyMappingChange } = require('../db/audit.repo');
const { recordMembershipBatch } = require('../db/spiral-membership.repo');
const { parseCsvFilter, parseTextFilter, parseIntFilter } = require('../utils/query-filters');
const {
    C3_ENTITY_IMPORT_TARGETS,
    parseDelimitedRecords,
    validateC3EntityRows,
    importC3EntityRows,
    createC3EntityImportRun,
    logC3EntityImportIssues,
    syncTechnologyInteractionLinks,
    syncAllTechnologyInteractionLinks,
} = require('../utils/c3-entity-import');
const { ensureCapabilityBuilderSeeded } = require('../utils/c3-capability-builder-seed');
const { parseSimpleXlsxBuffer } = require('../utils/simple-xlsx');
const { parseArchimateXml, isArchimateParserError } = require('../parsers/archimate');
const {
    syncCapabilityDerivedLinksForAll,
    syncCapabilityDerivedLinksForCapability,
} = require('../utils/c3-capability-links');
const {
    getServiceStateByCatalogId,
    isActiveServiceStatus,
} = require('../services/readiness');
const config = require('../config');
const { tReq } = require('../utils/i18n');
const { _private: capabilityCoverageEngine } = require('./capabilities');

const router = express.Router();
const requireC3ModuleApiEnabled = requireModuleApiEnabled('C3_TAXONOMY', (req) => tReq(req, 'taxonomy.errors.module_inactive'));

const cache = new NodeCache({ stdTTL: config.cache.c3TaxonomyTtl });
const ALLOWED_C3_ITEM_TYPES = ['BP', 'BR', 'CI', 'CO', 'CP', 'CR', 'IP', 'UA', 'OTHER'];
const CAPABILITY_MAP_TITLE_KEY = 'c3.capability_map.title';
const CAPABILITY_MAP_TITLE_KEY_SPIRAL6 = 'c3.capability_map.title.spiral6';
const DEFAULT_CAPABILITY_MAP_TITLE = 'C3 Taxonomy Catalogue — Baseline 7';
const DEFAULT_CAPABILITY_MAP_TITLE_SPIRAL6 = 'C3 Taxonomy Catalogue — Baseline 6';
const DEFAULT_CAPABILITY_MAP_SPIRAL = 'Spiral_7';
const AIR_C2_LEGACY_SLUG = 'cap-bmc-air-bmc';
const AIR_C2_LEGACY_SLUG_FALLBACKS = [
    AIR_C2_LEGACY_SLUG,
    'cap-battlespace-management-air-battlespace-management',
];
const AIR_C2_LEGACY_SPIRAL = 'Spiral_5';
const AIR_C2_SUCCESSOR_ENDPOINT = `/api/v1/capabilities/by-slug/${AIR_C2_LEGACY_SLUG}/coverage?spiral=${AIR_C2_LEGACY_SPIRAL}`;
const C3_TAXONOMY_IMPORT_TARGETS = {
    capabilities: { label: 'C3 Capabilities', itemType: 'CP', sheetName: 'Capabilities' },
    'business-processes': { label: 'C3 Business Processes', itemType: 'BP', sheetName: 'Business Processes' },
    'business-roles': { label: 'C3 Business Roles', itemType: 'BR', sheetName: 'Business Roles' },
    'information-products': { label: 'C3 Information Products', itemType: 'IP', sheetName: 'Information Products' },
    'user-applications': { label: 'C3 User Applications', itemType: 'UA', sheetName: 'User Applications' },
    'coi-services': { label: 'C3 COI Services', itemType: 'CI', sheetName: 'COI Services' },
    'communications-services': { label: 'C3 Communication Services', itemType: 'CO', sheetName: 'Communications Services' },
    'core-services': { label: 'C3 Core Services', itemType: 'CR', sheetName: 'Core Services' },
};
const CAPABILITY_BUILDER_IMPORT_TARGET = {
    key: 'c3-capability-builder',
    label: 'C3 Capability Map',
    adminPath: '/admin/c3-capability-builder',
};
const REF_CACHE_KEYS = {
    portfolioGroups: ['ref_portfolio_groups', 'ref_global_service_groups'],
    serviceLines: ['ref_service_lines'],
    serviceTypes: ['ref_service_types'],
    securityClassifications: ['ref_security_classifications'],
    networkDomains: ['ref_network_domains'],
    organizationalElements: ['ref_organizational_elements'],
};

function isC3ApiPath(pathname = '') {
    return (
        pathname === '/c3' ||
        pathname.startsWith('/c3/') ||
        pathname.startsWith('/c3-application') ||
        pathname.startsWith('/c3-applications') ||
        pathname.startsWith('/c3-data-objects') ||
        pathname.startsWith('/c3-services') ||
        pathname.startsWith('/c3-tins') ||
        pathname.startsWith('/c3-technology-interactions') ||
        pathname.startsWith('/c3-capability-builder') ||
        pathname.startsWith('/mapping') ||
        pathname.startsWith('/spiral')
    );
}

router.use((req, res, next) => {
    if (!isC3ApiPath(req.path)) return next();
    return requireC3ModuleApiEnabled(req, res, next);
});

function invalidateC3CacheKeys() {
    const keys = cache.keys().filter((key) =>
        key.startsWith('c3_') ||
        key.startsWith('c3cap_') ||
        key.startsWith('c3_capmap') ||
        key.startsWith('c3_capbuilder')
    );
    if (keys.length > 0) cache.del(keys);
}

function invalidateRefCacheKeys(...groups) {
    const keys = groups.flatMap((group) => REF_CACHE_KEYS[group] ?? []);
    if (keys.length > 0) cache.del(keys);
}

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function isUniqueViolation(err) {
    return err?.code === '23505';
}

function resultRows(result) {
    if (!result) return [];
    return Array.isArray(result.rows) ? result.rows : [];
}

function resultRowCount(result) {
    if (!result) return 0;
    return typeof result.rowCount === 'number' ? result.rowCount : resultRows(result).length;
}

async function selectRows(pool, text, params = []) {
    const result = await pool.query(text, params);
    return resultRows(result);
}

async function selectOne(pool, text, params = []) {
    const rows = await selectRows(pool, text, params);
    return rows[0] ?? null;
}

function legacyRequirementFromGeneric(requirement) {
    return {
        code: requirement.code,
        uuid: requirement.uuid ?? null,
        title: requirement.title,
        entity_kind: requirement.kind,
        role: requirement.role ?? 'core',
        source: 'generic_coverage_engine',
        source_documents: (requirement.evidence ?? []).map((item) => item.document_id ?? item.source).filter(Boolean),
        item_status: null,
        service_instructions: null,
        note: 'Derived from generic capability coverage engine and imported C3/spiral membership evidence.',
        is_resolved: Boolean(requirement.uuid),
        covered_by: requirement.covered_by ?? [],
        evidence: requirement.evidence ?? [],
    };
}

function serviceMatchesSearch(service, serviceSearch) {
    const query = String(serviceSearch ?? '').trim().toLowerCase();
    if (!query) return true;
    return [service.service_id, service.title]
        .some((value) => String(value ?? '').toLowerCase().includes(query));
}

function buildLegacyFmnAirC2PayloadFromCoverage(coverage, serviceSearch = '') {
    const requirements = (coverage.requirements ?? []).map(legacyRequirementFromGeneric);
    const resolvedRequirements = requirements.filter((item) => item.uuid);
    const coreRequirements = resolvedRequirements.filter((item) => item.role === 'core');
    const visibleServices = (coverage.services ?? []).filter((service) => serviceMatchesSearch(service, serviceSearch));
    const visibleServiceIds = new Set(visibleServices.map((service) => service.service_id));

    const services = visibleServices.map((service) => {
        const coveredRequirements = resolvedRequirements.filter((requirement) => requirement.covered_by.includes(service.service_id));
        const coveredCoreCount = coveredRequirements.filter((requirement) => requirement.role === 'core').length;
        const missingCore = coreRequirements.filter((requirement) => !requirement.covered_by.includes(service.service_id));
        return {
            service_pk: null,
            service_id: service.service_id,
            title: service.title,
            service_status_code: null,
            coverage_percent: coreRequirements.length ? Math.round((coveredCoreCount / coreRequirements.length) * 100) : service.coverage_percent,
            covered_count: coveredRequirements.length,
            covered_core_count: coveredCoreCount,
            total_core_count: coreRequirements.length,
            total_requirement_count: resolvedRequirements.length,
            total_c3_mapping_count: service.covered_count,
            covered_requirements: coveredRequirements,
            missing_core_requirements: missingCore,
        };
    });

    const duplicateCoverage = resolvedRequirements
        .map((requirement) => {
            const serviceList = requirement.covered_by
                .filter((serviceId) => visibleServiceIds.has(serviceId))
                .map((serviceId) => {
                    const service = visibleServices.find((item) => item.service_id === serviceId);
                    return { service_id: serviceId, title: service?.title ?? serviceId };
                });
            return { requirement, services: serviceList };
        })
        .filter((item) => item.services.length > 1);

    return {
        framework: {
            name: 'FMN Spiral 5 Air C2 coverage',
            spiral: AIR_C2_LEGACY_SPIRAL,
            domain: 'Air C2',
            successor_endpoint: AIR_C2_SUCCESSOR_ENDPOINT,
            source_documents: coverage.documents ?? [],
            source_model_note: 'Legacy Air C2 view is now a compatibility adapter over the generic capability coverage engine. Evidence comes from imported C3 entities, spiral membership, and service catalogue mappings; no developer-local PDF path is used.',
        },
        summary: {
            total_requirements: requirements.length,
            resolved_requirements: resolvedRequirements.length,
            core_requirements: coreRequirements.length,
            unresolved_references: requirements.filter((item) => !item.is_resolved).length,
            matching_services: services.length,
            duplicate_requirement_count: duplicateCoverage.length,
        },
        requirements,
        services,
        duplicate_coverage: duplicateCoverage,
    };
}

async function loadLegacyFmnAirC2Coverage(pool) {
    let firstMiss = null;
    for (const slug of AIR_C2_LEGACY_SLUG_FALLBACKS) {
        const coverage = await capabilityCoverageEngine.loadCoveragePayload(pool, slug, AIR_C2_LEGACY_SPIRAL);
        if (coverage.status === 200) return coverage;
        if (!firstMiss) firstMiss = coverage;
    }
    return firstMiss ?? { status: 404, body: { error: 'Capability slug not found' } };
}

function normalizeOptionalInt(value) {
    if (value == null || value === '') return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionalBool(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
    return null;
}

async function resolveParentUuidByCode(parentCode) {
    if (!parentCode) return null;
    const row = await selectOne(getPool(), `
        SELECT uuid
        FROM data.c3_taxonomy
        WHERE external_id = $1 OR parent_code = $1
        ORDER BY CASE WHEN external_id = $1 THEN 0 ELSE 1 END, id
        LIMIT 1
    `, [parentCode]);
    return row?.uuid ?? null;
}

async function syncTaxonomyParentUuids() {
    await getPool().query(`
        UPDATE data.c3_taxonomy AS child
        SET parent_uuid = parent.uuid
        FROM data.c3_taxonomy AS parent
        WHERE child.parent_code IS NOT NULL
          AND parent.external_id = child.parent_code
          AND (child.parent_uuid IS NULL OR child.parent_uuid <> parent.uuid)
    `);
}

async function getC3TaxonomyRowByUuid(uuid) {
    return selectOne(getPool(), `
        SELECT *
        FROM data.c3_taxonomy
        WHERE uuid = $1
    `, [uuid]);
}

async function getActiveSpiralCode() {
    const row = await selectOne(getPool(), `
        SELECT spiral_code
        FROM data.ref_spiral_baseline
        WHERE is_active = TRUE
        ORDER BY activated_at DESC NULLS LAST, id DESC
        LIMIT 1
    `);
    return row?.spiral_code ?? null;
}

function normalizeC3TaxonomyTargetKey(value) {
    const key = String(value ?? '').trim().toLowerCase();
    return C3_TAXONOMY_IMPORT_TARGETS[key] ? key : null;
}

function deriveC3ItemType(value) {
    const prefix = String(value ?? '').trim().match(/^([A-Z]+)-/i)?.[1]?.toUpperCase() ?? null;
    return prefix && ALLOWED_C3_ITEM_TYPES.includes(prefix) ? prefix : null;
}

function normalizeLookupKey(key) {
    return String(key)
        .trim()
        .toLowerCase()
        .replace(/["']/g, '')
        .replace(/[\s/_-]+/g, ' ');
}

function normalizeCodeParam(value) {
    return String(value ?? '').trim();
}

function isXlsxParserError(err) {
    return String(err?.message ?? '').startsWith('XLSX parser:');
}

function isTruthyQuery(value) {
    return ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

function getImportTargetMeta(targetKey) {
    if (targetKey === CAPABILITY_BUILDER_IMPORT_TARGET.key) return CAPABILITY_BUILDER_IMPORT_TARGET;
    return C3_ENTITY_IMPORT_TARGETS[targetKey] ?? null;
}

async function getC3EntityDetailByCode(req, targetKey, code) {
    const targetConfig = C3_ENTITY_IMPORT_TARGETS[targetKey];
    if (!targetConfig) throw createHttpError(404, tReq(req, 'taxonomy.errors.unknown_c3_target'));

    const codeField = targetConfig.fields.find((field) => field.required && field.key !== 'uuid')?.key;
    if (!codeField) throw createHttpError(500, tReq(req, 'taxonomy.errors.target_missing_code_field', { targetKey }));

    return selectOne(getPool(), `
        SELECT *
        FROM ${targetConfig.listView}
        WHERE ${codeField} = $1
        ORDER BY id
        LIMIT 1
    `, [code]);
}

function parseDateSafe(value) {
    if (value == null || value === '') return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeC3TaxonomyItem(raw, defaultItemType = null) {
    const record = {};
    for (const [key, value] of Object.entries(raw ?? {})) {
        record[String(key).trim().toLowerCase()] = value;
    }

    const get = (...keys) => {
        for (const key of keys) {
            const normalizedKey = String(key).trim().toLowerCase();
            if (record[normalizedKey] != null && record[normalizedKey] !== '') return record[normalizedKey];
            const spacedKey = normalizedKey.replace(/_/g, ' ');
            if (record[spacedKey] != null && record[spacedKey] !== '') return record[spacedKey];
        }
        return null;
    };

    const hasExplicitPageColumn = record.page != null || record.page_id != null || record.pageid != null;
    const pageCode = get('page', 'page_id', 'pageid', 'external_id');
    const explicitItemType = get('item_type', 'itemtype');
    const itemType = String(explicitItemType ?? defaultItemType ?? deriveC3ItemType(pageCode) ?? '').trim().toUpperCase() || null;
    const sourceExternalId = hasExplicitPageColumn
        ? get('external id', 'source_external_id', 'taxonomy_external_id')
        : get('source_external_id', 'taxonomy_external_id');

    return {
        uuid: String(get('uuid', 'page_id', 'pageid', 'id') ?? '').trim(),
        application: get('application') ? String(get('application')).slice(0, 50) : null,
        title: get('title') ? String(get('title')).slice(0, 500) : '',
        description: get('description') ? String(get('description')) : null,
        source_description: get('source_description') ? String(get('source_description')) : null,
        revised_description: get('revised_description') ? String(get('revised_description')) : null,
        external_id: pageCode ? String(pageCode).slice(0, 200) : null,
        source_external_id: sourceExternalId ? String(sourceExternalId).slice(0, 200) : null,
        data_qualifier: get('data_qualifier') ? String(get('data_qualifier')).slice(0, 500) : null,
        data_source: get('data_source', 'source') ? String(get('data_source', 'source')).slice(0, 200) : null,
        ss_overall_status: get('ss_overall_status') ? String(get('ss_overall_status')).slice(0, 100) : null,
        ss_baseline_status: get('ss_baseline_status') ? String(get('ss_baseline_status')).slice(0, 100) : null,
        item_status: get('item_status', 'controlled state', 'state') ? String(get('item_status', 'controlled state', 'state')).slice(0, 50) : null,
        order_num: get('order_num', 'order') != null ? Number.parseInt(String(get('order_num', 'order')), 10) || null : null,
        level_num: get('level') != null ? Number.parseInt(String(get('level')), 10) || null : null,
        modification_date: parseDateSafe(get('modification_date', 'modification date')),
        revised: record.revised === true || record.revised === 1 || String(record.revised ?? '').toLowerCase() === 'true' ? 1 : 0,
        abbreviation: get('abbreviation') ? String(get('abbreviation')).slice(0, 200) : null,
        synonym: get('synonym') ? String(get('synonym')) : null,
        script_raw: get('script_raw', 'script') ? String(get('script_raw', 'script')) : null,
        datasets_raw: get('datasets_raw', 'datasets', 'dataset') ? String(get('datasets_raw', 'datasets', 'dataset')) : null,
        standards_raw: get('standards_raw', 'standards') ? String(get('standards_raw', 'standards')) : null,
        references_raw: get('references_raw', 'references', 'reference') ? String(get('references_raw', 'references', 'reference')) : null,
        provenance_raw: get('provenance_raw', 'provenance') ? String(get('provenance_raw', 'provenance')) : null,
        item_type: itemType,
        parent_code: get('parent_code', 'parent') ? String(get('parent_code', 'parent')).slice(0, 100) : null,
        parent_uuid: get('parent_uuid') ? String(get('parent_uuid')).slice(0, 100) : null,
    };
}

async function runC3TaxonomyImport(rawItems, { defaultItemType = null, spiralCode = null } = {}) {
    const pool = getPool();
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const membershipRecords = [];

    for (const rawItem of rawItems) {
        try {
            const item = normalizeC3TaxonomyItem(rawItem, defaultItemType);
            if (!item.uuid || !item.title) {
                failed += 1;
                continue;
            }

            const existing = await selectOne(pool, `
                SELECT id
                FROM data.c3_taxonomy
                WHERE uuid = $1
            `, [item.uuid]);

            const values = [
                item.uuid,
                item.application,
                item.title,
                item.description,
                item.source_description,
                item.revised_description,
                item.external_id,
                item.source_external_id,
                item.data_qualifier,
                item.data_source,
                item.ss_overall_status,
                item.ss_baseline_status,
                item.item_status,
                item.order_num,
                item.level_num,
                item.modification_date,
                Boolean(item.revised),
                item.abbreviation,
                item.synonym,
                item.script_raw,
                item.datasets_raw,
                item.standards_raw,
                item.references_raw,
                item.provenance_raw,
                item.item_type,
                item.parent_code,
                item.parent_uuid,
            ];

            if (existing) {
                await pool.query(`
                    UPDATE data.c3_taxonomy
                    SET
                        application = $2,
                        title = $3,
                        description = $4,
                        source_description = $5,
                        revised_description = $6,
                        external_id = $7,
                        source_external_id = $8,
                        data_qualifier = $9,
                        data_source = $10,
                        ss_overall_status = $11,
                        ss_baseline_status = $12,
                        item_status = $13,
                        order_num = $14,
                        level_num = $15,
                        modification_date = $16,
                        revised = $17,
                        abbreviation = $18,
                        synonym = $19,
                        script_raw = $20,
                        datasets_raw = $21,
                        standards_raw = $22,
                        references_raw = $23,
                        provenance_raw = $24,
                        item_type = $25,
                        parent_code = $26,
                        parent_uuid = $27,
                        fmn_spiral = COALESCE($28, fmn_spiral),
                        synced_at = CURRENT_TIMESTAMP
                    WHERE uuid = $1
                `, [...values, spiralCode]);
                updated += 1;
            } else {
                await pool.query(`
                    INSERT INTO data.c3_taxonomy (
                        uuid, application, title, description,
                        source_description, revised_description,
                        external_id, source_external_id, data_qualifier, data_source,
                        ss_overall_status, ss_baseline_status, item_status,
                        order_num, level_num, modification_date, revised,
                        abbreviation, synonym, script_raw, datasets_raw,
                        standards_raw, references_raw, provenance_raw,
                        item_type, parent_code, parent_uuid, fmn_spiral
                    ) VALUES (
                        $1, $2, $3, $4,
                        $5, $6,
                        $7, $8, $9, $10,
                        $11, $12, $13,
                        $14, $15, $16, $17,
                        $18, $19, $20, $21,
                        $22, $23, $24,
                        $25, $26, $27, $28
                    )
                `, [...values, spiralCode]);
                inserted += 1;
            }
            if (spiralCode && item.item_type === 'CP') {
                membershipRecords.push({
                    entityKind: 'capability',
                    entityUuid: item.uuid,
                    spiralCode,
                    statusInSpiral: existing ? 'updated' : 'new',
                    ssOverallStatus: item.ss_overall_status ?? null,
                    ssBaselineStatus: item.ss_baseline_status ?? null,
                    itemStatus: item.item_status ?? null,
                });
            }
        } catch (_error) {
            failed += 1;
        }
    }

    await syncTaxonomyParentUuids();
    await recordMembershipBatch(membershipRecords);

    await syncCapabilityDerivedLinksForAll();
    invalidateC3CacheKeys();

    return {
        inserted,
        updated,
        failed,
        rowsParsed: rawItems.length,
        membership_records: membershipRecords.length,
    };
}

function hasOwn(body, key) {
    return body && Object.prototype.hasOwnProperty.call(body, key);
}

async function getMappingsForCatalogId(catalogId) {
    return selectRows(getPool(), `
        SELECT id, c3_uuid, mapping_type_code, is_primary, pace_code
        FROM data.service_c3_mapping
        WHERE service_id = $1
        ORDER BY created_at ASC, id ASC
    `, [catalogId]);
}

async function getCapabilityCompletenessMap(uuids) {
    const uniqueUuids = [...new Set((uuids ?? []).filter(Boolean))];
    if (uniqueUuids.length === 0) return new Map();

    const rows = await selectRows(getPool(), `
        SELECT uuid, completeness_status
        FROM data.v_c3capabilitycompleteness
        WHERE uuid = ANY($1::varchar[])
    `, [uniqueUuids]);

    return new Map(rows.map((row) => [row.uuid, row.completeness_status]));
}

async function assertServiceMappingsAllowedForState(catalogId, nextMappings, translate = (key, params) => key) {
    const service = await getServiceStateByCatalogId(catalogId);
    if (!service || !isActiveServiceStatus(service.service_status)) return;

    const primaryMappings = nextMappings.filter((mapping) => Boolean(mapping.is_primary));
    if (primaryMappings.length === 0) return;

    const completenessMap = await getCapabilityCompletenessMap(primaryMappings.map((mapping) => mapping.c3_uuid));
    const incompletePrimary = primaryMappings.find((mapping) => completenessMap.get(mapping.c3_uuid) !== 'complete');
    if (incompletePrimary) {
        throw createHttpError(409, translate('taxonomy.errors.primary_capability_incomplete'));
    }
}

async function updateC3ImportEntity(targetKey, entityId, body, translate = (key, params) => key) {
    const targetConfig = C3_ENTITY_IMPORT_TARGETS[targetKey];
    if (!targetConfig) throw createHttpError(404, translate('taxonomy.errors.c3_entity_not_found'));

    const current = await selectOne(getPool(), `
        SELECT *
        FROM ${targetConfig.table}
        WHERE id = $1
    `, [entityId]);
    if (!current) throw createHttpError(404, translate('taxonomy.errors.record_not_found'));

    const merged = {};
    for (const field of targetConfig.fields) {
        const rawValue = hasOwn(body, field.key) ? body[field.key] : current[field.key];
        const normalized = field.normalize ? field.normalize(rawValue) : rawValue;
        if (field.required && (normalized == null || normalized === '')) {
            throw createHttpError(400, translate('taxonomy.errors.required_field', { field: field.key }));
        }
        merged[field.key] = normalized;
    }
    merged.raw_json = JSON.stringify(merged);

    const params = [entityId, ...targetConfig.fields.map((field) => merged[field.key] ?? null), merged.raw_json];
    const setClause = targetConfig.fields.map((field, index) => `${field.key} = $${index + 2}`)
        .concat([`raw_json = $${targetConfig.fields.length + 2}`, 'updated_at = CURRENT_TIMESTAMP'])
        .join(', ');

    await getPool().query(`
        UPDATE ${targetConfig.table}
        SET ${setClause}
        WHERE id = $1
    `, params);

    if (targetKey === 'c3-technology-interactions') {
        await syncTechnologyInteractionLinks(entityId, merged);
        await syncCapabilityDerivedLinksForAll();
    } else if (['c3-application', 'c3-data-objects', 'c3-services'].includes(targetKey)) {
        await syncAllTechnologyInteractionLinks();
        await syncCapabilityDerivedLinksForAll();
    }

    invalidateC3CacheKeys();
}

async function listCapabilityBuilderDomains() {
    const cacheKey = 'c3_capbuilder_domains:v1';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const result = await selectRows(getPool(), `
        SELECT *
        FROM data.v_c3capabilitybuilderdomain
        ORDER BY sort_order, code
    `);
    cache.set(cacheKey, result, config.cache.c3CapabilityMapTtl);
    return result;
}

function normalizeCapabilityMapTitle(value, translate = (key, params) => key) {
    const title = String(value ?? '').trim();
    if (!title) throw createHttpError(400, translate('taxonomy.errors.page_title_required'));
    if (title.length > 200) throw createHttpError(400, translate('taxonomy.errors.page_title_too_long'));
    return title;
}

function normalizeSpiralCode(value, fallback = DEFAULT_CAPABILITY_MAP_SPIRAL) {
    const raw = String(value ?? '').trim();
    if (!raw) return fallback;

    const direct = raw.match(/^Spiral[_\s-]?(\d+)$/i);
    if (direct) return `Spiral_${direct[1]}`;

    const numeric = raw.match(/^(\d+)$/);
    if (numeric) return `Spiral_${numeric[1]}`;

    return fallback;
}

function getSpiralNumber(spiral) {
    return String(spiral ?? '').match(/^Spiral_(\d+)$/)?.[1] ?? null;
}

function resolveCapabilityMapTitleKey(spiral) {
    if (spiral === 'Spiral_6') return CAPABILITY_MAP_TITLE_KEY_SPIRAL6;
    if (spiral === DEFAULT_CAPABILITY_MAP_SPIRAL) return CAPABILITY_MAP_TITLE_KEY;
    const spiralNumber = getSpiralNumber(spiral);
    return spiralNumber ? `c3.capability_map.title.spiral${spiralNumber}` : CAPABILITY_MAP_TITLE_KEY;
}

function resolveCapabilityMapTitleDefault(spiral) {
    if (spiral === 'Spiral_6') return DEFAULT_CAPABILITY_MAP_TITLE_SPIRAL6;
    if (spiral === DEFAULT_CAPABILITY_MAP_SPIRAL) return DEFAULT_CAPABILITY_MAP_TITLE;
    const spiralNumber = getSpiralNumber(spiral);
    return spiralNumber ? `C3 Taxonomy Catalogue — Baseline ${spiralNumber}` : DEFAULT_CAPABILITY_MAP_TITLE;
}

async function getCapabilityMapTitle(spiral = DEFAULT_CAPABILITY_MAP_SPIRAL) {
    spiral = normalizeSpiralCode(spiral);
    const configKey = resolveCapabilityMapTitleKey(spiral);
    const cacheKey = `c3_capmap_title:${configKey}:v1`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const result = await selectOne(getPlatformPool(), `
        SELECT config_value
        FROM platform.app_config
        WHERE config_key = $1
        LIMIT 1
    `, [configKey]);

    const defaultTitle = resolveCapabilityMapTitleDefault(spiral);
    const title = String(result?.config_value ?? defaultTitle).trim() || defaultTitle;
    cache.set(cacheKey, title, config.cache.c3CapabilityMapTtl);
    return title;
}

async function upsertCapabilityMapTitle(title, updatedBy = null, spiral = DEFAULT_CAPABILITY_MAP_SPIRAL) {
    spiral = normalizeSpiralCode(spiral);
    const configKey = resolveCapabilityMapTitleKey(spiral);
    const spiralNumber = getSpiralNumber(spiral);
    const description = spiral === DEFAULT_CAPABILITY_MAP_SPIRAL
        ? 'Editable title for the canonical C3 Capability Map page'
        : `Editable title for the C3 Capability Map (Spiral ${spiralNumber ?? '?'}) page`;

    await getPlatformPool().query(`
        INSERT INTO platform.app_config (
            config_key,
            config_value,
            config_type,
            description,
            is_sensitive,
            updated_at,
            updated_by
        )
        VALUES ($1, $2, 'string', $3, FALSE, CURRENT_TIMESTAMP, $4)
        ON CONFLICT (config_key) DO UPDATE SET
            config_value = EXCLUDED.config_value,
            config_type = EXCLUDED.config_type,
            description = EXCLUDED.description,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = EXCLUDED.updated_by
    `, [
        configKey,
        title,
        description,
        updatedBy ?? null,
    ]);

    invalidateC3CacheKeys();
}

async function buildCapabilityMapPayload() {
    await ensureCapabilityBuilderSeeded();

    const cacheKey = 'c3_capmap_builder:v3';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const [pageTitle, domainResult, itemResult] = await Promise.all([
        getCapabilityMapTitle(),
        selectRows(getPool(), `
            SELECT *
            FROM data.v_c3capabilitybuilderdomain
            ORDER BY sort_order, code
        `),
        selectRows(getPool(), `
            SELECT
                b.*,
                linked.uuid AS linked_c3_uuid,
                linked.external_id AS linked_c3_external_id,
                linked.title AS linked_c3_title,
                COALESCE(comp.service_mapping_count, 0) AS linked_service_mapping_count,
                COALESCE(comp.has_service_mapping, FALSE) AS linked_has_service_mapping,
                COALESCE(comp.completeness_status, 'incomplete') AS linked_completeness_status
            FROM data.v_c3capabilitybuilderlist b
            LEFT JOIN LATERAL (
                SELECT
                    t.uuid,
                    t.external_id,
                    t.title
                FROM data.c3_taxonomy t
                WHERE t.external_id = b.page_id
                   OR t.uuid = b.uuid
                ORDER BY
                    CASE
                        WHEN t.external_id = b.page_id THEN 0
                        WHEN t.uuid = b.uuid THEN 1
                        ELSE 2
                    END,
                    t.id
                LIMIT 1
            ) linked ON TRUE
            LEFT JOIN data.v_c3capabilitycompleteness comp
              ON comp.uuid = linked.uuid
            ORDER BY b.domain_order, b.level, COALESCE(b.parent_id, ''), b.title, b.page_id
        `),
    ]);

    const payload = {
        page_title: pageTitle,
        summary: {
            total: itemResult.length,
            domain_count: domainResult.length,
        },
        domains: domainResult,
        items: itemResult,
    };

    cache.set(cacheKey, payload, config.cache.c3CapabilityMapTtl);
    return payload;
}

// Jako buildCapabilityMapPayload, ale filtruje c3_capability_builder podle fmn_spiral.
// Domains are always read from DB (ref_c3_capability_domain), so blocks are visible even without data (0/0).
async function buildCapabilityMapPayloadBySpiral(spiralCode, pageTitle) {
    const cacheKey = `c3_capmap_spiral:${spiralCode}:v1`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const [domainResult, itemResult] = await Promise.all([
        selectRows(getPool(), `
            SELECT *
            FROM data.v_c3capabilitybuilderdomain
            ORDER BY sort_order, code
        `),
        selectRows(getPool(), `
            SELECT
                b.*,
                linked.uuid AS linked_c3_uuid,
                linked.external_id AS linked_c3_external_id,
                linked.title AS linked_c3_title,
                COALESCE(comp.service_mapping_count, 0) AS linked_service_mapping_count,
                COALESCE(comp.has_service_mapping, FALSE) AS linked_has_service_mapping,
                COALESCE(comp.completeness_status, 'incomplete') AS linked_completeness_status
            FROM data.v_c3capabilitybuilderlist b
            JOIN data.c3_capability_builder raw
              ON raw.id = b.id AND (raw.fmn_spiral = $1 OR ($1 IS NULL AND raw.fmn_spiral IS NULL))
            LEFT JOIN LATERAL (
                SELECT
                    t.uuid,
                    t.external_id,
                    t.title
                FROM data.c3_taxonomy t
                WHERE t.external_id = b.page_id
                   OR t.uuid = b.uuid
                ORDER BY
                    CASE
                        WHEN t.external_id = b.page_id THEN 0
                        WHEN t.uuid = b.uuid THEN 1
                        ELSE 2
                    END,
                    t.id
                LIMIT 1
            ) linked ON TRUE
            LEFT JOIN data.v_c3capabilitycompleteness comp
              ON comp.uuid = linked.uuid
            ORDER BY b.domain_order, b.level, COALESCE(b.parent_id, ''), b.title, b.page_id
        `, [spiralCode]),
    ]);

    const payload = {
        page_title: pageTitle,
        summary: {
            total: itemResult.length,
            domain_count: domainResult.length,
        },
        domains: domainResult,
        items: itemResult,
    };

    cache.set(cacheKey, payload, config.cache.c3CapabilityMapTtl);
    return payload;
}

async function validateCapabilityBuilderPayload(payload, currentId = null, tableName = 'data.c3_capability_builder', maxLevel = 20, translate = (key, params) => key) {
    const pageId = String(payload?.page_id ?? payload?.pageId ?? '').trim();
    const uuid = String(payload?.uuid ?? '').trim();
    const title = String(payload?.title ?? '').trim();
    const parentId = String(payload?.parent_id ?? payload?.parentId ?? '').trim() || null;
    const state = String(payload?.state ?? '').trim() || null;
    const domainCode = String(payload?.domain_code ?? payload?.domain ?? '').trim();
    const level = Number.parseInt(String(payload?.level ?? ''), 10);

    if (!pageId) throw createHttpError(400, translate('taxonomy.errors.missing_page_id'));
    if (!uuid) throw createHttpError(400, translate('taxonomy.errors.missing_uuid'));
    if (!title) throw createHttpError(400, translate('taxonomy.errors.missing_title'));
    if (!domainCode) throw createHttpError(400, translate('taxonomy.errors.missing_domain_code'));
    if (!Number.isInteger(level) || level < 1 || level > maxLevel) throw createHttpError(400, translate('taxonomy.errors.invalid_level_dynamic', { maxLevel }));
    if (parentId && parentId === pageId) throw createHttpError(400, translate('taxonomy.errors.same_parent_page_id'));
    if (!parentId && level !== 1) throw createHttpError(400, translate('taxonomy.errors.root_level_mismatch'));
    if (parentId && level === 1) throw createHttpError(400, translate('taxonomy.errors.child_level_mismatch'));

    const domains = await listCapabilityBuilderDomains();
    const domainExists = domains.some((domain) => domain.code === domainCode);
    if (!domainExists) throw createHttpError(400, translate('taxonomy.errors.invalid_domain_code'));

    const treeResult = await selectRows(getPool(), `
        SELECT id, page_id, parent_id, level, domain_code
        FROM ${tableName}
    `);
    const nodes = treeResult;
    const nodeByPageId = new Map(nodes.map((node) => [node.page_id, node]));

    if (currentId != null) {
        const currentNode = nodes.find((node) => Number(node.id) === Number(currentId));
        if (!currentNode) throw createHttpError(404, translate('taxonomy.errors.capability_builder_item_not_found'));
    }

    if (parentId) {
        const parentNode = nodeByPageId.get(parentId);
        if (!parentNode) throw createHttpError(400, translate('taxonomy.errors.parent_id_not_found'));
        if (parentNode.domain_code !== domainCode) throw createHttpError(400, translate('taxonomy.errors.parent_domain_mismatch'));
        if (level <= Number(parentNode.level)) throw createHttpError(400, translate('taxonomy.errors.child_level_greater'));
    }

    if (currentId != null) {
        const parentByPageId = new Map(nodes.map((node) => [node.page_id, node.parent_id]));
        const currentNode = nodes.find((node) => Number(node.id) === Number(currentId));
        if (currentNode) {
            parentByPageId.set(pageId, parentId);
            let cursor = parentId;
            while (cursor) {
                if (cursor === pageId) throw createHttpError(400, translate('taxonomy.errors.parent_cycle'));
                cursor = parentByPageId.get(cursor) ?? null;
            }
        }
    }

    return {
        pageId,
        uuid,
        title,
        parentId,
        level,
        state,
        domainCode,
    };
}

function getCapabilityBuilderImportValue(row, candidates) {
    if (!row || typeof row !== 'object') return null;
    const byNormalizedKey = new Map();
    Object.entries(row).forEach(([key, value]) => {
        byNormalizedKey.set(normalizeLookupKey(key), value);
    });
    for (const candidate of candidates) {
        const value = byNormalizedKey.get(normalizeLookupKey(candidate));
        if (value != null && String(value).trim() !== '') return value;
    }
    return null;
}

function normalizeCapabilityBuilderImportRow(row) {
    return {
        page_id: String(getCapabilityBuilderImportValue(row, ['page_id', 'page id', 'pageid', 'page', 'pageId']) ?? '').trim(),
        uuid: String(getCapabilityBuilderImportValue(row, ['uuid']) ?? '').trim(),
        title: String(getCapabilityBuilderImportValue(row, ['title']) ?? '').trim(),
        parent_id: String(getCapabilityBuilderImportValue(row, ['parent_id', 'parent id', 'parentid', 'parent', 'parentId']) ?? '').trim() || null,
        level: normalizeOptionalInt(getCapabilityBuilderImportValue(row, ['level'])),
        state: String(getCapabilityBuilderImportValue(row, ['state']) ?? '').trim() || null,
        domain_code: String(getCapabilityBuilderImportValue(row, ['domain_code', 'domain code', 'domain', 'domainCode']) ?? '').trim(),
    };
}

function buildCapabilityBuilderImportIssues(record, allowedDomainCodes, knownPageIds, translate = (key) => key) {
    const issues = [];

    if (!record.page_id) {
        issues.push({
            severity: 'warn',
            issue_code: 'MISSING_PAGE_ID',
            field_name: 'page_id',
            raw_value: null,
            message: translate('taxonomy.errors.missing_page_id'),
        });
    }
    if (!record.uuid) {
        issues.push({
            severity: 'warn',
            issue_code: 'MISSING_UUID',
            field_name: 'uuid',
            raw_value: null,
            message: translate('taxonomy.errors.missing_uuid'),
        });
    }
    if (!record.title) {
        issues.push({
            severity: 'error',
            issue_code: 'MISSING_TITLE',
            field_name: 'title',
            raw_value: null,
            message: translate('taxonomy.errors.missing_title'),
        });
    }
    if (!record.domain_code) {
        issues.push({
            severity: 'error',
            issue_code: 'MISSING_DOMAIN_CODE',
            field_name: 'domain_code',
            raw_value: null,
            message: translate('taxonomy.errors.missing_domain_code'),
        });
    } else if (!allowedDomainCodes.has(record.domain_code)) {
        issues.push({
            severity: 'error',
            issue_code: 'INVALID_DOMAIN_CODE',
            field_name: 'domain_code',
            raw_value: record.domain_code,
            message: translate('taxonomy.errors.invalid_domain_code'),
        });
    }
    if (!Number.isInteger(record.level) || record.level < 1 || record.level > 20) {
        issues.push({
            severity: 'error',
            issue_code: 'INVALID_LEVEL',
            field_name: 'level',
            raw_value: record.level == null ? null : String(record.level),
            message: translate('taxonomy.errors.invalid_level'),
        });
    }
    if (record.parent_id && record.parent_id === record.page_id) {
        issues.push({
            severity: 'warn',
            issue_code: 'SELF_PARENT',
            field_name: 'parent_id',
            raw_value: record.parent_id,
            message: translate('taxonomy.errors.same_parent_page_id'),
        });
    }
    if (!record.parent_id && record.level !== 1) {
        issues.push({
            severity: 'error',
            issue_code: 'ROOT_LEVEL_MISMATCH',
            field_name: 'level',
            raw_value: record.level == null ? null : String(record.level),
            message: translate('taxonomy.errors.root_level_mismatch'),
        });
    }
    if (record.parent_id && record.level === 1) {
        issues.push({
            severity: 'error',
            issue_code: 'CHILD_LEVEL_MISMATCH',
            field_name: 'level',
            raw_value: String(record.level),
            message: translate('taxonomy.errors.child_level_mismatch'),
        });
    }
    if (record.parent_id && !knownPageIds.has(record.parent_id)) {
        issues.push({
            severity: 'warn',
            issue_code: 'UNKNOWN_PARENT',
            field_name: 'parent_id',
            raw_value: record.parent_id,
            message: translate('taxonomy.errors.parent_not_found'),
        });
    }

    return issues;
}

async function validateCapabilityBuilderImportRows(rawRows, translate = (key) => key) {
    const domains = await listCapabilityBuilderDomains();
    const allowedDomainCodes = new Set(domains.map((domain) => domain.code));
    const existingRows = await selectRows(getPool(), `
        SELECT page_id
        FROM data.c3_capability_builder
    `);
    const knownPageIds = new Set(existingRows.map((row) => row.page_id));
    const normalizedRows = rawRows.map((rawRow) => normalizeCapabilityBuilderImportRow(rawRow));
    normalizedRows.forEach((row) => {
        if (row.page_id) knownPageIds.add(row.page_id);
    });

    const issues = [];
    let validRowCount = 0;
    let warnCount = 0;
    let errorCount = 0;

    normalizedRows.forEach((record, index) => {
        const rowIssues = buildCapabilityBuilderImportIssues(
            record,
            allowedDomainCodes,
            knownPageIds,
            translate,
        );
        if (rowIssues.length === 0) validRowCount += 1;
        rowIssues.forEach((issue) => {
            issues.push({ row_number: index + 2, ...issue });
            if (issue.severity === 'warn') warnCount += 1;
            if (issue.severity === 'error') errorCount += 1;
        });
    });

    return {
        target: CAPABILITY_BUILDER_IMPORT_TARGET.key,
        label: CAPABILITY_BUILDER_IMPORT_TARGET.label,
        rowsParsed: rawRows.length,
        valid_row_count: validRowCount,
        warn_count: warnCount,
        error_count: errorCount,
        issue_count: issues.length,
        issues,
    };
}

async function importCapabilityBuilderRows(rawRows, { sourceName = null, sourceKind = 'json', spiralCode = null, createdBy = null, translate = (key, params) => key } = {}) {
    const preview = await validateCapabilityBuilderImportRows(rawRows, translate);
    const parentWarningRows = new Set(preview.issues
        .filter((issue) => ['SELF_PARENT', 'UNKNOWN_PARENT'].includes(issue.issue_code))
        .map((issue) => issue.row_number));
    const validRows = rawRows
        .map((rawRow, index) => ({
            row_number: index + 2,
            record: normalizeCapabilityBuilderImportRow(rawRow),
        }))
        .filter(({ row_number }) => !preview.issues.some((issue) => issue.row_number === row_number && issue.severity === 'error'))
        .sort((left, right) => {
            const levelCompare = (left.record.level ?? 999) - (right.record.level ?? 999);
            if (levelCompare !== 0) return levelCompare;
            return String(left.record.page_id).localeCompare(String(right.record.page_id));
        });

    let inserted = 0;
    let updated = 0;
    let failed = preview.error_count;
    let errorCount = preview.error_count;
    const runtimeIssues = [];

    for (const item of validRows) {
        const row = {
            ...item.record,
            parent_id: parentWarningRows.has(item.row_number) ? null : item.record.parent_id,
        };
        try {
            const existing = await selectOne(getPool(), `
                SELECT id
                FROM data.c3_capability_builder
                WHERE uuid = $1 OR page_id = $2
                ORDER BY CASE WHEN uuid = $1 THEN 0 ELSE 1 END, id
                LIMIT 1
            `, [row.uuid, row.page_id]);

            const normalized = {
                pageId: row.page_id,
                uuid: row.uuid,
                title: row.title,
                parentId: row.parent_id,
                level: row.level,
                state: row.state,
                domainCode: row.domain_code,
            };

            if (existing?.id) {
                await getPool().query(`
                    UPDATE data.c3_capability_builder
                    SET
                        page_id = $2,
                        uuid = $3,
                        title = $4,
                        parent_id = $5,
                        level = $6,
                        state = $7,
                        domain_code = $8,
                        fmn_spiral = COALESCE($9, fmn_spiral),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [
                    existing.id,
                    normalized.pageId,
                    normalized.uuid,
                    normalized.title,
                    normalized.parentId,
                    normalized.level,
                    normalized.state,
                    normalized.domainCode,
                    spiralCode,
                ]);
                updated += 1;
            } else {
                await getPool().query(`
                    INSERT INTO data.c3_capability_builder (
                        page_id,
                        uuid,
                        title,
                        parent_id,
                        level,
                        state,
                        domain_code,
                        fmn_spiral
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8
                    )
                `, [
                    normalized.pageId,
                    normalized.uuid,
                    normalized.title,
                    normalized.parentId,
                    normalized.level,
                    normalized.state,
                    normalized.domainCode,
                    spiralCode,
                ]);
                inserted += 1;
            }
        } catch (error) {
            failed += 1;
            errorCount += 1;
            runtimeIssues.push({
                row_number: item.row_number,
                severity: 'error',
                issue_code: 'UPSERT_FAILED',
                field_name: null,
                raw_value: null,
                message: error instanceof Error ? error.message : 'Capability map import selhal.',
            });
        }
    }

    invalidateC3CacheKeys();
    const combinedIssues = preview.issues.concat(runtimeIssues);

    const runId = await createC3EntityImportRun({
        targetKey: CAPABILITY_BUILDER_IMPORT_TARGET.key,
        sourceName,
        sourceKind,
        isDryRun: false,
        spiralCode,
        rowCount: rawRows.length,
        okCount: inserted + updated,
        warnCount: preview.warn_count,
        errorCount,
        insertedCount: inserted,
        updatedCount: updated,
        failedCount: failed,
        createdBy,
        notes: `${CAPABILITY_BUILDER_IMPORT_TARGET.label} ${String(sourceKind).toUpperCase()} import`,
    });
    await logC3EntityImportIssues(runId, combinedIssues);

    return {
        ok: true,
        source: sourceKind,
        message: translate('taxonomy.messages.entity_synced', { label: CAPABILITY_BUILDER_IMPORT_TARGET.label }),
        run_id: runId,
        target: CAPABILITY_BUILDER_IMPORT_TARGET.key,
        label: CAPABILITY_BUILDER_IMPORT_TARGET.label,
        rowsParsed: rawRows.length,
        valid_row_count: preview.valid_row_count,
        ok_count: inserted + updated,
        warn_count: preview.warn_count,
        error_count: errorCount,
        issue_count: combinedIssues.length,
        issues: combinedIssues,
        inserted,
        updated,
        failed,
    };
}

// ── Public endpoints (before requireAuth) ────────────────────────────────────
// GET /api/v1/taxonomy/c3/types — public, no auth (for catalogue filters)
router.get('/c3/types', async (req, res, next) => {
    try {
        const result = await selectRows(getPool(), `
            SELECT DISTINCT item_type AS code
            FROM data.c3_taxonomy
            WHERE item_type IS NOT NULL
            ORDER BY item_type
        `);
        const fromDb     = result.map(r => r.code);
        const BASE_TYPES = ['BP', 'BR', 'CI', 'CO', 'CP', 'CR', 'IP', 'UA'];
        const merged     = [...new Set([...BASE_TYPES, ...fromDb])].sort();
        res.json(merged.map(code => ({ code, name: code })));
    } catch (err) { next(err); }
});

// GET /api/v1/taxonomy/c3/statuses — public, no auth (for editor selects)
router.get('/c3/statuses', async (req, res, next) => {
    try {
        const result = await selectRows(getPool(), `
            SELECT DISTINCT item_status AS code
            FROM data.c3_taxonomy
            WHERE item_status IS NOT NULL
            ORDER BY item_status
        `);
        const fromDb       = result.map(r => r.code);
        const BASE_STATUSES = ['active', 'archived', 'draft', 'pending', 'published', 'retired'];
        const merged        = [...new Set([...BASE_STATUSES, ...fromDb])].sort();
        res.json(merged);
    } catch (err) { next(err); }
});

router.get('/c3/parent-options', async (req, res, next) => {
    try {
        const itemType = String(req.query.item_type ?? '').trim().toUpperCase();
        const params = [];
        let sqlQuery = `
            SELECT DISTINCT parent.title AS title
            FROM data.c3_taxonomy child
            JOIN data.c3_taxonomy parent ON parent.uuid = child.parent_uuid
            WHERE parent.title IS NOT NULL
        `;
        if (itemType && ALLOWED_C3_ITEM_TYPES.includes(itemType)) {
            params.push(itemType);
            sqlQuery += ` AND child.item_type = $${params.length}`;
        }
        sqlQuery += ` ORDER BY parent.title`;
        const rows = await selectRows(getPool(), sqlQuery, params);
        res.json(rows.map((row) => row.title));
    } catch (err) { next(err); }
});

// GET /api/v1/taxonomy/security-classifications — public, no auth (for editor selects)
router.get('/security-classifications', async (req, res, next) => {
    try {
        const cacheKey = 'ref_security_classifications';
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        const result = await selectRows(getPool(), `
            SELECT code, name, sort_order
            FROM data.ref_security_classification
            ORDER BY COALESCE(sort_order, 9999), code
        `);
        cache.set(cacheKey, result);
        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/v1/taxonomy/c3 — public read-only listing (for unauthenticated read-only views)
router.get('/c3', async (req, res, next) => {
    try {
        const search = parseTextFilter(req.query.search);
        const itemStatuses = parseCsvFilter(req.query.item_status, { maxItems: 10 });
        const itemTypes = parseCsvFilter(req.query.item_type, { maxItems: 10, allowed: ALLOWED_C3_ITEM_TYPES });
        const applications = parseCsvFilter(req.query.application, { maxItems: 20 });
        const parentUuids = parseCsvFilter(req.query.parent_uuid, { maxItems: 20 });
        const limit = parseIntFilter(req.query.limit, { fallback: null, min: 1, max: 1000 });
        const cacheKey = `c3_taxonomy:${search}:${itemStatuses.join('|')}:${itemTypes.join('|')}:${applications.join('|')}:${parentUuids.join('|')}:${limit ?? 'all'}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        let rows = await selectRows(getPool(), `
            SELECT
                c.*,
                p.title AS parent_title,
                p.external_id AS parent_external_id,
                (
                    SELECT COUNT(*)
                    FROM data.service_c3_mapping scm
                    WHERE scm.c3_uuid = c.uuid
                ) AS mapping_count
            FROM data.c3_taxonomy c
            LEFT JOIN data.c3_taxonomy p ON p.uuid = c.parent_uuid
            ORDER BY COALESCE(c.order_num, 999999), c.title
        `);
        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter((row) =>
                String(row.title ?? '').toLowerCase().includes(q) ||
                String(row.external_id ?? '').toLowerCase().includes(q) ||
                String(row.source_external_id ?? '').toLowerCase().includes(q) ||
                String(row.application ?? '').toLowerCase().includes(q) ||
                String(row.parent_code ?? '').toLowerCase().includes(q) ||
                String(row.references_raw ?? '').toLowerCase().includes(q) ||
                String(row.datasets_raw ?? '').toLowerCase().includes(q)
            );
        }
        if (itemStatuses.length > 0) rows = rows.filter((row) => itemStatuses.includes(row.item_status));
        if (itemTypes.length > 0) rows = rows.filter((row) => itemTypes.includes(row.item_type));
        if (applications.length > 0) rows = rows.filter((row) => applications.includes(row.application));
        if (parentUuids.length > 0) rows = rows.filter((row) => parentUuids.includes(row.parent_uuid));
        if (limit != null) rows = rows.slice(0, limit);

        cache.set(cacheKey, rows);
        res.json(rows);
    } catch (err) { next(err); }
});

router.get('/c3-services/:code', async (req, res, next) => {
    try {
        const row = await getC3EntityDetailByCode(req, 'c3-services', normalizeCodeParam(req.params.code));
        if (!row) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.c3_service_not_found') });
        res.json(row);
    } catch (err) { next(err); }
});

router.get('/c3-applications/:code', async (req, res, next) => {
    try {
        const row = await getC3EntityDetailByCode(req, 'c3-application', normalizeCodeParam(req.params.code));
        if (!row) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.c3_application_not_found') });
        res.json(row);
    } catch (err) { next(err); }
});

router.get('/c3-data-objects/:code', async (req, res, next) => {
    try {
        const row = await getC3EntityDetailByCode(req, 'c3-data-objects', normalizeCodeParam(req.params.code));
        if (!row) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.c3_data_object_not_found') });
        res.json(row);
    } catch (err) { next(err); }
});

router.get('/c3-technology-interactions/:code', async (req, res, next) => {
    try {
        const row = await getC3EntityDetailByCode(req, 'c3-technology-interactions', normalizeCodeParam(req.params.code));
        if (!row) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.c3_technology_interaction_not_found') });
        res.json(row);
    } catch (err) { next(err); }
});

router.get('/c3/fmn-air-c2/coverage', requireAuth, async (req, res, next) => {
    try {
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', 'Tue, 26 May 2026 00:00:00 GMT');
        res.setHeader('Link', `<${AIR_C2_SUCCESSOR_ENDPOINT}>; rel="successor-version"`);
        const serviceSearch = parseTextFilter(req.query.service, { maxLength: 120 });
        const cacheKey = `c3_fmn_air_c2_coverage:${serviceSearch || 'all'}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);
        const coverage = await loadLegacyFmnAirC2Coverage(getPool());
        if (coverage.status !== 200) return res.status(coverage.status).json(coverage.body);
        const payload = buildLegacyFmnAirC2PayloadFromCoverage(coverage.body, serviceSearch);
        cache.set(cacheKey, payload, config.cache.c3DashboardTtl);
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/c3/dashboard', requireAuth, async (req, res, next) => {
    try {
        const cacheKey = 'c3_dashboard_aggregate:v3';
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        const [
            summaryResult,
            byStatusResult,
            byTypeResult,
            byApplicationResult,
            topParentsResult,
            needsMappingResult,
            mostMappedResult,
            coverageResult,
            syncStatusResult,
            capabilityMapHealthResult,
            spiralCoverageResult,
            importSyncDriftResult,
            linkHealthResult,
            reviewValidationResult,
        ] = await Promise.all([
            selectOne(getPool(), `SELECT * FROM data.v_c3dashboardsummary`),
            selectRows(getPool(), `
                SELECT COALESCE(item_status, 'unknown') AS name, COUNT(*) AS value
                FROM data.c3_taxonomy
                GROUP BY COALESCE(item_status, 'unknown')
                ORDER BY value DESC, name ASC
            `),
            selectRows(getPool(), `
                SELECT COALESCE(item_type, 'OTHER') AS name, COUNT(*) AS value
                FROM data.c3_taxonomy
                GROUP BY COALESCE(item_type, 'OTHER')
                ORDER BY value DESC, name ASC
            `),
            selectRows(getPool(), `
                SELECT COALESCE(application, '(unclassified)') AS name, COUNT(*) AS value
                FROM data.c3_taxonomy
                GROUP BY COALESCE(application, '(unclassified)')
                ORDER BY value DESC, name ASC
                LIMIT 10
            `),
            selectRows(getPool(), `
                SELECT COALESCE(parent_title, '(Kořenové schopnosti)') AS name, COUNT(*) AS value
                FROM data.v_c3capabilitymaphierarchyexport
                GROUP BY COALESCE(parent_title, '(Kořenové schopnosti)')
                ORDER BY value DESC, name ASC
                LIMIT 8
            `),
            selectRows(getPool(), `
                SELECT uuid, title, item_type
                FROM data.v_c3capabilitymaphierarchyexport
                WHERE is_mapped = FALSE
                ORDER BY order_num, title
                LIMIT 10
            `),
            selectRows(getPool(), `
                SELECT uuid, title, mapping_count
                FROM data.v_c3capabilitymaphierarchyexport
                ORDER BY mapping_count DESC, title ASC
                LIMIT 10
            `),
            selectRows(getPool(), `
                SELECT
                    COALESCE(application, '(unclassified)') AS name,
                    COUNT(*) AS value,
                    SUM(CASE WHEN is_mapped = TRUE THEN 1 ELSE 0 END) AS mapped
                FROM data.v_c3capabilitymaphierarchyexport
                GROUP BY COALESCE(application, '(unclassified)')
                ORDER BY value DESC, name ASC
                LIMIT 10
            `),
            selectRows(getPool(), `
                SELECT COALESCE(sync_status, 'unknown') AS name, COUNT(*) AS value
                FROM data.service_c3_mapping
                GROUP BY COALESCE(sync_status, 'unknown')
                ORDER BY value DESC, name ASC
                LIMIT 8
            `),
            selectOne(getPool(), `
                SELECT
                    COUNT(*)::INT AS total_nodes,
                    SUM(CASE WHEN COALESCE(comp.has_service_mapping, FALSE) THEN 1 ELSE 0 END)::INT AS mapped_nodes,
                    SUM(CASE WHEN COALESCE(comp.has_service_mapping, FALSE) = FALSE THEN 1 ELSE 0 END)::INT AS unmapped_nodes
                FROM data.c3_capability_builder b
                LEFT JOIN data.v_c3capabilitycompleteness comp
                  ON comp.uuid = b.uuid
            `),
            selectRows(getPool(), `
                WITH builder AS (
                    SELECT
                        CASE
                            WHEN COALESCE(b.fmn_spiral, 'Spiral_7') = 'Spiral_6' THEN 'Spiral 6'
                            WHEN COALESCE(b.fmn_spiral, 'Spiral_7') = 'Spiral_7' THEN 'Spiral 7'
                            ELSE REPLACE(COALESCE(b.fmn_spiral, 'Baseline'), '_', ' ')
                        END AS name,
                        COALESCE(comp.has_service_mapping, FALSE) AS has_service_mapping
                    FROM data.c3_capability_builder b
                    LEFT JOIN data.v_c3capabilitycompleteness comp
                      ON comp.uuid = b.uuid
                )
                SELECT
                    name,
                    COUNT(*)::INT AS value,
                    SUM(CASE WHEN has_service_mapping THEN 1 ELSE 0 END)::INT AS mapped,
                    SUM(CASE WHEN has_service_mapping = FALSE THEN 1 ELSE 0 END)::INT AS unmapped
                FROM builder
                WHERE name IN ('Spiral 6', 'Spiral 7')
                GROUP BY name
                ORDER BY CASE name
                    WHEN 'Spiral 6' THEN 1
                    WHEN 'Spiral 7' THEN 2
                    ELSE 99
                END
            `),
            selectOne(getPool(), `
                WITH latest_import AS (
                    SELECT
                        target_key,
                        source_name,
                        created_at,
                        row_count,
                        (inserted_count + updated_count)::INT AS change_count
                    FROM data.c3_entity_import_run
                    WHERE is_dry_run = FALSE
                    ORDER BY created_at DESC
                    LIMIT 1
                ),
                mapping_sync AS (
                    SELECT
                        MAX(synced_at) AS latest_sync_at,
                        COUNT(*) FILTER (WHERE synced_at IS NULL)::INT AS unsynced_mapping_count
                    FROM data.service_c3_mapping
                )
                SELECT
                    (SELECT target_key FROM latest_import) AS latest_import_target,
                    (SELECT source_name FROM latest_import) AS latest_import_source,
                    (SELECT created_at FROM latest_import) AS latest_import_at,
                    COALESCE((SELECT row_count FROM latest_import), 0)::INT AS latest_import_row_count,
                    COALESCE((SELECT change_count FROM latest_import), 0)::INT AS latest_import_change_count,
                    (SELECT latest_sync_at FROM mapping_sync) AS latest_sync_at,
                    COALESCE((SELECT unsynced_mapping_count FROM mapping_sync), 0)::INT AS unsynced_mapping_count,
                    COALESCE((
                        SELECT COUNT(*)::INT
                        FROM data.service_c3_mapping scm
                        WHERE EXISTS (
                            SELECT 1
                            FROM latest_import li
                            WHERE scm.synced_at IS NULL OR scm.synced_at < li.created_at
                        )
                    ), 0)::INT AS stale_mapping_count
            `),
            selectRows(getPool(), `
                SELECT 'Capability -> Service' AS name, COUNT(*)::INT AS value
                FROM data.c3_capability_c3_service_link
                UNION ALL
                SELECT 'Capability -> Application' AS name, COUNT(*)::INT AS value
                FROM data.c3_capability_application_link
                UNION ALL
                SELECT 'Capability -> Data Object' AS name, COUNT(*)::INT AS value
                FROM data.c3_capability_data_object_link
                UNION ALL
                SELECT 'Capability -> TIN' AS name, COUNT(*)::INT AS value
                FROM data.c3_capability_tin_link
            `),
            selectRows(getPool(), `
                SELECT 'Missing source / provenance metadata' AS name, (
                    COALESCE((
                        SELECT COUNT(*)::INT
                        FROM data.c3_taxonomy
                        WHERE COALESCE(NULLIF(BTRIM(data_source), ''), NULLIF(BTRIM(source_external_id), ''), NULLIF(BTRIM(external_id), '')) IS NULL
                    ), 0)
                    + COALESCE((
                        SELECT COUNT(*)::INT
                        FROM data.c3_application
                        WHERE COALESCE(NULLIF(BTRIM(data_source), ''), NULLIF(BTRIM(external_id), '')) IS NULL
                    ), 0)
                    + COALESCE((
                        SELECT COUNT(*)::INT
                        FROM data.c3_service
                        WHERE COALESCE(NULLIF(BTRIM(data_source), ''), NULLIF(BTRIM(external_id), '')) IS NULL
                    ), 0)
                    + COALESCE((
                        SELECT COUNT(*)::INT
                        FROM data.c3_data_object
                        WHERE COALESCE(NULLIF(BTRIM(provenance_raw), ''), NULLIF(BTRIM(references_raw), ''), NULLIF(BTRIM(standards_raw), '')) IS NULL
                    ), 0)
                )::INT AS value
                UNION ALL
                SELECT 'Missing status metadata' AS name, COUNT(*)::INT AS value
                FROM (
                    SELECT item_status, ss_overall_status, ss_baseline_status FROM data.c3_taxonomy
                    UNION ALL
                    SELECT item_status, ss_overall_status, ss_baseline_status FROM data.c3_application
                    UNION ALL
                    SELECT item_status, ss_overall_status, ss_baseline_status FROM data.c3_data_object
                    UNION ALL
                    SELECT item_status, ss_overall_status, ss_baseline_status FROM data.c3_service
                    UNION ALL
                    SELECT item_status, ss_overall_status, ss_baseline_status FROM data.c3_technology_interaction
                ) status_meta
                WHERE COALESCE(NULLIF(BTRIM(item_status), ''), NULLIF(BTRIM(ss_overall_status), ''), NULLIF(BTRIM(ss_baseline_status), '')) IS NULL
                UNION ALL
                SELECT 'Missing review metadata (TI)' AS name, COUNT(*)::INT AS value
                FROM data.c3_technology_interaction
                WHERE NULLIF(BTRIM(ciav_review_status), '') IS NULL
                   OR NULLIF(BTRIM(mcsma_review_status), '') IS NULL
            `),
        ]);

        let boardLaneResult = [];
        try {
            boardLaneResult = await selectRows(getPool(), `
                WITH counts AS (
                    SELECT board_state, COUNT(*)::INT AS value
                    FROM data.v_c3_board_lane
                    GROUP BY board_state
                ),
                cards AS (
                    SELECT
                        board_state,
                        uuid,
                        title,
                        item_type,
                        validation_status,
                        ROW_NUMBER() OVER (
                            PARTITION BY board_state
                            ORDER BY updated_at DESC NULLS LAST, title ASC NULLS LAST, uuid ASC
                        ) AS rn
                    FROM data.v_c3_board_lane
                )
                SELECT
                    state.board_state,
                    COALESCE(counts.value, 0)::INT AS value,
                    COALESCE(
                        JSONB_AGG(
                            JSONB_BUILD_OBJECT(
                                'uuid', cards.uuid,
                                'title', cards.title,
                                'item_type', cards.item_type,
                                'validation_status', cards.validation_status
                            )
                            ORDER BY cards.rn
                        ) FILTER (WHERE cards.uuid IS NOT NULL),
                        '[]'::jsonb
                    ) AS cards
                FROM (
                    VALUES
                        ('imported'::text),
                        ('validated'::text),
                        ('mapped'::text),
                        ('used'::text),
                        ('reviewed'::text)
                ) AS state(board_state)
                LEFT JOIN counts ON counts.board_state = state.board_state
                LEFT JOIN cards ON cards.board_state = state.board_state AND cards.rn <= 4
                GROUP BY state.board_state, counts.value
                ORDER BY CASE state.board_state
                    WHEN 'imported' THEN 1
                    WHEN 'validated' THEN 2
                    WHEN 'mapped' THEN 3
                    WHEN 'used' THEN 4
                    WHEN 'reviewed' THEN 5
                    ELSE 99
                END
            `);
        } catch {
            boardLaneResult = [];
        }

        const payload = {
            summary: summaryResult ?? null,
            by_status: byStatusResult,
            by_type: byTypeResult,
            by_application: byApplicationResult,
            top_parents: topParentsResult,
            needs_mapping: needsMappingResult,
            most_mapped: mostMappedResult,
            coverage_by_application: coverageResult,
            by_sync_status: syncStatusResult,
            capability_map_health: capabilityMapHealthResult ?? { total_nodes: 0, mapped_nodes: 0, unmapped_nodes: 0 },
            spiral_coverage: spiralCoverageResult,
            import_sync_drift: importSyncDriftResult ?? {
                latest_import_target: null,
                latest_import_source: null,
                latest_import_at: null,
                latest_import_row_count: 0,
                latest_import_change_count: 0,
                latest_sync_at: null,
                stale_mapping_count: 0,
                unsynced_mapping_count: 0,
            },
            link_health: linkHealthResult,
            review_validation: reviewValidationResult,
            board_lanes: boardLaneResult,
        };
        cache.set(cacheKey, payload, config.cache.c3DashboardTtl);
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/c3/capability-map', requireAuth, async (req, res, next) => {
    try {
        const payload = await buildCapabilityMapPayload();
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/c3/capability-map-spiral7', requireAuth, async (req, res, next) => {
    try {
        const payload = await buildCapabilityMapPayload();
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/c3/capability-map-spiral6', requireAuth, async (req, res, next) => {
    try {
        const pageTitle = await getCapabilityMapTitle('Spiral_6');
        const payload = await buildCapabilityMapPayloadBySpiral('Spiral_6', pageTitle);
        res.json(payload);
    } catch (err) { next(err); }
});

router.get(/^\/c3\/capability-map-spiral(\d+)$/, requireAuth, async (req, res, next) => {
    try {
        const spiral = normalizeSpiralCode(req.params[0]);
        const pageTitle = await getCapabilityMapTitle(spiral);
        const payload = await buildCapabilityMapPayloadBySpiral(spiral, pageTitle);
        res.json(payload);
    } catch (err) { next(err); }
});

router.get('/c3-capability-builder/domains', requireAuth, async (req, res, next) => {
    try {
        const domains = await listCapabilityBuilderDomains();
        res.json(domains);
    } catch (err) { next(err); }
});

router.use(requireAuth);

router.get('/c3-capability-builder', canAdmin, async (req, res, next) => {
    try {
        await ensureCapabilityBuilderSeeded();

        const search = parseTextFilter(req.query.search);
        const limit = parseIntFilter(req.query.limit, { fallback: 500, min: 1, max: 5000 });

        const spiralFilter = req.query.spiral ? normalizeSpiralCode(req.query.spiral, null) : null;

        const result = spiralFilter
            ? await selectRows(getPool(), `
                SELECT v.*
                FROM data.v_c3capabilitybuilderlist v
                JOIN data.c3_capability_builder raw ON raw.id = v.id AND raw.fmn_spiral = $1
                ORDER BY v.domain_order, v.level, COALESCE(v.parent_id, ''), v.title, v.page_id
            `, [spiralFilter])
            : await selectRows(getPool(), `
                SELECT *
                FROM data.v_c3capabilitybuilderlist
                ORDER BY domain_order, level, COALESCE(parent_id, ''), title, page_id
            `);

        let rows = result;
        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter((row) =>
                String(row.page_id ?? '').toLowerCase().includes(q) ||
                String(row.uuid ?? '').toLowerCase().includes(q) ||
                String(row.title ?? '').toLowerCase().includes(q) ||
                String(row.parent_id ?? '').toLowerCase().includes(q) ||
                String(row.parent_title ?? '').toLowerCase().includes(q) ||
                String(row.state ?? '').toLowerCase().includes(q) ||
                String(row.domain_code ?? '').toLowerCase().includes(q)
            );
        }
        res.json(rows.slice(0, limit));
    } catch (err) { next(err); }
});

router.get('/c3-capability-builder/settings', canAdmin, async (req, res, next) => {
    try {
        const spiral = normalizeSpiralCode(req.query.spiral);
        const pageTitle = await getCapabilityMapTitle(spiral);
        res.json({
            config_key: resolveCapabilityMapTitleKey(spiral),
            page_title: pageTitle,
            spiral,
        });
    } catch (err) { next(err); }
});

router.put('/c3-capability-builder/settings', canAdmin, async (req, res, next) => {
    try {
        const spiral = normalizeSpiralCode(req.body?.spiral);
        const pageTitle = normalizeCapabilityMapTitle(req.body?.page_title, (key, params) => tReq(req, key, params));
        await upsertCapabilityMapTitle(pageTitle, req.user?.username ?? null, spiral);
        res.json({
            config_key: resolveCapabilityMapTitleKey(spiral),
            page_title: pageTitle,
            spiral,
        });
    } catch (err) { next(err); }
});

router.post('/c3-capability-builder', canAdmin, async (req, res, next) => {
    try {
        await ensureCapabilityBuilderSeeded();

        const normalized = await validateCapabilityBuilderPayload(req.body, null, 'data.c3_capability_builder', 20, (key, params) => tReq(req, key, params));
        const spiral = normalizeSpiralCode(req.body?.spiral ?? req.body?.fmn_spiral);
        const insertResult = await getPool().query(`
                INSERT INTO data.c3_capability_builder (
                    page_id,
                    uuid,
                    title,
                    parent_id,
                    level,
                    state,
                    domain_code,
                    fmn_spiral
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8
                )
                RETURNING id
            `, [
                normalized.pageId,
                normalized.uuid,
                normalized.title,
                normalized.parentId,
                normalized.level,
                normalized.state,
                normalized.domainCode,
                spiral,
            ]);

        invalidateC3CacheKeys();

        const createdId = resultRows(insertResult)[0]?.id;
        const created = await selectOne(getPool(), `
            SELECT *
            FROM data.v_c3capabilitybuilderlist
            WHERE id = $1
        `, [createdId]);
        res.status(201).json(created ?? { id: createdId });
    } catch (err) {
        if (isUniqueViolation(err)) {
            return res.status(409).json({ error: tReq(req, 'taxonomy.errors.duplicate_page_or_uuid') });
        }
        next(err);
    }
});

router.put('/c3-capability-builder/:id', canAdmin, async (req, res, next) => {
    try {
        await ensureCapabilityBuilderSeeded();

        const id = parseIntFilter(req.params.id, { fallback: null, min: 1, max: 2147483647 });
        if (!id) return res.status(400).json({ error: tReq(req, 'taxonomy.errors.invalid_id') });

        const normalized = await validateCapabilityBuilderPayload(req.body, id, 'data.c3_capability_builder', 20, (key, params) => tReq(req, key, params));
        const spiral = normalizeSpiralCode(req.body?.spiral ?? req.body?.fmn_spiral);
        const updateResult = await getPool().query(`
                UPDATE data.c3_capability_builder
                SET
                    page_id = $2,
                    uuid = $3,
                    title = $4,
                    parent_id = $5,
                    level = $6,
                    state = $7,
                    domain_code = $8,
                    fmn_spiral = $9,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                id,
                normalized.pageId,
                normalized.uuid,
                normalized.title,
                normalized.parentId,
                normalized.level,
                normalized.state,
                normalized.domainCode,
                spiral,
            ]);
        if (resultRowCount(updateResult) === 0) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.capability_builder_item_not_found') });

        invalidateC3CacheKeys();

        const updated = await selectOne(getPool(), `
            SELECT *
            FROM data.v_c3capabilitybuilderlist
            WHERE id = $1
        `, [id]);
        res.json(updated ?? { id });
    } catch (err) {
        if (isUniqueViolation(err)) {
            return res.status(409).json({ error: tReq(req, 'taxonomy.errors.duplicate_page_or_uuid') });
        }
        next(err);
    }
});

router.delete('/c3-capability-builder/:id', canAdmin, async (req, res, next) => {
    try {
        await ensureCapabilityBuilderSeeded();

        const id = parseIntFilter(req.params.id, { fallback: null, min: 1, max: 2147483647 });
        if (!id) return res.status(400).json({ error: tReq(req, 'taxonomy.errors.invalid_id') });

        const item = await selectOne(getPool(), `
            SELECT id, page_id
            FROM data.c3_capability_builder
            WHERE id = $1
        `, [id]);
        if (!item) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.capability_builder_item_not_found') });

        const childResult = await selectOne(getPool(), `
            SELECT COUNT(1) AS child_count
            FROM data.c3_capability_builder
            WHERE parent_id = $1
        `, [item.page_id]);
        if (Number(childResult?.child_count ?? 0) > 0) {
            return res.status(409).json({ error: tReq(req, 'taxonomy.errors.cannot_delete_with_children') });
        }

        await getPool().query(`
            DELETE FROM data.c3_capability_builder
            WHERE id = $1
        `, [id]);

        invalidateC3CacheKeys();
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the BIGINT ServiceCatalog.id for a given service_id string.
 * Throws an error with status 404 if the record does not exist.
 */
async function _getCatalogId(serviceIdStr) {
    const row = await selectOne(getPool(), `
        SELECT id
        FROM data.service_catalog
        WHERE service_id = $1
          AND is_deleted = FALSE
    `, [serviceIdStr]);
    const id = row?.id ?? null;
    if (!id) {
        const err = new Error(`ServiceCatalog not found: ${serviceIdStr}`);
        err.status = 404;
        throw err;
    }
    return id;
}

// =============================================================================
// C3Taxonomy — CRUD for reference taxonomy.
// Tabulka: C3 taxonomy
// GET /c3, GET /c3/types, and GET /c3/statuses are public (moved before requireAuth).
// =============================================================================

// GET /api/v1/taxonomy/c3/:uuid
router.get('/c3/:uuid', async (req, res, next) => {
    try {
        const row = await getC3TaxonomyRowByUuid(req.params.uuid);
        if (!row) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.c3_item_not_found') });
        res.json(row);
    } catch (err) { next(err); }
});

// PUT /api/v1/taxonomy/c3/:uuid (admin — update one record)
router.put('/c3/:uuid', canAdmin, async (req, res, next) => {
    try {
        const { uuid } = req.params;
        const b = req.body || {};
        const existing = await getC3TaxonomyRowByUuid(uuid);
        if (!existing) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.c3_item_not_found') });

        const parentCode = b.parent_code ?? null;
        const parentUuid = b.parent_uuid ?? await resolveParentUuidByCode(parentCode);

        await getPool().query(`
            UPDATE data.c3_taxonomy
            SET
                application = $2,
                title = $3,
                description = $4,
                external_id = $5,
                source_external_id = $6,
                data_qualifier = $7,
                data_source = $8,
                order_num = $9,
                level_num = $10,
                ss_overall_status = $11,
                ss_baseline_status = $12,
                item_status = $13,
                source_description = $14,
                revised_description = $15,
                abbreviation = $16,
                synonym = $17,
                script_raw = $18,
                datasets_raw = $19,
                standards_raw = $20,
                references_raw = $21,
                provenance_raw = $22,
                item_type = $23,
                parent_code = $24,
                parent_uuid = $25,
                synced_at = CURRENT_TIMESTAMP
            WHERE uuid = $1
        `, [
            uuid,
            b.application ?? null,
            b.title ?? null,
            b.description ?? null,
            b.external_id ?? null,
            b.source_external_id ?? null,
            b.data_qualifier ?? null,
            b.data_source ?? null,
            normalizeOptionalInt(b.order_num),
            normalizeOptionalInt(b.level_num),
            b.ss_overall_status ?? null,
            b.ss_baseline_status ?? null,
            b.item_status ?? null,
            b.source_description ?? null,
            b.revised_description ?? null,
            b.abbreviation ?? null,
            b.synonym ?? null,
            b.script_raw ?? null,
            b.datasets_raw ?? null,
            b.standards_raw ?? null,
            b.references_raw ?? null,
            b.provenance_raw ?? null,
            b.item_type ?? null,
            parentCode,
            parentUuid,
        ]);

        await syncCapabilityDerivedLinksForCapability(uuid);
        invalidateC3CacheKeys();
        res.json({ message: tReq(req, 'taxonomy.messages.c3_item_updated'), uuid });
    } catch (err) { next(err); }
});

// POST /api/v1/taxonomy/c3 (admin — create one record)
router.post('/c3', canAdmin, async (req, res, next) => {
    try {
        const b = req.body || {};
        if (!b.title) return res.status(400).json({ error: tReq(req, 'taxonomy.errors.required_field', { field: 'title' }) });

        const newUuid = b.uuid || crypto.randomUUID();
        const parentCode = b.parent_code ?? null;
        const parentUuid = b.parent_uuid ?? await resolveParentUuidByCode(parentCode);

        await getPool().query(`
            INSERT INTO data.c3_taxonomy (
                uuid, application, title, description,
                external_id, source_external_id, data_qualifier, data_source,
                ss_overall_status, ss_baseline_status, item_status,
                source_description, revised_description, order_num, level_num,
                abbreviation, synonym, script_raw, datasets_raw,
                standards_raw, references_raw, provenance_raw,
                item_type, parent_code, parent_uuid, synced_at
            )
            VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, $8,
                $9, $10, $11,
                $12, $13, $14, $15,
                $16, $17, $18, $19,
                $20, $21, $22,
                $23, $24, $25, CURRENT_TIMESTAMP
            )
        `, [
            newUuid,
            b.application ?? null,
            b.title,
            b.description ?? null,
            b.external_id ?? null,
            b.source_external_id ?? null,
            b.data_qualifier ?? null,
            b.data_source ?? null,
            b.ss_overall_status ?? null,
            b.ss_baseline_status ?? null,
            b.item_status ?? null,
            b.source_description ?? null,
            b.revised_description ?? null,
            normalizeOptionalInt(b.order_num),
            normalizeOptionalInt(b.level_num),
            b.abbreviation ?? null,
            b.synonym ?? null,
            b.script_raw ?? null,
            b.datasets_raw ?? null,
            b.standards_raw ?? null,
            b.references_raw ?? null,
            b.provenance_raw ?? null,
            b.item_type ?? null,
            parentCode,
            parentUuid,
        ]);

        await syncCapabilityDerivedLinksForCapability(newUuid);
        invalidateC3CacheKeys();
        const result = await getC3TaxonomyRowByUuid(newUuid);
        res.status(201).json(result);
    } catch (err) { next(err); }
});

// DELETE /api/v1/taxonomy/c3/:uuid (admin — delete record)
router.delete('/c3/:uuid', canAdmin, async (req, res, next) => {
    try {
        const { uuid } = req.params;
        const existing = await getC3TaxonomyRowByUuid(uuid);
        if (!existing) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.c3_item_not_found') });

        await getPool().query(`
            DELETE FROM data.c3_taxonomy
            WHERE uuid = $1
        `, [uuid]);

        invalidateC3CacheKeys();
        res.json({ message: tReq(req, 'taxonomy.messages.c3_item_deleted'), uuid });
    } catch (err) { next(err); }
});

// POST /api/v1/taxonomy/c3/sync (admin — manual JSON import)
router.post('/c3/sync', canAdmin, async (req, res, next) => {
    try {
        const items = req.body.items;
        if (!Array.isArray(items)) return res.status(400).json({ error: tReq(req, 'import.errors.items_array_required') });
        const defaultItemTypeKey = normalizeC3TaxonomyTargetKey(req.body?.target_key ?? req.query?.target_key);
        const defaultItemType = defaultItemTypeKey ? C3_TAXONOMY_IMPORT_TARGETS[defaultItemTypeKey].itemType : null;
        const spiralCode = req.body?.spiral_code ?? req.query?.spiral_code ?? null;
        const result = await runC3TaxonomyImport(items, { defaultItemType, spiralCode });
        res.json({ message: tReq(req, 'taxonomy.messages.c3_taxonomy_synced'), ...result });
    } catch (err) { next(err); }
});

// ─── POST /api/v1/taxonomy/c3/csv ─────────────────────────────────────────────
// Content-Type: text/csv or text/plain; delimiter may be ; or ,.
// Reusing the same _norm() logic as c3/sync.
router.post('/c3/csv', canAdmin, require('express').text({ type: ['text/csv', 'text/plain'], limit: '5mb' }), async (req, res, next) => {
    try {
        const csvText = typeof req.body === 'string' ? req.body.replace(/^\uFEFF/, '') : '';
        if (!csvText.trim()) return res.status(400).json({ error: tReq(req, 'import.errors.csv_text_required') });

        const lines = csvText.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return res.status(400).json({ error: tReq(req, 'import.errors.csv_requires_header') });

        const delim = lines[0].split(';').length >= lines[0].split(',').length ? ';' : ',';
        const headers = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, ''));

        const rawItems = lines.slice(1).map(line => {
            // Simple CSV split (no quoted field support needed for taxonomy fields)
            const vals = line.split(delim);
            const obj = {};
            headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim().replace(/^"|"$/g, '') || null; });
            return obj;
        });
        const defaultItemTypeKey = normalizeC3TaxonomyTargetKey(req.query?.target_key);
        const defaultItemType = defaultItemTypeKey ? C3_TAXONOMY_IMPORT_TARGETS[defaultItemTypeKey].itemType : null;
        const spiralCode = req.query?.spiral_code ?? null;
        const result = await runC3TaxonomyImport(rawItems, { defaultItemType, spiralCode });
        res.json({ ok: true, source: 'csv', ...result });
    } catch (err) { next(err); }
});

router.post(
    '/c3/xlsx',
    canAdmin,
    require('express').raw({
        type: [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/octet-stream',
            'application/zip',
        ],
        limit: '10mb',
    }),
    async (req, res, next) => {
        try {
            const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? '');
            if (!buffer.length) return res.status(400).json({ error: tReq(req, 'taxonomy.errors.xlsx_body_required') });

            const workbook = parseSimpleXlsxBuffer(buffer);
            const targetKey = normalizeC3TaxonomyTargetKey(req.query?.target_key);
            const sheetMatch = Object.entries(C3_TAXONOMY_IMPORT_TARGETS)
                .find(([, target]) => target.sheetName.toLowerCase() === String(workbook.sheetName ?? '').trim().toLowerCase());
            const effectiveTargetKey = targetKey ?? sheetMatch?.[0] ?? null;
            const effectiveTarget = effectiveTargetKey ? C3_TAXONOMY_IMPORT_TARGETS[effectiveTargetKey] : null;

            if (!effectiveTarget) {
                return res.status(400).json({ error: tReq(req, 'taxonomy.errors.target_detection_failed') });
            }

            const spiralCode = req.query?.spiral_code ?? null;
            const result = await runC3TaxonomyImport(workbook.rows, { defaultItemType: effectiveTarget.itemType, spiralCode });
            res.json({
                ok: true,
                source: 'xlsx',
                sheet_name: workbook.sheetName,
                target_key: effectiveTargetKey,
                target_label: effectiveTarget.label,
                ...result,
            });
        } catch (err) {
            if (isXlsxParserError(err)) {
                return res.status(400).json({ error: err.message });
            }
            next(err);
        }
    }
);

router.post(
    '/c3/:targetKey/xml-archimate',
    canAdmin,
    require('express').text({
        type: ['application/xml', 'text/xml', 'application/octet-stream', 'text/plain'],
        limit: '10mb',
    }),
    async (req, res, next) => {
        try {
            const targetKey = normalizeC3TaxonomyTargetKey(req.params.targetKey);
            const target = targetKey ? C3_TAXONOMY_IMPORT_TARGETS[targetKey] : null;
            if (!target) return res.status(400).json({ error: tReq(req, 'taxonomy.errors.target_detection_failed') });

            const xmlText = typeof req.body === 'string' ? req.body : String(req.body ?? '');
            if (!xmlText.trim()) return res.status(400).json({ error: 'ArchiMate parser: XML body is required' });

            const parsed = parseArchimateXml(xmlText, { targetKey });
            if (isTruthyQuery(req.query?.dry_run)) {
                return res.json({
                    ok: true,
                    source: 'xml-archimate',
                    dry_run: true,
                    target_key: targetKey,
                    target_label: target.label,
                    rowsParsed: parsed.row_count,
                    issue_count: parsed.issues.length,
                    issues: parsed.issues,
                    preview: parsed.rows.slice(0, 20),
                });
            }

            const spiralCode = req.query?.spiral_code ?? null;
            const result = await runC3TaxonomyImport(parsed.rows, { defaultItemType: target.itemType, spiralCode });
            return res.json({
                ok: true,
                source: 'xml-archimate',
                target_key: targetKey,
                target_label: target.label,
                parser_issue_count: parsed.issues.length,
                parser_issues: parsed.issues,
                ...result,
            });
        } catch (err) {
            if (isArchimateParserError(err)) return res.status(400).json({ error: err.message });
            next(err);
        }
    },
);

router.post(
    '/c3-capability-builder/dry-run',
    canAdmin,
    async (req, res, next) => {
        try {
            const items = Array.isArray(req.body)
                ? req.body
                : Array.isArray(req.body?.items)
                    ? req.body.items
                    : Array.isArray(req.body?.data)
                        ? req.body.data
                        : null;
            if (!items) return res.status(400).json({ error: tReq(req, 'import.errors.items_array_required') });

            const result = await validateCapabilityBuilderImportRows(items, (key, params) => tReq(req, key, params));
            res.json({
                ok: true,
                source: 'json',
                message: tReq(req, 'taxonomy.messages.dry_run_completed', { label: CAPABILITY_BUILDER_IMPORT_TARGET.label }),
                ...result,
            });
        } catch (err) { next(err); }
    }
);

router.post(
    '/c3-capability-builder/sync',
    canAdmin,
    async (req, res, next) => {
        try {
            const items = Array.isArray(req.body)
                ? req.body
                : Array.isArray(req.body?.items)
                    ? req.body.items
                    : Array.isArray(req.body?.data)
                        ? req.body.data
                        : null;
            if (!items) return res.status(400).json({ error: tReq(req, 'import.errors.items_array_required') });

            const result = await importCapabilityBuilderRows(items, {
                sourceName: req.body?.source_name ?? null,
                sourceKind: 'json',
                spiralCode: req.body?.spiral_code ?? req.query?.spiral_code ?? null,
                createdBy: req.user?.username ?? null,
                translate: (key, params) => tReq(req, key, params),
            });
            res.json(result);
        } catch (err) {
            if (isUniqueViolation(err)) {
                return res.status(409).json({ error: tReq(req, 'taxonomy.errors.duplicate_page_or_uuid') });
            }
            next(err);
        }
    }
);

router.post(
    '/c3-capability-builder/csv/dry-run',
    canAdmin,
    require('express').text({ type: ['text/csv', 'text/plain'], limit: '10mb' }),
    async (req, res, next) => {
        try {
            const csvText = typeof req.body === 'string' ? req.body : '';
            if (!csvText.trim()) return res.status(400).json({ error: tReq(req, 'import.errors.csv_text_required') });

            const rawItems = parseDelimitedRecords(csvText);
            if (rawItems.length === 0) return res.status(400).json({ error: tReq(req, 'import.errors.csv_requires_header') });

                const result = await validateCapabilityBuilderImportRows(rawItems, (key, params) => tReq(req, key, params));
                res.json({
                    ok: true,
                    source: 'csv',
                    message: tReq(req, 'taxonomy.messages.dry_run_completed', { label: CAPABILITY_BUILDER_IMPORT_TARGET.label }),
                    ...result,
                });
        } catch (err) { next(err); }
    }
);

router.post(
    '/c3-capability-builder/csv',
    canAdmin,
    require('express').text({ type: ['text/csv', 'text/plain'], limit: '10mb' }),
    async (req, res, next) => {
        try {
            const csvText = typeof req.body === 'string' ? req.body : '';
            if (!csvText.trim()) return res.status(400).json({ error: tReq(req, 'import.errors.csv_text_required') });

            const rawItems = parseDelimitedRecords(csvText);
            if (rawItems.length === 0) return res.status(400).json({ error: tReq(req, 'import.errors.csv_requires_header') });

            const result = await importCapabilityBuilderRows(rawItems, {
                sourceName: req.query?.source_name ?? null,
                sourceKind: 'csv',
                createdBy: req.user?.username ?? null,
                translate: (key, params) => tReq(req, key, params),
            });
            res.json(result);
        } catch (err) {
            if (isUniqueViolation(err)) {
                return res.status(409).json({ error: tReq(req, 'taxonomy.errors.duplicate_page_or_uuid') });
            }
            next(err);
        }
    }
);

Object.entries(C3_ENTITY_IMPORT_TARGETS).forEach(([targetKey, targetConfig]) => {
    router.get(
        `/${targetKey}`,
        canAdmin,
        async (req, res, next) => {
            try {
                const search = parseTextFilter(req.query.search);
                const limit = parseIntFilter(req.query.limit, { fallback: 200, min: 1, max: 1000 });
                const result = await selectRows(getPool(), `
                    SELECT *
                    FROM ${targetConfig.listView}
                    ORDER BY COALESCE(order_num, 999999), title, uuid
                `);
                let rows = result;
                if (search) {
                    const q = search.toLowerCase();
                    rows = rows.filter((row) =>
                        Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(q))
                    );
                }
                res.json(rows.slice(0, limit));
            } catch (err) { next(err); }
        }
    );

    router.put(
        `/${targetKey}/:id`,
        canEdit,
        async (req, res, next) => {
            try {
                const entityId = parseIntFilter(req.params.id, { fallback: null, min: 1, max: 2147483647 });
                if (!entityId) return res.status(400).json({ error: tReq(req, 'taxonomy.errors.invalid_id') });

                await updateC3ImportEntity(targetKey, entityId, req.body ?? {}, (key, params) => tReq(req, key, params));
                res.json({ ok: true, message: tReq(req, 'taxonomy.messages.entity_updated', { label: targetConfig.label }) });
            } catch (err) { next(err); }
        }
    );

    router.post(
        `/${targetKey}/dry-run`,
        canAdmin,
        async (req, res, next) => {
            try {
                const items = Array.isArray(req.body)
                    ? req.body
                    : Array.isArray(req.body?.items)
                        ? req.body.items
                        : Array.isArray(req.body?.data)
                            ? req.body.data
                            : null;
                if (!items) return res.status(400).json({ error: tReq(req, 'import.errors.items_array_required') });

                const result = validateC3EntityRows(targetKey, items, (key, params) => tReq(req, key, params));
                res.json({
                    ok: true,
                    source: 'json',
                    message: tReq(req, 'taxonomy.messages.dry_run_completed', { label: targetConfig.label }),
                    ...result,
                });
            } catch (err) { next(err); }
        }
    );

    router.post(
        `/${targetKey}/sync`,
        canAdmin,
        async (req, res, next) => {
            try {
                const items = Array.isArray(req.body)
                    ? req.body
                    : Array.isArray(req.body?.items)
                        ? req.body.items
                        : Array.isArray(req.body?.data)
                            ? req.body.data
                            : null;
                if (!items) return res.status(400).json({ error: tReq(req, 'import.errors.items_array_required') });

                const spiralCode = req.body?.spiral_code ?? req.query?.spiral_code ?? await getActiveSpiralCode();
                const result = await importC3EntityRows(targetKey, items, { spiralCode });
                if (['c3-application', 'c3-data-objects', 'c3-services', 'c3-technology-interactions'].includes(targetKey)) {
                    if (targetKey !== 'c3-technology-interactions') {
                        await syncAllTechnologyInteractionLinks();
                    }
                    await syncCapabilityDerivedLinksForAll();
                }
                const runId = await createC3EntityImportRun({
                    targetKey,
                    sourceName: req.body?.source_name ?? null,
                    sourceKind: 'json',
                    isDryRun: false,
                    spiralCode,
                    rowCount: result.rowsParsed,
                    okCount: result.ok_count,
                    warnCount: result.warn_count,
                    errorCount: result.error_count,
                    insertedCount: result.inserted,
                    updatedCount: result.updated,
                    failedCount: result.failed,
                    createdBy: req.user?.username ?? null,
                    notes: `${targetConfig.label} JSON import`,
                });
                await recordMembershipBatch(result.membership_records, { sourceRunId: runId });
                await logC3EntityImportIssues(runId, result.issues);
                res.json({
                    ok: true,
                    source: 'json',
                    message: tReq(req, 'taxonomy.messages.entity_synced', { label: targetConfig.label }),
                    run_id: runId,
                    ...result,
                });
            } catch (err) { next(err); }
        }
    );

    router.post(
        `/${targetKey}/csv/dry-run`,
        canAdmin,
        require('express').text({ type: ['text/csv', 'text/plain'], limit: '10mb' }),
        async (req, res, next) => {
            try {
                const csvText = typeof req.body === 'string' ? req.body : '';
                if (!csvText.trim()) return res.status(400).json({ error: tReq(req, 'import.errors.csv_text_required') });

                const rawItems = parseDelimitedRecords(csvText);
                if (rawItems.length === 0) return res.status(400).json({ error: tReq(req, 'import.errors.csv_requires_header') });

                const result = validateC3EntityRows(targetKey, rawItems, (key, params) => tReq(req, key, params));
                res.json({
                    ok: true,
                    source: 'csv',
                    message: tReq(req, 'taxonomy.messages.dry_run_completed', { label: targetConfig.label }),
                    ...result,
                });
            } catch (err) { next(err); }
        }
    );

    router.post(
        `/${targetKey}/csv`,
        canAdmin,
        require('express').text({ type: ['text/csv', 'text/plain'], limit: '10mb' }),
        async (req, res, next) => {
            try {
                const csvText = typeof req.body === 'string' ? req.body : '';
                if (!csvText.trim()) return res.status(400).json({ error: tReq(req, 'import.errors.csv_text_required') });

                const rawItems = parseDelimitedRecords(csvText);
                if (rawItems.length === 0) return res.status(400).json({ error: tReq(req, 'import.errors.csv_requires_header') });

                const spiralCode = req.query?.spiral_code ?? await getActiveSpiralCode();
                const result = await importC3EntityRows(targetKey, rawItems, { spiralCode });
                if (['c3-application', 'c3-data-objects', 'c3-services', 'c3-technology-interactions'].includes(targetKey)) {
                    if (targetKey !== 'c3-technology-interactions') {
                        await syncAllTechnologyInteractionLinks();
                    }
                    await syncCapabilityDerivedLinksForAll();
                }
                const runId = await createC3EntityImportRun({
                    targetKey,
                    sourceName: req.query?.source_name ?? null,
                    sourceKind: 'csv',
                    isDryRun: false,
                    spiralCode,
                    rowCount: result.rowsParsed,
                    okCount: result.ok_count,
                    warnCount: result.warn_count,
                    errorCount: result.error_count,
                    insertedCount: result.inserted,
                    updatedCount: result.updated,
                    failedCount: result.failed,
                    createdBy: req.user?.username ?? null,
                    notes: `${targetConfig.label} CSV import`,
                });
                await recordMembershipBatch(result.membership_records, { sourceRunId: runId });
                await logC3EntityImportIssues(runId, result.issues);
                res.json({
                    ok: true,
                    source: 'csv',
                    message: tReq(req, 'taxonomy.messages.entity_imported', { label: targetConfig.label }),
                    run_id: runId,
                    ...result,
                });
            } catch (err) { next(err); }
        }
    );
});

router.get('/c3-technology-interactions/link-report', canAdmin, async (req, res, next) => {
    try {
        const search = parseTextFilter(req.query.search);
        const unresolvedOnly = String(req.query.unresolved_only ?? '').trim() === '1';
        const limit = parseIntFilter(req.query.limit, { fallback: 200, min: 1, max: 1000 });
        const result = await selectRows(getPool(), `
            SELECT *
            FROM data.v_c3technologyinteractionlinkreport
            ORDER BY title, uuid
        `);
        let rows = result;
        if (unresolvedOnly) {
            rows = rows.filter((row) =>
                row.unresolved_service_refs ||
                row.unresolved_application_refs ||
                row.unresolved_data_object_refs
            );
        }
        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter((row) =>
                String(row.technology_interaction_code ?? '').toLowerCase().includes(q) ||
                String(row.title ?? '').toLowerCase().includes(q) ||
                String(row.unresolved_service_refs ?? '').toLowerCase().includes(q) ||
                String(row.unresolved_application_refs ?? '').toLowerCase().includes(q) ||
                String(row.unresolved_data_object_refs ?? '').toLowerCase().includes(q)
            );
        }
        res.json(rows.slice(0, limit));
    } catch (err) { next(err); }
});

router.get('/import-runs/latest', canAdmin, async (req, res, next) => {
    try {
        const result = await selectRows(getPool(), `
            SELECT *
            FROM data.v_c3entityimportrunlatest
            ORDER BY created_at DESC, id DESC
        `);
        const rows = result.map((row) => ({
            ...row,
            label: getImportTargetMeta(row.target_key)?.label ?? row.target_key,
            admin_path: getImportTargetMeta(row.target_key)?.adminPath ?? null,
        }));
        res.json(rows);
    } catch (err) { next(err); }
});

router.get('/import-runs/:id', canAdmin, async (req, res, next) => {
    try {
        const runId = parseIntFilter(req.params.id, { fallback: null, min: 1, max: 2147483647 });
        if (!runId) return res.status(400).json({ error: 'Neplatné run id' });

        const run = await selectOne(getPool(), `
            SELECT *
            FROM data.c3_entity_import_run
            WHERE id = $1
        `, [runId]);
        if (!run) return res.status(404).json({ error: 'Import run nenalezen' });

        const issues = await selectRows(getPool(), `
            SELECT *
            FROM data.c3_entity_import_issue
            WHERE run_id = $1
            ORDER BY row_number, id
        `, [runId]);

        res.json({
            ...run,
            label: getImportTargetMeta(run.target_key)?.label ?? run.target_key,
            admin_path: getImportTargetMeta(run.target_key)?.adminPath ?? null,
            issues,
        });
    } catch (err) { next(err); }
});

// =============================================================================
// POST /api/v1/taxonomy/c3/import-baseline
// Imports C3 Taxonomy Baseline JSON (xlsx → JSON export through python/pandas).
// Format: { "workbook": "...", "sheets": [ { "sheet_name": "BP", "rows": [
//   ["Title","Business Process[title]","Business Process[description]","Business Process[parent]","Business Process[uuid]"],
//   ["BP-1016", "Accounting", "...", "BP-1459", "4ec1702a-..."],
//   ...
// ]}]}
// Sloupce: 0=c3_code, 1=title, 2=description, 3=parent_code, 4=uuid
// Requires migration 17_c3taxonomy_parent.sql (item_type, parent_code, parent_uuid).
// =============================================================================
router.post('/c3/import-baseline', canAdmin, async (req, res, next) => {
    try {
        const { sheets } = req.body || {};
        if (!Array.isArray(sheets) || sheets.length === 0)
            return res.status(400).json({ error: tReq(req, 'taxonomy.errors.sheets_required') });

        // ── Pass 1: build codeToUuid map from all sheets ──────────────────────
        // Allows immediate resolution of parent_uuid and cross-sheet links.
        const codeToUuid = new Map(); // BP-1016 → "4ec1702a-..."
        for (const sheet of sheets) {
            const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
            for (let i = 1; i < rows.length; i++) {    // i=0 is the header row
                const row = rows[i];
                const code = String(row[0] ?? '').trim();
                const uuid = String(row[4] ?? '').trim();
                if (code && uuid) codeToUuid.set(code, uuid);
            }
        }

        // ── Pass 2: upsert all records ────────────────────────────────────────
        let inserted = 0, updated = 0, failed = 0;
        const pool = getPool();

        for (const sheet of sheets) {
            const itemType = String(sheet.sheet_name ?? '').trim().slice(0, 10);
            const rows = Array.isArray(sheet.rows) ? sheet.rows : [];

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                try {
                    const c3Code    = String(row[0] ?? '').trim();   // BP-1016
                    const title     = String(row[1] ?? '').trim().slice(0, 500);
                    const desc      = row[2] != null && row[2] !== '' ? String(row[2]) : null;
                    const parCode   = String(row[3] ?? '').trim() || null;  // BP-1459
                    const uuid      = String(row[4] ?? '').trim();

                    if (!uuid || !title) { failed++; continue; }

                    const parentUuid = parCode ? (codeToUuid.get(parCode) ?? null) : null;

                    const existing = await selectOne(pool, `
                        SELECT id
                        FROM data.c3_taxonomy
                        WHERE uuid = $1
                    `, [uuid]);

                    const values = [uuid, title, desc, c3Code || null, itemType || null, parCode, parentUuid];

                    if (existing) {
                        await pool.query(`
                            UPDATE data.c3_taxonomy
                            SET
                                title = $2,
                                description = $3,
                                external_id = $4,
                                item_type = $5,
                                parent_code = $6,
                                parent_uuid = $7,
                                synced_at = CURRENT_TIMESTAMP
                            WHERE uuid = $1
                        `, values);
                        updated++;
                    } else {
                        await pool.query(`
                            INSERT INTO data.c3_taxonomy (
                                uuid,
                                title,
                                description,
                                external_id,
                                item_type,
                                parent_code,
                                parent_uuid,
                                synced_at
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                        `, values);
                        inserted++;
                    }
                } catch (rowErr) {
                    failed++;
                    console.error('[c3/import-baseline] row error:', rowErr.message, row);
                }
            }
        }

        // ── Pass 3: backfill parent_uuid for records where parent arrived after child ──
        // Cross-sheet cases are rare in practice, but this is a safety net.
        try {
            await syncTaxonomyParentUuids();
        } catch (resolveErr) {
            console.warn('[c3/import-baseline] parent_uuid resolve pass failed:', resolveErr.message);
        }

        invalidateC3CacheKeys();
        const stats = { inserted, updated, failed, total: inserted + updated + failed };
        console.log('[c3/import-baseline]', stats);
        res.json({ message: tReq(req, 'taxonomy.messages.baseline_import_completed'), ...stats });
    } catch (err) { next(err); }
});

// =============================================================================
// ServiceC3Mapping — CRUD for ServiceCatalog ↔ C3Taxonomy mapping.
// Schema v4: service_id je BIGINT FK (ServiceCatalog.id), M:N relace
// Columns: c3_parent_uuid (formerly c3_parent_id), synced_at (formerly c3_synced_at),
//          sync_status (formerly c3_sync_status), + mapping_type_code (NOT NULL FK)
// =============================================================================

// GET /api/v1/taxonomy/mapping/:serviceId — all C3 mappings for a service
router.get('/mapping/:serviceId', async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const catalogId = await _getCatalogId(serviceId);
        const rows = await selectRows(getPool(), `
            SELECT
                scm.id,
                sc.service_id,
                scm.c3_uuid,
                scm.c3_parent_uuid AS c3_parent_id,
                scm.c3_level,
                scm.c3_domain,
                scm.c3_source,
                scm.c3_reference,
                scm.mapping_type_code,
                scm.pace_code,
                scm.is_primary,
                scm.mapping_note,
                scm.synced_at AS c3_synced_at,
                scm.sync_status AS c3_sync_status
            FROM data.service_c3_mapping scm
            JOIN data.service_catalog sc ON sc.id = scm.service_id
            WHERE scm.service_id = $1
            ORDER BY scm.is_primary DESC, scm.created_at ASC
        `, [catalogId]);
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/v1/taxonomy/mapping — optional ?c3_uuid=... filter
router.get('/mapping', async (req, res, next) => {
    try {
        const { c3_uuid } = req.query;
        const safeC3Uuid = parseTextFilter(c3_uuid, { maxLength: 100 });
        const params = [];
        const where = safeC3Uuid ? `WHERE scm.c3_uuid = $${params.push(safeC3Uuid)}` : '';
        const rows = await selectRows(getPool(), `
            SELECT
                scm.id,
                sc.service_id,
                scm.c3_uuid,
                scm.c3_parent_uuid  AS c3_parent_id,
                scm.c3_level,
                scm.c3_domain, scm.c3_source, scm.c3_reference,
                scm.mapping_type_code,
                scm.pace_code,
                scm.is_primary,
                scm.mapping_note,
                scm.synced_at       AS c3_synced_at,
                scm.sync_status     AS c3_sync_status
            FROM data.service_c3_mapping scm
            JOIN data.service_catalog sc ON sc.id = scm.service_id AND sc.is_deleted = FALSE
            ${where}
            ORDER BY sc.service_id, scm.is_primary DESC
        `, params);
        res.json(rows);
    } catch (err) { next(err); }
});

// PUT /api/v1/taxonomy/mapping/:serviceId — upsert primary C3 mapping
// Upsert keyed on (service_id BIGINT, c3_uuid, mapping_type_code)
router.put('/mapping/:serviceId', canAdmin, async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const b = req.body || {};

        const catalogId = await _getCatalogId(serviceId);
        const c3Uuid    = b.c3_uuid || null;
        const mapType   = b.mapping_type_code || 'supports';
        const paceCode  = b.pace_code || null;

        if (!c3Uuid) return res.status(400).json({ error: tReq(req, 'taxonomy.errors.required_field', { field: 'c3_uuid' }) });

        const currentMappings = await getMappingsForCatalogId(catalogId);
        const existingMapping = currentMappings.find((mapping) =>
            mapping.c3_uuid === c3Uuid && mapping.mapping_type_code === mapType
        ) ?? null;

        const candidateMapping = {
            id: existingMapping?.id ?? null,
            c3_uuid: c3Uuid,
            mapping_type_code: mapType,
            is_primary: Boolean(b.is_primary),
        };
        const nextMappings = currentMappings
            .filter((mapping) => !existingMapping || mapping.id !== existingMapping.id)
            .map((mapping) => ({
                ...mapping,
                is_primary: b.is_primary ? false : mapping.is_primary,
            }));
        nextMappings.push(candidateMapping);

        await assertServiceMappingsAllowedForState(catalogId, nextMappings, (key, params) => tReq(req, key, params));

        const existing = await selectOne(getPool(), `
            SELECT *
            FROM data.service_c3_mapping
            WHERE service_id = $1
              AND c3_uuid = $2
              AND mapping_type_code = $3
              AND ((pace_code IS NULL AND $4::varchar IS NULL) OR pace_code = $4)
            ORDER BY id
            LIMIT 1
        `, [catalogId, c3Uuid, mapType, paceCode]);

        if (existing) {
            await getPool().query(`
                UPDATE data.service_c3_mapping
                SET
                    c3_parent_uuid = $5,
                    c3_level = $6,
                    c3_domain = $7,
                    c3_source = $8,
                    c3_reference = $9,
                    synced_at = CURRENT_TIMESTAMP,
                    sync_status = $10,
                    is_primary = $11,
                    mapping_note = $12
                WHERE service_id = $1
                  AND c3_uuid = $2
                  AND mapping_type_code = $3
                  AND ((pace_code IS NULL AND $4::varchar IS NULL) OR pace_code = $4)
            `, [
                catalogId,
                c3Uuid,
                mapType,
                paceCode,
                b.c3_parent_id ?? null,
                normalizeOptionalInt(b.c3_level),
                b.c3_domain ?? null,
                b.c3_source ?? null,
                b.c3_reference ?? null,
                b.c3_sync_status ?? 'manual',
                Boolean(b.is_primary),
                b.mapping_note ?? null,
            ]);
            await logTaxonomyMappingChange({
                servicePk: catalogId,
                c3Uuid,
                mappingId: existing.id ?? null,
                actionType: 'UPDATE',
                oldValues: existing ?? null,
                newValues: {
                    c3_parent_uuid: b.c3_parent_id ?? null,
                    c3_level: b.c3_level ?? null,
                    c3_domain: b.c3_domain ?? null,
                    c3_source: b.c3_source ?? null,
                    c3_reference: b.c3_reference ?? null,
                    sync_status: b.c3_sync_status ?? 'manual',
                    is_primary: Boolean(b.is_primary),
                    mapping_note: b.mapping_note ?? null,
                },
                changedBy: req.user?.username || 'system',
            });

            if (b.is_primary) {
                await getPool().query(`
                    UPDATE data.service_c3_mapping
                    SET is_primary = CASE WHEN id = $2 THEN TRUE ELSE FALSE END
                    WHERE service_id = $1
                `, [catalogId, existing.id ?? existingMapping?.id]);
            }
        } else {
            const insertResult = await getPool().query(`
                INSERT INTO data.service_c3_mapping (
                    service_id,
                    c3_uuid,
                    mapping_type_code,
                    pace_code,
                    c3_parent_uuid,
                    c3_level,
                    c3_domain,
                    c3_source,
                    c3_reference,
                    synced_at,
                    sync_status,
                    is_primary,
                    mapping_note
                )
                VALUES (
                    $1, $2, $3, $4,
                    $5, $6, $7, $8, $9,
                    CURRENT_TIMESTAMP, $10, $11, $12
                )
                RETURNING id
            `, [
                catalogId,
                c3Uuid,
                mapType,
                paceCode,
                b.c3_parent_id ?? null,
                normalizeOptionalInt(b.c3_level),
                b.c3_domain ?? null,
                b.c3_source ?? null,
                b.c3_reference ?? null,
                b.c3_sync_status ?? 'manual',
                Boolean(b.is_primary),
                b.mapping_note ?? null,
            ]);
            await logTaxonomyMappingChange({
                servicePk: catalogId,
                c3Uuid,
                actionType: 'INSERT',
                oldValues: null,
                newValues: {
                    mapping_type_code: mapType,
                    pace_code: paceCode,
                    c3_parent_uuid: b.c3_parent_id ?? null,
                    c3_level: b.c3_level ?? null,
                    c3_domain: b.c3_domain ?? null,
                    c3_source: b.c3_source ?? null,
                    c3_reference: b.c3_reference ?? null,
                    sync_status: b.c3_sync_status ?? 'manual',
                    is_primary: Boolean(b.is_primary),
                    mapping_note: b.mapping_note ?? null,
                },
                changedBy: req.user?.username || 'system',
            });

            if (b.is_primary) {
                const insertedId = resultRows(insertResult)[0]?.id ?? null;
                await getPool().query(`
                    UPDATE data.service_c3_mapping
                    SET is_primary = CASE WHEN id = $2 THEN TRUE ELSE FALSE END
                    WHERE service_id = $1
                `, [catalogId, insertedId]);
            }
        }

        const result = await selectOne(getPool(), `
            SELECT
                scm.id,
                sc.service_id,
                scm.c3_uuid,
                scm.c3_parent_uuid AS c3_parent_id,
                scm.c3_level,
                scm.c3_domain,
                scm.c3_source,
                scm.c3_reference,
                scm.mapping_type_code,
                scm.pace_code,
                scm.is_primary,
                scm.mapping_note,
                scm.synced_at AS c3_synced_at,
                scm.sync_status AS c3_sync_status
            FROM data.service_c3_mapping scm
            JOIN data.service_catalog sc ON sc.id = scm.service_id
            WHERE scm.service_id = $1
              AND scm.c3_uuid = $2
              AND scm.mapping_type_code = $3
              AND ((scm.pace_code IS NULL AND $4::varchar IS NULL) OR scm.pace_code = $4)
            ORDER BY scm.id DESC
            LIMIT 1
        `, [catalogId, c3Uuid, mapType, paceCode]);
        res.json(result || {});
    } catch (err) { next(err); }
});

// DELETE /api/v1/taxonomy/mapping/:serviceId/:mappingId — delete one C3 mapping by PK
router.delete('/mapping/:serviceId/:mappingId', canAdmin, async (req, res, next) => {
    try {
        const { serviceId, mappingId } = req.params;
        const catId = await _getCatalogId(serviceId);
        const mappingPk = parseInt(mappingId, 10);
        if (isNaN(mappingPk)) return res.status(400).json({ error: 'Neplatné mappingId' });
        const currentMappings = await getMappingsForCatalogId(catId);
        const nextMappings = currentMappings.filter((mapping) => Number(mapping.id) !== Number(mappingPk));
        await assertServiceMappingsAllowedForState(catId, nextMappings, (key, params) => tReq(req, key, params));
        const oldRow = await selectOne(getPool(), `
            SELECT *
            FROM data.service_c3_mapping
            WHERE id = $1 AND service_id = $2
            LIMIT 1
        `, [mappingPk, catId]);
        const result = await getPool().query(`
            DELETE FROM data.service_c3_mapping
            WHERE id = $1 AND service_id = $2
        `, [mappingPk, catId]);
        if (resultRowCount(result) === 0) return res.status(404).json({ error: 'Mapování nenalezeno' });
        await logTaxonomyMappingChange({
            servicePk: catId,
            c3Uuid: oldRow?.c3_uuid ?? null,
            mappingId: mappingPk,
            actionType: 'DELETE',
            oldValues: oldRow ?? null,
            newValues: null,
            changedBy: req.user?.username || 'system',
        });
        res.json({ message: tReq(req, 'taxonomy.messages.mapping_deleted'), id: mappingPk });
    } catch (err) { next(err); }
});

// DELETE /api/v1/taxonomy/mapping/:serviceId — delete all C3 mappings for a service
router.delete('/mapping/:serviceId', canAdmin, async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const catalogId = await _getCatalogId(serviceId);
        const serviceState = await getServiceStateByCatalogId(catalogId);
        if (serviceState && isActiveServiceStatus(serviceState.service_status)) {
            return res.status(409).json({ error: 'Aktivní službě nelze smazat všechna C3 mapování.' });
        }
        const oldRows = await selectRows(getPool(), `
            SELECT *
            FROM data.service_c3_mapping
            WHERE service_id = $1
        `, [catalogId]);
        await getPool().query(`
            DELETE FROM data.service_c3_mapping
            WHERE service_id = $1
        `, [catalogId]);
        for (const row of oldRows) {
            await logTaxonomyMappingChange({
                servicePk: catalogId,
                c3Uuid: row.c3_uuid,
                mappingId: row.id,
                actionType: 'DELETE_ALL',
                oldValues: row,
                newValues: null,
                changedBy: req.user?.username || 'system',
            });
        }
        res.json({ message: tReq(req, 'taxonomy.messages.c3_mappings_deleted'), serviceId });
    } catch (err) { next(err); }
});

// ─── GET /api/v1/taxonomy/portfolio-groups ────────────────────────────────────
// Editor dropdown: active groups only.
router.get('/portfolio-groups', async (req, res, next) => {
    try {
        const CACHE_KEY = 'ref_portfolio_groups';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);
        const result = await selectRows(getPool(), `
            SELECT code, name, sort_order
            FROM data.ref_portfolio_group
            WHERE is_active = TRUE
            ORDER BY sort_order, name
        `);
        cache.set(CACHE_KEY, result);
        res.json(result);
    } catch (err) { next(err); }
});

// ─── GET /api/v1/taxonomy/service-types ──────────────────────────────────────
// ref_ServiceType has no is_active; return everything.
router.get('/service-types', async (req, res, next) => {
    try {
        const CACHE_KEY = 'ref_service_types';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);
        const result = await selectRows(getPool(), `
            SELECT code, name, description
            FROM data.ref_service_type
            ORDER BY code
        `);
        cache.set(CACHE_KEY, result);
        res.json(result);
    } catch (err) { next(err); }
});

// ─── GET /api/v1/taxonomy/domains ────────────────────────────────────────────
// ref_NetworkDomain — pro editor dropdown i import validaci
router.get('/domains', async (req, res, next) => {
    try {
        const CACHE_KEY = 'ref_network_domains';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);
        const result = await selectRows(getPool(), `
            SELECT code, name, color_hex, sort_order
            FROM data.ref_network_domain
            ORDER BY sort_order, code
        `);
        cache.set(CACHE_KEY, result);
        res.json(result);
    } catch (err) { next(err); }
});

// ─── GET /api/v1/taxonomy/service-lines ──────────────────────────────────────
// Editor dropdown: full service-line → global_service_group_code hierarchy.
router.get('/service-lines', async (req, res, next) => {
    try {
        const CACHE_KEY = 'ref_service_lines';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);
        const result = await selectRows(getPool(), `
            SELECT code, name, global_service_group_code, sort_order
            FROM data.ref_service_line
            ORDER BY sort_order, name
        `);
        cache.set(CACHE_KEY, result);
        res.json(result);
    } catch (err) { next(err); }
});

// ─── ADMIN CRUD: ref_PortfolioGroup ──────────────────────────────────────────
// ref_PortfolioGroup has is_active; DELETE is soft (deactivation, not physical deletion).

// POST /api/v1/taxonomy/portfolio-groups
router.post('/portfolio-groups', canAdmin, async (req, res, next) => {
    try {
        const b = req.body || {};
        if (!b.code || !b.name) return res.status(400).json({ error: 'Pole code a name jsou povinná' });

        const exists = await selectOne(getPool(), `
            SELECT 1
            FROM data.ref_portfolio_group
            WHERE code = $1
        `, [b.code]);
        if (exists) return res.status(409).json({ error: `Kód '${b.code}' již existuje` });

        await getPool().query(`
            INSERT INTO data.ref_portfolio_group (code, name, sort_order)
            VALUES ($1, $2, $3)
        `, [b.code, b.name, normalizeOptionalInt(b.sort_order)]);

        invalidateRefCacheKeys('portfolioGroups');
        const row = await selectOne(getPool(), `
            SELECT code, name, sort_order, is_active
            FROM data.ref_portfolio_group
            WHERE code = $1
        `, [b.code]);
        res.status(201).json(row);
    } catch (err) { next(err); }
});

// PUT /api/v1/taxonomy/portfolio-groups/:code
router.put('/portfolio-groups/:code', canAdmin, async (req, res, next) => {
    try {
        const { code } = req.params;
        const b = req.body || {};

        const exists = await selectOne(getPool(), `
            SELECT 1
            FROM data.ref_portfolio_group
            WHERE code = $1
        `, [code]);
        if (!exists) return res.status(404).json({ error: `Kód '${code}' nenalezen` });

        await getPool().query(`
            UPDATE data.ref_portfolio_group
            SET
                name = COALESCE($2, name),
                sort_order = COALESCE($3, sort_order),
                is_active = COALESCE($4, is_active)
            WHERE code = $1
        `, [
            code,
            b.name ?? null,
            normalizeOptionalInt(b.sort_order),
            normalizeOptionalBool(b.is_active),
        ]);

        invalidateRefCacheKeys('portfolioGroups');
        const row = await selectOne(getPool(), `
            SELECT code, name, sort_order, is_active
            FROM data.ref_portfolio_group
            WHERE code = $1
        `, [code]);
        res.json(row);
    } catch (err) { next(err); }
});

// DELETE /api/v1/taxonomy/portfolio-groups/:code (soft — sets is_active = 0)
// Hard delete is rejected because FK from ServiceCatalog and ref_GlobalServiceGroup would fail.
router.delete('/portfolio-groups/:code', canAdmin, async (req, res, next) => {
    try {
        const { code } = req.params;

        const exists = await selectOne(getPool(), `
            SELECT 1
            FROM data.ref_portfolio_group
            WHERE code = $1
        `, [code]);
        if (!exists) return res.status(404).json({ error: `Kód '${code}' nenalezen` });

        await getPool().query(`
            UPDATE data.ref_portfolio_group
            SET is_active = FALSE
            WHERE code = $1
        `, [code]);

       invalidateRefCacheKeys('portfolioGroups');
        res.json({ message: `PortfolioGroup '${code}' deaktivován`, code });
    } catch (err) { next(err); }
});

// ─── ADMIN CRUD: ref_ServiceLine ─────────────────────────────────────────────
// ref_ServiceLine has no is_active; DELETE is hard but FK-protected.

// POST /api/v1/taxonomy/service-lines
router.post('/service-lines', canAdmin, async (req, res, next) => {
    try {
        const b = req.body || {};
        if (!b.code || !b.name) return res.status(400).json({ error: 'Pole code a name jsou povinná' });

        const exists = await selectOne(getPool(), `
            SELECT 1
            FROM data.ref_service_line
            WHERE code = $1
        `, [b.code]);
        if (exists) return res.status(409).json({ error: `Kód '${b.code}' již existuje` });

        await getPool().query(`
            INSERT INTO data.ref_service_line (code, name, global_service_group_code, sort_order)
            VALUES ($1, $2, $3, $4)
        `, [b.code, b.name, b.global_service_group_code ?? null, normalizeOptionalInt(b.sort_order)]);

        invalidateRefCacheKeys('serviceLines');
        const row = await selectOne(getPool(), `
            SELECT code, name, global_service_group_code, sort_order
            FROM data.ref_service_line
            WHERE code = $1
        `, [b.code]);
        res.status(201).json(row);
    } catch (err) { next(err); }
});

// PUT /api/v1/taxonomy/service-lines/:code
router.put('/service-lines/:code', canAdmin, async (req, res, next) => {
    try {
        const { code } = req.params;
        const b = req.body || {};

        const exists = await selectOne(getPool(), `
            SELECT 1
            FROM data.ref_service_line
            WHERE code = $1
        `, [code]);
        if (!exists) return res.status(404).json({ error: `Kód '${code}' nenalezen` });

        await getPool().query(`
            UPDATE data.ref_service_line
            SET
                name = COALESCE($2, name),
                global_service_group_code = CASE
                    WHEN $3::boolean THEN $4
                    ELSE global_service_group_code
                END,
                sort_order = COALESCE($5, sort_order)
            WHERE code = $1
        `, [
            code,
            b.name ?? null,
            Object.prototype.hasOwnProperty.call(b, 'global_service_group_code'),
            b.global_service_group_code ?? null,
            normalizeOptionalInt(b.sort_order),
        ]);

        invalidateRefCacheKeys('serviceLines');
        const row = await selectOne(getPool(), `
            SELECT code, name, global_service_group_code, sort_order
            FROM data.ref_service_line
            WHERE code = $1
        `, [code]);
        res.json(row);
    } catch (err) { next(err); }
});

// DELETE /api/v1/taxonomy/service-lines/:code  (hard — s FK ochranou)
router.delete('/service-lines/:code', canAdmin, async (req, res, next) => {
    try {
        const { code } = req.params;

        const exists = await selectOne(getPool(), `
            SELECT 1
            FROM data.ref_service_line
            WHERE code = $1
        `, [code]);
        if (!exists) return res.status(404).json({ error: `Kód '${code}' nenalezen` });

        const used = await selectOne(getPool(), `
            SELECT service_id
            FROM data.service_catalog
            WHERE service_line_code = $1
              AND is_deleted = FALSE
            LIMIT 1
        `, [code]);
        if (used) {
            return res.status(409).json({
                error: `ServiceLine '${code}' je přiřazena ke službě '${used.service_id}' — nelze smazat`,
            });
        }

        await getPool().query(`
            DELETE FROM data.ref_service_line
            WHERE code = $1
        `, [code]);

        invalidateRefCacheKeys('serviceLines');
        res.json({ message: `ServiceLine '${code}' smazána`, code });
    } catch (err) { next(err); }
});

// ─── GET /api/v1/taxonomy/global-service-groups ──────────────────────────────
// Editor dropdown — seznam global service groups z ref_GlobalServiceGroup.
// Returns: [{ code, name, sort_order }]
router.get('/global-service-groups', async (req, res, next) => {
    try {
        const CACHE_KEY = 'ref_global_service_groups';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);

        const result = await selectRows(getPool(), `
            SELECT code, name, sort_order
            FROM data.ref_global_service_group
            ORDER BY COALESCE(sort_order, 9999), name
        `);
        cache.set(CACHE_KEY, result);
        res.json(result);
    } catch (err) { next(err); }
});

// ─── GET /api/v1/taxonomy/organizational-elements ────────────────────────────
// Editor dropdown: organizational elements from ref_OrganizationalElement.
// Returns: [{ code, name, sort_order }]
router.get('/organizational-elements', async (req, res, next) => {
    try {
        const CACHE_KEY = 'ref_organizational_elements';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);

        const result = await selectRows(getPool(), `
            SELECT code, name, sort_order
            FROM data.ref_organizational_element
            ORDER BY COALESCE(sort_order, 9999), name
        `);
        cache.set(CACHE_KEY, result);
        res.json(result);
    } catch (err) { next(err); }
});


// ─────────────────────────────────────────────────────────────────────────────
// SPIRAL GOVERNANCE (GAP #6)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/taxonomy/spiral — active baseline + list all
router.get('/spiral', async (req, res, next) => {
    try {
        const result = await selectRows(getPool(), `
            SELECT id, spiral_code, spiral_label, is_active, notes,
                   activated_at, activated_by, created_at
            FROM data.ref_spiral_baseline
            ORDER BY created_at DESC
        `);
        const active = result.find(r => r.is_active) ?? null;
        res.json({ active, all: result });
    } catch (err) { next(err); }
});

// PUT /api/v1/taxonomy/spiral/activate/:code — sets the selected spiral as active (canAdmin)
router.put('/spiral/activate/:code', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const pool = getPool();
        const code = req.params.code;
        const check = await selectOne(pool, `
            SELECT id
            FROM data.ref_spiral_baseline
            WHERE spiral_code = $1
        `, [code]);
        if (!check) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.spiral_not_found') });

        await pool.query(`UPDATE data.ref_spiral_baseline SET is_active = FALSE`);
        await pool.query(`
            UPDATE data.ref_spiral_baseline
            SET is_active = TRUE,
                activated_at = CURRENT_TIMESTAMP,
                activated_by = $2
            WHERE spiral_code = $1
        `, [code, req.user?.email ?? req.user?.username ?? null]);
        res.json({ ok: true, activated: code });
    } catch (err) { next(err); }
});

// POST /api/v1/taxonomy/spiral — add a new spiral baseline (canAdmin)
router.post('/spiral', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const { spiral_code, spiral_label, notes } = req.body;
        if (!spiral_code || !spiral_label)
            return res.status(400).json({ error: tReq(req, 'taxonomy.errors.spiral_required_fields') });
        const normalizedSpiralCode = normalizeSpiralCode(spiral_code, null);
        if (!normalizedSpiralCode)
            return res.status(400).json({ error: tReq(req, 'taxonomy.errors.spiral_required_fields') });
        await getPool().query(`
            INSERT INTO data.ref_spiral_baseline (spiral_code, spiral_label, is_active, notes)
            VALUES ($1, $2, FALSE, $3)
        `, [normalizedSpiralCode, spiral_label, notes ?? null]);
        res.status(201).json({ ok: true });
    } catch (err) {
        if (isUniqueViolation(err))
            return res.status(409).json({ error: tReq(req, 'taxonomy.errors.spiral_duplicate') });
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PICKER LIST ENDPOINTY pro CapabilityLinksPanel
// Returns a minimal entity list for the Add dialog (id, uuid, title, code).
// ─────────────────────────────────────────────────────────────────────────────

router.get('/c3-applications', requireAuth, async (req, res, next) => {
    try {
        const r = await selectRows(getPool(), `
            SELECT id, uuid, title, application_code AS code, item_status
            FROM data.c3_application
            WHERE COALESCE(item_status,'') <> 'deprecated'
            ORDER BY title
        `);
        res.json(r);
    } catch (err) { next(err); }
});

router.get('/c3-data-objects', requireAuth, async (req, res, next) => {
    try {
        const r = await selectRows(getPool(), `
            SELECT id, uuid, title, data_object_code AS code, item_status
            FROM data.c3_data_object
            WHERE COALESCE(item_status,'') <> 'deprecated'
            ORDER BY title
        `);
        res.json(r);
    } catch (err) { next(err); }
});

router.get('/c3-tins', requireAuth, async (req, res, next) => {
    try {
        const r = await selectRows(getPool(), `
            SELECT id, uuid, title, technology_interaction_code AS code, item_status
            FROM data.c3_technology_interaction
            WHERE COALESCE(item_status,'') <> 'deprecated'
            ORDER BY title
        `);
        res.json(r);
    } catch (err) { next(err); }
});

router.get('/c3-services-list', requireAuth, async (req, res, next) => {
    try {
        const r = await selectRows(getPool(), `
            SELECT id, uuid, title, service_code AS code, item_status
            FROM data.c3_service
            WHERE COALESCE(item_status,'') <> 'deprecated'
            ORDER BY title
        `);
        res.json(r);
    } catch (err) { next(err); }
});

module.exports = router;
