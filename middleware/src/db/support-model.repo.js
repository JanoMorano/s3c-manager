'use strict';

const { getPool } = require('./pool');

async function listByService(catalogId) {
    const result = await getPool().query(`
        SELECT
            id,
            service_id,
            offering_id,
            support_owner_name,
            resolver_group,
            support_hours_code,
            support_channel,
            escalation_path,
            maintenance_window,
            review_cadence,
            created_at,
            updated_at
        FROM data.service_support_model
        WHERE service_id = $1
        ORDER BY offering_id NULLS FIRST, id
    `, [catalogId]);
    return result.rows;
}

async function replaceForService(catalogId, items) {
    const pool = getPool();
    const rawPool = pool.raw ?? pool;
    const client = await rawPool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            DELETE FROM data.service_support_model
            WHERE service_id = $1
        `, [catalogId]);

        const inserted = [];
        for (const item of items) {
            const result = await client.query(`
                INSERT INTO data.service_support_model (
                    service_id,
                    offering_id,
                    support_owner_name,
                    resolver_group,
                    support_hours_code,
                    support_channel,
                    escalation_path,
                    maintenance_window,
                    review_cadence
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9
                )
                RETURNING
                    id,
                    service_id,
                    offering_id,
                    support_owner_name,
                    resolver_group,
                    support_hours_code,
                    support_channel,
                    escalation_path,
                    maintenance_window,
                    review_cadence,
                    created_at,
                    updated_at
            `, [
                catalogId,
                item.offering_id ?? null,
                item.support_owner_name ?? null,
                item.resolver_group ?? null,
                item.support_hours_code ?? null,
                item.support_channel ?? null,
                item.escalation_path ?? null,
                item.maintenance_window ?? null,
                item.review_cadence ?? null,
            ]);
            inserted.push(result.rows[0]);
        }

        await client.query('COMMIT');
        return inserted;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    listByService,
    replaceForService,
};
