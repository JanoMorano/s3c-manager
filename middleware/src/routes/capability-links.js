'use strict';
/**
 * routes/capability-links.js
 * Mounting point: /api/v1/taxonomy/c3/:uuid/links
 *
 * Structured M:N links from C3Taxonomy capability → entity tables.
 * (GAP #1 + GAP #2 from the capability completeness implementation)
 *
 * Routes:
 *   GET    /api/v1/taxonomy/c3/:uuid/links         — all linked entities + completeness
 *   GET    /api/v1/taxonomy/c3/:uuid/completeness  — completeness status only
 *
 *   POST   /api/v1/taxonomy/c3/:uuid/links/app            canAdmin
 *   DELETE /api/v1/taxonomy/c3/:uuid/links/app/:id        canAdmin
 *   POST   /api/v1/taxonomy/c3/:uuid/links/data-object    canAdmin
 *   DELETE /api/v1/taxonomy/c3/:uuid/links/data-object/:id canAdmin
 *   POST   /api/v1/taxonomy/c3/:uuid/links/tin            canAdmin
 *   DELETE /api/v1/taxonomy/c3/:uuid/links/tin/:id        canAdmin
 *   POST   /api/v1/taxonomy/c3/:uuid/links/c3-service     canAdmin
 *   DELETE /api/v1/taxonomy/c3/:uuid/links/c3-service/:id canAdmin
 *
 *   GET    /api/v1/taxonomy/spiral                        — active baseline
 *   PUT    /api/v1/taxonomy/spiral/activate/:code  canAdmin
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { canAdmin }    = require('../middleware/rbac');
const { getPool } = require('../db/pool');
const {
    syncCapabilityDerivedLinksForCapability,
} = require('../utils/c3-capability-links');

const router = express.Router({ mergeParams: true }); // mergeParams provides :uuid

// ── Helpers ───────────────────────────────────────────────────────────────────
function getUuid(req) { return req.params.uuid; }
function getCreatedBy(req) { return req.user?.email ?? req.user?.username ?? null; }

function isMissingTable(err) {
    return err.code === '42P01';
}

// ─── GET /links — all linked entities + completeness ──────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
    try {
        const uuid = getUuid(req);
        const pool = getPool();

        const [appRows, doRows, tinRows, svcRows, serviceMappings, completeness] = await Promise.all([
            pool.query(`
                SELECT l.id, l.link_role, l.created_at,
                       a.id AS entity_id, a.uuid AS entity_uuid,
                       a.title, a.application_code AS code,
                       a.item_status, a.ss_overall_status
                FROM data.c3_capability_application_link l
                JOIN data.c3_application a ON a.id = l.c3_application_id
                WHERE l.capability_uuid = $1
                ORDER BY a.title
            `, [uuid]),
            pool.query(`
                SELECT l.id, l.link_role, l.created_at,
                       d.id AS entity_id, d.uuid AS entity_uuid,
                       d.title, d.data_object_code AS code,
                       d.item_status
                FROM data.c3_capability_data_object_link l
                JOIN data.c3_data_object d ON d.id = l.c3_data_object_id
                WHERE l.capability_uuid = $1
                ORDER BY d.title
            `, [uuid]),
            pool.query(`
                SELECT l.id, l.link_role, l.created_at,
                       t.id AS entity_id, t.uuid AS entity_uuid,
                       t.title, t.technology_interaction_code AS code,
                       t.item_status
                FROM data.c3_capability_tin_link l
                JOIN data.c3_technology_interaction t ON t.id = l.c3_tin_id
                WHERE l.capability_uuid = $1
                ORDER BY t.title
            `, [uuid]),
            pool.query(`
                SELECT l.id, l.link_role, l.created_at,
                       s.id AS entity_id, s.uuid AS entity_uuid,
                       s.title, s.service_code AS code,
                       s.item_status
                FROM data.c3_capability_c3_service_link l
                JOIN data.c3_service s ON s.id = l.c3_service_id
                WHERE l.capability_uuid = $1
                ORDER BY s.title
            `, [uuid]),
            pool.query(`
                SELECT
                    scm.id,
                    sc.service_id,
                    sc.title,
                    sc.service_status_code AS service_status,
                    scm.mapping_type_code,
                    scm.is_primary
                FROM data.service_c3_mapping scm
                JOIN data.service_catalog sc
                  ON sc.id = scm.service_id
                 AND sc.is_deleted = FALSE
                WHERE scm.c3_uuid = $1
                ORDER BY scm.is_primary DESC, sc.service_id ASC
            `, [uuid]),
            pool.query(`
                SELECT app_count, data_object_count, tin_count, c3_service_count,
                       service_mapping_count, has_app, has_data_object, has_tin,
                       has_c3_service, has_service_mapping, completeness_status
                FROM data.v_c3capabilitycompleteness
                WHERE uuid = $1
            `, [uuid]),
        ]);

        res.json({
            uuid,
            apps:        appRows.rows,
            data_objects: doRows.rows,
            tins:        tinRows.rows,
            c3_services: svcRows.rows,
            service_catalogue_mappings: serviceMappings.rows,
            completeness: completeness.rows[0] ?? null,
        });
    } catch (err) {
        if (isMissingTable(err)) return res.status(503).json({ error: 'Capability link tabulky neexistují — spusťte rebuild DB (migrace 46)' });
        next(err);
    }
});

// ─── GET /completeness — jen completeness ─────────────────────────────────────
router.get('/completeness', requireAuth, async (req, res, next) => {
    try {
        const result = await getPool().query(
            'SELECT * FROM data.v_c3capabilitycompleteness WHERE uuid = $1',
            [getUuid(req)]
        );
        if (!result.rows[0]) return res.status(404).json({ error: 'Capability not found' });
        res.json(result.rows[0]);
    } catch (err) {
        if (isMissingTable(err)) return res.status(503).json({ error: 'Capability link tabulky neexistují — spusťte rebuild DB (migrace 46)' });
        next(err);
    }
});

// ─── POST /links/app ──────────────────────────────────────────────────────────
router.post('/app', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const { c3_application_id, link_role } = req.body;
        if (!c3_application_id) return res.status(400).json({ error: 'c3_application_id je povinné' });
        await getPool().query(`
            INSERT INTO data.c3_capability_application_link
                (capability_uuid, c3_application_id, link_role, created_by)
            VALUES ($1, $2, $3, $4)
        `, [getUuid(req), c3_application_id, link_role ?? null, getCreatedBy(req)]);
        await syncCapabilityDerivedLinksForCapability(getUuid(req));
        res.status(201).json({ ok: true });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Vazba již existuje' });
        next(err);
    }
});

router.delete('/app/:linkId', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const r = await getPool().query(
            'DELETE FROM data.c3_capability_application_link WHERE id = $1 AND capability_uuid = $2',
            [req.params.linkId, getUuid(req)]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: 'Vazba nenalezena' });
        await syncCapabilityDerivedLinksForCapability(getUuid(req));
        res.json({ ok: true });
    } catch (err) {
        if (isMissingTable(err)) return res.status(503).json({ error: 'Capability link tabulky neexistují — spusťte rebuild DB (migrace 46)' });
        next(err);
    }
});

// ─── POST /links/data-object ──────────────────────────────────────────────────
router.post('/data-object', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const { c3_data_object_id, link_role } = req.body;
        if (!c3_data_object_id) return res.status(400).json({ error: 'c3_data_object_id je povinné' });
        await getPool().query(`
            INSERT INTO data.c3_capability_data_object_link
                (capability_uuid, c3_data_object_id, link_role, created_by)
            VALUES ($1, $2, $3, $4)
        `, [getUuid(req), c3_data_object_id, link_role ?? null, getCreatedBy(req)]);
        res.status(201).json({ ok: true });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Vazba již existuje' });
        next(err);
    }
});

router.delete('/data-object/:linkId', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const r = await getPool().query(
            'DELETE FROM data.c3_capability_data_object_link WHERE id = $1 AND capability_uuid = $2',
            [req.params.linkId, getUuid(req)]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: 'Vazba nenalezena' });
        res.json({ ok: true });
    } catch (err) {
        if (isMissingTable(err)) return res.status(503).json({ error: 'Capability link tabulky neexistují — spusťte rebuild DB (migrace 46)' });
        next(err);
    }
});

// ─── POST /links/tin ──────────────────────────────────────────────────────────
router.post('/tin', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const { c3_tin_id, link_role } = req.body;
        if (!c3_tin_id) return res.status(400).json({ error: 'c3_tin_id je povinné' });
        await getPool().query(`
            INSERT INTO data.c3_capability_tin_link
                (capability_uuid, c3_tin_id, link_role, created_by)
            VALUES ($1, $2, $3, $4)
        `, [getUuid(req), c3_tin_id, link_role ?? null, getCreatedBy(req)]);
        await syncCapabilityDerivedLinksForCapability(getUuid(req));
        res.status(201).json({ ok: true });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Vazba již existuje' });
        next(err);
    }
});

router.delete('/tin/:linkId', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const r = await getPool().query(
            'DELETE FROM data.c3_capability_tin_link WHERE id = $1 AND capability_uuid = $2',
            [req.params.linkId, getUuid(req)]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: 'Vazba nenalezena' });
        await syncCapabilityDerivedLinksForCapability(getUuid(req));
        res.json({ ok: true });
    } catch (err) {
        if (isMissingTable(err)) return res.status(503).json({ error: 'Capability link tabulky neexistují — spusťte rebuild DB (migrace 46)' });
        next(err);
    }
});

// ─── POST /links/c3-service ───────────────────────────────────────────────────
router.post('/c3-service', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const { c3_service_id, link_role } = req.body;
        if (!c3_service_id) return res.status(400).json({ error: 'c3_service_id je povinné' });
        await getPool().query(`
            INSERT INTO data.c3_capability_c3_service_link
                (capability_uuid, c3_service_id, link_role, created_by)
            VALUES ($1, $2, $3, $4)
        `, [getUuid(req), c3_service_id, link_role ?? null, getCreatedBy(req)]);
        res.status(201).json({ ok: true });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Vazba již existuje' });
        next(err);
    }
});

router.delete('/c3-service/:linkId', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const r = await getPool().query(
            'DELETE FROM data.c3_capability_c3_service_link WHERE id = $1 AND capability_uuid = $2',
            [req.params.linkId, getUuid(req)]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: 'Vazba nenalezena' });
        res.json({ ok: true });
    } catch (err) {
        if (isMissingTable(err)) return res.status(503).json({ error: 'Capability link tabulky neexistují — spusťte rebuild DB (migrace 46)' });
        next(err);
    }
});

module.exports = { router };
