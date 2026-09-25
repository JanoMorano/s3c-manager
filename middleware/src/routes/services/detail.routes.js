'use strict';

/** Service detail: Service 360, overview and the service record. */

const express = require('express');
const repo = require('../../db/services.repo');
const flRepo = require('../../db/flavours.repo');
const relRepo = require('../../db/relations.repo');
const offeringsRepo = require('../../db/offerings.repo');
const supportModelRepo = require('../../db/support-model.repo');
const audienceRepo = require('../../db/audience.repo');
const operationalLinksRepo = require('../../db/operational-links.repo');
const serviceOverviewRepo = require('../../db/service-overview.repo');
const { isModuleApiEnabled } = require('../../middleware/module-gates');
const { MODULE_CODES } = require('../../modules/manifest');
const { serviceScore } = require('../../services/scoring');
const { getPool } = require('../../db/pool');
const logger = require('../../utils/logger');

const router = express.Router();

// ─── GET /services/:id/360 ───────────────────────────────────────────────────
router.get('/:id/360', async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const [service, overview] = await Promise.all([
            repo.findByServiceId(serviceId),
            serviceOverviewRepo.getServiceOverview(serviceId),
        ]);

        if (!service && !overview) return res.status(404).json({ error: 'Služba nenalezena' });

        const c3Enabled = await isModuleApiEnabled(MODULE_CODES.C3);
        const [relations, c3Mappings] = await Promise.all([
            relRepo.findByService(serviceId),
            c3Enabled ? getPool().query(`
                SELECT
                    scm.id,
                    scm.c3_uuid,
                    scm.mapping_type_code,
                    scm.pace_code,
                    scm.is_primary,
                    scm.sync_status,
                    scm.synced_at,
                    ct.title AS c3_title,
                    ct.external_id AS c3_external_id,
                    ct.item_type AS c3_item_type,
                    ct.item_status AS c3_item_status,
                    bl.board_state AS c3_board_state,
                    rmt.name AS mapping_type_name,
                    rpc.name AS pace_name
                FROM data.service_c3_mapping scm
                JOIN data.service_catalog sc
                  ON sc.id = scm.service_id
                 AND sc.is_deleted = FALSE
                LEFT JOIN data.c3_taxonomy ct
                  ON ct.uuid = scm.c3_uuid
                LEFT JOIN data.v_c3_board_lane bl
                  ON bl.uuid = scm.c3_uuid
                LEFT JOIN data.ref_c3_mapping_type rmt
                  ON rmt.code = scm.mapping_type_code
                LEFT JOIN data.ref_pace_category rpc
                  ON rpc.code = scm.pace_code
                WHERE sc.service_id = $1
                ORDER BY scm.is_primary DESC, ct.title ASC
            `, [serviceId]).then((result) => result.rows).catch((c3Err) => {
                logger.error(`service detail: C3 mappings unavailable for ${serviceId}: ${c3Err.message}`);
                return [];
            }) : Promise.resolve([]),
        ]);

        res.json({
            service,
            overview,
            relationships: {
                relations,
                c3_mappings: c3Mappings,
                dependency_summary: overview?.dependencies ?? null,
                capability_mappings: overview?.capability_mappings ?? [],
            },
            readiness: overview?.readiness ?? null,
            lifecycle: overview?.lifecycle ?? {
                stage_code: service?.lifecycle_stage_code ?? null,
                state: service?.lifecycle_state ?? null,
                service_status: service?.service_status ?? null,
            },
            generated_at: new Date().toISOString(),
        });
    } catch (err) { next(err); }
});

// ─── GET /services/:id/overview ──────────────────────────────────────────────
router.get('/:id/overview', async (req, res, next) => {
    try {
        const item = await serviceOverviewRepo.getServiceOverview(req.params.id);
        if (!item) return res.status(404).json({ error: 'Služba nenalezena' });
        res.json({ item });
    } catch (err) { next(err); }
});

// ─── GET /services/:id ────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
    try {
        const serviceId = req.params.id;

        const svc = await repo.findByServiceId(serviceId);
        if (!svc) return res.status(404).json({ error: 'Služba nenalezena' });

        const catalogId = svc.id;
        const offerings = await offeringsRepo.listByService(catalogId);
        const supportModel = await supportModelRepo.listByService(catalogId);
        const audiencePolicies = await audienceRepo.listByService(catalogId);
        const operationalLinks = await operationalLinksRepo.listByService(catalogId);
        const flavours = await flRepo.findByService(serviceId);
        const relations = await relRepo.findByService(serviceId);
        const score = serviceScore(svc, flavours);
        const primaryOffering = offerings.find((item) => item.is_default) || offerings[0] || null;

        const businessView = {
            business_summary: svc.summary ?? null,
            consumer_value: svc.consumer_value ?? null,
            requestable: svc.requestable,
            lifecycle_state: svc.lifecycle_state,
            target_audience_summary: svc.target_audience_summary,
            request_channel_type: svc.request_channel_type,
            request_channel_url: svc.request_channel_url,
            approval_required: svc.approval_required,
            fulfillment_lead_time_text: svc.fulfillment_lead_time_text,
            primary_offering: primaryOffering,
            support_model: supportModel,
            audience_policies: audiencePolicies,
            operational_links: operationalLinks,
        };

        const technicalView = {
            service_type: svc.service_type,
            service_status: svc.service_status,
            completeness_score: score,
            relation_count: svc.relation_count,
            flavour_count: svc.flavour_count,
            has_c3_mapping: Boolean(svc.c3_uuid),
            has_primary_offering: Boolean(primaryOffering),
        };

        res.json({
            ...svc,
            completeness_score: score,
            flavours,
            relations,
            offerings,
            primary_offering: primaryOffering,
            support_model: supportModel,
            audience_policies: audiencePolicies,
            operational_links: operationalLinks,
            business_view: businessView,
            technical_view: technicalView,
        });
    } catch (err) { next(err); }
});

module.exports = router;
