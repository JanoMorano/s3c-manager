'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getPool } = require('../db/pool');
const { isModuleApiEnabled } = require('../middleware/module-gates');
const { listLevel3Capabilities } = require('../utils/capability-slug');

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

router.get('/global', async (req, res, next) => {
    try {
        const query = String(req.query.q ?? '').trim();
        const limit = parseLimit(req.query.limit);
        const canSeeBuilder = req.user?.role === 'admin' || req.user?.role === 'editor';
        const c3Enabled = await isModuleApiEnabled('C3_TAXONOMY');

        if (!query) {
            return res.json({
                query: '',
                total: 0,
                groups: [],
            });
        }

        const likeValue = `%${query}%`;
        const pool = getPool();

        const [
            servicesResult,
            taxonomyResult,
            c3ServicesResult,
            c3ApplicationsResult,
            c3DataObjectsResult,
            c3TechnologyInteractionsResult,
            capabilityBuilder2Result,
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
                  AND (
                    sc.service_id ILIKE $1
                    OR sc.title ILIKE $1
                    OR COALESCE(sc.short_description, '') ILIKE $1
                    OR COALESCE(sc.description, '') ILIKE $1
                    OR COALESCE(sc.value_proposition, '') ILIKE $1
                  )
                ORDER BY
                    CASE
                        WHEN sc.service_id = $2 THEN 0
                        WHEN sc.title = $2 THEN 1
                        ELSE 2
                    END,
                    sc.service_id
                LIMIT $3
            `, [likeValue, query, limit]),
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
                WHERE
                    COALESCE(ct.external_id, '') ILIKE $1
                    OR ct.uuid ILIKE $1
                    OR ct.title ILIKE $1
                    OR COALESCE(ct.description, '') ILIKE $1
                    OR COALESCE(ct.source_description, '') ILIKE $1
                    OR COALESCE(ct.revised_description, '') ILIKE $1
                ORDER BY
                    CASE
                        WHEN ct.external_id = $2 THEN 0
                        WHEN ct.uuid = $2 THEN 1
                        WHEN ct.title = $2 THEN 2
                        ELSE 3
                    END,
                    ct.external_id,
                    ct.title
                LIMIT $3
            `, [likeValue, query, limit]) : Promise.resolve({ rows: [] }),
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
                WHERE
                    s.service_code ILIKE $1
                    OR s.uuid ILIKE $1
                    OR s.title ILIKE $1
                    OR COALESCE(s.description, '') ILIKE $1
                    OR COALESCE(s.source_description, '') ILIKE $1
                ORDER BY
                    CASE
                        WHEN s.service_code = $2 THEN 0
                        WHEN s.uuid = $2 THEN 1
                        WHEN s.title = $2 THEN 2
                        ELSE 3
                    END,
                    s.service_code,
                    s.title
                LIMIT $3
            `, [likeValue, query, limit]) : Promise.resolve({ rows: [] }),
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
                WHERE
                    a.application_code ILIKE $1
                    OR a.uuid ILIKE $1
                    OR a.title ILIKE $1
                    OR COALESCE(a.description, '') ILIKE $1
                    OR COALESCE(a.source_description, '') ILIKE $1
                ORDER BY
                    CASE
                        WHEN a.application_code = $2 THEN 0
                        WHEN a.uuid = $2 THEN 1
                        WHEN a.title = $2 THEN 2
                        ELSE 3
                    END,
                    a.application_code,
                    a.title
                LIMIT $3
            `, [likeValue, query, limit]) : Promise.resolve({ rows: [] }),
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
                WHERE
                    d.data_object_code ILIKE $1
                    OR d.uuid ILIKE $1
                    OR d.title ILIKE $1
                    OR COALESCE(d.description, '') ILIKE $1
                    OR COALESCE(d.provenance_raw, '') ILIKE $1
                    OR COALESCE(d.references_raw, '') ILIKE $1
                ORDER BY
                    CASE
                        WHEN d.data_object_code = $2 THEN 0
                        WHEN d.uuid = $2 THEN 1
                        WHEN d.title = $2 THEN 2
                        ELSE 3
                    END,
                    d.data_object_code,
                    d.title
                LIMIT $3
            `, [likeValue, query, limit]) : Promise.resolve({ rows: [] }),
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
                WHERE
                    ti.technology_interaction_code ILIKE $1
                    OR ti.uuid ILIKE $1
                    OR ti.title ILIKE $1
                    OR COALESCE(ti.description, '') ILIKE $1
                    OR COALESCE(ti.service_instructions, '') ILIKE $1
                    OR COALESCE(ti.conditionality, '') ILIKE $1
                ORDER BY
                    CASE
                        WHEN ti.technology_interaction_code = $2 THEN 0
                        WHEN ti.uuid = $2 THEN 1
                        WHEN ti.title = $2 THEN 2
                        ELSE 3
                    END,
                    ti.technology_interaction_code,
                    ti.title
                LIMIT $3
            `, [likeValue, query, limit]) : Promise.resolve({ rows: [] }),
            canSeeBuilder && c3Enabled
                ? pool.query(`
                    SELECT
                        'c3_capability_builder' AS source_key,
                        b.page_id AS code,
                        b.title,
                        NULL AS description,
                        CONCAT('L', b.level, ' · ', b.domain_code) AS subtitle,
                        b.state AS status,
                        CONCAT('/admin/c3-capability-builder?search=', b.page_id) AS href
                    FROM data.v_c3capabilitybuilderlist b
                    WHERE
                        b.page_id ILIKE $1
                        OR b.uuid ILIKE $1
                        OR b.title ILIKE $1
                        OR COALESCE(b.parent_id, '') ILIKE $1
                        OR COALESCE(b.parent_title, '') ILIKE $1
                    ORDER BY
                        CASE
                            WHEN b.page_id = $2 THEN 0
                            WHEN b.uuid = $2 THEN 1
                            WHEN b.title = $2 THEN 2
                            ELSE 3
                        END,
                        b.page_id,
                        b.title
                    LIMIT $3
                `, [likeValue, query, limit])
                : Promise.resolve({ rows: [] }),
        ]);

        const groups = [
            { key: 'service_catalogue', label: 'Service Catalogue', items: normalizeRows(servicesResult.rows) },
            { key: 'c3_taxonomy', label: 'C3 Taxonomy', items: normalizeRows(taxonomyResult.rows) },
            { key: 'c3_services', label: 'C3 Services', items: normalizeRows(c3ServicesResult.rows) },
            { key: 'c3_applications', label: 'C3 Applications', items: normalizeRows(c3ApplicationsResult.rows) },
            { key: 'c3_data_objects', label: 'C3 Data Objects', items: normalizeRows(c3DataObjectsResult.rows) },
            { key: 'c3_technology_interactions', label: 'C3 Technology Interactions', items: normalizeRows(c3TechnologyInteractionsResult.rows) },
            { key: 'c3_capability_builder', label: 'C3 Capability Builder', items: normalizeRows(capabilityBuilder2Result.rows) },
        ].filter((group) => group.items.length > 0);

        res.json({
            query,
            total: groups.reduce((sum, group) => sum + group.items.length, 0),
            groups,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
