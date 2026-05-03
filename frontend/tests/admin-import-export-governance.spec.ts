import { expect, test, type Page } from '@playwright/test';

async function mockAdminImportExport(page: Page) {
  await page.context().addCookies([
    {
      name: 'sc_access_token',
      value: 'test-access-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'sc_locale',
      value: 'en',
      domain: 'localhost',
      path: '/',
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
          username: 'admin',
          display_name: 'Admin User',
          role: 'admin',
          auth_provider: 'local',
          preferred_lang: 'en',
          must_change_password: false,
        }),
      });
      return;
    }

    if (url.includes('/api/v1/import/profiles')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { key: 's3c-service-catalogue-json', label: 'S3C service catalogue JSON', mode: 'direct', required_fields: ['service_id', 'title'] },
            { key: 'backstage-catalog-info', label: 'Backstage catalog-info', mode: 'direct', required_fields: ['metadata.name', 'spec.owner'] },
            { key: 'itop-reference', label: 'iTop reference mapping', mode: 'reference', required_fields: [] },
          ],
        }),
      });
      return;
    }

    if (url.includes('/api/v1/export/manifest')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ contract_version: '2026-04-governance', schema_version: 'canonical-27' }),
      });
      return;
    }

    if (url.includes('/api/v1/import/review')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          batches: [],
          summary: { total_batches: 0, total_ok: 0, total_warn: 0, total_error: 0, last_imported_at: null },
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

test('admin import page exposes governance profiles and export options', async ({ page }) => {
  await mockAdminImportExport(page);

  await page.goto('/admin/import');
  await expect(page.getByRole('heading', { name: /import review/i })).toBeVisible();
  await expect(page.getByLabel('Import profile')).toBeVisible();
  await page.getByLabel('Import profile').selectOption('backstage-catalog-info');
  await expect(page.getByText('metadata.name')).toBeVisible();
  await expect(page.getByRole('link', { name: /governance report/i })).toHaveAttribute('href', '/api/v1/export/governance-report');
  await expect(page.getByRole('link', { name: /capability coverage/i })).toHaveAttribute('href', '/api/v1/export/capabilities/coverage');
});
