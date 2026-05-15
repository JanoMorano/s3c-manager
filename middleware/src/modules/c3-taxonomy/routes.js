'use strict';

const { MODULE_CODES } = require('../manifest');
const { route } = require('../module-route');

const { router: capabilitiesRoutes } = require('../../routes/capabilities');
const spiralsRoutes = require('../../routes/spirals');
const { router: capLinksRoutes } = require('../../routes/capability-links');

function buildC3Routes({ moduleGate }) {
    const requireC3 = moduleGate(MODULE_CODES.C3);

    return [
        route('/api/v1/capabilities', MODULE_CODES.C3, capabilitiesRoutes, requireC3),
        route('/api/v1/spirals', MODULE_CODES.C3, spiralsRoutes, requireC3),
        route('/api/v1/taxonomy/c3/:uuid/links', MODULE_CODES.C3, capLinksRoutes, requireC3),
    ];
}

module.exports = { buildC3Routes };
