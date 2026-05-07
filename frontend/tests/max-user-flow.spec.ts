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
  await expect
    .poll(async () => await field.locator('option').count(), { timeout: 15_000 })
    .toBeGreaterThan(1);

  const options = await field.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: (node as HTMLOptionElement).value,
      text: node.textContent?.trim() ?? '',
    })),
  );
  const candidate = options.find((option) => option.value);
  if (!candidate) {
    throw new Error(`No non-empty option available for field ${String(label)}`);
  }

  await field.selectOption(candidate.value);
  return candidate;
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

test('max user flow: create service, enrich it, create C3 item, map it, and verify catalogue views', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);

  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD to run max-flow tests.');
    return;
  }

  const suffix = `${Date.now()}`.slice(-8);
  const serviceId = `AUTO${suffix}`;
  const serviceTitle = `[E2E] Max Service ${suffix}`;
  const offeringCode = `ENT-${suffix}`;
  const offeringTitle = `Enterprise ${suffix}`;

  await loginWithConfiguredAdmin(page, credentials);

  await page.goto('/services/list');
  await expect(page.getByRole('heading', { name: /services/i })).toBeVisible({ timeout: 15_000 });
  await page.locator('a[href="/management/new-service"]').first().click();
  await expect(page).toHaveURL(/\/management\/new-service/, { timeout: 15_000 });

  await fillField(page, /service id/i, serviceId);
  await fillField(page, /název služby|^title \*$/i, serviceTitle);
  await selectFirstNonEmpty(page, /typ služby|service type/i);
  await advanceWizardToCreate(page);
  await expect(page).toHaveURL(new RegExp(`/services/${serviceId}/edit`), { timeout: 20_000 });
  await expect(page.getByText(serviceTitle, { exact: true })).toBeVisible({ timeout: 10_000 });

  await fillField(page, /ordering note/i, 'Updated after create to verify the edit PUT flow.');
  await fillField(page, /operational notes/i, 'Escalation path exercised by browser-driven smoke test.');
  await page.getByRole('button', { name: /save changes/i }).click();
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
  await offeringsSection.getByRole('button', { name: /add offering/i }).click();
  await expect(offeringsSection.getByText(offeringTitle, { exact: false })).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/services/${serviceId}/edit`), { timeout: 15_000 });

  const relationshipsSection = page.locator('#relationships');
  await relationshipsSection.getByRole('button', { name: /\+ add relationship/i }).click();
  const relationshipTarget = await selectFirstNonEmpty(relationshipsSection, /target service id/i);
  await fillField(relationshipsSection, /label \(optional\)/i, 'Regression dependency');
  await relationshipsSection.getByRole('button', { name: /add relation/i }).click();
  await expect(relationshipsSection.getByText('Regression dependency', { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(relationshipsSection.getByRole('link', { name: new RegExp(relationshipTarget.value) })).toBeVisible({ timeout: 15_000 });

  await page.goto(`/services/${serviceId}/edit`);
  await expect(page).toHaveURL(new RegExp(`/services/${serviceId}/edit`), { timeout: 15_000 });

  const c3MappingSection = page.locator('#c3mapping');
  await c3MappingSection.getByRole('button', { name: /assign c3 taxonomy|c3-taxonomie zuweisen|přiřadit c3 taxonomii|priradiť c3 taxonómiu/i }).click();
  await selectFirstNonEmpty(c3MappingSection, /c3 uuid|c3 capability|c3-fähigkeit|c3 schopnost|c3-taxonomie/i);
  const mappingTypeField = fieldByLabel(c3MappingSection, /mapping type|mapping-typ|typ mapování|typ mapovania/i);
  await mappingTypeField.selectOption('fully_fulfills').catch(async () => {
    await selectFirstNonEmpty(c3MappingSection, /mapping type|mapping-typ|typ mapování|typ mapovania/i);
  });
  await fillField(c3MappingSection, /mapping note|mapping-notiz|poznámka k mapování|poznámka k mapovaniu/i, 'Capability attached by max-flow validation.');
  await c3MappingSection.getByRole('button', { name: /add mapping|mapping hinzufügen|přidat mapování|pridať mapovanie/i }).click();
  await expect(c3MappingSection.getByText('Capability attached by max-flow validation.', { exact: false })).toBeVisible({ timeout: 15_000 });

  await page.goto(`/services/${serviceId}`);
  await expect(page.getByRole('heading', { name: serviceTitle })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Business view')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /governance/i }).click();
  await expect(page.getByRole('heading', { name: /relationships/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /available offerings/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /c3 taxonomy mapping/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(offeringTitle, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Capability attached by max-flow validation.', { exact: false }).first()).toBeVisible({ timeout: 15_000 });

  await page.goto('/services/list');
  const serviceSearch = page.getByRole('searchbox', { name: /search services/i });
  await serviceSearch.fill(serviceId);
  await expect(page).toHaveURL(new RegExp(`/services/list\\?[^#]*search=${serviceId}`), { timeout: 15_000 });
  await expect(page.getByText(serviceTitle, { exact: false })).toBeVisible({ timeout: 15_000 });

});
