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

test('must-change-password screen does not request owned services before the password reset is completed', async ({ page }) => {
  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD to run login tests.');
    return;
  }

  const ownerRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/v1/services?owner=')) ownerRequests.push(url);
  });

  await page.goto('/login');
  await expect(page.getByRole('button', { name: /přihlásit se/i })).toBeEnabled({ timeout: 10_000 });
  await page.locator('input').nth(0).fill(credentials.username);
  await page.locator('input').nth(1).fill(credentials.password);
  await page.getByRole('button', { name: /přihlásit se/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });

  ownerRequests.length = 0;
  await page.goto('/user-info?must_change_password=1&next=%2F');
  await expect(page.getByText(/první přihlášení vyžaduje změnu hesla/i)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1000);
  await expect(page.getByText(/Services I Own/i)).toHaveCount(0);

  expect(ownerRequests).toHaveLength(0);
});
