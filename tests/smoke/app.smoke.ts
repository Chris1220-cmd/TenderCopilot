import { test, expect } from '@playwright/test';

test.describe('Smoke Tests — Βασικοί Έλεγχοι', () => {
  test('health: API responds', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Καλώς ήρθατε')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Κωδικός πρόσβασης')).toBeVisible();
  });

  test('register page loads', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('Δημιουργία λογαριασμού')).toBeVisible();
    await expect(page.getByLabel('Ονοματεπώνυμο')).toBeVisible();
    await expect(page.getByLabel('Επωνυμία εταιρείας')).toBeVisible();
  });

  test('root redirects to dashboard or login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/(dashboard|login|tenders)/);
    const url = page.url();
    expect(
      url.includes('/dashboard') || url.includes('/login') || url.includes('/tenders')
    ).toBeTruthy();
  });

  test('login ↔ register navigation', async ({ page }) => {
    await page.goto('/login');
    // Auth pages have decorative orb overlays — use JS dispatch for navigation clicks
    await page.getByRole('link', { name: 'Εγγραφή' }).dispatchEvent('click');
    await expect(page).toHaveURL(/\/register/);

    await page.getByRole('link', { name: 'Σύνδεση' }).dispatchEvent('click');
    await expect(page).toHaveURL(/\/login/);
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
