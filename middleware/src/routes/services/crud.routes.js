'use strict';

/** Validate, create, update, delete and history of a service. */

const express = require('express');
const repo = require('../../db/services.repo');
const flRepo = require('../../db/flavours.repo');
const relRepo = require('../../db/relations.repo');
const offeringsRepo = require('../../db/offerings.repo');
const { canonicalizeServiceInput } = require('../../db/service-fields');
const audit = require('../../db/audit.repo');
const { canEdit, canAdmin } = require('../../middleware/rbac');
const { validateCreate, validateUpdate } = require('../../services/validation');
const { getServiceReadiness } = require('../../services/readiness');
const { serviceScore } = require('../../services/scoring');
const { getPool } = require('../../db/pool');
const logger = require('../../utils/logger');
const { _normalizeBody, _validateLiveReadiness } = require('./shared');

const router = express.Router();

// ─── POST /services/validate ──────────────────────────────────────────────────
router.post('/validate', async (req, res, next) => {
    try {
        const body     = _normalizeBody(req.body);
        const isCreate = body._mode !== 'update';
        const errors   = isCreate ? validateCreate(body) : validateUpdate(body);
        const score    = serviceScore(body);
        res.json({ valid: errors.length === 0, errors, score });
    } catch (err) { next(err); }
});

// ─── POST /services ───────────────────────────────────────────────────────────
router.post('/', canEdit, async (req, res, next) => {
    try {
        const body   = _normalizeBody(req.body);
        const errors = validateCreate(body);
        if (errors.length) return res.status(422).json({ errors });

        if (await repo.serviceIdExists(body.service_id)) {
            return res.status(409).json({ error: `ServiceID '${body.service_id}' již existuje` });
        }

        // FK validation — service_type must exist in ref_ServiceType
        const typeCheck = await getPool().query('SELECT 1 AS ok FROM data.ref_service_type WHERE code = $1', [body.service_type]);
        if (!typeCheck.rows.length) {
            return res.status(422).json({ errors: [{ field: 'service_type', message: `ServiceType '${body.service_type}' neexistuje v číselníku` }] });
        }
        // FK validation — portfolio_group_code must exist if provided
        const pgCode = body.portfolio_group_code || body.portfolio_group || null;
        if (pgCode) {
            const pgCheck = await getPool().query('SELECT 1 AS ok FROM data.ref_portfolio_group WHERE code = $1 AND is_active = TRUE', [pgCode]);
            if (!pgCheck.rows.length) {
                return res.status(422).json({ errors: [{ field: 'portfolio_group_code', message: `PortfolioGroup '${pgCode}' neexistuje v číselníku` }] });
            }
        }

        // FK validation — global_service_group_code (optional, FK na ref_GlobalServiceGroup)
        const gsgCode = body.global_service_group_code || null;
        if (gsgCode) {
            const gsgCheck = await getPool().query('SELECT 1 AS ok FROM data.ref_global_service_group WHERE code = $1', [gsgCode]);
            if (!gsgCheck.rows.length) {
                return res.status(422).json({ errors: [{ field: 'global_service_group_code', message: `GlobalServiceGroup '${gsgCode}' neexistuje v číselníku` }] });
            }
        }

        // FK validation — service_line_code (optional, FK na ref_ServiceLine)
        const slCode = body.service_line_code || null;
        if (slCode) {
            const slCheck = await getPool().query('SELECT 1 AS ok FROM data.ref_service_line WHERE code = $1', [slCode]);
            if (!slCheck.rows.length) {
                return res.status(422).json({ errors: [{ field: 'service_line_code', message: `ServiceLine '${slCode}' neexistuje v číselníku` }] });
            }
        }

        const newSvcId = await repo.create(body, req.user.username);
        const newSvc   = await repo.findByServiceId(newSvcId);

        // Domains M:N — set after row exists
        if (Array.isArray(body.available_on)) {
            await repo.setDomains(newSvcId, body.available_on);
        }

        const flavoursForScore = await flRepo.findByService(body.service_id).catch(() => []);
        const score = serviceScore(newSvc, flavoursForScore);
        await repo.updateScore(body.service_id, score);

        await audit.log({ tableName: 'ServiceCatalog', recordId: null, recordLabel: newSvc.service_id, action: 'INSERT', newValues: body, performedBy: req.user.username, clientIp: req.ip });
        await audit.addChangelog(newSvcId, 'create', `Vytvořena služba "${newSvc.title}"`, null, req.user.username);

        logger.info(`CREATE service ${newSvcId} by ${req.user.username}`);
        res.status(201).json({ ...newSvc, completeness_score: score });
    } catch (err) { next(err); }
});

// ─── PUT /services/:id ────────────────────────────────────────────────────────
router.put('/:id', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;

        const existing = await repo.findByServiceId(serviceId);
        if (!existing) return res.status(404).json({ error: 'Služba nenalezena' });

        const body   = _normalizeBody(req.body);
        const existingOfferings = await offeringsRepo.listByService(existing.id);
        const errors = validateUpdate(body, existing, {
            offeringHasRequestChannel: existingOfferings.some((offering) =>
                offering.status !== 'deleted' && (offering.request_channel_type?.trim() || offering.request_channel_url?.trim())),
        });
        if (!errors.length) {
            errors.push(...await _validateLiveReadiness(existing.id, existing, body));
        }
        if (errors.length) return res.status(422).json({ errors });

        // Entering the active stage (via lifecycle_stage_code, lifecycle_state or service_status) publishes the service.
        const requestedStage = canonicalizeServiceInput(body).fields.lifecycle_stage_code;
        const isActivating = requestedStage === 'active' && existing.lifecycle_stage_code !== 'active';
        if (isActivating) {
            const readiness = await getServiceReadiness(serviceId);
            if (!readiness?.is_publishable) {
                return res.status(409).json({
                    error: 'Službu nelze přepnout do stavu active, dokud nesplňuje publish readiness.',
                    readiness,
                });
            }
        }

        const updated = await repo.update(serviceId, body, req.user.username);

        // Domains M:N — only if available_on explicitly sent in body
        if (Array.isArray(body.available_on)) {
            await repo.setDomains(serviceId, body.available_on);
        }

        const flavours = await flRepo.findByService(serviceId);
        const score    = serviceScore(updated || existing, flavours);
        await repo.updateScore(serviceId, score);

        const changedFields = Object.keys(body).filter(k => body[k] !== existing[k]);
        const oldVals = {};
        const newVals = {};
        changedFields.forEach(k => { oldVals[k] = existing[k]; newVals[k] = body[k]; });

        await audit.log({ tableName: 'ServiceCatalog', recordId: null, recordLabel: serviceId, action: 'UPDATE', oldValues: oldVals, newValues: newVals, changedFields, performedBy: req.user.username, clientIp: req.ip });
        await audit.addChangelog(serviceId, 'update', `Upraven záznam "${existing.title}" (${changedFields.join(', ')})`, null, req.user.username);

        res.json({ ...(updated || existing), completeness_score: score });
    } catch (err) { next(err); }
});

// ─── DELETE /services/:id ─────────────────────────────────────────────────────
router.delete('/:id', canAdmin, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const dependents = await relRepo.findAll({ serviceId });
        if (dependents.length > 0 && !req.query.force) {
            return res.status(409).json({
                error: `Nelze smazat: ${dependents.length} jiných služeb závisí na '${serviceId}'. Použijte ?force=true pro vynucené smazání.`,
                dependents: dependents.map(d => ({
                    service_id: d.from_service_id === serviceId ? d.to_service_id : d.from_service_id,
                    title:      d.from_service_id === serviceId ? d.to_title     : d.from_title
                }))
            });
        }

        await repo.softDelete(serviceId, req.user.username);
        await audit.log({ tableName: 'ServiceCatalog', recordId: null, recordLabel: serviceId, action: 'SOFT_DELETE', oldValues: { service_status: svc.service_status }, performedBy: req.user.username, clientIp: req.ip });
        await audit.addChangelog(serviceId, 'delete', `Smazána služba "${svc.title}"`, null, req.user.username);

        logger.info(`DELETE service ${serviceId} by ${req.user.username}`);
        res.json({ message: `Služba '${serviceId}' smazána` });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/history ────────────────────────────────────────────────
router.get('/:id/history', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const history = await audit.findByRecord('ServiceCatalog', serviceId, 100);
        res.json(history);
    } catch (err) { next(err); }
});

module.exports = router;
