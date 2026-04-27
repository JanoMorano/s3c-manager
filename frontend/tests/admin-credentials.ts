import { expect, type Page } from '@playwright/test';

export interface AdminCredentials {
  username: string;
  password: string;
}

export function getConfiguredAdminCredentials(): AdminCredentials | null {
  const username = process.env.PLAYWRIGHT_ADMIN_USERNAME?.trim() || '';
  const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD?.trim() || '';

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

export async function loginWithConfiguredAdmin(page: Page, credentials: AdminCredentials): Promise<void> {
  await page.goto('/login');

  const submitBtn = page.getByRole('button', { name: /přihlásit se|sign in/i });
  await expect(submitBtn).toBeEnabled({ timeout: 10_000 });

  await page.getByLabel(/uživatelské jméno|username/i).fill(credentials.username);
  await page.getByLabel(/heslo|password/i).fill(credentials.password);
  await submitBtn.click();

  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
  await page.context().addCookies([
    {
      name: 'sc_locale',
      value: 'en',
      url: page.url().startsWith('http') ? new URL(page.url()).origin : 'http://localhost:8080',
    },
  ]);
  await page.request.put('/api/v1/auth/preferences', {
    data: { preferred_lang: 'en' },
  }).catch(() => undefined);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
}
