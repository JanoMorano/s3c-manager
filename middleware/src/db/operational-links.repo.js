'use strict';

const { getPool } = require('./pool');

async function listByService(catalogId) {
    const result = await getPool().query(`
        SELECT
            id,
            service_id,
            offering_id,
            link_type,
            title,
            url,
            sort_order,
            created_at,
            updated_at
        FROM data.service_operational_link
        WHERE service_id = $1
        ORDER BY sort_order NULLS LAST, title, id
    `, [catalogId]);
    return result.rows;
}

async function findById(linkId, catalogId) {
    const result = await getPool().query(`
        SELECT
            id,
            service_id,
            offering_id,
            link_type,
            title,
            url,
            sort_order,
            created_at,
            updated_at
        FROM data.service_operational_link
        WHERE id = $1
          AND service_id = $2
    `, [linkId, catalogId]);
    return result.rows[0] || null;
}

async function create(catalogId, data) {
    const result = await getPool().query(`
        INSERT INTO data.service_operational_link (
            service_id,
            offering_id,
            link_type,
            title,
            url,
            sort_order
        ) VALUES (
            $1, $2, $3, $4, $5, $6
        )
        RETURNING id
    `, [
        catalogId,
        data.offering_id ?? null,
        data.link_type ?? null,
        data.title,
        data.url,
        data.sort_order ?? null,
    ]);
    return findById(result.rows[0].id, catalogId);
}

async function update(linkId, catalogId, data) {
    const values = [linkId, catalogId];
    const setClauses = ['updated_at = CURRENT_TIMESTAMP'];
    const fieldMap = {
        offering_id: 'offering_id',
        link_type: 'link_type',
        title: 'title',
        url: 'url',
        sort_order: 'sort_order',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        let value = data[key];
        if (value === '') value = null;
        values.push(value ?? null);
        setClauses.push(`${column} = $${values.length}`);
    }

    if (setClauses.length === 1) {
        return findById(linkId, catalogId);
    }

    await getPool().query(`
        UPDATE data.service_operational_link
        SET ${setClauses.join(', ')}
        WHERE id = $1
          AND service_id = $2
    `, values);

    return findById(linkId, catalogId);
}

async function remove(linkId, catalogId) {
    const result = await getPool().query(`
        DELETE FROM data.service_operational_link
        WHERE id = $1
          AND service_id = $2
        RETURNING id
    `, [linkId, catalogId]);
    return result.rows.length > 0;
}

module.exports = {
    listByService,
    findById,
    create,
    update,
    remove,
};
