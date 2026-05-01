import { expect, test, type Page } from '@playwright/test';

async function mockGovernanceRelease(page: Page) {
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
            total_services: 8,
            services_ready_for_publish: 4,
            services_blocked_by_readiness: 2,
            overdue_reviews: 1,
            uncovered_capabilities: 1,
            over_covered_capabilities: 2,
            active_governance_reviews: 3,
            recent_decisions: 4,
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
          summary: { total_services: 8, active_services: 4, requestable_services: 5 },
          sections: {
            incomplete_metadata: [],
            missing_owners: [{ service_id: 'DEMO-DOC-006', title: 'Document Collaboration Workspace', completeness_score: 42, service_status: 'draft' }],
            top_completeness: [{ service_id: 'DEMO-OBS-007', title: 'Observability Command Center', completeness_score: 96, service_status: 'active' }],
            deprecated_retired: [],
            pricing_patrol: { total_services: 8, with_pricing: 7, coverage_percent: 88, missing: [] },
            c3_mapping_gap: [{ item_type: 'CP', total_count: 4, mapped_count: 3, gap_count: 1 }],
          },
        }),
      });
      return;
    }

    if (url.includes('/api/v1/portfolio')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 3,
          items: [
            { portfolio_code: 'SHARED', title: 'Shared Services', description: 'Common services.', status_code: 'active', service_count: 4, active_service_count: 2, requestable_service_count: 3, overdue_review_count: 1, owner_group_name: 'CIS Department' },
            { portfolio_code: 'SECURITY', title: 'Security Services', description: 'Identity and access.', status_code: 'active', service_count: 1, active_service_count: 1, requestable_service_count: 1, overdue_review_count: 0, owner_group_name: 'CSO Department' },
            { portfolio_code: 'DATA', title: 'Data Services', description: 'Analytics and reporting.', status_code: 'active', service_count: 3, active_service_count: 1, requestable_service_count: 1, overdue_review_count: 0, owner_group_name: 'CDO Department' },
          ],
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
                service_pk: 6,
                service_id: 'DEMO-DOC-006',
                title: 'Document Collaboration Workspace',
                service_status: 'draft',
                is_publishable: false,
                blockers: ['Service has owner'],
                warnings: [],
                rules: [{ rule_key: 'service_has_owner', title: 'Service has owner', status: 'failed', severity: 'P0', blocking: true, message: 'Owner missing', exception: null }],
              },
            ],
            warnings: [],
            ready: [
              {
                service_pk: 7,
                service_id: 'DEMO-OBS-007',
                title: 'Observability Command Center',
                service_status: 'active',
                is_publishable: true,
                blockers: [],
                warnings: [],
                rules: [{ rule_key: 'service_has_owner', title: 'Service has owner', status: 'passed', severity: 'P0', blocking: true, message: 'Owner assigned', exception: null }],
              },
            ],
          },
          items: [],
        }),
      });
      return;
    }

    if (url.includes('/api/v1/governance/reviews')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          items: [
            { id: 10, service_id: 'DEMO-RPA-004', service_title: 'Process Automation Service', review_type: 'automation_governance', status: 'in_review', requested_by: 'demo-seed', assigned_to: 'nina.automation@example.org', due_at: '2026-05-14T00:00:00Z', overdue: false },
          ],
        }),
      });
      return;
    }

    if (url.includes('/api/v1/governance/decisions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          items: [
            { id: 44, service_id: 'DEMO-RPA-004', service_title: 'Process Automation Service', decision_type: 'publish', decision: 'deferred', rationale: 'Primary capability evidence is incomplete.', decided_by: 'governance-board@example.org', decided_at: '2026-04-22T10:00:00Z' },
          ],
        }),
      });
      return;
    }

    if (url.includes('/api/v1/capabilities/coverage')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          counts: { total: 3, uncovered: 1, over_covered: 1, not_ready: 1, ready: 1 },
          items: [
            { capability_uuid: 'demo-cp-0001-0000-000000000003', capability_code: 'DEMO-CP-001', capability_title: 'Platform Integration Capability', domain: 'Capabilities', spiral_code: 'Spiral_7', coverage_percent: 100, gap_count: 0, service_count: 2, primary_service_count: 1, ready_service_count: 1, blocked_service_count: 1, readiness_state: 'not_ready', services: [{ service_id: 'DEMO-PIS-001', title: 'Platform Integration Service', normalized_role: 'primary', readiness_state: 'ready' }, { service_id: 'DEMO-OBS-007', title: 'Observability Command Center', normalized_role: 'supporting', readiness_state: 'ready' }] },
            { capability_uuid: 'demo-cp-0004-0000-000000000020', capability_code: 'DEMO-CP-999', capability_title: 'Uncovered Mission Workflow', domain: 'Capabilities', spiral_code: 'Spiral_7', coverage_percent: 0, gap_count: 1, service_count: 0, readiness_state: 'uncovered', services: [] },
          ],
        }),
      });
      return;
    }

    if (url.includes('/api/v1/services?') || url.endsWith('/api/v1/services')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          items: [
            { service_id: 'DEMO-OBS-007', title: 'Observability Command Center', service_status_code: 'active' },
          ],
        }),
      });
      return;
    }

    if (url.includes('/api/v1/impact/services/DEMO-OBS-007')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          root: { node_id: 'service:DEMO-OBS-007', node_kind: 'service', node_key: 'DEMO-OBS-007', title: 'Observability Command Center', depth: 0, url: '/services/DEMO-OBS-007' },
          direction: 'downstream',
          depth_reached: 3,
          nodes: [
            { node_id: 'service:DEMO-OBS-007', node_kind: 'service', node_key: 'DEMO-OBS-007', title: 'Observability Command Center', depth: 0, url: '/services/DEMO-OBS-007' },
            { node_id: 'service:DEMO-RPA-004', node_kind: 'service', node_key: 'DEMO-RPA-004', title: 'Process Automation Service', depth: 1, url: '/services/DEMO-RPA-004' },
            { node_id: 'c3:demo-cp-0003-0000-000000000019', node_kind: 'c3_capability', node_key: 'DEMO-CP-004', title: 'Process Automation', depth: 1, url: '/c3/demo-cp-0003-0000-000000000019' },
          ],
          edges: [{ from: 'service:DEMO-OBS-007', to: 'service:DEMO-RPA-004', relation_kind: 'depends_on', depth: 1 }],
          paths: [{ node_id: 'service:DEMO-RPA-004', path: ['DEMO-OBS-007', 'DEMO-RPA-004'], relation_path: ['depends_on'] }],
        }),
      });
      return;
    }

    if (
      url.includes('/api/v1/governance/risk-radar')
      || url.includes('/api/v1/governance/owner-load')
      || url.includes('/api/v1/governance/contract-overlap')
      || url.includes('/api/v1/governance/renewal-calendar')
      || url.includes('/api/v1/governance/advisor')
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
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

test('release governance cockpit smoke renders the core pages', async ({ page }) => {
  await mockGovernanceRelease(page);

  await page.goto('/operations');
  await expect(page.getByRole('heading', { name: /decision cockpit/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /readiness queue/i })).toHaveAttribute('href', '/operations/readiness');

  await page.goto('/portfolio');
  await expect(page.getByRole('heading', { name: /portfolio cockpit/i })).toBeVisible();
  await expect(page.getByText('Shared Services')).toBeVisible();

  await page.goto('/operations/readiness');
  await expect(page.getByRole('heading', { name: /readiness queue/i })).toBeVisible();
  await expect(page.getByText('Document Collaboration Workspace')).toBeVisible();

  await page.goto('/operations/reviews');
  await expect(page.getByRole('heading', { name: /governance reviews/i })).toBeVisible();
  await expect(page.getByText('Process Automation Service')).toBeVisible();

  await page.goto('/operations/decisions');
  await expect(page.getByRole('heading', { name: /decision log/i })).toBeVisible();
  await expect(page.getByText('Primary capability evidence is incomplete.')).toBeVisible();

  await page.goto('/capabilities/coverage');
  await expect(page.getByRole('heading', { name: /capability coverage/i })).toBeVisible();
  await expect(page.getByText('Platform Integration Capability')).toBeVisible();
  await expect(page.getByText('Uncovered Mission Workflow')).toBeVisible();

  await page.goto('/services/impact');
  await expect(page.getByRole('heading', { name: /impact analysis/i })).toBeVisible();
  await expect(page.getByText('Process Automation Service')).toBeVisible();
});
