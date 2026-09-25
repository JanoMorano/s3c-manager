'use strict';

/** Minimal C3 entity lists for pickers (CapabilityLinksPanel). */

const express = require('express');
const { getPool } = require('../../db/pool');
const { requireAuth } = require('../../middleware/auth');
const { selectRows } = require('./shared');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PICKER LIST ENDPOINTY pro CapabilityLinksPanel
// Returns a minimal entity list for the Add dialog (id, uuid, title, code).
// ─────────────────────────────────────────────────────────────────────────────

router.get('/c3-applications', requireAuth, async (req, res, next) => {
    try {
        const r = await selectRows(getPool(), `
            SELECT id, uuid, title, application_code AS code, item_status
            FROM data.c3_application
            WHERE COALESCE(item_status,'') <> 'deprecated'
            ORDER BY title
        `);
        res.json(r);
    } catch (err) { next(err); }
});

router.get('/c3-data-objects', requireAuth, async (req, res, next) => {
    try {
        const r = await selectRows(getPool(), `
            SELECT id, uuid, title, data_object_code AS code, item_status
            FROM data.c3_data_object
            WHERE COALESCE(item_status,'') <> 'deprecated'
            ORDER BY title
        `);
        res.json(r);
    } catch (err) { next(err); }
});

router.get('/c3-tins', requireAuth, async (req, res, next) => {
    try {
        const r = await selectRows(getPool(), `
            SELECT id, uuid, title, technology_interaction_code AS code, item_status
            FROM data.c3_technology_interaction
            WHERE COALESCE(item_status,'') <> 'deprecated'
            ORDER BY title
        `);
        res.json(r);
    } catch (err) { next(err); }
});

router.get('/c3-services-list', requireAuth, async (req, res, next) => {
    try {
        const r = await selectRows(getPool(), `
            SELECT id, uuid, title, service_code AS code, item_status
            FROM data.c3_service
            WHERE COALESCE(item_status,'') <> 'deprecated'
            ORDER BY title
        `);
        res.json(r);
    } catch (err) { next(err); }
});

module.exports = router;
