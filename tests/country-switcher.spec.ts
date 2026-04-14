import { test, expect } from '@playwright/test';

/**
 * Country Switcher E2E tests.
 *
 * The "hidden for single-country tenants" check creates a fresh account on
 * the fly (the default registration flow creates countries=['GR']), so it
 * runs standalone. The switchable/persistence/discovery-tab tests require
 * a seeded multi-country account and are skipped until seeding is available.
 */
test.describe('Country Switcher', () => {
  test('hidden for single-country tenants', async ({ page }) => {
    // Fresh registration — new tenant starts with countries=['GR']
    const uniqueEmail = `single-${Date.now()}@test.gr`;
    await page.goto('/register');

    await page.getByLabel('Ονοματεπώνυμο').fill('Single Test');
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Κωδικός', { exact: true }).fill('ValidPass123');
    await page.getByLabel('Επωνυμία Εταιρείας').fill('Single Co');
    await page.getByRole('checkbox').check({ force: true });
    await page.locator('button[type="submit"]').click({ force: true });

    // Wait for navigation to dashboard (or login if auto-login isn't wired)
    await page.waitForURL(/\/(dashboard|login|tenders)/, { timeout: 15_000 }).catch(() => undefined);

    // If we landed on the login page (signup → login pattern), log in now
    if (page.url().includes('/login')) {
      await page.getByLabel('Email').fill(uniqueEmail);
      await page.getByLabel('Κωδικός', { exact: true }).fill('ValidPass123');
      await page.locator('button[type="submit"]').click({ force: true });
      await page.waitForURL(/\/(dashboard|tenders)/, { timeout: 15_000 });
    }

    // Verify the switcher is NOT present (single-country tenant)
    const switcher = page.getByRole('button', { name: 'Switch country' });
    await expect(switcher).toHaveCount(0);

    // And the mode badge is also NOT present
    const badge = page.getByRole('status', { name: /Mode/ });
    await expect(badge).toHaveCount(0);
  });

  test.skip('visible and switchable for multi-country tenants', async ({ page }) => {
    // TODO: requires seeded user with tenant.countries = ['GR', 'NL'].
    // Enable once a seed script or programmatic setup exists.
    await page.goto('/login');
    await page.getByLabel('Email').fill('multi@test.gr');
    await page.getByLabel('Κωδικός', { exact: true }).fill('TestPass123');
    await page.locator('button[type="submit"]').click({ force: true });
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    const switcher = page.getByRole('button', { name: 'Switch country' });
    await expect(switcher).toBeVisible();
    await expect(switcher).toContainText('GR');

    await switcher.click({ force: true });
    await page.getByRole('menuitem', { name: /Nederland|NL/ }).click({ force: true });

    await expect(switcher).toContainText('NL', { timeout: 5_000 });
    await expect(page.getByRole('status', { name: /NL Mode/ })).toBeVisible();

    // Reload — active country should persist (stored in DB, not client)
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(switcher).toContainText('NL');
    await expect(page.getByRole('status', { name: /NL Mode/ })).toBeVisible();
  });

  test.skip('discovery tabs filter by country', async ({ page }) => {
    // TODO: requires seeded multi-country user (same as above).
    await page.goto('/login');
    await page.getByLabel('Email').fill('multi@test.gr');
    await page.getByLabel('Κωδικός', { exact: true }).fill('TestPass123');
    await page.locator('button[type="submit"]').click({ force: true });
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    await page.goto('/tenders');

    // All tab clears the query param
    await page.getByRole('button', { name: /All \(/ }).click({ force: true });
    await expect(page).toHaveURL(/\/tenders(?!\?country=)/);

    // NL tab sets ?country=NL
    await page.getByRole('button', { name: /🇳🇱 NL \(/ }).click({ force: true });
    await expect(page).toHaveURL(/\?country=NL/);
  });
});
