'use strict';

const { getPool } = require('./pool');

async function listByService(catalogId) {
    const result = await getPool().query(`
        SELECT
            id,
            service_id,
            offering_code,
            title,
            description,
            is_default,
            requestable,
            approval_required,
            request_channel_type,
            request_channel_url,
            lead_time_text,
            support_tier_code,
            status,
            display_order,
            created_at,
            updated_at
        FROM data.service_offering
        WHERE service_id = $1
        ORDER BY is_default DESC, display_order NULLS LAST, title
    `, [catalogId]);
    return result.rows;
}

async function findById(offeringId, catalogId) {
    const result = await getPool().query(`
        SELECT
            id,
            service_id,
            offering_code,
            title,
            description,
            is_default,
            requestable,
            approval_required,
            request_channel_type,
            request_channel_url,
            lead_time_text,
            support_tier_code,
            status,
            display_order,
            created_at,
            updated_at
        FROM data.service_offering
        WHERE id = $1
          AND service_id = $2
    `, [offeringId, catalogId]);
    return result.rows[0] || null;
}

async function create(catalogId, data) {
    const result = await getPool().query(`
        INSERT INTO data.service_offering (
            service_id,
            offering_code,
            title,
            description,
            is_default,
            requestable,
            approval_required,
            request_channel_type,
            request_channel_url,
            lead_time_text,
            support_tier_code,
            status,
            display_order
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
        RETURNING id
    `, [
        catalogId,
        data.offering_code,
        data.title,
        data.description ?? null,
        !!data.is_default,
        !!data.requestable,
        data.approval_required == null ? null : !!data.approval_required,
        data.request_channel_type ?? null,
        data.request_channel_url ?? null,
        data.lead_time_text ?? null,
        data.support_tier_code ?? null,
        data.status ?? 'draft',
        data.display_order ?? null,
    ]);
    return findById(result.rows[0].id, catalogId);
}

async function update(offeringId, catalogId, data) {
    const values = [offeringId, catalogId];
    const setClauses = ['updated_at = CURRENT_TIMESTAMP'];
    const fieldMap = {
        offering_code: 'offering_code',
        title: 'title',
        description: 'description',
        is_default: 'is_default',
        requestable: 'requestable',
        approval_required: 'approval_required',
        request_channel_type: 'request_channel_type',
        request_channel_url: 'request_channel_url',
        lead_time_text: 'lead_time_text',
        support_tier_code: 'support_tier_code',
        status: 'status',
        display_order: 'display_order',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        let value = data[key];
        if (['is_default', 'requestable', 'approval_required'].includes(key)) {
            value = value == null ? null : !!value;
        }
        if (value === '') value = null;
        values.push(value ?? null);
        setClauses.push(`${column} = $${values.length}`);
    }

    if (setClauses.length === 1) {
        return findById(offeringId, catalogId);
    }

    await getPool().query(`
        UPDATE data.service_offering
        SET ${setClauses.join(', ')}
        WHERE id = $1
          AND service_id = $2
    `, values);

    return findById(offeringId, catalogId);
}

async function remove(offeringId, catalogId) {
    const result = await getPool().query(`
        DELETE FROM data.service_offering
        WHERE id = $1
          AND service_id = $2
        RETURNING id
    `, [offeringId, catalogId]);
    return result.rows.length > 0;
}

module.exports = {
    listByService,
    findById,
    create,
    update,
    remove,
};
