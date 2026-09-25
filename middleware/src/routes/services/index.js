'use strict';

/**
 * /api/v1/services — service catalogue records and everything attached to one
 * service. The routes live in the files of this directory and are mounted in
 * their original order (e.g. /catalog-quality before /:id); shared.js holds
 * the request normalizers.
 */

const express = require('express');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Mounted in the original declaration order: routes match first-come.
router.use(require('./catalog.routes'));
router.use(require('./detail.routes'));
router.use(require('./service-model.routes'));
router.use(require('./readiness.routes'));
router.use(require('./graph.routes'));
router.use(require('./crud.routes'));
router.use(require('./related.routes'));
router.use(require('./sla.routes'));
router.use(require('./impact.routes'));

module.exports = router;
