import { test, expect } from '@playwright/test';
import { getConfiguredAdminCredentials, loginWithConfiguredAdmin } from './admin-credentials';

test('admin import/export flow: review page renders and protected exports respond correctly', async ({ page, request }) => {
  test.setTimeout(5 * 60 * 1000);

  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD to run admin import/export tests.');
    return;
  }

  const unauthorizedManifest = await request.get('http://localhost:8080/api/v1/export/manifest?scope=import');
  expect([401, 403]).toContain(unauthorizedManifest.status());

  const unauthorizedBundle = await request.get('http://localhost:8080/api/v1/export/bundle');
  expect([401, 403]).toContain(unauthorizedBundle.status());

  await loginWithConfiguredAdmin(page, credentials);
  await page.goto('/admin/import');
  await expect(page.getByRole('heading', { name: /import review/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: /export manifest/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: /export bundle/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /raw relace|raw relations/i })).toBeVisible({ timeout: 15_000 });

  const loginResponse = await request.post('http://localhost:8080/api/v1/auth/login', {
    data: {
      username: credentials.username,
      password: credentials.password,
    },
  });
  expect(loginResponse.status()).toBe(200);
  const loginPayload = await loginResponse.json();
  const accessToken = loginPayload.access_token as string;
  expect(accessToken).toBeTruthy();

  const bundleResponse = await request.get('http://localhost:8080/api/v1/export/bundle', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  expect(bundleResponse.status()).toBe(200);
  const bundlePayload = await bundleResponse.json();
  expect(bundlePayload.contract_version).toBeTruthy();
  expect(bundlePayload.schema_version).toBeTruthy();
  expect(Array.isArray(bundlePayload.services)).toBe(true);
  expect(Array.isArray(bundlePayload.pricing)).toBe(true);
  expect(Array.isArray(bundlePayload.sla)).toBe(true);
  expect(Array.isArray(bundlePayload.import_batches)).toBe(true);

  const manifestResponse = await request.get('http://localhost:8080/api/v1/export/manifest?scope=import', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  expect(manifestResponse.status()).toBe(200);
  const manifestPayload = await manifestResponse.json();
  expect(manifestPayload.contract_version).toBeTruthy();
  expect(manifestPayload.schema_version).toBeTruthy();

  const importHealthResponse = await request.get('http://localhost:8080/api/health/import');
  expect(importHealthResponse.status()).toBe(200);
  const importHealthPayload = await importHealthResponse.json();
  expect(importHealthPayload.status).toBeTruthy();
});
