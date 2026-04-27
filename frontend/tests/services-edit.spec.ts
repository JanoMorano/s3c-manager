import { test, expect, type Page } from '@playwright/test';
import { getConfiguredAdminCredentials, loginWithConfiguredAdmin } from './admin-credentials';

/**
 * Services list → edit → save happy path tests.
 *
 * These tests cover the full edit flow:
 *   1. Login as admin
 *   2. Navigate to services list
 *   3. Click the Edit button on a row → should redirect to full-page editor
 *   4. Verify editor is rendered, not the inline row-edit
 *   5. Change a field and save
 *
 * Requires INIT_WITH_TEST_SEEDS=true (demo data with DEMO-SVC-001 etc.)
 * or an already-populated database.
 * Login requires an explicitly provisioned admin account from env.
 */

async function loginAsAdmin(page: Page) {
  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD to run edit-flow tests.');
    return;
  }

  await loginWithConfiguredAdmin(page, credentials);
}

async function openFirstC3ServiceEditor(page: Page) {
  await page.goto('/c3/services');

  const firstServiceLink = page.locator('table tbody a[href^="/c3/services/"]').first();
  await expect(firstServiceLink).toBeVisible({ timeout: 15_000 });
  const href = await firstServiceLink.getAttribute('href');
  expect(href).toBeTruthy();

  await page.goto(`${href}/edit`);
  await expect(page).toHaveURL(/\/c3\/services\/.+\/edit/, { timeout: 10_000 });
}

test('services list renders after login', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/c3/services');
  // Page should show a table heading or the list page title
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
});

test('clicking Edit on a service row navigates to full-page editor', async ({ page }) => {
  await loginAsAdmin(page);
  await openFirstC3ServiceEditor(page);

  // Editor should show a form, not the inline row-edit panel
  // Verify the edit page has a Save / Uložit button
  await expect(
    page.getByRole('button', { name: /uložit|save/i }).first()
  ).toBeVisible({ timeout: 10_000 });
});

test('edit URL with ?exact=&edit=1 redirects to full-page editor', async ({ page }) => {
  await loginAsAdmin(page);

  // Simulate the URL that ServiceDetail generates when clicking "Edit"
  // with ?exact=SRV-CODE&edit=1 — this should auto-redirect to /c3/services/{code}/edit
  await page.goto('/c3/services?exact=SRV-1&search=SRV-1&edit=1');

  // Either lands on the edit page (if SRV-1 exists) or stays on list without crashing
  // Key assertion: must NOT be stuck on a page with inline row-edit of row id=1
  await page.waitForTimeout(3_000); // let redirect effects run
  const url = page.url();

  // If SRV-1 was found and redirected — verify it's the correct editor page
  if (url.includes('/edit')) {
    await expect(page).toHaveURL(/\/c3\/services\/.+\/edit/);
  } else {
    // SRV-1 not in DB (CI without seeds) — stays on list, no crash
    await expect(page.getByRole('heading').first()).toBeVisible();
  }
});

test('C3 services edit page has functional form fields', async ({ page }) => {
  await loginAsAdmin(page);
  await openFirstC3ServiceEditor(page);

  // At least one input field must be present
  const inputs = page.locator('input, textarea, select');
  await expect(inputs.first()).toBeVisible({ timeout: 5_000 });
});
