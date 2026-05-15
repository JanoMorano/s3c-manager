'use strict';

const { MODULE_CODES } = require('../manifest');
const { route } = require('../module-route');

const authRoutes = require('../../routes/auth');
const installRoutes = require('../../routes/install');
const adminRoutes = require('../../routes/admin');
const groupsRoutes = require('../../routes/groups');
const searchRoutes = require('./search.routes');
const { router: refRoutes } = require('../../routes/ref');

function buildCoreRoutes() {
    return [
        route('/api/v1/install', MODULE_CODES.CORE, installRoutes),
        route('/api/v1/auth', MODULE_CODES.CORE, authRoutes),
        route('/api/v1/admin', MODULE_CODES.CORE, adminRoutes),
        route('/api/v1/admin', MODULE_CODES.CORE, groupsRoutes),
        route('/api/v1/ref', MODULE_CODES.CORE, refRoutes),
        route('/api/v1/search', MODULE_CODES.CORE, searchRoutes),
    ];
}

module.exports = { buildCoreRoutes };
