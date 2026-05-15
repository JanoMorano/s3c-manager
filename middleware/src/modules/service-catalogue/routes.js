'use strict';

const { MODULE_CODES } = require('../manifest');
const { route } = require('../module-route');

const servicesRoutes = require('../../routes/services');
const flavoursRoutes = require('../../routes/flavours');
const relationsRoutes = require('../../routes/relations');
const statsRoutes = require('../../routes/stats');
const graphRoutes = require('../../routes/graph');
const importRoutes = require('../../routes/import');
const exportRoutes = require('../../routes/exports');
const taxonomyRoutes = require('../../routes/taxonomy');

function buildServiceCatalogueRoutes({ moduleGate }) {
    const requireServiceCatalogue = moduleGate(MODULE_CODES.SERVICE_CATALOGUE);

    return [
        route('/api/v1/services', MODULE_CODES.SERVICE_CATALOGUE, servicesRoutes, requireServiceCatalogue),
        route('/api/v1/flavours', MODULE_CODES.SERVICE_CATALOGUE, flavoursRoutes, requireServiceCatalogue),
        route('/api/v1/relations', MODULE_CODES.SERVICE_CATALOGUE, relationsRoutes, requireServiceCatalogue),
        route('/api/v1/stats', MODULE_CODES.SERVICE_CATALOGUE, statsRoutes, requireServiceCatalogue),
        route('/api/v1/graph', MODULE_CODES.SERVICE_CATALOGUE, graphRoutes, requireServiceCatalogue),
        route('/api/v1/import', MODULE_CODES.SERVICE_CATALOGUE, importRoutes, requireServiceCatalogue),
        route('/api/v1/export', MODULE_CODES.SERVICE_CATALOGUE, exportRoutes, requireServiceCatalogue),
        route('/api/v1/taxonomy', MODULE_CODES.SERVICE_CATALOGUE, taxonomyRoutes, requireServiceCatalogue),
    ];
}

module.exports = { buildServiceCatalogueRoutes };
