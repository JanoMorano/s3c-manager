'use strict';

const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { getPool } = require('../../db/pool');
const { isModuleApiEnabled } = require('../../middleware/module-gates');
const { MODULE_CODES } = require('../manifest');
const {
    buildGroupedSearchResponse,
    buildHelpSearchGroup,
    buildStaticPageSearchGroups,
    createSearchGroup,
    tokenizeSearchQuery,
} = require('../search/global-search-groups');
const { listLevel3Capabilities } = require('../../utils/capability-slug');
const { resolveRequestLocale } = require('../../utils/i18n');

const router = express.Router();

function parseLimit(value, fallback = 10, min = 1, max = 25) {
    const parsed = parseInt(String(value ?? fallback), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function trimDescription(value, maxLength = 240) {
    if (value == null) return null;
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function tokenizeSqlSearchQuery(query) {
    const normalizedTokens = tokenizeSearchQuery(query);
    const rawParts = String(query ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const seen = new Set();
    const tokens = [];

    for (const part of rawParts) {
        const normalized = tokenizeSearchQuery(part)[0] || part;
        if (part.length < 2 && !/^\d$/.test(part)) continue;
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        tokens.push(part);
        if (tokens.length >= normalizedTokens.length && tokens.length >= 8) break;
    }

    return tokens.length > 0 ? tokens : normalizedTokens;
}

function buildTokenPredicate(columns, tokenCount, startIndex = 1) {
    if (tokenCount <= 0) return 'FALSE';

    return Array.from({ length: tokenCount }, (_, tokenIndex) => {
        const placeholder = `$${startIndex + tokenIndex}`;
        return `(${columns.map((column) => `COALESCE(${column}::text, '') ILIKE ${placeholder}`).join(' OR ')})`;
    }).join('\n                    AND ');
}

function buildSearchParameters(query, limit) {
    const tokens = tokenizeSqlSearchQuery(query);
    return {
        tokens,
        params: [
            ...tokens.map((token) => `%${token}%`),
            query,
            limit,
        ],
        exactPlaceholder: `$${tokens.length + 1}`,
        limitPlaceholder: `$${tokens.length + 2}`,
    };
}

function normalizeRows(rows) {
    return rows.map((row) => ({
        source_key: row.source_key,
        code: row.code,
        title: row.title,
        description: trimDescription(row.description),
        subtitle: row.subtitle ?? null,
        status: row.status ?? null,
        href: row.href,
    }));
}

router.use(requireAuth);

router.get('/', async (req, res, next) => {
    try {
        const query = String(req.query.q ?? '').trim();
        const type = String(req.query.type ?? 'any').trim();
        const limit = parseLimit(req.query.limit, 10, 1, 20);
        if (!query) {
            return res.json({ query, type, groups: { services: [], capabilities: [], frameworks: [] }, total: 0 });
        }
        const likeValue = `%${query}%`;
        const pool = getPool();
        const [servicesResult, capabilities] = await Promise.all([
            pool.query(`
                SELECT
                    sc.service_id AS source_key,
                    sc.service_id AS code,
                    sc.title,
                    COALESCE(sc.short_description, sc.description, sc.value_proposition, sc.business_purpose) AS subtitle,
                    CONCAT('/services/', sc.service_id) AS href,
                    ARRAY['consumer','service_owner','capability_manager','admin']::text[] AS persona_visibility
                FROM data.service_catalog sc
                WHERE sc.is_deleted = FALSE
                  AND sc.is_stub = FALSE
                  AND (
                      sc.service_id ILIKE $1
                      OR sc.title ILIKE $1
                      OR COALESCE(sc.short_description, '') ILIKE $1
                      OR COALESCE(sc.description, '') ILIKE $1
                  )
                ORDER BY CASE WHEN sc.service_id = $2 THEN 0 WHEN sc.title = $2 THEN 1 ELSE 2 END, sc.title
                LIMIT $3
            `, [likeValue, query, limit]),
            listLevel3Capabilities(pool),
        ]);
        const q = query.toLowerCase();
        const capabilityRows = capabilities
            .filter((capability) => [
                capability.title,
                capability.page_id,
                capability.abbreviation,
                capability.slug,
                capability.parent?.title,
            ].some((value) => String(value ?? '').toLowerCase().includes(q)))
            .slice(0, limit)
            .map((capability) => ({
                source_key: capability.uuid,
                code: capability.page_id,
                title: capability.title,
                subtitle: capability.parent?.title ?? 'Capability',
                href: `/capabilities/${capability.slug}`,
                score: capability.slug === q || capability.page_id?.toLowerCase() === q ? 100 : 60,
                matched_fields: ['title', 'page_id', 'abbreviation', 'slug'],
                persona_visibility: ['service_owner', 'capability_manager', 'admin'],
            }));
        const serviceRows = servicesResult.rows.map((row) => ({
            ...row,
            score: row.code?.toLowerCase() === q ? 100 : 70,
            matched_fields: ['service_id', 'title', 'description'],
        }));
        const frameworkRows = capabilityRows
            .filter((row) => row.code === 'CP-1004' || row.title.toLowerCase().includes('air'))
            .map((row) => ({
                ...row,
                source_key: `framework:${row.code}`,
                title: `${row.title} Framework`,
                href: `${row.href}?spiral=Spiral_7`,
                persona_visibility: ['capability_manager', 'admin'],
            }));
        const groups = {
            services: serviceRows,
            capabilities: capabilityRows,
            frameworks: frameworkRows,
        };
        res.json({
            query,
            type,
            groups,
            total: Object.values(groups).reduce((sum, rows) => sum + rows.length, 0),
        });
    } catch (err) { next(err); }
});

async function respondGlobalSearch(req, res, next) {
    try {
        const query = String(req.query.q ?? '').trim();
        const limit = parseLimit(req.query.limit);
        const canSeeBuilder = req.user?.role === 'admin' || req.user?.role === 'editor';
        const c3Enabled = await isModuleApiEnabled(MODULE_CODES.C3);
        const managementEnabled = await isModuleApiEnabled(MODULE_CODES.MANAGEMENT);

        if (!query) {
            return res.json({
                query: '',
                total: 0,
                groups: [],
            });
        }

        const pool = getPool();
        const {
            tokens,
            params: searchParams,
            exactPlaceholder,
            limitPlaceholder,
        } = buildSearchParameters(query, limit);

        if (tokens.length === 0) {
            return res.json({
                query,
                total: 0,
                groups: [],
            });
        }

        const tokenCount = tokens.length;
        const servicePredicate = buildTokenPredicate([
            'sc.service_id',
            'sc.title',
            'sc.short_description',
            'sc.description',
            'sc.value_proposition',
            'sc.service_features',
            'sc.business_summary',
            'sc.business_purpose',
            'sc.target_audience_summary',
            'sc.consumer_value',
            'sc.scope_text',
            'sc.ordering_note',
            'sc.operational_notes_raw',
            'sc.request_process_raw',
            'sc.additional_information_raw',
            'sc.service_area_raw',
            'sc.service_line_code',
            'sc.portfolio_group_code',
            'sc.global_service_group_code',
            'sc.service_type_code',
            'sc.service_status_code',
            'sc.customer_type_json',
            'sc.options_json',
            'sc.notes_json',
            'sc.training_refs_json',
            'sc.prerequisites_json',
            'sc.dependencies_json',
        ], tokenCount);
        const taxonomyPredicate = buildTokenPredicate([
            'ct.external_id',
            'ct.uuid',
            'ct.title',
            'ct.item_type',
            'ct.application',
            'ct.item_status',
            'ct.description',
            'ct.source_description',
            'ct.revised_description',
        ], tokenCount);
        const c3ServicePredicate = buildTokenPredicate([
            's.service_code',
            's.uuid',
            's.title',
            's.item_status',
            's.data_source',
            's.description',
            's.source_description',
            's.revised_description',
        ], tokenCount);
        const c3ApplicationPredicate = buildTokenPredicate([
            'a.application_code',
            'a.uuid',
            'a.title',
            'a.item_status',
            'a.data_source',
            'a.description',
            'a.source_description',
            'a.revised_description',
        ], tokenCount);
        const c3DataObjectPredicate = buildTokenPredicate([
            'd.data_object_code',
            'd.uuid',
            'd.title',
            'd.item_status',
            'd.description',
            'd.provenance_raw',
            'd.references_raw',
        ], tokenCount);
        const c3TechnologyPredicate = buildTokenPredicate([
            'ti.technology_interaction_code',
            'ti.uuid',
            'ti.title',
            'ti.technology_interaction_type',
            'ti.item_status',
            'ti.description',
            'ti.service_instructions',
            'ti.conditionality',
        ], tokenCount);
        const capabilityBuilderPredicate = buildTokenPredicate([
            'b.page_id',
            'b.uuid',
            'b.title',
            'b.domain_code',
            'b.parent_id',
            'b.parent_title',
            'b.state',
        ], tokenCount);
        const portfolioPredicate = buildTokenPredicate([
            'sp.portfolio_code',
            'sp.title',
            'sp.description',
            'sp.status_code',
        ], tokenCount);
        const reviewPredicate = buildTokenPredicate([
            'sc.service_id',
            'sc.title',
            'gr.review_type',
            'gr.status',
            'gr.requested_by',
            'gr.assigned_to',
        ], tokenCount);
        const decisionPredicate = buildTokenPredicate([
            'sc.service_id',
            'sc.title',
            'gd.decision_type',
            'gd.decision',
            'gd.rationale',
        ], tokenCount);
        const readinessPredicate = buildTokenPredicate([
            'rr.rule_key',
            'rr.title',
            'rr.description',
            'rr.severity',
        ], tokenCount);

        const [
            servicesResult,
            taxonomyResult,
            c3ServicesResult,
            c3ApplicationsResult,
            c3DataObjectsResult,
            c3TechnologyInteractionsResult,
            capabilityBuilder2Result,
            managementResult,
        ] = await Promise.all([
            pool.query(`
                SELECT
                    'service_catalogue' AS source_key,
                    sc.service_id AS code,
                    sc.title,
                    COALESCE(sc.short_description, sc.description, sc.value_proposition, sc.business_purpose) AS description,
                    CONCAT(COALESCE(sc.service_status_code, '—'), ' · ', COALESCE(sc.service_type_code, '—')) AS subtitle,
                    sc.service_status_code AS status,
                    CONCAT('/services/', sc.service_id) AS href
                FROM data.service_catalog sc
                WHERE sc.is_deleted = FALSE
                  AND (${servicePredicate})
                ORDER BY
                    CASE
                        WHEN sc.service_id ILIKE ${exactPlaceholder} THEN 0
                        WHEN sc.title ILIKE ${exactPlaceholder} THEN 1
                        ELSE 2
                    END,
                    sc.service_id
                LIMIT ${limitPlaceholder}
            `, searchParams),
            c3Enabled ? pool.query(`
                SELECT
                    'c3_taxonomy' AS source_key,
                    COALESCE(ct.external_id, ct.uuid) AS code,
                    ct.title,
                    COALESCE(ct.revised_description, ct.description, ct.source_description) AS description,
                    CONCAT(COALESCE(ct.item_type, 'C3'), CASE WHEN ct.application IS NOT NULL THEN CONCAT(' · ', ct.application) ELSE '' END) AS subtitle,
                    ct.item_status AS status,
                    CONCAT('/c3/', ct.uuid) AS href
                FROM data.c3_taxonomy ct
                WHERE ${taxonomyPredicate}
                ORDER BY
                    CASE
                        WHEN COALESCE(ct.external_id, '') ILIKE ${exactPlaceholder} THEN 0
                        WHEN ct.uuid::text ILIKE ${exactPlaceholder} THEN 1
                        WHEN ct.title ILIKE ${exactPlaceholder} THEN 2
                        ELSE 3
                    END,
                    ct.external_id,
                    ct.title
                LIMIT ${limitPlaceholder}
            `, searchParams) : Promise.resolve({ rows: [] }),
            c3Enabled ? pool.query(`
                SELECT
                    'c3_services' AS source_key,
                    s.service_code AS code,
                    s.title,
                    COALESCE(s.description, s.source_description, s.revised_description) AS description,
                    COALESCE(s.data_source, 'C3 Service') AS subtitle,
                    s.item_status AS status,
                    CONCAT('/c3/services/', s.service_code) AS href
                FROM data.c3_service s
                WHERE ${c3ServicePredicate}
                ORDER BY
                    CASE
                        WHEN s.service_code ILIKE ${exactPlaceholder} THEN 0
                        WHEN s.uuid::text ILIKE ${exactPlaceholder} THEN 1
                        WHEN s.title ILIKE ${exactPlaceholder} THEN 2
                        ELSE 3
                    END,
                    s.service_code,
                    s.title
                LIMIT ${limitPlaceholder}
            `, searchParams) : Promise.resolve({ rows: [] }),
            c3Enabled ? pool.query(`
                SELECT
                    'c3_applications' AS source_key,
                    a.application_code AS code,
                    a.title,
                    COALESCE(a.description, a.source_description, a.revised_description) AS description,
                    COALESCE(a.data_source, 'C3 Application') AS subtitle,
                    a.item_status AS status,
                    CONCAT('/c3/applications/', a.application_code) AS href
                FROM data.c3_application a
                WHERE ${c3ApplicationPredicate}
                ORDER BY
                    CASE
                        WHEN a.application_code ILIKE ${exactPlaceholder} THEN 0
                        WHEN a.uuid::text ILIKE ${exactPlaceholder} THEN 1
                        WHEN a.title ILIKE ${exactPlaceholder} THEN 2
                        ELSE 3
                    END,
                    a.application_code,
                    a.title
                LIMIT ${limitPlaceholder}
            `, searchParams) : Promise.resolve({ rows: [] }),
            c3Enabled ? pool.query(`
                SELECT
                    'c3_data_objects' AS source_key,
                    d.data_object_code AS code,
                    d.title,
                    d.description,
                    'C3 Data Object' AS subtitle,
                    d.item_status AS status,
                    CONCAT('/c3/data-objects/', d.data_object_code) AS href
                FROM data.c3_data_object d
                WHERE ${c3DataObjectPredicate}
                ORDER BY
                    CASE
                        WHEN d.data_object_code ILIKE ${exactPlaceholder} THEN 0
                        WHEN d.uuid::text ILIKE ${exactPlaceholder} THEN 1
                        WHEN d.title ILIKE ${exactPlaceholder} THEN 2
                        ELSE 3
                    END,
                    d.data_object_code,
                    d.title
                LIMIT ${limitPlaceholder}
            `, searchParams) : Promise.resolve({ rows: [] }),
            c3Enabled ? pool.query(`
                SELECT
                    'c3_technology_interactions' AS source_key,
                    ti.technology_interaction_code AS code,
                    ti.title,
                    COALESCE(ti.description, ti.service_instructions, ti.conditionality) AS description,
                    COALESCE(ti.technology_interaction_type, 'Technology Interaction') AS subtitle,
                    ti.item_status AS status,
                    CONCAT('/c3/technology-interactions/', ti.technology_interaction_code) AS href
                FROM data.c3_technology_interaction ti
                WHERE ${c3TechnologyPredicate}
                ORDER BY
                    CASE
                        WHEN ti.technology_interaction_code ILIKE ${exactPlaceholder} THEN 0
                        WHEN ti.uuid::text ILIKE ${exactPlaceholder} THEN 1
                        WHEN ti.title ILIKE ${exactPlaceholder} THEN 2
                        ELSE 3
                    END,
                    ti.technology_interaction_code,
                    ti.title
                LIMIT ${limitPlaceholder}
            `, searchParams) : Promise.resolve({ rows: [] }),
            canSeeBuilder && c3Enabled
                ? pool.query(`
                    SELECT
                        'c3_capability_builder' AS source_key,
                        b.page_id AS code,
                        b.title,
                        NULL AS description,
                        CONCAT('L', b.level, ' · ', b.domain_code) AS subtitle,
                        b.state AS status,
                        CONCAT('/administration/c3-capability-builder?search=', b.page_id) AS href
                    FROM data.v_c3capabilitybuilderlist b
                    WHERE ${capabilityBuilderPredicate}
                    ORDER BY
                        CASE
                            WHEN b.page_id ILIKE ${exactPlaceholder} THEN 0
                            WHEN b.uuid::text ILIKE ${exactPlaceholder} THEN 1
                            WHEN b.title ILIKE ${exactPlaceholder} THEN 2
                            ELSE 3
                        END,
                        b.page_id,
                        b.title
                    LIMIT ${limitPlaceholder}
                `, searchParams)
                : Promise.resolve({ rows: [] }),
            managementEnabled ? pool.query(`
                SELECT *
                FROM (
                    SELECT
                        'management_portfolio' AS source_key,
                        sp.portfolio_code AS code,
                        sp.title,
                        sp.description,
                        CONCAT('Portfolio - ', sp.status_code) AS subtitle,
                        sp.status_code AS status,
                        CONCAT('/portfolio/', sp.portfolio_code) AS href
                    FROM data.service_portfolio sp
                    WHERE ${portfolioPredicate}
                    UNION ALL
                    SELECT
                        'management_review' AS source_key,
                        CONCAT('REVIEW-', gr.id) AS code,
                        CONCAT(sc.service_id, ' review: ', gr.review_type) AS title,
                        CONCAT('Requested by ', COALESCE(gr.requested_by, 'unknown'), CASE WHEN gr.assigned_to IS NOT NULL THEN CONCAT(', assigned to ', gr.assigned_to) ELSE '' END) AS description,
                        CONCAT('Governance Review - ', gr.status) AS subtitle,
                        gr.status AS status,
                        CONCAT('/operations/reviews?service_id=', sc.service_id) AS href
                    FROM data.governance_review gr
                    JOIN data.service_catalog sc ON sc.id = gr.service_id
                    WHERE ${reviewPredicate}
                    UNION ALL
                    SELECT
                        'management_decision' AS source_key,
                        CONCAT('DECISION-', gd.id) AS code,
                        CONCAT(sc.service_id, ' decision: ', gd.decision_type) AS title,
                        gd.rationale AS description,
                        CONCAT('Governance Decision - ', gd.decision) AS subtitle,
                        gd.decision AS status,
                        CONCAT('/operations/decisions?service_id=', sc.service_id) AS href
                    FROM data.governance_decision gd
                    JOIN data.service_catalog sc ON sc.id = gd.service_id
                    WHERE ${decisionPredicate}
                    UNION ALL
                    SELECT
                        'management_readiness' AS source_key,
                        rr.rule_key AS code,
                        rr.title,
                        rr.description,
                        CONCAT('Readiness Rule - ', rr.severity) AS subtitle,
                        CASE WHEN rr.enabled THEN 'enabled' ELSE 'disabled' END AS status,
                        '/operations/readiness' AS href
                    FROM data.readiness_rule rr
                    WHERE ${readinessPredicate}
                ) management_search
                ORDER BY
                    CASE
                        WHEN code ILIKE ${exactPlaceholder} THEN 0
                        WHEN title ILIKE ${exactPlaceholder} THEN 1
                        ELSE 2
                    END,
                    title
                LIMIT ${limitPlaceholder}
            `, searchParams) : Promise.resolve({ rows: [] }),
        ]);

        const groups = [
            ...buildStaticPageSearchGroups(query, {
                limit,
                includeC3: c3Enabled,
                includeManagement: managementEnabled,
            }),
            createSearchGroup('service_catalogue', normalizeRows(servicesResult.rows)),
            createSearchGroup('c3_taxonomy', normalizeRows(taxonomyResult.rows)),
            createSearchGroup('c3_services', normalizeRows(c3ServicesResult.rows)),
            createSearchGroup('c3_applications', normalizeRows(c3ApplicationsResult.rows)),
            createSearchGroup('c3_data_objects', normalizeRows(c3DataObjectsResult.rows)),
            createSearchGroup('c3_technology_interactions', normalizeRows(c3TechnologyInteractionsResult.rows)),
            createSearchGroup('c3_capability_builder', normalizeRows(capabilityBuilder2Result.rows)),
            createSearchGroup('management', normalizeRows(managementResult.rows)),
            buildHelpSearchGroup(query, { locale: resolveRequestLocale(req), limit }),
        ];

        res.json(buildGroupedSearchResponse(query, groups));
    } catch (err) {
        next(err);
    }
}

router.get('/global', respondGlobalSearch);
router.get('/suggest', respondGlobalSearch);

module.exports = router;
