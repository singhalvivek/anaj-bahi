import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config for the Anaj Bahi PWA.
 *
 * The whole suite runs against the Firebase Auth + Firestore EMULATORS. The emulators
 * themselves are started OUTSIDE Playwright by `firebase emulators:exec` (see
 * package.json `test:e2e` → `firebase emulators:exec --only auth,firestore ... "playwright test"`),
 * so this config assumes Auth (9099) + Firestore (8080) are already up; `global-setup`
 * clears them via their REST endpoints before the run. The Next dev server is booted
 * here (below) with `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=1` + a demo Firebase config so
 * `lib/firebase/app.ts` points Auth + Firestore at the local emulators.
 *
 * The app is served under basePath /app, so baseURL includes it (with the trailing
 * slash). Tests navigate relative to baseURL (e.g. `page.goto('./')`).
 */

// Demo Firebase web config for the emulator run. `projectId` MUST equal the emulator
// project (see .firebaserc / firebase.json → demo-anaj-bahi and global-setup); the
// other five values are non-empty dummies (the emulator does not validate them, but
// lib/firebase/app.ts requires all six to be present). These are passed into the dev
// server's process.env and therefore take precedence over any real values in
// frontend/.env.local (Next does not override existing env vars).
const EMULATOR_ENV = {
  NEXT_PUBLIC_FIREBASE_USE_EMULATORS: '1',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-anaj-bahi.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-anaj-bahi',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-anaj-bahi.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:demoappid',
}

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  // Serial, single-worker execution. Combined with Playwright's default alphabetical
  // spec-file ordering this makes `auth-onboarding.spec.ts` run FIRST (it sorts before
  // ledger-/purchase-/quick-bill-/receipt-share-/roles-/shared-ledger specs), so the
  // dedicated gate spec sees the CLEAN emulator state that global-setup just reset
  // (before any journey spec signs the test owner in and creates the business). One
  // worker also keeps the shared emulator identities free of cross-test races.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // One retry absorbs transient flakiness inherent to the dev server compiling routes
  // on-demand (first hit of a route under full-suite load can lag past the nav
  // timeout). App-logic failures still fail deterministically on the retry too.
  retries: 1,
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
  // The only server Playwright boots is the Next.js PWA (the Firebase emulators are
  // started by the `firebase emulators:exec` wrapper around this whole command). The
  // dev server runs with the demo Firebase config + emulator flag so all Auth/Firestore
  // traffic is deterministic and local — no real project, no network, no billing.
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://localhost:3000/app/',
      reuseExistingServer: !process.env.CI,
      // Generous: a COLD Next 15 dev compile (fresh .next) while the Firebase emulators
      // are also spinning up under Java can take well over two minutes on a loaded box.
      timeout: 240_000,
      env: EMULATOR_ENV,
    },
  ],
})
