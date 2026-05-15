'use strict';

const {
    MODULE_CODES,
    isKnownModuleCode,
    normalizeModuleCode,
} = require('./manifest');

function parseActiveModuleCodes(value) {
    const raw = String(value ?? '').trim();
    if (!raw || raw === '*' || raw.toLowerCase() === 'all') return null;

    const active = new Set();
    for (const part of raw.split(',')) {
        const moduleCode = normalizeModuleCode(part);
        if (isKnownModuleCode(moduleCode)) {
            active.add(moduleCode);
        }
    }

    return active.size > 0 ? active : null;
}

function filterRouteGroupsByActiveModules(routeGroups, activeModuleCodes) {
    if (!activeModuleCodes || activeModuleCodes.size === 0) return routeGroups;
    return routeGroups.filter((group) => activeModuleCodes.has(normalizeModuleCode(group.moduleCode)));
}

module.exports = {
    MODULE_CODES,
    filterRouteGroupsByActiveModules,
    parseActiveModuleCodes,
};
