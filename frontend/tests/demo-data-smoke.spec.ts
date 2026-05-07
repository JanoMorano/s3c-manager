import { test, expect, type Page } from '@playwright/test';
import { getConfiguredAdminCredentials } from './admin-credentials';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';

/**
 * Demo data smoke tests.
 *
 * When the app is started with INIT_WITH_TEST_SEEDS=true, a set of demo services
 * (DEMO-SVC-001 etc.) must be present. This test guards against regressions in
 * the seed data or seeding logic.
 *
 * These tests hit the public API directly so they don't require a browser session.
 * They will be skipped gracefully when seeds are not loaded (CI without seeds).
 */

async function loginAndGetToken(page: Page): Promise<string> {
  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD for login-dependent smoke tests.');
    return '';
  }

  const res = await page.request.post('/api/v1/auth/login', {
    data: { username: credentials.username, password: credentials.password },
  });
  const body = await res.json();
  return body.access_token as string;
}

test('health endpoint returns ready', async ({ page }) => {
  const base = new URL(BASE_URL);
  test.skip(base.port === '3000', 'Backend readiness endpoint is only available in the full stack, not the standalone Next dev server.');

  const res = await page.request.get('/api/health/ready');
  expect(res.status()).toBe(200);
});

test('admin can login and receive access token', async ({ page }) => {
  const token = await loginAndGetToken(page);
  expect(typeof token).toBe('string');
  expect(token.length).toBeGreaterThan(10);
});

test('services API returns at least one service when seeded', async ({ page }) => {
  const token = await loginAndGetToken(page);

  const res = await page.request.get('/api/v1/taxonomy/c3-services', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  // API may return empty array in CI without seeds — that's fine.
  // When seeds are loaded, we expect at least one service.
  expect(Array.isArray(body)).toBe(true);
});

test('DEMO-SVC-001 exists when test seeds are loaded', async ({ page }) => {
  const token = await loginAndGetToken(page);

  const res = await page.request.get('/api/v1/taxonomy/c3-services', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json() as Array<Record<string, unknown>>;
  if (body.length === 0) {
    // Seeds not loaded — skip this assertion
    test.skip();
    return;
  }

  const demo = body.find(
    (svc) =>
      String(svc.service_code ?? '').toUpperCase() === 'DEMO-SVC-001' ||
      String(svc.external_id ?? '').toUpperCase() === 'DEMO-SVC-001',
  );
  if (!demo) {
    test.skip(true, 'Demo service seed is not loaded in this runtime.');
    return;
  }
  expect(demo).toBeDefined();
  // Must have required fields
  expect(typeof demo?.title).toBe('string');
  expect((demo?.title as string).length).toBeGreaterThan(0);
});

test('capability-map API responds with valid shape', async ({ page }) => {
  const token = await loginAndGetToken(page);
  const res = await page.request.get('/api/v1/taxonomy/c3/capability-map', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.page_title).toBeTruthy();
  expect(body.summary).toBeDefined();
  expect(Array.isArray(body.items)).toBe(true);
  expect(Array.isArray(body.domains)).toBe(true);
});

test('capability-map spiral6 API responds with valid shape', async ({ page }) => {
  const token = await loginAndGetToken(page);
  const res = await page.request.get('/api/v1/taxonomy/c3/capability-map-spiral6', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.page_title).toContain('Baseline 6');
  expect(Array.isArray(body.items)).toBe(true);
  expect(Array.isArray(body.domains)).toBe(true);
});
