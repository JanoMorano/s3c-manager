import { test, expect } from '@playwright/test';
import { getConfiguredAdminCredentials, loginWithConfiguredAdmin } from './admin-credentials';

async function loginForProtectedC3Route(page: Parameters<typeof loginWithConfiguredAdmin>[0]) {
  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD to run authenticated C3 route tests.');
    return false;
  }

  await loginWithConfiguredAdmin(page, credentials);
  return true;
}

test('C3 dashboard route renders', async ({ page }) => {
  if (!(await loginForProtectedC3Route(page))) return;
  await page.goto('/c3/dashboard');
  await expect(page.getByRole('heading', { name: 'C3 Dashboard' })).toBeVisible();
});

test('C3 capability map Spiral 7 route renders', async ({ page }) => {
  if (!(await loginForProtectedC3Route(page))) return;
  await page.goto('/c3/capability-map-spiral7');
  await expect(page.getByText('C3 Taxonomy Catalogue — Baseline 7')).toBeVisible();
});

test('C3 capability map Spiral 6 route renders', async ({ page }) => {
  if (!(await loginForProtectedC3Route(page))) return;
  await page.goto('/c3/capability-map-spiral6');
  await expect(page.getByText('C3 Taxonomy Catalogue — Baseline 6')).toBeVisible();
});

test('C3 technology interactions route renders', async ({ page }) => {
  await page.goto('/c3/technology-interactions');
  await expect(page.getByRole('heading', { name: 'C3 Technology Interactions' })).toBeVisible();
});

test('legacy technology interactions route redirects to canonical route', async ({ page }) => {
  await page.goto('/admin/c3-technology-interactions');
  await expect(page).toHaveURL(/\/c3\/technology-interactions/);
});

test('legacy c3-dashboard redirects to login for protected capability map', async ({ page }) => {
  await page.goto('/c3-dashboard');
  await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
});

test('legacy C3 detail redirects to canonical detail route', async ({ page }) => {
  if (!(await loginForProtectedC3Route(page))) return;
  await page.goto('/admin/c3/demo-uuid');
  await expect(page).toHaveURL(/\/c3\/demo-uuid\/edit/);
});

test('legacy C3 graph redirects to canonical graph route', async ({ page }) => {
  if (!(await loginForProtectedC3Route(page))) return;
  await page.goto('/admin/c3/graph');
  await expect(page).toHaveURL(/\/c3\/graph/);
});

test('capability map keeps deep-link query filters in URL', async ({ page }) => {
  if (!(await loginForProtectedC3Route(page))) return;
  await page.goto('/c3/capability-map?search=test&item_type=CI&application=APP&selected=item-1');
  await expect(page).toHaveURL(/\/c3\/capability-map-spiral7/);
  await expect(page).toHaveURL(/search=test/);
  await expect(page).toHaveURL(/item_type=CI/);
  await expect(page).toHaveURL(/application=APP/);
  await expect(page).toHaveURL(/selected=item-1/);
});
