import { test, expect, type Page } from '@playwright/test'
import { signInTestOwner } from './support/auth'

// Phase 6+: the app now runs behind the auth gate — sign the test owner in first.
test.beforeEach(async ({ page }) => {
  await signInTestOwner(page)
})

/**
 * Quick-entry (summary) bill E2E — the Phase-5 worked journey.
 *
 * From home → the New Bill CHOOSER → the QUICK form → transcribe a 2-grain
 * summary bill (one line with total-sacks + a deduction, the other without) →
 * Save → land on the list → reopen and assert the TOTALS-ONLY detail (no sack
 * column-grid) → open the Share preview and assert the receipt renders.
 *
 * Drives slice-b's chooser + quick form and slice-c's summary detail + receipt by
 * the exact ui.md data-testids. Runs against the real static-export dev server
 * (basePath /app) with real IndexedDB in a fresh Chromium context — no stubs.
 *
 * The entered amounts are AUTHORITATIVE and stored verbatim (never recomputed):
 *   Grain 1 — Wheat,   ₹2000/quintal, total 585 kg, 12 sacks, deduction 5 kg,
 *             entered amount ₹3741.72
 *   Grain 2 — Mustard, ₹1500/quintal, total 240 kg, no sacks / no deduction,
 *             entered amount ₹3360.00
 *   Bill total = Σ entered amounts = ₹3741.72 + ₹3360.00 = ₹7101.72
 * (computeBillTotal sums the entered line amounts — it never derives net × price.)
 */

const FARMER_NAME = 'Girdhari'
const FARMER_PLACE = 'Kheri'

const AMOUNT_1 = '3741.72'
const AMOUNT_2 = '3360' // entered as 3360 → formatted ₹3360.00
const AMOUNT_2_FMT = '3360.00'
const BILL_TOTAL = '7101.72'

/** Fill one quick-entry grain line (scoped by index, multi-grain safe). */
async function fillQuickLine(
  page: Page,
  i: number,
  opts: {
    grain: string
    price: string
    totalWeight: string
    amount: string
    sackCount?: string
    deductionKg?: string
  },
) {
  await page.getByTestId('grain-type-select').nth(i).selectOption({ label: opts.grain })
  await page.getByTestId('price-input').nth(i).fill(opts.price)
  await page.getByTestId('total-weight-input').nth(i).fill(opts.totalWeight)
  await page.getByTestId('amount-input').nth(i).fill(opts.amount)
  if (opts.sackCount != null) {
    await page.getByTestId('sack-count-input').nth(i).fill(opts.sackCount)
  }
  if (opts.deductionKg != null) {
    await page.getByTestId('deduction-kg-input').nth(i).fill(opts.deductionKg)
  }
}

test('trader transcribes a summary bill, reopens the totals-only detail, and shares the receipt', async ({
  page,
}) => {
  // --- The app opens straight to the bill list (no access gate) ---
  await page.goto('./')

  // --- English so grain <select> labels + 'Place / Village' resolve deterministically ---
  await page.getByTestId('lang-toggle-en').click()
  await expect(page.getByTestId('new-bill-btn')).toContainText('New Bill')

  // --- Step 1: + New Bill → the two-option CHOOSER ---
  await page.getByTestId('new-bill-btn').click()
  await page.waitForURL('**/app/bills/choose/**')
  await expect(page.getByTestId('new-bill-choice')).toBeVisible()

  // --- Step 2: choose Quick entry → the summary form ---
  await page.getByTestId('choice-quick').click()
  await page.waitForURL('**/app/bills/quick/**')

  // --- Step 3: farmer (name + place) — purchase date defaults to today ---
  await page.getByTestId('farmer-input').fill(FARMER_NAME)
  await page.getByLabel('Place / Village').fill(FARMER_PLACE)

  // --- Step 4: grain line 1 — WITH total-sacks + a deduction ---
  await fillQuickLine(page, 0, {
    grain: 'Wheat',
    price: '2000',
    totalWeight: '585',
    amount: AMOUNT_1,
    sackCount: '12',
    deductionKg: '5',
  })

  // --- Step 5: add a second grain line — WITHOUT sacks / deduction ---
  await page.getByText('+ Add another grain').click()
  await fillQuickLine(page, 1, {
    grain: 'Mustard',
    price: '1500',
    totalWeight: '240',
    amount: AMOUNT_2,
  })

  // --- Step 6: live bill total = Σ the two entered amounts (not net × price) ---
  await expect(page.getByTestId('bill-total')).toContainText(BILL_TOTAL)

  // --- Step 7: save → back on home with the new card at the sum-of-amounts total ---
  await page.getByTestId('save-bill').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
  const card = page.getByTestId('bill-card').first()
  await expect(card).toBeVisible()
  await expect(card).toContainText(FARMER_NAME)
  await expect(card).toContainText(BILL_TOTAL)

  // --- Step 8: reopen → TOTALS-ONLY detail (no sack column-grid) ---
  await card.click()
  await page.waitForURL('**/app/bill/**')

  // Two summary lines, and NO sack-grid rows at all.
  await expect(page.getByTestId('detail-summary-line')).toHaveCount(2)
  await expect(page.getByTestId('detail-sack-row')).toHaveCount(0)
  await expect(page.getByTestId('detail-sack-list')).toHaveCount(0)

  // The summary figures + the sum-of-amounts bill total.
  const line1 = page.getByTestId('detail-summary-line').nth(0)
  await expect(line1).toContainText('585') // total weight
  await expect(line1).toContainText('12') // total sacks (this line only)
  await expect(line1).toContainText('580') // net = 585 − 5
  await expect(line1).toContainText(AMOUNT_1) // entered amount, verbatim

  const line2 = page.getByTestId('detail-summary-line').nth(1)
  await expect(line2).toContainText('240') // total weight
  await expect(line2).toContainText(AMOUNT_2_FMT) // entered amount, verbatim

  await expect(page.getByTestId('detail-bill-total')).toContainText(BILL_TOTAL)

  // --- Step 9: open the Share preview → receipt renders (summary, no weight grid) ---
  await page.getByTestId('share-receipt').click()
  await expect(page.getByTestId('receipt-preview')).toBeVisible()

  const receipt = page.getByTestId('receipt')
  await expect(receipt).toBeVisible()

  // A summary receipt OMITS the weight column-grid entirely...
  await expect(receipt.getByTestId('receipt-column')).toHaveCount(0)
  await expect(receipt.getByTestId('receipt-weight')).toHaveCount(0)

  // ...but the consolidated summary table + correct grand total still render.
  const summary = page.getByTestId('receipt-summary-table')
  await expect(summary).toBeVisible()
  const grainHeaders = summary.getByTestId('receipt-summary-grain')
  await expect(grainHeaders).toHaveCount(2)
  await expect(grainHeaders.nth(0)).toContainText('Wheat')
  await expect(grainHeaders.nth(1)).toContainText('Mustard')

  const amounts = summary.getByTestId('receipt-grain-amount')
  await expect(amounts.nth(0)).toContainText(AMOUNT_1)
  await expect(amounts.nth(1)).toContainText(AMOUNT_2_FMT)
  await expect(page.getByTestId('receipt-total')).toContainText(BILL_TOTAL)

  await page.getByTestId('share-close').click()
  await expect(page.getByTestId('receipt-preview')).toHaveCount(0)
})

/**
 * Phase 10 — quick form: field reorder is testid/index-agnostic (fillQuickLine still
 * works), the Amount auto-computes from (weight − deduction)/100 × price until edited,
 * and a bill-level Paldari (labour charge) is subtracted from the total end-to-end
 * (live → saved → detail). No stubs — real dev server + real IndexedDB/Firestore-offline.
 */
test('quick bill: amount auto-computes (and is overridable) + paldari nets the total', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByTestId('lang-toggle-en').click()

  await page.getByTestId('new-bill-btn').click()
  await page.waitForURL('**/app/bills/choose/**')
  await page.getByTestId('choice-quick').click()
  await page.waitForURL('**/app/bills/quick/**')

  await page.getByTestId('farmer-input').fill('Paldari Farmer')
  await page.getByLabel('Place / Village').fill('Kheri')

  // --- Auto-compute: fill grain/price/total-weight/deduction, NEVER touch amount ---
  await page.getByTestId('grain-type-select').nth(0).selectOption({ label: 'Wheat' })
  await page.getByTestId('price-input').nth(0).fill('2000')
  await page.getByTestId('total-weight-input').nth(0).fill('585')
  await page.getByTestId('deduction-kg-input').nth(0).fill('5')
  // net = 580 kg → 5.8 quintal × 2000 = ₹11600, computed into the editable Amount field.
  await expect(page.getByTestId('amount-input').nth(0)).toHaveValue('11600')

  // --- Override: once the trader edits Amount by hand it stays authoritative ---
  await page.getByTestId('amount-input').nth(0).fill('11000')
  // Changing deduction afterwards must NOT overwrite the manual amount.
  await page.getByTestId('deduction-kg-input').nth(0).fill('10')
  await expect(page.getByTestId('amount-input').nth(0)).toHaveValue('11000')

  // Live total before paldari = the (overridden) line amount.
  await expect(page.getByTestId('bill-total')).toContainText('11000.00')

  // --- Paldari: bill-level labour charge subtracted from the total ---
  await page.getByTestId('paldari-input').fill('200')
  await expect(page.getByTestId('paldari-line')).toContainText('200.00')
  // net payable = 11000 − 200 = ₹10800.
  await expect(page.getByTestId('bill-total')).toContainText('10800.00')

  // --- Save → reopen → detail shows the net total + the paldari deduction ---
  await page.getByTestId('save-bill').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
  const card = page.getByTestId('bill-card').first()
  await expect(card).toContainText('Paldari Farmer')
  await expect(card).toContainText('10800.00') // home card is net-of-paldari
  await card.click()
  await page.waitForURL('**/app/bill/**')

  await expect(page.getByTestId('detail-bill-total')).toContainText('10800.00')
  await expect(page.getByTestId('detail-paldari')).toContainText('200.00')
})
