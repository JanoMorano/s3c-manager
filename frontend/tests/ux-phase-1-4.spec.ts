import { expect, test } from '@playwright/test';
import path from 'node:path';

const requireFromTest = require;
const dotenv = requireFromTest('../../middleware/node_modules/dotenv');
const jwt = requireFromTest('../../middleware/node_modules/jsonwebtoken');

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

function signedAccessToken() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required for UX smoke auth cookie');
  return jwt.sign(
    {
      sub: Number(process.env.SMOKE_ADMIN_ID ?? 1),
      username: process.env.SMOKE_ADMIN_USERNAME ?? 'ux-smoke',
      role: 'admin',
      display_name: 'UX Smoke',
      preferred_lang: 'cs',
    },
    secret,
    {
      expiresIn: '30m',
      issuer: 'service-catalogue',
      audience: 'service-catalogue-ui',
    },
  );
}

async function authenticate(page, preferredLang = 'cs') {
  await page.context().addCookies([
    { name: 'sc_access_token', value: signedAccessToken(), url: BASE_URL },
    { name: 'sc_locale', value: preferredLang, url: BASE_URL },
  ]);
  await page.addInitScript((snapshot) => {
    sessionStorage.setItem('sc_auth_snapshot', JSON.stringify(snapshot));
  }, {
    id: 1,
    username: 'ux-smoke',
    display_name: 'UX Smoke',
    role: 'admin',
    auth_provider: 'local',
    preferred_lang: preferredLang,
    must_change_password: false,
  });
}

test('phase 1-4 UX smoke: unified C3 dashboard, locale switch, theme switch', async ({ page }) => {
  await authenticate(page);
  await page.goto('/c3/dashboard', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'C3 Dashboard' })).toBeVisible();
  const dashboardTabs = page.getByRole('navigation', { name: /C3 dashboard sections/i });
  await expect(dashboardTabs.getByRole('link', { name: /overview|přehled|übersicht/i })).toBeVisible();
  await expect(dashboardTabs.getByRole('link', { name: /health|zdraví|status/i })).toBeVisible();
  await expect(dashboardTabs.getByRole('link', { name: /mappings|mapování|zuordnungen/i })).toBeVisible();
  await expect(dashboardTabs.getByRole('link', { name: /imports|importy|importe/i })).toBeVisible();
  await expect(dashboardTabs.getByRole('link', { name: /review|revize|prüfung/i })).toBeVisible();

  await page.goto('/user-info', { waitUntil: 'domcontentloaded' });
  await page.locator('select[name="preferred_lang"]').selectOption('de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');

  const themeButton = page.getByRole('button', { name: /přepínač motivu|theme switch|designauswahl/i });
  const beforeTheme = await page.locator('html').getAttribute('data-theme');
  await themeButton.click();
  await expect.poll(async () => page.locator('html').getAttribute('data-theme')).not.toBe(beforeTheme);
  const afterTheme = await page.locator('html').getAttribute('data-theme');
  await themeButton.click();
  await expect.poll(async () => page.locator('html').getAttribute('data-theme')).not.toBe(afterTheme);
});
