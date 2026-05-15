'use strict';

const { MODULE_CODES } = require('../manifest');
const { route } = require('../module-route');

const dashboardRoutes = require('../../routes/dashboard');
const governanceRoutes = require('../../routes/governance');
const portfolioRoutes = require('../../routes/portfolio');
const readinessRoutes = require('../../routes/readiness');
const impactRoutes = require('../../routes/impact');

function buildManagementRoutes({ moduleGate }) {
    const requireManagement = moduleGate(MODULE_CODES.MANAGEMENT);

    return [
        route('/api/v1/dashboard', MODULE_CODES.MANAGEMENT, dashboardRoutes, requireManagement),
        route('/api/v1/governance', MODULE_CODES.MANAGEMENT, governanceRoutes, requireManagement),
        route('/api/v1/portfolio', MODULE_CODES.MANAGEMENT, portfolioRoutes, requireManagement),
        route('/api/v1/readiness', MODULE_CODES.MANAGEMENT, readinessRoutes, requireManagement),
        route('/api/v1/impact', MODULE_CODES.MANAGEMENT, impactRoutes, requireManagement),
    ];
}

module.exports = { buildManagementRoutes };
