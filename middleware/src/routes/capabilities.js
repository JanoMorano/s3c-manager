'use strict';

const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { listLevel3Capabilities, resolveSlug } = require('../utils/capability-slug');
const capabilityGovernanceRepo = require('../db/capability-governance.repo');
const { parseIntFilter, parseTextFilter } = require('../utils/query-filters');

const router = express.Router();
router.use(requireAuth);

async function validateSpiral(pool, spiral) {
    const code = String(spiral ?? 'Spiral_7').trim();
    const result = await pool.query('SELECT spiral_code AS code FROM data.ref_spiral_baseline WHERE spiral_code = $1', [code]);
    return result.rows[0]?.code ?? null;
}

function readSpiralQuery(req) {
    return req.query.spiral ?? req.query.spiral_code ?? 'Spiral_7';
}

function readGovernanceFilters(req) {
    return {
        spiral: parseTextFilter(req.query.spiral ?? req.query.spiral_code, { maxLength: 80 }),
        domain: parseTextFilter(req.query.domain, { maxLength: 120 }),
        lifecycle: parseTextFilter(req.query.lifecycle, { maxLength: 80 }),
        owner: parseTextFilter(req.query.owner, { maxLength: 255 }),
        readiness: parseTextFilter(req.query.readiness, { maxLength: 80 }),
        limit: parseIntFilter(req.query.limit, { fallback: 100, min: 1, max: 500 }),
        offset: parseIntFilter(req.query.offset, { fallback: 0, min: 0, max: 100000 }),
    };
}

async function loadRequirements(pool, capabilityUuid, spiralCode) {
    const result = await pool.query(`
        WITH requirements AS (
            SELECT r.*
            FROM data.v_capability_requirement r
            JOIN data.c3_entity_spiral_membership m
              ON m.entity_uuid = r.entity_uuid
             AND m.entity_kind = r.entity_kind
             AND m.status_in_spiral IS DISTINCT FROM 'removed'
             AND m.spiral_code = $2
            WHERE r.capability_uuid = $1
        ),
        coverage AS (
            SELECT
                req.entity_kind,
                req.entity_uuid,
                COALESCE(array_remove(array_agg(DISTINCT sc.service_id ORDER BY sc.service_id), NULL), ARRAY[]::varchar[]) AS covered_by
            FROM requirements req
            LEFT JOIN data.service_c3_mapping scm
              ON scm.c3_uuid = req.capability_uuid OR scm.c3_uuid = req.entity_uuid
            LEFT JOIN data.service_catalog sc
              ON sc.id = scm.service_id
             AND sc.is_deleted = FALSE
             AND sc.is_stub = FALSE
            GROUP BY req.entity_kind, req.entity_uuid
        )
        SELECT req.*, coverage.covered_by
        FROM requirements req
        LEFT JOIN coverage
          ON coverage.entity_kind = req.entity_kind
         AND coverage.entity_uuid = req.entity_uuid
        ORDER BY req.entity_kind, req.code, req.title
    `, [capabilityUuid, spiralCode]);
    return result.rows.map((row) => ({
        code: row.code,
        kind: row.entity_kind,
        uuid: row.entity_uuid,
        title: row.title,
        role: row.link_role ?? 'core',
        covered_by: row.covered_by ?? [],
        evidence: [{ source: 'c3_seed', document_id: row.code ?? row.entity_uuid }],
    }));
}

function summarizeCoverage(requirements) {
    const total = requirements.length;
    const covered = requirements.filter((row) => row.covered_by.length > 0).length;
    return {
        total_requirements: total,
        covered_count: covered,
        coverage_percent: total > 0 ? Math.round((covered / total) * 100) : 0,
    };
}

async function loadServiceCoverage(pool, capabilityUuid, requirements) {
    if (requirements.length === 0) return [];
    const serviceIds = [...new Set(requirements.flatMap((row) => row.covered_by))];
    if (serviceIds.length === 0) return [];
    const result = await pool.query(`
        SELECT service_id, title
        FROM data.service_catalog
        WHERE service_id = ANY($1::varchar[])
          AND is_deleted = FALSE
          AND is_stub = FALSE
        ORDER BY service_id
    `, [serviceIds]);
    const total = requirements.length;
    return result.rows.map((service) => {
        const coveredCount = requirements.filter((row) => row.covered_by.includes(service.service_id)).length;
        return {
            service_id: service.service_id,
            title: service.title,
            covered_count: coveredCount,
            coverage_percent: total > 0 ? Math.round((coveredCount / total) * 100) : 0,
        };
    }).sort((a, b) => b.covered_count - a.covered_count || a.service_id.localeCompare(b.service_id));
}

function buildOverlap(requirements) {
    const serviceIds = [...new Set(requirements.flatMap((row) => row.covered_by))].sort();
    const pairs = [];
    for (let i = 0; i < serviceIds.length; i++) {
        for (let j = i + 1; j < serviceIds.length; j++) {
            const serviceA = serviceIds[i];
            const serviceB = serviceIds[j];
            const aSet = new Set(requirements.filter((row) => row.covered_by.includes(serviceA)).map((row) => `${row.kind}:${row.uuid}`));
            const bSet = new Set(requirements.filter((row) => row.covered_by.includes(serviceB)).map((row) => `${row.kind}:${row.uuid}`));
            const shared = [...aSet].filter((key) => bSet.has(key)).length;
            if (shared === 0) continue;
            const onlyA = [...aSet].filter((key) => !bSet.has(key)).length;
            const onlyB = [...bSet].filter((key) => !aSet.has(key)).length;
            pairs.push({
                service_a_id: serviceA,
                service_b_id: serviceB,
                shared_count: shared,
                only_a: onlyA,
                only_b: onlyB,
                overlap_pct: Math.round((shared / Math.max(aSet.size, bSet.size, 1)) * 100),
            });
        }
    }
    return pairs.sort((a, b) => b.shared_count - a.shared_count || b.overlap_pct - a.overlap_pct).slice(0, 20);
}

function buildEvidenceDocuments(capability, spiral, requirements) {
    const covered = requirements.filter((row) => row.covered_by.length > 0).length;
    return [
        {
            id: `${capability.slug}:${spiral}:c3-seed`,
            title: 'Imported C3 taxonomy and entity evidence',
            kind: 'c3_seed',
            status: 'traceable',
            requirement_count: requirements.length,
        },
        {
            id: `${capability.slug}:${spiral}:spiral-membership`,
            title: `${spiral} entity membership baseline`,
            kind: 'spiral_membership',
            status: 'traceable',
            requirement_count: requirements.length,
        },
        {
            id: `${capability.slug}:${spiral}:service-mapping`,
            title: 'Service catalogue C3 mappings',
            kind: 'service_mapping',
            status: covered > 0 ? 'traceable' : 'needs_mapping',
            requirement_count: covered,
        },
    ];
}

async function loadCoveragePayload(pool, slug, requestedSpiral) {
    const capability = await resolveSlug(pool, slug);
    if (!capability) return { status: 404, body: { error: 'Capability slug not found' } };
    const spiral = await validateSpiral(pool, requestedSpiral);
    if (!spiral) return { status: 400, body: { error: 'Unknown spiral baseline' } };

    const requirements = await loadRequirements(pool, capability.uuid, spiral);
    const summary = summarizeCoverage(requirements);
    const services = await loadServiceCoverage(pool, capability.uuid, requirements);
    const gaps = requirements.filter((row) => row.covered_by.length === 0).map((requirement) => ({ requirement, reason: 'no_service_mapping' }));
    const duplicate_coverage = requirements
        .filter((row) => row.covered_by.length > 1)
        .map((requirement) => ({ requirement, services: requirement.covered_by }));
    const consolidation_candidates = buildOverlap(requirements);

    return {
        status: 200,
        body: {
            capability: { slug: capability.slug, title: capability.title, uuid: capability.uuid, page_id: capability.page_id, parent: capability.parent },
            spiral,
            summary,
            requirements,
            services,
            gaps,
            duplicate_coverage,
            consolidation_candidates,
            documents: buildEvidenceDocuments(capability, spiral, requirements),
        },
    };
}

router.get('/lvl3', async (req, res, next) => {
    try {
        res.json(await listLevel3Capabilities(getPool()));
    } catch (err) { next(err); }
});

router.get('/coverage', async (req, res, next) => {
    try {
        res.json(await capabilityGovernanceRepo.listCoverage(readGovernanceFilters(req)));
    } catch (err) { next(err); }
});

router.get('/gaps', async (req, res, next) => {
    try {
        res.json(await capabilityGovernanceRepo.listGaps(readGovernanceFilters(req)));
    } catch (err) { next(err); }
});

router.get('/overlaps', async (req, res, next) => {
    try {
        res.json(await capabilityGovernanceRepo.listOverlaps(readGovernanceFilters(req)));
    } catch (err) { next(err); }
});

router.get('/spirals/:code/readiness', async (req, res, next) => {
    try {
        res.json(await capabilityGovernanceRepo.getSpiralReadiness(req.params.code, readGovernanceFilters(req)));
    } catch (err) { next(err); }
});

router.get('/by-slug/:slug', async (req, res, next) => {
    try {
        const pool = getPool();
        const capability = await resolveSlug(pool, req.params.slug);
        if (!capability) return res.status(404).json({ error: 'Capability slug not found' });
        const coverageRows = await pool.query(`
            SELECT spiral_code, total_requirements, covered_count, coverage_percent
            FROM data.v_capability_lvl3_coverage
            WHERE capability_uuid = $1
            ORDER BY spiral_code
        `, [capability.uuid]);
        res.json({ ...capability, summary_stats: coverageRows.rows });
    } catch (err) { next(err); }
});

router.get('/by-slug/:slug/coverage', async (req, res, next) => {
    try {
        const pool = getPool();
        const payload = await loadCoveragePayload(pool, req.params.slug, readSpiralQuery(req));
        res.status(payload.status).json(payload.body);
    } catch (err) { next(err); }
});

router.get('/by-slug/:slug/gaps', async (req, res, next) => {
    try {
        const payload = await loadCoveragePayload(getPool(), req.params.slug, readSpiralQuery(req));
        if (payload.status !== 200) return res.status(payload.status).json(payload.body);
        res.json({ capability: payload.body.capability, spiral: payload.body.spiral, items: payload.body.gaps });
    } catch (err) { next(err); }
});

router.get('/by-slug/:slug/duplicate-coverage', async (req, res, next) => {
    try {
        const payload = await loadCoveragePayload(getPool(), req.params.slug, readSpiralQuery(req));
        if (payload.status !== 200) return res.status(payload.status).json(payload.body);
        res.json({ capability: payload.body.capability, spiral: payload.body.spiral, items: payload.body.duplicate_coverage });
    } catch (err) { next(err); }
});

router.get('/by-slug/:slug/consolidation-candidates', async (req, res, next) => {
    try {
        const payload = await loadCoveragePayload(getPool(), req.params.slug, readSpiralQuery(req));
        if (payload.status !== 200) return res.status(payload.status).json(payload.body);
        res.json({ capability: payload.body.capability, spiral: payload.body.spiral, items: payload.body.consolidation_candidates });
    } catch (err) { next(err); }
});

router.get('/by-slug/:slug/overlap', async (req, res, next) => {
    try {
        const pool = getPool();
        const capability = await resolveSlug(pool, req.params.slug);
        if (!capability) return res.status(404).json({ error: 'Capability slug not found' });
        const spiral = await validateSpiral(pool, readSpiralQuery(req));
        if (!spiral) return res.status(400).json({ error: 'Unknown spiral baseline' });
        const requirements = await loadRequirements(pool, capability.uuid, spiral);
        res.json({ capability: { slug: capability.slug, title: capability.title, uuid: capability.uuid }, spiral, pairs: buildOverlap(requirements) });
    } catch (err) { next(err); }
});

module.exports = {
    router,
    _private: { loadCoveragePayload, loadRequirements, summarizeCoverage, buildOverlap, buildEvidenceDocuments },
};
