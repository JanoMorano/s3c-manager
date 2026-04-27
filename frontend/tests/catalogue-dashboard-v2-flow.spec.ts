import { expect, test } from '@playwright/test';
import { getConfiguredAdminCredentials, loginWithConfiguredAdmin } from './admin-credentials';

test('catalogue dashboard v2 routes daily users to operations', async ({ page }) => {
  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD to run login tests.');
    return;
  }

  await loginWithConfiguredAdmin(page, credentials);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/catalogue/, { timeout: 10_000 });

  await expect(page.getByRole('heading', { name: 'Catalogue' })).toBeVisible();
  await expect(page.locator('section[aria-label="Catalogue headline KPIs"] article')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();

  await page.getByRole('link', { name: /Operations/i }).first().click();
  await expect(page).toHaveURL(/\/operations/, { timeout: 10_000 });

  for (const heading of [
    'Incomplete metadata',
    'Missing owners',
    'Top completeness',
    'Deprecated & retired',
    'Pricing patrol',
    'C3 mapping gap',
  ]) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
});
