import { expect, test } from '@playwright/test';

async function mockAuthenticatedPortfolio(page: import('@playwright/test').Page) {
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

  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/api/v1/install/status')) {
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

    if (url.includes('/api/v1/portfolio')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 1,
              portfolio_code: 'APP',
              title: 'Application Services',
              description: 'Application-facing service portfolio',
              status_code: 'active',
              owner_group_id: 3,
              owner_group_name: 'Architecture Office',
              service_count: 7,
              active_service_count: 5,
              draft_service_count: 1,
              retiring_service_count: 1,
              retired_service_count: 0,
              requestable_service_count: 4,
              overdue_review_count: 2,
            },
            {
              id: 2,
              portfolio_code: 'C2',
              title: 'Command Services',
              description: 'Command and control capabilities',
              status_code: 'planning',
              owner_group_id: null,
              owner_group_name: null,
              service_count: 3,
              active_service_count: 1,
              draft_service_count: 2,
              retiring_service_count: 0,
              retired_service_count: 0,
              requestable_service_count: 1,
              overdue_review_count: 0,
            },
          ],
          count: 2,
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
}

test('portfolio page renders status and links to portfolio detail', async ({ page }) => {
  await mockAuthenticatedPortfolio(page);

  await page.goto('/portfolio');

  await expect(page.getByRole('heading', { name: /portfolios/i })).toBeVisible();
  await expect(page.getByText('Application Services')).toBeVisible();
  await expect(page.getByText('Architecture Office')).toBeVisible();
  await expect(page.getByLabel('Portfolio list').getByText('2 overdue')).toBeVisible();

  const detailLink = page.getByRole('link', { name: /open application services portfolio detail/i });
  await expect(detailLink).toHaveAttribute('href', /\/portfolio\/APP/);

  await page.getByLabel('Status').selectOption('planning');
  await expect(page.getByText('Command Services')).toBeVisible();
  await expect(page.getByText('Application Services')).toHaveCount(0);
});
