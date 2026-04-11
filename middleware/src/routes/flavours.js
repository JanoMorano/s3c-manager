'use strict';
const express = require('express');
const flRepo  = require('../db/flavours.repo');
const svcRepo = require('../db/services.repo');
const audit   = require('../db/audit.repo');
const { requireAuth } = require('../middleware/auth');
const { canEdit, canAdmin } = require('../middleware/rbac');
const { validateFlavour } = require('../services/validation');
const { isActiveServiceStatus } = require('../services/readiness');

const router = express.Router();
router.use(requireAuth);

function normalizeFlavourBody(body) {
  return {
    service_id: body.service_id ?? body.serviceId ?? null,
    flavour_id: body.flavour_id ?? body.flavourId ?? null,
    title: body.title ?? null,
    service_unit: body.service_unit ?? body.serviceUnit ?? null,
    service_rate_eur: body.service_rate_eur ?? body.serviceRateEUR ?? null,
    initiation_cost: body.initiation_cost ?? body.initiationCost ?? null,
    lifecycle_cost: body.lifecycle_cost ?? body.lifecycleCost ?? null,
    lifetime_years: body.lifetime_years ?? body.lifetimeYears ?? null,
    nations_rate: body.nations_rate ?? body.nationsRate ?? null,
    dependency_text: body.dependency_text ?? body.dependencyText ?? null,
    short_note: body.short_note ?? body.shortNote ?? null,
    flavour_status: body.flavour_status ?? body.flavourStatus ?? null
  };
}

function isActiveFlavourStatus(status) {
    return ['available', 'active'].includes(String(status ?? '').toLowerCase());
}

// GET /api/v1/flavours?serviceId=WPS001
// GET /api/v1/flavours?pattern=dash6 — all service flavours where service_id[7]==='-'
//   (LIKE '______-_%' = 6 characters + dash + at least 1 character)
router.get('/', async (req, res, next) => {
    try {
        if (req.query.pattern === 'dash6' || req.query.all) {
            const { getPool } = require('../db/pool');
            // pattern=dash6 → legacy filter (service_id with '-' as the 7th character)
            // all=1         → all flavours from all services
            const whereExtra = (req.query.pattern === 'dash6' && !req.query.all)
                ? `AND sc.service_id LIKE '______-_%'`
                : '';
            const result = await getPool().query(`
                SELECT
                    sf.id,
                    sf.flavour_code,
                    sf.title,
                    sf.short_note,
                    sc.service_id,
                    sc.title AS service_title
                FROM data.service_flavour sf
                JOIN data.service_catalog sc ON sc.id = sf.service_id
                WHERE sc.is_deleted = FALSE
                  AND sf.is_deleted = FALSE
                  ${whereExtra}
                ORDER BY sc.service_id, sf.flavour_code
            `);
            return res.json(result.rows);
        }

        const serviceId = req.query.serviceId || req.params.svcId;
        if (!serviceId) return res.status(400).json({ error: 'Chybí serviceId' });
        const items = await flRepo.findByService(serviceId);
        res.json(items);
    } catch (err) { next(err); }
});

// POST /api/v1/flavours — body must contain service_id (string business key).
router.post('/', canEdit, async (req, res, next) => {
    try {
        const body = normalizeFlavourBody(req.body);
        const serviceId = body.service_id ?? body.serviceId;
        if (!serviceId) return res.status(400).json({ error: 'Chybí service_id' });

        const svc = await svcRepo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Nadřazená služba nenalezena' });

        const errors = validateFlavour(body, true);
        if (errors.length) return res.status(422).json({ errors });

        const newId = await flRepo.upsert(serviceId, body);
        const item  = await flRepo.findById(newId);
        await audit.log({ tableName: 'ServiceFlavours', recordId: newId, action: 'INSERT', newValues: req.body, performedBy: req.user.username });
        res.status(201).json(item);
    } catch (err) { next(err); }
});

// PUT /api/v1/flavours/:id — :id is the internal BIGINT id.
router.put('/:id', canEdit, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const existing  = await flRepo.findById(id);
        if (!existing) return res.status(404).json({ error: 'Varianta nenalezena' });

        const body = normalizeFlavourBody(req.body);
        const errors = validateFlavour(body, false);
        if (errors.length) return res.status(422).json({ errors });

        const updated = await flRepo.update(id, body);
        await audit.log({ tableName: 'ServiceFlavours', recordId: id, action: 'UPDATE', performedBy: req.user.username });
        res.json(updated);
    } catch (err) { next(err); }
});

// DELETE /api/v1/flavours/:id — :id is the internal BIGINT id.
router.delete('/:id', canAdmin, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const existing  = await flRepo.findById(id);
        if (!existing) return res.status(404).json({ error: 'Varianta nenalezena' });

        await flRepo.remove(id);
        await audit.log({ tableName: 'ServiceFlavours', recordId: id, action: 'DELETE', performedBy: req.user.username });
        res.json({ message: 'Varianta smazána' });
    } catch (err) { next(err); }
});

module.exports = router;
