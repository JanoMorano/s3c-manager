'use strict';

/**
 * /api/v1/taxonomy — C3 taxonomy, capability map/builder, service ↔ C3 mappings,
 * spiral governance and service catalogue reference data.
 *
 * The routes live in the files of this directory and are mounted in their
 * original order; shared.js holds the cache and common helpers.
 */

const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { requireModuleApiEnabled } = require('../../middleware/module-gates');
const { MODULE_CODES } = require('../../modules/manifest');
const { tReq } = require('../../utils/i18n');

const router = express.Router();
const requireC3ModuleApiEnabled = requireModuleApiEnabled(MODULE_CODES.C3, (req) => tReq(req, 'taxonomy.errors.module_inactive'));

function isC3ApiPath(pathname = '') {
    return (
        pathname === '/c3' ||
        pathname.startsWith('/c3/') ||
        pathname.startsWith('/c3-application') ||
        pathname.startsWith('/c3-applications') ||
        pathname.startsWith('/c3-data-objects') ||
        pathname.startsWith('/c3-services') ||
        pathname.startsWith('/c3-tins') ||
        pathname.startsWith('/c3-technology-interactions') ||
        pathname.startsWith('/c3-capability-builder') ||
        pathname.startsWith('/mapping') ||
        pathname.startsWith('/spiral')
    );
}

router.use((req, res, next) => {
    if (!isC3ApiPath(req.path)) return next();
    return requireC3ModuleApiEnabled(req, res, next);
});

// Mounted in the original declaration order: routes match first-come.
router.use(require('./c3-read.routes'));
// Every route below requires authentication.
router.use(requireAuth);
router.use(require('./capability-builder.routes'));
router.use(require('./c3-admin.routes'));
router.use(require('./mapping.routes'));
router.use(require('./reference.routes'));
router.use(require('./spiral.routes'));
router.use(require('./c3-lists.routes'));

module.exports = router;
