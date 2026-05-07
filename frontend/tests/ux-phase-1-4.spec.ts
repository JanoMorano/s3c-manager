import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';

function authSnapshot(preferredLang = 'cs') {
  return {
    id: 1,
    username: 'ux-smoke',
    display_name: 'UX Smoke',
    role: 'admin',
    auth_provider: 'local',
    preferred_lang: preferredLang,
    must_change_password: false,
  };
}

async function mockAuthenticatedUx(page: Page, preferredLang = 'cs') {
  let currentLang = preferredLang;

  await page.context().addCookies([
    { name: 'sc_access_token', value: 'test-access-token', url: BASE_URL },
    { name: 'sc_locale', value: preferredLang, url: BASE_URL },
  ]);

  await page.addInitScript((snapshot) => {
    sessionStorage.setItem('sc_auth_snapshot', JSON.stringify(snapshot));
  }, authSnapshot(preferredLang));

  await page.route('**/api/v1/install/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'READY',
        modules: [
          { code: 'SERVICE_CATALOGUE_CORE', enabled: true, ui_visible: true, api_enabled: true },
          { code: 'C3_TAXONOMY', enabled: true, ui_visible: true, api_enabled: true },
        ],
      }),
    });
  });

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(authSnapshot(currentLang)),
    });
  });

  await page.route('**/api/v1/auth/preferences', async (route) => {
    let body: Record<string, string> = {};
    try {
      body = route.request().postDataJSON() as Record<string, string>;
    } catch {
      body = {};
    }
    currentLang = body.preferred_lang ?? currentLang;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ preferred_lang: currentLang }),
    });
  });

  await page.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/api/v1/capabilities/lvl3', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          uuid: 'cap-identity',
          page_id: 'C3-1.1',
          title: 'Identity Management',
          slug: 'identity-management',
          parent: { title: 'Enterprise Services' },
          available_spirals: ['Spiral_7'],
        },
      ]),
    });
  });

  await page.route('**/api/v1/services?owner=**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0, page: 1, limit: 100 }),
    });
  });
}

test('reduced UX smoke: capability workspace, locale switch, theme switch', async ({ page }) => {
  await mockAuthenticatedUx(page);
  await page.goto('/capabilities', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Schopnosti' })).toBeVisible();
  await expect(page.locator('a[href="/capabilities?view=coverage"]').first()).toBeVisible();
  await expect(page.locator('a[href="/c3/capability-map-spiral7"]').first()).toBeVisible();

  await page.goto('/user-info', { waitUntil: 'domcontentloaded' });
  await page.locator('select[name="preferred_lang"]').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  const themeButton = page.getByRole('button', { name: /přepínač motivu|theme switch/i });
  const beforeTheme = await page.locator('html').getAttribute('data-theme');
  await themeButton.click();
  await expect.poll(async () => page.locator('html').getAttribute('data-theme')).not.toBe(beforeTheme);
  const afterTheme = await page.locator('html').getAttribute('data-theme');
  await themeButton.click();
  await expect.poll(async () => page.locator('html').getAttribute('data-theme')).not.toBe(afterTheme);
});
