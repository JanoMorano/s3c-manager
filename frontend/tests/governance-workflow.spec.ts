import { expect, test, type Page } from '@playwright/test';

async function mockGovernanceWorkflow(page: Page) {
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

  let reviewStarted = false;
  let decisionCreated = false;
  let reviewRequested = false;

  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

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

    if (url.includes('/api/v1/governance/reviews/7') && method === 'PATCH') {
      reviewStarted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          item: {
            id: 7,
            service_id: 'SVC-IAM',
            service_title: 'Identity Access Management',
            review_type: 'publish',
            status: 'in_review',
            requested_by: 'admin@example.com',
            assigned_to: 'reviewer@example.com',
            due_at: '2026-04-01T00:00:00Z',
            overdue: true,
          },
        }),
      });
      return;
    }

    if (url.includes('/api/v1/governance/reviews') && method === 'POST') {
      reviewRequested = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          item: {
            id: 8,
            service_id: 'SVC-PORTAL',
            service_title: 'Employee Portal',
            review_type: 'publish',
            status: 'pending',
          },
        }),
      });
      return;
    }

    if (url.includes('/api/v1/governance/reviews')) {
      await route.fulfill({
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
      return;
    }

    if (url.includes('/api/v1/governance/decisions') && method === 'POST') {
      decisionCreated = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          item: {
            id: 44,
            service_id: 'SVC-IAM',
            service_title: 'Identity Access Management',
            decision_type: 'exception',
            decision: 'deferred',
            rationale: 'Owner remediation tracked in readiness queue.',
            decided_by: 'admin@example.com',
          },
        }),
      });
      return;
    }

    if (url.includes('/api/v1/governance/decisions')) {
      await route.fulfill({
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
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'not mocked' }),
    });
  });

  return {
    wasReviewStarted: () => reviewStarted,
    wasDecisionCreated: () => decisionCreated,
    wasReviewRequested: () => reviewRequested,
  };
}

test('governance reviews and decision log support workflow actions', async ({ page }) => {
  const tracker = await mockGovernanceWorkflow(page);

  await page.goto('/operations/reviews');
  await expect(page.getByRole('heading', { name: 'Governance Reviews' })).toBeVisible();
  await expect(page.getByText('Identity Access Management')).toBeVisible();
  await expect(page.locator('article', { hasText: 'Identity Access Management' }).getByText('Overdue')).toBeVisible();
  await page.getByRole('button', { name: /^start$/i }).click();
  await expect(page.getByRole('heading', { name: 'Review action' })).toBeVisible();
  await page.getByRole('button', { name: /confirm action/i }).click();
  await expect.poll(() => tracker.wasReviewStarted()).toBe(true);

  await page.getByRole('button', { name: /request review/i }).click();
  await page.getByLabel('Service ID').fill('SVC-PORTAL');
  await page.getByRole('button', { name: /create review/i }).click();
  await expect.poll(() => tracker.wasReviewRequested()).toBe(true);

  await page.goto('/operations/decisions');
  await expect(page.getByRole('heading', { name: 'Decision Log' })).toBeVisible();
  await expect(page.getByText('Owner remediation tracked in readiness queue.')).toBeVisible();
  await page.getByRole('button', { name: /^record decision$/i }).first().click();
  await page.getByLabel('Service ID').fill('SVC-IAM');
  await page.getByRole('combobox', { name: /^Decision$/ }).selectOption('deferred');
  await page.getByLabel('Rationale').fill('Owner remediation tracked in readiness queue.');
  await page.getByRole('button', { name: /^record decision$/i }).last().click();
  await expect.poll(() => tracker.wasDecisionCreated()).toBe(true);
});
