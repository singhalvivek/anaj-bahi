import { expect, type Page } from '@playwright/test'

/**
 * Shared E2E auth helpers — Google sign-in against the Firebase AUTH EMULATOR.
 *
 * Auth is now Google sign-in (GoogleAuthProvider + signInWithPopup); the old phone/
 * SMS-OTP + registered-test-number path is gone (it needed the paid Blaze plan).
 * Under the Auth emulator, `signInWithPopup` opens the emulator's built-in test-IdP
 * widget instead of a real Google account chooser, so sign-in is fully deterministic
 * with no real project, no network, and no billing.
 *
 * SIGN-IN APPROACH — (a) DRIVE THE POPUP. We use the app's REAL "Continue with
 * Google" button (`login-google`), capture the emulator IdP popup via
 * `context.waitForEvent('page')`, and on that popup either reuse an already-created
 * identity (a prior spec made it — the emulator's account store persists for the
 * whole run) or "Add new account" and fill a given email + display name. This keeps
 * the whole flow black-box (no app changes, the real onAuthStateChanged listener
 * runs) while letting each spec pick a distinct identity — so owner and employee are
 * genuinely different Google accounts, and the same email always maps to the same
 * stable emulator uid (returning-user recognition via users/{uid}.bizId is exercised
 * for real).
 *
 * Testids target the ACTUAL shipped components (verified by grepping the source):
 * Login `auth-login`/`login-google`; RoleChooser (role-free path chooser)
 * `role-chooser`/`choose-new-business`/`choose-existing-business`; CreateBusiness
 * `create-business`/`create-name-input`/`create-shop-input`/`create-mobile-input`/
 * `create-business-submit`; JoinByCode `join-by-code`/`join-code-input`/
 * `join-code-next`/`join-mobile-input`/`join-mobile-next`/`join-name-input`/
 * `join-submit`. Onboarding is ROLE-FREE — no owner/partner/employee wording; the
 * joiner's role comes from the invite. There is NO standalone name prompt in the
 * Google flow — the name is captured inline (prefilled from Google) in the create/join
 * form. Bilingual copy is avoided: selection is by testid/role.
 */

// --- Canonical test identities ----------------------------------------------

export const OWNER_EMAIL = 'test-owner@anajbahi.test'
export const OWNER_NAME = 'Test Owner'
export const DEFAULT_BIZ_NAME = 'Anaj Test Traders'
/** Owner mobile — the LOCAL 10 digits typed into the +91 PhoneField. */
export const OWNER_MOBILE_LOCAL = '9352277260'

export const EMPLOYEE_EMAIL = 'test-employee@anajbahi.test'
export const EMPLOYEE_NAME = 'Test Employee'
/** Employee mobile — LOCAL 10 digits (E.164 +919000000002, phoneKey 919000000002). */
export const EMPLOYEE_MOBILE_LOCAL = '9000000002'

export interface GoogleIdentity {
  email: string
  displayName: string
}

/**
 * A fresh, unique email for a spec that ONBOARDS a new identity — so a retry (the
 * emulator's account/Firestore state persists across a retry-after-failure within a
 * run) always gets a brand-new user that lands in onboarding, never an already-joined
 * one. Owner sign-in stays a fixed shared identity (its helper is retry-idempotent).
 */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@anajbahi.test`
}

async function isVisibleSoon(page: Page, testid: string, timeout = 4000): Promise<boolean> {
  try {
    await page.getByTestId(testid).waitFor({ state: 'visible', timeout })
    return true
  } catch {
    return false
  }
}

/** Fill an emulator-widget input by trying a few tolerant selectors in order. */
async function fillFirstMatch(
  popup: Page,
  selectors: string[],
  value: string,
): Promise<void> {
  for (const sel of selectors) {
    const loc = popup.locator(sel).first()
    if (await loc.count().then((n) => n > 0).catch(() => false)) {
      await loc.fill(value)
      return
    }
  }
  throw new Error(`Emulator IdP widget: no input matched any of ${selectors.join(', ')}`)
}

/**
 * Drive the Firebase Auth-emulator Google sign-in popup for `identity`. Clicks the
 * app's real `login-google` button, captures the popup, then reuses the existing
 * emulator account for this email (if a prior spec created it) or adds a new one.
 */
export async function signInWithGoogleEmulator(
  page: Page,
  identity: GoogleIdentity,
): Promise<void> {
  const popupPromise = page.context().waitForEvent('page')
  await page.getByTestId('login-google').click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')

  // Reuse path: when a prior spec already created this identity the widget lists it
  // as a clickable account row (its email shown as text). Click it to reuse the
  // SAME stable emulator uid.
  const existing = popup.getByText(identity.email, { exact: true }).first()
  if (await existing.isVisible({ timeout: 2000 }).catch(() => false)) {
    await existing.click()
    return
  }

  // New-account path. The add-account form (`#email-input`) is the default view on a
  // fresh emulator; when existing accounts are listed it is behind "Add new account".
  const emailInput = popup.locator('input#email-input')
  if (!(await emailInput.isVisible({ timeout: 1000 }).catch(() => false))) {
    await popup.getByText('Add new account', { exact: false }).click()
  }

  await fillFirstMatch(popup, ['input#email-input', 'input[type="email"]'], identity.email)
  await fillFirstMatch(popup, ['input#display-name-input'], identity.displayName)

  // The submit button reads "Sign in with Google.com".
  await popup.getByRole('button', { name: /sign in with/i }).click()
}

// --- High-level flows -------------------------------------------------------

export interface SignInOptions {
  bizName?: string
}

/**
 * Sign the canonical test OWNER in and ensure we land on the gated home. On a clean
 * emulator this drives the full onboarding (role → create business); once the
 * owner's users/{uid}.bizId is set (persists across specs within a run) it resolves
 * straight to `ready`. Safe to call from a spec's `beforeEach`.
 */
export async function signInTestOwner(page: Page, opts: SignInOptions = {}): Promise<void> {
  const bizName = opts.bizName ?? DEFAULT_BIZ_NAME

  await page.goto('./')
  if (await isVisibleSoon(page, 'gated-home', 3000)) return

  await expect(page.getByTestId('auth-login')).toBeVisible()
  await signInWithGoogleEmulator(page, { email: OWNER_EMAIL, displayName: OWNER_NAME })

  // After the popup closes the app reads users/{uid}: bizId set → gated home;
  // else → onboarding (RoleChooser). The FIRST emulator read of a run (cold JVM) can
  // be slow, so wait generously for whichever surface resolves.
  const gatedHome = page.getByTestId('gated-home')
  const roleChooser = page.getByTestId('role-chooser')
  await expect(gatedHome.or(roleChooser).first()).toBeVisible({ timeout: 40_000 })
  if (await gatedHome.isVisible()) return

  // Owner onboarding: New business → create business (name prefilled from Google).
  await page.getByTestId('choose-new-business').click()
  await expect(page.getByTestId('create-business')).toBeVisible()
  await page.getByTestId('create-shop-input').fill(bizName)
  await page.getByTestId('create-mobile-input').fill(OWNER_MOBILE_LOCAL)
  await page.getByTestId('create-business-submit').click()

  await expect(gatedHome).toBeVisible({ timeout: 40_000 })
}

/**
 * Sign a NEW Google identity in and report where the app lands:
 *   • 'ready'      — returning user (users/{uid}.bizId already set) → gated home.
 *   • 'onboarding' — brand-new user → the RoleChooser (caller drives owner/employee).
 */
export async function signInGoogleUser(
  page: Page,
  identity: GoogleIdentity,
): Promise<'ready' | 'onboarding'> {
  await page.goto('./')
  if (await isVisibleSoon(page, 'gated-home', 3000)) return 'ready'

  await expect(page.getByTestId('auth-login')).toBeVisible()
  await signInWithGoogleEmulator(page, identity)

  const gatedHome = page.getByTestId('gated-home')
  const roleChooser = page.getByTestId('role-chooser')
  await expect(gatedHome.or(roleChooser).first()).toBeVisible({ timeout: 40_000 })
  return (await gatedHome.isVisible()) ? 'ready' : 'onboarding'
}

/**
 * From the RoleChooser, drive the "Business already registered" JoinByCode redemption
 * (code → mobile → name). The joined role (employee or partner) is carried by the
 * invite, not chosen here. Leaves the app on the gated home once the claim commits.
 * Returns without asserting the terminal — the caller asserts gated-home (or an error).
 */
export async function employeeJoinByCode(
  page: Page,
  opts: { code: string; mobileLocal: string; name: string },
): Promise<void> {
  await expect(page.getByTestId('role-chooser')).toBeVisible()
  await page.getByTestId('choose-existing-business').click()

  await expect(page.getByTestId('join-by-code')).toBeVisible()
  await page.getByTestId('join-code-input').fill(opts.code)
  await page.getByTestId('join-code-next').click()

  await expect(page.getByTestId('join-mobile-input')).toBeVisible()
  await page.getByTestId('join-mobile-input').fill(opts.mobileLocal)
  await page.getByTestId('join-mobile-next').click()

  await expect(page.getByTestId('join-name-input')).toBeVisible()
  await page.getByTestId('join-name-input').fill(opts.name)
  await page.getByTestId('join-submit').click()
}

/**
 * As a MANAGER (owner or partner) on the `/employees` Members screen, generate a
 * one-time invite code for the given mobile and role (default Employee; pass
 * `role: 'partner'` to mint a Partner invite). The member's name is captured at claim
 * time (from their Google login), not here. Returns the 6-char code shown large to copy.
 */
export async function ownerGenerateInviteCode(
  page: Page,
  opts: { mobileLocal: string; role?: 'employee' | 'partner' },
): Promise<string> {
  await expect(page.getByTestId('employees-screen')).toBeVisible()
  await page.getByTestId('employee-mobile-input').fill(opts.mobileLocal)
  if (opts.role) {
    await page.getByTestId('invite-role-select').selectOption(opts.role)
  }
  await page.getByTestId('generate-code-btn').click()

  await expect(page.getByTestId('invite-code')).toBeVisible({ timeout: 15_000 })
  const code = ((await page.getByTestId('invite-code').innerText()) ?? '').trim()
  expect(code).toMatch(/^[A-Z2-9]{6}$/)
  return code
}

/** Sign out (the Sign-out button lives on the Settings screen), returning to Login. */
export async function signOut(page: Page): Promise<void> {
  await page.getByTestId('nav-settings').click()
  await page.getByTestId('sign-out-btn').click()
  await expect(page.getByTestId('auth-login')).toBeVisible()
}
