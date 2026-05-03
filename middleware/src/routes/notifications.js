'use strict';

const express = require('express');
const { getPlatformPool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { parseIntFilter } = require('../utils/query-filters');

const router = express.Router();
router.use(requireAuth);

function enterpriseNotificationTablesMissing(err) {
    return err?.code === '42P01' || err?.code === '42703';
}

function parseBoolean(value, fallback = false) {
    if (value == null) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function emptyInbox() {
    return {
        items: [],
        unread_count: 0,
        total: 0,
        generated_at: new Date().toISOString(),
    };
}

function normalizeItem(row) {
    return {
        id: row.id,
        notification_type: row.notification_type,
        severity: row.severity,
        title: row.title,
        body: row.body,
        href: row.href,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        created_at: row.created_at,
        delivered_at: row.delivered_at,
        read_at: row.read_at,
        dismissed_at: row.dismissed_at,
    };
}

router.get('/', async (req, res, next) => {
    const includeRead = parseBoolean(req.query.include_read, false);
    const limit = parseIntFilter(req.query.limit, { fallback: 20, min: 1, max: 100 });

    try {
        const result = await getPlatformPool().query(`
            WITH inbox AS (
                SELECT
                    n.id,
                    n.notification_type,
                    n.severity,
                    n.title,
                    n.body,
                    n.href,
                    n.entity_type,
                    n.entity_id,
                    n.created_at,
                    un.delivered_at,
                    un.read_at,
                    un.dismissed_at
                FROM platform.user_notification un
                JOIN platform.notification n
                  ON n.id = un.notification_id
                WHERE un.user_id = $1
                  AND un.dismissed_at IS NULL
                  AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)
                  AND ($2::boolean = TRUE OR un.read_at IS NULL)
            ),
            counts AS (
                SELECT
                    COUNT(*)::integer AS total,
                    COUNT(*) FILTER (WHERE read_at IS NULL)::integer AS unread_count
                FROM inbox
            )
            SELECT inbox.*, counts.total, counts.unread_count
            FROM inbox
            CROSS JOIN counts
            ORDER BY inbox.delivered_at DESC, inbox.created_at DESC
            LIMIT $3
        `, [req.user.id, includeRead, limit]);

        const items = result.rows.map(normalizeItem);
        res.json({
            items,
            unread_count: Number(result.rows[0]?.unread_count ?? 0),
            total: Number(result.rows[0]?.total ?? 0),
            generated_at: new Date().toISOString(),
        });
    } catch (err) {
        if (enterpriseNotificationTablesMissing(err)) {
            return res.json(emptyInbox());
        }
        next(err);
    }
});

router.post('/:id/read', async (req, res, next) => {
    try {
        const result = await getPlatformPool().query(`
            UPDATE platform.user_notification
            SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
            WHERE user_id = $1
              AND notification_id = $2
              AND dismissed_at IS NULL
            RETURNING notification_id, read_at
        `, [req.user.id, req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Notification not found' });
        res.json({ id: result.rows[0].notification_id, read_at: result.rows[0].read_at });
    } catch (err) {
        if (enterpriseNotificationTablesMissing(err)) return res.json({ id: req.params.id, read_at: null, storage: 'local' });
        next(err);
    }
});

router.post('/read-all', async (req, res, next) => {
    try {
        const result = await getPlatformPool().query(`
            UPDATE platform.user_notification
            SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
            WHERE user_id = $1
              AND read_at IS NULL
              AND dismissed_at IS NULL
        `, [req.user.id]);
        res.json({ updated: result.rowCount ?? 0 });
    } catch (err) {
        if (enterpriseNotificationTablesMissing(err)) return res.json({ updated: 0, storage: 'local' });
        next(err);
    }
});

module.exports = router;
