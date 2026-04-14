import { test, expect, Page } from '@playwright/test';

// Auth pages have decorative orb overlays that intercept pointer events.
// Use click({ force: true }) to bypass hit-testing while preserving default actions.

// Signup form requires agreeing to Terms of Service — helper fills all required fields.
async function fillSignupForm(page: Page, overrides: Partial<{ name: string; email: string; password: string; company: string }> = {}) {
  await page.getByLabel('Ονοματεπώνυμο').fill(overrides.name ?? 'Test User');
  await page.getByLabel('Email').fill(overrides.email ?? 'test@example.com');
  await page.getByLabel('Κωδικός', { exact: true }).fill(overrides.password ?? 'ValidPass123');
  await page.getByLabel('Επωνυμία Εταιρείας').fill(overrides.company ?? 'Test Co');
  // Accept terms (required to enable submit button)
  await page.getByRole('checkbox').check({ force: true });
}

test.describe('Signup — Εγγραφή', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  // ── Form Validation ──

  test('shows errors for empty form submission', async ({ page }) => {
    // Must accept terms to enable the submit button — then submit empty form to surface validation errors
    await page.getByRole('checkbox').check({ force: true });
    await page.getByRole('button', { name: 'Εγγραφή' }).click({ force: true });

    await expect(page.getByText('Το όνομα είναι υποχρεωτικό')).toBeVisible();
    await expect(page.getByText('Μη έγκυρη διεύθυνση email')).toBeVisible();
    await expect(page.getByText('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες')).toBeVisible();
    await expect(page.getByText('Η επωνυμία εταιρείας είναι υποχρεωτική')).toBeVisible();
  });

  test('shows error for short password', async ({ page }) => {
    await fillSignupForm(page, { name: 'Test', email: 'test@test.gr', password: '123', company: 'Test Co' });
    await page.getByRole('button', { name: 'Εγγραφή' }).click({ force: true });

    await expect(page.getByText('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες')).toBeVisible();
  });

  test('shows error for invalid email', async ({ page }) => {
    await fillSignupForm(page, { name: 'Test', email: 'not-email', password: 'ValidPass123', company: 'Test Co' });
    await page.getByRole('button', { name: 'Εγγραφή' }).click({ force: true });

    await expect(page.getByText('Μη έγκυρη διεύθυνση email')).toBeVisible();
  });

  // ── UI Elements ──

  test('all form fields are visible', async ({ page }) => {
    await expect(page.getByLabel('Ονοματεπώνυμο')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Κωδικός', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Επωνυμία Εταιρείας')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Εγγραφή' })).toBeVisible();
  });

  test('shows subtitle text', async ({ page }) => {
    await expect(page.getByText('Ξεκινήστε τη δωρεάν δοκιμή σας')).toBeVisible();
  });

  test('login link navigates to /login', async ({ page }) => {
    // Register page uses common.login = "Είσοδος" for the back-to-login link
    const loginLink = page.getByRole('link', { name: 'Είσοδος' });
    await expect(loginLink).toHaveAttribute('href', '/login');
    await loginLink.click({ force: true });
    await expect(page).toHaveURL(/\/login/);
  });

  // ── Duplicate Registration (mocked) ──

  test('shows error for already-existing email', async ({ page }) => {
    // tRPC with superjson transformer wraps error data in { json: ... }
    await page.route('**/api/trpc/auth.register**', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify([{
          error: {
            json: {
              message: 'Αυτό το email χρησιμοποιείται ήδη',
              code: -32603,
              data: {
                code: 'CONFLICT',
                httpStatus: 409,
                stack: '',
                path: 'auth.register',
              },
            },
          },
        }]),
      });
    });

    await fillSignupForm(page, { name: 'Test User', email: 'existing@company.gr', password: 'ValidPass123', company: 'Existing Co' });
    await page.getByRole('button', { name: 'Εγγραφή' }).click({ force: true });

    await expect(page.getByText('Αυτό το email χρησιμοποιείται ήδη')).toBeVisible({ timeout: 10_000 });
  });

  // ── Loading State ──

  test('shows spinner during registration attempt', async ({ page }) => {
    await page.route('**/api/trpc/auth.register**', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        // tRPC + superjson expects { result: { data: { json: ... } } }
        body: JSON.stringify([{ result: { data: { json: { id: '1' } } } }]),
      });
    });

    await fillSignupForm(page, { name: 'Test User', email: 'new@company.gr', password: 'ValidPass123', company: 'New Co' });
    const submit = page.locator('button[type="submit"]');
    await submit.click({ force: true });

    // During loading, button becomes disabled and text is replaced with a spinner icon
    await expect(submit).toBeDisabled({ timeout: 3_000 });
  });
});
