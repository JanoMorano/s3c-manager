'use strict';

const { getPool } = require('./pool');

async function listByService(catalogId) {
    const result = await getPool().query(`
        SELECT
            id,
            service_id,
            offering_id,
            audience_type,
            business_unit,
            region_code,
            eligibility_rule,
            notes,
            created_at,
            updated_at
        FROM data.service_audience_policy
        WHERE service_id = $1
        ORDER BY offering_id NULLS FIRST, audience_type NULLS LAST, id
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
            DELETE FROM data.service_audience_policy
            WHERE service_id = $1
        `, [catalogId]);

        const inserted = [];
        for (const item of items) {
            const result = await client.query(`
                INSERT INTO data.service_audience_policy (
                    service_id,
                    offering_id,
                    audience_type,
                    business_unit,
                    region_code,
                    eligibility_rule,
                    notes
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7
                )
                RETURNING
                    id,
                    service_id,
                    offering_id,
                    audience_type,
                    business_unit,
                    region_code,
                    eligibility_rule,
                    notes,
                    created_at,
                    updated_at
            `, [
                catalogId,
                item.offering_id ?? null,
                item.audience_type ?? null,
                item.business_unit ?? null,
                item.region_code ?? null,
                item.eligibility_rule ?? null,
                item.notes ?? null,
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
