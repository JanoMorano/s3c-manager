'use strict';

/** Spiral (baseline) governance. */

const express = require('express');
const { getPool } = require('../../db/pool');
const { requireAuth } = require('../../middleware/auth');
const { canAdmin } = require('../../middleware/rbac');
const { tReq } = require('../../utils/i18n');
const { isUniqueViolation, selectRows, selectOne } = require('./shared');
const { normalizeSpiralCode } = require('./capability-map.service');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// SPIRAL GOVERNANCE (GAP #6)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/taxonomy/spiral — active baseline + list all
router.get('/spiral', async (req, res, next) => {
    try {
        const result = await selectRows(getPool(), `
            SELECT id, spiral_code, spiral_label, is_active, notes,
                   activated_at, activated_by, created_at
            FROM data.ref_spiral_baseline
            ORDER BY created_at DESC
        `);
        const active = result.find(r => r.is_active) ?? null;
        res.json({ active, all: result });
    } catch (err) { next(err); }
});

// PUT /api/v1/taxonomy/spiral/activate/:code — sets the selected spiral as active (canAdmin)
router.put('/spiral/activate/:code', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const pool = getPool();
        const code = req.params.code;
        const check = await selectOne(pool, `
            SELECT id
            FROM data.ref_spiral_baseline
            WHERE spiral_code = $1
        `, [code]);
        if (!check) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.spiral_not_found') });

        await pool.query(`UPDATE data.ref_spiral_baseline SET is_active = FALSE`);
        await pool.query(`
            UPDATE data.ref_spiral_baseline
            SET is_active = TRUE,
                activated_at = CURRENT_TIMESTAMP,
                activated_by = $2
            WHERE spiral_code = $1
        `, [code, req.user?.email ?? req.user?.username ?? null]);
        res.json({ ok: true, activated: code });
    } catch (err) { next(err); }
});

// POST /api/v1/taxonomy/spiral — add a new spiral baseline (canAdmin)
router.post('/spiral', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const { spiral_code, spiral_label, notes } = req.body;
        if (!spiral_code || !spiral_label)
            return res.status(400).json({ error: tReq(req, 'taxonomy.errors.spiral_required_fields') });
        const normalizedSpiralCode = normalizeSpiralCode(spiral_code, null);
        if (!normalizedSpiralCode)
            return res.status(400).json({ error: tReq(req, 'taxonomy.errors.spiral_required_fields') });
        await getPool().query(`
            INSERT INTO data.ref_spiral_baseline (spiral_code, spiral_label, is_active, notes)
            VALUES ($1, $2, FALSE, $3)
        `, [normalizedSpiralCode, spiral_label, notes ?? null]);
        res.status(201).json({ ok: true });
    } catch (err) {
        if (isUniqueViolation(err))
            return res.status(409).json({ error: tReq(req, 'taxonomy.errors.spiral_duplicate') });
        next(err);
    }
});

module.exports = router;
