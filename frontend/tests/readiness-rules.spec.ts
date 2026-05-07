import { expect, test, type Page } from '@playwright/test';

async function mockAuthenticatedReadiness(page: Page) {
  await page.context().addCookies([
    {
      name: 'sc_access_token',
      value: 'test-access-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'sc_locale',
      value: 'en',
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
    },
  ]);

  let exceptionCreated = false;

  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/api/v1/install/status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'READY',
          modules: [{ code: 'SERVICE_CATALOGUE_CORE', enabled: true, ui_visible: true, api_enabled: true }],
        }),
      });
      return;
    }

    if (url.includes('/api/v1/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          username: 'admin',
          display_name: 'Admin User',
          role: 'admin',
          auth_provider: 'local',
          preferred_lang: 'en',
          must_change_password: false,
        }),
      });
      return;
    }

    if (url.includes('/api/v1/readiness/services/SVC-BLOCKED/exceptions') && route.request().method() === 'POST') {
      exceptionCreated = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          item: {
            id: 5,
            rule_key: 'service_has_owner',
            reason: 'Owner assigned in migration tracker',
            expires_at: '2026-06-01T00:00:00Z',
            approved_by: 'admin@example.com',
          },
        }),
      });
      return;
    }

    if (url.includes('/api/v1/readiness/summary')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          counts: { total: 3, blockers: 1, warnings: 1, ready: 1 },
          groups: {
            blockers: [
              {
                service_pk: 1,
                service_id: 'SVC-BLOCKED',
                title: 'Blocked Identity Service',
                service_status: 'active',
                is_publishable: false,
                blockers: ['Service has owner'],
                warnings: [],
                rules: [
                  {
                    rule_key: 'service_has_owner',
                    title: 'Service has owner',
                    status: 'failed',
                    severity: 'P0',
                    blocking: true,
                    message: 'Service has owner',
                    exception: null,
                  },
                ],
              },
            ],
            warnings: [
              {
                service_pk: 2,
                service_id: 'SVC-WARN',
                title: 'Warning Collaboration Service',
                service_status: 'active',
                is_publishable: true,
                blockers: [],
                warnings: ['Service has dependencies'],
                rules: [
                  {
                    rule_key: 'service_has_dependency_classification',
                    title: 'Service has dependencies',
                    status: 'failed',
                    severity: 'P2',
                    blocking: false,
                    message: 'Service has dependencies',
                    exception: {
                      reason: 'Old waiver',
                      expires_at: '2026-04-01T00:00:00Z',
                      expired: true,
                    },
                  },
                ],
              },
            ],
            ready: [
              {
                service_pk: 3,
                service_id: 'SVC-READY',
                title: 'Ready Portal Service',
                service_status: 'active',
                is_publishable: true,
                blockers: [],
                warnings: [],
                rules: [
                  {
                    rule_key: 'service_has_owner',
                    title: 'Service has owner',
                    status: 'passed',
                    severity: 'P0',
                    blocking: true,
                    message: 'Service has owner',
                    exception: null,
                  },
                ],
              },
            ],
          },
          items: [
            {
              service_pk: 1,
              service_id: 'SVC-BLOCKED',
              title: 'Blocked Identity Service',
              service_status: 'active',
              is_publishable: false,
              blockers: ['Service has owner'],
              warnings: [],
              rules: [
                {
                  rule_key: 'service_has_owner',
                  title: 'Service has owner',
                  status: 'failed',
                  severity: 'P0',
                  blocking: true,
                  message: 'Service has owner',
                  exception: null,
                },
              ],
            },
            {
              service_pk: 2,
              service_id: 'SVC-WARN',
              title: 'Warning Collaboration Service',
              service_status: 'active',
              is_publishable: true,
              blockers: [],
              warnings: ['Service has dependencies'],
              rules: [
                {
                  rule_key: 'service_has_dependency_classification',
                  title: 'Service has dependencies',
                  status: 'failed',
                  severity: 'P2',
                  blocking: false,
                  message: 'Service has dependencies',
                  exception: {
                    reason: 'Old waiver',
                    expires_at: '2026-04-01T00:00:00Z',
                    expired: true,
                  },
                },
              ],
            },
            {
              service_pk: 3,
              service_id: 'SVC-READY',
              title: 'Ready Portal Service',
              service_status: 'active',
              is_publishable: true,
              blockers: [],
              warnings: [],
              rules: [
                {
                  rule_key: 'service_has_owner',
                  title: 'Service has owner',
                  status: 'passed',
                  severity: 'P0',
                  blocking: true,
                  message: 'Service has owner',
                  exception: null,
                },
              ],
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'not mocked' }),
    });
  });

  return {
    wasExceptionCreated: () => exceptionCreated,
  };
}

test('readiness gate renders rule groups and creates an exception', async ({ page }) => {
  const tracker = await mockAuthenticatedReadiness(page);

  await page.goto('/operations/readiness');

  await expect(page.getByRole('heading', { name: /readiness gate/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Blocked Identity Service/ })).toBeVisible();
  await expect(page.getByText('P0').first()).toBeVisible();

  await page.locator('aside').getByRole('button', { name: /^Exception$/ }).click();
  await page.getByLabel('Exception reason').fill('Owner assigned in migration tracker');
  await page.getByLabel('Exception expiry').fill('2026-06-01');
  await page.getByRole('button', { name: /approve exception/i }).click();

  await expect.poll(() => tracker.wasExceptionCreated()).toBe(true);

  await page.getByRole('button', { name: /warnings/i }).click();
  await expect(page.getByRole('button', { name: /Warning Collaboration Service/ })).toBeVisible();
  await expect(page.getByText('expired exception')).toBeVisible();

  await page.getByRole('button', { name: /ready/i }).click();
  await expect(page.getByRole('button', { name: /Ready Portal Service/ })).toBeVisible();
});
