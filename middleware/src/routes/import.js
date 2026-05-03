'use strict';
/**
 * routes/import.js — bulk data import
 *
 * POST /api/v1/import/services
 *   Body:
 *     {
 *       items: Array<ServiceObject>,
 *       relations?: Array<RelationObject>
 *     }
 *
 * Each item may contain:
 *   - ServiceCatalog fields (service_id / serviceId, title, service_type / serviceType, ...)
 *   - flavours: Array<ServiceFlavourObject> — upsert into ServiceFlavour
 *   - relations: Array<ServiceRelationObject> — upsert into ServiceRelation
 *   - c3_uuid / c3Uuid ... — upsert into ServiceC3Mapping
 *
 * Behavior:
 *   - INSERT when service_id does not exist
 *   - UPDATE when service_id already exists
 *   - Flavours are upserted by service_id
 *   - Relations are upserted by (from_service_id, to_service_id, relation_type)
 *   - If item has no relations[] but has prerequisites, fallback depends_on relations are created
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const repo = require('../db/services.repo');
const importRepo = require('../db/import.repo');
const flRepo = require('../db/flavours.repo');
const relRepo = require('../db/relations.repo');
const audit = require('../db/audit.repo');
const { parseFlavours } = require('../parsers/flavourParser');
const { parseSla }      = require('../parsers/slaParser');
const { getProfile, listProfiles } = require('../utils/service-catalogue-profile');
const { parseBackstageCatalogInfo } = require('../utils/backstage-catalog');

const { requireAuth } = require('../middleware/auth');
const { canEdit } = require('../middleware/rbac');
const { getPool } = require('../db/pool');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');
const { tReq } = require('../utils/i18n');

// Stricter import limit: max 10 requests per 5 minutes per IP.
const importLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: (req) => ({ error: tReq(req, 'import.rate_limit') })
});

// CSV text parser: no new dependency, just express.text().
const csvTextParser = require('express').text({ type: ['text/csv', 'text/plain'], limit: '5mb' });

router.use(requireAuth);

router.get('/profiles', async (req, res) => {
  res.json({ items: listProfiles() });
});

/**
 * Safely parses a date and returns Date or null.
 * Handles SharePoint formats: ISO 8601, "2023-12-01T10:00:00" without TZ, "01.12.2023", "12/1/2023", etc.
 * The DB layer rejects anything that is not a valid JS Date.
 */
function _parseDateSafe(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  if (!s) return null;
  // OData v2: /Date(epoch_ms)/ nebo /Date(epoch_ms+0000)/
  const msMatch = s.match(/^\/Date\((-?\d+)[+-]?\d*\)\/$/);
  if (msMatch) {
    const d = new Date(parseInt(msMatch[1], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  // SP null sentinel
  if (s === '0001-01-01T00:00:00' || s === '0001-01-01T00:00:00Z') return null;
  // ISO 8601 without timezone: add Z (UTC).
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    const d = new Date(s + 'Z');
    return isNaN(d.getTime()) ? null : d;
  }
  // Date + time with a space (for example "2024-01-15 10:30:00").
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    const d = new Date(s.replace(' ', 'T') + 'Z');
    return isNaN(d.getTime()) ? null : d;
  }
  // Generic fallback attempt.
  const d = new Date(s);
  if (isNaN(d.getTime())) {
    logger.warn({ dateVal: s }, 'import: unparsable date format; storing null');
    return null;
  }
  return d;
}

/**
 * Loads codes from reference tables and builds lookup maps.
 * Called once before the import loop, so the batch uses a fixed number of DB queries.
 * @returns {{ globalServiceGroup, serviceLine, organizationalElement, networkDomain }}
 *          each object: { codes: Set<string>, byName: Map<string,string> }
 */
async function _loadTaxonomyMaps() {
  const pool = getPool();
  const [gsg, sl, oe, nd, pg, st, ss, sc] = await Promise.all([
    pool.query('SELECT code, LOWER(name) AS name_lc FROM data.ref_global_service_group'),
    pool.query('SELECT code, LOWER(name) AS name_lc FROM data.ref_service_line'),
    pool.query('SELECT code, LOWER(name) AS name_lc FROM data.ref_organizational_element'),
    pool.query('SELECT code, LOWER(name) AS name_lc FROM data.ref_network_domain'),
    pool.query(`
      SELECT code, LOWER(name_lc) AS name_lc
      FROM (
        SELECT code, name AS name_lc
        FROM data.ref_portfolio_group
        WHERE is_active = TRUE
        UNION
        SELECT portfolio_group_code AS code, alias_key AS name_lc
        FROM data.ref_portfolio_group_alias
        WHERE is_active = TRUE
      ) src
    `),
    pool.query('SELECT code, LOWER(name) AS name_lc FROM data.ref_service_type'),
    pool.query('SELECT code, LOWER(name) AS name_lc FROM data.ref_service_status'),
    pool.query('SELECT code, LOWER(name) AS name_lc FROM data.ref_security_classification'),
  ]);
  const toMap = (rs) => ({
    codes:  new Set(rs.rows.map(r => r.code)),
    byName: new Map(rs.rows.map(r => [r.name_lc, r.code])),
  });
  return {
    globalServiceGroup:       toMap(gsg),
    serviceLine:              toMap(sl),
    organizationalElement:    toMap(oe),
    networkDomain:            toMap(nd),
    portfolioGroup:           toMap(pg),
    serviceType:              toMap(st),
    serviceStatus:            toMap(ss),
    securityClassification:   toMap(sc),
  };
}

/**
 * Normalizes one "Available Networks" token and maps it to a ref_NetworkDomain code.
 *
 * Source data is free text; this handles:
 *  - list markery:  "- Orbit" / "• Pulse" / "1. NEXUS"
 *  - trailing punct: "Orbit;" / "Vertex,"
 *  - parentheses:    "Nexus (including relay)" → "Nexus"
 *  - dash suffix:    "Orbit – only wired" / "ORBIT (REL) – something"
 *  - caps:           "NEXUS" → NEXUS (case-insensitive name match)
 *  - ref codes:      "ORBIT (REL)" → strip → "ORBIT" → exact code match
 *
 * When no match is found, returns null (no FK constraint is triggered; the token is dropped).
 */
// ── Group F: auxiliary module codes ───────────────────────────────────────────
const _GROUP_F_JTLS = new Set([
  'dds', 'sip', 'icp', 'cep', 'mod-a', 'jxsr', 'oma', 'xms',
  'synapse', 'mod-b', 'sdc', 'oec', 'mod-c', 'ovt', 'ato-t',
]);

// ── Group G: specialized program codes ────────────────────────────────────────
const _GROUP_G_PROGRAMS = new Set([
  'prog-a', 'prog-b', 'prog-c', 'prog-d', 'prog-e', 'ais',
  'prog-f', 'prog-g', 'prog-h',
]);

/**
 * Classifies and routes unresolved "Available Networks" tokens to the correct fields.
 *
 * Group F (auxiliary modules)         → item.service_features (append)
 * Group G (program codes)             → item.notes (append; repo.create/update uses data.notes)
 * Group E / D fallback (everything else) → item.service_cost_raw (append, with prefix)
 *
 * Called before repo.update/create so appended values are stored in a single write.
 */
function _routeUnresolvedToFields(item, tokens) {
  const fParts = [], gParts = [], eParts = [];
  for (const tok of tokens) {
    const lc = tok.toLowerCase();
    if (_GROUP_F_JTLS.has(lc)) {
      fParts.push(tok);
    } else if (_GROUP_G_PROGRAMS.has(lc)) {
      gParts.push(tok);
    } else {
      eParts.push(tok);
    }
  }
  if (fParts.length > 0) {
    item.service_features = [item.service_features, fParts.join(', ')].filter(Boolean).join('\n');
  }
  if (gParts.length > 0) {
    // repo.create/update expect `data.notes` (colMap: notes → notes_json); also sync notes_json
    const existing = typeof item.notes === 'string' ? item.notes
                   : typeof item.notes_json === 'string' ? item.notes_json
                   : item.notes ? JSON.stringify(item.notes) : null;
    const appended = [existing, gParts.join(', ')].filter(Boolean).join('\n');
    item.notes = appended;
    item.notes_json = appended;
  }
  if (eParts.length > 0) {
    item.service_cost_raw = [
      item.service_cost_raw,
      '[Available Networks — unresolved tokens]\n' + eParts.join('; '),
    ].filter(Boolean).join('\n');
  }
}

function _resolveDomainCode(val, map) {
  if (val == null) return null;
  // Strip invisible chars (zero-width space U+200B, BOM U+FEFF, NBSP U+00A0)
  // and list markers / numbering / trailing punctuation.
  let s = String(val)
    .replace(/[\u200B\uFEFF\u00A0\u200C\u200D]+/g, ' ')  // invisible chars → space
    .trim()
    .replace(/^[-–—*•·]\s*/, '')           // leading bullet / dash
    .replace(/^\[\d+\]\s*/, '')             // leading "[1] " / "[2]"
    .replace(/^\d+[.)]\s*/, '')             // leading "1. " / "1) "
    .replace(/[;:,]+$/, '')                 // trailing ; : ,
    .trim();
  if (!s) return null;
  const lc = s.toLowerCase();
  // Skip generic tokens.
  // "internet" and "hybrid" are now real DB codes (INT / Hybrid) — not skipped here.
  // "public cloud" remains skipped (too vague; "Cloud" code already covers cloud access).
  if (/^(available on[*:]?|service available on[*:]?|n\/a|na|standalone|public cloud)$/i.test(s)) return null;

  // 1) Exact code match (NEXUS, VERTEX, ORBIT, RELAY, CLOUD, ...)
  if (map.codes.has(s)) return s;

  // 2) Exact name match (case-insensitive)
  const byExactName = map.byName.get(lc);
  if (byExactName) return byExactName;

  // 3a) Strip parentheses and everything after them: "Nexus (including relay)" → "Nexus"
  //     Strip "[exceptional...]": "Vertex [exceptional...]" → "Vertex"
  const strippedParens = s
    .replace(/\s*[\[(][^\])\n]*[\])].*$/, '')
    .trim();
  if (strippedParens && strippedParens !== s) {
    if (map.codes.has(strippedParens)) return strippedParens;
    const byP = map.byName.get(strippedParens.toLowerCase());
    if (byP) return byP;
  }

  // 3b) Strip en-dash/em-dash + suffix: "Orbit – only wired" → "Orbit"
  const strippedDash = s.replace(/\s*[–—]\s*.+$/, '').trim();
  if (strippedDash && strippedDash !== s) {
    if (map.codes.has(strippedDash)) return strippedDash;
    const byD = map.byName.get(strippedDash.toLowerCase());
    if (byD) return byD;
    // Parentheses remaining after dash stripping.
    const strippedBoth = strippedDash.replace(/\s*[\[(][^\])\n]*[\])].*$/, '').trim();
    if (strippedBoth && strippedBoth !== strippedDash) {
      if (map.codes.has(strippedBoth)) return strippedBoth;
      const byB = map.byName.get(strippedBoth.toLowerCase());
      if (byB) return byB;
    }
  }

  // 3c) Part after an en dash: "Secure RAP – ORBIT" → try "ORBIT".
  const afterDashMatch = s.match(/[–—]\s*(.+)$/);
  if (afterDashMatch) {
    const afterDash = afterDashMatch[1].replace(/[;:,]+$/, '').trim();
    if (afterDash) {
      if (map.codes.has(afterDash)) return afterDash;
      const byAfter = map.byName.get(afterDash.toLowerCase());
      if (byAfter) return byAfter;
      for (const [nameLc, code] of map.byName.entries()) {
        if (afterDash.toLowerCase().startsWith(nameLc)) return code;
      }
    }
  }

  // 4) Prefix match: SharePoint token starts with the full domain name.
  for (const [nameLc, code] of map.byName.entries()) {
    if (lc.startsWith(nameLc)) return code;
  }

  // 5) Prefix match through codes: "NU (REL)", "NS/MS", etc.
  for (const code of map.codes) {
    const codeLc = code.toLowerCase();
    if (lc === codeLc || lc.startsWith(codeLc + ' ') || lc.startsWith(codeLc + '(')) return code;
  }

  logger.warn({ domainVal: s }, 'import: unknown domain value; skipping');
  return null;
}

/**
 * If val is a valid code present in the reference table, returns val.
 * Otherwise tries a full-name lookup (case-insensitive).
 * If name lookup also fails, returns null and avoids triggering an FK constraint.
 */
function _resolveCode(val, map) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  if (map.codes.has(s)) return s;                         // exact code match
  return map.byName.get(s.toLowerCase()) ?? null;         // name lookup or null
}

function _jsonAuditValue(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const _PORTFOLIO_ALIASES = new Map([
  ['application service', 'Application Services'],
  ['application services', 'Application Services'],
  ['infrastructure service', 'Infrastructure Services'],
  ['infrastructure services', 'Infrastructure Services'],
  ['platform service', 'Platform Services'],
  ['platform services', 'Platform Services'],
  ['platform service s', 'Platform Services'],
  ['security service', 'Security Services'],
  ['security services', 'Security Services'],
  ['subject matter expertise service', 'Subject Matter Expertise Services'],
  ['subject matter expertise services', 'Subject Matter Expertise Services'],
  ['training service', 'Training Services'],
  ['training services', 'Training Services'],
  ['workplace service', 'Workplace Services'],
  ['workplace services', 'Workplace Services'],
  ['digital workplace services', 'Digital Workplace Services'],
  ['logistic services', 'Logistic Services'],
  ['other services', 'Other Services'],
]);

function _normalizeLooseRefLabel(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\r/g, '\n')
    .split('\n')[0]
    .replace(/\s+/g, ' ')
    .replace(/[“”"]/g, '')
    .trim();
}

function _resolvePortfolioGroupCode(val, map) {
  const direct = _resolveCode(val, map);
  if (direct) return direct;
  const normalized = _normalizeLooseRefLabel(val);
  if (!normalized) return null;
  const alias = _PORTFOLIO_ALIASES.get(normalized.toLowerCase()) ?? normalized;
  return _resolveCode(alias, map);
}

function _resolveServiceTypeCode(val, map) {
  const direct = _resolveCode(val, map);
  if (direct) return direct;
  const normalized = _normalizeLooseRefLabel(val).toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('customer facing/support') || normalized.includes('customer support')) return 'CFS';
  if (normalized.includes('customer facing')) return 'CF';
  if (normalized.includes('enabling')) return 'ES';
  if (normalized.includes('supporting')) return 'SS';
  if (normalized.includes('managed')) return 'MS';
  if (normalized.includes('advisory')) return 'AS';
  return null;
}

function _mapThreeTableImportPayload(body) {
  if (!body || typeof body !== 'object') return null;
  if (!Array.isArray(body.ServiceCatalog)) return null;

  const itemsByServiceId = new Map();
  for (const row of body.ServiceCatalog) {
    const serviceId = row.ServiceID ?? row.service_id ?? row.serviceId ?? null;
    if (!serviceId) continue;
    itemsByServiceId.set(serviceId, {
      service_id: serviceId,
      title: row.Title ?? row.title ?? null,
      portfolio_group_code: row.PortfolioGroup ?? row.portfolio_group ?? null,
      service_type: row.ServiceType ?? row.service_type ?? null,
      service_owner: row.ServiceOwner ?? row.service_owner ?? null,
      service_status: row.ServiceStatus ?? row.service_status ?? null,
      catalogue_version: row.CatalogueVersion ?? row.catalogue_version ?? null,
      value_proposition: row.ValueProposition ?? row.value_proposition ?? null,
      service_features: row.ServiceFeatures ?? row.service_features ?? null,
      summary: row.Summary ?? row.summary ?? null,
      detailed_description: row.DetailedDescription ?? row.detailed_description ?? null,
      unit_of_measure: row.UnitOfMeasure ?? row.unit_of_measure ?? null,
      charging_basis: row.ChargingBasis ?? row.charging_basis ?? null,
      rate_note: row.RateNote ?? row.rate_note ?? null,
      ordering_note: row.OrderingNote ?? row.ordering_note ?? null,
      exclusions: row.Exclusions ?? row.exclusions ?? null,
      service_area: row.ServiceArea ?? row.service_area ?? null,
      security_classification: row.SecurityClassification ?? row.security_classification ?? null,
      available_on: row.AvailableOn ?? row.available_on ?? null,
      customer_type: row.CustomerType ?? row.customer_type ?? null,
      sla_availability: row.SlaAvailability ?? row.sla_availability ?? null,
      sla_delivery: row.SlaDelivery ?? row.sla_delivery ?? null,
      sla_restoration: row.SlaRestoration ?? row.sla_restoration ?? null,
      source_url: row.SourceUrl ?? row.source_url ?? null,
      training_refs: row.TrainingRefs ?? row.training_refs ?? null,
      retired_note: row.RetiredNote ?? row.retired_note ?? null,
      prerequisites_json: row.RawPrerequisites ?? row.Prerequisites ?? row.prerequisites_json ?? null,
      notes_json: row.ParseStatus ? JSON.stringify({ parse_status: row.ParseStatus }) : null,
      flavours: [],
    });
  }

  if (Array.isArray(body.ServiceFlavours)) {
    for (const flavour of body.ServiceFlavours) {
      const serviceId = flavour.ServiceID ?? flavour.service_id ?? flavour.serviceId ?? null;
      const parent = serviceId ? itemsByServiceId.get(serviceId) : null;
      if (!parent) continue;
      parent.flavours.push({
        flavour_id: flavour.FlavourID ?? flavour.flavour_id ?? flavour.flavourId ?? null,
        title: flavour.Title ?? flavour.title ?? null,
        service_unit: flavour.ServiceUnit ?? flavour.service_unit ?? null,
        service_rate_eur: flavour.ServiceRateEUR ?? flavour.service_rate_eur ?? null,
        dependency_text: flavour.DependencyText ?? flavour.dependency_text ?? null,
        short_note: flavour.ShortNote ?? flavour.short_note ?? null,
        flavour_status: flavour.FlavourStatus ?? flavour.flavour_status ?? null,
        pricing_note_raw: flavour.RateRaw ?? flavour.pricing_note_raw ?? null,
      });
    }
  }

  const relations = Array.isArray(body.ServiceRelations)
    ? body.ServiceRelations.map((relation) => ({
        from_service_id: relation.FromServiceID ?? relation.from_service_id ?? relation.fromServiceId ?? null,
        to_service_id: relation.ToServiceID ?? relation.to_service_id ?? relation.toServiceId ?? null,
        relation_type: relation.RelationType ?? relation.relation_type ?? 'prerequisite',
        relation_label: relation.RelationLabel ?? relation.relation_label ?? null,
        relation_note: relation.Notes ?? relation.relation_note ?? null,
        source_field: relation.SourceField ?? relation.source_field ?? 'ServiceRelations',
      }))
    : [];

  return {
    items: [...itemsByServiceId.values()],
    relations,
    source: '3-table-json',
  };
}

function _extractImportPayload(body) {
  if (Array.isArray(body?.items)) {
    return {
      items: body.items,
      relations: Array.isArray(body.relations) ? body.relations : [],
      source: 'json-items',
    };
  }
  return _mapThreeTableImportPayload(body);
}

function _profileKeyFromReq(req, fallback = 's3c-service-catalogue-json') {
  return req.query.profile || req.query.profile_key || req.body?.profile || req.body?.profile_key || fallback;
}

function _extractProfileImportPayload(req, fallback = 's3c-service-catalogue-json') {
  const profile = getProfile(_profileKeyFromReq(req, fallback), fallback);
  if (profile.mode !== 'direct') {
    const err = new Error(`Unsupported import profile: ${profile.key} is reference-only`);
    err.status = 400;
    throw err;
  }

  if (profile.key === 'backstage-catalog-info') {
    const yaml = req.body?.catalog_info_yaml || req.body?.catalogInfoYaml || req.body?.yaml || req.body?.content;
    if (!yaml) {
      const err = new Error('catalog_info_yaml is required for backstage-catalog-info');
      err.status = 400;
      throw err;
    }
    return {
      profile,
      payload: parseBackstageCatalogInfo(yaml),
    };
  }

  return {
    profile,
    payload: _extractImportPayload(req.body),
  };
}

function _csvProfileFromReq(req) {
  const profile = getProfile(_profileKeyFromReq(req, 's3c-service-catalogue-csv'), 's3c-service-catalogue-csv');
  if (profile.key !== 's3c-service-catalogue-csv') {
    const err = new Error(`Unsupported CSV import profile: ${profile.key}`);
    err.status = 400;
    throw err;
  }
  return profile;
}

function _missingRequiredFields(actualFields = [], requiredFields = []) {
  const normalizedActual = new Set(actualFields.map((field) => String(field).trim().toLowerCase()).filter(Boolean));
  return requiredFields.filter((field) => !normalizedActual.has(String(field).trim().toLowerCase()));
}

async function _ensureServiceStub(serviceId, username) {
  if (!serviceId) return;
  if (await repo.serviceIdExists(serviceId)) return;
  await repo.create({
    service_id: serviceId,
    title: `External reference ${serviceId}`,
    service_status: 'external_reference',
    is_stub: true,
    notes: `Auto-created stub during relation import for ${serviceId}`,
  }, username);
}

function _collectExplicitRelations(items, topLevelRelations = []) {
  const nestedRelations = items.flatMap((rawItem) => {
    const item = normalizeImportItem(rawItem);
    const nested = Array.isArray(rawItem.relations) ? rawItem.relations : Array.isArray(item.relations) ? item.relations : [];
    return nested.map((relation) => normalizeImportRelation(relation, item.service_id));
  });
  return [
    ...nestedRelations,
    ...topLevelRelations.map((relation) => normalizeImportRelation(relation)),
  ].filter((relation) => relation.from_service_id && relation.to_service_id);
}

function _collectReferencedIdsFromItem(item) {
  const prereqIds = [...new Set([
    ...normalizeArrayMaybe(item.prerequisites),
    ...normalizeArrayMaybe(item.prerequisites_json),
  ].filter(Boolean))];
  const underlyingIds = _extractServiceIds(item.underlying_services);
  const previousIds = _extractServiceIds(item.previous_service);
  return {
    prereqIds,
    underlyingIds,
    previousIds,
  };
}

function _pushUnresolvedRef(list, kind, serviceId, rawValue) {
  list.push({
    kind,
    service_id: serviceId,
    raw_value: String(rawValue),
  });
}

function _serializeSafe(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function _hashSha256(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function _parseCsvText(csvText, translate = (key) => key) {
  const normalized = typeof csvText === 'string' ? csvText.replace(/^\uFEFF/, '') : '';
  if (!normalized.trim()) {
    return { error: translate('import.errors.csv_text_required') };
  }

  const lines = normalized.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return { error: translate('import.errors.csv_requires_header') };
  }

  const delim = lines[0].split(';').length >= lines[0].split(',').length ? ';' : ',';
  const headers = _parseCsvLine(lines[0], delim).map((header) => header.trim());
  const items = lines.slice(1).map((line) => {
    const values = _parseCsvLine(line, delim);
    const obj = {};
    headers.forEach((header, index) => { obj[header] = (values[index] ?? '').trim() || null; });
    return obj;
  });

  return { items, normalized, headers };
}

function _buildImportDryRun(items, relations, taxonomyMaps, sourceKind = 'json-items', sourceName = 'api-import') {
  const normalizedItems = items.map((rawItem) => normalizeImportItem(rawItem));
  const serviceIds = new Set(normalizedItems.map((item) => item.service_id).filter(Boolean));
  const explicitRelations = _collectExplicitRelations(items, relations);
  const missingTargets = new Set();
  const unresolvedRefs = [];
  let flavourCount = 0;
  let rawPrerequisiteCount = 0;

  for (const item of normalizedItems) {
    const rawPortfolioGroup = item.portfolio_group_code;
    const rawServiceType = item.service_type;
    const rawServiceStatus = item.service_status;
    const rawSecurityClassification = item.security_classification;

    if (rawPortfolioGroup && !_resolvePortfolioGroupCode(rawPortfolioGroup, taxonomyMaps.portfolioGroup)) {
      _pushUnresolvedRef(unresolvedRefs, 'portfolio_group', item.service_id, rawPortfolioGroup);
    }
    if (rawServiceType && !_resolveServiceTypeCode(rawServiceType, taxonomyMaps.serviceType)) {
      _pushUnresolvedRef(unresolvedRefs, 'service_type', item.service_id, rawServiceType);
    }
    if (rawServiceStatus && !_resolveCode(rawServiceStatus, taxonomyMaps.serviceStatus)) {
      _pushUnresolvedRef(unresolvedRefs, 'service_status', item.service_id, rawServiceStatus);
    }
    if (rawSecurityClassification && !_resolveCode(rawSecurityClassification, taxonomyMaps.securityClassification)) {
      _pushUnresolvedRef(unresolvedRefs, 'security_classification', item.service_id, rawSecurityClassification);
    }

    flavourCount += Array.isArray(item.flavours) ? item.flavours.length : 0;

    if (item.available_on) {
      const rawList = Array.isArray(item.available_on)
        ? item.available_on
        : String(item.available_on).split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
      for (const token of rawList) {
        if (!_resolveDomainCode(token, taxonomyMaps.networkDomain)) {
          const cleanToken = _normalizeLooseRefLabel(token);
          if (cleanToken) _pushUnresolvedRef(unresolvedRefs, 'network_domain', item.service_id, cleanToken);
        }
      }
    }

    const { prereqIds, underlyingIds, previousIds } = _collectReferencedIdsFromItem(item);
    rawPrerequisiteCount += prereqIds.length;
    for (const refId of [...prereqIds, ...underlyingIds, ...previousIds]) {
      if (refId && !serviceIds.has(refId)) missingTargets.add(refId);
    }
  }

  for (const relation of explicitRelations) {
    if (relation.from_service_id && !serviceIds.has(relation.from_service_id)) missingTargets.add(relation.from_service_id);
    if (relation.to_service_id && !serviceIds.has(relation.to_service_id)) missingTargets.add(relation.to_service_id);
  }

  return {
    source_name: sourceName,
    source_kind: sourceKind,
    item_count: normalizedItems.length,
    flavour_count: flavourCount,
    explicit_relation_count: explicitRelations.length,
    raw_prerequisite_count: rawPrerequisiteCount,
    missing_target_count: missingTargets.size,
    stub_count: missingTargets.size,
    unresolved_ref_count: unresolvedRefs.length,
    missing_targets: [...missingTargets].sort(),
    unresolved_refs: unresolvedRefs,
  };
}

function _buildParsedFlavourAudit(parsedFlavours) {
  return parsedFlavours.map((flavour) => ({
    flavour_code: flavour.flavourCode,
    title: flavour.title ?? null,
    service_unit: flavour.serviceUnit ?? null,
    price_value: flavour.priceValue ?? null,
    currency_code: flavour.currencyCode ?? null,
  }));
}

function _buildParsedSlaAudit(sla) {
  if (!sla) return null;
  return {
    availability_pct: sla.availabilityPct ?? null,
    restoration_hours: sla.restorationHours ?? null,
    delivery_days: sla.deliveryDays ?? null,
    support_window_code: sla.supportWindowCode ?? null,
    source_field: sla.sourceField ?? null,
  };
}

function normalizeImportItem(item) {
  return {
    ...item,
    // ── Identity ──────────────────────────────────────────────────────────────
    service_id: item.service_id ?? item.serviceId ?? item.ServiceID ?? null,
    // title: camelCase, SharePoint "Name of Service", or "serviceName" from JSON export.
    title: item.title ?? item.Title ?? item.serviceName ?? item['Name of Service'] ?? null,
    // ── Taxonomy ──────────────────────────────────────────────────────────────
    service_type: item.service_type ?? item.serviceType ?? item.ServiceType ?? item['CP Service Type'] ?? item['Service Type'] ?? null,
    service_status: item.service_status ?? item.serviceStatus ?? item.ServiceStatus ?? item['Service Status'] ?? null,
    catalogue_version: item.catalogue_version ?? item.catalogueVersion ?? item.CatalogueVersion ?? null,
    // taxonomy FK: maps SharePoint headers and camelCase.
    global_service_group_code: item.global_service_group_code ?? item.globalServiceGroup ?? item['Global Service Group'] ?? null,
    service_line_code: item.service_line_code ?? item.serviceLine ?? item['Service Line'] ?? null,
    organizational_element_code: item.organizational_element_code ?? item.organizationalElement ?? item['Organizational Element'] ?? null,
    portfolio_group_code: item.portfolio_group_code ?? item.portfolio_group ?? item.PortfolioGroup ?? item['Portfolio Group'] ?? null,
    // ── Ownership ─────────────────────────────────────────────────────────────
    service_owner: item.service_owner ?? item.serviceOwner ?? item.ServiceOwner ?? item['Service Owner'] ?? null,
    service_area_owner:       item.service_area_owner       ?? item.vlastnik ?? null,
    service_delivery_manager: item.service_delivery_manager ?? item.manager  ?? null,
    // ── Description ───────────────────────────────────────────────────────────
    value_proposition: item.value_proposition ?? item.valueProposition ?? item.ValueProposition ?? item['Value Added'] ?? null,
    service_features: item.service_features ?? item.serviceFeatures ?? item.ServiceFeatures ?? item['Service Features'] ?? null,
    // truncated to 1000 chars — matches short_description NVarChar(1000) column limit
    summary: ((item.summary ?? item.Summary ?? item['Service Description']) || null)?.substring(0, 1000) ?? null,
    detailed_description: item.detailed_description ?? item.detailedDescription ?? item.DetailedDescription ?? item['Additional Information'] ?? null,
    // ── Operations / availability ─────────────────────────────────────────────
    unit_of_measure: item.unit_of_measure ?? item.unitOfMeasure ?? item.UnitOfMeasure ?? null,
    charging_basis: item.charging_basis ?? item.chargingBasis ?? item.ChargingBasis ?? null,
    rate_note: item.rate_note ?? item.rateNote ?? item.RateNote ?? null,
    ordering_note: item.ordering_note ?? item.orderingNote ?? item.OrderingNote ?? null,
    exclusions: item.exclusions ?? item.Exclusions ?? null,
    service_area: item.service_area ?? item.serviceArea ?? item.ServiceArea ?? null,
    security_classification: item.security_classification ?? item.securityClassification ?? item.SecurityClassification ?? null,
    // available_on: array, CSV, or multiline text (Available Networks in SharePoint).
    available_on: item.available_on ?? item.availableOn ?? item.AvailableOn ?? item['Available Networks'] ?? null,
    customer_type: item.customer_type ?? item.customerType ?? item.CustomerType ?? null,
    source_url: item.source_url ?? item.sourceUrl ?? item.SourceUrl ?? null,
    // ── SLA ───────────────────────────────────────────────────────────────────
    sla_availability: item.sla_availability ?? item.slaAvailability ?? item.SlaAvailability ?? null,
    sla_restoration: item.sla_restoration ?? item.slaRestoration ?? item.SlaRestoration ?? null,
    sla_delivery: item.sla_delivery ?? item.slaDelivery ?? item.SlaDelivery ?? null,
    // ── Raw text fields (SharePoint export) ───────────────────────────────────
    support_availability_raw: item.support_availability_raw ?? item['Support Availability'] ?? null,
    service_cost_raw: item.service_cost_raw ?? item['Service Cost'] ?? null,
    // ── Graf ──────────────────────────────────────────────────────────────────
    graph_x: item.graph_x ?? item.graphX ?? null,
    graph_y: item.graph_y ?? item.graphY ?? null,
    // ── Relations / prerequisites ─────────────────────────────────────────────
    prerequisites_json: item.prerequisites_json ?? item.prerequisites ?? item.RawPrerequisites ?? item['Prerequisites'] ?? null,
    dependencies_json: item.dependencies_json ?? item.dependencies ?? null,
    // Underlying Services and Previous Service are separate SharePoint columns for underlying/replaces types.
    underlying_services: item.underlying_services ?? item.underlyingServices ?? item['Underlying Services'] ?? null,
    previous_service:    item.previous_service    ?? item.previousService    ?? item['Previous Service']    ?? null,
    // ── Additional JSON fields ────────────────────────────────────────────────
    options_json: item.options_json ?? item.options ?? null,
    notes_json: item.notes_json ?? item.notes ?? null,
    training_refs: item.training_refs ?? item.trainingRefs ?? item.TrainingRefs ?? null,
    retired_note: item.retired_note ?? item.retiredNote ?? item.RetiredNote ?? null,
    // ── Source tracking ───────────────────────────────────────────────────────
    source_local_id: item.source_local_id ?? item.localId ?? item.itemId ?? null,
    source_sp_id: item.source_sp_id ?? item.spId ?? null,
    source_etag: item.source_etag ?? item.etag ?? null,
    // Date fields: _parseDateSafe() normalizes SharePoint formats into a valid Date or null.
    // The DB layer raises a validation error for anything that is not a Date/ISO string.
    created_at_source:  _parseDateSafe(item.created_at_source  ?? item.createdAtSource  ?? item.Created),
    modified_at_source: _parseDateSafe(item.modified_at_source ?? item.modifiedAtSource ?? item.Modified),
  };
}

function normalizeImportFlavour(fl) {
  return {
    ...fl,
    flavour_id: fl.flavour_id ?? fl.flavourId ?? null,
    title: fl.title ?? null,
    service_unit: fl.service_unit ?? fl.serviceUnit ?? fl.unit ?? null,
    service_rate_eur: fl.service_rate_eur ?? fl.serviceRateEUR ?? fl.rate_eur ?? null,
    initiation_cost: fl.initiation_cost ?? fl.initiationCost ?? null,
    lifecycle_cost: fl.lifecycle_cost ?? fl.lifecycleCost ?? null,
    lifetime_years: fl.lifetime_years ?? fl.lifetimeYears ?? null,
    nations_rate: fl.nations_rate ?? fl.nationsRate ?? null,
    dependency_text: fl.dependency_text ?? fl.dependencyText ?? null,
    short_note: fl.short_note ?? fl.shortNote ?? fl.note ?? null,
    flavour_status: fl.flavour_status ?? fl.flavourStatus ?? null,
  };
}

function normalizeImportRelation(rel, fallbackFromServiceId = null) {
  return {
    ...rel,
    from_service_id: rel.from_service_id ?? rel.fromServiceId ?? fallbackFromServiceId ?? null,
    to_service_id: rel.to_service_id ?? rel.toServiceId ?? null,
    relation_type: rel.relation_type ?? rel.relationType ?? 'depends_on',
    relation_label: rel.relation_label ?? rel.relationLabel ?? null,
    pace_code: rel.pace_code ?? rel.paceCode ?? null,
    is_mandatory: rel.is_mandatory ?? rel.isMandatory ?? true,
    impact_mode: rel.impact_mode ?? rel.impactMode ?? 'hard_stop',
    impact_level: rel.impact_level ?? rel.impactLevel ?? 'high',
    relation_note: rel.relation_note ?? rel.relationNote ?? null,
  };
}

function normalizeArrayMaybe(val) {
  if (Array.isArray(val)) return val;
  if (val == null || val === '') return [];
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return _extractServiceIds(val);
    }
  }
  return [];
}

async function upsertRelationsForService(serviceId, relations, username, errors) {
  if (!Array.isArray(relations) || relations.length === 0) return;

  const existingRelations = await relRepo.findByService(serviceId);

  for (const rawRel of relations) {
    try {
      const rel = normalizeImportRelation(rawRel, serviceId);

      if (!rel.from_service_id || !rel.to_service_id) {
        errors.push(`${serviceId} relation: chybí from/to service id`);
        continue;
      }

      await _ensureServiceStub(rel.from_service_id, username);
      await _ensureServiceStub(rel.to_service_id, username);

      const dup = existingRelations.find((r) =>
        r.from_service_id === rel.from_service_id &&
        r.to_service_id === rel.to_service_id &&
        r.relation_type === rel.relation_type
      );

      if (dup) {
        await relRepo.update(dup.id, rel);
      } else {
        await relRepo.create(rel, username);
      }
    } catch (re) {
      errors.push(
        `${serviceId} relation '${rawRel.to_service_id || rawRel.toServiceId || '?'}': ${re.message}`
      );
    }
  }
}

async function upsertPrerequisiteFallback(serviceId, item, username, errors) {
  const hasExplicitRelations = Array.isArray(item.relations) && item.relations.length > 0;
  if (hasExplicitRelations) return;

  const prerequisites = [
    ...normalizeArrayMaybe(item.prerequisites),
    ...normalizeArrayMaybe(item.prerequisites_json),
  ];

  if (prerequisites.length === 0) return;

  const deduped = [...new Set(prerequisites.filter(Boolean))];
  const existingRelations = await relRepo.findByService(serviceId);

  for (const prereq of deduped) {
    try {
      await _ensureServiceStub(prereq, username);
      const rel = normalizeImportRelation({
        from_service_id: serviceId,
        to_service_id: prereq,
        relation_type: 'prerequisite',
        relation_label: 'Imported from prerequisites',
        source_field: 'Prerequisites',
        parse_confidence: 0.9,
      });

      const dup = existingRelations.find((r) =>
        r.from_service_id === rel.from_service_id &&
        r.to_service_id === rel.to_service_id &&
        r.relation_type === rel.relation_type
      );

      if (!dup) {
        await relRepo.create(rel, username);
      }
    } catch (pe) {
      errors.push(`${serviceId} prerequisite '${prereq}': ${pe.message}`);
    }
  }
}

// ─── Underlying Services → ServiceRelation(type=underlying) ──────────────────
// Parses "Underlying Services" SP field (multiline service IDs or JSON array).
// Uses SERVICE_ID pattern: uppercase letters + digits + optional dot/dash suffix.
const _SERVICE_ID_RE = /\b([A-Z]{2,6}\d{3,4}(?:[.\-]\d+[A-Z]?)?)\b/g;

function _extractServiceIds(text) {
  if (!text) return [];
  const raw = typeof text === 'string' ? text : JSON.stringify(text);
  // Try JSON parse first (array of service IDs)
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(s => typeof s === 'string' && /^[A-Z]/.test(s));
  } catch { /* fall through to regex */ }
  const ids = [];
  let m;
  while ((m = _SERVICE_ID_RE.exec(raw)) !== null) ids.push(m[1]);
  _SERVICE_ID_RE.lastIndex = 0;
  return [...new Set(ids)];
}

async function upsertUnderlying(serviceId, item, username, errors) {
  const raw = item.underlying_services;
  if (!raw) return;
  const ids = _extractServiceIds(raw);
  if (!ids.length) return;
  const existing = await relRepo.findByService(serviceId);
  for (const toId of ids) {
    try {
      await _ensureServiceStub(toId, username);
      const rel = normalizeImportRelation({
        from_service_id: serviceId,
        to_service_id:   toId,
        relation_type:   'underlying',
        relation_label:  'Imported from Underlying Services',
        source_field:    'Underlying Services',
        parse_confidence: 0.85,
        is_inferred:     false,
      });
      const dup = existing.find(r =>
        r.from_service_id === rel.from_service_id &&
        r.to_service_id   === rel.to_service_id &&
        r.relation_type   === rel.relation_type
      );
      if (!dup) await relRepo.create(rel, username);
    } catch (e) {
      errors.push(`${serviceId} underlying '${toId}': ${e.message}`);
    }
  }
}

async function upsertPreviousService(serviceId, item, username, errors) {
  const raw = item.previous_service;
  if (!raw) return;
  const ids = _extractServiceIds(String(raw).trim());
  if (!ids.length) return;
  const existing = await relRepo.findByService(serviceId);
  for (const toId of ids) {
    try {
      await _ensureServiceStub(toId, username);
      const rel = normalizeImportRelation({
        from_service_id: serviceId,
        to_service_id:   toId,
        relation_type:   'replaces',
        relation_label:  'Imported from Previous Service',
        source_field:    'Previous Service',
        parse_confidence: 0.95,
        is_inferred:     false,
      });
      const dup = existing.find(r =>
        r.from_service_id === rel.from_service_id &&
        r.to_service_id   === rel.to_service_id &&
        r.relation_type   === rel.relation_type
      );
      if (!dup) await relRepo.create(rel, username);
    } catch (e) {
      errors.push(`${serviceId} previous_service '${toId}': ${e.message}`);
    }
  }
}

async function _upsertC3Mapping(serviceId, data) {
  const pool = getPool();

  const catRes = await pool.query(`
      SELECT id
      FROM data.service_catalog
      WHERE service_id = $1
        AND is_deleted = FALSE
      LIMIT 1
    `, [serviceId]);

  const servicePk = catRes.rows[0]?.id ?? null;
  if (!servicePk) {
    throw new Error(`Service '${serviceId}' nebyla nalezena pro C3 mapping`);
  }

  const c3Uuid = data.c3_uuid ?? null;
  if (!c3Uuid) return;

  const existingRes = await pool.query(`
      SELECT id
      FROM data.service_c3_mapping
      WHERE service_id = $1
        AND c3_uuid = $2
      LIMIT 1
    `, [servicePk, c3Uuid]);

  const existingId = existingRes.rows[0]?.id ?? null;

  if (existingId) {
    await pool.query(`
        UPDATE data.service_c3_mapping
        SET c3_parent_uuid = $2,
            c3_level = $3,
            c3_domain = $4,
            c3_source = $5,
            c3_reference = $6,
            is_primary = TRUE
        WHERE id = $1
      `, [
      existingId,
      data.c3_parent_id ?? null,
      data.c3_level ?? null,
      data.c3_domain ?? null,
      data.c3_source ?? null,
      data.c3_reference ?? null,
    ]);
  } else {
    await pool.query(`
        INSERT INTO data.service_c3_mapping (
          service_id, c3_uuid, c3_parent_uuid, c3_level, c3_domain,
          c3_source, c3_reference, mapping_type_code, is_primary
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, 'supports', TRUE
        )
      `, [
      servicePk,
      c3Uuid,
      data.c3_parent_id ?? null,
      data.c3_level ?? null,
      data.c3_domain ?? null,
      data.c3_source ?? null,
      data.c3_reference ?? null,
    ]);
  }
}

// ─── POST /api/v1/import/services ─────────────────────────────────────────────
router.post('/services/dry-run', canEdit, importLimiter, async (req, res, next) => {
  try {
    const { profile, payload } = _extractProfileImportPayload(req);
    if (!payload || !Array.isArray(payload.items)) {
      return res.status(400).json({ error: tReq(req, 'import.errors.payload_required') });
    }
    const sourceName = req.body?.source_name || 'api-import.json';
    const sourceHashSha256 = _hashSha256(JSON.stringify(req.body ?? {}));
    const sourceKind = profile.key === 's3c-service-catalogue-json' ? payload.source : profile.key;

    const taxonomyMaps = await _loadTaxonomyMaps();
    const report = _buildImportDryRun(
      payload.items,
      payload.relations,
      taxonomyMaps,
      sourceKind,
      sourceName
    );

    const reportId = await importRepo.createContractReport({
      sourceName: report.source_name,
      sourceKind: report.source_kind,
      createdBy: req.user?.username ?? null,
      sourceHashSha256,
      itemCount: report.item_count,
      flavourCount: report.flavour_count,
      explicitRelationCount: report.explicit_relation_count,
      rawPrerequisiteCount: report.raw_prerequisite_count,
      missingTargetCount: report.missing_target_count,
      stubCount: report.stub_count,
      unresolvedRefCount: report.unresolved_ref_count,
      unresolvedRefsJson: _serializeSafe(report.unresolved_refs),
      missingTargetsJson: _serializeSafe(report.missing_targets),
      summaryJson: _serializeSafe(report),
    });

    res.json({ ok: true, profile_key: profile.key, report_id: reportId, source_hash_sha256: sourceHashSha256, ...report });
  } catch (err) {
    if (err.status || err.statusCode) return res.status(err.status || err.statusCode).json({ error: err.message });
    logger.error({ err }, 'Import dry-run failed');
    next(err);
  }
});

router.get('/contract-report/latest', async (req, res, next) => {
  try {
    const report = await importRepo.getLatestContractReport();
    res.json(report ?? null);
  } catch (err) { next(err); }
});

router.get('/contract-report/by-hash/:sha256', async (req, res, next) => {
  try {
    const sha256 = String(req.params.sha256 ?? '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      return res.status(400).json({ error: tReq(req, 'import.errors.invalid_sha256') });
    }

    const [report, batches] = await Promise.all([
      importRepo.getContractReportByHash(sha256),
      importRepo.getBatchPairingByHash(sha256),
    ]);

    if (!report && (!batches || batches.length === 0)) {
      return res.status(404).json({ error: tReq(req, 'import.errors.report_not_found') });
    }

    res.json({
      source_hash_sha256: sha256,
      report: report ?? null,
      batches: batches ?? [],
    });
  } catch (err) { next(err); }
});

router.get('/stubs', async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '100')));
    const result = await getPool().query(`
      SELECT
        id, service_id, title, service_status_code, is_stub, notes_json, created_at, updated_at,
        incoming_relation_count, outgoing_relation_count, related_service_ids
      FROM data.v_stubcompletionqueue
      ORDER BY updated_at DESC, created_at DESC
      LIMIT $1
    `, [limit]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/services', canEdit, importLimiter, async (req, res, next) => {
  try {
    const { profile, payload } = _extractProfileImportPayload(req);
    if (!payload || !Array.isArray(payload.items)) {
      return res.status(400).json({ error: tReq(req, 'import.errors.payload_required') });
    }
    const sourceName = req.body?.source_name || (payload.source === '3-table-json' ? 'api-import-3-table.json' : 'api-import.json');
    const sourceHashSha256 = _hashSha256(JSON.stringify(req.body ?? {}));
    const result = await _runImport(payload.items, req.user.username, {
      sourceName,
      sourceHashSha256,
      sourceProfile: profile.key,
      translate: (key, params) => tReq(req, key, params),
    });

    // Optional top-level relation import outside items[].
    if (Array.isArray(payload.relations) && payload.relations.length > 0) {
      for (const rawRel of payload.relations) {
        try {
          const rel = normalizeImportRelation(rawRel);
          if (!rel.from_service_id || !rel.to_service_id) continue;
          await _ensureServiceStub(rel.from_service_id, req.user.username);
          await _ensureServiceStub(rel.to_service_id, req.user.username);
          const existingRelations = await relRepo.findByService(rel.from_service_id);
          const dup = existingRelations.find(r =>
            r.from_service_id === rel.from_service_id &&
            r.to_service_id === rel.to_service_id &&
            r.relation_type === rel.relation_type);
          if (dup) await relRepo.update(dup.id, rel);
          else await relRepo.create(rel, req.user.username);
        } catch (re) {
          result.errors.push(`top-level relation: ${re.message}`);
        }
      }
    }

    await audit.log({
      tableName: 'ImportProfile',
      recordId: result.batchId,
      recordLabel: profile.key,
      action: 'IMPORT',
      newValues: {
        profile_key: profile.key,
        source: payload.source,
        inserted: result.inserted,
        updated: result.updated,
        failed: result.failed,
      },
      performedBy: req.user?.username ?? 'system',
      clientIp: req.ip,
      userAgent: req.get?.('user-agent'),
    });

    return res.json({ ok: true, profile_key: profile.key, source: payload.source, source_hash_sha256: sourceHashSha256, ...result });
  } catch (err) {
    if (err.status || err.statusCode) return res.status(err.status || err.statusCode).json({ error: err.message });
    logger.error({ err }, 'Service import failed');
    next(err);
  }
});

/**
 * Shared logic for JSON and CSV imports.
 * Creates ImportBatch, processes items[], logs errors into ImportIssue, and closes the batch.
 * @returns {{ batchId, inserted, updated, failed, errors }}
 */
async function _runImport(items, username, options = {}) {
  const sourceName = options.sourceName || 'api-import';
  const sourceHashSha256 = options.sourceHashSha256 || null;
  const sourceProfile = options.sourceProfile || 's3c-service-catalogue-json';
  const translate = typeof options.translate === 'function' ? options.translate : ((key) => key);
  const batchId = await importRepo.createBatch({
    filename: sourceName,
    importedBy: username,
    parserVersion: `2.1:${sourceProfile}`,
    sourceHashSha256,
  });

  let inserted = 0, updated = 0, failed = 0;
  let warnCount = 0;
  const errors = [];

  // Load taxonomy lookup maps once for the whole batch.
  // _resolveCode() then maps SharePoint names to DB codes or returns null without raising FK errors.
  const taxonomyMaps = await _loadTaxonomyMaps();

  for (const rawItem of items) {
    const item = normalizeImportItem(rawItem);
    const rawPortfolioGroup = item.portfolio_group_code;
    const rawServiceType = item.service_type;
    const rawServiceStatus = item.service_status;

    // Taxonomy FK resolution: SharePoint data often contains full names instead of codes.
    // If the value is not a valid code, try name lookup. If it is not found, set null:
    // the FK constraint is not triggered and the field remains empty for manual completion.
    item.global_service_group_code    = _resolveCode(item.global_service_group_code,    taxonomyMaps.globalServiceGroup);
    item.service_line_code            = _resolveCode(item.service_line_code,            taxonomyMaps.serviceLine);
    item.organizational_element_code  = _resolveCode(item.organizational_element_code,  taxonomyMaps.organizationalElement);
    item.portfolio_group_code         = _resolvePortfolioGroupCode(item.portfolio_group_code, taxonomyMaps.portfolioGroup);
    item.service_type                 = _resolveServiceTypeCode(item.service_type, taxonomyMaps.serviceType);
    item.service_status               = _resolveCode(item.service_status,               taxonomyMaps.serviceStatus);
    item.security_classification      = _resolveCode(item.security_classification,      taxonomyMaps.securityClassification);
    if (!item.service_type && rawServiceType && !item.cp_service_type_raw) {
      item.cp_service_type_raw = String(rawServiceType).trim();
    }

    // Pre-resolve Available Networks → domain codes + route unresolved tokens to text fields.
    // Runs BEFORE repo.update/create so Groups E/F/G are saved in the same DB write.
    let _resolvedDomains = [];
    if (item.available_on) {
      const rawList = Array.isArray(item.available_on)
        ? item.available_on
        : String(item.available_on).split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
      const unresolved = [];
      for (const tok of rawList) {
        const code = _resolveDomainCode(tok, taxonomyMaps.networkDomain);
        if (code) {
          // Defensive guard: domain_code column is NVarChar(30) — skip if somehow longer
          // (can happen if ref_NetworkDomain was polluted with raw strings by an older import)
          if (code.length > 30) {
            logger.warn({ serviceId: item.service_id, tok, code },
              'import: _resolveDomainCode returned a code longer than 30 chars; skipping (ref_NetworkDomain contains a dirty record)');
          } else {
            _resolvedDomains.push(code);
          }
        } else {
          // Re-strip for routing (mirrors normalisation in _resolveDomainCode head)
          const clean = String(tok)
            .replace(/[\u200B\uFEFF\u00A0\u200C\u200D]+/g, ' ').trim()
            .replace(/^[-–—*•·]\s*/, '').replace(/^\[\d+\]\s*/, '')
            .replace(/^\d+[.)]\s*/, '').replace(/[;:,]+$/, '').trim();
          if (clean && !(/^(available on[*:]?|service available on[*:]?|n\/a|na|standalone|public cloud)$/i.test(clean))) {
            unresolved.push(clean);
          }
        }
      }
      if (unresolved.length > 0) _routeUnresolvedToFields(item, unresolved);
    }

    const rowId = await importRepo.createRow(batchId, inserted + updated + failed + 1,
      item.service_id, rawItem, 'processing').catch(() => null);

    try {
      if (!item.service_id || !item.title) {
        errors.push(translate('import.errors.missing_required_fields'));
        failed++;
        if (rowId) await importRepo.logIssue({ batchId, rowId,
          serviceId: item.service_id, severity: 'error',
          issueCode: 'MISSING_REQUIRED', fieldName: 'service_id,title',
          message: translate('import.errors.missing_required_fields') }).catch(() => {});
        continue;
      }

      const warnImport = async (issueCode, fieldName, rawValue, message, extra = {}) => {
        warnCount++;
        logger.warn({ serviceId: item.service_id, issueCode, fieldName, rawValue, ...extra }, message);
        if (rowId) {
          await importRepo.logIssue({
            batchId,
            rowId,
            serviceId: item.service_id,
            severity: 'warn',
            issueCode,
            fieldName,
            rawValue,
            message,
          }).catch(() => {});
        }
      };

      if (rawPortfolioGroup && !item.portfolio_group_code) {
        await warnImport(
          'UNRESOLVED_PORTFOLIO_GROUP',
          'portfolio_group_code',
          String(rawPortfolioGroup),
          `Portfolio Group '${rawPortfolioGroup}' se nepodařilo rozpoznat proti ref_PortfolioGroup`,
          { portfolio_group_code: rawPortfolioGroup }
        );
      }
      if (rawServiceType && !item.service_type) {
        await warnImport(
          'UNRESOLVED_SERVICE_TYPE',
          'service_type',
          String(rawServiceType),
          `Service Type '${rawServiceType}' se nepodařilo rozpoznat proti ref_ServiceType`
        );
      }
      if (rawServiceStatus && !item.service_status) {
        await warnImport(
          'UNRESOLVED_SERVICE_STATUS',
          'service_status',
          String(rawServiceStatus),
          `Service Status '${rawServiceStatus}' se nepodařilo rozpoznat proti ref_ServiceStatus`
        );
      }

      const exists = await repo.serviceIdExists(item.service_id);
      if (exists) {
        await repo.update(item.service_id, item, username);
        updated++;
      } else {
        await repo.create(item, username);
        inserted++;
      }

      // Domains M:N — pre-resolved above (before repo.update/create)
      if (_resolvedDomains.length > 0) {
        await importRepo.upsertDomains(item.service_id,
          _resolvedDomains.map(d => ({ domainCode: d, sourceField: 'import' })));
      }

      // Roles
      if (item.service_owner)
        await importRepo.upsertRole(item.service_id, 'service_owner', item.service_owner, null, null);
      if (item.service_area_owner)
        await importRepo.upsertRole(item.service_id, 'service_area_owner', item.service_area_owner, null, null);
      if (item.service_delivery_manager)
        await importRepo.upsertRole(item.service_id, 'service_delivery_manager', item.service_delivery_manager, null, null);

      // Flavours: step 7 (project brief §3.2).
      // a) Structured item.flavours[] from JSON import with explicit data.
      if (Array.isArray(item.flavours)) {
        for (const rawFl of item.flavours) {
          try {
            await flRepo.upsert(item.service_id, normalizeImportFlavour(rawFl));
          } catch (fe) {
            errors.push(`${item.service_id} flavour: ${fe.message}`);
          }
        }
      }
      // b) Raw text parse from "Service Cost" + "Additional Information" (SharePoint export).
      //    Runs only when item.flavours[] was not provided to avoid duplicates.
      if (!Array.isArray(item.flavours) || item.flavours.length === 0) {
        const parsedFlavours = parseFlavours(
          item.service_id,
          item.service_cost_raw ?? null,
          item.detailed_description ?? item.additional_information_raw ?? null
        );
        for (const fl of parsedFlavours) {
          try {
            await importRepo.upsertFlavour(fl);
          } catch (fe) {
            errors.push(`${item.service_id} flavour(parsed) ${fl.flavourCode}: ${fe.message}`);
          }
        }
        if (parsedFlavours.length > 0) {
          await importRepo.logIssue({ batchId, rowId,
            serviceId: item.service_id, severity: 'info',
            issueCode: 'FLAVOURS_PARSED',
            fieldName: 'service_cost_raw',
            rawValue: _jsonAuditValue(_buildParsedFlavourAudit(parsedFlavours)),
            message: `Parsováno ${parsedFlavours.length} flavour(ů) z raw textu` }).catch(() => {});
        }
      }

      // Relations: explicit + typed text-parsed data (project brief 3.2 steps 5-6).
      await upsertRelationsForService(item.service_id, item.relations, username, errors);
      await upsertPrerequisiteFallback(item.service_id, item, username, errors);
      await upsertUnderlying(item.service_id, item, username, errors);
      await upsertPreviousService(item.service_id, item, username, errors);

      // Raw relation capture — preserve source text for audit + re-parse.
      // parsedOk=1  → the field was structured and relations were created.
      // parsedOk=0  → free text; the re-parse pipeline may retry later.
      const relRawCaptures = [
        ['prerequisites_json',   item.prerequisites_json  ?? item.prerequisites,    1],
        ['dependencies_json',    item.dependencies_json   ?? item.dependencies,     0],
        ['underlying_services',  item.underlying_services,                          1],
        ['previous_service',     item.previous_service,                             1],
      ];
      for (const [field, val, parsedOk] of relRawCaptures) {
        if (!val) continue;
        const rawText = typeof val === 'string' ? val : JSON.stringify(val);
        if (!rawText.trim()) continue;
        await importRepo.insertRelationRaw({
          serviceId:     item.service_id,
          sourceField:   field,
          rawValue:      rawText,
          parsedOk,
          parserVersion: '2.1',
        }).catch(e => errors.push(`${item.service_id} relationRaw(${field}): ${e.message}`));
      }

      // ServiceRawField: narrative fields for audit trail (project brief 3.2, item 10).
      const rawFieldCaptures = [
        ['support_availability',  item.support_availability_raw],
        ['service_cost',          item.service_cost_raw],
        ['value_added',           item.value_proposition],
        ['service_features',      item.service_features],
        ['service_support_locations', item.support_locations_raw ?? null],
        ['service_requests',      item.request_process_raw ?? null],
        ['additional_information', item.detailed_description],
        ['other_info',            item.operational_notes_raw ?? null],
      ];
      for (const [fieldName, rawValue] of rawFieldCaptures) {
        if (!rawValue) continue;
        await importRepo.insertRawField({
          serviceId: item.service_id,
          fieldName,
          rawValue: typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue),
          parserVersion: '2.1',
        }).catch(e => errors.push(`${item.service_id} rawField(${fieldName}): ${e.message}`));
      }

      // SLA: step 8 (project brief §3.2), parse "Support Availability" → ServiceSla.
      {
        const sla = parseSla(item.service_id, item.support_availability_raw ?? null);
        if (sla) {
          try {
            await importRepo.upsertSla(sla);
            await importRepo.logIssue({
              batchId,
              rowId,
              serviceId: item.service_id,
              severity: 'info',
              issueCode: 'SLA_PARSED',
              fieldName: 'support_availability_raw',
              rawValue: _jsonAuditValue(_buildParsedSlaAudit(sla)),
              message: translate('import.messages.service_sla_parsed'),
            }).catch(() => {});
          } catch (se) {
            errors.push(`${item.service_id} sla(parsed): ${se.message}`);
          }
        }
      }

      // C3 Mapping
      const c3uuid = item.c3_uuid || item.c3Uuid || null;
      if (c3uuid) {
        try {
          await _upsertC3Mapping(item.service_id, {
            c3_uuid: c3uuid,
            c3_parent_id: item.c3_parent_id || item.c3ParentId || null,
            c3_level: item.c3_level || item.c3Level || null,
            c3_domain: item.c3_domain || item.c3Domain || null,
            c3_source: item.c3_source || item.c3Source || null,
            c3_reference: item.c3_reference || item.c3Reference || null,
          });
        } catch (ce) {
          errors.push(`${item.service_id} c3: ${ce.message}`);
        }
      }

      await audit.log({ tableName: 'ServiceCatalog', recordId: item.service_id,
        recordLabel: item.title, action: exists ? 'UPDATE' : 'INSERT',
        newValues: item, performedBy: username });
      if (rowId) await importRepo.updateRowStatus(rowId, 'ok').catch(() => {});
    } catch (e) {
      failed++;
      errors.push(`${item.service_id || '?'}: ${e.message}`);
      if (rowId) {
        await importRepo.updateRowStatus(rowId, 'error').catch(() => {});
        await importRepo.logIssue({ batchId, rowId,
          serviceId: item.service_id, severity: 'error',
          issueCode: 'UPSERT_FAILED', message: e.message }).catch(() => {});
      }
    }
  }

  await importRepo.closeBatch(batchId, {
    okCount: inserted + updated,
    warnCount,
    errorCount: failed,
    rowCount: items.length,
    notes: [
      sourceHashSha256 ? `source_hash_sha256=${sourceHashSha256}` : null,
      sourceProfile ? `import_profile=${sourceProfile}` : null,
      errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
    ].filter(Boolean).join(' | ') || null,
  });

  await getPool().query('SELECT 1').catch(() => {});

  return { batchId, inserted, updated, failed, errors, source_hash_sha256: sourceHashSha256 };
}

// ─── CSV helper ───────────────────────────────────────────────────────────────
function _parseCsvLine(line, delim) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
    else if (c === delim && !inQ) { out.push(cur); cur = ''; }
    else { cur += c; }
  }
  out.push(cur);
  return out;
}

// ─── POST /api/v1/import/services/csv ────────────────────────────────────────
// Content-Type: text/csv or text/plain; delimiter may be ; or ,.
router.post('/services/csv/dry-run', canEdit, importLimiter, csvTextParser, async (req, res, next) => {
  try {
    const profile = _csvProfileFromReq(req);
    const parsed = _parseCsvText(req.body, (key, params) => tReq(req, key, params));
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const missingFields = _missingRequiredFields(parsed.headers, profile.required_fields);
    if (missingFields.length > 0) {
      return res.status(400).json({ error: `Missing required fields for ${profile.key}: ${missingFields.join(', ')}` });
    }

    const sourceName = req.query.source_name || 'csv-import.csv';
    const sourceHashSha256 = _hashSha256(parsed.normalized);
    const taxonomyMaps = await _loadTaxonomyMaps();
    const report = _buildImportDryRun(
      parsed.items,
      [],
      taxonomyMaps,
      profile.key,
      sourceName
    );

    const reportId = await importRepo.createContractReport({
      sourceName: report.source_name,
      sourceKind: report.source_kind,
      createdBy: req.user?.username ?? null,
      sourceHashSha256,
      itemCount: report.item_count,
      flavourCount: report.flavour_count,
      explicitRelationCount: report.explicit_relation_count,
      rawPrerequisiteCount: report.raw_prerequisite_count,
      missingTargetCount: report.missing_target_count,
      stubCount: report.stub_count,
      unresolvedRefCount: report.unresolved_ref_count,
      unresolvedRefsJson: _serializeSafe(report.unresolved_refs),
      missingTargetsJson: _serializeSafe(report.missing_targets),
      summaryJson: _serializeSafe(report),
    });

    res.json({ ok: true, profile_key: profile.key, report_id: reportId, source_hash_sha256: sourceHashSha256, ...report });
  } catch (err) {
    if (err.status || err.statusCode) return res.status(err.status || err.statusCode).json({ error: err.message });
    logger.error({ err }, 'CSV dry-run failed');
    next(err);
  }
});

router.post('/services/csv', canEdit, importLimiter, csvTextParser, async (req, res, next) => {
  try {
    const profile = _csvProfileFromReq(req);
    const parsed = _parseCsvText(req.body, (key, params) => tReq(req, key, params));
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const missingFields = _missingRequiredFields(parsed.headers, profile.required_fields);
    if (missingFields.length > 0) {
      return res.status(400).json({ error: `Missing required fields for ${profile.key}: ${missingFields.join(', ')}` });
    }

    const sourceName = req.query.source_name || 'csv-import.csv';
    const sourceHashSha256 = _hashSha256(parsed.normalized);
    const result = await _runImport(parsed.items, req.user.username, {
      sourceName,
      sourceHashSha256,
      sourceProfile: profile.key,
    });
    await audit.log({
      tableName: 'ImportProfile',
      recordId: result.batchId,
      recordLabel: profile.key,
      action: 'IMPORT',
      newValues: {
        profile_key: profile.key,
        source: 'csv',
        inserted: result.inserted,
        updated: result.updated,
        failed: result.failed,
      },
      performedBy: req.user?.username ?? 'system',
      clientIp: req.ip,
      userAgent: req.get?.('user-agent'),
    });
    res.json({ ok: true, profile_key: profile.key, source: 'csv', rowsParsed: parsed.items.length, source_hash_sha256: sourceHashSha256, ...result });
  } catch (err) {
    if (err.status || err.statusCode) return res.status(err.status || err.statusCode).json({ error: err.message });
    logger.error({ err }, 'CSV import failed');
    next(err);
  }
});

// ─── GET /api/v1/import/batches ───────────────────────────────────────────────
router.get('/batches', async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50')));
    const batches = await importRepo.listBatches(limit);
    res.json(batches);
  } catch (err) { next(err); }
});

// ─── GET /api/v1/import/relation-raw ─────────────────────────────────────────
// ?serviceId=SVC-001&limit=100&parsedOk=0
router.get('/relation-raw', async (req, res, next) => {
  try {
    const { serviceId, parsedOk, limit: rawLimit } = req.query;
    const limit = Math.min(500, Math.max(1, parseInt(rawLimit || '100')));
    const pool = getPool();
    let query = `
      SELECT
        r.id, sc.service_id, r.source_field, r.raw_value,
        r.parsed_ok, r.parser_version, r.parsed_at, r.notes, r.created_at
      FROM data.service_relation_raw r
      JOIN data.service_catalog sc ON sc.id = r.service_id
      WHERE 1=1
    `;
    const params = [];
    if (serviceId) {
      params.push(serviceId);
      query += ` AND sc.service_id = $${params.length}`;
    }
    if (parsedOk !== undefined) {
      params.push(parsedOk === '1');
      query += ` AND r.parsed_ok = $${params.length}`;
    }
    params.push(limit);
    query += ` ORDER BY r.created_at DESC LIMIT $${params.length}`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ─── GET /api/v1/import/batches/:id ──────────────────────────────────────────
router.get('/batches/:id', async (req, res, next) => {
  try {
    const batchId = parseInt(req.params.id, 10);
    if (isNaN(batchId)) return res.status(400).json({ error: tReq(req, 'import.errors.invalid_id') });
    const batch = await importRepo.getBatchWithIssues(batchId);
    if (!batch) return res.status(404).json({ error: tReq(req, 'import.errors.batch_not_found') });
    res.json(batch);
  } catch (err) { next(err); }
});

// ─── GET /api/v1/import/review ────────────────────────────────────────────────
// Aggregated import overview for the review UI.
// Returns: { batches[], summary: { total, ok, warn, error, last_imported_at } }
// Query params: ?limit=N (default 20), ?status=error|ok|warn (filter)
router.get('/review', async (req, res, next) => {
  try {
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20')));
    const status = req.query.status; // 'error' | 'ok' | 'warn' | undefined
    const pool   = getPool();

    const statusFilter = status === 'error'
      ? 'AND b.error_count > 0'
      : status === 'warn'
      ? 'AND b.warn_count > 0 AND b.error_count = 0'
      : status === 'ok'
      ? 'AND b.error_count = 0 AND b.warn_count = 0'
      : '';

    const batchesResult = await pool.query(`
      SELECT
        b.id, b.filename, b.imported_by,
        b.row_count, b.ok_count, b.warn_count, b.error_count,
        NULL::varchar AS status, NULL::timestamptz AS closed_at,
        b.imported_at,
        (SELECT COUNT(*) FROM data.import_issue ii WHERE ii.batch_id = b.id AND ii.severity = 'error') AS issue_error_count,
        (SELECT COUNT(*) FROM data.import_issue ii WHERE ii.batch_id = b.id AND ii.severity IN ('warn', 'warning')) AS issue_warn_count
      FROM data.import_batch b
      WHERE 1=1 ${statusFilter}
      ORDER BY b.imported_at DESC
      LIMIT $1
    `, [limit]);

    const summaryResult = await pool.query(`
      SELECT
        COUNT(*)                          AS total_batches,
        SUM(ok_count)                     AS total_ok,
        SUM(warn_count)                   AS total_warn,
        SUM(error_count)                  AS total_error,
        MAX(imported_at)                  AS last_imported_at
      FROM data.import_batch
    `);

    res.json({
      batches: batchesResult.rows,
      summary: summaryResult.rows[0] ?? {},
    });
  } catch (err) { next(err); }
});

// ─── POST /api/v1/import/reparse-raw ─────────────────────────────────────────
// Re-parse pipeline: takes ServiceRelationRaw records where parsed_ok=0
// and tries to convert them into typed ServiceRelation records.
// Body (optional): { serviceId?: string, limit?: number }
// Returns: { processed, created, skipped, errors[] }
router.post('/reparse-raw', canEdit, async (req, res, next) => {
  try {
    const { serviceId: filterServiceId, limit: rawLimit } = req.body ?? {};
    const limit = Math.min(500, Math.max(1, parseInt(rawLimit ?? '200')));
    const username = req.user?.username ?? 'reparse';
    const pool = getPool();

    // Load unparsed records.
    let rawQuery = `
      SELECT
        r.id, sc.service_id, r.source_field, r.raw_value, r.parser_version
      FROM data.service_relation_raw r
      JOIN data.service_catalog sc ON sc.id = r.service_id AND sc.is_deleted = FALSE
      WHERE r.parsed_ok = $1
    `;
    const params = [false];
    if (filterServiceId) {
      params.push(filterServiceId);
      rawQuery += ` AND sc.service_id = $${params.length}`;
    }
    params.push(limit);
    rawQuery += ` ORDER BY r.created_at ASC LIMIT $${params.length}`;

    const rawResult = await pool.query(rawQuery, params);
    const rows = rawResult.rows;

    let processed = 0, created = 0, skipped = 0;
    const errors = [];

    for (const row of rows) {
      processed++;
      try {
        // Extract service IDs from raw_value using the same regex as the import pipeline.
        const ids = _extractServiceIds(row.raw_value);
        if (!ids.length) { skipped++; continue; }

        // Map source_field → relation_type.
        const relType =
          row.source_field === 'underlying_services' ? 'underlying' :
          row.source_field === 'previous_service'    ? 'replaces'   :
          row.source_field === 'dependencies_json'   ? 'depends_on' :
          row.source_field === 'prerequisites_json'  ? 'prerequisite': 'depends_on';

        let createdAny = false;
        for (const toId of ids) {
          try {
            const rel = normalizeImportRelation({
              from_service_id: row.service_id,
              to_service_id:   toId,
              relation_type:   relType,
              relation_label:  `Re-parsed from ${row.source_field}`,
              source_field:    row.source_field,
              parse_confidence: 0.70,
              is_inferred:     true,
            });
            // Check duplicates.
            const existing = await relRepo.findByService(row.service_id);
            const dup = existing.find(r =>
              r.from_service_id === rel.from_service_id &&
              r.to_service_id   === rel.to_service_id &&
              r.relation_type   === rel.relation_type
            );
            if (!dup) {
              await relRepo.create(rel, username);
              createdAny = true;
            }
          } catch (e) {
            errors.push(`${row.service_id} → ${toId}: ${e.message}`);
          }
        }

        // Mark parsedOk=1 even when relations were only partially created.
        if (createdAny || ids.length > 0) {
          await pool.query(`
            UPDATE data.service_relation_raw
            SET parsed_ok = TRUE, parser_version = $2, parsed_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [row.id, '2.1-reparse']);
        }
        if (createdAny) created++;
        else skipped++;

      } catch (e) {
        errors.push(`row ${row.id} (${row.service_id}): ${e.message}`);
      }
    }

    res.json({ processed, created, skipped, errors: errors.slice(0, 20) });
  } catch (err) { next(err); }
});

module.exports = router;
