'use strict';

/** Relations, flavours, raw import fields, domains and roles of a service. */

const express = require('express');
const repo = require('../../db/services.repo');
const flRepo = require('../../db/flavours.repo');
const relRepo = require('../../db/relations.repo');
const audit = require('../../db/audit.repo');
const { canEdit } = require('../../middleware/rbac');
const { getPool } = require('../../db/pool');

const router = express.Router();

// ─── GET /services/:id/relations ──────────────────────────────────────────────
// Returns a typed edge list for the selected service (project brief API contract, section 6).
// Includes outgoing and incoming edges with relation_type, confidence, and source_field.
router.get('/:id/relations', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const relations = await relRepo.findByService(serviceId);

        // Add direction: outgoing = from==serviceId, incoming = to==serviceId.
        const enriched = relations.map(r => ({
            ...r,
            direction: r.from_service_id === serviceId ? 'outgoing' : 'incoming',
        }));

        res.json(enriched);
    } catch (err) { next(err); }
});

// ─── GET /services/:id/flavours ───────────────────────────────────────────────
// Dedicated endpoint for legacy variant evidence of the selected service (project brief API contract, section 6).
router.get('/:id/flavours', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const flavours = await flRepo.findByService(serviceId);
        res.json(flavours);
    } catch (err) { next(err); }
});

// ─── GET /services/:id/raw-fields ────────────────────────────────────────────
// Returns ServiceRawField records for the selected service (audit trail / re-parse source).
router.get('/:id/raw-fields', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const pool = getPool();

        // Verify that the service exists.
        const svcCheck = await pool.query('SELECT id FROM data.service_catalog WHERE service_id = $1 AND is_deleted = FALSE', [serviceId]);
        if (!svcCheck.rows.length) return res.status(404).json({ error: 'Služba nenalezena' });
        const svcPk = svcCheck.rows[0].id;

        const result = await pool.query(`
                SELECT id, field_name, raw_value, parser_version, notes, created_at
                FROM data.service_raw_field
                WHERE service_id = $1
                ORDER BY field_name
            `, [svcPk]);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// ─── PUT /services/:id/domains ────────────────────────────────────────────────
// Body: { domains: string[] }  — e.g. { domains: ["RELAY", "CLOUD"] }
// Replaces the full M:N domain set for the selected service.
router.put('/:id/domains', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const existing = await repo.findByServiceId(serviceId);
        if (!existing) return res.status(404).json({ error: 'Služba nenalezena' });

        const domains = req.body.domains;
        if (!Array.isArray(domains)) {
            return res.status(422).json({ error: 'domains musí být pole stringů' });
        }

        await repo.setDomains(serviceId, domains);
        await audit.log({ tableName: 'ServiceAvailableOn', recordId: null, recordLabel: serviceId, action: 'UPDATE', newValues: { domains }, performedBy: req.user.username, clientIp: req.ip });

        const updated = await repo.findByServiceId(serviceId);
        res.json({ service_id: serviceId, available_on: updated.available_on });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/roles ──────────────────────────────────────────────────
// Returns the full role assignment history for the selected service, including closed assignments.
router.get('/:id/roles', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const result = await getPool().query(`
                SELECT ra.id, ra.role_code, ra.display_name, ra.email, ra.organization_name,
                       ra.valid_from, ra.valid_to
                FROM data.service_role_assignment ra
                JOIN data.service_catalog sc ON sc.id = ra.service_id AND sc.is_deleted = FALSE
                WHERE sc.service_id = $1
                ORDER BY ra.role_code, ra.valid_from DESC
            `, [serviceId]);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// ─── PUT /services/:id/roles ──────────────────────────────────────────────────
// Body: { roleCode: string, displayName: string, email?: string, orgName?: string }
// roleCode: 'service_owner' | 'service_area_owner' | 'service_delivery_manager'
// displayName null/'' closes the active record (valid_to = now).
const VALID_ROLE_CODES = ['service_owner', 'service_area_owner', 'service_delivery_manager'];

router.put('/:id/roles', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const existing = await repo.findByServiceId(serviceId);
        if (!existing) return res.status(404).json({ error: 'Služba nenalezena' });

        const { roleCode, displayName = null, email = null, orgName = null } = req.body;
        if (!roleCode || !VALID_ROLE_CODES.includes(roleCode)) {
            return res.status(422).json({ error: `roleCode musí být: ${VALID_ROLE_CODES.join(', ')}` });
        }

        await repo.setRole(serviceId, roleCode, displayName || null, email || null, orgName || null);
        await audit.log({ tableName: 'ServiceRoleAssignment', recordId: null, recordLabel: serviceId, action: 'UPDATE', newValues: { roleCode, displayName, email }, performedBy: req.user.username, clientIp: req.ip });

        const updated = await repo.findByServiceId(serviceId);
        res.json({
            service_id: serviceId,
            service_owner: updated.service_owner,
            vlastnik:       updated.vlastnik,
            manager:        updated.manager,
        });
    } catch (err) { next(err); }
});

module.exports = router;
