'use strict';

/** Capability map and capability builder helpers (titles, spiral payloads, builder validation and import). */

const { getPool, getPlatformPool } = require('../../db/pool');
const { createC3EntityImportRun, logC3EntityImportIssues } = require('../../utils/c3-entity-import');
const { ensureCapabilityBuilderSeeded } = require('../../utils/c3-capability-builder-seed');
const config = require('../../config');
const {
    cache,
    CAPABILITY_MAP_TITLE_KEY,
    CAPABILITY_MAP_TITLE_KEY_SPIRAL6,
    DEFAULT_CAPABILITY_MAP_TITLE,
    DEFAULT_CAPABILITY_MAP_TITLE_SPIRAL6,
    DEFAULT_CAPABILITY_MAP_SPIRAL,
    CAPABILITY_BUILDER_IMPORT_TARGET,
    invalidateC3CacheKeys,
    createHttpError,
    selectRows,
    selectOne,
    normalizeOptionalInt,
    normalizeLookupKey,
} = require('./shared');

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

function normalizeCapabilityMapTitle(value, translate = (key, _params) => key) {
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

async function validateCapabilityBuilderPayload(payload, currentId = null, tableName = 'data.c3_capability_builder', maxLevel = 20, translate = (key, _params) => key) {
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

async function importCapabilityBuilderRows(rawRows, { sourceName = null, sourceKind = 'json', spiralCode = null, createdBy = null, translate = (key, _params) => key } = {}) {
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

module.exports = {
    listCapabilityBuilderDomains,
    normalizeCapabilityMapTitle,
    normalizeSpiralCode,
    getSpiralNumber,
    resolveCapabilityMapTitleKey,
    resolveCapabilityMapTitleDefault,
    getCapabilityMapTitle,
    upsertCapabilityMapTitle,
    buildCapabilityMapPayload,
    buildCapabilityMapPayloadBySpiral,
    validateCapabilityBuilderPayload,
    getCapabilityBuilderImportValue,
    normalizeCapabilityBuilderImportRow,
    buildCapabilityBuilderImportIssues,
    validateCapabilityBuilderImportRows,
    importCapabilityBuilderRows,
};
