import { expect, test } from '@playwright/test';
import { getConfiguredAdminCredentials, loginWithConfiguredAdmin } from './admin-credentials';

test('user menu only exposes profile and logout actions', async ({ page }) => {
  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD to run local-account navigation tests.');
    return;
  }

  await loginWithConfiguredAdmin(page, credentials);
  await page.goto('/catalogue');
  await page.locator('button[aria-haspopup="true"]').click();

  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /user info|informace o uživateli|informácie o používateľovi|benutzer info|benutzerinformationen/i })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /log out|odhlásit|odhlásiť|abmelden/i })).toBeVisible();
  await expect(menu.getByText(/language|jazyk|sprache|persona|role mode|consumer|service owner|admin/i)).toHaveCount(0);
  await expect(menu.locator('select')).toHaveCount(0);
});
