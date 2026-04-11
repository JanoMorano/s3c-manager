'use strict';

const { getPlatformPool, getPool } = require('./pool');

async function log({ tableName, recordId, recordLabel, action, oldValues, newValues, changedFields, performedBy, clientIp, userAgent }) {
    const recIdInt = (typeof recordId === 'number' && Number.isInteger(recordId)) ? recordId : 0;
    await getPlatformPool().query(`
        INSERT INTO platform.audit_log
            (table_name, record_id, record_label, action, old_values, new_values, changed_fields, performed_by, client_ip, user_agent)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
        tableName,
        recIdInt,
        recordLabel || (recordId != null ? String(recordId) : null),
        action,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        changedFields ? JSON.stringify(changedFields) : null,
        performedBy || 'system',
        clientIp || null,
        userAgent || null,
    ]);
}

async function findByRecord(tableName, recordId, limit = 50) {
    const recIdInt = (typeof recordId === 'number' && Number.isInteger(recordId)) ? recordId : null;
    const labelStr = (typeof recordId === 'string') ? recordId : null;
    const result = await getPlatformPool().query(`
        SELECT id, action, changed_fields, performed_by, performed_at, client_ip
        FROM platform.audit_log
        WHERE table_name = $1
          AND ($2::integer IS NULL OR record_id = $2)
          AND ($3::varchar IS NULL OR record_label = $3 OR record_label ILIKE '%' || $3 || '%')
        ORDER BY performed_at DESC
        LIMIT $4
    `, [tableName, recIdInt, labelStr, limit]);
    return result.rows;
}

async function addChangelog(serviceId, changeType, summary, detail, performedBy) {
    const ACTION_MAP = {
        CREATE: 'INSERT',
        IMPORT: 'JSON_IMPORT',
        RESTORE: 'RESTORE',
    };
    const rawAction = changeType ? changeType.toUpperCase() : 'UPDATE';
    const actionType = ACTION_MAP[rawAction] || rawAction;
    const payload = detail ? JSON.stringify({ summary, detail }) : (summary || null);

    await getPlatformPool().query(`
        INSERT INTO platform.audit_log (table_name, record_id, record_label, action, performed_by, new_values)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [
        'ServiceCatalog',
        0,
        serviceId || null,
        actionType.substring(0, 20),
        performedBy || 'system',
        payload,
    ]);
}

async function logTaxonomyMappingChange({ servicePk, c3Uuid, mappingId = null, actionType, oldValues, newValues, changedBy }) {
    await getPool().query(`
        INSERT INTO data.taxonomy_mapping_audit
            (service_id, c3_uuid, mapping_id, action_type, changed_by, old_values_json, new_values_json)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7)
    `, [
        servicePk,
        c3Uuid ?? null,
        mappingId,
        actionType,
        changedBy || 'system',
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
    ]);
}

async function logGraphLayoutChange({ servicePk, nodeKind, oldX, oldY, newX, newY, changedBy }) {
    await getPool().query(`
        INSERT INTO data.graph_layout_audit
            (service_id, node_kind, old_x, old_y, new_x, new_y, changed_by)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7)
    `, [
        servicePk,
        nodeKind,
        oldX ?? null,
        oldY ?? null,
        newX ?? null,
        newY ?? null,
        changedBy || 'system',
    ]);
}

module.exports = { log, findByRecord, addChangelog, logTaxonomyMappingChange, logGraphLayoutChange };
