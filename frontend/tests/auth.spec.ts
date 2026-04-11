import { test, expect } from '@playwright/test';

/**
 * Auth flow tests.
 * Assumes the app is seeded with the default admin account:
 *   username: admin, password: Admin123!
 */

test('login page renders and accepts credentials', async ({ page }) => {
  await page.goto('/login');
  // Wait for SSO check to finish (button is enabled when ssoChecking = false)
  const submitBtn = page.getByRole('button', { name: /přihlásit se/i });
  await expect(submitBtn).toBeEnabled({ timeout: 10_000 });

  await page.getByLabel('Uživatelské jméno').fill('admin');
  await page.getByLabel('Heslo').fill('Admin123!');
  await submitBtn.click();

  // After successful login the app redirects away from /login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
});

test('unauthenticated access to protected route redirects to login', async ({ page }) => {
  await page.goto('/c3/services');
  await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
});
