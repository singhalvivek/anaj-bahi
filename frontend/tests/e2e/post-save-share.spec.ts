import { test, expect, type Page } from '@playwright/test'
import { signInTestOwner } from './support/auth'

/**
 * Phase 11 — post-save share prompt E2E.
 *
 * After a trader SAVES A NEW BILL in the from-scratch (fresh sack) create flow,
 * the app shows a `post-save-share-sheet` prompt (Share receipt / Done) instead
 * of jumping straight to the home list. (Quick/summary bills do NOT show it.)
 * This spec drives that flow:
 *   create a bill → the prompt appears (page did NOT navigate home) →
 *   tap Share receipt → the receipt preview opens → tap the share button →
 *   a PNG File reaches the (stubbed) navigator.share → tap Done → land on `/`.
 *
 * Runs against the real static-export dev server (basePath /app) with real
 * IndexedDB in a fresh Chromium context. Fully offline: no server DB, no network,
 * no external image service — the PNG is rasterised client-side by html-to-image.
 * navigator.share is stubbed exactly as receipt-share.spec.ts does.
 */

// Phase 6+: the app runs behind the auth gate — sign the test owner in first.
test.beforeEach(async ({ page }) => {
  await signInTestOwner(page)
})

/** Stub the native file-share API BEFORE the app loads and capture what is shared. */
async function stubNativeShare(page: Page) {
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

/** English + set the business profile, then return to the bill list. */
async function prepare(page: Page) {
  await page.goto('./')
  await page.getByTestId('lang-toggle-en').click()
  await expect(page.getByTestId('new-bill-btn')).toContainText('New Bill')
  await fillBusinessProfile(page)
  await page.getByTestId('nav-bills').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
}

async function addSackTo(page: Page, lineIndex: number, value: string) {
  await page.getByTestId('sack-input').nth(lineIndex).fill(value)
  await page.getByTestId('sack-add').nth(lineIndex).click()
}

/**
 * From the post-save prompt: tap Share receipt → assert a PNG File reaches the
 * stubbed navigator.share → close the preview → tap Done → assert we land home.
 */
async function shareThenDone(page: Page) {
  // The prompt is up and the page did NOT navigate away to the home list.
  await expect(page.getByTestId('post-save-share-sheet')).toBeVisible()

  // Tap Share receipt → the reused receipt preview opens.
  await page.getByTestId('post-save-share-btn').click()
  await expect(page.getByTestId('receipt-preview')).toBeVisible()
  await expect(page.getByTestId('receipt')).toBeVisible()

  // Share → a PNG File reaches navigator.share.
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

  // Close the preview → back on the prompt → Done navigates home.
  await page.getByTestId('share-close').click()
  await expect(page.getByTestId('receipt-preview')).toHaveCount(0)
  await page.getByTestId('post-save-done-btn').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
  await expect(page.getByTestId('new-bill-btn')).toBeVisible()
}

test('fresh sack bill: save shows the post-save share prompt, shares a PNG, Done → home', async ({
  page,
}) => {
  await stubNativeShare(page)
  await prepare(page)

  // Create a minimal fresh (sacks) bill.
  await page.getByTestId('new-bill-btn').click()
  await page.waitForURL('**/app/bills/choose/**')
  await page.getByTestId('choice-fresh').click()
  await page.waitForURL('**/app/bills/new/**')

  await page.getByTestId('farmer-input').fill('Ramesh')
  await page.getByLabel('Place / Village').fill('Sadar')
  await page.getByTestId('grain-type-select').nth(0).selectOption({ label: 'Wheat' })
  await page.getByTestId('price-input').nth(0).fill('2000')
  await addSackTo(page, 0, '50')
  await addSackTo(page, 0, '50')

  // Save → the prompt appears; the page did NOT jump to home.
  await page.getByTestId('save-bill').click()
  await expect(page.getByTestId('post-save-share-sheet')).toBeVisible()
  expect(page.url()).toContain('/app/bills/new/')

  await shareThenDone(page)
})
