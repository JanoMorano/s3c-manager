'use strict';

const { MODULE_CODES, getModuleDefinition } = require('../manifest');

const GROUP_DEFINITIONS = Object.freeze({
    service_catalogue: {
        label: 'Service Catalogue',
        module_code: MODULE_CODES.SERVICE_CATALOGUE,
        kind: 'module',
        order: 20,
    },
    service_catalogue_pages: {
        label: 'Service Catalogue Pages',
        module_code: MODULE_CODES.SERVICE_CATALOGUE,
        kind: 'module',
        order: 21,
    },
    c3_taxonomy: {
        label: 'C3 Taxonomy',
        module_code: MODULE_CODES.C3,
        kind: 'module',
        order: 30,
    },
    c3_services: {
        label: 'C3 Services',
        module_code: MODULE_CODES.C3,
        kind: 'module',
        order: 31,
    },
    c3_applications: {
        label: 'C3 Applications',
        module_code: MODULE_CODES.C3,
        kind: 'module',
        order: 32,
    },
    c3_data_objects: {
        label: 'C3 Data Objects',
        module_code: MODULE_CODES.C3,
        kind: 'module',
        order: 33,
    },
    c3_technology_interactions: {
        label: 'C3 Technology Interactions',
        module_code: MODULE_CODES.C3,
        kind: 'module',
        order: 34,
    },
    c3_capability_builder: {
        label: 'C3 Capability Builder',
        module_code: MODULE_CODES.C3,
        kind: 'module',
        order: 35,
    },
    c3_pages: {
        label: 'C3 Pages',
        module_code: MODULE_CODES.C3,
        kind: 'module',
        order: 36,
    },
    management: {
        label: 'Management Cockpit',
        module_code: MODULE_CODES.MANAGEMENT,
        kind: 'module',
        order: 40,
    },
    management_pages: {
        label: 'Management Pages',
        module_code: MODULE_CODES.MANAGEMENT,
        kind: 'module',
        order: 41,
    },
    platform_pages: {
        label: 'Application Pages',
        module_code: MODULE_CODES.CORE,
        kind: 'module',
        order: 80,
    },
    help: {
        label: 'Help',
        module_code: MODULE_CODES.CORE,
        kind: 'help',
        order: 90,
    },
});

const STATIC_APP_PAGES = Object.freeze([
    {
        group_key: 'platform_pages',
        code: 'APP-HOME',
        title: 'S3C Manager dashboard',
        description: 'Main overview, top navigation, global search and module entry points.',
        href: '/',
        keywords: ['home', 'dashboard', 'overview', 'navigation', 'search', 'modules', 'prehled', 'uvod'],
    },
    {
        group_key: 'platform_pages',
        code: 'APP-SEARCH',
        title: 'Global search',
        description: 'Search across the whole application: services, C3, management records, pages and help.',
        href: '/search',
        keywords: ['search', 'hledat', 'global', 'ajax', 'suggestions', 'napoveda', 'module'],
    },
    {
        group_key: 'platform_pages',
        code: 'APP-ADMIN',
        title: 'Administration',
        description: 'User, group, SSO, web, reference data and installation administration.',
        href: '/administration',
        keywords: ['admin', 'administration', 'users', 'groups', 'sso', 'web', 'reference', 'installation'],
    },
    {
        group_key: 'platform_pages',
        code: 'APP-INSTALL',
        title: 'Installation wizard',
        description: 'First-run installation, database checks, module plan, admin bootstrap and install summary.',
        href: '/administration/installation',
        keywords: ['install', 'installation', 'wizard', 'database', 'module', 'admin', 'setup'],
    },
    {
        group_key: 'platform_pages',
        code: 'APP-USER',
        title: 'User profile',
        description: 'User account details, password change, language preference and owned services.',
        href: '/user-info',
        keywords: ['user', 'profile', 'password', 'language', 'owner', 'preference'],
    },
    {
        group_key: 'service_catalogue_pages',
        code: 'PAGE-CATALOGUE',
        title: 'Catalogue browser',
        description: 'Browse service catalogue entries, requestable services and catalogue metadata.',
        href: '/catalogue',
        keywords: ['catalogue', 'catalog', 'service', 'browse', 'requestable', 'katalog', 'sluzby'],
    },
    {
        group_key: 'service_catalogue_pages',
        code: 'PAGE-SERVICE-LIST',
        title: 'Service list',
        description: 'Operational service list with filters, exact search, export and column views.',
        href: '/services/list',
        keywords: ['services', 'service list', 'filters', 'exact search', 'export', 'owner', 'status'],
    },
    {
        group_key: 'service_catalogue_pages',
        code: 'PAGE-SERVICE-GRAPH',
        title: 'Service graph',
        description: 'Service relationships, dependency flow, graph analysis and impact view.',
        href: '/services/graph',
        keywords: ['service', 'graph', 'relationships', 'dependency', 'impact', 'analysis'],
    },
    {
        group_key: 'service_catalogue_pages',
        code: 'PAGE-IMPORT',
        title: 'Import workspace',
        description: 'Upload files, dry-run import, preflight checks, change review and import audit.',
        href: '/import',
        keywords: ['import', 'upload', 'dry-run', 'preflight', 'audit', 'xlsx', 'csv'],
    },
    {
        group_key: 'service_catalogue_pages',
        code: 'PAGE-NEW-SERVICE',
        title: 'New service',
        description: 'Create and edit service catalogue metadata, ownership, value and request process.',
        href: '/management/new-service',
        keywords: ['new service', 'edit service', 'metadata', 'owner', 'value', 'request'],
    },
    {
        group_key: 'c3_pages',
        code: 'PAGE-C3-LIST',
        title: 'C3 taxonomy list',
        description: 'C3 entities with exact and fuzzy search, type filters, parent filters and status filters.',
        href: '/c3/list',
        keywords: ['c3', 'taxonomy', 'entities', 'exact search', 'capability', 'schopnost', 'schopnosti', 'application', 'data object'],
    },
    {
        group_key: 'c3_pages',
        code: 'PAGE-CAPABILITIES',
        title: 'Capabilities',
        description: 'Capability views, coverage analysis, governance context and C3 relationships.',
        href: '/capabilities',
        keywords: ['capabilities', 'capability', 'schopnost', 'schopnosti', 'coverage', 'governance', 'c3', 'relationships'],
    },
    {
        group_key: 'c3_pages',
        code: 'PAGE-SPIRALS',
        title: 'FMN spirals',
        description: 'Spiral heatmaps, FMN service instruction coverage and capability mapping.',
        href: '/spirals',
        keywords: ['spiral', 'spirals', 'fmn', 'coverage', 'heatmap', 'service instructions'],
    },
    {
        group_key: 'c3_pages',
        code: 'PAGE-C3-BUILDER',
        title: 'C3 capability builder',
        description: 'Capability builder, page identifiers, domains, parent hierarchy and publication state.',
        href: '/administration/c3-capability-builder',
        keywords: ['builder', 'capability builder', 'schopnost', 'schopnosti', 'page id', 'domain', 'parent', 'hierarchy'],
    },
    {
        group_key: 'management_pages',
        code: 'PAGE-OPERATIONS',
        title: 'Operations cockpit',
        description: 'Governance work surface for reviews, decisions, readiness and owner workload.',
        href: '/operations',
        keywords: ['operations', 'governance', 'reviews', 'decisions', 'readiness', 'owner load'],
    },
    {
        group_key: 'management_pages',
        code: 'PAGE-REVIEWS',
        title: 'Governance reviews',
        description: 'Review queue, assigned work, overdue reviews, service filters and status filters.',
        href: '/operations/reviews',
        keywords: ['review', 'reviews', 'queue', 'assigned', 'overdue', 'service', 'status'],
    },
    {
        group_key: 'management_pages',
        code: 'PAGE-DECISIONS',
        title: 'Governance decisions',
        description: 'Decision log, service decisions, rationale, approvals and lifecycle decisions.',
        href: '/operations/decisions',
        keywords: ['decision', 'decisions', 'decision log', 'rationale', 'approval', 'lifecycle'],
    },
    {
        group_key: 'management_pages',
        code: 'PAGE-READINESS',
        title: 'Readiness gates',
        description: 'Readiness rules, blockers, uncovered services, warnings and governance checks.',
        href: '/operations/readiness',
        keywords: ['readiness', 'gate', 'gates', 'blockers', 'blocked', 'warnings', 'checks'],
    },
    {
        group_key: 'management_pages',
        code: 'PAGE-OWNER-LOAD',
        title: 'Owner load',
        description: 'Owner workload, review distribution, service accountability and assigned actions.',
        href: '/operations/owner-load',
        keywords: ['owner', 'load', 'workload', 'assigned', 'accountability', 'actions'],
    },
    {
        group_key: 'management_pages',
        code: 'PAGE-PORTFOLIO',
        title: 'Portfolio',
        description: 'Portfolio steering, service portfolio groups, lifecycle, gaps and investment view.',
        href: '/portfolio',
        keywords: ['portfolio', 'steering', 'groups', 'lifecycle', 'gaps', 'investment'],
    },
]);

const HELP_CHAPTERS = Object.freeze([
    {
        code: 'HELP-INSTALL',
        module_code: MODULE_CODES.CORE,
        slug: '01-install',
        title: { cs: 'Instalace a první spuštění', en: 'Installation and first-run wizard' },
        description: {
            cs: 'Průvodce instalací, databází, moduly, demo daty a provozními předpoklady.',
            en: 'Install wizard, database checks, modules, demo data and operational prerequisites.',
        },
        keywords: ['install', 'installation', 'instalace', 'setup', 'wizard', 'průvodce', 'database', 'databáze', 'moduly', 'modules'],
    },
    {
        code: 'HELP-WELCOME',
        module_code: MODULE_CODES.CORE,
        slug: '02-welcome',
        title: { cs: 'Co je S3C Manager', en: 'What S3C Manager is' },
        description: {
            cs: 'Základní orientace, role aplikace a návaznost na enterprise governance.',
            en: 'Basic orientation, application purpose and enterprise governance context.',
        },
        keywords: ['welcome', 'overview', 'uvod', 'úvod', 'purpose', 'governance', 'manager'],
    },
    {
        code: 'HELP-COCKPIT',
        module_code: MODULE_CODES.MANAGEMENT,
        slug: '03-cocpit',
        title: { cs: 'Dashboard a pracovní plocha', en: 'Dashboard and personal work surface' },
        description: {
            cs: 'Hlavní dashboard, osobní úkoly, notifikace a pracovní přehled.',
            en: 'Main dashboard, personal tasks, notifications and work overview.',
        },
        keywords: ['dashboard', 'cockpit', 'cocpit', 'tasks', 'úkoly', 'ukoly', 'notifikace', 'notifications'],
    },
    {
        code: 'HELP-SERVICES',
        module_code: MODULE_CODES.SERVICE_CATALOGUE,
        slug: '04-services',
        title: { cs: 'Katalog služeb a Service 360', en: 'Service catalogue and Service 360' },
        description: {
            cs: 'Vyhledání služeb, detail služby, editace, vlastníci, SLA a provozní metadata.',
            en: 'Finding services, Service 360, editing, owners, SLA and operational metadata.',
        },
        keywords: ['service', 'services', 'služba', 'služby', 'sluzba', 'sluzby', 'catalogue', 'katalog', 'SLA', 'owner', 'vlastník'],
    },
    {
        code: 'HELP-C3',
        module_code: MODULE_CODES.C3,
        slug: '05-capabilities_c3',
        title: { cs: 'Capability management a C3 taxonomie', en: 'Capability management and C3 taxonomy' },
        description: {
            cs: 'Capability mapy, C3 taxonomie, FMN spirály, vazby služeb a coverage pohledy.',
            en: 'Capability maps, C3 taxonomy, FMN spirals, service mappings and coverage views.',
        },
        keywords: ['capability', 'capabilities', 'schopnost', 'schopnosti', 'C3', 'taxonomy', 'taxonomie', 'spiral', 'spirála', 'spirala', 'FMN', 'coverage'],
    },
    {
        code: 'HELP-GOVERNANCE',
        module_code: MODULE_CODES.MANAGEMENT,
        slug: '06-governance',
        title: { cs: 'Governance, review a rozhodnutí', en: 'Governance, reviews and decisions' },
        description: {
            cs: 'Readiness, governance workflow, review, rozhodnutí a portfolio řízení.',
            en: 'Readiness, governance workflow, reviews, decisions and portfolio steering.',
        },
        keywords: ['governance', 'review', 'reviews', 'decision', 'decisions', 'rozhodnutí', 'rozhodnuti', 'readiness', 'portfolio'],
    },
    {
        code: 'HELP-IMPORT',
        module_code: MODULE_CODES.SERVICE_CATALOGUE,
        slug: '07-import',
        title: { cs: 'Import dat', en: 'Data import' },
        description: {
            cs: 'Importní workspace, upload, preflight, kontrola změn a audit importu.',
            en: 'Import workspace, upload, preflight, change review and import audit.',
        },
        keywords: ['import', 'upload', 'csv', 'xlsx', 'preflight', 'audit', 'workspace'],
    },
    {
        code: 'HELP-ADMIN',
        module_code: MODULE_CODES.CORE,
        slug: '08-admin',
        title: { cs: 'Administrace', en: 'Administration' },
        description: {
            cs: 'Správa uživatelů, skupin, SSO, referenčních dat, importu a instalace.',
            en: 'Users, groups, SSO, reference data, import and installation administration.',
        },
        keywords: ['admin', 'administrace', 'administration', 'users', 'uživatelé', 'uzivatele', 'groups', 'SSO', 'reference'],
    },
    {
        code: 'HELP-USER',
        module_code: MODULE_CODES.CORE,
        slug: '09-user',
        title: { cs: 'Uživatelský profil', en: 'User profile' },
        description: {
            cs: 'Profil, jazyk, heslo, preference a služby ve vlastnictví uživatele.',
            en: 'Profile, language, password, preferences and services owned by the user.',
        },
        keywords: ['user', 'profile', 'uživatel', 'uzivatel', 'profil', 'password', 'heslo', 'language', 'jazyk'],
    },
    {
        code: 'HELP-ANALYSIS',
        module_code: MODULE_CODES.MANAGEMENT,
        slug: '10-analysis',
        title: { cs: 'Analýzy a grafy', en: 'Analysis and graphs' },
        description: {
            cs: 'Graf služeb, C3 graf, dopadová analýza, gaps, overlaps a analytické pohledy.',
            en: 'Service graph, C3 graph, impact analysis, gaps, overlaps and analytical views.',
        },
        keywords: ['analysis', 'analýza', 'analyza', 'graph', 'graf', 'impact', 'dopad', 'gaps', 'overlaps'],
    },
    {
        code: 'HELP-API',
        module_code: MODULE_CODES.CORE,
        slug: '11-api',
        title: { cs: 'API a integrace', en: 'API and integrations' },
        description: {
            cs: 'Export manifestu, import dry-run, API endpointy a integrační tok.',
            en: 'Export manifest, import dry-run, API endpoints and integration flow.',
        },
        keywords: ['api', 'integration', 'integrace', 'endpoint', 'export', 'manifest', 'dry-run'],
    },
    {
        code: 'HELP-ABBREVIATIONS',
        module_code: MODULE_CODES.CORE,
        slug: '12-abbrevations',
        title: { cs: 'Zkratky', en: 'Abbreviations' },
        description: {
            cs: 'Slovník zkratek, tooltipy a hledání používaných pojmů.',
            en: 'Glossary, abbreviation tooltips and search for common terms.',
        },
        keywords: ['abbreviation', 'abbrevations', 'zkratky', 'glossary', 'slovník', 'slovnik', 'tooltip'],
    },
]);

function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function tokenizeSearchQuery(query) {
    const parts = normalizeText(query).match(/[\p{L}\p{N}]+/gu) || [];
    const seen = new Set();
    const tokens = [];

    for (const part of parts) {
        if (part.length < 2 && !/^\d$/.test(part)) continue;
        if (seen.has(part)) continue;
        seen.add(part);
        tokens.push(part);
        if (tokens.length >= 8) break;
    }

    return tokens;
}

function textMatchesAllTokens(text, tokens) {
    if (!Array.isArray(tokens) || tokens.length === 0) return false;
    const normalized = normalizeText(text);
    return tokens.every((token) => normalized.includes(token));
}

function scoreTextFields(fields, tokens, normalizedQuery) {
    if (!textMatchesAllTokens(fields.join(' '), tokens)) return 0;

    let score = 20 + tokens.length * 5;
    fields.forEach((field, index) => {
        const normalized = normalizeText(field);
        if (!normalized) return;
        if (normalized === normalizedQuery) score += 80 - index * 5;
        else if (normalized.startsWith(normalizedQuery)) score += 55 - index * 4;
        else if (tokens.every((token) => normalized.includes(token))) score += 30 - index * 3;
        else if (tokens.some((token) => normalized.includes(token))) score += 8;
    });

    return score;
}

function trimDescription(value, maxLength = 240) {
    if (value == null) return null;
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function getGroupDefinition(key) {
    return GROUP_DEFINITIONS[key] || {
        label: key,
        module_code: MODULE_CODES.CORE,
        kind: 'module',
        order: 500,
    };
}

function normalizeSearchItem(item, groupDefinition) {
    const moduleCode = item.module_code || groupDefinition.module_code;
    const moduleDefinition = getModuleDefinition(moduleCode);

    return {
        source_key: item.source_key ?? item.code ?? null,
        code: item.code ?? '',
        title: item.title ?? item.code ?? '',
        description: trimDescription(item.description),
        subtitle: item.subtitle ?? moduleDefinition?.label ?? null,
        status: item.status ?? null,
        href: item.href,
        module_code: moduleCode,
        module_label: moduleDefinition?.label ?? groupDefinition.label,
        kind: item.kind ?? groupDefinition.kind,
    };
}

function createSearchGroup(key, items = [], overrides = {}) {
    const definition = {
        ...getGroupDefinition(key),
        ...overrides,
    };

    return {
        key,
        label: definition.label,
        module_code: definition.module_code,
        module_label: getModuleDefinition(definition.module_code)?.label ?? definition.label,
        kind: definition.kind,
        order: definition.order,
        items: items.map((item) => normalizeSearchItem(item, definition)),
    };
}

function buildGroupedSearchResponse(query, groups) {
    const visibleGroups = groups
        .filter((group) => Array.isArray(group.items) && group.items.length > 0)
        .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));

    return {
        query,
        total: visibleGroups.reduce((sum, group) => sum + group.items.length, 0),
        groups: visibleGroups,
    };
}

function scoreHelpItem(item, tokens, normalizedQuery, locale) {
    return scoreTextFields([
        item.code,
        item.title[locale] || item.title.en,
        item.description[locale] || item.description.en,
        item.keywords.join(' '),
    ], tokens, normalizedQuery);
}

function buildHelpSearchGroup(query, { locale = 'cs', limit = 5 } = {}) {
    const normalizedLocale = locale === 'en' ? 'en' : 'cs';
    const normalizedQuery = normalizeText(query);
    const tokens = tokenizeSearchQuery(query);
    const helpBase = normalizedLocale === 'en' ? '/help-en' : '/help-cs';

    const items = HELP_CHAPTERS
        .map((item) => ({
            item,
            score: scoreHelpItem(item, tokens, normalizedQuery, normalizedLocale),
        }))
        .filter(({ score }) => tokens.length > 0 && score > 0)
        .sort((left, right) => right.score - left.score || left.item.code.localeCompare(right.item.code))
        .slice(0, limit)
        .map(({ item }) => ({
            source_key: item.code,
            code: item.code,
            title: item.title[normalizedLocale] || item.title.en,
            description: item.description[normalizedLocale] || item.description.en,
            subtitle: getModuleDefinition(item.module_code)?.label ?? 'Help',
            href: `${helpBase}/${item.slug}`,
            module_code: item.module_code,
            kind: 'help',
        }));

    return createSearchGroup('help', items);
}

function scoreStaticPage(item, tokens, normalizedQuery) {
    return scoreTextFields([
        item.code,
        item.title,
        item.description,
        item.href,
        item.keywords.join(' '),
    ], tokens, normalizedQuery);
}

function buildStaticPageSearchGroups(query, { limit = 5, includeC3 = true, includeManagement = true } = {}) {
    const tokens = tokenizeSearchQuery(query);
    const normalizedQuery = normalizeText(query);
    if (tokens.length === 0) return [];

    const grouped = new Map();
    for (const page of STATIC_APP_PAGES) {
        if (!includeC3 && page.group_key === 'c3_pages') continue;
        if (!includeManagement && page.group_key === 'management_pages') continue;

        const score = scoreStaticPage(page, tokens, normalizedQuery);
        if (score <= 0) continue;

        if (!grouped.has(page.group_key)) grouped.set(page.group_key, []);
        grouped.get(page.group_key).push({ page, score });
    }

    return Array.from(grouped.entries()).map(([key, scoredPages]) => {
        const items = scoredPages
            .sort((left, right) => right.score - left.score || left.page.code.localeCompare(right.page.code))
            .slice(0, limit)
            .map(({ page }) => ({
                source_key: page.code,
                code: page.code,
                title: page.title,
                description: page.description,
                subtitle: getGroupDefinition(page.group_key).label,
                href: page.href,
            }));

        return createSearchGroup(key, items);
    });
}

module.exports = {
    MODULE_CODES,
    buildGroupedSearchResponse,
    buildHelpSearchGroup,
    buildStaticPageSearchGroups,
    createSearchGroup,
    tokenizeSearchQuery,
};
