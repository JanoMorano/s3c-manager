'use strict';

const { getPool } = require('./pool');

function toInteger(value) {
    if (value == null || value === '') return null;
    const parsed = parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
    if (value == null) return null;
    const normalized = String(value).trim();
    return normalized || null;
}

function c3PortfolioCte({ activeSpiralOnly = false, selectedOnly = false } = {}) {
    const activeSpiralFilter = activeSpiralOnly
        ? `
          AND (
                active.spiral_code IS NULL
                OR b.fmn_spiral = active.spiral_code
                OR NOT EXISTS (
                    SELECT 1
                    FROM data.c3_capability_builder active_check
                    WHERE active_check.domain_code = 'Capabilities'
                      AND active_check.level = 2
                      AND active_check.fmn_spiral = active.spiral_code
                      AND lower(COALESCE(active_check.state, 'active')) NOT IN ('deleted', 'removed')
                )
          )
        `
        : '';
    const selectedFilter = selectedOnly
        ? `
          AND (
                b.page_id = $1
                OR b.uuid = $1
          )
        `
        : '';

    return `
        WITH RECURSIVE active_spiral AS (
            SELECT (
                SELECT spiral_code
                FROM data.ref_spiral_baseline
                WHERE is_active = TRUE
                ORDER BY id DESC
                LIMIT 1
            ) AS spiral_code
        ),
        meaningful_active_spiral AS (
            SELECT (
                SELECT active.spiral_code
                FROM active_spiral active
                WHERE active.spiral_code IS NOT NULL
                  AND EXISTS (
                    SELECT 1
                    FROM data.c3_capability_builder l2_check
                    LEFT JOIN data.c3_capability_builder child_check
                      ON child_check.parent_id = l2_check.page_id
                     AND child_check.domain_code = 'Capabilities'
                     AND lower(COALESCE(child_check.state, 'active')) NOT IN ('deleted', 'removed')
                    LEFT JOIN data.service_c3_mapping direct_mapping
                      ON direct_mapping.c3_uuid = l2_check.uuid
                    WHERE l2_check.domain_code = 'Capabilities'
                      AND l2_check.level = 2
                      AND l2_check.fmn_spiral = active.spiral_code
                      AND lower(COALESCE(l2_check.state, 'active')) NOT IN ('deleted', 'removed')
                      AND (
                            child_check.id IS NOT NULL
                            OR direct_mapping.id IS NOT NULL
                      )
                  )
            ) AS spiral_code
        ),
        l2_portfolios AS (
            SELECT
                b.id,
                b.page_id AS portfolio_code,
                b.uuid AS portfolio_uuid,
                b.title,
                sp.description,
                COALESCE(sp.status_code, NULLIF(b.state, ''), 'active') AS status_code,
                sp.owner_group_id,
                ag.group_name AS owner_group_name,
                b.level AS portfolio_level,
                b.fmn_spiral AS spiral_code,
                b.created_at,
                b.updated_at
            FROM data.c3_capability_builder b
            CROSS JOIN meaningful_active_spiral active
            LEFT JOIN data.service_portfolio sp
                ON sp.portfolio_code IN (b.page_id, b.uuid)
            LEFT JOIN platform.app_group ag
                ON ag.id = sp.owner_group_id
            WHERE b.domain_code = 'Capabilities'
              AND b.level = 2
              AND lower(COALESCE(b.state, 'active')) NOT IN ('deleted', 'removed')
              ${activeSpiralFilter}
              ${selectedFilter}
        ),
        portfolio_descendants AS (
            SELECT
                p.id AS portfolio_id,
                p.portfolio_code,
                p.portfolio_uuid,
                p.portfolio_code AS node_page_id,
                p.portfolio_uuid AS node_uuid,
                p.portfolio_level AS node_level
            FROM l2_portfolios p

            UNION ALL

            SELECT
                d.portfolio_id,
                d.portfolio_code,
                d.portfolio_uuid,
                child.page_id AS node_page_id,
                child.uuid AS node_uuid,
                child.level AS node_level
            FROM portfolio_descendants d
            JOIN data.c3_capability_builder child
              ON child.parent_id = d.node_page_id
             AND child.domain_code = 'Capabilities'
             AND lower(COALESCE(child.state, 'active')) NOT IN ('deleted', 'removed')
        )
    `;
}

function portfolioSelect() {
    return `
        SELECT
            p.id,
            p.portfolio_code,
            p.portfolio_uuid,
            p.title,
            p.description,
            p.status_code,
            p.owner_group_id,
            p.owner_group_name,
            p.portfolio_level,
            p.spiral_code,
            p.created_at,
            p.updated_at,
            COUNT(DISTINCT d.node_page_id) FILTER (WHERE d.node_level > p.portfolio_level)::integer AS capability_count,
            COUNT(DISTINCT sc.id)::integer AS service_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE COALESCE(sc.lifecycle_stage_code, sc.lifecycle_state) IN ('draft', 'design', 'under_review')
            )::integer AS draft_service_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE COALESCE(sc.lifecycle_stage_code, sc.lifecycle_state) IN ('active', 'live', 'approved', 'production')
            )::integer AS active_service_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE COALESCE(sc.lifecycle_stage_code, sc.lifecycle_state) IN ('retiring', 'deprecated')
            )::integer AS retiring_service_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE COALESCE(sc.lifecycle_stage_code, sc.lifecycle_state) = 'retired'
            )::integer AS retired_service_count,
            COUNT(DISTINCT sc.id) FILTER (WHERE sc.requestable = TRUE)::integer AS requestable_service_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE COALESCE(sc.review_due_at, sc.next_review_due_at) IS NOT NULL
                  AND COALESCE(sc.review_due_at, sc.next_review_due_at) < CURRENT_TIMESTAMP
            )::integer AS overdue_review_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${dueSoonReviewCondition('sc')}
            )::integer AS due_soon_review_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${missingOwnerCondition('sc')}
            )::integer AS missing_owner_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${readinessBlockedCondition('sc')}
            )::integer AS readiness_blocker_count,
            COUNT(DISTINCT d.node_page_id) FILTER (
                WHERE ${capabilityGapCondition('d')}
            )::integer AS capability_gap_count,
            COUNT(DISTINCT gr.id)::integer AS active_governance_review_count,
            MAX(gd.decided_at) AS last_decision_at
        FROM l2_portfolios p
        LEFT JOIN portfolio_descendants d
            ON d.portfolio_id = p.id
        LEFT JOIN data.service_c3_mapping scm
            ON scm.c3_uuid = d.node_uuid
        LEFT JOIN data.service_catalog sc
            ON sc.id = scm.service_id
           AND sc.is_deleted = FALSE
           AND sc.is_stub = FALSE
        LEFT JOIN data.governance_review gr
            ON gr.service_id = sc.id
           AND gr.status IN ('pending', 'in_review', 'deferred')
        LEFT JOIN data.governance_decision gd
            ON gd.service_id = sc.id
    `;
}

function portfolioGroupBy() {
    return `
        GROUP BY
            p.id,
            p.portfolio_code,
            p.portfolio_uuid,
            p.title,
            p.description,
            p.status_code,
            p.owner_group_id,
            p.owner_group_name,
            p.portfolio_level,
            p.spiral_code,
            p.created_at,
            p.updated_at
    `;
}

function activeServiceCondition(alias = 'sc') {
    return `COALESCE(${alias}.lifecycle_stage_code, ${alias}.lifecycle_state) IN ('active', 'live', 'approved', 'production')`;
}

function plannedServiceCondition(alias = 'sc') {
    return `COALESCE(${alias}.lifecycle_stage_code, ${alias}.lifecycle_state) IN ('draft', 'design', 'under_review', 'planned', 'planning')`;
}

function retiringServiceCondition(alias = 'sc') {
    return `COALESCE(${alias}.lifecycle_stage_code, ${alias}.lifecycle_state) IN ('retiring', 'deprecated', 'retired')`;
}

function overdueReviewCondition(alias = 'sc') {
    return `COALESCE(${alias}.review_due_at, ${alias}.next_review_due_at) IS NOT NULL
            AND COALESCE(${alias}.review_due_at, ${alias}.next_review_due_at) < CURRENT_TIMESTAMP`;
}

function dueSoonReviewCondition(alias = 'sc') {
    return `COALESCE(${alias}.review_due_at, ${alias}.next_review_due_at) IS NOT NULL
            AND COALESCE(${alias}.review_due_at, ${alias}.next_review_due_at) >= CURRENT_TIMESTAMP
            AND COALESCE(${alias}.review_due_at, ${alias}.next_review_due_at) < CURRENT_TIMESTAMP + INTERVAL '90 days'`;
}

function missingOwnerCondition(alias = 'sc') {
    return `NOT EXISTS (
                SELECT 1
                FROM data.service_role_assignment sra_owner
                WHERE sra_owner.service_id = ${alias}.id
                  AND sra_owner.role_code = 'service_owner'
                  AND sra_owner.valid_to IS NULL
            )`;
}

function readinessBlockedCondition(alias = 'sc') {
    return `COALESCE(${alias}.completeness_score, 0) < 50`;
}

function capabilityGapCondition(alias = 'd') {
    return `${alias}.node_level > p.portfolio_level
            AND NOT EXISTS (
                SELECT 1
                FROM data.service_c3_mapping scm_gap
                JOIN data.service_catalog sc_gap
                  ON sc_gap.id = scm_gap.service_id
                 AND sc_gap.is_deleted = FALSE
                 AND sc_gap.is_stub = FALSE
                WHERE scm_gap.c3_uuid = ${alias}.node_uuid
            )`;
}

async function list({ status, ownerGroupId, lifecycle } = {}) {
    const filters = [];
    const values = [];

    function bind(value) {
        values.push(value);
        return `$${values.length}`;
    }

    const normalizedStatus = normalizeText(status);
    if (normalizedStatus) {
        filters.push(`p.status_code = ${bind(normalizedStatus)}`);
    }

    const parsedOwnerGroupId = toInteger(ownerGroupId);
    if (parsedOwnerGroupId != null) {
        filters.push(`p.owner_group_id = ${bind(parsedOwnerGroupId)}`);
    }

    const normalizedLifecycle = normalizeText(lifecycle);
    if (normalizedLifecycle) {
        filters.push(`EXISTS (
            SELECT 1
            FROM portfolio_descendants d_filter
            JOIN data.service_c3_mapping scm_filter
              ON scm_filter.c3_uuid = d_filter.node_uuid
            JOIN data.service_catalog sc_filter
              ON sc_filter.id = scm_filter.service_id
             AND sc_filter.is_deleted = FALSE
             AND sc_filter.is_stub = FALSE
            WHERE d_filter.portfolio_id = p.id
              AND COALESCE(sc_filter.lifecycle_stage_code, sc_filter.lifecycle_state) = ${bind(normalizedLifecycle)}
        )`);
    }

    const result = await getPool().query(`
        ${c3PortfolioCte()}
        ${portfolioSelect()}
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ${portfolioGroupBy()}
        HAVING
            COUNT(DISTINCT d.node_page_id) FILTER (WHERE d.node_level > p.portfolio_level) > 0
            OR COUNT(DISTINCT sc.id) > 0
        ORDER BY p.title, p.portfolio_code
    `, values);

    return result.rows;
}

function portfolioServiceScopeCte() {
    return `
        ${c3PortfolioCte()},
        portfolio_services AS (
            SELECT DISTINCT
                sc.id,
                sc.service_id,
                sc.title,
                sc.service_type_code AS service_type,
                sc.service_status_code AS service_status,
                COALESCE(sc.lifecycle_stage_code, sc.lifecycle_state) AS lifecycle_stage_code,
                sc.lifecycle_state,
                sc.criticality_code,
                sc.completeness_score,
                COALESCE(sc.review_due_at, sc.next_review_due_at) AS review_due_at,
                sc.requestable,
                sc.portfolio_group_code AS portfolio_group,
                (
                    SELECT COUNT(DISTINCT scm_count.c3_uuid)::integer
                    FROM data.service_c3_mapping scm_count
                    WHERE scm_count.service_id = sc.id
                ) AS c3_mapping_count,
                (
                    SELECT MAX(ct_primary.title)
                    FROM data.service_c3_mapping scm_primary
                    LEFT JOIN data.c3_taxonomy ct_primary
                      ON ct_primary.uuid = scm_primary.c3_uuid
                    WHERE scm_primary.service_id = sc.id
                      AND scm_primary.is_primary = TRUE
                ) AS primary_capability_title,
                (
                    SELECT MAX(ct_primary.external_id)
                    FROM data.service_c3_mapping scm_primary
                    LEFT JOIN data.c3_taxonomy ct_primary
                      ON ct_primary.uuid = scm_primary.c3_uuid
                    WHERE scm_primary.service_id = sc.id
                      AND scm_primary.is_primary = TRUE
                ) AS primary_capability_code,
                (
                    SELECT display_name
                    FROM data.service_role_assignment
                    WHERE service_id = sc.id
                      AND role_code = 'service_owner'
                      AND valid_to IS NULL
                    LIMIT 1
                ) AS service_owner,
                (${missingOwnerCondition('sc')}) AS owner_missing,
                (${readinessBlockedCondition('sc')}) AS readiness_blocked,
                (${dueSoonReviewCondition('sc')}) AS review_due_soon,
                (
                    SELECT COUNT(*)::integer
                    FROM data.governance_review gr_count
                    WHERE gr_count.service_id = sc.id
                      AND gr_count.status IN ('pending', 'in_review', 'deferred')
                ) AS active_review_count,
                (
                    SELECT gd_latest.decision
                    FROM data.governance_decision gd_latest
                    WHERE gd_latest.service_id = sc.id
                    ORDER BY gd_latest.decided_at DESC, gd_latest.id DESC
                    LIMIT 1
                ) AS last_decision,
                (
                    SELECT gd_latest.decided_at
                    FROM data.governance_decision gd_latest
                    WHERE gd_latest.service_id = sc.id
                    ORDER BY gd_latest.decided_at DESC, gd_latest.id DESC
                    LIMIT 1
                ) AS last_decision_at
            FROM l2_portfolios p
            JOIN portfolio_descendants d
              ON d.portfolio_id = p.id
            JOIN data.service_c3_mapping scm
              ON scm.c3_uuid = d.node_uuid
            JOIN data.service_catalog sc
              ON sc.id = scm.service_id
             AND sc.is_deleted = FALSE
             AND sc.is_stub = FALSE
        )
    `;
}

function portfolioServiceFilter(filter) {
    if (filter === 'active') return activeServiceCondition('portfolio_services');
    if (filter === 'planned') return plannedServiceCondition('portfolio_services');
    if (filter === 'retiring') return retiringServiceCondition('portfolio_services');
    if (filter === 'requestable') return 'portfolio_services.requestable = TRUE';
    if (filter === 'overdue') return 'portfolio_services.review_due_at IS NOT NULL AND portfolio_services.review_due_at < CURRENT_TIMESTAMP';
    if (filter === 'due_soon') return 'portfolio_services.review_due_soon = TRUE';
    if (filter === 'missing_owner') return 'portfolio_services.owner_missing = TRUE';
    if (filter === 'readiness_blocked') return 'portfolio_services.readiness_blocked = TRUE';
    return 'TRUE';
}

async function listServices({ filter } = {}) {
    const normalizedFilter = normalizeText(filter);
    const filterClause = portfolioServiceFilter(normalizedFilter);

    const totalsResult = await getPool().query(`
        ${portfolioServiceScopeCte()}
        SELECT
            COUNT(*)::integer AS service_count,
            COUNT(*) FILTER (WHERE ${activeServiceCondition('portfolio_services')})::integer AS active_service_count,
            COUNT(*) FILTER (WHERE ${plannedServiceCondition('portfolio_services')})::integer AS planned_service_count,
            COUNT(*) FILTER (WHERE ${retiringServiceCondition('portfolio_services')})::integer AS retiring_service_count,
            COUNT(*) FILTER (WHERE portfolio_services.requestable = TRUE)::integer AS requestable_service_count,
            COUNT(*) FILTER (
                WHERE portfolio_services.review_due_at IS NOT NULL
                  AND portfolio_services.review_due_at < CURRENT_TIMESTAMP
            )::integer AS overdue_review_count,
            COUNT(*) FILTER (WHERE portfolio_services.review_due_soon = TRUE)::integer AS due_soon_review_count,
            COUNT(*) FILTER (WHERE portfolio_services.owner_missing = TRUE)::integer AS missing_owner_count,
            COUNT(*) FILTER (WHERE portfolio_services.readiness_blocked = TRUE)::integer AS readiness_blocker_count,
            COALESCE(SUM(portfolio_services.active_review_count), 0)::integer AS active_governance_review_count
        FROM portfolio_services
    `);

    const servicesResult = await getPool().query(`
        ${portfolioServiceScopeCte()}
        SELECT *
        FROM portfolio_services
        WHERE ${filterClause}
        ORDER BY title, service_id
    `);

    return {
        items: servicesResult.rows,
        count: servicesResult.rows.length,
        totals: totalsResult.rows[0] ?? {
            service_count: 0,
            active_service_count: 0,
            requestable_service_count: 0,
            overdue_review_count: 0,
            due_soon_review_count: 0,
            missing_owner_count: 0,
            readiness_blocker_count: 0,
            active_governance_review_count: 0,
        },
        filter: normalizedFilter || 'all',
    };
}

async function listCapabilities() {
    const result = await getPool().query(`
        ${c3PortfolioCte()}
        SELECT
            b.id,
            b.page_id AS capability_code,
            b.uuid AS capability_uuid,
            b.title AS capability_title,
            b.level AS capability_level,
            b.parent_id,
            COALESCE(b.state, 'active') AS status_code,
            p.portfolio_code AS parent_portfolio_code,
            p.portfolio_uuid AS parent_portfolio_uuid,
            p.title AS parent_portfolio_title,
            p.status_code AS parent_status_code,
            p.spiral_code,
            COUNT(DISTINCT sc.id)::integer AS service_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${activeServiceCondition('sc')}
            )::integer AS active_service_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${plannedServiceCondition('sc')}
            )::integer AS planned_service_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${retiringServiceCondition('sc')}
            )::integer AS retiring_service_count,
            COUNT(DISTINCT sc.id) FILTER (WHERE sc.requestable = TRUE)::integer AS requestable_service_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${overdueReviewCondition('sc')}
            )::integer AS overdue_review_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${dueSoonReviewCondition('sc')}
            )::integer AS due_soon_review_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${missingOwnerCondition('sc')}
            )::integer AS missing_owner_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${readinessBlockedCondition('sc')}
            )::integer AS readiness_blocker_count,
            COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', service_item.id,
                        'service_id', service_item.service_id,
                        'title', service_item.title,
                        'service_type', service_item.service_type,
                        'service_status', service_item.service_status,
                        'lifecycle_stage_code', service_item.lifecycle_stage_code,
                        'criticality_code', service_item.criticality_code,
                        'completeness_score', service_item.completeness_score,
                        'review_due_at', service_item.review_due_at,
                        'requestable', service_item.requestable,
                        'service_owner', service_item.service_owner,
                        'owner_missing', service_item.owner_missing,
                        'readiness_blocked', service_item.readiness_blocked,
                        'review_due_soon', service_item.review_due_soon
                    )
                    ORDER BY service_item.title, service_item.service_id
                )
                FROM (
                    SELECT DISTINCT
                        sc_service.id,
                        sc_service.service_id,
                        sc_service.title,
                        sc_service.service_type_code AS service_type,
                        sc_service.service_status_code AS service_status,
                        COALESCE(sc_service.lifecycle_stage_code, sc_service.lifecycle_state) AS lifecycle_stage_code,
                        sc_service.criticality_code,
                        sc_service.completeness_score,
                        COALESCE(sc_service.review_due_at, sc_service.next_review_due_at) AS review_due_at,
                        sc_service.requestable,
                        (
                            SELECT display_name
                            FROM data.service_role_assignment
                            WHERE service_id = sc_service.id
                              AND role_code = 'service_owner'
                              AND valid_to IS NULL
                            LIMIT 1
                        ) AS service_owner,
                        (${missingOwnerCondition('sc_service')}) AS owner_missing,
                        (${readinessBlockedCondition('sc_service')}) AS readiness_blocked,
                        (${dueSoonReviewCondition('sc_service')}) AS review_due_soon
                    FROM data.service_c3_mapping scm_service
                    JOIN data.service_catalog sc_service
                      ON sc_service.id = scm_service.service_id
                     AND sc_service.is_deleted = FALSE
                     AND sc_service.is_stub = FALSE
                    WHERE scm_service.c3_uuid = b.uuid
                ) service_item
            ), '[]'::jsonb) AS services
        FROM l2_portfolios p
        JOIN portfolio_descendants d
          ON d.portfolio_id = p.id
         AND d.node_level = 3
        JOIN data.c3_capability_builder b
          ON b.page_id = d.node_page_id
         AND b.domain_code = 'Capabilities'
         AND b.level = 3
         AND lower(COALESCE(b.state, 'active')) NOT IN ('deleted', 'removed')
        LEFT JOIN data.service_c3_mapping scm
          ON scm.c3_uuid = b.uuid
        LEFT JOIN data.service_catalog sc
          ON sc.id = scm.service_id
         AND sc.is_deleted = FALSE
         AND sc.is_stub = FALSE
        GROUP BY
            b.id,
            b.page_id,
            b.uuid,
            b.title,
            b.level,
            b.parent_id,
            b.state,
            p.portfolio_code,
            p.portfolio_uuid,
            p.title,
            p.status_code,
            p.spiral_code
        ORDER BY
            lower(COALESCE(b.state, p.status_code, 'active')),
            p.spiral_code NULLS LAST,
            p.title,
            b.title,
            b.page_id
    `);

    return result.rows.map((row) => ({
        ...row,
        source_kind: 'c3_level3_capability',
        is_empty: Number(row.service_count ?? 0) === 0,
    }));
}

async function getByCode(code) {
    const portfolioCode = normalizeText(code);
    if (!portfolioCode) return null;

    const portfolioResult = await getPool().query(`
        ${c3PortfolioCte({ selectedOnly: true })}
        ${portfolioSelect()}
        ${portfolioGroupBy()}
        LIMIT 1
    `, [portfolioCode]);

    const portfolio = portfolioResult.rows[0];
    if (!portfolio) return null;

    const servicesResult = await getPool().query(`
        ${c3PortfolioCte({ selectedOnly: true })}
        SELECT
            sc.id,
            sc.service_id,
            sc.title,
            sc.service_type_code AS service_type,
            sc.service_status_code AS service_status,
            COALESCE(sc.lifecycle_stage_code, sc.lifecycle_state) AS lifecycle_stage_code,
            sc.criticality_code,
            sc.completeness_score,
            COALESCE(sc.review_due_at, sc.next_review_due_at) AS review_due_at,
            sc.requestable,
            COUNT(DISTINCT scm.c3_uuid)::integer AS c3_mapping_count,
            MAX(ct.title) FILTER (WHERE scm.is_primary = TRUE) AS primary_capability_title,
            MAX(ct.external_id) FILTER (WHERE scm.is_primary = TRUE) AS primary_capability_code,
            (
                SELECT display_name
                FROM data.service_role_assignment
                WHERE service_id = sc.id
                  AND role_code = 'service_owner'
                  AND valid_to IS NULL
                LIMIT 1
            ) AS service_owner,
            (${missingOwnerCondition('sc')}) AS owner_missing,
            (${readinessBlockedCondition('sc')}) AS readiness_blocked,
            (${dueSoonReviewCondition('sc')}) AS review_due_soon,
            (
                SELECT COUNT(*)::integer
                FROM data.governance_review gr_count
                WHERE gr_count.service_id = sc.id
                  AND gr_count.status IN ('pending', 'in_review', 'deferred')
            ) AS active_review_count,
            (
                SELECT gd_latest.decision
                FROM data.governance_decision gd_latest
                WHERE gd_latest.service_id = sc.id
                ORDER BY gd_latest.decided_at DESC, gd_latest.id DESC
                LIMIT 1
            ) AS last_decision,
            (
                SELECT gd_latest.decided_at
                FROM data.governance_decision gd_latest
                WHERE gd_latest.service_id = sc.id
                ORDER BY gd_latest.decided_at DESC, gd_latest.id DESC
                LIMIT 1
            ) AS last_decision_at
        FROM l2_portfolios p
        JOIN portfolio_descendants d
            ON d.portfolio_id = p.id
        JOIN data.service_c3_mapping scm
            ON scm.c3_uuid = d.node_uuid
        JOIN data.service_catalog sc
            ON sc.id = scm.service_id
           AND sc.is_deleted = FALSE
           AND sc.is_stub = FALSE
        LEFT JOIN data.c3_taxonomy ct
            ON ct.uuid = scm.c3_uuid
        GROUP BY
            sc.id,
            sc.service_id,
            sc.title,
            sc.service_type_code,
            sc.service_status_code,
            sc.lifecycle_stage_code,
            sc.lifecycle_state,
            sc.criticality_code,
            sc.completeness_score,
            sc.review_due_at,
            sc.next_review_due_at,
            sc.requestable
        ORDER BY sc.title, sc.service_id
    `, [portfolioCode]);

    const capabilitiesResult = await getPool().query(`
        ${c3PortfolioCte({ selectedOnly: true })}
        SELECT
            b.id,
            b.page_id AS capability_code,
            b.uuid AS capability_uuid,
            b.title AS capability_title,
            b.level AS capability_level,
            b.parent_id,
            COALESCE(b.state, 'active') AS status_code,
            COUNT(DISTINCT sc.id)::integer AS service_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${activeServiceCondition('sc')}
            )::integer AS active_service_count,
            COUNT(DISTINCT sc.id) FILTER (WHERE sc.requestable = TRUE)::integer AS requestable_service_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${overdueReviewCondition('sc')}
            )::integer AS overdue_review_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${dueSoonReviewCondition('sc')}
            )::integer AS due_soon_review_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${missingOwnerCondition('sc')}
            )::integer AS missing_owner_count,
            COUNT(DISTINCT sc.id) FILTER (
                WHERE ${readinessBlockedCondition('sc')}
            )::integer AS readiness_blocker_count
        FROM l2_portfolios p
        JOIN portfolio_descendants d
            ON d.portfolio_id = p.id
           AND d.node_level > p.portfolio_level
        JOIN data.c3_capability_builder b
            ON b.page_id = d.node_page_id
        LEFT JOIN data.service_c3_mapping scm
            ON scm.c3_uuid = b.uuid
        LEFT JOIN data.service_catalog sc
            ON sc.id = scm.service_id
           AND sc.is_deleted = FALSE
           AND sc.is_stub = FALSE
        GROUP BY
            b.id,
            b.page_id,
            b.uuid,
            b.title,
            b.level,
            b.parent_id,
            b.state
        ORDER BY b.level, b.title, b.page_id
    `, [portfolioCode]);

    return {
        ...portfolio,
        source_kind: 'c3_level2_capability',
        services: servicesResult.rows,
        capabilities: capabilitiesResult.rows,
    };
}

async function create(data) {
    const result = await getPool().query(`
        INSERT INTO data.service_portfolio (
            portfolio_code,
            title,
            description,
            status_code,
            owner_group_id
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING portfolio_code
    `, [
        normalizeText(data.portfolio_code),
        normalizeText(data.title),
        normalizeText(data.description),
        normalizeText(data.status_code) || 'active',
        toInteger(data.owner_group_id),
    ]);

    return getByCode(result.rows[0].portfolio_code);
}

async function update(code, data) {
    const values = [normalizeText(code)];
    const setClauses = ['updated_at = CURRENT_TIMESTAMP'];
    const fieldMap = {
        title: 'title',
        description: 'description',
        status_code: 'status_code',
        owner_group_id: 'owner_group_id',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        const rawValue = key === 'owner_group_id' ? toInteger(data[key]) : normalizeText(data[key]);
        values.push(rawValue);
        setClauses.push(`${column} = $${values.length}`);
    }

    if (setClauses.length === 1) {
        return getByCode(values[0]);
    }

    await getPool().query(`
        UPDATE data.service_portfolio
        SET ${setClauses.join(', ')}
        WHERE portfolio_code = $1
    `, values);

    return getByCode(values[0]);
}

module.exports = {
    list,
    listServices,
    listCapabilities,
    getByCode,
    create,
    update,
};
