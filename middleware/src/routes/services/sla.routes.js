'use strict';

/** Service-level and offering SLA records. */

const express = require('express');
const repo = require('../../db/services.repo');
const audit = require('../../db/audit.repo');
const { canEdit } = require('../../middleware/rbac');
const { getPool } = require('../../db/pool');

const router = express.Router();

// ─── GET /services/:id/sla ────────────────────────────────────────────────────
// Returns detailed SLA records from ServiceSla, not only summary scalar fields in ServiceCatalog.
// flavour_id = null means the SLA applies to the whole service; otherwise it applies to a specific flavour.
router.get('/:id/sla', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const result = await getPool().query(`
                SELECT
                    sl.id,
                    sl.support_window_code,
                    sl.availability_pct,
                    sl.restoration_hours,
                    sl.delivery_days,
                    sl.restoration_text,
                    sl.delivery_text,
                    sl.priority_model_raw,
                    sl.sla_note_raw,
                    sl.source_field,
                    sl.created_at,
                    sl.updated_at,
                    sf.flavour_code,
                    sf.title           AS flavour_title
                FROM data.service_sla sl
                INNER JOIN data.service_catalog sc
                    ON sc.id = sl.service_id
                   AND sc.service_id = $1
                   AND sc.is_deleted = FALSE
                LEFT JOIN data.service_flavour sf
                    ON sf.id = sl.flavour_id AND sf.is_deleted = FALSE
                ORDER BY CASE WHEN sl.flavour_id IS NULL THEN 0 ELSE 1 END, sl.id
            `, [serviceId]);

        res.json({
            service_id:    serviceId,
            sla_summary: {
                sla_availability:     svc.sla_availability,
                sla_restoration:      svc.sla_restoration,
                sla_delivery:         svc.sla_delivery,
            },
            sla_records: result.rows,
        });
    } catch (err) { next(err); }
});

// ─── POST /services/:id/sla ───────────────────────────────────────────────────
// Creates a new SLA record for the selected service or a specific flavour.
// Body: { support_window_code?, availability_pct?, restoration_hours?, delivery_days?,
//         priority_model_raw?, sla_note_raw?, flavour_id? }
router.post('/:id/sla', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const b = req.body || {};
        const pool = getPool();

        // Resolve BIGINT service id
        const svcIdRow = await pool.query('SELECT id FROM data.service_catalog WHERE service_id = $1 AND is_deleted = FALSE', [serviceId]);
        const svcBigId = svcIdRow.rows[0]?.id;
        if (!svcBigId) return res.status(404).json({ error: 'Služba nenalezena (id)' });

        // Resolve optional flavour_id (BIGINT) from string code or numeric id
        let flavourBigId = null;
        if (b.flavour_id != null) {
            const flRow = await pool.query('SELECT id FROM data.service_flavour WHERE id = $1 AND is_deleted = FALSE', [parseInt(b.flavour_id, 10)]);
            if (!flRow.rows.length) return res.status(422).json({ error: `flavour_id ${b.flavour_id} nenalezen` });
            flavourBigId = flRow.rows[0].id;
        }

        const avail   = b.availability_pct   != null ? parseFloat(b.availability_pct)   : null;
        const restH   = b.restoration_hours  != null ? parseFloat(b.restoration_hours)  : null;
        const delD    = b.delivery_days      != null ? parseFloat(b.delivery_days)      : null;

        const ins = await pool.query(`
                INSERT INTO data.service_sla
                    (service_id, flavour_id, support_window_code, availability_pct,
                     restoration_hours, delivery_days, restoration_text, delivery_text,
                     priority_model_raw, sla_note_raw)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            `, [svcBigId, flavourBigId, b.support_window_code ?? null, avail, restH, delD,
                b.restoration_text ?? null, b.delivery_text ?? null, b.priority_model_raw ?? null, b.sla_note_raw ?? null]);
        const newId = ins.rows[0]?.id;

        await audit.log({ tableName: 'ServiceSla', recordId: null, recordLabel: serviceId, action: 'INSERT', newValues: b, performedBy: req.user.username, clientIp: req.ip });

        const row = await pool.query(`
                SELECT sl.id, sl.support_window_code, sl.availability_pct,
                       sl.restoration_hours, sl.delivery_days,
                       sl.restoration_text, sl.delivery_text,
                       sl.priority_model_raw, sl.sla_note_raw, sl.source_field,
                       sl.created_at, sl.updated_at,
                       sf.flavour_code, sf.title AS flavour_title
                FROM data.service_sla sl
                LEFT JOIN data.service_flavour sf ON sf.id = sl.flavour_id AND sf.is_deleted = FALSE
                WHERE sl.id = $1
            `, [newId]);
        res.status(201).json(row.rows[0]);
    } catch (err) { next(err); }
});

// ─── DELETE /services/:id/sla/:slaId ──────────────────────────────────────────
router.delete('/:id/sla/:slaId', canEdit, async (req, res, next) => {
    try {
        const { id: serviceId, slaId } = req.params;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const pool = getPool();
        const check = await pool.query(`
            SELECT sl.id
            FROM data.service_sla sl
            JOIN data.service_catalog sc ON sc.id = sl.service_id AND sc.service_id = $2
            WHERE sl.id = $1
        `, [parseInt(slaId, 10), serviceId]);
        if (!check.rows.length) return res.status(404).json({ error: 'SLA záznam nenalezen' });

        await pool.query('DELETE FROM data.service_sla WHERE id = $1', [parseInt(slaId, 10)]);

        await audit.log({ tableName: 'ServiceSla', recordId: null, recordLabel: serviceId, action: 'DELETE', performedBy: req.user.username, clientIp: req.ip });
        res.json({ message: `SLA záznam ${slaId} smazán` });
    } catch (err) { next(err); }
});

module.exports = router;
