import { expect, test } from '@playwright/test';

async function mockAuthenticatedOperations(page: import('@playwright/test').Page) {
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

    if (url.includes('/api/v1/stats/operations')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: { total_services: 3, active_services: 2, requestable_services: 1 },
          sections: {
            incomplete_metadata: [],
            missing_owners: [],
            top_completeness: [],
            deprecated_retired: [],
            pricing_patrol: { total_services: 3, with_pricing: 2, coverage_percent: 67, missing: [] },
            c3_mapping_gap: [],
          },
        }),
      });
    }

    if (url.includes('/api/v1/governance/risk-radar')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              finding_key: 'service:1:missing-owner',
              severity: 'P0',
              title: 'Identity Access Management',
              reason: 'Service has no active service owner.',
              target_url: '/services/SVC-IAM/edit',
              source_entity_type: 'service',
              source_entity_id: '1',
              service_id: 'SVC-IAM',
              service_pk: 1,
              rule_code: 'missing_owner',
              score: 100,
            },
            {
              finding_key: 'c3:81c5e1fe-962c-414a-9724-a70776e34548:needs-mapping',
              severity: 'P2',
              title: '[E2E] Capability 96018781',
              reason: 'Capability needs mapping.',
              target_url: '/services/4',
              source_entity_type: 'c3_capability',
              source_entity_id: '81c5e1fe-962c-414a-9724-a70776e34548',
              service_id: 'AUTO96018781',
              service_pk: 4,
              rule_code: 'missing_c3_mapping',
              score: 42,
            },
          ],
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
              owned_services: 15,
              live_services: 10,
              readiness_blockers: 3,
              owner_load_score: 67,
            },
          ],
        }),
      });
    }

    if (url.includes('/api/v1/governance/contract-overlap')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              overlap_scope: 'capability',
              overlap_key: 'cap-iam',
              overlap_title: 'Identity capability',
              contract_count: 2,
              vendor_count: 2,
              severity: 'P2',
            },
          ],
        }),
      });
    }

    if (url.includes('/api/v1/governance/renewal-calendar')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    }

    if (url.includes('/api/v1/governance/advisor')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              finding_key: 'contract-overlap:capability:cap-iam',
              severity: 'P2',
              title: 'Contract overlap: Identity capability',
              reason: 'Target is covered by 2 contracts across 2 vendors.',
              suggested_action: 'Review overlap.',
              target_url: '/operations/contracts?overlap=cap-iam',
            },
            {
              finding_key: 'c3:81c5e1fe-962c-414a-9724-a70776e34548:advisor',
              severity: 'P2',
              title: '[E2E] Capability 96018781',
              reason: 'Capability has no mapped service.',
              suggested_action: 'Map capability before release.',
              target_url: '/services/4',
              source_entity_type: 'c3_capability',
              source_entity_id: '81c5e1fe-962c-414a-9724-a70776e34548',
              finding_type: 'advisor',
              score: 42,
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

test('operations page renders the governance cockpit sections', async ({ page }) => {
  await mockAuthenticatedOperations(page);

  await page.goto('/operations');

  await expect(page.getByRole('heading', { name: 'Service Risk Radar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Owner Load Monitor' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Contract Overlap' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Governance Advisor' })).toBeVisible();
  await expect(page.getByText('Identity Access Management')).toBeVisible();
  await expect(page.getByRole('link', { name: /Service Owner.*15 services/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Identity capability.*2 contracts/ })).toBeVisible();
  await expect(page.getByText('Review overlap.')).toBeVisible();

  const capabilityLinks = page.locator('a', { hasText: '[E2E] Capability 96018781' });
  await expect(capabilityLinks).toHaveCount(2);
  await expect(capabilityLinks.nth(0)).toHaveAttribute('href', '/c3/81c5e1fe-962c-414a-9724-a70776e34548');
  await expect(capabilityLinks.nth(1)).toHaveAttribute('href', '/c3/81c5e1fe-962c-414a-9724-a70776e34548');
  await expect(page.getByRole('link', { name: /Service Owner.*15 services/ })).toHaveAttribute('href', '/operations/owner-load?owner=owner%40example.com');
});

test('owner load detail page lists every role assignment for the selected person', async ({ page }) => {
  await mockAuthenticatedOperations(page);

  await page.goto('/operations/owner-load?owner=owner%40example.com');

  await expect(page.getByRole('heading', { name: 'Owner Load Monitor' })).toBeVisible();
  await expect(page.getByText('Service Owner · owner@example.com')).toBeVisible();
  await expect(page.getByRole('link', { name: /Identity Access Management/ })).toHaveAttribute('href', '/services/SVC-IAM/edit#ownership');
  await expect(page.getByRole('link', { name: /Employee Portal/ })).toHaveAttribute('href', '/services/SVC-PORTAL/edit#ownership');
  await expect(page.getByRole('link', { name: /Service owner.*Identity Access Management/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Technical owner.*Employee Portal/ })).toBeVisible();
});
