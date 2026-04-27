'use strict';

const { getPool } = require('./pool');

async function recordMembership({
    entityKind,
    entityUuid,
    spiralCode,
    statusInSpiral = null,
    ssOverallStatus = null,
    ssBaselineStatus = null,
    itemStatus = null,
    sourceRunId = null,
}) {
    if (!entityKind || !entityUuid || !spiralCode) return null;

    const result = await getPool().query(`
        INSERT INTO data.c3_entity_spiral_membership (
            entity_kind, entity_uuid, spiral_code, status_in_spiral,
            ss_overall_status, ss_baseline_status, item_status, source_run_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (entity_kind, entity_uuid, spiral_code) DO UPDATE SET
            status_in_spiral = EXCLUDED.status_in_spiral,
            ss_overall_status = EXCLUDED.ss_overall_status,
            ss_baseline_status = EXCLUDED.ss_baseline_status,
            item_status = EXCLUDED.item_status,
            source_run_id = EXCLUDED.source_run_id,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `, [
        entityKind,
        entityUuid,
        spiralCode,
        statusInSpiral,
        ssOverallStatus,
        ssBaselineStatus,
        itemStatus,
        sourceRunId,
    ]);

    return result.rows[0] ?? null;
}

async function recordMembershipBatch(records, { sourceRunId = null } = {}) {
    if (!Array.isArray(records) || records.length === 0) return [];

    const saved = [];
    for (const record of records) {
        const row = await recordMembership({
            ...record,
            sourceRunId: record.sourceRunId ?? sourceRunId,
        });
        if (row) saved.push(row);
    }
    return saved;
}

async function listMembership(entityKind, entityUuid) {
    const result = await getPool().query(`
        SELECT *
        FROM data.c3_entity_spiral_membership
        WHERE entity_kind = $1
          AND entity_uuid = $2
        ORDER BY spiral_code
    `, [entityKind, entityUuid]);

    return result.rows;
}

module.exports = {
    recordMembership,
    recordMembershipBatch,
    listMembership,
};
