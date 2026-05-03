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
  await expect(page).toHaveURL(/\/operations/, { timeout: 10_000 });

  for (const heading of ['Decision Cockpit', 'Governance signals', 'Governance Cockpit']) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 15_000 });
  }

  await page.getByRole('link', { name: /^Health$/i }).click();
  await expect(page).toHaveURL(/\/operations\?tab=health/, { timeout: 10_000 });
  for (const heading of ['Incomplete metadata', 'Top completeness', 'Deprecated & retired', 'C3 mapping gap']) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 15_000 });
  }
});
