import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config for the Anaj Bahi PWA.
 * The app is served under basePath /app, so baseURL includes it (with the
 * trailing slash). Tests navigate relative to baseURL (e.g. `page.goto('./')`).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  // Serial, single-worker execution. Combined with Playwright's default
  // alphabetical spec-file ordering this makes `auth-onboarding.spec.ts` run
  // FIRST (it sorts before ledger-/purchase-/quick-bill-/receipt-share specs),
  // so the dedicated gate spec sees the CLEAN test user that global-setup just
  // reset (before any journey spec signs the test owner in and creates the
  // business). One worker also keeps the shared real-Firebase test user free of
  // cross-test races.
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
  // Firebase-only from Phase 6 on: the retired Phase-4 FastAPI + SQLite sync
  // backend `uvicorn` webServer is removed — the sole server the E2E run boots is
  // the Next.js PWA. Identity/data come from real Firebase Auth + Cloud Firestore
  // (the test number + global-setup reset make it deterministic).
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://localhost:3000/app/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
