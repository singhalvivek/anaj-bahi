import { expect, type Page } from '@playwright/test'

/**
 * Shared E2E auth helper. Drives real Firebase Auth via the project's registered
 * test number `+919352277260` / fixed OTP `000000` (no SMS, no reCAPTCHA challenge,
 * no region-policy check — Firebase short-circuits a registered test number), then — if
 * this is the test user's first sign-in after the global-setup reset — completes
 * onboarding as an OWNER with the given business name, landing on the gated home.
 *
 * It is idempotent-ish across specs in one run: after the global-setup reset the
 * FIRST spec to call it does full onboarding (creating the business); every later
 * spec finds the user already has a business, so `confirmOtp` resolves straight to
 * `ready` and the onboarding steps are skipped. If the browser context is already
 * `ready` (session persisted), it just returns.
 *
 * Testids below are slice-b's ACTUAL rendered testids (see the per-file map). NOTE
 * these diverge from the names frozen in spec/ui.md (e.g. `login-phone-input` vs
 * ui.md's `phone-input`) — reported as a slice-b↔ui.md drift; the E2E must drive
 * what actually renders, so it uses slice-b's real ids.
 */

export const TEST_PHONE = '+919352277260'
export const TEST_OTP = '000000'
export const TEST_OWNER_NAME = 'Test Owner'
export const DEFAULT_BIZ_NAME = 'Anaj Test Traders'

async function isVisibleSoon(page: Page, testid: string, timeout = 4000): Promise<boolean> {
  try {
    await page.getByTestId(testid).waitFor({ state: 'visible', timeout })
    return true
  } catch {
    return false
  }
}

export interface SignInOptions {
  bizName?: string
  ownerName?: string
}

/**
 * Sign the canonical test owner in and ensure we land on the gated home. Safe to
 * call from a spec's `beforeEach`.
 */
export async function signInTestOwner(page: Page, opts: SignInOptions = {}): Promise<void> {
  const bizName = opts.bizName ?? DEFAULT_BIZ_NAME
  const ownerName = opts.ownerName ?? TEST_OWNER_NAME

  await page.goto('./')

  // Already signed in and ready (persisted session) → nothing to do.
  if (await isVisibleSoon(page, 'gated-home', 3000)) return

  // --- Login: phone → OTP (slice-b LoginScreen: container `auth-login`) ---
  await expect(page.getByTestId('auth-login')).toBeVisible()
  await page.getByTestId('login-phone-input').fill(TEST_PHONE)
  await page.getByTestId('login-send-code').click()

  await expect(page.getByTestId('login-otp-input')).toBeVisible()
  await page.getByTestId('login-otp-input').fill(TEST_OTP)
  await page.getByTestId('login-verify').click()

  // --- After OTP the app resolves to EITHER the gated home (returning user with a
  // business) or onboarding (fresh user). Cold Firestore reads on a fresh context
  // can take several seconds, so wait generously for whichever appears rather than
  // a short fixed poll, then branch. ---
  const gatedHome = page.getByTestId('gated-home')
  const onboardingName = page.getByTestId('onboarding-name')
  await expect(gatedHome.or(onboardingName).first()).toBeVisible({ timeout: 25000 })
  if (await gatedHome.isVisible()) return

  await expect(page.getByTestId('onboarding-flow')).toBeVisible()

  // Step 1 — display name (NamePrompt: `onboarding-name` / `name-input` / `name-continue`).
  await expect(page.getByTestId('onboarding-name')).toBeVisible()
  await page.getByTestId('name-input').fill(ownerName)
  await page.getByTestId('name-continue').click()

  // Step 2 — role chooser → Owner.
  await expect(page.getByTestId('role-chooser')).toBeVisible()
  await page.getByTestId('role-owner').click()

  // Step 3 — create the business (CreateBusiness: `create-shop-input` / `create-business-submit`).
  await expect(page.getByTestId('create-business')).toBeVisible()
  await page.getByTestId('create-shop-input').fill(bizName)
  await page.getByTestId('create-business-submit').click()

  // Landed on the gated home.
  await expect(page.getByTestId('gated-home')).toBeVisible()
}

/** Sign out from the gated home, returning to the Login screen. */
export async function signOut(page: Page): Promise<void> {
  await page.getByTestId('sign-out-btn').click()
  await expect(page.getByTestId('auth-login')).toBeVisible()
}
