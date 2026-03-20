/**
 * Regression Test Suite — TenderCopilot
 * Τρέχει σε Chromium + Firefox + WebKit
 * Περιλαμβάνει smoke + auth + page-level checks
 */
import { test, expect } from '@playwright/test';

// ── Smoke ──

test.describe('Regression: Smoke', () => {
  test('API health check', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Καλώς ήρθατε')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Σύνδεση' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Συνέχεια με Google' })).toBeVisible();
  });

  test('register page renders correctly', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('Δημιουργία λογαριασμού')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Εγγραφή' })).toBeVisible();
  });
});

// ── Auth Flows ──

test.describe('Regression: Login Validation', () => {
  test('rejects empty form', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Σύνδεση' }).click({ force: true });
    await expect(page.getByText('Μη έγκυρη διεύθυνση email')).toBeVisible();
  });

  test('rejects wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('wrong@test.com');
    await page.getByLabel('Κωδικός πρόσβασης').fill('badpass');
    await page.getByRole('button', { name: 'Σύνδεση' }).click({ force: true });
    await expect(page.getByText('Λάθος email ή κωδικός πρόσβασης')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Regression: Signup Validation', () => {
  test('rejects empty form', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Εγγραφή' }).click({ force: true });
    await expect(page.getByText('Το όνομα είναι υποχρεωτικό')).toBeVisible();
  });

  test('rejects short password', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Ονοματεπώνυμο').fill('Test');
    await page.getByLabel('Email').fill('t@t.gr');
    await page.getByLabel('Κωδικός πρόσβασης').fill('123');
    await page.getByLabel('Επωνυμία εταιρείας').fill('Co');
    await page.getByRole('button', { name: 'Εγγραφή' }).click({ force: true });
    await expect(page.getByText('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες')).toBeVisible();
  });
});

// ── Navigation ──

test.describe('Regression: Navigation', () => {
  test('login ↔ register links work', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Εγγραφή' }).click({ force: true });
    await expect(page).toHaveURL(/\/register/);
    await page.getByRole('link', { name: 'Σύνδεση' }).click({ force: true });
    await expect(page).toHaveURL(/\/login/);
  });

  test('root URL redirects appropriately', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/(dashboard|login|tenders)/);
    expect(page.url()).toMatch(/\/(dashboard|login|tenders)/);
  });
});
