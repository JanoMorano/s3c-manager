import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../middleware/node_modules/dotenv').config();
const jwt = require('../middleware/node_modules/jsonwebtoken');

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const importRoot = path.join(repoRoot, 'import-nato');
const apiBase = process.env.SMOKE_API_BASE ?? 'http://localhost:8080/api/v1';
const adminUser = {
  id: Number(process.env.SMOKE_ADMIN_ID ?? 1),
  username: process.env.SMOKE_ADMIN_USERNAME ?? 'janomorano',
  role: process.env.SMOKE_ADMIN_ROLE ?? 'admin',
  displayName: process.env.SMOKE_ADMIN_DISPLAY_NAME ?? 'Jan Moravec',
};

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required to create local smoke-test auth token');
}

const token = jwt.sign(
  {
    sub: adminUser.id,
    username: adminUser.username,
    role: adminUser.role,
    display_name: adminUser.displayName,
  },
  process.env.JWT_SECRET,
  {
    expiresIn: '30m',
    issuer: 'service-catalogue',
    audience: 'service-catalogue-ui',
  },
);

function inferSpiral(filePath) {
  const normalized = filePath.toLowerCase();
  if (normalized.includes('/spiral6/') || normalized.includes('spiral6')) return 'Spiral_6';
  if (normalized.includes('/spiral7/') || normalized.includes('spiral7')) return 'Spiral_7';
  return null;
}

function taxonomyTargetFromName(fileName) {
  const name = fileName.toLowerCase();
  if (name.includes('business-processes') || name.includes('business_processes')) return 'business-processes';
  if (name.includes('business-roles') || name.includes('business_roles')) return 'business-roles';
  if (name.includes('capabilities')) return 'capabilities';
  if (name.includes('coi-services') || name.includes('coi_services')) return 'coi-services';
  if (name.includes('communications-services') || name.includes('communications_services')) return 'communications-services';
  if (name.includes('core-services') || name.includes('core_services')) return 'core-services';
  if (name.includes('information-products') || name.includes('information_products')) return 'information-products';
  if (name.includes('user-applications') || name.includes('user_applications')) return 'user-applications';
  if (name.includes('business_processes')) return 'business-processes';
  if (name.includes('business_roles')) return 'business-roles';
  if (name.includes('coi_services')) return 'coi-services';
  if (name.includes('communications_services')) return 'communications-services';
  if (name.includes('core_services')) return 'core-services';
  if (name.includes('user_applications')) return 'user-applications';
  return null;
}

function entityTargetFromName(fileName) {
  const name = fileName.toLowerCase();
  if (name.includes('applications')) return 'c3-application';
  if (name.includes('data-objects')) return 'c3-data-objects';
  if (name.includes('technology-interactions')) return 'c3-technology-interactions';
  if (name.includes('services')) return 'c3-services';
  return null;
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (entry.isFile() && entry.name !== '.DS_Store') files.push(fullPath);
  }
  return files.sort();
}

function classify(filePath) {
  const fileName = path.basename(filePath);
  const lower = fileName.toLowerCase();
  const spiralCode = inferSpiral(filePath);
  if (lower === 'c3-taxonomy-seed.json') {
    return { endpoint: '/taxonomy/c3/sync', method: 'json', bodyMode: 'items', spiralCode: null };
  }
  if (lower.startsWith('capability-map-') && lower.endsWith('.json')) {
    return { endpoint: '/taxonomy/c3-capability-builder/sync', method: 'json', bodyMode: 'items', spiralCode };
  }
  if (lower.endsWith('.json')) {
    const target = entityTargetFromName(fileName);
    if (!target) return null;
    return { endpoint: `/taxonomy/${target}/sync`, method: 'json', bodyMode: 'items', spiralCode };
  }
  if (lower.endsWith('.csv')) {
    const target = entityTargetFromName(fileName);
    if (!target) return null;
    return { endpoint: `/taxonomy/${target}/csv`, method: 'csv', spiralCode };
  }
  if (lower.endsWith('.xlsx')) {
    const target = taxonomyTargetFromName(fileName);
    if (!target) return null;
    return { endpoint: '/taxonomy/c3/xlsx', method: 'xlsx', target, spiralCode };
  }
  if (lower.endsWith('.xml')) {
    const target = taxonomyTargetFromName(fileName);
    if (!target) return null;
    return { endpoint: `/taxonomy/c3/${target}/xml-archimate`, method: 'xml', spiralCode };
  }
  return null;
}

async function requestImport(filePath, plan) {
  const fileName = path.basename(filePath);
  const url = new URL(`${apiBase}${plan.endpoint}`);
  url.searchParams.set('source_name', fileName);
  if (plan.target) url.searchParams.set('target_key', plan.target);
  if (plan.spiralCode) url.searchParams.set('spiral_code', plan.spiralCode);

  const headers = { Authorization: `Bearer ${token}` };
  let body;
  if (plan.method === 'json') {
    const items = JSON.parse(await fs.readFile(filePath, 'utf8'));
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ items, source_name: fileName, spiral_code: plan.spiralCode });
  } else if (plan.method === 'csv') {
    headers['Content-Type'] = 'text/csv';
    body = await fs.readFile(filePath, 'utf8');
  } else if (plan.method === 'xml') {
    headers['Content-Type'] = 'application/xml';
    body = await fs.readFile(filePath, 'utf8');
  } else if (plan.method === 'xlsx') {
    headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    body = await fs.readFile(filePath);
  }

  const response = await fetch(url, { method: 'POST', headers, body });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(json)}`);
  }
  return json;
}

const files = await walk(importRoot);
const results = [];
for (const file of files) {
  const relative = path.relative(repoRoot, file);
  const plan = classify(file);
  if (!plan) {
    results.push({ file: relative, ok: false, error: 'No import route inferred' });
    continue;
  }
  try {
    const result = await requestImport(file, plan);
    results.push({
      file: relative,
      ok: true,
      method: plan.method,
      endpoint: plan.endpoint,
      spiral_code: plan.spiralCode,
      target_key: plan.target ?? result?.target_key ?? result?.target ?? null,
      rowsParsed: result?.rowsParsed ?? result?.rows_parsed ?? result?.rowsParsedTotal ?? null,
      inserted: result?.inserted ?? null,
      updated: result?.updated ?? null,
      failed: result?.failed ?? null,
      ok_count: result?.ok_count ?? null,
      warn_count: result?.warn_count ?? null,
      error_count: result?.error_count ?? null,
      membership_records: Array.isArray(result?.membership_records)
        ? result.membership_records.length
        : result?.membership_records ?? null,
    });
  } catch (error) {
    results.push({ file: relative, ok: false, method: plan.method, endpoint: plan.endpoint, spiral_code: plan.spiralCode, error: error.message });
  }
}

const summary = {
  total_files: files.length,
  imported: results.filter((row) => row.ok).length,
  failed: results.filter((row) => !row.ok).length,
  row_errors: results.reduce((sum, row) => sum + Number(row.failed ?? row.error_count ?? 0), 0),
  results,
};

console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0 || summary.row_errors > 0) process.exitCode = 1;
