'use strict';

const assert = require('node:assert/strict');

const {
  MODULE_CODES,
  buildGroupedSearchResponse,
  buildHelpSearchGroup,
  buildStaticPageSearchGroups,
  createSearchGroup,
  tokenizeSearchQuery,
} = require('./global-search-groups.js');

const run = typeof test === 'function'
  ? test
  : (_name, fn) => fn();

run('groups non-empty results by module order', () => {
  const serviceGroup = createSearchGroup('service_catalogue', [
    { code: 'SVC-1', title: 'Identity service', href: '/services/SVC-1' },
  ]);
  const c3Group = createSearchGroup('c3_taxonomy', [
    { code: 'C3-1', title: 'Capability node', href: '/c3/C3-1' },
  ]);
  const emptyGroup = createSearchGroup('management', []);

  const response = buildGroupedSearchResponse('service', [c3Group, emptyGroup, serviceGroup]);

  assert.equal(response.query, 'service');
  assert.equal(response.total, 2);
  assert.deepEqual(response.groups.map((group) => group.key), ['service_catalogue', 'c3_taxonomy']);
  assert.equal(response.groups[0].module_code, MODULE_CODES.SERVICE_CATALOGUE);
  assert.equal(response.groups[1].module_code, MODULE_CODES.C3);
});

run('searches Czech help content', () => {
  const helpGroup = buildHelpSearchGroup('instalace', { locale: 'cs', limit: 3 });

  assert.equal(helpGroup.key, 'help');
  assert.equal(helpGroup.kind, 'help');
  assert.equal(helpGroup.module_code, MODULE_CODES.CORE);
  assert.ok(helpGroup.items.length > 0);
  assert.ok(helpGroup.items[0].href.startsWith('/help-cs'));
});

run('searches English help content', () => {
  const helpGroup = buildHelpSearchGroup('capability', { locale: 'en', limit: 2 });

  assert.ok(helpGroup.items.length > 0);
  assert.ok(helpGroup.items.every((item) => item.href.startsWith('/help-en')));
});

run('searches Czech capability synonym in help content', () => {
  const helpGroup = buildHelpSearchGroup('schopnost', { locale: 'cs', limit: 3 });

  assert.ok(helpGroup.items.some((item) => item.code === 'HELP-C3'));
});

run('tokenizes and de-duplicates multi-word queries', () => {
  assert.deepEqual(tokenizeSearchQuery('  Service, service OWNER SLA  '), ['service', 'owner', 'sla']);
});

run('matches help pages when all query words appear across indexed help text', () => {
  const helpGroup = buildHelpSearchGroup('owner SLA', { locale: 'en', limit: 3 });

  assert.ok(helpGroup.items.some((item) => item.code === 'HELP-SERVICES'));
});

run('groups static application page matches by module area', () => {
  const groups = buildStaticPageSearchGroups('readiness blockers', {
    limit: 5,
    includeC3: true,
    includeManagement: true,
  });
  const management = groups.find((group) => group.key === 'management_pages');

  assert.ok(management);
  assert.ok(management.items.some((item) => item.href === '/operations/readiness'));
});

run('groups Czech capability synonym under C3 pages', () => {
  const groups = buildStaticPageSearchGroups('schopnost', {
    limit: 5,
    includeC3: true,
    includeManagement: true,
  });
  const c3Pages = groups.find((group) => group.key === 'c3_pages');

  assert.ok(c3Pages);
  assert.ok(c3Pages.items.some((item) => item.href === '/capabilities'));
});

if (typeof test !== 'function') console.log('global-search-groups tests passed');
