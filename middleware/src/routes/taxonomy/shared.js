'use strict';

/** Constants, cache and small helpers shared by the taxonomy routes. */

const NodeCache = require('node-cache');
const { getPool } = require('../../db/pool');
const config = require('../../config');

const cache = new NodeCache({ stdTTL: config.cache.c3TaxonomyTtl });
const ALLOWED_C3_ITEM_TYPES = ['BP', 'BR', 'CI', 'CO', 'CP', 'CR', 'IP', 'UA', 'OTHER'];
const CAPABILITY_MAP_TITLE_KEY = 'c3.capability_map.title';
const CAPABILITY_MAP_TITLE_KEY_SPIRAL6 = 'c3.capability_map.title.spiral6';
const DEFAULT_CAPABILITY_MAP_TITLE = 'C3 Taxonomy Catalogue — Baseline 7';
const DEFAULT_CAPABILITY_MAP_TITLE_SPIRAL6 = 'C3 Taxonomy Catalogue — Baseline 6';
const DEFAULT_CAPABILITY_MAP_SPIRAL = 'Spiral_7';
const AIR_C2_LEGACY_SLUG = 'cap-bmc-air-bmc';
const AIR_C2_LEGACY_SLUG_FALLBACKS = [
    AIR_C2_LEGACY_SLUG,
    'cap-battlespace-management-air-battlespace-management',
];
const AIR_C2_LEGACY_SPIRAL = 'Spiral_5';
const AIR_C2_SUCCESSOR_ENDPOINT = `/api/v1/capabilities/by-slug/${AIR_C2_LEGACY_SLUG}/coverage?spiral=${AIR_C2_LEGACY_SPIRAL}`;
const C3_TAXONOMY_IMPORT_TARGETS = {
    capabilities: { label: 'C3 Capabilities', itemType: 'CP', sheetName: 'Capabilities' },
    'business-processes': { label: 'C3 Business Processes', itemType: 'BP', sheetName: 'Business Processes' },
    'business-roles': { label: 'C3 Business Roles', itemType: 'BR', sheetName: 'Business Roles' },
    'information-products': { label: 'C3 Information Products', itemType: 'IP', sheetName: 'Information Products' },
    'user-applications': { label: 'C3 User Applications', itemType: 'UA', sheetName: 'User Applications' },
    'coi-services': { label: 'C3 COI Services', itemType: 'CI', sheetName: 'COI Services' },
    'communications-services': { label: 'C3 Communication Services', itemType: 'CO', sheetName: 'Communications Services' },
    'core-services': { label: 'C3 Core Services', itemType: 'CR', sheetName: 'Core Services' },
};
const CAPABILITY_BUILDER_IMPORT_TARGET = {
    key: 'c3-capability-builder',
    label: 'C3 Capability Map',
    adminPath: '/administration/c3-capability-builder',
};
const REF_CACHE_KEYS = {
    portfolioGroups: ['ref_portfolio_groups', 'ref_global_service_groups'],
    serviceLines: ['ref_service_lines'],
    serviceTypes: ['ref_service_types'],
    securityClassifications: ['ref_security_classifications'],
    networkDomains: ['ref_network_domains'],
    organizationalElements: ['ref_organizational_elements'],
};



function invalidateC3CacheKeys() {
    const keys = cache.keys().filter((key) =>
        key.startsWith('c3_') ||
        key.startsWith('c3cap_') ||
        key.startsWith('c3_capmap') ||
        key.startsWith('c3_capbuilder')
    );
    if (keys.length > 0) cache.del(keys);
}

function invalidateRefCacheKeys(...groups) {
    const keys = groups.flatMap((group) => REF_CACHE_KEYS[group] ?? []);
    if (keys.length > 0) cache.del(keys);
}

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function isUniqueViolation(err) {
    return err?.code === '23505';
}

function resultRows(result) {
    if (!result) return [];
    return Array.isArray(result.rows) ? result.rows : [];
}

function resultRowCount(result) {
    if (!result) return 0;
    return typeof result.rowCount === 'number' ? result.rowCount : resultRows(result).length;
}

async function selectRows(pool, text, params = []) {
    const result = await pool.query(text, params);
    return resultRows(result);
}

async function selectOne(pool, text, params = []) {
    const rows = await selectRows(pool, text, params);
    return rows[0] ?? null;
}


function normalizeOptionalInt(value) {
    if (value == null || value === '') return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionalBool(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
    return null;
}


function normalizeLookupKey(key) {
    return String(key)
        .trim()
        .toLowerCase()
        .replace(/["']/g, '')
        .replace(/[\s/_-]+/g, ' ');
}

function normalizeCodeParam(value) {
    return String(value ?? '').trim();
}

function isXlsxParserError(err) {
    return String(err?.message ?? '').startsWith('XLSX parser:');
}

function isTruthyQuery(value) {
    return ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}


function parseDateSafe(value) {
    if (value == null || value === '') return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}


function hasOwn(body, key) {
    return body && Object.prototype.hasOwnProperty.call(body, key);
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the BIGINT ServiceCatalog.id for a given service_id string.
 * Throws an error with status 404 if the record does not exist.
 */
async function _getCatalogId(serviceIdStr) {
    const row = await selectOne(getPool(), `
        SELECT id
        FROM data.service_catalog
        WHERE service_id = $1
          AND is_deleted = FALSE
    `, [serviceIdStr]);
    const id = row?.id ?? null;
    if (!id) {
        const err = new Error(`ServiceCatalog not found: ${serviceIdStr}`);
        err.status = 404;
        throw err;
    }
    return id;
}

module.exports = {
    cache,
    ALLOWED_C3_ITEM_TYPES,
    CAPABILITY_MAP_TITLE_KEY,
    CAPABILITY_MAP_TITLE_KEY_SPIRAL6,
    DEFAULT_CAPABILITY_MAP_TITLE,
    DEFAULT_CAPABILITY_MAP_TITLE_SPIRAL6,
    DEFAULT_CAPABILITY_MAP_SPIRAL,
    AIR_C2_LEGACY_SLUG,
    AIR_C2_LEGACY_SLUG_FALLBACKS,
    AIR_C2_LEGACY_SPIRAL,
    AIR_C2_SUCCESSOR_ENDPOINT,
    C3_TAXONOMY_IMPORT_TARGETS,
    CAPABILITY_BUILDER_IMPORT_TARGET,
    REF_CACHE_KEYS,
    invalidateC3CacheKeys,
    invalidateRefCacheKeys,
    createHttpError,
    isUniqueViolation,
    resultRows,
    resultRowCount,
    selectRows,
    selectOne,
    normalizeOptionalInt,
    normalizeOptionalBool,
    normalizeLookupKey,
    normalizeCodeParam,
    isXlsxParserError,
    isTruthyQuery,
    parseDateSafe,
    hasOwn,
    _getCatalogId,
};
