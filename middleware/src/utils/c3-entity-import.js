'use strict';

const { getPool } = require('../db/pool');

function resultRows(result) {
    if (!result) return [];
    return Array.isArray(result.rows) ? result.rows : [];
}

function toText(value, maxLength = null) {
    if (value == null) return null;
    const text = String(value).trim();
    if (!text) return null;
    return maxLength ? text.slice(0, maxLength) : text;
}

function toInt(value) {
    if (value == null || value === '') return null;
    const num = parseInt(String(value).trim(), 10);
    return Number.isFinite(num) ? num : null;
}

function toBit(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return null;
}

function toDate(value) {
    if (value == null || value === '') return null;
    const date = new Date(String(value).trim());
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLookupKey(key) {
    return String(key)
        .trim()
        .toLowerCase()
        .replace(/["']/g, '')
        .replace(/[\s/_-]+/g, ' ');
}

function detectDelimiter(text) {
    const sample = String(text ?? '').split(/\r?\n/, 1)[0] ?? '';
    let commas = 0;
    let semicolons = 0;
    let inQuotes = false;

    for (let i = 0; i < sample.length; i += 1) {
        const ch = sample[i];
        if (ch === '"') {
            if (inQuotes && sample[i + 1] === '"') {
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (inQuotes) continue;
        if (ch === ',') commas += 1;
        if (ch === ';') semicolons += 1;
    }

    return semicolons > commas ? ';' : ',';
}

function uniquifyHeaders(headers) {
    const counts = new Map();
    return headers.map((header) => {
        const clean = String(header ?? '').trim();
        const count = (counts.get(clean) ?? 0) + 1;
        counts.set(clean, count);
        return count === 1 ? clean : `${clean}__${count}`;
    });
}

function parseDelimitedRecords(text) {
    const input = String(text ?? '').replace(/^\uFEFF/, '');
    const delimiter = detectDelimiter(input);
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];
        if (ch === '"') {
            if (inQuotes && input[i + 1] === '"') {
                cell += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (!inQuotes && ch === delimiter) {
            row.push(cell);
            cell = '';
            continue;
        }

        if (!inQuotes && (ch === '\n' || ch === '\r')) {
            if (ch === '\r' && input[i + 1] === '\n') i += 1;
            row.push(cell);
            cell = '';
            if (row.some((value) => String(value).trim() !== '')) rows.push(row);
            row = [];
            continue;
        }

        cell += ch;
    }

    if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        if (row.some((value) => String(value).trim() !== '')) rows.push(row);
    }

    if (rows.length === 0) return [];
    const headers = uniquifyHeaders(rows[0]);
    return rows.slice(1).map((values) => {
        const record = {};
        headers.forEach((header, index) => {
            record[header] = values[index] ?? null;
        });
        return record;
    });
}

const C3_ENTITY_IMPORT_TARGETS = {
    'c3-application': {
        label: 'C3 Application',
        table: 'data.c3_application',
        listView: 'data.v_c3applicationlist',
        adminPath: '/c3/applications',
        fields: [
            { key: 'application_code', source: ['Application', 'application_code'], normalize: (value) => toText(value, 100), required: true },
            { key: 'uuid', source: ['UUID', 'uuid'], normalize: (value) => toText(value, 100), required: true },
            { key: 'modification_date', source: ['Modification date', 'modification_date'], normalize: toDate },
            { key: 'order_num', source: ['Order', 'order_num'], normalize: toInt },
            { key: 'ss_overall_status', source: ['SS overall status', 'ss_overall_status'], normalize: (value) => toText(value, 100) },
            { key: 'ss_baseline_status', source: ['SS baseline status', 'ss_baseline_status'], normalize: (value) => toText(value, 100) },
            { key: 'item_status', source: ['Item status', 'item_status'], normalize: (value) => toText(value, 50) },
            { key: 'data_source', source: ['Data source', 'data_source'], normalize: (value) => toText(value, 200) },
            { key: 'external_id', source: ['External id', 'external_id'], normalize: (value) => toText(value, 200) },
            { key: 'data_qualifier', source: ['Data qualifier', 'data_qualifier'], normalize: (value) => toText(value, 500) },
            { key: 'title', source: ['Title', 'title'], normalize: (value) => toText(value, 500), required: true },
            { key: 'source_description', source: ['Source description', 'source_description'], normalize: toText },
            { key: 'revised_description', source: ['Revised description', 'revised_description'], normalize: toText },
            { key: 'description', source: ['Description', 'description'], normalize: toText },
            { key: 'revised', source: ['Revised', 'revised'], normalize: toBit },
        ],
    },
    'c3-data-objects': {
        label: 'C3 Data Objects',
        table: 'data.c3_data_object',
        listView: 'data.v_c3dataobjectlist',
        adminPath: '/c3/data-objects',
        fields: [
            { key: 'data_object_code', source: ['Data Object', 'data_object_code'], normalize: (value) => toText(value, 100), required: true },
            { key: 'uuid', source: ['UUID', 'uuid'], normalize: (value) => toText(value, 100), required: true },
            { key: 'modification_date', source: ['Modification date', 'modification_date'], normalize: toDate },
            { key: 'order_num', source: ['Order', 'order_num'], normalize: toInt },
            { key: 'ss_overall_status', source: ['SS overall status', 'ss_overall_status'], normalize: (value) => toText(value, 100) },
            { key: 'ss_baseline_status', source: ['SS baseline status', 'ss_baseline_status'], normalize: (value) => toText(value, 100) },
            { key: 'item_status', source: ['Item status', 'item_status'], normalize: (value) => toText(value, 50) },
            { key: 'title', source: ['Title', 'title'], normalize: (value) => toText(value, 500), required: true },
            { key: 'description', source: ['Description', 'description'], normalize: toText },
            { key: 'provenance_raw', source: ['Provenance', 'provenance_raw'], normalize: toText },
            { key: 'references_raw', source: ['References', 'references_raw'], normalize: toText },
            { key: 'standards_raw', source: ['Standards', 'standards_raw'], normalize: toText },
        ],
    },
    'c3-services': {
        label: 'C3 Services',
        table: 'data.c3_service',
        listView: 'data.v_c3servicelist',
        adminPath: '/c3/services',
        fields: [
            { key: 'service_code', source: ['Service', 'service_code'], normalize: (value) => toText(value, 100), required: true },
            { key: 'uuid', source: ['UUID', 'uuid'], normalize: (value) => toText(value, 100), required: true },
            { key: 'modification_date', source: ['Modification date', 'modification_date'], normalize: toDate },
            { key: 'order_num', source: ['Order', 'order_num'], normalize: toInt },
            { key: 'ss_overall_status', source: ['SS overall status', 'ss_overall_status'], normalize: (value) => toText(value, 100) },
            { key: 'ss_baseline_status', source: ['SS baseline status', 'ss_baseline_status'], normalize: (value) => toText(value, 100) },
            { key: 'item_status', source: ['Item status', 'item_status'], normalize: (value) => toText(value, 50) },
            { key: 'data_source', source: ['Data source', 'data_source'], normalize: (value) => toText(value, 200) },
            { key: 'external_id', source: ['External id', 'external_id'], normalize: (value) => toText(value, 200) },
            { key: 'data_qualifier', source: ['Data qualifier', 'data_qualifier'], normalize: (value) => toText(value, 500) },
            { key: 'title', source: ['Title', 'title'], normalize: (value) => toText(value, 500), required: true },
            { key: 'source_description', source: ['Source description', 'source_description'], normalize: toText },
            { key: 'revised_description', source: ['Revised description', 'revised_description'], normalize: toText },
            { key: 'description', source: ['Description', 'description'], normalize: toText },
            { key: 'revised', source: ['Revised', 'revised'], normalize: toBit },
        ],
    },
    'c3-technology-interactions': {
        label: 'C3 Technology Interactions',
        table: 'data.c3_technology_interaction',
        listView: 'data.v_c3technologyinteractionlist',
        adminPath: '/c3/technology-interactions',
        linkReportView: 'data.v_c3technologyinteractionlinkreport',
        fields: [
            { key: 'technology_interaction_code', source: ['Technology Interaction', 'technology_interaction_code'], normalize: (value) => toText(value, 100), required: true },
            { key: 'uuid', source: ['UUID', 'uuid'], normalize: (value) => toText(value, 100), required: true },
            { key: 'modification_date', source: ['Modification date', 'modification_date'], normalize: toDate },
            { key: 'order_num', source: ['Order', 'order_num'], normalize: toInt },
            { key: 'ss_overall_status', source: ['SS overall status', 'ss_overall_status'], normalize: (value) => toText(value, 100) },
            { key: 'ss_baseline_status', source: ['SS baseline status', 'ss_baseline_status'], normalize: (value) => toText(value, 100) },
            { key: 'item_status', source: ['Item status', 'item_status'], normalize: (value) => toText(value, 50) },
            { key: 'ciav_review_status', source: ['CIAV review status', 'ciav_review_status'], normalize: (value) => toText(value, 100) },
            { key: 'mcsma_review_status', source: ['MCSMA review status', 'mcsma_review_status'], normalize: (value) => toText(value, 100) },
            { key: 'service_instructions', source: ['Service Instructions', 'service_instructions'], normalize: toText },
            { key: 'title', source: ['Title', 'title'], normalize: (value) => toText(value, 500), required: true },
            { key: 'technology_interaction_type', source: ['Technology interaction type', 'technology_interaction_type'], normalize: (value) => toText(value, 200) },
            { key: 'technology_interaction_maturity', source: ['Technology interaction maturity', 'technology_interaction_maturity'], normalize: (value) => toText(value, 200) },
            { key: 'technology_interactions_1_raw', source: ['Technology Interactions', 'technology_interactions_1_raw'], normalize: toText },
            { key: 'description', source: ['Description', 'description'], normalize: toText },
            { key: 'conditionality', source: ['Conditionality', 'conditionality'], normalize: toText },
            { key: 'services_1_raw', source: ['Services', 'services_1_raw'], normalize: toText },
            { key: 'applications_1_raw', source: ['Applications', 'applications_1_raw'], normalize: toText },
            { key: 'services_2_raw', source: ['Services__2', 'services_2_raw'], normalize: toText },
            { key: 'technology_interactions_2_raw', source: ['Technology Interactions__2', 'technology_interactions_2_raw'], normalize: toText },
            { key: 'technology_interactions_3_raw', source: ['Technology Interactions__3', 'technology_interactions_3_raw'], normalize: toText },
            { key: 'services_3_raw', source: ['Services__3', 'services_3_raw'], normalize: toText },
            { key: 'applications_2_raw', source: ['Applications__2', 'applications_2_raw'], normalize: toText },
            { key: 'data_objects_raw', source: ['Data Objects', 'data_objects_raw'], normalize: toText },
        ],
    },
};

function getValue(row, candidates) {
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

function buildEntityRecord(targetKey, row) {
    const config = C3_ENTITY_IMPORT_TARGETS[targetKey];
    if (!config) throw new Error(`Unknown C3 entity import target: ${targetKey}`);

    const record = {};
    const issues = [];
    for (const field of config.fields) {
        const rawValue = getValue(row, field.source);
        const normalized = field.normalize(rawValue);
        if (field.key === 'modification_date' && rawValue != null && String(rawValue).trim() !== '' && normalized == null) {
            issues.push({
                severity: 'warn',
                issue_code: 'INVALID_MODIFICATION_DATE',
                field_name: field.key,
                raw_value: String(rawValue),
                message: 'Pole modification_date není platné datum, bude uloženo jako NULL.',
            });
        }
        record[field.key] = normalized;
    }
    record.raw_json = JSON.stringify(row);

    if (!record.uuid) {
        issues.push({
            severity: 'error',
            issue_code: 'MISSING_UUID',
            field_name: 'uuid',
            raw_value: null,
            message: 'Chybí UUID.',
        });
    }
    if (!record.title) {
        issues.push({
            severity: 'error',
            issue_code: 'MISSING_TITLE',
            field_name: 'title',
            raw_value: null,
            message: 'Chybí Title.',
        });
    }

    const missingRequired = issues.some((issue) => issue.severity === 'error');
    if (missingRequired) return { record: null, issues };

    return { record, issues };
}

function buildUpsertQueries(config, { withSpiralCode = false } = {}) {
    const updatableFields = config.fields.filter((field) => field.key !== 'uuid');

    // UPDATE: updatable fields + raw_json + (optional) fmn_spiral, WHERE uuid
    const updateBaseColumns = updatableFields.map((field) => field.key).concat(['raw_json']);
    const updateColumns = withSpiralCode ? updateBaseColumns.concat(['fmn_spiral']) : updateBaseColumns;

    const updateSql = `UPDATE ${config.table}
                          SET ${updateColumns.map((column, index) => `${column} = $${index + 1}`).join(',\n                              ')},
                              synced_at = CURRENT_TIMESTAMP,
                              updated_at = CURRENT_TIMESTAMP
                        WHERE uuid = $${updateColumns.length + 1}
                    RETURNING id`;

    // INSERT: all fields + raw_json + (optional) fmn_spiral + synced_at + updated_at
    const insertColumns = config.fields.map((field) => field.key).concat(['raw_json']);
    if (withSpiralCode) insertColumns.push('fmn_spiral');
    insertColumns.push('synced_at', 'updated_at');

    const insertValueCount = config.fields.length + 1 + (withSpiralCode ? 1 : 0); // fields + raw_json + [fmn_spiral]
    const insertPlaceholders = Array.from({ length: insertValueCount }, (_, i) => `$${i + 1}`)
        .concat(['CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP']);

    const insertSql = `INSERT INTO ${config.table}
                           (${insertColumns.join(', ')})
                       VALUES
                           (${insertPlaceholders.join(', ')})
                    RETURNING id`;

    return {
        updateSql,
        insertSql,
    };
}

function splitReferenceValues(...values) {
    const seen = new Set();
    const refs = [];
    values.forEach((value) => {
        if (value == null) return;
        String(value)
            .replace(/\r/g, '\n')
            .split(/[\n;,]+/)
            .map((item) => item.trim())
            .filter(Boolean)
            .forEach((item) => {
                const key = item.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                refs.push(item);
            });
    });
    return refs;
}

async function resolveLinkedId(table, codeColumn, refValue) {
    const result = await getPool().query(`
        SELECT id
        FROM ${table}
        WHERE ${codeColumn} = $1 OR uuid = $1
        LIMIT 1
    `, [refValue]);
    return resultRows(result)[0]?.id ?? null;
}

async function syncTechnologyInteractionLinks(technologyInteractionId, record) {
    const issues = [];
    if (!technologyInteractionId) return issues;

    await getPool().query(`
        DELETE FROM data.c3_technology_interaction_service_link WHERE technology_interaction_id = $1;
        DELETE FROM data.c3_technology_interaction_application_link WHERE technology_interaction_id = $1;
        DELETE FROM data.c3_technology_interaction_data_object_link WHERE technology_interaction_id = $1;
    `, [technologyInteractionId]);

    const syncRefs = async ({ refs, table, codeColumn, linkTable, linkIdColumn, sourceSlot, issueCode, fieldName, unresolvedMessage }) => {
        for (const refValue of refs) {
            const linkedId = await resolveLinkedId(table, codeColumn, refValue);
            if (!linkedId) {
                issues.push({
                    severity: 'warn',
                    issue_code: issueCode,
                    field_name: fieldName,
                    raw_value: refValue,
                    message: unresolvedMessage,
                });
                continue;
            }
            await getPool().query(`
                INSERT INTO ${linkTable}
                    (technology_interaction_id, ${linkIdColumn}, source_slot, ref_value)
                VALUES
                    ($1, $2, $3, $4)
            `, [technologyInteractionId, linkedId, sourceSlot, refValue]);
        }
    };

    await syncRefs({
        refs: splitReferenceValues(record.services_1_raw, record.services_2_raw, record.services_3_raw),
        table: 'data.c3_service',
        codeColumn: 'service_code',
        linkTable: 'data.c3_technology_interaction_service_link',
        linkIdColumn: 'c3_service_id',
        sourceSlot: 'services',
        issueCode: 'UNRESOLVED_SERVICE_REF',
        fieldName: 'services_raw',
        unresolvedMessage: 'Reference na C3 Service nebyla nalezena.',
    });

    await syncRefs({
        refs: splitReferenceValues(record.applications_1_raw, record.applications_2_raw),
        table: 'data.c3_application',
        codeColumn: 'application_code',
        linkTable: 'data.c3_technology_interaction_application_link',
        linkIdColumn: 'c3_application_id',
        sourceSlot: 'applications',
        issueCode: 'UNRESOLVED_APPLICATION_REF',
        fieldName: 'applications_raw',
        unresolvedMessage: 'Reference na C3 Application nebyla nalezena.',
    });

    await syncRefs({
        refs: splitReferenceValues(record.data_objects_raw),
        table: 'data.c3_data_object',
        codeColumn: 'data_object_code',
        linkTable: 'data.c3_technology_interaction_data_object_link',
        linkIdColumn: 'c3_data_object_id',
        sourceSlot: 'data_objects',
        issueCode: 'UNRESOLVED_DATA_OBJECT_REF',
        fieldName: 'data_objects_raw',
        unresolvedMessage: 'Reference na C3 Data Object nebyla nalezena.',
    });

    return issues;
}

async function syncAllTechnologyInteractionLinks() {
    const result = await getPool().query(`
        SELECT *
        FROM data.c3_technology_interaction
    `);
    const rows = resultRows(result);

    let warnCount = 0;
    for (const row of rows) {
        const issues = await syncTechnologyInteractionLinks(row.id, row);
        warnCount += issues.length;
    }

    return {
        rows: rows.length,
        warnings: warnCount,
    };
}

async function importC3EntityRows(targetKey, rawRows, { spiralCode = null } = {}) {
    const config = C3_ENTITY_IMPORT_TARGETS[targetKey];
    if (!config) throw new Error(`Unknown C3 entity import target: ${targetKey}`);
    const withSpiralCode = spiralCode != null;
    const { updateSql, insertSql } = buildUpsertQueries(config, { withSpiralCode });

    let okCount = 0;
    let warnCount = 0;
    let errorCount = 0;
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const issues = [];

    for (const [index, rawRow] of rawRows.entries()) {
        const rowNumber = index + 2;
        try {
            const normalized = buildEntityRecord(targetKey, rawRow);
            normalized.issues.forEach((issue) => {
                issues.push({ row_number: rowNumber, ...issue });
                if (issue.severity === 'warn') warnCount += 1;
                if (issue.severity === 'error') errorCount += 1;
            });

            const record = normalized.record;
            if (!record) {
                failed += 1;
                continue;
            }

            const existing = await getPool().query(`SELECT id FROM ${config.table} WHERE uuid = $1`, [record.uuid]);
            const existingRows = resultRows(existing);
            const fieldValues = config.fields.map((field) => record[field.key] ?? null);
            let entityId = existingRows[0]?.id ?? null;
            if (existingRows.length > 0) {
                // UPDATE: updatable fields + raw_json + [fmn_spiral] + WHERE uuid
                const updateValues = config.fields
                    .filter((field) => field.key !== 'uuid')
                    .map((field) => record[field.key] ?? null)
                    .concat([record.raw_json]);
                if (withSpiralCode) updateValues.push(spiralCode);
                updateValues.push(record.uuid);
                const updateResult = await getPool().query(updateSql, updateValues);
                entityId = resultRows(updateResult)[0]?.id ?? entityId;
                updated += 1;
            } else {
                // INSERT: fields + raw_json + [fmn_spiral]
                const insertValues = fieldValues.concat([record.raw_json]);
                if (withSpiralCode) insertValues.push(spiralCode);
                const insertResult = await getPool().query(insertSql, insertValues);
                entityId = resultRows(insertResult)[0]?.id ?? null;
                inserted += 1;
            }

            if (targetKey === 'c3-technology-interactions') {
                const linkIssues = await syncTechnologyInteractionLinks(entityId, record);
                linkIssues.forEach((issue) => {
                    issues.push({ row_number: rowNumber, ...issue });
                    warnCount += 1;
                });
            }
            okCount += 1;
        } catch (_error) {
            failed += 1;
            errorCount += 1;
            issues.push({
                row_number: rowNumber,
                severity: 'error',
                issue_code: 'UPSERT_FAILED',
                field_name: null,
                raw_value: null,
                message: _error instanceof Error ? _error.message : 'Upsert selhal',
            });
        }
    }

    return {
        target: targetKey,
        label: config.label,
        ok_count: okCount,
        warn_count: warnCount,
        error_count: errorCount,
        issue_count: issues.length,
        inserted,
        updated,
        failed,
        rowsParsed: rawRows.length,
        issues,
    };
}

function validateC3EntityRows(targetKey, rawRows) {
    const config = C3_ENTITY_IMPORT_TARGETS[targetKey];
    if (!config) throw new Error(`Unknown C3 entity import target: ${targetKey}`);

    const issues = [];
    let warnCount = 0;
    let errorCount = 0;
    let validRowCount = 0;

    for (const [index, rawRow] of rawRows.entries()) {
        const rowNumber = index + 2;
        const normalized = buildEntityRecord(targetKey, rawRow);
        if (normalized.record) validRowCount += 1;
        normalized.issues.forEach((issue) => {
            issues.push({ row_number: rowNumber, ...issue });
            if (issue.severity === 'warn') warnCount += 1;
            if (issue.severity === 'error') errorCount += 1;
        });
    }

    return {
        target: targetKey,
        label: config.label,
        rowsParsed: rawRows.length,
        valid_row_count: validRowCount,
        warn_count: warnCount,
        error_count: errorCount,
        issue_count: issues.length,
        issues,
    };
}

async function createC3EntityImportRun({
    targetKey,
    sourceName,
    sourceKind,
    isDryRun = false,
    spiralCode = null,
    rowCount,
    okCount,
    warnCount,
    errorCount,
    insertedCount,
    updatedCount,
    failedCount,
    createdBy,
    notes,
}) {
    const result = await getPool().query(`
        INSERT INTO data.c3_entity_import_run
            (target_key, source_name, source_kind, is_dry_run, spiral_code, row_count, ok_count, warn_count, error_count, inserted_count, updated_count, failed_count, created_by, notes)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
    `, [
        targetKey,
        sourceName ?? null,
        sourceKind,
        Boolean(isDryRun),
        spiralCode ?? null,
        rowCount ?? 0,
        okCount ?? 0,
        warnCount ?? 0,
        errorCount ?? 0,
        insertedCount ?? 0,
        updatedCount ?? 0,
        failedCount ?? 0,
        createdBy ?? null,
        notes ?? null,
    ]);

    return resultRows(result)[0]?.id ?? null;
}

async function logC3EntityImportIssues(runId, issues) {
    if (!runId || !Array.isArray(issues) || issues.length === 0) return;
    for (const issue of issues) {
        await getPool().query(`
            INSERT INTO data.c3_entity_import_issue
                (run_id, row_number, severity, issue_code, field_name, raw_value, message)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7)
        `, [
            runId,
            issue.row_number ?? null,
            issue.severity,
            issue.issue_code,
            issue.field_name ?? null,
            issue.raw_value ?? null,
            issue.message ?? null,
        ]);
    }
}

module.exports = {
    C3_ENTITY_IMPORT_TARGETS,
    parseDelimitedRecords,
    validateC3EntityRows,
    importC3EntityRows,
    createC3EntityImportRun,
    logC3EntityImportIssues,
    syncTechnologyInteractionLinks,
    syncAllTechnologyInteractionLinks,
};
