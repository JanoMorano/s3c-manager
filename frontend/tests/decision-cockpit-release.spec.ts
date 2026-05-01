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
            capability_coverage: '/capabilities/coverage',
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
            pricing_patrol: { total_services: 12, with_pricing: 8, coverage_percent: 67, missing: [] },
            c3_mapping_gap: [{ item_type: 'CP', total_count: 10, mapped_count: 6, gap_count: 4 }],
          },
        }),
      });
      return;
    }

    if (url.includes('/api/v1/governance/risk-radar')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ finding_key: 'risk:iam', severity: 'P0', title: 'Identity Access Management', reason: 'Readiness blocker.', target_url: '/services/SVC-IAM/edit', source_entity_type: 'service', source_entity_id: '1', service_id: 'SVC-IAM', score: 100 }] }),
      });
      return;
    }

    if (url.includes('/api/v1/governance/owner-load')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ owner_key: 'owner@example.com', owner_name: 'Service Owner', owned_services: 15, live_services: 10, readiness_blockers: 3, owner_load_score: 67, contract_gaps: 1, c3_gaps: 2 }] }),
      });
      return;
    }

    if (url.includes('/api/v1/governance/contract-overlap')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
      return;
    }

    if (url.includes('/api/v1/governance/renewal-calendar')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
      return;
    }

    if (url.includes('/api/v1/governance/advisor')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ finding_key: 'advisor:iam', severity: 'P1', title: 'Close IAM readiness', reason: 'Needs owner decision.', suggested_action: 'Assign review.', target_url: '/operations/reviews', finding_type: 'readiness' }] }),
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

test('dashboard redirects to operations cockpit with decision summary sections', async ({ page }) => {
  await mockDecisionCockpit(page);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/operations$/);
  await expect(page.getByRole('heading', { name: /decision cockpit/i })).toBeVisible();

  await expect(page.getByRole('link', { name: /governance health/i })).toHaveAttribute('href', '/operations');
  await expect(page.getByRole('link', { name: /readiness queue/i })).toHaveAttribute('href', '/operations/readiness');
  await expect(page.getByRole('link', { name: /capability coverage/i })).toHaveAttribute('href', '/capabilities/coverage');
  await expect(page.getByRole('link', { name: /review deadlines/i })).toHaveAttribute('href', '/operations/reviews');
  await expect(page.getByRole('link', { name: /owner load/i })).toHaveAttribute('href', '/operations/owner-load');
  await expect(page.getByRole('link', { name: /recent decisions/i })).toHaveAttribute('href', '/operations/decisions');
});
