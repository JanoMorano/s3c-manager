'use strict';

/** C3 taxonomy helpers: legacy FMN Air C2 alias, taxonomy import, entity lookup and service mapping checks. */

const { getPool } = require('../../db/pool');
const { recordMembershipBatch } = require('../../db/spiral-membership.repo');
const {
    C3_ENTITY_IMPORT_TARGETS,
    syncTechnologyInteractionLinks,
    syncAllTechnologyInteractionLinks,
} = require('../../utils/c3-entity-import');
const { syncCapabilityDerivedLinksForAll } = require('../../utils/c3-capability-links');
const { getServiceStateByCatalogId, isActiveServiceStatus } = require('../../services/readiness');
const { tReq } = require('../../utils/i18n');
const { _private: capabilityCoverageEngine } = require('../capabilities');
const {
    ALLOWED_C3_ITEM_TYPES,
    AIR_C2_LEGACY_SLUG_FALLBACKS,
    AIR_C2_LEGACY_SPIRAL,
    AIR_C2_SUCCESSOR_ENDPOINT,
    C3_TAXONOMY_IMPORT_TARGETS,
    CAPABILITY_BUILDER_IMPORT_TARGET,
    invalidateC3CacheKeys,
    createHttpError,
    selectRows,
    selectOne,
    parseDateSafe,
    hasOwn,
} = require('./shared');

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
        } catch {
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

async function assertServiceMappingsAllowedForState(catalogId, nextMappings, translate = (key, _params) => key) {
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

async function updateC3ImportEntity(targetKey, entityId, body, translate = (key, _params) => key) {
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

module.exports = {
    legacyRequirementFromGeneric,
    serviceMatchesSearch,
    buildLegacyFmnAirC2PayloadFromCoverage,
    loadLegacyFmnAirC2Coverage,
    resolveParentUuidByCode,
    syncTaxonomyParentUuids,
    getC3TaxonomyRowByUuid,
    getActiveSpiralCode,
    normalizeC3TaxonomyTargetKey,
    deriveC3ItemType,
    getImportTargetMeta,
    getC3EntityDetailByCode,
    normalizeC3TaxonomyItem,
    runC3TaxonomyImport,
    getMappingsForCatalogId,
    getCapabilityCompletenessMap,
    assertServiceMappingsAllowedForState,
    updateC3ImportEntity,
};
