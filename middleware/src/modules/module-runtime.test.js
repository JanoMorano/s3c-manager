'use strict';

const assert = require('node:assert/strict');

const {
  MODULE_CODES,
  filterRouteGroupsByActiveModules,
  parseActiveModuleCodes,
} = require('./module-runtime.js');

test('parses active module aliases into canonical module codes', () => {
  const active = parseActiveModuleCodes('service_catalogue, C3, management');

  assert.deepEqual([...active], [
    MODULE_CODES.SERVICE_CATALOGUE,
    MODULE_CODES.C3,
    MODULE_CODES.MANAGEMENT,
  ]);
});

test('treats empty wildcard active module configuration as all modules', () => {
  assert.equal(parseActiveModuleCodes(''), null);
  assert.equal(parseActiveModuleCodes('*'), null);
  assert.equal(parseActiveModuleCodes('all'), null);
});

test('filters route groups by active module codes', () => {
  const routeGroups = [
    { path: '/api/v1/auth', moduleCode: MODULE_CODES.CORE },
    { path: '/api/v1/services', moduleCode: MODULE_CODES.SERVICE_CATALOGUE },
    { path: '/api/v1/c3', moduleCode: MODULE_CODES.C3 },
    { path: '/api/v1/governance', moduleCode: MODULE_CODES.MANAGEMENT },
  ];
  const active = parseActiveModuleCodes('SERVICE_CATALOGUE_CORE,C3_TAXONOMY');
  const filtered = filterRouteGroupsByActiveModules(routeGroups, active);

  assert.deepEqual(filtered.map((group) => group.path), ['/api/v1/services', '/api/v1/c3']);
});
