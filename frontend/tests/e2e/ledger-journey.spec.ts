import { test, expect, type Page } from '@playwright/test'

/**
 * Phase-2 ledger E2E — payments/edit-lock, due list, and search.
 *
 * Runs against the real static-export dev server (basePath /app) with real IndexedDB
 * in a fresh Chromium context (the app opens straight to the bill list). No stubs.
 *
 * Shared testids driven here that are OWNED BY SLICE-B (payments / due / edit-lock):
 *   due-date-input, outstanding-balance, paid-total, fully-paid, edit-locked,
 *   payment-amount, payment-add, detail-edit, due-overdue, due-row.
 * The search testids are owned by THIS slice (slice-c).
 *
 * Expected numbers (verified against lib/calc, same as the purchase journey):
 *   sacks 40, 40, 40.5, 39 → count 4, gross 159.5 kg
 *   deductions: 0.5 kg/sack (=2 kg) + 1% of gross (=1.595 kg) → 3.595 kg
 *   net = 155.905 kg;  amount = 1.55905 quintal × ₹2400 = ₹3741.72
 */

async function addSack(page: Page, value: string) {
  await page.getByTestId('sack-input').fill(value)
  await page.getByTestId('sack-add').click()
}

/**
 * Create a Wheat bill (₹2400/quintal, sacks 40/40/40.5/39, two deductions → ₹3741.72)
 * for the given farmer, with a due date. Returns on the home screen with the new card.
 */
async function createWheatBill(
  page: Page,
  farmerName: string,
  farmerPlace: string,
  dueDate: string,
) {
  await page.getByTestId('new-bill-btn').click()
  await page.waitForURL('**/app/bills/new/**')

  await page.getByTestId('farmer-input').fill(farmerName)
  await page.getByLabel('Place / Village').fill(farmerPlace)

  await page.getByTestId('grain-type-select').selectOption({ label: 'Wheat' })
  await page.getByTestId('price-input').fill('2400')

  await addSack(page, '40')
  await addSack(page, '40')
  await addSack(page, '40.5')
  await addSack(page, '39')
  await expect(page.getByTestId('sack-row')).toHaveCount(4)

  await page.getByTestId('add-deduction').click()
  const row0 = page.getByTestId('deduction-row').nth(0)
  await row0.locator('select').selectOption({ label: 'kg per sack' })
  await row0.locator('input').fill('0.5')

  await page.getByTestId('add-deduction').click()
  const row1 = page.getByTestId('deduction-row').nth(1)
  await row1.locator('select').selectOption({ label: '% of gross' })
  await row1.locator('input').fill('1')

  await expect(page.getByTestId('bill-total')).toContainText('3741.72')

  // Due date in the past → the bill is overdue while it still owes money.
  await page.getByTestId('due-date-input').fill(dueDate)

  await page.getByTestId('save-bill').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
}

test('trader records payments, tracks dues, and searches', async ({ page }) => {
  // --- Step 1: the app opens straight to the bill list (no access gate) ---
  await page.goto('./')
  await expect(page.getByTestId('new-bill-btn')).toBeVisible()

  // English so grain labels are deterministic.
  await page.getByTestId('lang-toggle-en').click()
  await expect(page.getByTestId('new-bill-btn')).toContainText('New Bill')

  // --- Step 2: create the primary bill (Ramesh) with a past due date ---
  await createWheatBill(page, 'Ramesh', 'Sadar', '2020-01-01')
  const rameshCard = page.getByTestId('bill-card').filter({ hasText: 'Ramesh' }).first()
  await expect(rameshCard).toBeVisible()

  // --- Step 3: open the bill — full balance outstanding, edit still allowed ---
  await rameshCard.click()
  await page.waitForURL('**/app/bill/**')
  await expect(page.getByTestId('outstanding-balance')).toContainText('3741.72')
  await expect(page.getByTestId('detail-edit')).toBeEnabled()

  // --- Step 4: first payment → partial paid, and the bill locks for edits ---
  await page.getByTestId('payment-amount').fill('1741.72')
  await page.getByTestId('payment-add').click()
  await expect(page.getByTestId('paid-total')).toContainText('1741.72')
  await expect(page.getByTestId('outstanding-balance')).toContainText('2000.00')
  await expect(page.getByTestId('edit-locked')).toBeVisible()
  const editBtn = page.getByTestId('detail-edit')
  if ((await editBtn.count()) > 0) {
    await expect(editBtn).toBeDisabled()
  }
  // Payments are still addable after the edit-lock.
  await expect(page.getByTestId('payment-add')).toBeVisible()

  // --- Step 5: second payment clears the balance → fully paid ---
  await page.getByTestId('payment-amount').fill('2000.00')
  await page.getByTestId('payment-add').click()
  await expect(page.getByTestId('outstanding-balance')).toContainText('0.00')
  await expect(page.getByTestId('fully-paid')).toBeVisible()

  // --- Step 6: a SECOND, unpaid, past-due bill appears in the Due list; the
  //            fully-paid Ramesh bill does NOT. (Deterministic two-bill check.) ---
  await page.getByTestId('nav-bills').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
  await createWheatBill(page, 'Suresh', 'Mandi', '2020-02-02')

  await page.getByTestId('nav-due').click()
  await page.waitForURL('**/app/due/**')
  const overdue = page.getByTestId('due-overdue')
  await expect(overdue).toBeVisible()
  await expect(overdue.getByTestId('due-row')).toHaveCount(1)
  await expect(overdue).toContainText('Suresh')
  await expect(overdue).not.toContainText('Ramesh')

  // --- Step 7: search on home ---
  await page.getByTestId('nav-bills').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
  await expect(page.getByTestId('bill-card')).toHaveCount(2)

  await page.getByTestId('search-input').fill('Ramesh')
  await expect(page.getByTestId('bill-card')).toHaveCount(1)
  await expect(page.getByTestId('bill-card').first()).toContainText('Ramesh')

  await page.getByTestId('search-input').fill('Nobody')
  await expect(page.getByTestId('search-no-results')).toBeVisible()

  await page.getByTestId('search-clear').click()
  await expect(page.getByTestId('bill-card')).toHaveCount(2)

  // Filter by grain type → both Wheat bills still match.
  await page.getByTestId('filter-grain').selectOption({ label: 'Wheat' })
  await expect(page.getByTestId('bill-card')).toHaveCount(2)
  await page.getByTestId('search-clear').click()

  // --- Step 8: a full reload persists the ledger (both bills survive) ---
  await page.reload()
  await expect(page.getByTestId('new-bill-btn')).toBeVisible()
  await expect(page.getByTestId('bill-card')).toHaveCount(2)
})
