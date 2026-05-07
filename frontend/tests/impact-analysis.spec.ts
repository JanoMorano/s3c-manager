import { expect, test, type Page } from '@playwright/test';

async function mockImpactAnalysis(page: Page) {
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

    if (url.includes('/api/v1/services?')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { id: 1, service_id: 'SVC-IAM', title: 'Identity Access Management', service_status: 'active', service_type: 'platform' },
            { id: 2, service_id: 'SVC-PORTAL', title: 'Employee Portal', service_status: 'active', service_type: 'business' },
          ],
          total: 2,
          page: 1,
          limit: 100,
        }),
      });
      return;
    }

    if (url.includes('/api/v1/impact/services/SVC-IAM')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          root: { node_id: 'svc:SVC-IAM', node_kind: 'service', node_key: 'SVC-IAM', title: 'Identity Access Management', url: '/services/SVC-IAM' },
          direction: url.includes('direction=upstream') ? 'upstream' : 'downstream',
          max_depth: 3,
          depth_reached: 2,
          total_impacted: 3,
          nodes: [
            { node_id: 'svc:SVC-IAM', node_kind: 'service', node_key: 'SVC-IAM', title: 'Identity Access Management', depth: 0, url: '/services/SVC-IAM' },
            { node_id: 'svc:SVC-PORTAL', node_kind: 'service', node_key: 'SVC-PORTAL', title: 'Employee Portal', depth: 1, url: '/services/SVC-PORTAL' },
            { node_id: 'c3:cap-iam', node_kind: 'c3_capability', node_key: 'C3-IAM', title: 'Identity capability', depth: 1, url: '/c3/cap-iam' },
            { node_id: 'app:app-mail', node_kind: 'c3_application', node_key: 'MAIL', title: 'Mail Gateway', depth: 2 },
          ],
          edges: [
            { edge_id: 'e1', source_node_id: 'svc:SVC-IAM', target_node_id: 'svc:SVC-PORTAL', relation_kind: 'depends_on', impact_level: 'high' },
            { edge_id: 'e2', source_node_id: 'svc:SVC-IAM', target_node_id: 'c3:cap-iam', relation_kind: 'primary', impact_level: null },
            { edge_id: 'e3', source_node_id: 'c3:cap-iam', target_node_id: 'app:app-mail', relation_kind: 'uses_application', impact_level: null },
          ],
          paths: [
            { node_id: 'svc:SVC-PORTAL', depth: 1, path: ['svc:SVC-IAM', 'svc:SVC-PORTAL'], relation_path: ['depends_on'] },
            { node_id: 'app:app-mail', depth: 2, path: ['svc:SVC-IAM', 'c3:cap-iam', 'app:app-mail'], relation_path: ['primary', 'uses_application'] },
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

}

test('legacy impact analysis route redirects to the service list', async ({ page }) => {
  await mockImpactAnalysis(page);
  await page.goto('/services/impact');
  await expect(page).toHaveURL(/\/services\/list/);
});
