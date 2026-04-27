'use strict';

const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function getUserIdentity(req) {
    return {
        email: req.user?.email ?? null,
        username: req.user?.username ?? null,
    };
}

function toInboxItem(row) {
    return {
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        href: row.href,
        severity: row.severity,
        created_at: row.created_at,
    };
}

// ─── GET /dashboard/inbox ────────────────────────────────────────────────────
router.get('/inbox', async (req, res, next) => {
    try {
        const { email, username } = getUserIdentity(req);
        const result = await getPool().query(`
            WITH owned_services AS (
                SELECT DISTINCT sc.id, sc.service_id, sc.title, sc.updated_at, sc.completeness_score
                FROM data.service_catalog sc
                LEFT JOIN data.service_role_assignment sra
                    ON sra.service_id = sc.id
                   AND sra.role_code = 'service_owner'
                   AND sra.valid_to IS NULL
                WHERE sc.is_deleted = FALSE
                  AND sc.is_stub = FALSE
                  AND (
                      $1::text IS NULL
                      OR LOWER(COALESCE(sra.email, '')) = LOWER($1::text)
                      OR LOWER(COALESCE(sra.display_name, '')) = LOWER($2::text)
                  )
            ),
            inbox AS (
                SELECT
                    'review-' || service_id AS id,
                    'service_review' AS type,
                    title,
                    'Metadata readiness is below publishable threshold' AS description,
                    '/services/' || service_id || '/edit' AS href,
                    CASE WHEN COALESCE(completeness_score, 0) < 40 THEN 'danger' ELSE 'warning' END AS severity,
                    updated_at AS created_at
                FROM owned_services
                WHERE COALESCE(completeness_score, 0) < 70
                UNION ALL
                SELECT
                    'mapping-' || service_id AS id,
                    'c3_mapping_gap' AS type,
                    title,
                    'Primary C3 mapping is missing' AS description,
                    '/services/' || service_id || '/edit#c3' AS href,
                    'warning' AS severity,
                    updated_at AS created_at
                FROM owned_services os
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM data.service_c3_mapping scm
                    WHERE scm.service_id = os.id
                      AND scm.is_primary = TRUE
                )
                UNION ALL
                SELECT
                    'pricing-' || service_id AS id,
                    'pricing_gap' AS type,
                    title,
                    'No active pricing flavour exists' AS description,
                    '/services/' || service_id || '/edit#flavours' AS href,
                    'info' AS severity,
                    updated_at AS created_at
                FROM owned_services os
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM data.service_flavour sf
                    WHERE sf.service_id = os.id
                      AND sf.is_deleted = FALSE
                      AND LOWER(COALESCE(sf.flavour_status_code, '')) IN ('available', 'active')
                )
            )
            SELECT *
            FROM inbox
            ORDER BY created_at DESC NULLS LAST, severity DESC, title ASC
            LIMIT 5
        `, [email, username]);

        res.json({ items: result.rows.map(toInboxItem) });
    } catch (err) { next(err); }
});

module.exports = router;
