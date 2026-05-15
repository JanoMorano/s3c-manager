'use strict';

const { MODULE_CODES } = require('./manifest');

function shouldMountModule(moduleCode, activeModules) {
    return !activeModules || activeModules.has(moduleCode);
}

function buildApiRouteGroups({ moduleGate, activeModules = null }) {
    const routeGroups = [];

    if (shouldMountModule(MODULE_CODES.CORE, activeModules)) {
        const { buildCoreRoutes } = require('./core/routes');
        routeGroups.push(...buildCoreRoutes());
    }

    if (shouldMountModule(MODULE_CODES.SERVICE_CATALOGUE, activeModules)) {
        const { buildServiceCatalogueRoutes } = require('./service-catalogue/routes');
        routeGroups.push(...buildServiceCatalogueRoutes({ moduleGate }));
    }

    if (shouldMountModule(MODULE_CODES.C3, activeModules)) {
        const { buildC3Routes } = require('./c3-taxonomy/routes');
        routeGroups.push(...buildC3Routes({ moduleGate }));
    }

    if (shouldMountModule(MODULE_CODES.MANAGEMENT, activeModules)) {
        const { buildManagementRoutes } = require('./management/routes');
        routeGroups.push(...buildManagementRoutes({ moduleGate }));
    }

    return routeGroups;
}

function mountApiRouteGroups(app, routeGroups) {
    for (const group of routeGroups) {
        app.use(group.path, ...group.middleware, group.router);
    }
}

module.exports = {
    buildApiRouteGroups,
    mountApiRouteGroups,
};
