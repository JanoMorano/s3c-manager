'use strict';

/** Capability builder administration (admin only). */

const express = require('express');
const { getPool } = require('../../db/pool');
const { canAdmin } = require('../../middleware/rbac');
const { parseTextFilter, parseIntFilter } = require('../../utils/query-filters');
const { ensureCapabilityBuilderSeeded } = require('../../utils/c3-capability-builder-seed');
const { tReq } = require('../../utils/i18n');
const {
    invalidateC3CacheKeys,
    isUniqueViolation,
    resultRows,
    resultRowCount,
    selectRows,
    selectOne,
} = require('./shared');
const {
    normalizeCapabilityMapTitle,
    normalizeSpiralCode,
    resolveCapabilityMapTitleKey,
    getCapabilityMapTitle,
    upsertCapabilityMapTitle,
    validateCapabilityBuilderPayload,
} = require('./capability-map.service');

const router = express.Router();

router.get('/c3-capability-builder', canAdmin, async (req, res, next) => {
    try {
        await ensureCapabilityBuilderSeeded();

        const search = parseTextFilter(req.query.search);
        const limit = parseIntFilter(req.query.limit, { fallback: 500, min: 1, max: 5000 });

        const spiralFilter = req.query.spiral ? normalizeSpiralCode(req.query.spiral, null) : null;

        const result = spiralFilter
            ? await selectRows(getPool(), `
                SELECT v.*
                FROM data.v_c3capabilitybuilderlist v
                JOIN data.c3_capability_builder raw ON raw.id = v.id AND raw.fmn_spiral = $1
                ORDER BY v.domain_order, v.level, COALESCE(v.parent_id, ''), v.title, v.page_id
            `, [spiralFilter])
            : await selectRows(getPool(), `
                SELECT *
                FROM data.v_c3capabilitybuilderlist
                ORDER BY domain_order, level, COALESCE(parent_id, ''), title, page_id
            `);

        let rows = result;
        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter((row) =>
                String(row.page_id ?? '').toLowerCase().includes(q) ||
                String(row.uuid ?? '').toLowerCase().includes(q) ||
                String(row.title ?? '').toLowerCase().includes(q) ||
                String(row.parent_id ?? '').toLowerCase().includes(q) ||
                String(row.parent_title ?? '').toLowerCase().includes(q) ||
                String(row.state ?? '').toLowerCase().includes(q) ||
                String(row.domain_code ?? '').toLowerCase().includes(q)
            );
        }
        res.json(rows.slice(0, limit));
    } catch (err) { next(err); }
});

router.get('/c3-capability-builder/settings', canAdmin, async (req, res, next) => {
    try {
        const spiral = normalizeSpiralCode(req.query.spiral);
        const pageTitle = await getCapabilityMapTitle(spiral);
        res.json({
            config_key: resolveCapabilityMapTitleKey(spiral),
            page_title: pageTitle,
            spiral,
        });
    } catch (err) { next(err); }
});

router.put('/c3-capability-builder/settings', canAdmin, async (req, res, next) => {
    try {
        const spiral = normalizeSpiralCode(req.body?.spiral);
        const pageTitle = normalizeCapabilityMapTitle(req.body?.page_title, (key, params) => tReq(req, key, params));
        await upsertCapabilityMapTitle(pageTitle, req.user?.username ?? null, spiral);
        res.json({
            config_key: resolveCapabilityMapTitleKey(spiral),
            page_title: pageTitle,
            spiral,
        });
    } catch (err) { next(err); }
});

router.post('/c3-capability-builder', canAdmin, async (req, res, next) => {
    try {
        await ensureCapabilityBuilderSeeded();

        const normalized = await validateCapabilityBuilderPayload(req.body, null, 'data.c3_capability_builder', 20, (key, params) => tReq(req, key, params));
        const spiral = normalizeSpiralCode(req.body?.spiral ?? req.body?.fmn_spiral);
        const insertResult = await getPool().query(`
                INSERT INTO data.c3_capability_builder (
                    page_id,
                    uuid,
                    title,
                    parent_id,
                    level,
                    state,
                    domain_code,
                    fmn_spiral
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8
                )
                RETURNING id
            `, [
                normalized.pageId,
                normalized.uuid,
                normalized.title,
                normalized.parentId,
                normalized.level,
                normalized.state,
                normalized.domainCode,
                spiral,
            ]);

        invalidateC3CacheKeys();

        const createdId = resultRows(insertResult)[0]?.id;
        const created = await selectOne(getPool(), `
            SELECT *
            FROM data.v_c3capabilitybuilderlist
            WHERE id = $1
        `, [createdId]);
        res.status(201).json(created ?? { id: createdId });
    } catch (err) {
        if (isUniqueViolation(err)) {
            return res.status(409).json({ error: tReq(req, 'taxonomy.errors.duplicate_page_or_uuid') });
        }
        next(err);
    }
});

router.put('/c3-capability-builder/:id', canAdmin, async (req, res, next) => {
    try {
        await ensureCapabilityBuilderSeeded();

        const id = parseIntFilter(req.params.id, { fallback: null, min: 1, max: 2147483647 });
        if (!id) return res.status(400).json({ error: tReq(req, 'taxonomy.errors.invalid_id') });

        const normalized = await validateCapabilityBuilderPayload(req.body, id, 'data.c3_capability_builder', 20, (key, params) => tReq(req, key, params));
        const spiral = normalizeSpiralCode(req.body?.spiral ?? req.body?.fmn_spiral);
        const updateResult = await getPool().query(`
                UPDATE data.c3_capability_builder
                SET
                    page_id = $2,
                    uuid = $3,
                    title = $4,
                    parent_id = $5,
                    level = $6,
                    state = $7,
                    domain_code = $8,
                    fmn_spiral = $9,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                id,
                normalized.pageId,
                normalized.uuid,
                normalized.title,
                normalized.parentId,
                normalized.level,
                normalized.state,
                normalized.domainCode,
                spiral,
            ]);
        if (resultRowCount(updateResult) === 0) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.capability_builder_item_not_found') });

        invalidateC3CacheKeys();

        const updated = await selectOne(getPool(), `
            SELECT *
            FROM data.v_c3capabilitybuilderlist
            WHERE id = $1
        `, [id]);
        res.json(updated ?? { id });
    } catch (err) {
        if (isUniqueViolation(err)) {
            return res.status(409).json({ error: tReq(req, 'taxonomy.errors.duplicate_page_or_uuid') });
        }
        next(err);
    }
});

router.delete('/c3-capability-builder/:id', canAdmin, async (req, res, next) => {
    try {
        await ensureCapabilityBuilderSeeded();

        const id = parseIntFilter(req.params.id, { fallback: null, min: 1, max: 2147483647 });
        if (!id) return res.status(400).json({ error: tReq(req, 'taxonomy.errors.invalid_id') });

        const item = await selectOne(getPool(), `
            SELECT id, page_id
            FROM data.c3_capability_builder
            WHERE id = $1
        `, [id]);
        if (!item) return res.status(404).json({ error: tReq(req, 'taxonomy.errors.capability_builder_item_not_found') });

        const childResult = await selectOne(getPool(), `
            SELECT COUNT(1) AS child_count
            FROM data.c3_capability_builder
            WHERE parent_id = $1
        `, [item.page_id]);
        if (Number(childResult?.child_count ?? 0) > 0) {
            return res.status(409).json({ error: tReq(req, 'taxonomy.errors.cannot_delete_with_children') });
        }

        await getPool().query(`
            DELETE FROM data.c3_capability_builder
            WHERE id = $1
        `, [id]);

        invalidateC3CacheKeys();
        res.json({ ok: true });
    } catch (err) { next(err); }
});

module.exports = router;
