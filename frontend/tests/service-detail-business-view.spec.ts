import { test, expect } from '@playwright/test';
import { getConfiguredAdminCredentials, loginWithConfiguredAdmin } from './admin-credentials';

test('service detail exposes business-first and governance views', async ({ page }) => {
  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD to run service detail tests.');
    return;
  }

  await loginWithConfiguredAdmin(page, credentials);
  await page.goto('/services/list');
  await expect(page).toHaveURL(/\/services\/list/, { timeout: 15_000 });

  const serviceLink = page.locator('main[aria-label="Service list"] a[href^="/services/"]').first();
  await expect(serviceLink).toBeVisible({ timeout: 15_000 });
  await serviceLink.click();

  await expect(page).toHaveURL(/\/services\/[^/]+$/, { timeout: 15_000 });

  await expect(page.getByText('Business view')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /overview/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /offerings/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /request & support/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /governance/i })).toBeVisible({ timeout: 15_000 });

  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('At a glance')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /request & support/i }).click();
  await expect(page.getByRole('heading', { name: 'Request & Eligibility' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /governance/i }).click();
  await expect(page.getByRole('heading', { name: 'Operational Metadata' })).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByLabel('Service detail side panels').getByText('Governance', { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
});
