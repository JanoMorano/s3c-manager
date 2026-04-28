#!/usr/bin/env node

const DEFAULT_ENDPOINTS = [
  { method: 'GET', path: '/api/v1/auth/me' },
  { method: 'GET', path: '/api/v1/stats/dashboard' },
  { method: 'GET', path: '/api/v1/stats/operations' },
  { method: 'GET', path: '/api/v1/services?limit=20' },
  { method: 'GET', path: '/api/v1/governance/risk-radar?limit=10' },
  { method: 'GET', path: '/api/v1/governance/owner-load?limit=10' },
  { method: 'GET', path: '/api/v1/governance/contract-overlap?limit=10' },
  { method: 'GET', path: '/api/v1/governance/advisor?limit=10' },
  { method: 'GET', path: '/operations' },
  { method: 'GET', path: '/help' },
];

function parseArgs(argv) {
  const out = {
    baseUrl: process.env.LOAD_TEST_BASE_URL || 'http://localhost:8080',
    users: Number(process.env.LOAD_TEST_USERS || 30),
    duration: Number(process.env.LOAD_TEST_DURATION || 30),
    timeoutMs: Number(process.env.LOAD_TEST_TIMEOUT_MS || 10000),
    thinkMs: Number(process.env.LOAD_TEST_THINK_MS || 500),
    maxErrorRate: Number(process.env.LOAD_TEST_MAX_ERROR_RATE || 0.02),
    loginPerUser: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--base-url') { out.baseUrl = next; i += 1; }
    else if (arg === '--users') { out.users = Number(next); i += 1; }
    else if (arg === '--duration') { out.duration = Number(next); i += 1; }
    else if (arg === '--timeout-ms') { out.timeoutMs = Number(next); i += 1; }
    else if (arg === '--think-ms') { out.thinkMs = Number(next); i += 1; }
    else if (arg === '--max-error-rate') { out.maxErrorRate = Number(next); i += 1; }
    else if (arg === '--login-per-user') { out.loginPerUser = true; }
  }
  return out;
}

function requireCredentials() {
  const username = process.env.LOAD_TEST_USERNAME || process.env.PLAYWRIGHT_ADMIN_USERNAME;
  const password = process.env.LOAD_TEST_PASSWORD || process.env.PLAYWRIGHT_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('Set LOAD_TEST_USERNAME and LOAD_TEST_PASSWORD, or PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD.');
  }
  return { username, password };
}

function cookieHeader(headers) {
  const raw = headers.getSetCookie ? headers.getSetCookie() : [];
  return raw.map((value) => value.split(';')[0]).filter(Boolean).join('; ');
}

async function request(baseUrl, session, endpoint, timeoutMs) {
  const started = process.hrtime.bigint();
  const response = await fetch(new URL(endpoint.path, baseUrl), {
    method: endpoint.method,
    headers: {
      ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(session.cookie ? { Cookie: session.cookie } : {}),
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  await response.arrayBuffer();
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  return { status: response.status, elapsedMs, path: endpoint.path };
}

async function login(baseUrl, credentials, timeoutMs) {
  const response = await fetch(new URL('/api/v1/auth/login', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(`Login failed with HTTP ${response.status}: ${body.error || 'missing access_token'}`);
  }
  return {
    accessToken: body.access_token,
    cookie: cookieHeader(response.headers),
  };
}

function percentile(values, pct) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((pct / 100) * sorted.length) - 1);
  return sorted[idx];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function virtualUser(id, options, sharedSession, credentials, stats) {
  const deadline = Date.now() + options.duration * 1000;
  const session = options.loginPerUser
    ? await login(options.baseUrl, credentials, options.timeoutMs)
    : sharedSession;
  let index = id % DEFAULT_ENDPOINTS.length;

  while (Date.now() < deadline) {
    const endpoint = DEFAULT_ENDPOINTS[index % DEFAULT_ENDPOINTS.length];
    index += 1;
    try {
      const result = await request(options.baseUrl, session, endpoint, options.timeoutMs);
      stats.total += 1;
      stats.latencies.push(result.elapsedMs);
      stats.byStatus[result.status] = (stats.byStatus[result.status] || 0) + 1;
      if (result.status >= 400) {
        stats.errors += 1;
        stats.errorSamples.push(`${result.status} ${result.path}`);
      }
    } catch (error) {
      stats.total += 1;
      stats.errors += 1;
      stats.errorSamples.push(error instanceof Error ? error.message : String(error));
    }
    await sleep(options.thinkMs + ((id * 37) % Math.max(1, Math.floor(options.thinkMs / 2))));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const credentials = requireCredentials();
  const stats = { total: 0, errors: 0, latencies: [], byStatus: {}, errorSamples: [] };
  const startedAt = Date.now();
  const sharedSession = options.loginPerUser ? null : await login(options.baseUrl, credentials, options.timeoutMs);

  await Promise.all(
    Array.from({ length: options.users }, (_, index) => virtualUser(index, options, sharedSession, credentials, stats)),
  );

  const elapsedSec = (Date.now() - startedAt) / 1000;
  const errorRate = stats.total ? stats.errors / stats.total : 1;
  const summary = {
    baseUrl: options.baseUrl,
    users: options.users,
    durationSec: options.duration,
    thinkMs: options.thinkMs,
    requests: stats.total,
    requestsPerSec: Number((stats.total / elapsedSec).toFixed(2)),
    errors: stats.errors,
    errorRate: Number(errorRate.toFixed(4)),
    status: stats.byStatus,
    latencyMs: {
      p50: Number(percentile(stats.latencies, 50).toFixed(1)),
      p95: Number(percentile(stats.latencies, 95).toFixed(1)),
      max: Number((stats.latencies.length ? Math.max(...stats.latencies) : 0).toFixed(1)),
    },
    errorSamples: [...new Set(stats.errorSamples)].slice(0, 10),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (errorRate > options.maxErrorRate) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
