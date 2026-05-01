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

function toCount(value) {
    return Number(value ?? 0);
}

function emptySummary() {
    return {
        total_services: 0,
        services_ready_for_publish: 0,
        services_blocked_by_readiness: 0,
        overdue_reviews: 0,
        uncovered_capabilities: 0,
        over_covered_capabilities: 0,
        active_governance_reviews: 0,
        recent_decisions: 0,
    };
}

function normalizeSummary(row) {
    const fallback = emptySummary();
    if (!row) return fallback;
    return Object.fromEntries(
        Object.keys(fallback).map((key) => [key, toCount(row[key])]),
    );
}

function summaryLinks() {
    return {
        governance_health: '/operations',
        readiness_queue: '/operations/readiness',
        capability_coverage: '/capabilities/coverage',
        review_deadlines: '/operations/reviews',
        owner_load: '/operations/owner-load',
        recent_decisions: '/operations/decisions',
    };
}

// ─── GET /dashboard/summary ─────────────────────────────────────────────────
router.get('/summary', async (req, res, next) => {
    try {
        const result = await getPool().query(`
            WITH service_totals AS (
                SELECT COUNT(*)::integer AS total_services
                FROM data.service_catalog sc
                WHERE sc.is_deleted = FALSE
                  AND sc.is_stub = FALSE
            ),
            readiness AS (
                SELECT
                    COUNT(*) FILTER (WHERE COALESCE(is_publishable, FALSE) = TRUE)::integer AS services_ready_for_publish,
                    COUNT(*) FILTER (WHERE COALESCE(is_publishable, FALSE) = FALSE)::integer AS services_blocked_by_readiness
                FROM data.v_servicepublishreadiness
            ),
            capability AS (
                SELECT
                    COUNT(*) FILTER (WHERE governance_state = 'uncovered')::integer AS uncovered_capabilities,
                    COUNT(*) FILTER (WHERE governance_state = 'over_covered')::integer AS over_covered_capabilities
                FROM data.v_capability_governance_coverage
            ),
            reviews AS (
                SELECT
                    COUNT(*) FILTER (
                        WHERE status IN ('pending', 'in_review')
                          AND due_at IS NOT NULL
                          AND due_at < CURRENT_TIMESTAMP
                    )::integer AS overdue_reviews,
                    COUNT(*) FILTER (WHERE status IN ('pending', 'in_review'))::integer AS active_governance_reviews
                FROM data.governance_review
            ),
            decisions AS (
                SELECT COUNT(*)::integer AS recent_decisions
                FROM (
                    SELECT id
                    FROM data.governance_decision
                    ORDER BY decided_at DESC
                    LIMIT 25
                ) recent
            )
            SELECT
                COALESCE(service_totals.total_services, 0)::integer AS total_services,
                COALESCE(readiness.services_ready_for_publish, 0)::integer AS services_ready_for_publish,
                COALESCE(readiness.services_blocked_by_readiness, 0)::integer AS services_blocked_by_readiness,
                COALESCE(reviews.overdue_reviews, 0)::integer AS overdue_reviews,
                COALESCE(capability.uncovered_capabilities, 0)::integer AS uncovered_capabilities,
                COALESCE(capability.over_covered_capabilities, 0)::integer AS over_covered_capabilities,
                COALESCE(reviews.active_governance_reviews, 0)::integer AS active_governance_reviews,
                COALESCE(decisions.recent_decisions, 0)::integer AS recent_decisions
            FROM service_totals
            CROSS JOIN readiness
            CROSS JOIN capability
            CROSS JOIN reviews
            CROSS JOIN decisions
        `);

        res.json({
            generated_at: new Date().toISOString(),
            summary: normalizeSummary(result.rows[0]),
            links: summaryLinks(),
        });
    } catch (err) { next(err); }
});

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
