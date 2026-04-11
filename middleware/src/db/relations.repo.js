'use strict';

const { getPool } = require('./pool');

async function getCatalogId(serviceId) {
    const result = await getPool().query(`
        SELECT id
        FROM data.service_catalog
        WHERE service_id = $1
          AND is_deleted = FALSE
    `, [serviceId]);

    const id = result.rows[0]?.id ?? null;
    if (!id) {
        const err = new Error(`ServiceCatalog not found: ${serviceId}`);
        err.status = 404;
        throw err;
    }
    return id;
}

const REL_SELECT = `
    SELECT
        sr.id,
        sr.relation_type_code AS relation_type,
        sr.relation_label,
        sr.relation_note,
        sr.pace_code,
        sr.is_mandatory,
        sr.impact_mode,
        sr.impact_level,
        sr.source_field,
        sr.raw_text,
        sr.parse_confidence,
        sr.is_inferred,
        sr.is_verified,
        sr.is_deleted,
        sr.created_at,
        sr.created_by,
        f.service_id AS from_service_id,
        t.service_id AS to_service_id,
        f.title AS from_title,
        t.title AS to_title
    FROM data.service_relation sr
    JOIN data.service_catalog f ON f.id = sr.from_service_id AND f.is_deleted = FALSE
    JOIN data.service_catalog t ON t.id = sr.to_service_id AND t.is_deleted = FALSE
`;

async function findByService(serviceId) {
    const result = await getPool().query(`
        ${REL_SELECT}
        WHERE sr.is_deleted = FALSE
          AND (
            sr.from_service_id = (SELECT id FROM data.service_catalog WHERE service_id = $1 AND is_deleted = FALSE)
            OR sr.to_service_id = (SELECT id FROM data.service_catalog WHERE service_id = $1 AND is_deleted = FALSE)
          )
        ORDER BY sr.relation_type_code, f.title
    `, [serviceId]);
    return result.rows;
}

async function findAll({ serviceId, relationType } = {}) {
    const conditions = ['sr.is_deleted = FALSE'];
    const values = [];

    if (serviceId) {
        values.push(serviceId);
        const idx = values.length;
        conditions.push(`(
            sr.from_service_id = (SELECT id FROM data.service_catalog WHERE service_id = $${idx} AND is_deleted = FALSE)
            OR sr.to_service_id = (SELECT id FROM data.service_catalog WHERE service_id = $${idx} AND is_deleted = FALSE)
        )`);
    }

    if (relationType) {
        values.push(relationType);
        conditions.push(`sr.relation_type_code = $${values.length}`);
    }

    const result = await getPool().query(`
        ${REL_SELECT}
        WHERE ${conditions.join(' AND ')}
        ORDER BY f.title, sr.relation_type_code
    `, values);

    return result.rows;
}

async function findById(id) {
    const result = await getPool().query(`
        ${REL_SELECT}
        WHERE sr.id = $1
          AND sr.is_deleted = FALSE
    `, [id]);
    return result.rows[0] || null;
}

async function create(data, performedBy) {
    const [fromId, toId] = await Promise.all([
        getCatalogId(data.from_service_id),
        getCatalogId(data.to_service_id),
    ]);

    const result = await getPool().query(`
        INSERT INTO data.service_relation
            (from_service_id, to_service_id, relation_type_code, relation_label,
             pace_code, is_mandatory, impact_mode, impact_level, relation_note, created_by,
             source_field, raw_text, parse_confidence, is_inferred, is_verified)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
    `, [
        fromId,
        toId,
        data.relation_type || data.relation_type_code || 'depends_on',
        data.relation_label || null,
        data.pace_code || null,
        data.is_mandatory != null ? !!data.is_mandatory : true,
        data.impact_mode || 'hard_stop',
        data.impact_level || 'high',
        data.relation_note || null,
        performedBy,
        data.source_field || null,
        data.raw_text || null,
        data.parse_confidence ?? null,
        data.is_inferred ?? false,
        data.is_verified ?? false,
    ]);

    return result.rows[0].id;
}

async function update(id, data) {
    const fields = [];
    const values = [];

    function push(field, value) {
        values.push(value);
        fields.push(`${field} = $${values.length}`);
    }

    push('updated_at', new Date());
    push('relation_type_code', data.relation_type || data.relation_type_code || 'depends_on');
    push('relation_label', data.relation_label || null);
    push('pace_code', data.pace_code || null);
    push('is_mandatory', data.is_mandatory != null ? !!data.is_mandatory : true);
    push('impact_mode', data.impact_mode || 'hard_stop');
    push('impact_level', data.impact_level || 'high');
    push('relation_note', data.relation_note || null);

    if (data.is_verified !== undefined) {
        push('is_verified', data.is_verified);
    }

    values.push(id);
    await getPool().query(`
        UPDATE data.service_relation
        SET ${fields.join(', ')}
        WHERE id = $${values.length}
    `, values);

    return findById(id);
}

async function remove(id) {
    await getPool().query(`
        UPDATE data.service_relation
        SET is_deleted = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    `, [id]);
}

module.exports = { findByService, findAll, findById, create, update, remove };
