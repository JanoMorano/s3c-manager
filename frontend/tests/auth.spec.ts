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
});

test('unauthenticated access to protected route redirects to login', async ({ page }) => {
  await page.goto('/c3/services');
  await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
});
