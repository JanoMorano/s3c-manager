import { expect, test } from '@playwright/test';

async function mockAuthenticatedOperations(page: import('@playwright/test').Page) {
  const requestedUrls: string[] = [];

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
      value: 'cs',
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
    },
  ]);

  await page.route('**/api/v1/**', (route) => {
    const url = route.request().url();
    requestedUrls.push(url);

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
          display_name: 'Admin User',
          role: 'admin',
          auth_provider: 'local',
          preferred_lang: 'cs',
          must_change_password: false,
        }),
      });
    }

    if (url.includes('/api/v1/dashboard/summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: {
            total_services: 3,
            services_ready_for_publish: 1,
            services_blocked_by_readiness: 1,
            overdue_reviews: 1,
            active_governance_reviews: 2,
            recent_decisions: 1,
          },
          links: {
            governance_health: '/operations',
            readiness_queue: '/operations/readiness',
            review_deadlines: '/operations/reviews',
            owner_load: '/operations/owner-load',
            recent_decisions: '/operations/decisions',
          },
        }),
      });
    }

    if (url.includes('/api/v1/stats/operations')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: { total_services: 3, active_services: 2, requestable_services: 1 },
          sections: {
            incomplete_metadata: [
              { service_id: 'SVC-IAM', title: 'Identity Access Management', completeness_score: 42, service_status: 'draft' },
            ],
            missing_owners: [
              { service_id: 'SVC-PORTAL', title: 'Employee Portal', completeness_score: 68, service_status: 'active' },
            ],
            top_completeness: [],
            deprecated_retired: [],
            offering_evidence: { total_services: 3, with_evidence: 2, coverage_percent: 67, missing: [] },
            c3_mapping_gap: [{ item_type: 'CP', total_count: 4, mapped_count: 2, gap_count: 2 }],
          },
        }),
      });
    }

    if (url.includes('/api/v1/readiness/summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          counts: { total: 2, blockers: 1, warnings: 0, ready: 1 },
          groups: {
            blockers: [
              {
                service_pk: 1,
                service_id: 'SVC-IAM',
                title: 'Identity Access Management',
                service_status: 'draft',
                is_publishable: false,
                blockers: ['Service has owner'],
                warnings: [],
                rules: [],
              },
            ],
            warnings: [],
            ready: [],
          },
          items: [],
        }),
      });
    }

    if (url.includes('/api/v1/governance/reviews')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 7,
              service_id: 'SVC-IAM',
              service_title: 'Identity Access Management',
              review_type: 'publish',
              status: 'pending',
              requested_by: 'admin@example.com',
              assigned_to: 'reviewer@example.com',
              due_at: '2026-04-01T00:00:00Z',
              overdue: true,
            },
          ],
          count: 1,
        }),
      });
    }

    if (url.includes('/api/v1/governance/decisions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 44,
              service_id: 'SVC-IAM',
              service_title: 'Identity Access Management',
              decision_type: 'exception',
              decision: 'deferred',
              rationale: 'Owner remediation tracked in readiness queue.',
              decided_by: 'admin@example.com',
              decided_at: '2026-04-29T00:00:00Z',
            },
          ],
          count: 1,
        }),
      });
    }

    if (url.includes('/api/v1/governance/owner-load/assignments')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              assignment_id: 10,
              owner_key: 'owner@example.com',
              display_name: 'Service Owner',
              email: 'owner@example.com',
              organization_name: 'Architecture',
              role_code: 'service_owner',
              role_name: 'Service owner',
              service_pk: 1,
              service_id: 'SVC-IAM',
              service_title: 'Identity Access Management',
              service_status_code: 'active',
              lifecycle_state: 'live',
            },
            {
              assignment_id: 11,
              owner_key: 'owner@example.com',
              display_name: 'Service Owner',
              email: 'owner@example.com',
              organization_name: 'Architecture',
              role_code: 'technical_owner',
              role_name: 'Technical owner',
              service_pk: 2,
              service_id: 'SVC-PORTAL',
              service_title: 'Employee Portal',
              service_status_code: 'active',
              lifecycle_state: 'live',
            },
          ],
        }),
      });
    }

    if (url.includes('/api/v1/governance/owner-load')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              owner_key: 'owner@example.com',
              owner_name: 'Service Owner',
              owner_email: 'owner@example.com',
              owned_services: 15,
              live_services: 10,
              critical_services: 1,
              readiness_blockers: 3,
              overdue_reviews: 2,
              c3_gaps: 2,
              owner_load_score: 67,
            },
          ],
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });

  return { requestedUrls };
}

test('operations page renders the focused action queue without GRC/procurement panels', async ({ page }) => {
  const tracker = await mockAuthenticatedOperations(page);

  await page.goto('/operations');

  await expect(page.getByRole('heading', { name: /operations queue/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /action queue/i })).toBeVisible();
  const summary = page.getByLabel('Operations action summary');
  await expect(summary.getByRole('link', { name: /readiness queue/i })).toHaveAttribute('href', '/operations/readiness');
  await expect(summary.getByRole('link', { name: /^reviews/i })).toHaveAttribute('href', '/operations/reviews');
  await expect(summary.getByRole('link', { name: /^decisions/i })).toHaveAttribute('href', '/operations/decisions');
  await expect(summary.getByRole('link', { name: /^owner load/i })).toHaveAttribute('href', '/operations#owner-load');
  await expect(page.getByRole('link', { name: /service owner.*15 services/i })).toHaveAttribute('href', '/operations?owner=owner%40example.com#owner-load');
  await expect(page.getByRole('heading', { name: /import and data quality/i })).toBeVisible();
  await expect(page.getByText('Owner remediation tracked in readiness queue.')).toBeVisible();

  await expect(page.getByText('Service Risk Radar')).toHaveCount(0);
  await expect(page.getByText('Contract Overlap')).toHaveCount(0);
  await expect(page.getByText('Governance Advisor')).toHaveCount(0);
  expect(tracker.requestedUrls.some((url) => url.includes('/api/v1/governance/risk-radar'))).toBe(false);
  expect(tracker.requestedUrls.some((url) => url.includes('/api/v1/governance/contract-overlap'))).toBe(false);
  expect(tracker.requestedUrls.some((url) => url.includes('/api/v1/governance/renewal-calendar'))).toBe(false);
  expect(tracker.requestedUrls.some((url) => url.includes('/api/v1/governance/advisor'))).toBe(false);
});

test('owner load route redirects into the operations panel with assignments', async ({ page }) => {
  await mockAuthenticatedOperations(page);

  await page.goto('/operations/owner-load?owner=owner%40example.com');

  await expect(page).toHaveURL(/\/operations\?owner=owner%40example\.com#owner-load/);
  await expect(page.getByRole('heading', { name: /operations queue/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /assignments for owner@example\.com/i })).toBeVisible();
  const assignments = page.locator('[aria-label="Selected owner assignments"]');
  await expect(assignments.getByRole('link', { name: /Identity Access Management/ })).toHaveAttribute('href', '/services/SVC-IAM/edit#ownership');
  await expect(assignments.getByRole('link', { name: /Employee Portal/ })).toHaveAttribute('href', '/services/SVC-PORTAL/edit#ownership');
});
