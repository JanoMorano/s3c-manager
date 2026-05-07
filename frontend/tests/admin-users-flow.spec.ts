import { test, expect } from '@playwright/test';
import { getConfiguredAdminCredentials, loginWithConfiguredAdmin } from './admin-credentials';

test('admin user flow: create or update local user and verify authentication', async ({ page, request }) => {
  test.setTimeout(5 * 60 * 1000);

  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD to run admin-user-flow tests.');
    return;
  }

  const suffix = `${Date.now()}`.slice(-6);
  const username = 'e2eadminflow';
  const password = 'FlowUser1234+';
  const displayName = `E2E Admin Flow ${suffix}`;
  const updatedDisplayName = `${displayName} Updated`;
  const email = `e2eadminflow+${suffix}@example.test`;
  const updatedEmail = `e2eadminflow+${suffix}-updated@example.test`;
  const department = `QA Automation ${suffix}`;
  const updatedDepartment = `QA Validation ${suffix}`;

  await loginWithConfiguredAdmin(page, credentials);

  await page.goto('/administration/users');
  await expect(page.getByRole('heading', { name: /user management|správa uživatelů/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('combobox', { name: /working view|pracovní pohled|persona/i })).toHaveCount(0);
  await expect(page.getByText(/capability manager|správce schopností/i)).toHaveCount(0);

  const search = page.getByRole('searchbox', { name: /filter by username|filtrovat podle/i });
  await search.fill(username);

  const existingCell = page.getByRole('cell', { name: username }).first();
  const userExists = (await existingCell.count()) > 0;

  if (userExists) {
    const row = existingCell.locator('xpath=ancestor::tr').first();
    await row.getByRole('button', { name: /edit/i }).click();
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('textbox', { name: /display name/i }).fill(displayName);
    await page.getByRole('textbox', { name: /^email$/i }).fill(email);
    await page.getByRole('textbox', { name: /department/i }).fill(department);
    await page.getByRole('textbox', { name: /given name/i }).fill('E2E');
    await page.getByRole('textbox', { name: /surname/i }).fill(`Flow ${suffix}`);
    await page.getByLabel(/new password|password/i).fill(password);

    const statusCheckbox = page.locator('label').filter({ hasText: /active/i }).locator('input[type="checkbox"]').first();
    await statusCheckbox.check();

    const roleSelect = page.getByRole('combobox', { name: /^role$/i });
    await roleSelect.selectOption('viewer');

    const loginTypeSelect = page.getByRole('combobox', { name: /login type/i });
    await loginTypeSelect.selectOption('local');

    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText(/^User updated\.$|^Uživatel byl upraven\.$/)).toBeVisible({ timeout: 15_000 });
  } else {
    await page.getByRole('button', { name: /new user/i }).click();
    await expect(page.getByRole('button', { name: /create user/i })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('textbox', { name: /username/i }).fill(username);
    await page.getByRole('textbox', { name: /display name/i }).fill(displayName);
    await page.getByRole('textbox', { name: /^email$/i }).fill(email);
    await page.getByRole('textbox', { name: /department/i }).fill(department);
    await page.getByRole('textbox', { name: /given name/i }).fill('E2E');
    await page.getByRole('textbox', { name: /surname/i }).fill(`Flow ${suffix}`);
    await page.getByLabel(/^password$/i).fill(password);

    const roleSelect = page.getByRole('combobox', { name: /^role$/i });
    await roleSelect.selectOption('viewer');

    const loginTypeSelect = page.getByRole('combobox', { name: /login type/i });
    await loginTypeSelect.selectOption('local');

    await page.getByRole('button', { name: /create user/i }).click();
    await expect(page.getByText(/^User created\.$|^Uživatel byl vytvořen\.$/)).toBeVisible({ timeout: 15_000 });
  }

  await search.fill(username);
  const createdRow = page.getByRole('cell', { name: username }).locator('xpath=ancestor::tr').first();
  await expect(createdRow).toBeVisible({ timeout: 15_000 });
  await expect(createdRow.getByText(/^User - RO$|^Uživatel - RO$/)).toBeVisible({ timeout: 15_000 });
  await expect(createdRow.getByText(email, { exact: false })).toBeVisible({ timeout: 15_000 });

  await createdRow.getByRole('button', { name: /edit/i }).click();
  await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('textbox', { name: /display name/i }).fill(updatedDisplayName);
  await page.getByRole('textbox', { name: /^email$/i }).fill(updatedEmail);
  await page.getByRole('textbox', { name: /department/i }).fill(updatedDepartment);
  await page.getByLabel(/new password|password/i).fill(password);

  const roleSelect = page.getByRole('combobox', { name: /^role$/i });
  await roleSelect.selectOption('editor');

  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByText(/^User updated\.$|^Uživatel byl upraven\.$/)).toBeVisible({ timeout: 15_000 });

  await search.fill(username);
  const updatedRow = page.getByRole('cell', { name: username }).locator('xpath=ancestor::tr').first();
  await expect(updatedRow).toBeVisible({ timeout: 15_000 });
  await expect(updatedRow.getByText(/^Content Admin - RW$/)).toBeVisible({ timeout: 15_000 });
  await expect(updatedRow.getByText(updatedEmail, { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(updatedRow.getByText(updatedDepartment, { exact: false })).toBeVisible({ timeout: 15_000 });

  const loginResponse = await request.post('http://localhost:8080/api/v1/auth/login', {
    data: { username, password },
  });
  expect(loginResponse.status()).toBe(200);
  const loginPayload = await loginResponse.json();
  expect(loginPayload.access_token).toBeTruthy();
  expect(loginPayload.user?.username ?? loginPayload.username).toBe(username);
});
