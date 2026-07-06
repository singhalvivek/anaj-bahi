import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config for the Anaj Bahi PWA.
 * The app is served under basePath /app, so baseURL includes it (with the
 * trailing slash). Tests navigate relative to baseURL (e.g. `page.goto('./')`).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,
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
  // Two servers boot for the E2E run: the Next.js PWA (frontend) and the Phase-4
  // FastAPI + SQLite sync backend. The sync-journey spec drives both; the other
  // specs are fully offline and simply ignore the backend.
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://localhost:3000/app/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'uv run uvicorn app.main:app --port 8000',
      cwd: '../backend',
      url: 'http://localhost:8000/health',
      env: {
        DEVICE_TOKEN: 'test-device-token',
        DATABASE_URL: 'sqlite:///./data/e2e.db',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
