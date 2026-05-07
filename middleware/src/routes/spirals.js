'use strict';

const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { listLevel3Capabilities } = require('../utils/capability-slug');

const router = express.Router();
router.use(requireAuth);

async function validateSpiral(pool, code) {
    const normalized = String(code ?? '').trim();
    const result = await pool.query(`
        SELECT
            spiral_code AS code,
            spiral_label AS name,
            notes AS description,
            is_active
        FROM data.ref_spiral_baseline
        WHERE spiral_code = $1
    `, [normalized]);
    return result.rows[0] ?? null;
}

function statusBand(coveragePercent, requirementCount) {
    if (requirementCount === 0) return 'no_data';
    if (coveragePercent >= 80) return 'green';
    if (coveragePercent >= 50) return 'yellow';
    if (coveragePercent >= 20) return 'orange';
    return 'red';
}

router.get('/', async (req, res, next) => {
    try {
        const result = await getPool().query(`
            SELECT
                spiral_code AS code,
                spiral_label AS name,
                notes AS description,
                is_active,
                id AS sort_order
            FROM data.ref_spiral_baseline
            ORDER BY id, spiral_code
        `);
        res.json({ items: result.rows });
    } catch (err) { next(err); }
});

router.get('/:code/heatmap', async (req, res, next) => {
    try {
        const pool = getPool();
        const spiral = await validateSpiral(pool, req.params.code);
        if (!spiral) return res.status(404).json({ error: 'Unknown spiral baseline' });
        const capabilities = await listLevel3Capabilities(pool);
        const coverageResult = await pool.query(`
            SELECT capability_uuid, total_requirements, covered_count, coverage_percent
            FROM data.v_capability_lvl3_coverage
            WHERE spiral_code = $1
        `, [spiral.code]);
        const byCapability = new Map(coverageResult.rows.map((row) => [row.capability_uuid, row]));
        const heatmap = capabilities.map((capability) => {
            const coverage = byCapability.get(capability.uuid) ?? { total_requirements: 0, covered_count: 0, coverage_percent: 0 };
            const coveragePercent = Number(coverage.coverage_percent ?? 0);
            const total = Number(coverage.total_requirements ?? 0);
            return {
                slug: capability.slug,
                uuid: capability.uuid,
                page_id: capability.page_id,
                title: capability.title,
                parent: capability.parent,
                coverage_percent: coveragePercent,
                requirement_count: total,
                gap_count: Math.max(0, total - Number(coverage.covered_count ?? 0)),
                top_service: null,
                status_band: statusBand(coveragePercent, total),
                top_gap: null,
                top_overlap_pair: null,
                recommended_action: total === 0 ? 'Add or import spiral requirements' : coveragePercent >= 80 ? 'Monitor coverage' : 'Create fulfillment plan',
            };
        });
        const topGaps = [...heatmap].sort((a, b) => b.gap_count - a.gap_count).slice(0, 10);
        res.json({
            spiral,
            capabilities: heatmap,
            top_gaps: topGaps,
            top_overlaps: [],
            consolidation_candidates: [],
            traceability: { source: 'v_capability_lvl3_coverage', links: ['capability', 'requirements', 'services'] },
        });
    } catch (err) { next(err); }
});

router.get('/:code/fulfillment-plan', async (req, res, next) => {
    try {
        const pool = getPool();
        const spiral = await validateSpiral(pool, req.params.code);
        if (!spiral) return res.status(404).json({ error: 'Unknown spiral baseline' });
        const capabilities = await listLevel3Capabilities(pool);
        const coverageResult = await pool.query(`
            SELECT capability_uuid, total_requirements, covered_count, coverage_percent
            FROM data.v_capability_lvl3_coverage
            WHERE spiral_code = $1
        `, [spiral.code]);
        const byCapability = new Map(coverageResult.rows.map((row) => [row.capability_uuid, row]));
        const buildNeeded = capabilities
            .map((capability) => {
                const coverage = byCapability.get(capability.uuid) ?? { total_requirements: 0, covered_count: 0, coverage_percent: 0 };
                const gap = Math.max(0, Number(coverage.total_requirements ?? 0) - Number(coverage.covered_count ?? 0));
                return {
                    id: `build-${spiral.code}-${capability.slug}`,
                    action: gap > 0 ? `Close ${gap} uncovered requirements` : 'Monitor capability coverage',
                    confidence: Number(coverage.total_requirements ?? 0) > 0 ? 0.7 : 0.3,
                    evidence_refs: [{ source: 'coverage_engine', capability_uuid: capability.uuid }],
                    affected_capabilities: [{ slug: capability.slug, title: capability.title }],
                    affected_services: [],
                    recommended_owner_persona: 'capability_manager',
                    gap_count: gap,
                };
            })
            .filter((row) => row.gap_count > 0)
            .sort((a, b) => b.gap_count - a.gap_count)
            .slice(0, 20);
        res.json({
            spiral,
            buckets: {
                quick_wins: [],
                enrichment_needed: [],
                build_needed: buildNeeded,
                consolidation_candidates: [],
                retire_or_merge_candidates: [],
            },
        });
    } catch (err) { next(err); }
});

module.exports = router;
