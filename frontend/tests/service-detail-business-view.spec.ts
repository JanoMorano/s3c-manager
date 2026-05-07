import { test, expect } from '@playwright/test';
import { getConfiguredAdminCredentials, loginWithConfiguredAdmin } from './admin-credentials';

test('service detail exposes relationship studio and governance views', async ({ page }) => {
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

  await expect(page.getByText('Service relationship studio')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'What needs attention' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'How this service fits' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /overview/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /how to get it/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /support\s*\/\s*sla/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /relationships/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /governance/i })).toBeVisible({ timeout: 15_000 });

  await expect(page.getByRole('heading', { name: 'Service 360' }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('At a glance')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /how to get it/i }).click();
  await expect(page.getByRole('heading', { name: 'How to get this service' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Available offerings' })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /support\s*\/\s*sla/i }).click();
  await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /relationships/i }).click();
  await expect(page.getByRole('heading', { name: 'Relationships' })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /governance/i }).click();
  await expect(page.getByRole('heading', { name: 'Governance facts' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible({ timeout: 15_000 });
});
