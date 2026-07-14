import { test, expect, type Page } from '@playwright/test'
import {
  signInTestOwner,
  signInGoogleUser,
  ownerGenerateInviteCode,
  employeeJoinByCode,
  uniqueEmail,
} from './support/auth'

/**
 * Phase-9 activity-log E2E — two REAL Google identities against the Firebase Auth +
 * Firestore EMULATORS, proving the per-action attribution feed end to end:
 *   owner and employee each create a bill in the SHARED ledger → BOTH actions land in
 *   the owner-only activity log, each ATTRIBUTED to the actor who did it → the employee
 *   is RESTRICTED from the log (no Settings entry AND the `/activity` route refuses
 *   them, the owner-only Rules denying their listen → fail-safe empty).
 *
 * Fully deterministic on the emulators (no real Google account, no SMS, no billing).
 * The published `firestore.rules` (activity reads owner-only) are enforced by the
 * Firestore emulator, so the restriction is real, not a client-only gate.
 */

// This spec's employee mobile (distinct from other specs). The employee EMAIL is
// generated fresh per test invocation (see `uniqueEmail` in the test) so a retry
// always onboards a brand-new identity rather than an already-joined one.
const EMP_NAME = 'Act Employee'
const EMP_MOBILE_LOCAL = '9000000022'

const OWNER_FARMER = 'ActOwner Ram'
const EMP_FARMER = 'ActEmp Shyam'

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

test('activity log records both owner and employee bill-creates, attributed; employee is restricted', async ({
  page,
  browser,
}) => {
  // Two real contexts + cross-context activity sync — give the whole flow ample time.
  test.setTimeout(180_000)

  // ============================================================
  // Context A — OWNER: create a bill + generate an invite code
  // ============================================================
  await signInTestOwner(page)
  await page.getByTestId('lang-toggle-en').click()
  await expect(page.getByTestId('new-bill-btn')).toContainText('New Bill')

  // --- Owner creates a bill (their own action, attributed to them) ---
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

  // --- Owner → Settings → Employees entry → /employees, generate the invite code ---
  await page.getByTestId('nav-settings').click()
  await page.waitForURL('**/app/settings/**')
  await expect(page.getByTestId('employees-entry')).toBeVisible()
  await page.getByTestId('employees-entry').click()
  await page.waitForURL('**/app/employees/**')
  await expect(page.getByTestId('employees-screen')).toBeVisible()

  const inviteCode = await ownerGenerateInviteCode(page, {
    mobileLocal: EMP_MOBILE_LOCAL,
  })

  // ============================================================
  // Context B — EMPLOYEE (a separate browser context, a distinct Google identity)
  // ============================================================
  const empContext = await browser.newContext()
  const page2 = await empContext.newPage()
  try {
    // Sign in (fresh identity) → onboarding → Employee → redeem the code → joined.
    const landing = await signInGoogleUser(page2, {
      email: uniqueEmail('act-emp'),
      displayName: EMP_NAME,
    })
    expect(landing).toBe('onboarding')
    await employeeJoinByCode(page2, {
      code: inviteCode,
      mobileLocal: EMP_MOBILE_LOCAL,
      name: EMP_NAME,
    })
    await expect(page2.getByTestId('gated-home')).toBeVisible({ timeout: 25_000 })

    // The employee's OWN rendered display name (attribution snapshots the actor).
    await page2.getByTestId('nav-settings').click()
    await page2.waitForURL('**/app/settings/**')
    const empDisplayName = (await page2.getByTestId('home-user-name').innerText()).trim()
    expect(empDisplayName.length).toBeGreaterThan(0)
    await page2.getByTestId('nav-bills').click()

    await page2.getByTestId('lang-toggle-en').click()
    await expect(page2.getByTestId('new-bill-btn')).toContainText('New Bill')

    // --- SHARED LEDGER: the owner's bill is visible to the employee ---
    await expect(
      page2.getByTestId('bill-card').filter({ hasText: OWNER_FARMER }).first(),
    ).toBeVisible({ timeout: 30_000 })

    // --- Employee creates a bill (their own action, attributed to them) ---
    await createQuickBill(page2, {
      farmer: EMP_FARMER,
      place: 'Mandi',
      grain: 'Wheat',
      price: '2000',
      weight: '100',
      amount: '2000',
    })
    await expect(
      page2.getByTestId('bill-card').filter({ hasText: EMP_FARMER }).first(),
    ).toBeVisible()

    // ============================================================
    // Context A — OWNER opens the activity log: BOTH actions, attributed
    // ============================================================
    await page.goto('./settings/')
    await expect(page.getByTestId('activity-entry')).toBeVisible()
    await page.getByTestId('activity-entry').click()
    await page.waitForURL('**/app/activity/**')
    await expect(page.getByTestId('activity-screen')).toBeVisible()

    // The owner's own bill-create row (the farmer name is carried in the summary).
    await expect(
      page.getByTestId('activity-row').filter({ hasText: OWNER_FARMER }).first(),
    ).toBeVisible({ timeout: 40_000 })

    // The employee's bill-create row — identified by its distinctive farmer summary
    // AND attributed to the employee's name. Generous timeout: it syncs from Context B.
    const empRow = page.getByTestId('activity-row').filter({ hasText: EMP_FARMER }).first()
    await expect(empRow).toBeVisible({ timeout: 40_000 })
    await expect(empRow).toContainText(empDisplayName)

    expect(await page.getByTestId('activity-row').count()).toBeGreaterThanOrEqual(2)

    // ============================================================
    // Context B — EMPLOYEE is RESTRICTED from the activity log
    // ============================================================
    await page2.getByTestId('nav-settings').click()
    await page2.waitForURL('**/app/settings/**')
    await expect(page2.getByTestId('activity-entry')).toHaveCount(0)

    await page2.goto('./activity/')
    await expect(page2.getByTestId('activity-forbidden')).toBeVisible({ timeout: 20_000 })
    await expect(page2.getByTestId('activity-log')).toHaveCount(0)
  } finally {
    await empContext.close()
  }
})
