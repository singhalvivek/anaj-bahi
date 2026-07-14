import { test, expect } from '@playwright/test'
import {
  signInWithGoogleEmulator,
  OWNER_EMAIL,
  OWNER_NAME,
  OWNER_MOBILE_LOCAL,
} from './support/auth'
import {
  getUidByEmail,
  getDocFields,
  listCollection,
  str,
  clearFirestore,
  clearAuth,
} from './support/emulator'

/**
 * Phase-6 gate spec — the Google-auth + role + business spine.
 *
 * Runs FIRST (it sorts alphabetically before the journey/roles specs; workers:1 +
 * fullyParallel:false make spec files run serially), so it sees the CLEAN emulator
 * state that global-setup just reset — and therefore drives the FULL onboarding
 * once: Google sign-in (via the Auth-emulator test-IdP popup) → RoleChooser → Owner
 * → create business (name PREFILLED from Google + editable, shop, mobile) → gated
 * home. It then asserts the real Firestore/Auth writes (users/{uid}, businesses/
 * {bizId}, members/{uid}) straight from the emulators, session persistence across a
 * reload, and sign-out.
 *
 * Deterministic + free: no real Google account, no SMS, no billing, no secret key.
 */

const BIZ_NAME = 'Ramesh Anaj Bhandar'

// Reset BOTH emulators before this spec (and before a retry) so it always drives the
// FULL clean-onboarding path deterministically — a retry after a transient failure
// would otherwise find the owner already onboarded (users/{uid}.bizId set) and skip
// onboarding. This spec sorts first, so clearing here clobbers nothing the later
// specs rely on (they recreate the owner via signInTestOwner as needed).
test.beforeEach(async () => {
  await clearFirestore()
  await clearAuth()
})

test('clean user: Google sign-in → owner creates business → gated home; docs written; persists; sign out', async ({
  page,
}) => {
  // --- The app opens to the Login screen (no session yet) ---
  await page.goto('./')
  await expect(page.getByTestId('auth-login')).toBeVisible()

  // --- Continue with Google → the Auth-emulator test-IdP popup → new identity ---
  await signInWithGoogleEmulator(page, { email: OWNER_EMAIL, displayName: OWNER_NAME })

  // --- Onboarding step 1: RoleChooser → Owner (no standalone name prompt) ---
  // Generous: the FIRST Firestore-emulator read of the run (cold JVM) can be slow.
  await expect(page.getByTestId('onboarding-flow')).toBeVisible({ timeout: 40_000 })
  await expect(page.getByTestId('role-chooser')).toBeVisible()
  await page.getByTestId('role-owner').click()

  // --- Onboarding step 2: create the business ---
  await expect(page.getByTestId('create-business')).toBeVisible()

  // The name is PREFILLED from the Google identity and remains EDITABLE.
  const nameInput = page.getByTestId('create-name-input')
  await expect(nameInput).toHaveValue(OWNER_NAME)
  await expect(nameInput).toBeEditable()

  await page.getByTestId('create-shop-input').fill(BIZ_NAME)
  await page.getByTestId('create-mobile-input').fill(OWNER_MOBILE_LOCAL)
  await page.getByTestId('create-business-submit').click()

  // --- Landed on the gated home ---
  await expect(page.getByTestId('gated-home')).toBeVisible({ timeout: 40_000 })
  await expect(page.getByTestId('new-bill-btn')).toBeVisible()

  // --- Assert the real Firestore/Auth writes straight from the emulators ---
  const uid = await getUidByEmail(OWNER_EMAIL)
  expect(uid, 'a Google identity was created in the Auth emulator').not.toBeNull()

  // users/{uid}: email + owner role + a bizId pointer.
  const userDoc = await getDocFields(`users/${uid}`)
  expect(userDoc, 'users/{uid} was created').not.toBeNull()
  expect(str(userDoc, 'email')).toBe(OWNER_EMAIL)
  expect(str(userDoc, 'role')).toBe('owner')
  const bizId = str(userDoc, 'bizId')
  expect(bizId, 'users/{uid}.bizId is set').toBeTruthy()

  // businesses/{bizId}: the profile the owner just entered.
  const bizDoc = await getDocFields(`businesses/${bizId}`)
  expect(bizDoc, 'businesses/{bizId} was created').not.toBeNull()
  expect(str(bizDoc, 'shopName')).toBe(BIZ_NAME)

  // businesses/{bizId}/members/{uid}: the owner member (role owner), and NO invite
  // doc exists for the owner (their uid alone recognises them).
  const memberDoc = await getDocFields(`businesses/${bizId}/members/${uid}`)
  expect(memberDoc, 'businesses/{bizId}/members/{uid} was created').not.toBeNull()
  expect(str(memberDoc, 'role')).toBe('owner')
  const invites = await listCollection('invites')
  expect(invites.length, 'no invite doc is created for the owner').toBe(0)

  // --- Identity + role live on the SETTINGS screen ---
  await page.getByTestId('nav-settings').click()
  await page.waitForURL('**/app/settings/**')
  await expect(page.getByTestId('home-user-name')).toContainText(OWNER_NAME)
  await expect(page.getByTestId('home-role')).toContainText(/owner|मालिक/i)
  await expect(page.getByTestId('sign-out-btn')).toBeVisible()
  // NOTE: the account-strip `home-business-name` reflects the LOCAL Dexie business
  // *profile* (lib/settings/profile → receipt header, default "My Shop"), which is a
  // SEPARATE store from the multi-tenant `businesses/{bizId}` doc created at onboarding
  // — the created business name is NOT propagated into that profile. The authoritative
  // business name is asserted above from `businesses/{bizId}.shopName` via the emulator.
  await expect(page.getByTestId('home-business-name')).toBeVisible()

  // --- Session persists across a full reload — no re-login ---
  await page.reload()
  await expect(page.getByTestId('gated-home')).toBeVisible()
  await expect(page.getByTestId('auth-login')).toHaveCount(0)

  // --- Sign out (from Settings) → back to Login ---
  await page.getByTestId('nav-settings').click()
  await page.getByTestId('sign-out-btn').click()
  await expect(page.getByTestId('auth-login')).toBeVisible()
  await expect(page.getByTestId('gated-home')).toHaveCount(0)
})
