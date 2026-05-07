import { expect, test, type Page } from '@playwright/test';

type MockRole = 'editor' | 'admin';

async function mockAdminImportExport(page: Page, role: MockRole = 'admin') {
  await page.addInitScript((snapshotRole) => {
    sessionStorage.setItem('sc_auth_snapshot', JSON.stringify({
      id: 1,
      username: snapshotRole,
      display_name: snapshotRole === 'admin' ? 'Admin User' : 'Editor User',
      role: snapshotRole,
      auth_provider: 'local',
      preferred_lang: 'en',
      must_change_password: false,
    }));
  }, role);

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
          username: role,
          display_name: role === 'admin' ? 'Admin User' : 'Editor User',
          role,
          auth_provider: 'local',
          preferred_lang: 'en',
          must_change_password: false,
        }),
      });
      return;
    }

    if (url.includes('/api/v1/admin/seed-status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          taxonomy: { mode: 'baseline', active_seed_key: 'c3-baseline', total: 12, by_item_type: [] },
          entities: { services: 2, applications: 3, data_objects: 4, technology_interactions: 5 },
          capability_map: { mode: 'baseline', total_rows: 9 },
        }),
      });
      return;
    }

    if (url.includes('/api/v1/taxonomy/spiral')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          active: 'Spiral_7',
          baselines: [
            { id: 1, spiral_code: 'Spiral_6', spiral_label: 'Spiral 6', is_active: false, notes: null },
            { id: 2, spiral_code: 'Spiral_7', spiral_label: 'Spiral 7', is_active: true, notes: null },
          ],
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

    if (url.includes('/api/v1/import/services/csv/dry-run')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          source_name: 'catalogue.csv',
          source_hash_sha256: 'abc123',
          item_count: 1,
          flavour_count: 0,
          explicit_relation_count: 0,
          raw_prerequisite_count: 0,
          missing_target_count: 1,
          stub_count: 0,
          unresolved_ref_count: 0,
          missing_targets: ['SVC-MISSING'],
          unresolved_refs: [],
        }),
      });
      return;
    }

    if (url.includes('/api/v1/import/services/csv?')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ inserted: 1, updated: 0, failed: 0, rowsParsed: 1, batchId: 77 }),
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

  await page.goto('/administration/import');
  await expect(page.getByRole('heading', { name: /import history/i })).toBeVisible();
  await expect(page.getByLabel('Catalogue import/export profile')).toBeVisible();
  await page.getByLabel('Catalogue import/export profile').selectOption('backstage-catalog-info');
  await expect(page.getByText('metadata.name')).toBeVisible();
  await expect(page.getByRole('link', { name: /governance report/i })).toHaveAttribute('href', '/api/v1/export/governance-report');
  await expect(page.getByRole('link', { name: /capability coverage/i })).toHaveAttribute('href', '/api/v1/export/capabilities/coverage');
  await expect(page.getByRole('button', { name: /raw relace|raw relations/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /expert\/debug tools/i })).toHaveCount(0);
});

test('catalogue import hides expert C3 targets from non-admin users', async ({ page }) => {
  await mockAdminImportExport(page, 'editor');

  await page.goto('/import/upload');
  await expect(page.getByRole('heading', { name: /import dat/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'NCIA Service Catalogue' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C3 Taxonomie' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C3 Capability Map' })).toBeVisible();
  await expect(page.getByText('Expert C3/FMNs import')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^C3 Application$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^C3 Data Object$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^C3 Technology Interactions$/ })).toHaveCount(0);
});

test('admin catalogue import keeps expert C3 targets available', async ({ page }) => {
  await mockAdminImportExport(page, 'admin');

  await page.goto('/import/upload');
  await expect(page.getByRole('heading', { name: /import dat/i })).toBeVisible();
  await expect(page.getByText('Expert C3/FMNs import')).toBeVisible();
  await expect(page.getByRole('button', { name: /^C3 Application$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^C3 Data Object$/ })).toBeVisible();
});

test('catalogue import dry-run shows issues before commit', async ({ page }) => {
  await mockAdminImportExport(page, 'admin');

  await page.goto('/import/upload');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'catalogue.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('service_id,title,service_type_code\nSVC001,Test Service,core\n'),
  });

  await page.getByRole('button', { name: /dry-run/i }).click();
  await expect(page.getByText('Výsledek dry-run')).toBeVisible();
  await expect(page.getByText('Chybějící služby 1')).toBeVisible();
  await expect(page.getByText('SVC-MISSING')).toBeVisible();

  await page.getByRole('button', { name: /nahrát a importovat/i }).click();
  await expect(page.getByText('Import dokončen')).toBeVisible();
  await expect(page.getByText('vloženo')).toBeVisible();
});
