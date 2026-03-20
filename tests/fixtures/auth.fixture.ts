import { test as base, expect, type Page } from '@playwright/test';

/** Test user credentials — must exist in the DB or be seeded before running auth tests */
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL ?? 'test@tendercopilot.gr',
  password: process.env.TEST_USER_PASSWORD ?? 'Test1234!',
  name: 'Test User',
  companyName: 'Test Company ΕΠΕ',
};

/** Login helper — fills the /login form and waits for redirect */
export async function loginViaUI(page: Page, email?: string, password?: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email ?? TEST_USER.email);
  await page.getByLabel('Κωδικός πρόσβασης').fill(password ?? TEST_USER.password);
  await page.getByRole('button', { name: 'Σύνδεση' }).click();
}

/**
 * Extended test fixture that provides an already-authenticated page.
 * Usage: import { test } from '../fixtures/auth.fixture';
 */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await loginViaUI(page);
    // Wait for redirect to dashboard/tenders
    await page.waitForURL(/\/(tenders|dashboard)/, { timeout: 15_000 });
    await use(page);
  },
});

export { expect };
