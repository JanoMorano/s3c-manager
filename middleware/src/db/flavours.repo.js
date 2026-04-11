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

function toDecimal(value) {
    if (value == null) return null;
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
}

async function findByService(serviceId) {
    const result = await getPool().query(`
        SELECT
            sf.id,
            sf.flavour_code,
            sc.service_id,
            sf.title,
            sf.service_unit,
            sf.price_value,
            sf.currency_code,
            sf.billing_period_code,
            sf.initiation_cost,
            sf.lifecycle_cost,
            sf.lifetime_years,
            sf.nations_rate,
            sf.dependency_text,
            sf.short_note,
            sf.flavour_status_code,
            sf.pricing_note_raw,
            sf.display_order,
            sf.is_orderable,
            sf.delivery_note,
            sf.technical_note,
            sf.created_at,
            sf.updated_at
        FROM data.service_flavour sf
        JOIN data.service_catalog sc ON sc.id = sf.service_id
        WHERE sf.service_id = (
            SELECT id
            FROM data.service_catalog
            WHERE service_id = $1
              AND is_deleted = FALSE
        )
          AND sf.is_deleted = FALSE
        ORDER BY COALESCE(sf.display_order, 9999), sf.flavour_code ASC
    `, [serviceId]);
    return result.rows;
}

async function findById(id) {
    const result = await getPool().query(`
        SELECT
            sf.id,
            sf.flavour_code,
            sc.service_id,
            sf.title,
            sf.service_unit,
            sf.price_value,
            sf.currency_code,
            sf.billing_period_code,
            sf.initiation_cost,
            sf.lifecycle_cost,
            sf.lifetime_years,
            sf.nations_rate,
            sf.dependency_text,
            sf.short_note,
            sf.flavour_status_code,
            sf.pricing_note_raw,
            sf.display_order,
            sf.is_orderable,
            sf.delivery_note,
            sf.technical_note,
            sf.created_at,
            sf.updated_at
        FROM data.service_flavour sf
        JOIN data.service_catalog sc ON sc.id = sf.service_id
        WHERE sf.id = $1
          AND sf.is_deleted = FALSE
    `, [id]);
    return result.rows[0] || null;
}

async function insertFlavour(flavourCode, catalogId, title, unit, rate, initCost, lcCost, ltYears, nationsRate, dependencyText, note, status, pricingNoteRaw = null, deliveryNote = null, technicalNote = null) {
    const result = await getPool().query(`
        INSERT INTO data.service_flavour
            (flavour_code, service_id, title, service_unit,
             price_value, initiation_cost, lifecycle_cost,
             lifetime_years, nations_rate, dependency_text, short_note,
             flavour_status_code, pricing_note_raw, delivery_note, technical_note)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
    `, [
        flavourCode,
        catalogId,
        title,
        unit,
        rate,
        initCost,
        lcCost,
        ltYears,
        nationsRate,
        dependencyText,
        note,
        status,
        pricingNoteRaw,
        deliveryNote,
        technicalNote,
    ]);
    return result.rows[0]?.id ?? null;
}

async function upsert(serviceId, data) {
    const flavourId = data.flavour_id || data.flavourId || null;
    const flavourCode = data.flavour_code || flavourId || null;
    const title = data.title || data.flavour_name || '';
    const unit = data.service_unit || data.serviceUnit || data.unit || null;
    const rateEur = toDecimal(data.price_value ?? data.service_rate_eur ?? data.serviceRateEUR ?? data.rate_eur);
    const initCost = toDecimal(data.initiation_cost ?? data.initiationCost);
    const lcCost = toDecimal(data.lifecycle_cost ?? data.lifecycleCost);
    const ltYears = (data.lifetime_years ?? data.lifetimeYears) != null
        ? parseInt(data.lifetime_years ?? data.lifetimeYears, 10) || null
        : null;
    const nationsRate = (data.nations_rate ?? data.nationsRate) != null
        ? String(data.nations_rate ?? data.nationsRate)
        : null;
    const dependencyText = data.dependency_text || data.dependencyText || null;
    const note = data.short_note || data.shortNote || data.description || data.note || null;
    const status = data.flavour_status_code || data.flavour_status || data.flavourStatus || 'available';
    const pricingNoteRaw = data.pricing_note_raw || data.pricingNoteRaw || null;
    const deliveryNote = data.delivery_note || data.deliveryNote || null;
    const technicalNote = data.technical_note || data.technicalNote || null;

    const catalogId = await getCatalogId(serviceId);

    if (!flavourCode) {
        const countResult = await getPool().query(`
            SELECT COUNT(*)::integer AS cnt
            FROM data.service_flavour
            WHERE service_id = $1
              AND is_deleted = FALSE
        `, [catalogId]);
        const seq = (countResult.rows[0]?.cnt || 0) + 1;
        const generatedId = `${serviceId}-F${String(seq).padStart(2, '0')}`;
        return insertFlavour(generatedId, catalogId, title, unit, rateEur, initCost, lcCost, ltYears, nationsRate, dependencyText, note, status, pricingNoteRaw, deliveryNote, technicalNote);
    }

    const existingResult = await getPool().query(`
        SELECT id
        FROM data.service_flavour
        WHERE service_id = $1
          AND flavour_code = $2
          AND is_deleted = FALSE
        ORDER BY id
        LIMIT 1
    `, [catalogId, flavourCode]);

    const existingId = existingResult.rows[0]?.id ?? null;
    if (existingId) {
        return update(existingId, {
            title,
            service_unit: unit,
            price_value: rateEur,
            initiation_cost: initCost,
            lifecycle_cost: lcCost,
            lifetime_years: ltYears,
            nations_rate: nationsRate,
            dependency_text: dependencyText,
            short_note: note,
            flavour_status_code: status,
            pricing_note_raw: pricingNoteRaw,
            delivery_note: deliveryNote,
            technical_note: technicalNote,
        });
    }

    return insertFlavour(flavourCode, catalogId, title, unit, rateEur, initCost, lcCost, ltYears, nationsRate, dependencyText, note, status, pricingNoteRaw, deliveryNote, technicalNote);
}

async function create(serviceId, data) {
    return upsert(serviceId, data);
}

async function update(id, data) {
    const existing = await findById(id);
    if (!existing) return null;

    const fields = ['updated_at = CURRENT_TIMESTAMP'];
    const values = [];

    function push(field, value) {
        values.push(value);
        fields.push(`${field} = $${values.length}`);
    }

    if (data.title != null || data.flavour_name != null) push('title', data.title || data.flavour_name);
    if (data.service_unit != null || data.unit != null) push('service_unit', data.service_unit || data.unit || null);
    if ('price_value' in data || 'service_rate_eur' in data || 'rate_eur' in data) push('price_value', toDecimal(data.price_value ?? data.service_rate_eur ?? data.rate_eur));
    if ('initiation_cost' in data) push('initiation_cost', toDecimal(data.initiation_cost));
    if ('lifecycle_cost' in data) push('lifecycle_cost', toDecimal(data.lifecycle_cost));
    if ('lifetime_years' in data) push('lifetime_years', data.lifetime_years != null ? parseInt(data.lifetime_years, 10) || null : null);
    if ('nations_rate' in data) push('nations_rate', data.nations_rate != null ? String(data.nations_rate) : null);
    if ('dependency_text' in data) push('dependency_text', data.dependency_text || null);
    if ('short_note' in data || 'description' in data || 'note' in data) push('short_note', data.short_note ?? data.description ?? data.note ?? null);
    if ('flavour_status_code' in data || 'flavour_status' in data) push('flavour_status_code', data.flavour_status_code || data.flavour_status || 'available');
    if ('pricing_note_raw' in data) push('pricing_note_raw', data.pricing_note_raw || null);
    if ('delivery_note' in data) push('delivery_note', data.delivery_note || null);
    if ('technical_note' in data) push('technical_note', data.technical_note || null);

    if (fields.length === 1) return findById(id);

    values.push(id);
    await getPool().query(`
        UPDATE data.service_flavour
        SET ${fields.join(', ')}
        WHERE id = $${values.length}
    `, values);

    return findById(id);
}

async function remove(id) {
    await getPool().query(`
        UPDATE data.service_flavour
        SET is_deleted = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    `, [id]);
}

module.exports = { findByService, findById, create, upsert, update, remove };
