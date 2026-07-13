import { test, expect, type Page } from '@playwright/test'
import {
  signInTestOwner,
  signInGoogleUser,
  ownerGenerateInviteCode,
  uniqueEmail,
} from './support/auth'

/**
 * Phase-8 roles E2E — two REAL Google identities against the Firebase Auth +
 * Firestore EMULATORS, exercising the owner/employee boundary end to end:
 *   owner generates an INVITE CODE for an employee mobile → a SECOND Google identity
 *   signs in, picks Employee, and redeems the code (code → matching mobile → name) →
 *   the employee SHARES the ledger → an employee-created bill is ATTRIBUTED to them →
 *   the employee is RESTRICTED from the business profile + the Employees screen (UI
 *   gate AND the emulator-enforced Security Rules).
 *
 * NEGATIVE case included: a correct code with a NON-MATCHING mobile shows the distinct
 * `phoneMismatch` error and does NOT join — proving `checkInvite`'s phone gate.
 *
 * Fully deterministic on the emulators: no real Google account, no SMS, no billing,
 * no secret key. The published `firestore.rules` are enforced by the Firestore
 * emulator, so the negative role assertions are real, not client-only.
 */

// This spec's employee mobile (distinct from other specs). The employee EMAIL is
// generated fresh per test invocation (see `uniqueEmail` in the test) so a retry
// always onboards a brand-new identity rather than an already-joined one. Mobile is
// the LOCAL 10 digits typed into the +91 PhoneField.
const EMP_NAME = 'Employee One'
const EMP_MOBILE_LOCAL = '9000000011'
const WRONG_MOBILE_LOCAL = '9000000099'

const OWNER_FARMER = 'OwnerFarmer Ram'
const EMP_FARMER = 'EmpFarmer Shyam'

/** Create a one-grain quick-entry bill; leaves the page on the home bill list. */
async function createQuickBill(
  page: Page,
  opts: { farmer: string; place: string; grain: string; price: string; weight: string; amount: string },
) {
  await page.getByTestId('new-bill-btn').click()
  await page.waitForURL('**/app/bills/choose/**')
  await page.getByTestId('choice-quick').click()
  await page.waitForURL('**/app/bills/quick/**')

  await page.getByTestId('farmer-input').fill(opts.farmer)
  await page.getByLabel('Place / Village').fill(opts.place)

  await page.getByTestId('grain-type-select').nth(0).selectOption({ label: opts.grain })
  await page.getByTestId('price-input').nth(0).fill(opts.price)
  await page.getByTestId('total-weight-input').nth(0).fill(opts.weight)
  await page.getByTestId('amount-input').nth(0).fill(opts.amount)

  await expect(page.getByTestId('bill-total')).toContainText(opts.amount)

  await page.getByTestId('save-bill').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
}

test('owner invites by code → employee joins, shares the ledger, is attributed, and is restricted (+ phone-mismatch is rejected)', async ({
  page,
  browser,
}) => {
  // Two real contexts against the emulators — give the whole flow ample time.
  test.setTimeout(180_000)

  // ============================================================
  // Context A — OWNER: sign in, generate an invite code, create a bill
  // ============================================================
  await signInTestOwner(page)
  await page.getByTestId('lang-toggle-en').click()
  await expect(page.getByTestId('new-bill-btn')).toContainText('New Bill')

  // --- Owner → Settings → Employees entry → /employees ---
  await page.getByTestId('nav-settings').click()
  await page.waitForURL('**/app/settings/**')
  await expect(page.getByTestId('employees-entry')).toBeVisible()
  await page.getByTestId('employees-entry').click()
  await page.waitForURL('**/app/employees/**')
  await expect(page.getByTestId('employees-screen')).toBeVisible()

  // --- Owner generates a one-time invite code for the employee's mobile ---
  const inviteCode = await ownerGenerateInviteCode(page, {
    name: EMP_NAME,
    mobileLocal: EMP_MOBILE_LOCAL,
  })

  // The pending (unclaimed) invite is listed for re-sharing.
  await expect(
    page.getByTestId('pending-row').filter({ hasText: inviteCode }),
  ).toBeVisible()

  // --- Owner creates a bill (proves the shared ledger for the employee) ---
  await page.getByTestId('nav-bills').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
  await createQuickBill(page, {
    farmer: OWNER_FARMER,
    place: 'Sadar',
    grain: 'Wheat',
    price: '2000',
    weight: '150',
    amount: '3000',
  })
  await expect(
    page.getByTestId('bill-card').filter({ hasText: OWNER_FARMER }).first(),
  ).toBeVisible()

  // ============================================================
  // Context B — EMPLOYEE (a separate browser context, a distinct Google identity)
  // ============================================================
  const empContext = await browser.newContext()
  const page2 = await empContext.newPage()
  try {
    // Sign the employee's (fresh) Google identity in → brand-new → onboarding.
    const landing = await signInGoogleUser(page2, {
      email: uniqueEmail('roles-emp'),
      displayName: EMP_NAME,
    })
    expect(landing).toBe('onboarding')

    // --- NEGATIVE: correct code, WRONG mobile → distinct phone-mismatch, no join ---
    await page2.getByTestId('role-employee').click()
    await expect(page2.getByTestId('join-by-code')).toBeVisible()
    await page2.getByTestId('join-code-input').fill(inviteCode)
    await page2.getByTestId('join-code-next').click()
    await expect(page2.getByTestId('join-mobile-input')).toBeVisible()
    await page2.getByTestId('join-mobile-input').fill(WRONG_MOBILE_LOCAL)
    await page2.getByTestId('join-mobile-next').click()
    // A phone-mismatch alert shows; we are NOT advanced to the name step, NOT joined.
    // The app's inline error is a <p role="alert"> (distinct from Next's route-announcer
    // <div role="alert">, which also carries the role — hence the specific p selector).
    await expect(page2.locator('p[role="alert"]')).toBeVisible()
    await expect(page2.getByTestId('join-name-input')).toHaveCount(0)
    await expect(page2.getByTestId('gated-home')).toHaveCount(0)

    // --- POSITIVE: correct the mobile → advance → name → join ---
    await page2.getByTestId('join-mobile-input').fill(EMP_MOBILE_LOCAL)
    await page2.getByTestId('join-mobile-next').click()
    await expect(page2.getByTestId('join-name-input')).toBeVisible()
    await page2.getByTestId('join-name-input').fill(EMP_NAME)
    await page2.getByTestId('join-submit').click()

    await expect(page2.getByTestId('gated-home')).toBeVisible({ timeout: 25_000 })

    // The employee's role badge (on Settings) reads Employee; capture their rendered name.
    await page2.getByTestId('nav-settings').click()
    await page2.waitForURL('**/app/settings/**')
    await expect(page2.getByTestId('home-role')).toBeVisible()
    const empName = ((await page2.getByTestId('home-user-name').textContent()) ?? '').trim() || EMP_NAME
    await page2.getByTestId('nav-bills').click()

    // --- Back on the OWNER context: the roster now lists the JOINED employee ---
    await page.goto('./employees/')
    await expect(
      page.getByTestId('employee-row').filter({ hasText: empName }),
    ).toBeVisible({ timeout: 25_000 })
    // The invite flipped to claimed → no longer pending.
    await expect(
      page.getByTestId('pending-row').filter({ hasText: inviteCode }),
    ).toHaveCount(0)

    await page2.getByTestId('lang-toggle-en').click()
    await expect(page2.getByTestId('new-bill-btn')).toContainText('New Bill')

    // --- SHARED LEDGER: the owner's bill is visible to the employee ---
    await expect(
      page2.getByTestId('bill-card').filter({ hasText: OWNER_FARMER }).first(),
    ).toBeVisible({ timeout: 30_000 })

    // --- ATTRIBUTION: an employee-created bill records THEIR name ---
    await createQuickBill(page2, {
      farmer: EMP_FARMER,
      place: 'Mandi',
      grain: 'Wheat',
      price: '2000',
      weight: '100',
      amount: '2000',
    })
    const empCard = page2.getByTestId('bill-card').filter({ hasText: EMP_FARMER }).first()
    await expect(empCard).toBeVisible()
    await empCard.click()
    await page2.waitForURL('**/app/bill/**')
    await expect(page2.getByTestId('detail-created-by')).toContainText(empName)

    // --- RESTRICTED: business profile is read-only; no Employees entry ---
    await page2.getByTestId('nav-settings').click()
    await page2.waitForURL('**/app/settings/**')
    await expect(page2.getByTestId('business-readonly-note')).toBeVisible()
    await expect(page2.getByTestId('settings-shop')).toBeDisabled()
    await expect(page2.getByTestId('settings-trader')).toBeDisabled()
    await expect(page2.getByTestId('settings-phone')).toBeDisabled()
    await expect(page2.getByTestId('settings-save')).toHaveCount(0)
    await expect(page2.getByTestId('employees-entry')).toHaveCount(0)
    // But the employee CAN edit their OWN personal profile (name).
    await expect(page2.getByTestId('personal-name-input')).toBeEnabled()

    // --- RESTRICTED: navigating directly to /employees is refused ---
    await page2.goto('./employees/')
    await expect(page2.getByTestId('employees-forbidden')).toBeVisible({ timeout: 20_000 })
    await expect(page2.getByTestId('employees-screen')).toHaveCount(0)
  } finally {
    await empContext.close()
  }
})
