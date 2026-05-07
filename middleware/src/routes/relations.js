'use strict';
const express = require('express');
const repo    = require('../db/relations.repo');
const svcRepo = require('../db/services.repo');
const audit   = require('../db/audit.repo');
const { requireAuth } = require('../middleware/auth');
const { canEdit } = require('../middleware/rbac');
const { validateRelation } = require('../services/validation');
const { getPool } = require('../db/pool');

const router = express.Router();
router.use(requireAuth);

function normalizeRelationBody(body) {
  return {
    from_service_id: body.from_service_id ?? body.fromServiceId ?? null,
    to_service_id: body.to_service_id ?? body.toServiceId ?? null,
    relation_type: body.relation_type ?? body.relationType ?? 'depends_on',
    relation_label: body.relation_label ?? body.relationLabel ?? null,
    pace_code: body.pace_code ?? body.paceCode ?? null,
    is_mandatory: body.is_mandatory ?? body.isMandatory ?? true,
    impact_mode: body.impact_mode ?? body.impactMode ?? 'hard_stop',
    impact_level: body.impact_level ?? body.impactLevel ?? 'high',
    relation_note: body.relation_note ?? body.relationNote ?? null,
    // Provenance: relevant for both manual entry and the import pipeline.
    source_field:      body.source_field      ?? body.sourceField      ?? null,
    raw_text:          body.raw_text          ?? body.rawText          ?? null,
    parse_confidence:  body.parse_confidence  ?? body.parseConfidence  ?? null,
    is_inferred:       body.is_inferred       ?? body.isInferred       ?? false,
    is_verified:       body.is_verified       ?? body.isVerified       ?? null, 
    };
}

// GET /api/v1/relations?serviceId=WPS001&relationType=depends_on
router.get('/', async (req, res, next) => {
    try {
        const serviceId    = req.query.serviceId    || undefined;
        const relationType = req.query.relationType || undefined;
        const items = await repo.findAll({ serviceId, relationType });
        res.json(items);
    } catch (err) { next(err); }
});

// POST /api/v1/relations
// body: { from_service_id, to_service_id, relation_type, relation_label }
router.post('/', canEdit, async (req, res, next) => {
    try {
        const body = normalizeRelationBody(req.body);
        const errors = validateRelation(body);
        if (errors.length) return res.status(422).json({ errors });

        const [from, to] = await Promise.all([
            svcRepo.findByServiceId(body.from_service_id),
            svcRepo.findByServiceId(body.to_service_id),
        ]);
        if (!from) return res.status(404).json({ error: 'Zdrojová služba nenalezena' });
        if (!to)   return res.status(404).json({ error: 'Cílová služba nenalezena' });

        const newId = await repo.create(body, req.user.username);
        await audit.log({ tableName: 'ServiceRelation', recordId: newId, action: 'INSERT', newValues: req.body, performedBy: req.user.username });
        res.status(201).json(await repo.findById(newId));
    } catch (err) { next(err); }
});

// PUT /api/v1/relations/:id
// Editable fields: relation_type, relation_label, pace_code, is_mandatory,
//                    impact_mode, impact_level, relation_note, is_verified, is_inferred
router.put('/:id', canEdit, async (req, res, next) => {
    try {
        const id  = parseInt(req.params.id);
        const rel = await repo.findById(id);
        if (!rel) return res.status(404).json({ error: 'Relace nenalezena' });

        const pool = getPool();
        const b    = req.body;

        // Partial update — only provided fields are changed
        const updates = [];
        const values = [];
        const pushValue = (value) => {
            values.push(value);
            return `$${values.length}`;
        };

        if (b.relation_type  !== undefined) updates.push(`relation_type_code = ${pushValue(b.relation_type ?? null)}`);
        if (b.relation_label !== undefined) updates.push(`relation_label = ${pushValue(b.relation_label ?? null)}`);
        if (b.pace_code      !== undefined) updates.push(`pace_code = ${pushValue(b.pace_code ?? null)}`);
        if (b.is_mandatory   !== undefined) updates.push(`is_mandatory = ${pushValue(b.is_mandatory ?? true)}`);
        if (b.impact_mode    !== undefined) updates.push(`impact_mode = ${pushValue(b.impact_mode ?? null)}`);
        if (b.impact_level   !== undefined) updates.push(`impact_level = ${pushValue(b.impact_level ?? null)}`);
        if (b.relation_note  !== undefined) updates.push(`relation_note = ${pushValue(b.relation_note ?? null)}`);
        if (b.is_verified    !== undefined) updates.push(`is_verified = ${pushValue(b.is_verified ?? null)}`);
        if (b.is_inferred    !== undefined) updates.push(`is_inferred = ${pushValue(b.is_inferred ?? false)}`);

        if (updates.length === 0) return res.status(422).json({ error: 'Žádná pole k aktualizaci' });

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        await pool.query(
            `UPDATE data.service_relation SET ${updates.join(', ')} WHERE id = $${values.length} AND is_deleted = FALSE`,
            values
        );

        await audit.log({ tableName: 'ServiceRelation', recordId: id, action: 'UPDATE', newValues: b, performedBy: req.user.username });
        res.json(await repo.findById(id));
    } catch (err) { next(err); }
});

// DELETE /api/v1/relations/:id
router.delete('/:id', canEdit, async (req, res, next) => {
    try {
        const id  = parseInt(req.params.id);
        const rel = await repo.findById(id);
        if (!rel) return res.status(404).json({ error: 'Relace nenalezena' });
        await repo.remove(id);
        await audit.log({ tableName: 'ServiceRelation', recordId: id, action: 'DELETE', performedBy: req.user.username });
        res.json({ message: 'Relace smazána' });
    } catch (err) { next(err); }
});

module.exports = router;
