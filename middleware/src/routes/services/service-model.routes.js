'use strict';

/** Service offerings, support model, audience policies and operational links. */

const express = require('express');
const offeringsRepo = require('../../db/offerings.repo');
const supportModelRepo = require('../../db/support-model.repo');
const audienceRepo = require('../../db/audience.repo');
const operationalLinksRepo = require('../../db/operational-links.repo');
const audit = require('../../db/audit.repo');
const { canEdit } = require('../../middleware/rbac');
const {
    validateOffering,
    validateSupportModel,
    validateAudiencePolicy,
    validateOperationalLink,
} = require('../../services/validation');
const {
    _normalizeOfferingBody,
    _normalizeSupportModelItem,
    _normalizeAudienceItem,
    _normalizeOperationalLinkBody,
    _normalizeCollectionBody,
    _dbErrorStatus,
    _dbErrorPayload,
    _resolveCatalogIdOr404,
    _validateOfferingOwnership,
} = require('./shared');

const router = express.Router();

// ─── GET /services/:id/offerings ─────────────────────────────────────────────
router.get('/:id/offerings', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const items = await offeringsRepo.listByService(catalogId);
        res.json({ items });
    } catch (err) { next(err); }
});

// ─── POST /services/:id/offerings ────────────────────────────────────────────
router.post('/:id/offerings', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const body = _normalizeOfferingBody(req.body || {});
        const errors = validateOffering(body, { isCreate: true });
        if (errors.length) return res.status(422).json({ errors });

        try {
            const item = await offeringsRepo.create(catalogId, body);
            await audit.log?.({
                tableName: 'ServiceOffering',
                recordId: item.id,
                recordLabel: `${serviceId}:${item.offering_code}`,
                action: 'INSERT',
                newValues: body,
                performedBy: req.user.username,
                clientIp: req.ip,
            });
            res.status(201).json(item);
        } catch (err) {
            return res.status(_dbErrorStatus(err)).json(_dbErrorPayload(err, 'Offering se nepodařilo vytvořit'));
        }
    } catch (err) { next(err); }
});

// ─── PUT /services/:id/offerings/:offeringId ─────────────────────────────────
router.put('/:id/offerings/:offeringId', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const offeringId = parseInt(req.params.offeringId, 10);
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const existing = await offeringsRepo.findById(offeringId, catalogId);
        if (!existing) return res.status(404).json({ error: 'Offering nenalezen' });

        const body = _normalizeOfferingBody(req.body || {});
        const errors = validateOffering(body, { isCreate: false, existing });
        if (errors.length) return res.status(422).json({ errors });

        try {
            const item = await offeringsRepo.update(offeringId, catalogId, body);
            await audit.log?.({
                tableName: 'ServiceOffering',
                recordId: offeringId,
                recordLabel: `${serviceId}:${existing.offering_code}`,
                action: 'UPDATE',
                newValues: body,
                performedBy: req.user.username,
                clientIp: req.ip,
            });
            res.json(item);
        } catch (err) {
            return res.status(_dbErrorStatus(err)).json(_dbErrorPayload(err, 'Offering se nepodařilo upravit'));
        }
    } catch (err) { next(err); }
});

// ─── DELETE /services/:id/offerings/:offeringId ──────────────────────────────
router.delete('/:id/offerings/:offeringId', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const offeringId = parseInt(req.params.offeringId, 10);
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const existing = await offeringsRepo.findById(offeringId, catalogId);
        if (!existing) return res.status(404).json({ error: 'Offering nenalezen' });

        const removed = await offeringsRepo.remove(offeringId, catalogId);
        if (!removed) return res.status(404).json({ error: 'Offering nenalezen' });

        await audit.log?.({
            tableName: 'ServiceOffering',
            recordId: offeringId,
            recordLabel: `${serviceId}:${existing.offering_code}`,
            action: 'DELETE',
            performedBy: req.user.username,
            clientIp: req.ip,
        });
        res.json({ message: `Offering '${existing.offering_code}' smazán` });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/support-model ─────────────────────────────────────────
router.get('/:id/support-model', async (req, res, next) => {
    try {
        const catalogId = await _resolveCatalogIdOr404(req.params.id, res);
        if (!catalogId) return;
        const items = await supportModelRepo.listByService(catalogId);
        res.json({ items });
    } catch (err) { next(err); }
});

// ─── PUT /services/:id/support-model ─────────────────────────────────────────
router.put('/:id/support-model', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const items = _normalizeCollectionBody(req.body, _normalizeSupportModelItem);
        const errors = validateSupportModel(items);
        for (let index = 0; index < items.length; index += 1) {
            if (!(await _validateOfferingOwnership(catalogId, items[index].offering_id))) {
                errors.push({ field: `items[${index}].offering_id`, message: 'Offering nepatří k vybrané službě' });
            }
        }
        if (errors.length) return res.status(422).json({ errors });

        try {
            const saved = await supportModelRepo.replaceForService(catalogId, items);
            await audit.log?.({
                tableName: 'ServiceSupportModel',
                recordId: null,
                recordLabel: serviceId,
                action: 'UPDATE',
                newValues: { items },
                performedBy: req.user.username,
                clientIp: req.ip,
            });
            res.json({ items: saved });
        } catch (err) {
            return res.status(_dbErrorStatus(err)).json(_dbErrorPayload(err, 'Support model se nepodařilo uložit'));
        }
    } catch (err) { next(err); }
});

// ─── GET /services/:id/audience ──────────────────────────────────────────────
router.get('/:id/audience', async (req, res, next) => {
    try {
        const catalogId = await _resolveCatalogIdOr404(req.params.id, res);
        if (!catalogId) return;
        const items = await audienceRepo.listByService(catalogId);
        res.json({ items });
    } catch (err) { next(err); }
});

// ─── PUT /services/:id/audience ──────────────────────────────────────────────
router.put('/:id/audience', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const items = _normalizeCollectionBody(req.body, _normalizeAudienceItem);
        const errors = validateAudiencePolicy(items);
        for (let index = 0; index < items.length; index += 1) {
            if (!(await _validateOfferingOwnership(catalogId, items[index].offering_id))) {
                errors.push({ field: `items[${index}].offering_id`, message: 'Offering nepatří k vybrané službě' });
            }
        }
        if (errors.length) return res.status(422).json({ errors });

        try {
            const saved = await audienceRepo.replaceForService(catalogId, items);
            await audit.log?.({
                tableName: 'ServiceAudiencePolicy',
                recordId: null,
                recordLabel: serviceId,
                action: 'UPDATE',
                newValues: { items },
                performedBy: req.user.username,
                clientIp: req.ip,
            });
            res.json({ items: saved });
        } catch (err) {
            return res.status(_dbErrorStatus(err)).json(_dbErrorPayload(err, 'Audience policy se nepodařilo uložit'));
        }
    } catch (err) { next(err); }
});

// ─── GET /services/:id/operational-links ─────────────────────────────────────
router.get('/:id/operational-links', async (req, res, next) => {
    try {
        const catalogId = await _resolveCatalogIdOr404(req.params.id, res);
        if (!catalogId) return;
        const items = await operationalLinksRepo.listByService(catalogId);
        res.json({ items });
    } catch (err) { next(err); }
});

// ─── POST /services/:id/operational-links ────────────────────────────────────
router.post('/:id/operational-links', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const body = _normalizeOperationalLinkBody(req.body || {});
        const errors = validateOperationalLink(body, { isCreate: true });
        if (!(await _validateOfferingOwnership(catalogId, body.offering_id))) {
            errors.push({ field: 'offering_id', message: 'Offering nepatří k vybrané službě' });
        }
        if (errors.length) return res.status(422).json({ errors });

        try {
            const item = await operationalLinksRepo.create(catalogId, body);
            await audit.log?.({
                tableName: 'ServiceOperationalLink',
                recordId: item.id,
                recordLabel: serviceId,
                action: 'INSERT',
                newValues: body,
                performedBy: req.user.username,
                clientIp: req.ip,
            });
            res.status(201).json(item);
        } catch (err) {
            return res.status(_dbErrorStatus(err)).json(_dbErrorPayload(err, 'Operational link se nepodařilo vytvořit'));
        }
    } catch (err) { next(err); }
});

// ─── PUT /services/:id/operational-links/:linkId ─────────────────────────────
router.put('/:id/operational-links/:linkId', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const linkId = parseInt(req.params.linkId, 10);
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const existing = await operationalLinksRepo.findById(linkId, catalogId);
        if (!existing) return res.status(404).json({ error: 'Operational link nenalezen' });

        const body = _normalizeOperationalLinkBody(req.body || {});
        const errors = validateOperationalLink(body, { isCreate: false });
        if (!(await _validateOfferingOwnership(catalogId, body.offering_id))) {
            errors.push({ field: 'offering_id', message: 'Offering nepatří k vybrané službě' });
        }
        if (errors.length) return res.status(422).json({ errors });

        try {
            const item = await operationalLinksRepo.update(linkId, catalogId, body);
            await audit.log?.({
                tableName: 'ServiceOperationalLink',
                recordId: linkId,
                recordLabel: serviceId,
                action: 'UPDATE',
                newValues: body,
                performedBy: req.user.username,
                clientIp: req.ip,
            });
            res.json(item);
        } catch (err) {
            return res.status(_dbErrorStatus(err)).json(_dbErrorPayload(err, 'Operational link se nepodařilo upravit'));
        }
    } catch (err) { next(err); }
});

// ─── DELETE /services/:id/operational-links/:linkId ──────────────────────────
router.delete('/:id/operational-links/:linkId', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const linkId = parseInt(req.params.linkId, 10);
        const catalogId = await _resolveCatalogIdOr404(serviceId, res);
        if (!catalogId) return;

        const existing = await operationalLinksRepo.findById(linkId, catalogId);
        if (!existing) return res.status(404).json({ error: 'Operational link nenalezen' });

        const removed = await operationalLinksRepo.remove(linkId, catalogId);
        if (!removed) return res.status(404).json({ error: 'Operational link nenalezen' });

        await audit.log?.({
            tableName: 'ServiceOperationalLink',
            recordId: linkId,
            recordLabel: serviceId,
            action: 'DELETE',
            performedBy: req.user.username,
            clientIp: req.ip,
        });
        res.json({ message: `Operational link ${linkId} smazán` });
    } catch (err) { next(err); }
});

module.exports = router;
