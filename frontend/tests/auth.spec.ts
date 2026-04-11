import { test, expect } from '@playwright/test';
import { getConfiguredAdminCredentials, loginWithConfiguredAdmin } from './admin-credentials';

/**
 * Auth flow tests.
 * Clean installs do not ship a default admin account.
 * Login-dependent tests use an explicitly provisioned admin from env.
 */

test('login page renders and accepts credentials', async ({ page }) => {
  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD to run login tests.');
    return;
  }

  await loginWithConfiguredAdmin(page, credentials);
  await page.goto('/user-info');
  await expect(page.getByRole('heading', { name: /user info/i })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole('heading', { name: /user info/i })).toBeVisible({ timeout: 10_000 });
});

test('unauthenticated access to protected route redirects to login', async ({ page }) => {
  await page.goto('/services/list');
  await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
});
