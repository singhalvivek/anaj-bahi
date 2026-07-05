import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config for the Anaj Bahi PWA.
 * The app is served under basePath /app, so baseURL includes it (with the
 * trailing slash). Tests navigate relative to baseURL (e.g. `page.goto('./')`).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3000/app/',
    trace: 'on-first-retry',
    // Mobile-ish portrait viewport (the app is Android-first, one-handed).
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000/app/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
