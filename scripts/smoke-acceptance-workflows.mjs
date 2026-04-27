import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../middleware/node_modules/dotenv').config();
const jwt = require('../middleware/node_modules/jsonwebtoken');

const apiBase = process.env.SMOKE_API_BASE ?? 'http://localhost:8080/api/v1';
const serviceId = process.env.SMOKE_ACCEPTANCE_SERVICE_ID ?? `E2E-${Date.now()}`;

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required to create local smoke-test auth token');
}

const token = jwt.sign(
  {
    sub: Number(process.env.SMOKE_ADMIN_ID ?? 1),
    username: process.env.SMOKE_ADMIN_USERNAME ?? 'acceptance-smoke',
    role: process.env.SMOKE_ADMIN_ROLE ?? 'admin',
    display_name: process.env.SMOKE_ADMIN_DISPLAY_NAME ?? 'Acceptance Smoke',
  },
  process.env.JWT_SECRET,
  {
    expiresIn: '30m',
    issuer: 'service-catalogue',
    audience: 'service-catalogue-ui',
  },
);

async function api(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

const results = [];
async function step(name, fn) {
  const started = Date.now();
  const data = await fn();
  results.push({ name, ok: true, ms: Date.now() - started, data });
}

try {
  await step('create temporary service', async () => api('/services', {
    method: 'POST',
    body: JSON.stringify({
      service_id: serviceId,
      title: 'Acceptance workflow smoke service',
      service_type: 'ES',
      service_status: 'draft',
      description: 'Temporary service created by smoke acceptance workflow.',
      requestable: false,
    }),
  }));

  await step('read created service detail', async () => {
    const service = await api(`/services/${encodeURIComponent(serviceId)}`);
    if (service.service_id !== serviceId) throw new Error('created service id mismatch');
    return { service_id: service.service_id, status: service.service_status };
  });

  await step('edit/save temporary service', async () => {
    const updated = await api(`/services/${encodeURIComponent(serviceId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: 'Acceptance workflow smoke service — edited',
        service_status: 'draft',
        business_summary: 'Edited by acceptance workflow smoke test.',
        requestable: false,
      }),
    });
    if (!String(updated.title ?? '').includes('edited')) throw new Error('updated title was not persisted');
    return { service_id: updated.service_id, title: updated.title };
  });

  await step('load representative Level-3 capability', async () => {
    const capabilities = await api('/capabilities/lvl3?spiral_code=Spiral_5');
    const candidate = Array.isArray(capabilities) ? capabilities.find((item) => item.uuid) : null;
    if (!candidate) throw new Error('no Level-3 capability available for mapping preview');
    globalThis.__capabilityUuid = candidate.uuid;
    return { uuid: candidate.uuid, slug: candidate.slug, title: candidate.title };
  });

  await step('preview service-to-capability mapping impact', async () => {
    const preview = await api(`/services/${encodeURIComponent(serviceId)}/preview-mapping`, {
      method: 'POST',
      body: JSON.stringify({ capability_uuid: globalThis.__capabilityUuid, mapping_type: 'supports' }),
    });
    if (!preview.read_only) throw new Error('preview endpoint must be read-only');
    if (!Array.isArray(preview.coverage_delta_per_lvl3)) throw new Error('missing coverage delta payload');
    return {
      deltas: preview.coverage_delta_per_lvl3.length,
      new_requirements: preview.newly_covered_requirements?.length ?? 0,
      duplicates: preview.potential_duplicate_coverage?.length ?? 0,
    };
  });
} finally {
  try {
    await step('cleanup temporary service', async () => api(`/services/${encodeURIComponent(serviceId)}?force=true`, { method: 'DELETE' }));
  } catch (error) {
    results.push({ name: 'cleanup temporary service', ok: false, error: error.message });
  }
}

const failed = results.filter((row) => !row.ok);
console.log(JSON.stringify({ ok: failed.length === 0, service_id: serviceId, results }, null, 2));
if (failed.length) process.exitCode = 1;
