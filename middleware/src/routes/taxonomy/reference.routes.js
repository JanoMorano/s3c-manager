'use strict';

/** Service catalogue reference data: portfolio groups, service types, domains, service lines and related lists. */

const express = require('express');
const { getPool } = require('../../db/pool');
const { canAdmin } = require('../../middleware/rbac');
const {
    cache,
    invalidateRefCacheKeys,
    selectRows,
    selectOne,
    normalizeOptionalInt,
    normalizeOptionalBool,
} = require('./shared');

const router = express.Router();

// ─── GET /api/v1/taxonomy/portfolio-groups ────────────────────────────────────
// Editor dropdown: active groups only.
router.get('/portfolio-groups', async (req, res, next) => {
    try {
        const CACHE_KEY = 'ref_portfolio_groups';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);
        const result = await selectRows(getPool(), `
            SELECT code, name, sort_order
            FROM data.ref_portfolio_group
            WHERE is_active = TRUE
            ORDER BY sort_order, name
        `);
        cache.set(CACHE_KEY, result);
        res.json(result);
    } catch (err) { next(err); }
});

// ─── GET /api/v1/taxonomy/service-types ──────────────────────────────────────
// ref_ServiceType has no is_active; return everything.
router.get('/service-types', async (req, res, next) => {
    try {
        const CACHE_KEY = 'ref_service_types';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);
        const result = await selectRows(getPool(), `
            SELECT code, name, description
            FROM data.ref_service_type
            ORDER BY code
        `);
        cache.set(CACHE_KEY, result);
        res.json(result);
    } catch (err) { next(err); }
});

// ─── GET /api/v1/taxonomy/domains ────────────────────────────────────────────
// ref_NetworkDomain — pro editor dropdown i import validaci
router.get('/domains', async (req, res, next) => {
    try {
        const CACHE_KEY = 'ref_network_domains';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);
        const result = await selectRows(getPool(), `
            SELECT code, name, color_hex, sort_order
            FROM data.ref_network_domain
            ORDER BY sort_order, code
        `);
        cache.set(CACHE_KEY, result);
        res.json(result);
    } catch (err) { next(err); }
});

// ─── GET /api/v1/taxonomy/service-lines ──────────────────────────────────────
// Editor dropdown: full service-line → global_service_group_code hierarchy.
router.get('/service-lines', async (req, res, next) => {
    try {
        const CACHE_KEY = 'ref_service_lines';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);
        const result = await selectRows(getPool(), `
            SELECT code, name, global_service_group_code, sort_order
            FROM data.ref_service_line
            ORDER BY sort_order, name
        `);
        cache.set(CACHE_KEY, result);
        res.json(result);
    } catch (err) { next(err); }
});

// ─── ADMIN CRUD: ref_PortfolioGroup ──────────────────────────────────────────
// ref_PortfolioGroup has is_active; DELETE is soft (deactivation, not physical deletion).

// POST /api/v1/taxonomy/portfolio-groups
router.post('/portfolio-groups', canAdmin, async (req, res, next) => {
    try {
        const b = req.body || {};
        if (!b.code || !b.name) return res.status(400).json({ error: 'Pole code a name jsou povinná' });

        const exists = await selectOne(getPool(), `
            SELECT 1
            FROM data.ref_portfolio_group
            WHERE code = $1
        `, [b.code]);
        if (exists) return res.status(409).json({ error: `Kód '${b.code}' již existuje` });

        await getPool().query(`
            INSERT INTO data.ref_portfolio_group (code, name, sort_order)
            VALUES ($1, $2, $3)
        `, [b.code, b.name, normalizeOptionalInt(b.sort_order)]);

        invalidateRefCacheKeys('portfolioGroups');
        const row = await selectOne(getPool(), `
            SELECT code, name, sort_order, is_active
            FROM data.ref_portfolio_group
            WHERE code = $1
        `, [b.code]);
        res.status(201).json(row);
    } catch (err) { next(err); }
});

// PUT /api/v1/taxonomy/portfolio-groups/:code
router.put('/portfolio-groups/:code', canAdmin, async (req, res, next) => {
    try {
        const { code } = req.params;
        const b = req.body || {};

        const exists = await selectOne(getPool(), `
            SELECT 1
            FROM data.ref_portfolio_group
            WHERE code = $1
        `, [code]);
        if (!exists) return res.status(404).json({ error: `Kód '${code}' nenalezen` });

        await getPool().query(`
            UPDATE data.ref_portfolio_group
            SET
                name = COALESCE($2, name),
                sort_order = COALESCE($3, sort_order),
                is_active = COALESCE($4, is_active)
            WHERE code = $1
        `, [
            code,
            b.name ?? null,
            normalizeOptionalInt(b.sort_order),
            normalizeOptionalBool(b.is_active),
        ]);

        invalidateRefCacheKeys('portfolioGroups');
        const row = await selectOne(getPool(), `
            SELECT code, name, sort_order, is_active
            FROM data.ref_portfolio_group
            WHERE code = $1
        `, [code]);
        res.json(row);
    } catch (err) { next(err); }
});

// DELETE /api/v1/taxonomy/portfolio-groups/:code (soft — sets is_active = 0)
// Hard delete is rejected because FK from ServiceCatalog and ref_GlobalServiceGroup would fail.
router.delete('/portfolio-groups/:code', canAdmin, async (req, res, next) => {
    try {
        const { code } = req.params;

        const exists = await selectOne(getPool(), `
            SELECT 1
            FROM data.ref_portfolio_group
            WHERE code = $1
        `, [code]);
        if (!exists) return res.status(404).json({ error: `Kód '${code}' nenalezen` });

        await getPool().query(`
            UPDATE data.ref_portfolio_group
            SET is_active = FALSE
            WHERE code = $1
        `, [code]);

       invalidateRefCacheKeys('portfolioGroups');
        res.json({ message: `PortfolioGroup '${code}' deaktivován`, code });
    } catch (err) { next(err); }
});

// ─── ADMIN CRUD: ref_ServiceLine ─────────────────────────────────────────────
// ref_ServiceLine has no is_active; DELETE is hard but FK-protected.

// POST /api/v1/taxonomy/service-lines
router.post('/service-lines', canAdmin, async (req, res, next) => {
    try {
        const b = req.body || {};
        if (!b.code || !b.name) return res.status(400).json({ error: 'Pole code a name jsou povinná' });

        const exists = await selectOne(getPool(), `
            SELECT 1
            FROM data.ref_service_line
            WHERE code = $1
        `, [b.code]);
        if (exists) return res.status(409).json({ error: `Kód '${b.code}' již existuje` });

        await getPool().query(`
            INSERT INTO data.ref_service_line (code, name, global_service_group_code, sort_order)
            VALUES ($1, $2, $3, $4)
        `, [b.code, b.name, b.global_service_group_code ?? null, normalizeOptionalInt(b.sort_order)]);

        invalidateRefCacheKeys('serviceLines');
        const row = await selectOne(getPool(), `
            SELECT code, name, global_service_group_code, sort_order
            FROM data.ref_service_line
            WHERE code = $1
        `, [b.code]);
        res.status(201).json(row);
    } catch (err) { next(err); }
});

// PUT /api/v1/taxonomy/service-lines/:code
router.put('/service-lines/:code', canAdmin, async (req, res, next) => {
    try {
        const { code } = req.params;
        const b = req.body || {};

        const exists = await selectOne(getPool(), `
            SELECT 1
            FROM data.ref_service_line
            WHERE code = $1
        `, [code]);
        if (!exists) return res.status(404).json({ error: `Kód '${code}' nenalezen` });

        await getPool().query(`
            UPDATE data.ref_service_line
            SET
                name = COALESCE($2, name),
                global_service_group_code = CASE
                    WHEN $3::boolean THEN $4
                    ELSE global_service_group_code
                END,
                sort_order = COALESCE($5, sort_order)
            WHERE code = $1
        `, [
            code,
            b.name ?? null,
            Object.prototype.hasOwnProperty.call(b, 'global_service_group_code'),
            b.global_service_group_code ?? null,
            normalizeOptionalInt(b.sort_order),
        ]);

        invalidateRefCacheKeys('serviceLines');
        const row = await selectOne(getPool(), `
            SELECT code, name, global_service_group_code, sort_order
            FROM data.ref_service_line
            WHERE code = $1
        `, [code]);
        res.json(row);
    } catch (err) { next(err); }
});

// DELETE /api/v1/taxonomy/service-lines/:code  (hard — s FK ochranou)
router.delete('/service-lines/:code', canAdmin, async (req, res, next) => {
    try {
        const { code } = req.params;

        const exists = await selectOne(getPool(), `
            SELECT 1
            FROM data.ref_service_line
            WHERE code = $1
        `, [code]);
        if (!exists) return res.status(404).json({ error: `Kód '${code}' nenalezen` });

        const used = await selectOne(getPool(), `
            SELECT service_id
            FROM data.service_catalog
            WHERE service_line_code = $1
              AND is_deleted = FALSE
            LIMIT 1
        `, [code]);
        if (used) {
            return res.status(409).json({
                error: `ServiceLine '${code}' je přiřazena ke službě '${used.service_id}' — nelze smazat`,
            });
        }

        await getPool().query(`
            DELETE FROM data.ref_service_line
            WHERE code = $1
        `, [code]);

        invalidateRefCacheKeys('serviceLines');
        res.json({ message: `ServiceLine '${code}' smazána`, code });
    } catch (err) { next(err); }
});

// ─── GET /api/v1/taxonomy/global-service-groups ──────────────────────────────
// Editor dropdown — seznam global service groups z ref_GlobalServiceGroup.
// Returns: [{ code, name, sort_order }]
router.get('/global-service-groups', async (req, res, next) => {
    try {
        const CACHE_KEY = 'ref_global_service_groups';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);

        const result = await selectRows(getPool(), `
            SELECT code, name, sort_order
            FROM data.ref_global_service_group
            ORDER BY COALESCE(sort_order, 9999), name
        `);
        cache.set(CACHE_KEY, result);
        res.json(result);
    } catch (err) { next(err); }
});

// ─── GET /api/v1/taxonomy/organizational-elements ────────────────────────────
// Editor dropdown: organizational elements from ref_OrganizationalElement.
// Returns: [{ code, name, sort_order }]
router.get('/organizational-elements', async (req, res, next) => {
    try {
        const CACHE_KEY = 'ref_organizational_elements';
        const cached = cache.get(CACHE_KEY);
        if (cached) return res.json(cached);

        const result = await selectRows(getPool(), `
            SELECT code, name, sort_order
            FROM data.ref_organizational_element
            ORDER BY COALESCE(sort_order, 9999), name
        `);
        cache.set(CACHE_KEY, result);
        res.json(result);
    } catch (err) { next(err); }
});

module.exports = router;
