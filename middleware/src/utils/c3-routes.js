'use strict';

const C3_ROUTES = {
    list: '/c3/list',
    dashboard: '/c3/dashboard',
    capabilityMap: '/c3/capability-map-spiral7',
    capabilityMapSpiral6: '/c3/capability-map-spiral6',
    capabilityMapSpiral7: '/c3/capability-map-spiral7',
    fmnAirC2: '/c3/fmn-air-c2',
    technologyInteractions: '/c3/technology-interactions',
    services: '/c3/services',
    dataObjects: '/c3/data-objects',
    applications: '/c3/applications',
    legacyList: '/admin/c3',
    legacyDashboard: '/admin/c3/dashboard',
    legacyCapabilityMap: '/c3-dashboard',
    legacyCapabilityMapAlias: '/c3/capability-map',
    legacyTechnologyInteractions: '/admin/c3-technology-interactions',
    legacyServices: '/admin/c3-services',
    legacyDataObjects: '/admin/c3-data-objects',
    legacyApplications: '/admin/c3-application',
};

function normalizeLegacyC3Path(pathname) {
    if (pathname === C3_ROUTES.legacyDashboard) return C3_ROUTES.dashboard;
    if (pathname === C3_ROUTES.legacyCapabilityMap) return C3_ROUTES.capabilityMap;
    if (pathname === C3_ROUTES.legacyCapabilityMapAlias) return C3_ROUTES.capabilityMap;
    if (pathname === C3_ROUTES.legacyList) return C3_ROUTES.list;
    if (pathname === C3_ROUTES.legacyTechnologyInteractions) return C3_ROUTES.technologyInteractions;
    if (pathname === C3_ROUTES.legacyServices) return C3_ROUTES.services;
    if (pathname === C3_ROUTES.legacyDataObjects) return C3_ROUTES.dataObjects;
    if (pathname === C3_ROUTES.legacyApplications) return C3_ROUTES.applications;
    if (pathname.startsWith('/admin/c3/')) {
        const slug = pathname.slice('/admin/c3/'.length);
        if (slug && !slug.includes('/')) return `/c3/${slug}`;
    }
    return pathname;
}

module.exports = { C3_ROUTES, normalizeLegacyC3Path };
