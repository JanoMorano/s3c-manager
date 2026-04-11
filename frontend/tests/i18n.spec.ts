import { expect, test } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';

function readyInstallStatus() {
  return {
    mode: 'ready',
    status: 'READY',
    install_locked: false,
    locked_by: null,
    admin_exists: true,
    modules: [],
  };
}

test('english login renders from the locale bootstrap snapshot', async ({ page }) => {
  await page.context().addCookies([
    {
      name: 'sc_locale',
      value: 'cs',
      url: BASE_URL,
    },
  ]);

  await page.addInitScript(() => {
    sessionStorage.setItem(
      'sc_auth_snapshot',
      JSON.stringify({
        id: 1,
        username: 'admin',
        display_name: 'Admin User',
        role: 'admin',
        auth_provider: 'local',
        preferred_lang: 'en',
        must_change_password: false,
      }),
    );
  });

  await page.route('**/api/v1/install/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(readyInstallStatus()),
    });
  });

  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect.poll(async () => {
    const cookies = await page.context().cookies(BASE_URL);
    return cookies.find((cookie) => cookie.name === 'sc_locale')?.value;
  }).toBe('en');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeVisible();
});
