'use strict';

/** Score, readiness, framework coverage, C3 mapping preview and C3 mappings. */

const express = require('express');
const repo = require('../../db/services.repo');
const flRepo = require('../../db/flavours.repo');
const { canEdit } = require('../../middleware/rbac');
const { isModuleApiEnabled } = require('../../middleware/module-gates');
const { MODULE_CODES } = require('../../modules/manifest');
const { getServiceReadiness } = require('../../services/readiness');
const { serviceScoreDetailed } = require('../../services/scoring');
const { getPool } = require('../../db/pool');
const { listLevel3Capabilities } = require('../../utils/capability-slug');

const router = express.Router();

// ─── GET /services/:id/score ──────────────────────────────────────────────────
router.get('/:id/score', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const flavours = await flRepo.findByService(serviceId);
        const detail   = serviceScoreDetailed(svc, flavours);
        res.json(detail);
    } catch (err) { next(err); }
});

// ─── GET /services/:id/readiness ─────────────────────────────────────────────
router.get('/:id/readiness', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const readiness = await getServiceReadiness(serviceId);
        if (!readiness) {
            return res.status(404).json({ error: 'Readiness pro službu nebyla nalezena' });
        }
        res.json(readiness);
    } catch (err) { next(err); }
});

// ─── GET /services/:id/frameworks ────────────────────────────────────────────
// Lightweight framework coverage summary used by Service Detail v2. The generic
// coverage engine in /capabilities remains the source of truth; this endpoint
// adapts mapped Level-3 capabilities to service-detail cards.
router.get('/:id/frameworks', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const pool = getPool();
        const serviceResult = await pool.query(`
            SELECT id, service_id, title
            FROM data.service_catalog
            WHERE service_id = $1 AND is_deleted = FALSE
        `, [serviceId]);
        const service = serviceResult.rows[0];
        if (!service) return res.status(404).json({ error: 'Služba nenalezena' });

        const mappedCapabilities = await pool.query(`
            SELECT DISTINCT ct.uuid
            FROM data.service_c3_mapping scm
            JOIN data.c3_taxonomy ct ON ct.uuid = scm.c3_uuid
            WHERE scm.service_id = $1
              AND ct.item_type = 'CP'
              AND ct.level_num = 3
        `, [service.id]);
        const mappedUuids = new Set(mappedCapabilities.rows.map((row) => row.uuid));
        if (mappedUuids.size === 0) return res.json([]);

        const capabilities = (await listLevel3Capabilities(pool)).filter((capability) => mappedUuids.has(capability.uuid));
        const rows = [];
        for (const capability of capabilities) {
            const coverage = await pool.query(`
                SELECT spiral_code, total_requirements, covered_count, coverage_percent
                FROM data.v_capability_lvl3_coverage
                WHERE capability_uuid = $1
                ORDER BY CASE WHEN spiral_code = 'Spiral_5' THEN 0 ELSE 1 END, spiral_code DESC
                LIMIT 1
            `, [capability.uuid]);
            const summary = coverage.rows[0] ?? { total_requirements: 0, covered_count: 0, coverage_percent: 0, spiral_code: 'Spiral_5' };
            const missing = await pool.query(`
                SELECT r.code, r.title, r.entity_kind AS kind
                FROM data.v_capability_requirement r
                WHERE r.capability_uuid = $1
                  AND NOT EXISTS (
                      SELECT 1 FROM data.service_c3_mapping scm
                      WHERE scm.service_id = $2
                        AND (scm.c3_uuid = r.capability_uuid OR scm.c3_uuid = r.entity_uuid)
                  )
                ORDER BY r.entity_kind, r.code
                LIMIT 10
            `, [capability.uuid, service.id]);
            rows.push({
                framework_code: capability.slug === 'cap-bmc-air-bmc' ? 'FMN_AIR_C2' : capability.slug.toUpperCase().replace(/-/g, '_'),
                title: capability.title,
                capability_slug: capability.slug,
                spiral_code: summary.spiral_code,
                coverage_percent: Number(summary.coverage_percent ?? 0),
                core_total: Number(summary.total_requirements ?? 0),
                core_covered: Number(summary.covered_count ?? 0),
                missing_core: missing.rows,
            });
        }
        res.json(rows);
    } catch (err) { next(err); }
});

// ─── POST /services/:id/preview-mapping ──────────────────────────────────────
router.post('/:id/preview-mapping', canEdit, async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const { capability_uuid: capabilityUuid } = req.body ?? {};
        if (!capabilityUuid) return res.status(400).json({ error: 'capability_uuid is required' });
        const pool = getPool();
        const serviceResult = await pool.query(`
            SELECT id, service_id, title
            FROM data.service_catalog
            WHERE service_id = $1 AND is_deleted = FALSE
        `, [serviceId]);
        const service = serviceResult.rows[0];
        if (!service) return res.status(404).json({ error: 'Služba nenalezena' });

        const capabilityResult = await pool.query(`
            SELECT uuid, external_id, title
            FROM data.c3_taxonomy
            WHERE uuid = $1 AND item_type = 'CP'
        `, [capabilityUuid]);
        const capability = capabilityResult.rows[0];
        if (!capability) return res.status(404).json({ error: 'Capability mapping target not found' });

        const beforeResult = await pool.query(`
            SELECT spiral_code, total_requirements, covered_count, coverage_percent
            FROM data.v_capability_lvl3_coverage
            WHERE capability_uuid = $1
            ORDER BY spiral_code
        `, [capabilityUuid]);
        const requirements = await pool.query(`
            SELECT r.code, r.title, r.entity_kind AS kind, r.entity_uuid
            FROM data.v_capability_requirement r
            WHERE r.capability_uuid = $1
              AND NOT EXISTS (
                  SELECT 1 FROM data.service_c3_mapping scm
                  WHERE scm.service_id = $2
                    AND (scm.c3_uuid = r.capability_uuid OR scm.c3_uuid = r.entity_uuid)
              )
            ORDER BY r.entity_kind, r.code
        `, [capabilityUuid, service.id]);
        const capabilities = await listLevel3Capabilities(pool);
        const slug = capabilities.find((item) => item.uuid === capabilityUuid)?.slug ?? null;
        const coverageDelta = beforeResult.rows.map((row) => {
            const total = Number(row.total_requirements ?? 0);
            const beforeCovered = Number(row.covered_count ?? 0);
            const afterCovered = total;
            return {
                capability_uuid: capabilityUuid,
                capability_title: capability.title,
                capability_slug: slug,
                spiral_code: row.spiral_code,
                before_coverage_percent: Number(row.coverage_percent ?? 0),
                after_coverage_percent: total > 0 ? Math.round((afterCovered / total) * 100) : 0,
                newly_covered_count: Math.max(0, afterCovered - beforeCovered),
            };
        });
        const duplicates = await pool.query(`
            SELECT DISTINCT sc.service_id, sc.title
            FROM data.service_c3_mapping scm
            JOIN data.service_catalog sc ON sc.id = scm.service_id
            WHERE scm.c3_uuid = $1
              AND sc.service_id <> $2
              AND sc.is_deleted = FALSE
            ORDER BY sc.service_id
            LIMIT 10
        `, [capabilityUuid, serviceId]);
        res.json({
            read_only: true,
            mapping_intent: req.body,
            coverage_delta_per_lvl3: coverageDelta,
            newly_covered_requirements: requirements.rows,
            potential_duplicate_coverage: duplicates.rows,
            affected_spirals: [...new Set(coverageDelta.map((row) => row.spiral_code))],
            classification: requirements.rows.length > 0 ? 'gap_closer' : 'metadata_enrichment',
        });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/c3-mappings ───────────────────────────────────────────
// Returns all C3 taxonomy mappings for the selected service, not only the primary one.
router.get('/:id/c3-mappings', async (req, res, next) => {
    try {
        const c3Enabled = await isModuleApiEnabled(MODULE_CODES.C3);
        if (!c3Enabled) {
            return res.json({ mappings: [] });
        }

        const serviceId = req.params.id;
        const pool = getPool();

        const result = await pool.query(`
            SELECT
                scm.id,
                scm.c3_uuid,
                scm.mapping_type_code,
                scm.pace_code,
                scm.c3_level,
                scm.c3_domain,
                scm.c3_source,
                scm.is_primary,
                scm.mapping_note,
                scm.synced_at,
                scm.sync_status,
                ct.title          AS c3_title,
                ct.external_id    AS c3_external_id,
                ct.item_type      AS c3_item_type,
                ct.item_status    AS c3_item_status,
                NULL::VARCHAR(500) AS c3_short_title,
                rmt.name          AS mapping_type_name,
                rpc.name          AS pace_name
            FROM data.service_c3_mapping scm
            JOIN data.service_catalog sc
                ON sc.id = scm.service_id AND sc.is_deleted = FALSE
            LEFT JOIN data.c3_taxonomy ct
                ON ct.uuid = scm.c3_uuid
            LEFT JOIN data.ref_c3_mapping_type rmt
                ON rmt.code = scm.mapping_type_code
            LEFT JOIN data.ref_pace_category rpc
                ON rpc.code = scm.pace_code
            WHERE sc.service_id = $1
            ORDER BY scm.is_primary DESC, scm.c3_level DESC, scm.c3_domain ASC
        `, [serviceId]);

        res.json({ mappings: result.rows });
    } catch (err) { next(err); }
});

module.exports = router;
