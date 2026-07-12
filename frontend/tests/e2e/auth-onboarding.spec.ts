import { test, expect } from '@playwright/test'
import { TEST_PHONE, TEST_OTP } from './support/auth'

/**
 * Phase-6 gate spec — the auth + role + business spine, mirroring the roadmap's
 * "How the user tests it" journey. It runs FIRST (it sorts alphabetically before
 * the journey specs; workers:1 + fullyParallel:false in playwright.config.ts make
 * spec files run serially), so it sees the CLEAN test user that global-setup just
 * reset — and therefore drives the FULL onboarding path once.
 *
 * Real Firebase Auth via the project's registered test number `+919352277260` / OTP `000000`
 * (no SMS, no reCAPTCHA challenge); real Cloud Firestore for the business write.
 * Asserts on real rendered content/testids, not just internal status.
 *
 * Testids for the login/onboarding surfaces are slice-b's ACTUAL rendered ids
 * (`auth-login`, `login-phone-input`, `login-send-code`, `login-otp-input`,
 * `login-verify`, `onboarding-flow`, `onboarding-name`, `name-input`, `name-continue`,
 * `role-chooser`, `role-owner`, `create-business`, `create-shop-input`,
 * `create-business-submit`) — these diverge from the names frozen in spec/ui.md
 * (reported drift). The identity ids (`home-user-name`, `home-business-name`,
 * `home-role`, `sign-out-btn`) now live on the SETTINGS screen (the identity strip
 * moved off the app shell); `gated-home` is the ready-shell marker on `<main>`.
 * The old `stub-shared-cloud` coming-soon banner was removed (shared cloud shipped).
 */

const DISPLAY_NAME = 'Ramesh Kumar'
const BIZ_NAME = 'Ramesh Anaj Bhandar'

test('clean user: login → name → owner-creates-business → gated home; session persists; sign out', async ({
  page,
}) => {
  // --- The app opens to the Login screen (no session yet) ---
  await page.goto('./')
  await expect(page.getByTestId('auth-login')).toBeVisible()

  // --- Phone → Send code ---
  await page.getByTestId('login-phone-input').fill(TEST_PHONE)
  await page.getByTestId('login-send-code').click()

  // --- OTP → Verify ---
  await expect(page.getByTestId('login-otp-input')).toBeVisible()
  await page.getByTestId('login-otp-input').fill(TEST_OTP)
  await page.getByTestId('login-verify').click()

  // --- Onboarding step 1: name prompt ---
  await expect(page.getByTestId('onboarding-flow')).toBeVisible()
  await expect(page.getByTestId('onboarding-name')).toBeVisible()
  await page.getByTestId('name-input').fill(DISPLAY_NAME)
  await page.getByTestId('name-continue').click()

  // --- Onboarding step 2: role chooser → Owner ---
  await expect(page.getByTestId('role-chooser')).toBeVisible()
  await page.getByTestId('role-owner').click()

  // --- Onboarding step 3: create the business ---
  await expect(page.getByTestId('create-business')).toBeVisible()
  await page.getByTestId('create-shop-input').fill(BIZ_NAME)
  await page.getByTestId('create-business-submit').click()

  // --- Landed on the gated home: the bill list shell (no identity strip here now) ---
  await expect(page.getByTestId('gated-home')).toBeVisible()
  await expect(page.getByTestId('new-bill-btn')).toBeVisible()

  // Identity + role + business + Sign out now live on the SETTINGS screen only.
  await page.getByTestId('nav-settings').click()
  await page.waitForURL('**/app/settings/**')
  await expect(page.getByTestId('home-user-name')).toContainText(DISPLAY_NAME)
  await expect(page.getByTestId('home-business-name')).toContainText(BIZ_NAME)
  // Role badge — the app defaults to Hindi, so an owner reads "मालिक"; accept the
  // English "Owner" or a raw key ("home.role.owner") too, so this holds in any language.
  await expect(page.getByTestId('home-role')).toContainText(/owner|मालिक/i)
  await expect(page.getByTestId('sign-out-btn')).toBeVisible()

  // --- Session persists across a full reload — no re-login (still on Settings) ---
  await page.reload()
  await expect(page.getByTestId('gated-home')).toBeVisible()
  await expect(page.getByTestId('auth-login')).toHaveCount(0)
  await expect(page.getByTestId('home-business-name')).toContainText(BIZ_NAME)

  // --- Sign out (from Settings) → back to Login ---
  await page.getByTestId('sign-out-btn').click()
  await expect(page.getByTestId('auth-login')).toBeVisible()
  await expect(page.getByTestId('gated-home')).toHaveCount(0)
})
