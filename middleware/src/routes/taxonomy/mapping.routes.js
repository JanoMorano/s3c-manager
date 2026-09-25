'use strict';

/** Service ↔ C3 taxonomy mappings. */

const express = require('express');
const { getPool } = require('../../db/pool');
const { canAdmin } = require('../../middleware/rbac');
const { logTaxonomyMappingChange } = require('../../db/audit.repo');
const { parseTextFilter } = require('../../utils/query-filters');
const { getServiceStateByCatalogId, isActiveServiceStatus } = require('../../services/readiness');
const { tReq } = require('../../utils/i18n');
const {
    resultRows,
    resultRowCount,
    selectRows,
    selectOne,
    normalizeOptionalInt,
    _getCatalogId,
} = require('./shared');
const { getMappingsForCatalogId, assertServiceMappingsAllowedForState } = require('./c3-taxonomy.service');

const router = express.Router();

// =============================================================================
// ServiceC3Mapping — CRUD for ServiceCatalog ↔ C3Taxonomy mapping.
// Schema v4: service_id je BIGINT FK (ServiceCatalog.id), M:N relace
// Columns: c3_parent_uuid (formerly c3_parent_id), synced_at (formerly c3_synced_at),
//          sync_status (formerly c3_sync_status), + mapping_type_code (NOT NULL FK)
// =============================================================================

// GET /api/v1/taxonomy/mapping/:serviceId — all C3 mappings for a service
router.get('/mapping/:serviceId', async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const catalogId = await _getCatalogId(serviceId);
        const rows = await selectRows(getPool(), `
            SELECT
                scm.id,
                sc.service_id,
                scm.c3_uuid,
                scm.c3_parent_uuid AS c3_parent_id,
                scm.c3_level,
                scm.c3_domain,
                scm.c3_source,
                scm.c3_reference,
                scm.mapping_type_code,
                scm.pace_code,
                scm.is_primary,
                scm.mapping_note,
                scm.synced_at AS c3_synced_at,
                scm.sync_status AS c3_sync_status
            FROM data.service_c3_mapping scm
            JOIN data.service_catalog sc ON sc.id = scm.service_id
            WHERE scm.service_id = $1
            ORDER BY scm.is_primary DESC, scm.created_at ASC
        `, [catalogId]);
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/v1/taxonomy/mapping — optional ?c3_uuid=... filter
router.get('/mapping', async (req, res, next) => {
    try {
        const { c3_uuid } = req.query;
        const safeC3Uuid = parseTextFilter(c3_uuid, { maxLength: 100 });
        const params = [];
        const where = safeC3Uuid ? `WHERE scm.c3_uuid = $${params.push(safeC3Uuid)}` : '';
        const rows = await selectRows(getPool(), `
            SELECT
                scm.id,
                sc.service_id,
                scm.c3_uuid,
                scm.c3_parent_uuid  AS c3_parent_id,
                scm.c3_level,
                scm.c3_domain, scm.c3_source, scm.c3_reference,
                scm.mapping_type_code,
                scm.pace_code,
                scm.is_primary,
                scm.mapping_note,
                scm.synced_at       AS c3_synced_at,
                scm.sync_status     AS c3_sync_status
            FROM data.service_c3_mapping scm
            JOIN data.service_catalog sc ON sc.id = scm.service_id AND sc.is_deleted = FALSE
            ${where}
            ORDER BY sc.service_id, scm.is_primary DESC
        `, params);
        res.json(rows);
    } catch (err) { next(err); }
});

// PUT /api/v1/taxonomy/mapping/:serviceId — upsert primary C3 mapping
// Upsert keyed on (service_id BIGINT, c3_uuid, mapping_type_code)
router.put('/mapping/:serviceId', canAdmin, async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const b = req.body || {};

        const catalogId = await _getCatalogId(serviceId);
        const c3Uuid    = b.c3_uuid || null;
        const mapType   = b.mapping_type_code || 'supports';
        const paceCode  = b.pace_code || null;

        if (!c3Uuid) return res.status(400).json({ error: tReq(req, 'taxonomy.errors.required_field', { field: 'c3_uuid' }) });

        const currentMappings = await getMappingsForCatalogId(catalogId);
        const existingMapping = currentMappings.find((mapping) =>
            mapping.c3_uuid === c3Uuid && mapping.mapping_type_code === mapType
        ) ?? null;

        const candidateMapping = {
            id: existingMapping?.id ?? null,
            c3_uuid: c3Uuid,
            mapping_type_code: mapType,
            is_primary: Boolean(b.is_primary),
        };
        const nextMappings = currentMappings
            .filter((mapping) => !existingMapping || mapping.id !== existingMapping.id)
            .map((mapping) => ({
                ...mapping,
                is_primary: b.is_primary ? false : mapping.is_primary,
            }));
        nextMappings.push(candidateMapping);

        await assertServiceMappingsAllowedForState(catalogId, nextMappings, (key, params) => tReq(req, key, params));

        const existing = await selectOne(getPool(), `
            SELECT *
            FROM data.service_c3_mapping
            WHERE service_id = $1
              AND c3_uuid = $2
              AND mapping_type_code = $3
              AND ((pace_code IS NULL AND $4::varchar IS NULL) OR pace_code = $4)
            ORDER BY id
            LIMIT 1
        `, [catalogId, c3Uuid, mapType, paceCode]);

        if (existing) {
            await getPool().query(`
                UPDATE data.service_c3_mapping
                SET
                    c3_parent_uuid = $5,
                    c3_level = $6,
                    c3_domain = $7,
                    c3_source = $8,
                    c3_reference = $9,
                    synced_at = CURRENT_TIMESTAMP,
                    sync_status = $10,
                    is_primary = $11,
                    mapping_note = $12
                WHERE service_id = $1
                  AND c3_uuid = $2
                  AND mapping_type_code = $3
                  AND ((pace_code IS NULL AND $4::varchar IS NULL) OR pace_code = $4)
            `, [
                catalogId,
                c3Uuid,
                mapType,
                paceCode,
                b.c3_parent_id ?? null,
                normalizeOptionalInt(b.c3_level),
                b.c3_domain ?? null,
                b.c3_source ?? null,
                b.c3_reference ?? null,
                b.c3_sync_status ?? 'manual',
                Boolean(b.is_primary),
                b.mapping_note ?? null,
            ]);
            await logTaxonomyMappingChange({
                servicePk: catalogId,
                c3Uuid,
                mappingId: existing.id ?? null,
                actionType: 'UPDATE',
                oldValues: existing ?? null,
                newValues: {
                    c3_parent_uuid: b.c3_parent_id ?? null,
                    c3_level: b.c3_level ?? null,
                    c3_domain: b.c3_domain ?? null,
                    c3_source: b.c3_source ?? null,
                    c3_reference: b.c3_reference ?? null,
                    sync_status: b.c3_sync_status ?? 'manual',
                    is_primary: Boolean(b.is_primary),
                    mapping_note: b.mapping_note ?? null,
                },
                changedBy: req.user?.username || 'system',
            });

            if (b.is_primary) {
                await getPool().query(`
                    UPDATE data.service_c3_mapping
                    SET is_primary = CASE WHEN id = $2 THEN TRUE ELSE FALSE END
                    WHERE service_id = $1
                `, [catalogId, existing.id ?? existingMapping?.id]);
            }
        } else {
            const insertResult = await getPool().query(`
                INSERT INTO data.service_c3_mapping (
                    service_id,
                    c3_uuid,
                    mapping_type_code,
                    pace_code,
                    c3_parent_uuid,
                    c3_level,
                    c3_domain,
                    c3_source,
                    c3_reference,
                    synced_at,
                    sync_status,
                    is_primary,
                    mapping_note
                )
                VALUES (
                    $1, $2, $3, $4,
                    $5, $6, $7, $8, $9,
                    CURRENT_TIMESTAMP, $10, $11, $12
                )
                RETURNING id
            `, [
                catalogId,
                c3Uuid,
                mapType,
                paceCode,
                b.c3_parent_id ?? null,
                normalizeOptionalInt(b.c3_level),
                b.c3_domain ?? null,
                b.c3_source ?? null,
                b.c3_reference ?? null,
                b.c3_sync_status ?? 'manual',
                Boolean(b.is_primary),
                b.mapping_note ?? null,
            ]);
            await logTaxonomyMappingChange({
                servicePk: catalogId,
                c3Uuid,
                actionType: 'INSERT',
                oldValues: null,
                newValues: {
                    mapping_type_code: mapType,
                    pace_code: paceCode,
                    c3_parent_uuid: b.c3_parent_id ?? null,
                    c3_level: b.c3_level ?? null,
                    c3_domain: b.c3_domain ?? null,
                    c3_source: b.c3_source ?? null,
                    c3_reference: b.c3_reference ?? null,
                    sync_status: b.c3_sync_status ?? 'manual',
                    is_primary: Boolean(b.is_primary),
                    mapping_note: b.mapping_note ?? null,
                },
                changedBy: req.user?.username || 'system',
            });

            if (b.is_primary) {
                const insertedId = resultRows(insertResult)[0]?.id ?? null;
                await getPool().query(`
                    UPDATE data.service_c3_mapping
                    SET is_primary = CASE WHEN id = $2 THEN TRUE ELSE FALSE END
                    WHERE service_id = $1
                `, [catalogId, insertedId]);
            }
        }

        const result = await selectOne(getPool(), `
            SELECT
                scm.id,
                sc.service_id,
                scm.c3_uuid,
                scm.c3_parent_uuid AS c3_parent_id,
                scm.c3_level,
                scm.c3_domain,
                scm.c3_source,
                scm.c3_reference,
                scm.mapping_type_code,
                scm.pace_code,
                scm.is_primary,
                scm.mapping_note,
                scm.synced_at AS c3_synced_at,
                scm.sync_status AS c3_sync_status
            FROM data.service_c3_mapping scm
            JOIN data.service_catalog sc ON sc.id = scm.service_id
            WHERE scm.service_id = $1
              AND scm.c3_uuid = $2
              AND scm.mapping_type_code = $3
              AND ((scm.pace_code IS NULL AND $4::varchar IS NULL) OR scm.pace_code = $4)
            ORDER BY scm.id DESC
            LIMIT 1
        `, [catalogId, c3Uuid, mapType, paceCode]);
        res.json(result || {});
    } catch (err) { next(err); }
});

// DELETE /api/v1/taxonomy/mapping/:serviceId/:mappingId — delete one C3 mapping by PK
router.delete('/mapping/:serviceId/:mappingId', canAdmin, async (req, res, next) => {
    try {
        const { serviceId, mappingId } = req.params;
        const catId = await _getCatalogId(serviceId);
        const mappingPk = parseInt(mappingId, 10);
        if (isNaN(mappingPk)) return res.status(400).json({ error: 'Neplatné mappingId' });
        const currentMappings = await getMappingsForCatalogId(catId);
        const nextMappings = currentMappings.filter((mapping) => Number(mapping.id) !== Number(mappingPk));
        await assertServiceMappingsAllowedForState(catId, nextMappings, (key, params) => tReq(req, key, params));
        const oldRow = await selectOne(getPool(), `
            SELECT *
            FROM data.service_c3_mapping
            WHERE id = $1 AND service_id = $2
            LIMIT 1
        `, [mappingPk, catId]);
        const result = await getPool().query(`
            DELETE FROM data.service_c3_mapping
            WHERE id = $1 AND service_id = $2
        `, [mappingPk, catId]);
        if (resultRowCount(result) === 0) return res.status(404).json({ error: 'Mapování nenalezeno' });
        await logTaxonomyMappingChange({
            servicePk: catId,
            c3Uuid: oldRow?.c3_uuid ?? null,
            mappingId: mappingPk,
            actionType: 'DELETE',
            oldValues: oldRow ?? null,
            newValues: null,
            changedBy: req.user?.username || 'system',
        });
        res.json({ message: tReq(req, 'taxonomy.messages.mapping_deleted'), id: mappingPk });
    } catch (err) { next(err); }
});

// DELETE /api/v1/taxonomy/mapping/:serviceId — delete all C3 mappings for a service
router.delete('/mapping/:serviceId', canAdmin, async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const catalogId = await _getCatalogId(serviceId);
        const serviceState = await getServiceStateByCatalogId(catalogId);
        if (serviceState && isActiveServiceStatus(serviceState.service_status)) {
            return res.status(409).json({ error: 'Aktivní službě nelze smazat všechna C3 mapování.' });
        }
        const oldRows = await selectRows(getPool(), `
            SELECT *
            FROM data.service_c3_mapping
            WHERE service_id = $1
        `, [catalogId]);
        await getPool().query(`
            DELETE FROM data.service_c3_mapping
            WHERE service_id = $1
        `, [catalogId]);
        for (const row of oldRows) {
            await logTaxonomyMappingChange({
                servicePk: catalogId,
                c3Uuid: row.c3_uuid,
                mappingId: row.id,
                actionType: 'DELETE_ALL',
                oldValues: row,
                newValues: null,
                changedBy: req.user?.username || 'system',
            });
        }
        res.json({ message: tReq(req, 'taxonomy.messages.c3_mappings_deleted'), serviceId });
    } catch (err) { next(err); }
});

module.exports = router;
