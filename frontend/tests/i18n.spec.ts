import { expect, test } from '@playwright/test';
import csMessages from '../../shared/i18n/messages/cs.json';
import enMessages from '../../shared/i18n/messages/en.json';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';
type Locale = 'cs' | 'en';

function readyInstallStatus(locale: Locale = 'cs') {
  return {
    mode: 'ready',
    status: 'READY',
    install_locked: false,
    locked_by: null,
    admin_exists: true,
    modules: [
      {
        code: 'C3_TAXONOMY',
        label: locale === 'en' ? 'C3 Taxonomy' : 'C3 Taxonomie',
        is_mandatory: false,
        enabled: true,
        ui_visible: true,
        api_enabled: true,
      },
    ],
  };
}

function authenticatedSnapshot(locale: Locale) {
  return {
    id: 1,
    username: 'admin',
    display_name: locale === 'en' ? 'Admin User' : 'Správce',
    role: 'admin',
    auth_provider: 'local',
    preferred_lang: locale,
    must_change_password: false,
  };
}

async function prepareLocale(page, locale: Locale, options: { ready?: boolean; authenticated?: boolean } = {}) {
  const { ready = false, authenticated = false } = options;
  const cookies = [
    {
      name: 'sc_locale',
      value: locale,
      url: BASE_URL,
    },
  ];

  if (authenticated) {
    cookies.push(
      {
        name: 'sc_access_token',
        value: 'test-access-token',
        url: BASE_URL,
      },
      {
        name: 'sc_refresh_token',
        value: 'test-refresh-token',
        url: BASE_URL,
      },
    );
  }

  await page.context().addCookies(cookies);

  if (authenticated) {
    await page.addInitScript((snapshot) => {
      sessionStorage.setItem('sc_auth_snapshot', JSON.stringify(snapshot));
    }, authenticatedSnapshot(locale));

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authenticatedSnapshot(locale)),
      });
    });
  }

  await page.route('**/api/v1/install/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ready ? readyInstallStatus(locale) : {
        mode: 'fresh',
        status: 'NOT_INSTALLED',
        install_locked: false,
        locked_by: null,
        admin_exists: false,
        modules: [],
      }),
    });
  });
}

test('english login renders from the locale bootstrap snapshot', async ({ page }) => {
  const csKeys = Object.keys(csMessages).sort();
  const enKeys = Object.keys(enMessages).sort();
  expect(enKeys).toEqual(csKeys);

  await prepareLocale(page, 'en', { authenticated: true, ready: true });

  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect.poll(async () => {
    const cookies = await page.context().cookies(BASE_URL);
    return cookies.find((cookie) => cookie.name === 'sc_locale')?.value;
  }).toBe('en');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeVisible();
});

for (const locale of ['cs', 'en'] as const) {
  test(`home page renders localized dashboard copy in ${locale}`, async ({ page }) => {
    await prepareLocale(page, locale, { authenticated: true, ready: true });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(locale === 'cs' ? 'Katalog služeb' : 'Service Catalogue');
    await expect(page.getByText(locale === 'cs' ? 'Přehled služeb, KPI a navigace do seznamu a grafu Service Catalogue.' : 'Overview of services, KPIs, and navigation to the service catalogue list and graph.')).toBeVisible();
    await expect(page.getByText(locale === 'cs' ? 'Taxonomie C3' : 'C3 Taxonomy', { exact: true })).toBeVisible();
  });

  test(`install wizard renders localized chrome in ${locale}`, async ({ page }) => {
    await prepareLocale(page, locale, { ready: false });
    await page.goto('/install', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { name: locale === 'cs' ? /vítejte v/i : /welcome to/i })).toBeVisible();
    await expect(page.getByText(locale === 'cs' ? 'Setup token instalace' : 'Install setup token', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox')).toBeVisible();
    await expect(page.getByRole('button', { name: locale === 'cs' ? /zahájit instalaci/i : /start installation/i })).toBeVisible();
  });

  test(`administration chrome renders localized navigation labels in ${locale}`, async ({ page }) => {
    await prepareLocale(page, locale, { authenticated: true, ready: true });
    await page.goto('/administration');

    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(locale === 'cs' ? 'Administrace' : 'Administration');
    await expect(page.getByRole('link', { name: locale === 'cs' ? 'Administrace' : 'Administration' })).toBeVisible();
    await expect(page.getByRole('link', {
      name: locale === 'cs' ? 'Správa obsahu' : 'Content Admin',
      exact: true,
    })).toBeVisible();
  });
}
