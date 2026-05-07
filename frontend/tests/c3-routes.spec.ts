import { test, expect } from '@playwright/test';
import { getConfiguredAdminCredentials, loginWithConfiguredAdmin } from './admin-credentials';

async function mockC3DataObjectReadOnly(page: Parameters<typeof loginWithConfiguredAdmin>[0]) {
  await page.addInitScript(() => {
    sessionStorage.setItem('sc_auth_snapshot', JSON.stringify({
      id: 1,
      username: 'editor',
      display_name: 'Editor User',
      role: 'editor',
      auth_provider: 'local',
      preferred_lang: 'en',
      must_change_password: false,
    }));
  });

  await page.context().addCookies([
    {
      name: 'sc_access_token',
      value: 'test-access-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/api/v1/install/status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'READY',
          modules: [
            { code: 'SERVICE_CATALOGUE_CORE', enabled: true, ui_visible: true, api_enabled: true },
            { code: 'C3_TAXONOMY', enabled: true, ui_visible: true, api_enabled: true },
          ],
        }),
      });
      return;
    }

    if (url.includes('/api/v1/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          username: 'editor',
          display_name: 'Editor User',
          role: 'editor',
          auth_provider: 'local',
          preferred_lang: 'en',
          must_change_password: false,
        }),
      });
      return;
    }

    if (url.includes('/api/v1/taxonomy/c3-data-objects/DOB-1')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 12,
          data_object_code: 'DOB-1',
          uuid: 'dob-uuid-1',
          title: 'Mission Data Object',
          item_status: 'Approved',
          modification_date: '2026-04-01T10:00:00Z',
          description: 'Imported data object evidence.',
          provenance_raw: 'Imported from Data Objects.csv',
          references_raw: '',
          standards_raw: '',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

async function loginForProtectedC3Route(page: Parameters<typeof loginWithConfiguredAdmin>[0]) {
  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD to run authenticated C3 route tests.');
    return false;
  }

  await loginWithConfiguredAdmin(page, credentials);
  return true;
}

test('C3 dashboard route redirects to capability coverage workspace', async ({ page }) => {
  if (!(await loginForProtectedC3Route(page))) return;
  await page.goto('/c3/dashboard');
  await expect(page).toHaveURL(/\/capabilities\?view=coverage/);
});

test('C3 capability map Spiral 7 route renders', async ({ page }) => {
  if (!(await loginForProtectedC3Route(page))) return;
  await page.goto('/c3/capability-map-spiral7');
  await expect(page.getByText('C3 Taxonomy Catalogue — Baseline 7')).toBeVisible();
  await expect(page.getByRole('link', { name: /Spiral 6/ })).toHaveAttribute('href', '/c3/capability-map-spiral6');
  await expect(page.getByRole('link', { name: /Spiral 7/ })).toHaveAttribute('href', '/c3/capability-map-spiral7');
  await expect(page.getByRole('link', { name: /Spiral 7/ })).toContainText('primary');
  await expect(page.getByRole('link', { name: /Spiral 6/ })).toContainText('history');
});

test('C3 capability map Spiral 6 route renders', async ({ page }) => {
  if (!(await loginForProtectedC3Route(page))) return;
  await page.goto('/c3/capability-map-spiral6');
  await expect(page.getByText('C3 Taxonomy Catalogue — Baseline 6')).toBeVisible();
  await expect(page.getByRole('link', { name: /Spiral 6/ })).toHaveAttribute('href', '/c3/capability-map-spiral6');
  await expect(page.getByRole('link', { name: /Spiral 7/ })).toHaveAttribute('href', '/c3/capability-map-spiral7');
});

test('FMN Air C2 web route is not exposed in production navigation', async ({ page }) => {
  if (!(await loginForProtectedC3Route(page))) return;
  await page.goto('/c3/fmn-air-c2');
  await expect(page.locator('a[href="/c3/fmn-air-c2"]')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('FMN Air C2');
});

test('C3 technology interactions route renders', async ({ page }) => {
  if (!(await loginForProtectedC3Route(page))) return;
  await page.goto('/c3/technology-interactions');
  await expect(page.getByRole('heading', { name: 'C3 Technology Interactions' })).toBeVisible();
});

test('C3 Data Objects detail is read-only and import-only', async ({ page }) => {
  await mockC3DataObjectReadOnly(page);

  await page.goto('/c3/data-objects/DOB-1');
  await expect(page.getByRole('heading', { name: 'Mission Data Object' })).toBeVisible();
  await expect(page.getByText('Read-only import evidence')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Edit$/ })).toHaveCount(0);

  await page.goto('/c3/data-objects/DOB-1/edit');
  await expect(page.getByRole('heading', { name: 'Mission Data Object' })).toBeVisible();
  await expect(page.getByText('Import-only')).toBeVisible();
  await expect(page.getByRole('button', { name: /uložit|save/i })).toHaveCount(0);
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

test('legacy C3 graph redirects to canonical Spiral 7 map', async ({ page }) => {
  if (!(await loginForProtectedC3Route(page))) return;
  await page.goto('/admin/c3/graph');
  await expect(page).toHaveURL(/\/c3\/capability-map-spiral7/);
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
