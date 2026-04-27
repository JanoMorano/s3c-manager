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

async function selectOptionByLabel(root: Page | Locator, label: string | RegExp, optionLabel: string | RegExp): Promise<void> {
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

  const matcher =
    optionLabel instanceof RegExp
      ? (text: string) => optionLabel.test(text)
      : (text: string) => text.includes(optionLabel);

  const candidate = options.find((option) => option.value && matcher(option.text));
  if (!candidate) {
    throw new Error(`No option matching ${String(optionLabel)} available for field ${String(label)}`);
  }

  await field.selectOption(candidate.value);
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
  const flavourTitle = `Enterprise ${suffix}`;
  const c3Title = `[E2E] Capability ${suffix}`;
  const c3ExternalId = `AUTO-C3-${suffix}`;

  await loginWithConfiguredAdmin(page, credentials);

  await page.goto('/management');
  await expect(page.getByRole('heading', { name: /content admin/i })).toBeVisible({ timeout: 15_000 });

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

  const flavourSection = page.locator('#flavours');
  await flavourSection.getByRole('button', { name: /\+ add pricing variant/i }).click();
  await flavourSection.getByPlaceholder('Title *').fill(flavourTitle);
  await flavourSection.getByPlaceholder('Unit').fill('month');
  await flavourSection.getByPlaceholder('Price').fill('250');
  await flavourSection.getByPlaceholder('Currency (e.g. EUR)').fill('EUR');
  await flavourSection.getByPlaceholder('Billing period').fill('MONTHLY');
  await flavourSection.getByPlaceholder('Display order').fill('1');
  await flavourSection.getByPlaceholder('Short note').fill('Primary pricing variant for regression coverage.');
  await flavourSection.getByPlaceholder('Pricing note (raw)').fill('Standard recurring fee.');
  await flavourSection.getByPlaceholder('Dependency text').fill('Requires service owner approval.');
  await flavourSection.locator('label', { hasText: /orderable/i }).locator('input[type="checkbox"]').check();
  await flavourSection.getByRole('button', { name: /^add$/i }).click();
  await expect(flavourSection.getByText(flavourTitle, { exact: false })).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/services/${serviceId}/edit`), { timeout: 15_000 });

  const availabilitySection = page.locator('#availability');
  await availabilitySection.getByRole('button', { name: /\+ add flavour sla override/i }).click();
  await selectOptionByLabel(availabilitySection, /flavour/i, flavourTitle);
  await fillField(availabilitySection, /support window/i, '24x7');
  await fillField(availabilitySection, /availability \(%\)/i, '99.95');
  await fillField(availabilitySection, /restoration \(h\)/i, '2');
  await fillField(availabilitySection, /delivery \(d\)/i, '1');
  await fillField(availabilitySection, /sla note/i, 'Priority support with fast restoration.');
  await fillField(availabilitySection, /priority model/i, 'P1/P2/P3');
  await availabilitySection.getByRole('button', { name: /add sla/i }).click();
  await expect(availabilitySection.getByText(flavourTitle, { exact: false })).toBeVisible({ timeout: 15_000 });

  const relationshipsSection = page.locator('#relationships');
  await relationshipsSection.getByRole('button', { name: /\+ add relationship/i }).click();
  const relationshipTarget = await selectFirstNonEmpty(relationshipsSection, /target service id/i);
  await fillField(relationshipsSection, /label \(optional\)/i, 'Regression dependency');
  await relationshipsSection.getByRole('button', { name: /add relation/i }).click();
  await expect(relationshipsSection.getByText('Regression dependency', { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(relationshipsSection.getByRole('link', { name: new RegExp(relationshipTarget.value) })).toBeVisible({ timeout: 15_000 });

  await page.goto('/management/new-c3');
  await expect(page).toHaveURL(/\/management\/new-c3/, { timeout: 15_000 });
  await fillField(page, /^title \*$/i, c3Title);
  await fillField(page, /external id/i, c3ExternalId);
  await selectFirstNonEmpty(page, /item type/i);
  const c3StatusField = fieldByLabel(page, /item status/i);
  await c3StatusField.selectOption('approved').catch(async () => {
    await selectFirstNonEmpty(page, /item status/i);
  });
  await fillField(page, /description/i, 'Capability created during maximal catalogue validation.');
  await fillField(page, /source description/i, 'Playwright-created source description.');
  await page.getByRole('button', { name: /create c3 capability/i }).click();
  await expect(page).toHaveURL(/\/c3\/[^/]+$/, { timeout: 20_000 });
  const c3Uuid = page.url().split('/c3/')[1]?.split('?')[0] ?? '';
  expect(c3Uuid).not.toBe('');
  await expect(page.getByRole('heading', { name: c3Title })).toBeVisible({ timeout: 15_000 });

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
  await expect(page.getByRole('heading', { name: /pricing variants/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /c3 taxonomy mapping/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(flavourTitle, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Capability attached by max-flow validation.', { exact: false }).first()).toBeVisible({ timeout: 15_000 });

  await page.goto('/services/list');
  const serviceSearch = page.getByRole('searchbox', { name: /search services/i });
  await serviceSearch.fill(serviceId);
  await expect(page).toHaveURL(new RegExp(`/services/list\\?[^#]*search=${serviceId}`), { timeout: 15_000 });
  await expect(page.getByText(serviceTitle, { exact: false })).toBeVisible({ timeout: 15_000 });

  await page.goto('/c3/list');
  const c3Search = page.getByRole('searchbox', { name: /search c3 taxonomy|c3-taxonomie durchsuchen|hledat v c3 taxonomii|prehľadávať c3 taxonómiu/i });
  await c3Search.fill(c3ExternalId);
  await expect(page.getByText(c3Title, { exact: false })).toBeVisible({ timeout: 15_000 });
});
