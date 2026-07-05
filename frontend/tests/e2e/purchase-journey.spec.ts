import { test, expect, type Page } from '@playwright/test'

/**
 * Golden-path E2E — the roadmap's worked purchase journey.
 *
 * Drives slice-b's New Bill form and slice-c's home/detail/toggle by the exact
 * ui.md data-testids. The whole thing runs against the real static-export dev
 * server (basePath /app) with real IndexedDB in Chromium — no stubs.
 *
 * Expected numbers (verified against lib/calc):
 *   sacks 40, 40, 40.5, 39 → count 4, gross 159.5 kg
 *   deductions: 0.5 kg/sack (=2 kg) + 1% of gross (=1.595 kg) → 3.595 kg
 *   net = 155.905 kg;  amount = 1.55905 quintal × ₹2400 = ₹3741.72
 */

const FARMER_NAME = 'Ramesh'
const FARMER_PLACE = 'Sadar'
const EXPECTED_TOTAL = '3741.72'

async function addSack(page: Page, value: string) {
  await page.getByTestId('sack-input').fill(value)
  await page.getByTestId('sack-add').click()
}

test('trader creates a bill, reopens it, and toggles language', async ({ page }) => {
  // --- Home: switch to English so slice-b's grain/label text is deterministic ---
  await page.goto('./')
  await expect(page.getByTestId('new-bill-btn')).toBeVisible()
  await page.getByTestId('lang-toggle-en').click()
  await expect(page.getByTestId('new-bill-btn')).toContainText('New Bill')

  // --- Step 1: open the New Bill form ---
  await page.getByTestId('new-bill-btn').click()
  await page.waitForURL('**/app/bills/new/**')

  // --- Step 2: add a NEW farmer. Typing an unseen name + a place resolves a new
  //            farmer inline (created at save); there is no separate add button. ---
  await page.getByTestId('farmer-input').fill(FARMER_NAME)
  await page.getByLabel('Place / Village').fill(FARMER_PLACE)

  // --- Step 3: pick Wheat + price ₹2400/quintal ---
  await page.getByTestId('grain-type-select').selectOption({ label: 'Wheat' })
  await page.getByTestId('price-input').fill('2400')

  // --- Step 4: sack-by-sack entry, assert running summary ---
  await addSack(page, '40')
  await addSack(page, '40')
  await addSack(page, '40.5')
  await addSack(page, '39')
  await expect(page.getByTestId('sack-summary')).toContainText('4')
  await expect(page.getByTestId('sack-summary')).toContainText('159.5')
  await expect(page.getByTestId('sack-row')).toHaveCount(4)

  // --- Step 5: two deductions — 0.5 kg per sack, then 1% of gross ---
  await page.getByTestId('add-deduction').click()
  const row0 = page.getByTestId('deduction-row').nth(0)
  await row0.locator('select').selectOption({ label: 'kg per sack' })
  await row0.locator('input').fill('0.5')

  await page.getByTestId('add-deduction').click()
  const row1 = page.getByTestId('deduction-row').nth(1)
  await row1.locator('select').selectOption({ label: '% of gross' })
  await row1.locator('input').fill('1')

  // --- Step 6: live line + bill totals ---
  await expect(page.getByTestId('line-net')).toContainText('155.905')
  await expect(page.getByTestId('line-amount')).toContainText(EXPECTED_TOTAL)
  await expect(page.getByTestId('bill-total')).toContainText(EXPECTED_TOTAL)

  // --- Step 7: save → back on home with the new card ---
  await page.getByTestId('save-bill').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
  const card = page.getByTestId('bill-card').first()
  await expect(card).toBeVisible()
  await expect(card).toContainText(FARMER_NAME)
  await expect(card).toContainText(EXPECTED_TOTAL)

  // --- Step 8: reopen the bill, assert identical data ---
  await card.click()
  await page.waitForURL('**/app/bill/**')
  await expect(page.getByTestId('detail-bill-total')).toContainText(EXPECTED_TOTAL)
  await expect(page.getByTestId('detail-sack-row')).toHaveCount(4)

  // --- Step 9: language toggle switches labels and persists across reload ---
  await page.getByTestId('nav-bills').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
  await expect(page.getByTestId('new-bill-btn')).toContainText('New Bill')
  await page.getByTestId('lang-toggle-hi').click()
  await expect(page.getByTestId('new-bill-btn')).toContainText('नई बही')
  await page.reload()
  await expect(page.getByTestId('new-bill-btn')).toContainText('नई बही')
})
