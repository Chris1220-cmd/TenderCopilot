import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── Smoke: γρήγορα health checks (μόνο Chromium) ──
    {
      name: 'smoke',
      testMatch: /.*\.smoke\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Auth: login & signup tests (μόνο Chromium) ──
    {
      name: 'auth',
      testMatch: /.*\.auth\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Regression: ΟΛΑ τα tests, σε 3 browsers ──
    {
      name: 'regression-chromium',
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'regression-firefox',
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'regression-webkit',
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
