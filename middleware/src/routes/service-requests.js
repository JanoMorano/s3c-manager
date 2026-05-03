'use strict';

const express = require('express');
const { getPool, getPlatformPool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { parseIntFilter } = require('../utils/query-filters');

const router = express.Router();
router.use(requireAuth);

function missingRequestStore(err) {
    return err?.code === '42P01' || err?.code === '42703';
}

function actorEmail(req) {
    const email = String(req.user?.email ?? '').trim();
    if (email) return email;
    const username = String(req.user?.username ?? '').trim();
    return username.includes('@') ? username : null;
}

function actorName(req) {
    return req.user?.display_name || req.user?.username || 'unknown';
}

function normalizeRequest(row) {
    return {
        id: row.id,
        request_number: row.request_number,
        service_id: row.service_code,
        service_pk: row.service_id,
        service_title: row.service_title,
        offering_id: row.offering_id,
        offering_title: row.offering_title,
        requested_by_user_id: row.requested_by_user_id,
        requested_by_name: row.requested_by_name,
        requested_by_email: row.requested_by_email,
        status: row.status,
        request_channel_type: row.request_channel_type,
        request_channel_url: row.request_channel_url,
        external_ticket_ref: row.external_ticket_ref,
        external_ticket_url: row.external_ticket_url,
        request_note: row.request_note,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function resolveService(serviceId) {
    const result = await getPool().query(`
        SELECT
            id,
            service_id,
            title,
            requestable,
            request_channel_type,
            request_channel_url
        FROM data.service_catalog
        WHERE is_deleted = FALSE
          AND (service_id = $1 OR id::text = $1)
        LIMIT 1
    `, [String(serviceId ?? '').trim()]);
    return result.rows[0] ?? null;
}

async function resolveOffering(servicePk, offeringId) {
    if (offeringId) {
        const result = await getPool().query(`
            SELECT id, title, requestable, request_channel_type, request_channel_url
            FROM data.service_offering
            WHERE id = $1
              AND service_id = $2
              AND status <> 'deleted'
            LIMIT 1
        `, [offeringId, servicePk]);
        return result.rows[0] ?? null;
    }

    const result = await getPool().query(`
        SELECT id, title, requestable, request_channel_type, request_channel_url
        FROM data.service_offering
        WHERE service_id = $1
          AND status <> 'deleted'
        ORDER BY is_default DESC, requestable DESC, display_order ASC NULLS LAST, id ASC
        LIMIT 1
    `, [servicePk]);
    return result.rows[0] ?? null;
}

async function notifyRequester(req, created) {
    try {
        const notification = await getPlatformPool().query(`
            INSERT INTO platform.notification
                (notification_type, severity, title, body, href, entity_type, entity_id, created_by)
            VALUES ('service_request', 'info', $1, $2, $3, 'service_request', $4, $5)
            RETURNING id
        `, [
            `Request ${created.request_number} submitted`,
            created.service_title ? `Request for ${created.service_title} is now tracked in S3C Manager.` : 'Your service request is now tracked in S3C Manager.',
            '/services/list?requestable=true',
            String(created.id),
            actorName(req),
        ]);
        await getPlatformPool().query(`
            INSERT INTO platform.user_notification (notification_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (notification_id, user_id) DO NOTHING
        `, [notification.rows[0].id, req.user.id]);
    } catch {
        // Request creation must not fail because the notification inbox has not been migrated yet.
    }
}

router.get('/mine', async (req, res, next) => {
    const limit = parseIntFilter(req.query.limit, { fallback: 20, min: 1, max: 100 });
    const email = actorEmail(req);
    try {
        const result = await getPool().query(`
            SELECT
                sr.*,
                sc.service_id AS service_code,
                sc.title AS service_title,
                so.title AS offering_title
            FROM data.service_request sr
            LEFT JOIN data.service_catalog sc ON sc.id = sr.service_id
            LEFT JOIN data.service_offering so ON so.id = sr.offering_id
            WHERE sr.requested_by_user_id = $1
               OR ($2::text IS NOT NULL AND LOWER(sr.requested_by_email) = LOWER($2::text))
            ORDER BY sr.created_at DESC
            LIMIT $3
        `, [req.user.id, email, limit]);
        res.json({ items: result.rows.map(normalizeRequest), count: result.rows.length });
    } catch (err) {
        if (missingRequestStore(err)) return res.json({ items: [], count: 0, storage: 'unmigrated' });
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const service = await resolveService(req.body?.service_id ?? req.body?.serviceId);
        if (!service) return res.status(404).json({ error: 'Service not found' });

        const offering = await resolveOffering(service.id, req.body?.offering_id ?? req.body?.offeringId ?? null);
        const requestable = Boolean(offering?.requestable ?? service.requestable);
        const channelType = offering?.request_channel_type ?? service.request_channel_type ?? null;
        const channelUrl = offering?.request_channel_url ?? service.request_channel_url ?? null;

        if (!requestable && !channelUrl) {
            return res.status(400).json({ error: 'Service is not requestable' });
        }

        const result = await getPool().query(`
            INSERT INTO data.service_request
                (
                    service_id,
                    offering_id,
                    requested_by_user_id,
                    requested_by_name,
                    requested_by_email,
                    status,
                    request_channel_type,
                    request_channel_url,
                    request_note
                )
            VALUES ($1, $2, $3, $4, $5, 'submitted', $6, $7, $8)
            RETURNING *
        `, [
            service.id,
            offering?.id ?? null,
            req.user.id,
            actorName(req),
            actorEmail(req),
            channelType,
            channelUrl,
            req.body?.request_note ?? req.body?.note ?? null,
        ]);

        const created = normalizeRequest({
            ...result.rows[0],
            service_code: service.service_id,
            service_title: service.title,
            offering_title: offering?.title ?? null,
        });
        await notifyRequester(req, created);

        res.status(201).json({
            item: created,
            external_redirect_url: channelType === 'external' || channelUrl ? channelUrl : null,
        });
    } catch (err) {
        if (missingRequestStore(err)) {
            return res.status(503).json({ error: 'Service request log is not migrated yet' });
        }
        next(err);
    }
});

module.exports = router;
