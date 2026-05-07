import { expect, test, type Page } from '@playwright/test';

async function mockDecisionCockpit(page: Page) {
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

    if (url.includes('/api/v1/dashboard/summary')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: {
            total_services: 12,
            services_ready_for_publish: 7,
            services_blocked_by_readiness: 5,
            overdue_reviews: 2,
            uncovered_capabilities: 4,
            over_covered_capabilities: 3,
            active_governance_reviews: 6,
            recent_decisions: 9,
          },
          links: {
            governance_health: '/operations',
            readiness_queue: '/operations/readiness',
            capability_coverage: '/capabilities?view=coverage',
            review_deadlines: '/operations/reviews',
            owner_load: '/operations/owner-load',
            recent_decisions: '/operations/decisions',
          },
        }),
      });
      return;
    }

    if (url.includes('/api/v1/stats/operations')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: { total_services: 12, active_services: 9, requestable_services: 7 },
          sections: {
            incomplete_metadata: [],
            missing_owners: [],
            top_completeness: [],
            deprecated_retired: [],
            offering_evidence: { total_services: 12, with_evidence: 8, coverage_percent: 67, missing: [] },
            c3_mapping_gap: [{ item_type: 'CP', total_count: 10, mapped_count: 6, gap_count: 4 }],
          },
        }),
      });
      return;
    }

    if (url.includes('/api/v1/governance/owner-load')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ owner_key: 'owner@example.com', owner_name: 'Service Owner', owned_services: 15, live_services: 10, readiness_blockers: 3, owner_load_score: 67, c3_gaps: 2 }] }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });
}

test('operations action queue renders the decision summary sections', async ({ page }) => {
  await mockDecisionCockpit(page);

  await page.goto('/operations');
  await expect(page.getByRole('heading', { name: /operations queue/i })).toBeVisible();

  const summary = page.getByLabel('Operations action summary');
  await expect(summary.getByRole('link', { name: /readiness queue/i })).toHaveAttribute('href', '/operations/readiness');
  await expect(summary.getByRole('link', { name: /^reviews/i })).toHaveAttribute('href', '/operations/reviews');
  await expect(summary.getByRole('link', { name: /^owner load/i })).toHaveAttribute('href', '/operations#owner-load');
  await expect(summary.getByRole('link', { name: /^decisions/i })).toHaveAttribute('href', '/operations/decisions');
  await expect(page.getByRole('heading', { name: /import and data quality/i })).toBeVisible();
});
