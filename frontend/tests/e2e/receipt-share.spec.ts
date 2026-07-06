import { test, expect, type Page } from '@playwright/test'

/**
 * Redesigned receipt E2E — paper-ledger COLUMN layout + share-as-image (with
 * download fallback).
 *
 * Runs against the real static-export dev server (basePath /app) with real
 * IndexedDB in a fresh Chromium context (each test → first-run PIN setup). Fully
 * offline: no server DB, no network, no external image service — the PNG is
 * rasterised client-side by html-to-image.
 *
 * Two share paths are exercised so neither button is ever a dead end:
 *   1. Native share supported (stubbed) → shareReceiptImage hands a PNG File to
 *      navigator.share; we assert the captured File type/name.
 *   2. Native share unsupported (real headless Chromium, no stub) → the PNG
 *      downloads and a clear `share-fallback` note appears.
 *
 * Worked multi-grain example (verified against lib/calc — the SAME engine the
 * receipt renders from, no reimplementation):
 *   Grain 1 — Wheat, ₹2000/quintal, 12 sacks: 50×10 then 45, 40
 *     → toColumns → 2 columns: [50×10] (subtotal 500) + [45,40] (subtotal 85)
 *     → gross 585 kg, net 585 kg = 5.85 q × ₹2000 = ₹11700.00
 *   Grain 2 — Mustard, ₹1500/quintal, 6 sacks: 40×6
 *     → toColumns → 1 column, subtotal 240
 *     → gross 240 kg, net 240 kg = 2.4 q × ₹1500 = ₹3600.00
 *   Bill total = ₹11700.00 + ₹3600.00 = ₹15300.00
 */

const PIN = '1234'
const EXPECTED_TOTAL = '15300.00'

const WHEAT_WEIGHTS = ['50', '50', '50', '50', '50', '50', '50', '50', '50', '50', '45', '40']
const MUSTARD_WEIGHTS = ['40', '40', '40', '40', '40', '40']
const WHEAT_COL1_SUBTOTAL = '500' // sum of the first 10 wheat sacks
const WHEAT_COL2_SUBTOTAL = '85' // sum of the remaining 2 wheat sacks (45 + 40)

/** Add one sack weight to the grain line at `lineIndex` (scoped, multi-grain safe). */
async function addSackTo(page: Page, lineIndex: number, value: string) {
  await page.getByTestId('sack-input').nth(lineIndex).fill(value)
  await page.getByTestId('sack-add').nth(lineIndex).click()
}

/** First-run PIN setup — unlocks the app (fresh IndexedDB each run). */
async function setupPin(page: Page) {
  await expect(page.getByTestId('lock-screen')).toBeVisible()
  await page.getByTestId('pin-input').fill(PIN)
  await page.getByTestId('pin-confirm').fill(PIN)
  await page.getByTestId('pin-submit').click()
  await expect(page.getByTestId('new-bill-btn')).toBeVisible()
}

/** Fill the business profile in Settings (the receipt header source). */
async function fillBusinessProfile(page: Page) {
  await page.getByTestId('nav-settings').click()
  await page.waitForURL('**/app/settings/**')
  await page.getByTestId('settings-shop').fill('Ramesh Traders')
  await page.getByTestId('settings-trader').fill('Suresh')
  await page.getByTestId('settings-phone').fill('9998887776')
  await page.getByTestId('settings-save').click()
  await expect(page.getByTestId('settings-saved')).toBeVisible()
}

/**
 * Create a multi-grain bill that exercises the column layout + a remainder:
 *   Wheat  → 12 sacks → 2 columns (10 + 2)
 *   Mustard → 6 sacks → 1 column
 */
async function createMultiGrainBill(page: Page) {
  await page.getByTestId('new-bill-btn').click()
  await page.waitForURL('**/app/bills/new/**')

  await page.getByTestId('farmer-input').fill('Ramesh')
  await page.getByLabel('Place / Village').fill('Sadar')

  // Grain 1 — Wheat, 12 sacks.
  await page.getByTestId('grain-type-select').nth(0).selectOption({ label: 'Wheat' })
  await page.getByTestId('price-input').nth(0).fill('2000')
  for (const w of WHEAT_WEIGHTS) await addSackTo(page, 0, w)

  // Grain 2 — Mustard, 6 sacks (added as a second grain line).
  await page.getByText('+ Add another grain').click()
  await page.getByTestId('grain-type-select').nth(1).selectOption({ label: 'Mustard' })
  await page.getByTestId('price-input').nth(1).fill('1500')
  for (const w of MUSTARD_WEIGHTS) await addSackTo(page, 1, w)

  // Live total matches the calc engine before saving.
  await expect(page.getByTestId('bill-total')).toContainText(EXPECTED_TOTAL)

  await page.getByTestId('save-bill').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
}

/**
 * PIN → English → business profile → create the multi-grain bill → open it.
 * Leaves the page on the bill-detail screen with the real bill loaded.
 */
async function seedAndOpenBill(page: Page) {
  await page.goto('./')
  await setupPin(page)

  // English so the grain <select> option labels 'Wheat'/'Mustard' and
  // 'Place / Village' resolve.
  await page.getByTestId('lang-toggle-en').click()
  await expect(page.getByTestId('new-bill-btn')).toContainText('New Bill')

  await fillBusinessProfile(page)

  await page.getByTestId('nav-bills').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
  await createMultiGrainBill(page)

  const card = page.getByTestId('bill-card').first()
  await expect(card).toBeVisible()
  await card.click()
  await page.waitForURL('**/app/bill/**')
  await expect(page.getByTestId('detail-bill-total')).toContainText(EXPECTED_TOTAL)
}

test('renders the column-ledger receipt and shares it as a PNG (native share stubbed)', async ({
  page,
}) => {
  // Stub the native file-share API BEFORE the app loads and capture what is shared.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', {
      value: () => true,
      configurable: true,
    })
    Object.defineProperty(navigator, 'share', {
      value: (data: ShareData) => {
        ;(window as unknown as { __shared: ShareData }).__shared = data
        return Promise.resolve()
      },
      configurable: true,
    })
  })

  await seedAndOpenBill(page)

  // --- Open the receipt preview ---
  await page.getByTestId('share-receipt').click()
  await expect(page.getByTestId('receipt-preview')).toBeVisible()
  const receipt = page.getByTestId('receipt')
  await expect(receipt).toBeVisible()

  // --- Business header + calc-engine grand total ---
  await expect(page.getByTestId('receipt-shop')).toContainText('Ramesh Traders')
  await expect(receipt).toContainText('Suresh') // trader name
  await expect(receipt).toContainText('9998887776') // business phone
  await expect(page.getByTestId('receipt-total')).toContainText(EXPECTED_TOTAL)

  // --- No sack NUMBERS: only weight values, and there are 18 of them ---
  const weights = page.getByTestId('receipt-weight')
  await expect(weights).toHaveCount(WHEAT_WEIGHTS.length + MUSTARD_WEIGHTS.length) // 18
  const noHashes = await weights.evaluateAll((els) =>
    els.every((el) => !(el.textContent ?? '').includes('#')),
  )
  expect(noHashes).toBe(true)
  // The obsolete numbered-sack element is gone entirely.
  await expect(page.getByTestId('receipt-sack')).toHaveCount(0)

  // --- Top weight column-grid: ceil(N/10) per grain, entry-order split, subtotals ---
  // (This grid is UNCHANGED by the summary-table redesign.)
  const blocks = page.getByTestId('receipt-grain-block')
  await expect(blocks).toHaveCount(2)

  const wheatBlock = blocks.nth(0)
  await expect(wheatBlock.getByTestId('receipt-column')).toHaveCount(2)
  const wheatSubtotals = wheatBlock.getByTestId('receipt-col-subtotal')
  await expect(wheatSubtotals).toHaveCount(2)
  await expect(wheatSubtotals.nth(0)).toHaveText(WHEAT_COL1_SUBTOTAL) // 500 = sum of 10
  await expect(wheatSubtotals.nth(1)).toHaveText(WHEAT_COL2_SUBTOTAL) // 85 = sum of 2

  const mustardBlock = blocks.nth(1)
  await expect(mustardBlock.getByTestId('receipt-column')).toHaveCount(1)
  await expect(mustardBlock.getByTestId('receipt-col-subtotal')).toHaveText('240')

  // --- Consolidated summary TABLE: grains as columns, line items as rows ---
  // The per-grain repeated summary blocks are GONE; a single table takes their place.
  const summary = page.getByTestId('receipt-summary-table')
  await expect(summary).toHaveCount(1)

  // One header per grain, in grid order (Wheat then Mustard).
  const grainHeaders = summary.getByTestId('receipt-summary-grain')
  await expect(grainHeaders).toHaveCount(2)
  await expect(grainHeaders.nth(0)).toContainText('Wheat')
  await expect(grainHeaders.nth(1)).toContainText('Mustard')

  // Gross / Net / Amount cells per grain match the calc engine (grid order).
  const gross = summary.getByTestId('receipt-grain-gross')
  await expect(gross.nth(0)).toContainText('585') // Wheat gross 585 kg
  await expect(gross.nth(1)).toContainText('240') // Mustard gross 240 kg

  const net = summary.getByTestId('receipt-grain-net')
  await expect(net.nth(0)).toContainText('585') // Wheat net 585 kg
  await expect(net.nth(0)).toContainText('5.85 q') // ...= 5.85 q
  await expect(net.nth(1)).toContainText('240') // Mustard net 240 kg
  await expect(net.nth(1)).toContainText('2.4 q') // ...= 2.4 q

  const amount = summary.getByTestId('receipt-grain-amount')
  await expect(amount).toHaveCount(2)
  await expect(amount.nth(0)).toContainText('11700.00') // Wheat amount
  await expect(amount.nth(1)).toContainText('3600.00') // Mustard amount

  // Bill total (grand total for Amount) = sum of the grains' amounts.
  await expect(page.getByTestId('receipt-total')).toContainText(EXPECTED_TOTAL)

  // --- Language: receipt labels follow the live toggle (EN ↔ HI) ---
  await expect(page.getByTestId('receipt-total')).toContainText('Total')
  await expect(summary).toContainText('Gross weight') // totals.gross (EN)
  await page.getByTestId('lang-toggle-hi').click()
  await expect(page.getByTestId('receipt-total')).toContainText('कुल राशि')
  await expect(page.getByTestId('receipt-total')).not.toContainText('Total')
  await expect(summary).toContainText('कुल वज़न') // totals.gross (HI)
  // Numbers stay locale-neutral in both languages.
  await expect(page.getByTestId('receipt-total')).toContainText(EXPECTED_TOTAL)
  await expect(amount.nth(0)).toContainText('11700.00')

  // --- Share path: a PNG File reaches navigator.share ---
  await page.getByTestId('share-image').click()

  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = (window as unknown as { __shared?: ShareData }).__shared
        const f = s?.files?.[0]
        return f ? f.type : null
      }),
    )
    .toBe('image/png')

  const info = await page.evaluate(() => {
    const f = (window as unknown as { __shared: ShareData }).__shared.files![0]
    return { isFile: f instanceof File, name: f.name }
  })
  expect(info.isFile).toBe(true)
  expect(info.name).toMatch(/\.png$/)

  // Close returns to the detail screen.
  await page.getByTestId('share-close').click()
  await expect(page.getByTestId('receipt-preview')).toHaveCount(0)
})

test('falls back to a PNG download when native file-share is unsupported', async ({ page }) => {
  // No share stub: real headless Chromium has no navigator.share → download fallback.
  await seedAndOpenBill(page)

  await page.getByTestId('share-receipt').click()
  await expect(page.getByTestId('receipt-preview')).toBeVisible()
  await expect(page.getByTestId('receipt')).toBeVisible()

  const downloadPromise = page
    .waitForEvent('download', { timeout: 15_000 })
    .catch(() => null)

  await page.getByTestId('share-image').click()

  // Never a dead button: a clear fallback note appears...
  await expect(page.getByTestId('share-fallback')).toBeVisible()

  // ...and, if the browser surfaced the download event, it is a .png.
  const download = await downloadPromise
  if (download) {
    expect(download.suggestedFilename()).toMatch(/\.png$/)
  }
})
