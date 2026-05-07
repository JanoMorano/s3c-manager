import { expect, test } from '@playwright/test';
import path from 'node:path';
import csMessages from '../../shared/i18n/messages/cs.json';
import enMessages from '../../shared/i18n/messages/en.json';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';
const requireFromTest = require;
const dotenv = requireFromTest('../../middleware/node_modules/dotenv');
const jwt = requireFromTest('../../middleware/node_modules/jsonwebtoken');
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
type Locale = 'cs' | 'en';

function signedAccessToken(locale: Locale) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required for authenticated i18n browser tests.');
  const snapshot = authenticatedSnapshot(locale);
  return jwt.sign(
    {
      sub: snapshot.id,
      username: snapshot.username,
      role: snapshot.role,
      display_name: snapshot.display_name,
      preferred_lang: snapshot.preferred_lang,
    },
    secret,
    {
      expiresIn: '30m',
      issuer: 'service-catalogue',
      audience: 'service-catalogue-ui',
    },
  );
}

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
        value: signedAccessToken(locale),
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

async function mockHomeDashboard(page) {
  await page.route('**/api/v1/stats/dashboard-headline', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ kpis: [{ key: 'services_count', value: 0 }] }),
    });
  });
  await page.route('**/api/v1/dashboard/inbox', async (route) => {
    await route.fulfill({
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
  });
  await page.route('**/api/v1/dashboard/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: {
          total_services: 0,
          services_ready_for_publish: 0,
          services_blocked_by_readiness: 0,
          overdue_reviews: 0,
          uncovered_capabilities: 0,
          over_covered_capabilities: 0,
        },
      }),
    });
  });
  await page.route('**/api/v1/stats/operations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sections: { c3_mapping_gap: [], missing_owners: [] } }),
    });
  });
  await page.route('**/api/v1/stats/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ summary: { total_services: 0, active_services: 0 } }),
    });
  });
  await page.route('**/api/v1/stats/completeness', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
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

test('english install admin validation keeps wizard copy in english', async ({ page }) => {
  await prepareLocale(page, 'en', { ready: false });
  await page.route('**/api/v1/install/start', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/install', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^continue/i }).click();
  await page.getByRole('textbox').fill('test-setup-token');
  await page.getByRole('button', { name: /start installation/i }).click();
  await page.getByRole('button', { name: /^skip$/i }).click();
  await page.getByRole('button', { name: /^continue/i }).click();
  await expect(page.getByRole('heading', { name: /create admin account/i })).toBeVisible();
  const adminFields = page.getByRole('textbox');
  await adminFields.nth(0).fill('');
  await adminFields.nth(1).fill('');
  await adminFields.nth(2).fill('not-an-email');
  await adminFields.nth(3).fill('short');
  await adminFields.nth(4).fill('different');
  await page.getByRole('button', { name: /create admin account|save account changes/i }).click();

  await expect(page.locator('html')).toContainText('Required field');
  await expect(page.locator('html')).toContainText('Enter a valid email address');
  await expect(page.locator('html')).toContainText('Password must include uppercase letters, lowercase letters, digits, and a special character');
  await expect(page.locator('html')).not.toContainText('Povinné pole');
  await expect(page.locator('html')).not.toContainText('Zadejte platný e-mail');
  await expect(page.locator('html')).not.toContainText('Heslo musí obsahovat velká písmena');
});

test('english administration users editor keeps provider placeholders in english', async ({ page }) => {
  await prepareLocale(page, 'en', { authenticated: true, ready: true });
  await page.route('**/api/v1/admin/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.goto('/administration/users');
  await page.getByRole('button', { name: /new user/i }).click();

  await expect(page.getByPlaceholder('Leave blank for local account')).toBeVisible();
  await expect(page.getByPlaceholder('At least 8 characters')).toBeVisible();

  await page.getByRole('combobox').nth(1).selectOption('ad');
  await expect(page.getByPlaceholder('DOMAIN\\\\jnovak or jnovak@company.local')).toBeVisible();
  await expect(page.getByPlaceholder('AD account uses domain sign-in')).toBeVisible();
  await expect(page.locator('html')).not.toContainText('Pro local účet nechej prázdné');
  await expect(page.locator('html')).not.toContainText('Minimálně 8 znaků');
});

test('czech administration users localizes role, provider, and action labels from API rows', async ({ page }) => {
  await prepareLocale(page, 'cs', { authenticated: true, ready: true });
  await page.route('**/api/v1/admin/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          username: 'admin',
          display_name: 'Admin User',
          email: 'admin@example.com',
          role: 'viewer',
          role_label: 'User - RO',
          access_label: 'Read-only access',
          is_active: true,
          auth_provider: 'local',
          auth_provider_label: 'Local login',
          external_principal: null,
          last_login_at: null,
          last_sso_login_at: null,
          created_at: null,
          updated_at: null,
          given_name: 'Jan',
          surname: 'Novák',
          department: 'Architektura',
        },
      ]),
    });
  });

  await page.goto('/administration/users');

  await expect(page.locator('html')).toContainText('Uživatel - RO');
  await expect(page.locator('html')).toContainText('Pouze pro čtení v katalogu');
  await expect(page.locator('html')).toContainText('Lokální přihlášení');
  await expect(page.locator('html')).toContainText('Zakládání uživatelů, přiřazení rolí Uživatel / Správa obsahu / Administrátor a správa AD / SSO účtů.');
  await expect(page.getByRole('button', { name: 'Upravit' })).toBeVisible();
  await expect(page.locator('html')).not.toContainText('User - RO');
  await expect(page.locator('html')).not.toContainText('Read-only access');
  await expect(page.locator('html')).not.toContainText('Local login');
  await expect(page.locator('html')).not.toContainText('User / Content Admin / Admin');
  await expect(page.locator('html')).not.toContainText('common.edit');
});

test('english user info renders profile and password labels in english', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await prepareLocale(page, 'en', { authenticated: true, ready: true });
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...authenticatedSnapshot('en'),
        email: 'admin@example.com',
        given_name: 'Jane',
        surname: 'Novak',
        department: 'Architecture',
        phone: '+420 123 456 789',
        avatar_color: '#3b82f6',
      }),
    });
  });
  await page.route('**/api/v1/services?owner=**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0, page: 1, limit: 100 }),
    });
  });

  await page.goto('/user-info');

  await expect(page.getByRole('heading', { level: 1, name: 'User Info' })).toBeVisible();
  await expect(page.locator('html')).toContainText('Given name');
  await expect(page.locator('html')).toContainText('Surname');
  await expect(page.locator('html')).toContainText('Department');
  await expect(page.locator('html')).toContainText('Save profile');
  await expect(page.locator('html')).toContainText('Change password');
  await expect(page.locator('html')).toContainText('Current password');
  await expect(page.locator('html')).toContainText('Confirm password');
  await expect(page.locator('html')).not.toContainText('Jméno');
  await expect(page.locator('html')).not.toContainText('Příjmení');
  await expect(page.locator('html')).not.toContainText('Útvar');
  await expect(page.locator('html')).not.toContainText('Uložit profil');
  await expect(page.locator('html')).not.toContainText('Změna hesla');

  const userSettings = page.getByText('User settings', { exact: true });
  const language = page.getByLabel('Language', { exact: true });
  await expect(language).toBeVisible();
  await expect(page.getByLabel('Persona', { exact: true })).toHaveCount(0);

  const [userSettingsBox, languageBox] = await Promise.all([
    userSettings.boundingBox(),
    language.boundingBox(),
  ]);
  expect(userSettingsBox).not.toBeNull();
  expect(languageBox).not.toBeNull();
  expect(languageBox!.x).toBeGreaterThan(userSettingsBox!.x + userSettingsBox!.width);
  expect(Math.abs(userSettingsBox!.y - languageBox!.y)).toBeLessThan(36);
});

test('english web settings save fallback stays in english', async ({ page }) => {
  await prepareLocale(page, 'en', { authenticated: true, ready: true });
  await page.route('**/api/v1/admin/web-settings', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: '',
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            key: 'auth.sso.header',
            type: 'string',
            description: 'Trusted header',
            default_value: 'X-Forwarded-User',
            value: 'X-Forwarded-User',
          },
        ],
      }),
    });
  });

  await page.goto('/administration/web');
  await page.getByRole('button', { name: /save settings/i }).click();

  await expect(page.locator('html')).toContainText('Save failed (500)');
  await expect(page.locator('html')).not.toContainText('Uložení selhalo');
});

for (const locale of ['cs', 'en'] as const) {
  test(`home page renders current governance cockpit shell in ${locale}`, async ({ page }) => {
    await prepareLocale(page, locale, { authenticated: true, ready: true });
    await mockHomeDashboard(page);
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(locale === 'cs' ? 'Přehled řízení' : 'Management overview');
    await expect(page.getByText(locale === 'cs'
      ? 'Stav portfolia, rizik a rozhodnutí v jednom pohledu.'
      : 'Portfolio, risk, and decision status in one view.')).toBeVisible();
    await expect(page.getByText('Capability gaps', { exact: true })).toBeVisible();
  });

  test(`install wizard renders localized chrome in ${locale}`, async ({ page }) => {
    await prepareLocale(page, locale, { ready: false });
    await page.goto('/install', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { name: locale === 'cs' ? /vítejte v/i : /welcome to/i })).toBeVisible();
    await expect(page.getByText(locale === 'cs' ? 'Prostředí aplikace' : 'Application environment', { exact: true })).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveValue(locale);
    await expect(page.getByRole('button', { name: locale === 'cs' ? /pokračovat/i : /continue/i })).toBeVisible();

    await page.getByRole('button', { name: locale === 'cs' ? /pokračovat/i : /continue/i }).click();

    await expect(page.getByRole('heading', { name: locale === 'cs' ? 'Setup token instalace' : 'Install setup token' })).toBeVisible();
    await expect(page.getByRole('textbox')).toBeVisible();
    await expect(page.getByRole('button', { name: locale === 'cs' ? /zahájit instalaci/i : /start installation/i })).toBeVisible();
  });

  test(`administration chrome renders localized navigation labels in ${locale}`, async ({ page }) => {
    await prepareLocale(page, locale, { authenticated: true, ready: true });
    await page.goto('/administration');

    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(locale === 'cs' ? 'Administrace' : 'Administration');
    await expect(page.locator('main a[href="/administration/users"]')).toContainText(locale === 'cs' ? 'Správa uživatelů' : 'User Management');
    await expect(page.locator('main a[href="/administration/catalogue-ref"]')).toContainText(locale === 'cs' ? 'Editace číselníků katalogu' : 'Catalogue Reference Editing');
  });
}
