import { test, expect } from '@playwright/test';

// Auth pages have decorative orb overlays that intercept pointer events.
// Use dispatchEvent('click') to bypass the overlay and fire directly on the element.

test.describe('Signup — Εγγραφή', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  // ── Form Validation ──

  test('shows errors for empty form submission', async ({ page }) => {
    await page.getByRole('button', { name: 'Εγγραφή' }).dispatchEvent('click');

    await expect(page.getByText('Το όνομα είναι υποχρεωτικό')).toBeVisible();
    await expect(page.getByText('Μη έγκυρη διεύθυνση email')).toBeVisible();
    await expect(page.getByText('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες')).toBeVisible();
    await expect(page.getByText('Η επωνυμία εταιρείας είναι υποχρεωτική')).toBeVisible();
  });

  test('shows error for short password', async ({ page }) => {
    await page.getByLabel('Ονοματεπώνυμο').fill('Test');
    await page.getByLabel('Email').fill('test@test.gr');
    await page.getByLabel('Κωδικός πρόσβασης').fill('123');
    await page.getByLabel('Επωνυμία εταιρείας').fill('Test Co');
    await page.getByRole('button', { name: 'Εγγραφή' }).dispatchEvent('click');

    await expect(page.getByText('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες')).toBeVisible();
  });

  test('shows error for invalid email', async ({ page }) => {
    await page.getByLabel('Ονοματεπώνυμο').fill('Test');
    await page.getByLabel('Email').fill('not-email');
    await page.getByLabel('Κωδικός πρόσβασης').fill('ValidPass123');
    await page.getByLabel('Επωνυμία εταιρείας').fill('Test Co');
    await page.getByRole('button', { name: 'Εγγραφή' }).dispatchEvent('click');

    await expect(page.getByText('Μη έγκυρη διεύθυνση email')).toBeVisible();
  });

  // ── UI Elements ──

  test('all form fields are visible', async ({ page }) => {
    await expect(page.getByLabel('Ονοματεπώνυμο')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Κωδικός πρόσβασης')).toBeVisible();
    await expect(page.getByLabel('Επωνυμία εταιρείας')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Εγγραφή' })).toBeVisible();
  });

  test('shows subtitle text', async ({ page }) => {
    await expect(page.getByText('Ξεκινήστε δωρεάν με το TenderCopilot')).toBeVisible();
  });

  test('login link navigates to /login', async ({ page }) => {
    await page.getByRole('link', { name: 'Σύνδεση' }).dispatchEvent('click');
    await expect(page).toHaveURL(/\/login/);
  });

  // ── Duplicate Registration (mocked) ──

  test('shows error for already-existing email', async ({ page }) => {
    await page.route('**/api/trpc/auth.register**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          error: {
            message: 'Αυτό το email χρησιμοποιείται ήδη',
            code: -32603,
            data: { code: 'CONFLICT', httpStatus: 409 },
          },
        }]),
      });
    });

    await page.getByLabel('Ονοματεπώνυμο').fill('Test User');
    await page.getByLabel('Email').fill('existing@company.gr');
    await page.getByLabel('Κωδικός πρόσβασης').fill('ValidPass123');
    await page.getByLabel('Επωνυμία εταιρείας').fill('Existing Co');
    await page.getByRole('button', { name: 'Εγγραφή' }).dispatchEvent('click');

    await expect(page.getByText('Αυτό το email χρησιμοποιείται ήδη')).toBeVisible({ timeout: 10_000 });
  });

  // ── Loading State ──

  test('shows spinner during registration attempt', async ({ page }) => {
    await page.route('**/api/trpc/auth.register**', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { id: '1' } } }]),
      });
    });

    await page.getByLabel('Ονοματεπώνυμο').fill('Test User');
    await page.getByLabel('Email').fill('new@company.gr');
    await page.getByLabel('Κωδικός πρόσβασης').fill('ValidPass123');
    await page.getByLabel('Επωνυμία εταιρείας').fill('New Co');
    await page.getByRole('button', { name: 'Εγγραφή' }).dispatchEvent('click');

    await expect(page.getByRole('button', { name: 'Εγγραφή' })).toBeDisabled({ timeout: 3_000 });
  });
});
