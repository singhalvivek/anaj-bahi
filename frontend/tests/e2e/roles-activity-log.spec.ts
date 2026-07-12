import { test, expect, type Page } from '@playwright/test'
import { signInTestOwner, signInTestEmployee, TEST_EMPLOYEE_PHONE } from './support/auth'

/**
 * Phase-9 activity-log E2E — two REAL signed-in contexts against real Firebase Auth +
 * Cloud Firestore, proving the per-action attribution feed end to end:
 *   owner and employee each create a bill in the SHARED ledger → BOTH actions land in
 *   the owner-only activity log, each ATTRIBUTED to the actor who did it → the employee
 *   is RESTRICTED from the log (no Settings entry AND the `/activity` route refuses them,
 *   the owner-only Rules denying their listen → fail-safe empty).
 *
 * ⚠️ REQUIRES the two registered Firebase test numbers already configured (owner
 *    `+919352277260` / `000000`, employee `+919000000002` / `222222`) and the
 *    already-PUBLISHED `firestore.rules` (activity reads are owner-only). No new
 *    Firebase-console steps are needed to run this spec.
 *
 * global-setup resets BOTH test users' Firestore footprints, so the invite +
 * onboarding round-trip runs fresh each run. This spec is also robust to running in
 * the full suite (owner already has a business; employee may already be a member) —
 * it identifies its own rows by distinctive farmer names and asserts attribution
 * against the employee's own rendered display name.
 */

const OWNER_FARMER = 'ActOwner Ram'
const EMP_FARMER = 'ActEmp Shyam'
const EMP_NAME = 'Act Employee'

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
  // Two real contexts + real network (including cross-context activity sync) — give
  // the whole flow ample time.
  test.setTimeout(180_000)

  // ============================================================
  // Context A — OWNER: create a bill + invite the employee
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
    page.getByTestId('bill-card').filter({ hasText: OWNER_FARMER }),
  ).toBeVisible()

  // --- Owner → Settings → Employees entry → /employees, add the employee ---
  await page.getByTestId('nav-settings').click()
  await page.waitForURL('**/app/settings/**')
  await expect(page.getByTestId('employees-entry')).toBeVisible()
  await page.getByTestId('employees-entry').click()
  await page.waitForURL('**/app/employees/**')
  await expect(page.getByTestId('employees-screen')).toBeVisible()

  await page.getByTestId('employee-phone-input').fill(TEST_EMPLOYEE_PHONE)
  await page.getByTestId('employee-name-input').fill(EMP_NAME)
  await page.getByTestId('add-employee-btn').click()
  // The invite write reaches the server. In a full-suite run the employee may already
  // be a member (a benign "already belongs to a business" notice) — we do NOT assert
  // on the add result here; Context B reaching 'joined' below is the real proof the
  // invite exists.
  await page.waitForTimeout(1200)

  // ============================================================
  // Context B — EMPLOYEE (a separate browser context)
  // ============================================================
  const empContext = await browser.newContext()
  const page2 = await empContext.newPage()
  try {
    // Employee signs in → onboarding as Employee → the owner's invite is found →
    // membership claimed → gated home.
    const outcome = await signInTestEmployee(page2, { name: EMP_NAME })
    expect(outcome).toBe('joined')
    await expect(page2.getByTestId('gated-home')).toBeVisible()

    // The employee's OWN rendered display name (now on the Settings screen) —
    // attribution snapshots the actor's name at action time, so we assert the
    // activity row against exactly this. (In a fresh reset this is EMP_NAME; in a
    // full-suite run it is the employee's persisted name — reading it here keeps the
    // attribution assertion truthful either way.)
    await page2.getByTestId('nav-settings').click()
    await page2.waitForURL('**/app/settings/**')
    const empDisplayName = (await page2.getByTestId('home-user-name').innerText()).trim()
    expect(empDisplayName.length).toBeGreaterThan(0)
    await page2.getByTestId('nav-bills').click()

    await page2.getByTestId('lang-toggle-en').click()
    await expect(page2.getByTestId('new-bill-btn')).toContainText('New Bill')

    // --- SHARED LEDGER: the owner's bill is visible to the employee ---
    await expect(
      page2.getByTestId('bill-card').filter({ hasText: OWNER_FARMER }),
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
      page2.getByTestId('bill-card').filter({ hasText: EMP_FARMER }),
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
      page.getByTestId('activity-row').filter({ hasText: OWNER_FARMER }),
    ).toBeVisible({ timeout: 40_000 })

    // The employee's bill-create row — identified by its distinctive farmer summary
    // AND attributed to the employee's name (the row shows both). Generous timeout:
    // this entry syncs from Context B over the network.
    const empRow = page.getByTestId('activity-row').filter({ hasText: EMP_FARMER })
    await expect(empRow).toBeVisible({ timeout: 40_000 })
    await expect(empRow).toContainText(empDisplayName)

    // At least the two actions above are present in the feed.
    expect(await page.getByTestId('activity-row').count()).toBeGreaterThanOrEqual(2)

    // ============================================================
    // Context B — EMPLOYEE is RESTRICTED from the activity log
    // ============================================================
    // No Settings entry for employees (the UI gate).
    await page2.getByTestId('nav-settings').click()
    await page2.waitForURL('**/app/settings/**')
    await expect(page2.getByTestId('activity-entry')).toHaveCount(0)

    // Navigating directly to /activity is refused — the friendly UI notice shows and
    // the feed never renders. The owner-only Rules also deny the employee's listen, so
    // even a bypassed UI would fail-safe to empty.
    await page2.goto('./activity/')
    await expect(page2.getByTestId('activity-forbidden')).toBeVisible({ timeout: 20_000 })
    await expect(page2.getByTestId('activity-log')).toHaveCount(0)
  } finally {
    await empContext.close()
  }
})
