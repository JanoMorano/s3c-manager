import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';
const requireFromTest = require;
const dotenv = requireFromTest('../../middleware/node_modules/dotenv');
const jwt = requireFromTest('../../middleware/node_modules/jsonwebtoken');
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

function signedAccessToken() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required for authenticated search browser tests.');

  return jwt.sign(
    {
      sub: 1,
      username: 'admin',
      role: 'admin',
      display_name: 'Spravce',
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

async function mockAuthenticatedReadyApp(page: Page) {
  await page.context().addCookies([
    {
      name: 'sc_access_token',
      value: signedAccessToken(),
      url: BASE_URL,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'sc_locale',
      value: 'cs',
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
            { code: 'MANAGEMENT', enabled: true, ui_visible: true, api_enabled: true },
            { code: 'CORE', enabled: true, ui_visible: true, api_enabled: true },
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
          display_name: 'Spravce',
          role: 'admin',
          auth_provider: 'local',
          preferred_lang: 'cs',
          must_change_password: false,
        }),
      });
    }
    if (url.includes('/api/v1/search/global') || url.includes('/api/v1/search/suggest')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'schopnost',
          total: 4,
          groups: [
            {
              key: 'c3_taxonomy',
              label: 'C3 Taxonomy',
              module_code: 'C3_TAXONOMY',
              module_label: 'C3',
              kind: 'module',
              items: [{ code: 'C3-CAP', title: 'Schopnost veleni', href: '/c3/C3-CAP' }],
            },
            {
              key: 'service_catalogue',
              label: 'Service Catalogue',
              module_code: 'SERVICE_CATALOGUE_CORE',
              module_label: 'Service Catalogue',
              kind: 'module',
              items: [{ code: 'SVC-1', title: 'Sluzba schopnosti', href: '/services/SVC-1' }],
            },
            {
              key: 'management',
              label: 'Management Cockpit',
              module_code: 'MANAGEMENT',
              module_label: 'Management',
              kind: 'module',
              items: [{ code: 'DECISION-1', title: 'Rozhodnuti ke schopnosti', href: '/operations/decisions' }],
            },
            {
              key: 'help',
              label: 'Help',
              module_code: 'CORE',
              module_label: 'Core',
              kind: 'help',
              items: [{ code: 'HELP-C3', title: 'Napoveda ke schopnostem', href: '/help-cs/c3' }],
            },
          ],
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

test('global search route keeps fulltext query grouped across modules', async ({ page }) => {
  await mockAuthenticatedReadyApp(page);

  await page.goto('/search?query=schopnost');

  await expect(page).toHaveURL(/\/search\?query=schopnost$/);
  await expect(page.getByRole('heading', { name: 'Search across S3C Manager' })).toBeVisible();
  await expect(page.getByText('C3 Taxonomy')).toBeVisible();
  await expect(page.getByText('Service Catalogue')).toBeVisible();
  await expect(page.getByText('Management Cockpit')).toBeVisible();
  await expect(page.getByText('Help')).toBeVisible();
});
