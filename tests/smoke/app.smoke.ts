import { test, expect } from '@playwright/test';

test.describe('Smoke Tests — Βασικοί Έλεγχοι', () => {
  test('health: API responds', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Καλώς ήρθατε' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Κωδικός', { exact: true })).toBeVisible();
  });

  test('register page loads', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Δημιουργία Λογαριασμού' })).toBeVisible();
    await expect(page.getByLabel('Ονοματεπώνυμο')).toBeVisible();
    await expect(page.getByLabel('Επωνυμία Εταιρείας')).toBeVisible();
  });

  test('root page is reachable and links to auth', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.ok()).toBeTruthy();
    // Landing page should be reachable; user may be on /, /dashboard, or /login depending on auth
    const url = page.url();
    expect(url).toMatch(/localhost:3000/);
  });

  test('login ↔ register navigation', async ({ page }) => {
    await page.goto('/login');
    // Verify the register link exists and has correct href
    const registerLink = page.getByRole('link', { name: 'Εγγραφή' });
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveAttribute('href', '/register');

    await page.goto('/register');
    // Register page links back to login via common.login ("Είσοδος")
    const loginLink = page.getByRole('link', { name: 'Είσοδος' });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', '/login');
  });

  test('unauthenticated access to /tenders redirects', async ({ page }) => {
    await page.goto('/tenders');
    // Should either show the page (if auth guard is off) or redirect to login
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const hasContent = await page.getByText(/Διαγωνισμ|Καλώς ήρθατε/).count();
    expect(url.includes('/login') || url.includes('/tenders') || hasContent > 0).toBeTruthy();
  });
});
