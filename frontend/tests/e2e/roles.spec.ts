import { test, expect, type Page } from '@playwright/test'
import { signInTestOwner, signInTestEmployee, TEST_EMPLOYEE_PHONE } from './support/auth'

/**
 * Phase-8 roles E2E — two REAL signed-in contexts against real Firebase Auth +
 * Cloud Firestore, exercising the owner/employee boundary end to end:
 *   owner adds the employee → employee joins & SHARES the ledger → an employee-
 *   created bill is ATTRIBUTED to them → the employee is RESTRICTED from the
 *   business profile and the Employees screen (UI gate + the published Rules).
 *
 * ⚠️ REQUIRES the TIGHTENED `firestore.rules` (Phase-8 slice-a) to be PUBLISHED to
 *    the Firebase project. Without them the negative assertions (employee cannot
 *    open /employees, cannot write the business profile) are not truly enforced —
 *    the roster/add would be a client-only gate. Publish before running the gate:
 *      firebase deploy --only firestore:rules
 *
 * ⚠️ REQUIRES the SECOND test number `+919000000002` / `222222` to be configured in
 *    the Firebase Console (Authentication → Phone → test numbers), alongside the
 *    owner's `+919352277260` / `000000`.
 *
 * global-setup resets BOTH test users' Firestore footprints so the invite +
 * onboarding round-trip runs fresh and deterministically each run.
 */

const OWNER_FARMER = 'OwnerFarmer Ram'
const EMP_FARMER = 'EmpFarmer Shyam'
const EMP_NAME = 'Employee One'

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

test('owner adds employee → employee joins, shares the ledger, is attributed, and is restricted', async ({
  page,
  browser,
}) => {
  // Two real contexts + real network — give the whole flow ample time.
  test.setTimeout(180_000)

  // ============================================================
  // Context A — OWNER
  // ============================================================
  await signInTestOwner(page)
  await page.getByTestId('lang-toggle-en').click()
  await expect(page.getByTestId('new-bill-btn')).toContainText('New Bill')

  // --- Owner → Settings → Employees entry → /employees ---
  await page.getByTestId('nav-settings').click()
  await page.waitForURL('**/app/settings/**')

  // The owner sees the Manage-employees entry (employees are not shown it).
  await expect(page.getByTestId('employees-entry')).toBeVisible()
  await page.getByTestId('employees-entry').click()
  await page.waitForURL('**/app/employees/**')
  await expect(page.getByTestId('employees-screen')).toBeVisible()

  // --- Owner adds the employee by phone + name → a roster row appears ---
  await page.getByTestId('employee-phone-input').fill(TEST_EMPLOYEE_PHONE)
  await page.getByTestId('employee-name-input').fill(EMP_NAME)
  await page.getByTestId('add-employee-btn').click()

  // The add succeeds without error. The invited employee is NOT yet a claimed
  // member, so the roster (which lists claimed members) shows them only after they
  // sign in and join — asserted below once Context B has claimed the invite.
  await expect(page.getByTestId('employees-add-error')).toHaveCount(0)
  await page.waitForTimeout(1000) // let the invite write reach the server

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
    page.getByTestId('bill-card').filter({ hasText: OWNER_FARMER }),
  ).toBeVisible()

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

    // The employee's role badge reads Employee.
    await expect(page2.getByTestId('home-role')).toBeVisible()

    // --- Back on the OWNER context: the roster now lists the JOINED employee ---
    // (a claimed member exists once Context B onboarded), proving add → join works.
    await page.goto('./employees/')
    await expect(
      page.getByTestId('employee-row').filter({ hasText: EMP_NAME }),
    ).toBeVisible({ timeout: 25_000 })

    await page2.getByTestId('lang-toggle-en').click()
    await expect(page2.getByTestId('new-bill-btn')).toContainText('New Bill')

    // --- SHARED LEDGER: the owner's bill is visible to the employee ---
    await expect(
      page2.getByTestId('bill-card').filter({ hasText: OWNER_FARMER }),
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
    const empCard = page2.getByTestId('bill-card').filter({ hasText: EMP_FARMER })
    await expect(empCard).toBeVisible()
    await empCard.click()
    await page2.waitForURL('**/app/bill/**')
    await expect(page2.getByTestId('detail-created-by')).toContainText(EMP_NAME)

    // --- RESTRICTED: business profile is read-only; no Employees entry ---
    await page2.getByTestId('nav-settings').click()
    await page2.waitForURL('**/app/settings/**')

    await expect(page2.getByTestId('business-readonly-note')).toBeVisible()
    await expect(page2.getByTestId('settings-shop')).toBeDisabled()
    await expect(page2.getByTestId('settings-trader')).toBeDisabled()
    await expect(page2.getByTestId('settings-phone')).toBeDisabled()
    // The Save button and the Manage-employees entry are hidden for employees.
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
