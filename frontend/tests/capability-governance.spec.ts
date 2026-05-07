import { expect, test, type Page } from '@playwright/test';

async function mockCapabilityGovernance(page: Page) {
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

    const coverageItem = {
      capability_uuid: 'cap-iam',
      capability_code: 'C3-IAM',
      capability_title: 'Identity capability',
      slug: 'cap-bmc-identity',
      domain: 'BMC',
      spiral_code: 'Spiral_7',
      coverage_percent: 67,
      total_requirements: 6,
      covered_requirement_count: 4,
      gap_count: 2,
      service_count: 2,
      primary_service_count: 1,
      ready_service_count: 1,
      blocked_service_count: 1,
      readiness_state: 'not_ready',
      services: [
        { service_id: 'SVC-IAM', title: 'Identity Access Management', normalized_role: 'primary', readiness_state: 'ready' },
        { service_id: 'SVC-SSO', title: 'Single Sign-On', normalized_role: 'supporting', readiness_state: 'blocked' },
      ],
    };

    if (url.includes('/api/v1/capabilities/lvl3')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            uuid: 'cap-iam',
            page_id: 'C3-IAM',
            title: 'Identity capability',
            slug: 'cap-bmc-identity',
            parent: { title: 'Battlespace Management' },
            available_spirals: ['Spiral_7'],
          },
        ]),
      });
      return;
    }

    if (url.includes('/api/v1/capabilities/coverage')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [coverageItem],
          counts: { total: 1, uncovered: 0, over_covered: 1, not_ready: 1, ready: 0 },
          filters: { spiral: 'Spiral_7' },
        }),
      });
      return;
    }

    if (url.includes('/api/v1/capabilities/gaps')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ ...coverageItem, gap_type: 'requirement_gap', recommended_action: 'Map services to uncovered C3 requirements.' }],
          counts: { total: 1, uncovered: 0 },
          filters: {},
        }),
      });
      return;
    }

    if (url.includes('/api/v1/capabilities/overlaps')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ ...coverageItem, overlap_score: 82, recommended_action: 'Review duplicate service support and document intended ownership.' }],
          counts: { total: 1 },
          filters: {},
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

test('capability governance pages render coverage, gaps, and overlaps', async ({ page }) => {
  await mockCapabilityGovernance(page);

  await page.goto('/capabilities?view=coverage');
  await expect(page.getByRole('heading', { name: 'Capability workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Capability Coverage' })).toBeVisible();
  await expect(page.getByText('Identity capability')).toBeVisible();
  await expect(page.getByRole('link', { name: /Identity Access Management/ })).toHaveAttribute('href', '/services/SVC-IAM');
  await expect(page.getByRole('link', { name: /Identity capability/ })).toHaveAttribute('href', '/capabilities/cap-bmc-identity');

  await page.goto('/capabilities?view=gaps');
  await expect(page.getByRole('heading', { name: 'Capability Gaps' })).toBeVisible();
  await expect(page.getByText('Map services to uncovered C3 requirements.')).toBeVisible();

  await page.goto('/capabilities?view=overlaps');
  await expect(page.getByRole('heading', { name: 'Capability Overlaps' })).toBeVisible();
  await expect(page.getByText('Review duplicate service support and document intended ownership.')).toBeVisible();
  await expect(page.getByText('SVC-SSO')).toBeVisible();
});
