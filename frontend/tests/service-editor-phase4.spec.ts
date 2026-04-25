import { test, expect, type Locator, type Page } from '@playwright/test';
import { getConfiguredAdminCredentials, loginWithConfiguredAdmin } from './admin-credentials';

function fieldByLabel(root: Page | Locator, label: string | RegExp): Locator {
  return root
    .locator('label', { hasText: label })
    .locator('xpath=..')
    .locator('input, textarea, select')
    .first();
}

async function fillField(root: Page | Locator, label: string | RegExp, value: string): Promise<void> {
  const field = fieldByLabel(root, label);
  await expect(field).toBeVisible({ timeout: 15_000 });
  await field.fill(value);
}

async function selectFirstNonEmpty(root: Page | Locator, label: string | RegExp): Promise<{ value: string; text: string }> {
  const field = fieldByLabel(root, label);
  await expect(field).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => await field.locator('option').count(), { timeout: 15_000 }).toBeGreaterThan(1);

  const options = await field.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: (node as HTMLOptionElement).value,
      text: node.textContent?.trim() ?? '',
    })),
  );
  const candidate = options.find((option) => option.value);
  if (!candidate) throw new Error(`No option available for ${String(label)}`);
  await field.selectOption(candidate.value);
  return candidate;
}

function waitForApiOk(page: Page, pathFragment: string, method: string) {
  return page.waitForResponse((response) => {
    return response.url().includes(pathFragment) &&
      response.request().method() === method &&
      response.ok();
  });
}

function waitForApiResponse(page: Page, pathFragment: string, method: string) {
  return page.waitForResponse((response) => {
    return response.url().includes(pathFragment) &&
      response.request().method() === method;
  });
}

async function advanceWizardToCreate(page: Page): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    const createButton = page.getByRole('button', { name: /vytvořit službu|create service/i });
    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click();
      return;
    }

    const nextButton = page.getByRole('button', { name: /další|next/i });
    await expect(nextButton).toBeVisible({ timeout: 15_000 });
    await nextButton.click();
  }

  throw new Error('Service wizard did not reach the review step in time.');
}

test('phase 4 editor manages request model, offerings, support, audience and links', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);

  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD to run phase 4 editor tests.');
    return;
  }

  const suffix = `${Date.now()}`.slice(-8);
  const serviceId = `AUTO-P4-${suffix}`;
  const serviceTitle = `[E2E] Phase4 Service ${suffix}`;
  const offeringCode = `STD-${suffix}`;
  const offeringTitle = `Standard ${suffix}`;

  await loginWithConfiguredAdmin(page, credentials);
  await page.goto('/management/new-service');
  await expect(page).toHaveURL(/\/management\/new-service/, { timeout: 15_000 });

  await fillField(page, /service id/i, serviceId);
  await fillField(page, /název služby|^title \*$/i, serviceTitle);
  await selectFirstNonEmpty(page, /typ služby|service type/i);
  await advanceWizardToCreate(page);
  await expect(page).toHaveURL(new RegExp(`/services/${serviceId}/edit`), { timeout: 20_000 });

  await fillField(page, /business summary/i, `Business-first summary ${suffix}`);
  await fillField(page, /request channel type/i, 'portal');
  await fillField(page, /request channel url/i, `https://example.test/request/${serviceId.toLowerCase()}`);
  await fillField(page, /target audience summary/i, 'Internal engineering teams');
  await fillField(page, /fulfillment lead time/i, '2 business days');
  await page.locator('#catalogue-access').locator('label', { hasText: /requestable/i }).locator('input[type="checkbox"]').check();
  await page.locator('#catalogue-access').locator('label', { hasText: /approval required/i }).locator('input[type="checkbox"]').check();
  await Promise.all([
    waitForApiOk(page, `/api/v1/services/${serviceId}`, 'PUT'),
    page.getByRole('button', { name: /save changes/i }).click(),
  ]);
  await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 15_000 });

  const offeringsSection = page.locator('#offerings');
  await offeringsSection.getByRole('button', { name: /\+ add service offering/i }).click();
  await fillField(offeringsSection, /offering code/i, offeringCode);
  await fillField(offeringsSection, /^title$/i, offeringTitle);
  await fillField(offeringsSection, /request channel type/i, 'portal');
  await fillField(offeringsSection, /request channel url/i, `https://example.test/offering/${serviceId.toLowerCase()}`);
  await fillField(offeringsSection, /lead time/i, '1 business day');
  await offeringsSection.locator('label', { hasText: /default offering/i }).locator('input[type="checkbox"]').check();
  await offeringsSection.locator('label', { hasText: /^requestable$/i }).locator('input[type="checkbox"]').check();
  await Promise.all([
    waitForApiOk(page, `/api/v1/services/${serviceId}/offerings`, 'POST'),
    offeringsSection.getByRole('button', { name: /add offering/i }).click(),
  ]);
  await expect(offeringsSection.getByText(offeringTitle, { exact: false })).toBeVisible({ timeout: 15_000 });

  const supportSection = page.locator('#support-model');
  await supportSection.getByRole('button', { name: /\+ add support row/i }).click();
  await fillField(supportSection, /support owner/i, 'Playwright Support');
  await fillField(supportSection, /resolver group/i, 'QA-L2');
  await fillField(supportSection, /support hours/i, '24x7');
  await fillField(supportSection, /support channel/i, 'Service Desk');
  const [supportResponse] = await Promise.all([
    waitForApiResponse(page, `/api/v1/services/${serviceId}/support-model`, 'PUT'),
    supportSection.getByRole('button', { name: /save support model/i }).click(),
  ]);
  expect(supportResponse.status(), await supportResponse.text()).toBeLessThan(400);
  await expect(supportSection.getByRole('button', { name: /save support model/i })).toBeVisible({ timeout: 15_000 });

  const audienceSection = page.locator('#audience');
  await audienceSection.getByRole('button', { name: /\+ add audience row/i }).click();
  await fillField(audienceSection, /audience type/i, 'Internal');
  await fillField(audienceSection, /business unit/i, 'Engineering');
  await fillField(audienceSection, /region/i, 'EU');
  await fillField(audienceSection, /eligibility rule/i, 'Available to approved product and platform teams.');
  const [audienceResponse] = await Promise.all([
    waitForApiResponse(page, `/api/v1/services/${serviceId}/audience`, 'PUT'),
    audienceSection.getByRole('button', { name: /save audience policies/i }).click(),
  ]);
  expect(audienceResponse.status(), await audienceResponse.text()).toBeLessThan(400);
  await expect(audienceSection.getByRole('button', { name: /save audience policies/i })).toBeVisible({ timeout: 15_000 });

  const linksSection = page.locator('#operational-links');
  await linksSection.getByRole('button', { name: /\+ add operational link/i }).click();
  await fillField(linksSection, /link type/i, 'knowledge');
  await fillField(linksSection, /^title$/i, `Knowledge Base ${suffix}`);
  await fillField(linksSection, /^url$/i, `https://example.test/kb/${serviceId.toLowerCase()}`);
  const [linkResponse] = await Promise.all([
    waitForApiResponse(page, `/api/v1/services/${serviceId}/operational-links`, 'POST'),
    linksSection.getByRole('button', { name: /add link/i }).click(),
  ]);
  expect(linkResponse.status(), await linkResponse.text()).toBeLessThan(400);
  await expect(linksSection.getByText(`Knowledge Base ${suffix}`, { exact: false })).toBeVisible({ timeout: 15_000 });

  await page.goto(`/services/${serviceId}`);
  await expect(page.getByText('Business view')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: `Business-first summary ${suffix}` })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /offerings/i }).click();
  await expect(page.getByRole('heading', { name: offeringTitle })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /request & support/i }).click();
  await expect(page.locator('#support').getByText('Playwright Support', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Internal engineering teams', { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /overview/i }).click();
  await expect(page.getByRole('link', { name: `Knowledge Base ${suffix}` })).toBeVisible({ timeout: 15_000 });
});
