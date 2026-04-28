import { expect, test } from '@playwright/test';

async function mockAuthenticatedReadyApp(page: import('@playwright/test').Page, locale = 'cs') {
  await page.context().addCookies([
    {
      name: 'sc_access_token',
      value: 'test-access-token',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'sc_locale',
      value: locale,
      domain: '127.0.0.1',
      path: '/',
      sameSite: 'Lax',
    },
  ]);
  await page.route('**/api/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/api/v1/install/status')) {
      return route.fulfill({
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
    }
    if (url.includes('/api/v1/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          username: 'admin',
          display_name: 'Admin User',
          role: 'admin',
          auth_provider: 'local',
          preferred_lang: locale,
          must_change_password: false,
        }),
      });
    }
    if (url.includes('/api/v1/auth/refresh')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

test('help page follows the Czech IA chapters and sidebar help center', async ({ page }) => {
  await mockAuthenticatedReadyApp(page, 'cs');

  await page.goto('/help');

  const sidebar = page.getByLabel('Main navigation');
  await expect(sidebar.getByRole('link', { name: 'Nápověda', exact: true })).toHaveAttribute('href', '/help');
  await expect(page.getByRole('button', { name: 'Nápověda k této stránce' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole('heading', { name: 'Help', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pro uživatele' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pro správce obsahu' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pro administrátora' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tutoriály' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '1) Začínáme' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '2) Práce se službami' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '3) Provazování' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '4) Vyhodnocení výsledků' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '5) Správa dat' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '6) Instalace a provoz' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '7) FAQ' })).toBeVisible();
  await expect(page.locator('text=help.services.search-filter').first()).toBeVisible();
  await expect(page.locator('text=Service ID: SVC-NET-001').first()).toBeVisible();
  await expect(page.locator('text=Requestable = Yes, ale chybí Request channel').first()).toBeVisible();
  await expect(page.locator('text=is_publishable = TRUE pouze pokud platí současně').first()).toBeVisible();
  await expect(page.locator('text=./scripts/backup-postgres.sh').first()).toBeVisible();
  await expect(page.locator('text=Content owner, Reviewer, Approver').first()).toBeVisible();

  await expect(page.getByRole('dialog', { name: 'Nápověda k této stránce' })).toHaveCount(0);
});

test('help page and help center can render English content from the shared locale model', async ({ page }) => {
  await mockAuthenticatedReadyApp(page, 'en');

  await page.goto('/help');

  await expect(page.getByRole('heading', { name: 'Help', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '1) Getting Started' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '2) Working With Services' })).toBeVisible();
  await expect(page.getByText('Service ID: SVC-NET-001')).toBeVisible();
  await expect(page.getByText('is_publishable = TRUE only when all conditions are met')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Help for this page' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Help for this page' })).toHaveCount(0);
});

test('help page exposes German and Slovak chapter localization', async ({ page }) => {
  await mockAuthenticatedReadyApp(page, 'de');
  await page.goto('/help');
  await expect(page.getByRole('heading', { name: '1) Erste Schritte' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '4) Ergebnisauswertung' })).toBeVisible();

  await page.context().clearCookies();
  await mockAuthenticatedReadyApp(page, 'sk');
  await page.goto('/help');
  await expect(page.getByRole('heading', { name: '1) Začíname' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '4) Vyhodnotenie výsledkov' })).toBeVisible();
});

test('home page no longer exposes FMN Air C2 production link', async ({ page }) => {
  await mockAuthenticatedReadyApp(page, 'cs');

  await page.goto('/');

  await expect(page.getByText('FMN Air C2 Coverage')).toHaveCount(0);
  await expect(page.locator('a[href="/c3/fmn-air-c2"]')).toHaveCount(0);
});
