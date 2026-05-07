import { expect, test } from '@playwright/test';
import path from 'node:path';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';
const requireFromTest = require;
const dotenv = requireFromTest('../../middleware/node_modules/dotenv');
const jwt = requireFromTest('../../middleware/node_modules/jsonwebtoken');
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

type Locale = 'cs' | 'en';

function signedAccessToken(locale: Locale) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required for authenticated Help browser tests.');

  return jwt.sign(
    {
      sub: 1,
      username: 'admin',
      role: 'admin',
      display_name: locale === 'en' ? 'Admin User' : 'Správce',
      preferred_lang: locale,
    },
    secret,
    {
      expiresIn: '30m',
      issuer: 'service-catalogue',
      audience: 'service-catalogue-ui',
    },
  );
}

async function mockAuthenticatedReadyApp(page: import('@playwright/test').Page, locale: Locale = 'cs') {
  await page.context().addCookies([
    {
      name: 'sc_access_token',
      value: signedAccessToken(locale),
      url: BASE_URL,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'sc_locale',
      value: locale,
      url: BASE_URL,
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
          display_name: locale === 'en' ? 'Admin User' : 'Správce',
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
    if (url.includes('/api/v1/stats/dashboard-headline')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kpis: [] }),
      });
    }
    if (url.includes('/api/v1/dashboard/inbox')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          my_owned_services: [],
          my_reviews: [],
          my_blockers: [],
          my_decisions: [],
        }),
      });
    }
    if (url.includes('/api/v1/stats/completeness')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
    if (url.includes('/api/v1/dashboard/summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ summary: {} }),
      });
    }
    if (url.includes('/api/v1/stats/operations')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sections: { c3_mapping_gap: [], missing_owners: [] } }),
      });
    }
    if (url.includes('/api/v1/stats/dashboard')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ summary: {} }),
      });
    }
    if (url.includes('/api/v1/services')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, limit: 100 }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

test('help button lives above version and opens Czech Help manual', async ({ page }) => {
  await mockAuthenticatedReadyApp(page, 'cs');

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const sidebar = page.getByLabel('Main navigation');
  await expect(sidebar.getByRole('link', { name: 'Nápověda-2', exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'Nápověda', exact: true })).toHaveAttribute('href', '/help-cs');
  const helpOrder = await sidebar.locator('a').evaluateAll((links) =>
    links.map((link) => (link.textContent ?? '').trim()).filter((text) => text === 'Nápověda')
  );
  expect(helpOrder).toEqual(['Nápověda']);
  await expect(sidebar.getByRole('link', { name: 'Nápověda', exact: true })).toBeVisible();
  await expect(sidebar.locator('text=v.1.2')).toBeVisible();

  await sidebar.getByRole('link', { name: 'Nápověda', exact: true }).click({ force: true });
  await expect(page).toHaveURL(/\/help-cs$/);
  await expect(page.getByRole('link', { name: /Návrat do aplikace/ })).toHaveAttribute('href', '/');
  await expect(page.getByRole('heading', { name: 'S3C Manager - uživatelský a administrátorský manuál', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /01 Instalace/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /08 Administrace/ }).first()).toBeVisible();
});

test('english locale opens English Help manual', async ({ page }) => {
  await mockAuthenticatedReadyApp(page, 'en');

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const sidebar = page.getByLabel('Main navigation');
  await expect(sidebar.getByRole('link', { name: 'Help', exact: true })).toHaveAttribute('href', '/help-en');
  await sidebar.getByRole('link', { name: 'Help', exact: true }).click({ force: true });

  await expect(page).toHaveURL(/\/help-en$/);
  await expect(page.getByRole('link', { name: /Back to application/ })).toHaveAttribute('href', '/');
  await expect(page.getByRole('heading', { name: 'S3C Manager - user and administrator manual', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /01 Installation/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /08 Administration/ }).first()).toBeVisible();
});

test('legacy /help route redirects by locale to the in-app Help manual', async ({ page }) => {
  await mockAuthenticatedReadyApp(page, 'en');

  await page.goto('/help');

  await expect(page).toHaveURL(/\/help-en$/);
  await expect(page.getByRole('heading', { name: 'S3C Manager - user and administrator manual', level: 1 })).toBeVisible();
  await expect(page.locator('.chapter-kicker', { hasText: 'Help index' })).toBeVisible();
});

test('Czech Help renders the in-app manual and chapter routes', async ({ page }) => {
  await mockAuthenticatedReadyApp(page, 'cs');

  await page.goto('/help-cs/01-install.html');

  await expect(page).toHaveURL(/\/help-cs\/01-install\.html$/);
  await expect(page.getByRole('heading', { name: 'Instalační wizard: 12 obrazovek' })).toBeVisible();
  await expect(page.getByRole('link', { name: /02 Podstata aplikace/ }).first()).toHaveAttribute('href', '/help-cs/02-welcome');
  await expect(page.getByText('/img/help-cs/install-01-welcome.png')).toBeVisible();
});

test('English Help renders the in-app manual', async ({ page }) => {
  await mockAuthenticatedReadyApp(page, 'en');

  await page.goto('/help-en/01-install.html');

  await expect(page).toHaveURL(/\/help-en\/01-install\.html$/);
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
  await expect(page.getByRole('link', { name: /02 Application purpose/ }).first()).toHaveAttribute('href', '/help-en/02-welcome');
  await expect(page.getByText('/img/help-en/01-install.png')).toBeVisible();
});

test('home page no longer exposes FMN Air C2 production link', async ({ page }) => {
  await mockAuthenticatedReadyApp(page, 'cs');

  await page.goto('/');

  await expect(page.getByText('FMN Air C2 Coverage')).toHaveCount(0);
  await expect(page.locator('a[href="/c3/fmn-air-c2"]')).toHaveCount(0);
});
