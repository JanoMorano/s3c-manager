'use strict';

/** C3 taxonomy CRUD, sync and imports (admin only). */

const crypto = require('node:crypto');
const express = require('express');
const { getPool } = require('../../db/pool');
const { canAdmin, canEdit } = require('../../middleware/rbac');
const { recordMembershipBatch } = require('../../db/spiral-membership.repo');
const { parseTextFilter, parseIntFilter } = require('../../utils/query-filters');
const {
    C3_ENTITY_IMPORT_TARGETS,
    parseDelimitedRecords,
    validateC3EntityRows,
    importC3EntityRows,
    createC3EntityImportRun,
    logC3EntityImportIssues,
    syncAllTechnologyInteractionLinks,
} = require('../../utils/c3-entity-import');
const { parseSimpleXlsxBuffer } = require('../../utils/simple-xlsx');
const { parseArchimateXml, isArchimateParserError } = require('../../parsers/archimate');
const {
    syncCapabilityDerivedLinksForAll,
    syncCapabilityDerivedLinksForCapability,
} = require('../../utils/c3-capability-links');
const { tReq } = require('../../utils/i18n');
const {
    C3_TAXONOMY_IMPORT_TARGETS,
    CAPABILITY_BUILDER_IMPORT_TARGET,
    invalidateC3CacheKeys,
    isUniqueViolation,
    selectRows,
    selectOne,
    normalizeOptionalInt,
    isXlsxParserError,
    isTruthyQuery,
} = require('./shared');
const {
    resolveParentUuidByCode,
    syncTaxonomyParentUuids,
    getC3TaxonomyRowByUuid,
    getActiveSpiralCode,
    normalizeC3TaxonomyTargetKey,
    getImportTargetMeta,
    runC3TaxonomyImport,
    updateC3ImportEntity,
} = require('./c3-taxonomy.service');
const {
    validateCapabilityBuilderImportRows,
    importCapabilityBuilderRows,
} = require('./capability-map.service');

const router = express.Router();

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

module.exports = router;
