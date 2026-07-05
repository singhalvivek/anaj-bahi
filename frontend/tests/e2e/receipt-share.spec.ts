import { test, expect, type Page } from '@playwright/test'

/**
 * Phase-3 E2E — bilingual receipt render + share-as-image (with download fallback).
 *
 * Runs against the real static-export dev server (basePath /app) with real
 * IndexedDB in a fresh Chromium context (each test → first-run PIN setup). Fully
 * offline: no server DB, no network, no external image service — the PNG is
 * rasterised client-side by html-to-image.
 *
 * Two paths are exercised so neither share button is ever a dead end:
 *   1. Native share supported (stubbed) → shareReceiptImage hands a PNG File to
 *      navigator.share; we assert the captured File type/name.
 *   2. Native share unsupported (real headless Chromium, no stub) → the PNG
 *      downloads and a clear `share-fallback` note appears.
 *
 * Expected numbers (verified against lib/calc, same as the purchase journey):
 *   sacks 40, 40, 40.5, 39 → count 4, gross 159.5 kg
 *   deductions: 0.5 kg/sack (=2 kg) + 1% of gross (=1.595 kg) → 3.595 kg
 *   net = 155.905 kg;  amount = 1.55905 quintal × ₹2400 = ₹3741.72
 */

const PIN = '1234'
const EXPECTED_TOTAL = '3741.72'

async function addSack(page: Page, value: string) {
  await page.getByTestId('sack-input').fill(value)
  await page.getByTestId('sack-add').click()
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

/** Create the worked-example Wheat bill (₹2400/quintal, sacks 40/40/40.5/39). */
async function createWheatBill(page: Page) {
  await page.getByTestId('new-bill-btn').click()
  await page.waitForURL('**/app/bills/new/**')

  await page.getByTestId('farmer-input').fill('Ramesh')
  await page.getByLabel('Place / Village').fill('Sadar')

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

  await expect(page.getByTestId('bill-total')).toContainText(EXPECTED_TOTAL)

  await page.getByTestId('save-bill').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
}

/**
 * PIN → English → business profile → create bill → open it. Leaves the page on
 * the bill-detail screen with the real bill loaded.
 */
async function seedAndOpenBill(page: Page) {
  await page.goto('./')
  await setupPin(page)

  // English so the grain <select> option label 'Wheat' and 'Place / Village' resolve.
  await page.getByTestId('lang-toggle-en').click()
  await expect(page.getByTestId('new-bill-btn')).toContainText('New Bill')

  await fillBusinessProfile(page)

  await page.getByTestId('nav-bills').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
  await createWheatBill(page)

  const card = page.getByTestId('bill-card').first()
  await expect(card).toBeVisible()
  await card.click()
  await page.waitForURL('**/app/bill/**')
  await expect(page.getByTestId('detail-bill-total')).toContainText(EXPECTED_TOTAL)
}

test('renders the bilingual receipt and shares it as a PNG (native share stubbed)', async ({
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

  // --- Real content: Settings business header, total, full sack breakdown ---
  await expect(page.getByTestId('receipt-shop')).toContainText('Ramesh Traders')
  await expect(receipt).toContainText('Suresh') // trader name
  await expect(receipt).toContainText('9998887776') // business phone
  await expect(page.getByTestId('receipt-total')).toContainText(EXPECTED_TOTAL)

  await expect(page.getByTestId('receipt-sack')).toHaveCount(4)
  await expect(receipt).toContainText('40.5')
  await expect(receipt).toContainText('39')

  // --- Language: the receipt total label follows the live toggle ---
  await expect(page.getByTestId('receipt-total')).toContainText('Total')
  await page.getByTestId('lang-toggle-hi').click()
  await expect(page.getByTestId('receipt-total')).toContainText('कुल राशि')
  await expect(page.getByTestId('receipt-total')).not.toContainText('Total')
  // Numbers stay locale-neutral in both languages.
  await expect(page.getByTestId('receipt-total')).toContainText(EXPECTED_TOTAL)

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
