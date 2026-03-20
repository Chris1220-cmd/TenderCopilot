import { test, expect } from '@playwright/test';

// Auth pages have decorative orb overlays that intercept pointer events.
// Use dispatchEvent('click') to bypass the overlay and fire directly on the element.

test.describe('Login — Σύνδεση', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  // ── Form Validation ──

  test('shows error for empty form submission', async ({ page }) => {
    await page.getByRole('button', { name: 'Σύνδεση' }).dispatchEvent('click');
    await expect(page.getByText('Μη έγκυρη διεύθυνση email')).toBeVisible();
    await expect(page.getByText('Ο κωδικός πρόσβασης είναι υποχρεωτικός')).toBeVisible();
  });

  test('shows error for invalid email format', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Κωδικός πρόσβασης').fill('somepassword');
    await page.getByRole('button', { name: 'Σύνδεση' }).dispatchEvent('click');
    await expect(page.getByText('Μη έγκυρη διεύθυνση email')).toBeVisible();
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Κωδικός πρόσβασης').fill('wrongpassword');
    await page.getByRole('button', { name: 'Σύνδεση' }).dispatchEvent('click');
    await expect(page.getByText('Λάθος email ή κωδικός πρόσβασης')).toBeVisible({ timeout: 10_000 });
  });

  // ── UI Elements ──

  test('password toggle shows/hides password', async ({ page }) => {
    const pwField = page.getByLabel('Κωδικός πρόσβασης');
    await pwField.fill('secret123');

    await expect(pwField).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Εμφάνιση κωδικού' }).dispatchEvent('click');
    await expect(pwField).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: 'Απόκρυψη κωδικού' }).dispatchEvent('click');
    await expect(pwField).toHaveAttribute('type', 'password');
  });

  test('Google sign-in button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Συνέχεια με Google' })).toBeVisible();
  });

  test('Magic link button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Αποστολή Magic Link' })).toBeVisible();
  });

  test('magic link requires valid email', async ({ page }) => {
    await page.getByRole('button', { name: 'Αποστολή Magic Link' }).dispatchEvent('click');
    await expect(page.getByText('Εισάγετε ένα έγκυρο email πρώτα')).toBeVisible();
  });

  test('register link navigates to /register', async ({ page }) => {
    await page.getByRole('link', { name: 'Εγγραφή' }).dispatchEvent('click');
    await expect(page).toHaveURL(/\/register/);
  });

  // ── Loading State ──

  test('shows spinner during login attempt', async ({ page }) => {
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Κωδικός πρόσβασης').fill('password123');

    await page.route('**/api/auth/callback/credentials', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    await page.getByRole('button', { name: 'Σύνδεση' }).dispatchEvent('click');
    await expect(page.getByRole('button', { name: 'Σύνδεση' })).toBeDisabled({ timeout: 3_000 });
  });
});
