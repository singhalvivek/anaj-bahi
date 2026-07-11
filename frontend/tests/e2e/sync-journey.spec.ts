import { test, expect, type Page } from '@playwright/test'

/**
 * Phase-4 cloud-sync E2E — the real Next.js PWA (basePath /app, real IndexedDB)
 * driven against the REAL FastAPI + SQLite sync backend booted by Playwright's
 * webServer array (token `test-device-token`, DB `backend/data/e2e.db`, wiped
 * empty by global-setup before the run).
 *
 * Three journeys, no stubs:
 *   1. Back up + restore onto a "new device" (backend UP) — restore reproduces the
 *      bill, its ₹1741.72 payment / ₹2000.00 outstanding, and the business profile.
 *   2. Offline-first (backend UNREACHABLE) — a bill still saves locally and shows
 *      in the list; a manual back-up surfaces a graceful network error, no crash.
 *   3. Auth gate (wrong token) — a manual back-up surfaces a clear auth error.
 *
 * Numbers (verified against lib/calc, same worked example as the other specs):
 *   sacks 40, 40, 40.5, 39 → gross 159.5 kg; deductions 0.5 kg/sack + 1% gross
 *   → net 155.905 kg; amount 1.55905 quintal × ₹2400 = ₹3741.72.
 */

const BACKEND_URL = 'http://localhost:8000'
const DEVICE_TOKEN = 'test-device-token'
const EXPECTED_TOTAL = '3741.72'
const DEXIE_DB_NAME = 'anajbahi' // from src/lib/db/schema.ts (Dexie super('anajbahi'))

async function addSack(page: Page, value: string) {
  await page.getByTestId('sack-input').fill(value)
  await page.getByTestId('sack-add').click()
}

/** Switch to English so grain labels + 'Place / Village' + assertions are deterministic. */
async function useEnglish(page: Page) {
  await page.getByTestId('lang-toggle-en').click()
  await expect(page.getByTestId('new-bill-btn')).toContainText('New Bill')
}

/** Enter + save the backend URL and device token in the Settings sync section. */
async function configureSync(page: Page, baseUrl: string, token: string) {
  await page.getByTestId('nav-settings').click()
  await page.waitForURL('**/app/settings/**')
  await page.getByTestId('sync-url').fill(baseUrl)
  await page.getByTestId('sync-token').fill(token)
  await page.getByTestId('sync-save-config').click()
  await expect(page.getByTestId('sync-config-saved')).toBeVisible()
}

/** Fill + save the business profile (the receipt header / a backed-up record). */
async function saveBusinessProfile(page: Page, shop: string, phone: string) {
  await page.getByTestId('nav-settings').click()
  await page.waitForURL('**/app/settings/**')
  await page.getByTestId('settings-shop').fill(shop)
  await page.getByTestId('settings-phone').fill(phone)
  await page.getByTestId('settings-save').click()
  await expect(page.getByTestId('settings-saved')).toBeVisible()
}

/** Create the worked-example Wheat bill; returns on the home screen with the card. */
async function createWheatBill(page: Page, farmer: string, place: string) {
  await page.getByTestId('nav-bills').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
  await page.getByTestId('new-bill-btn').click()
  await page.waitForURL('**/app/bills/choose/**')
  await page.getByTestId('choice-fresh').click()
  await page.waitForURL('**/app/bills/new/**')

  await page.getByTestId('farmer-input').fill(farmer)
  await page.getByLabel('Place / Village').fill(place)

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
 * Delete the local IndexedDB (simulate a brand-new phone) and re-open the app at
 * home. The bills, payments, business profile, and sync config all lived in
 * IndexedDB, so the app reopens empty. The delete may be `blocked` while the page still holds the Dexie
 * connection — navigating away closes it and the (serialised) delete completes
 * before the fresh page reopens. We navigate to `./` (home) rather than reloading
 * in place so re-onboarding lands on the home screen.
 */
async function simulateNewDevice(page: Page) {
  await page.evaluate(
    (name) =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(name)
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
        req.onblocked = () => resolve()
      }),
    DEXIE_DB_NAME,
  )
  await page.goto('./')
}

test('backs up to the cloud and restores onto a new device', async ({ page }) => {
  // Auto-accept the restore confirm() dialog.
  page.on('dialog', (dialog) => dialog.accept())

  // --- Original device: English, profile, sync config ---
  await page.goto('./')
  await useEnglish(page)

  await saveBusinessProfile(page, 'Ramesh Traders', '9998887776')
  await configureSync(page, BACKEND_URL, DEVICE_TOKEN)

  // --- Create the bill and record a partial payment (both must be backed up) ---
  await createWheatBill(page, 'Ramesh', 'Sadar')
  const card = page.getByTestId('bill-card').first()
  await expect(card).toBeVisible()
  await card.click()
  await page.waitForURL('**/app/bill/**')
  await expect(page.getByTestId('detail-bill-total')).toContainText(EXPECTED_TOTAL)

  await page.getByTestId('payment-amount').fill('1741.72')
  await page.getByTestId('payment-add').click()
  await expect(page.getByTestId('paid-total')).toContainText('1741.72')
  await expect(page.getByTestId('outstanding-balance')).toContainText('2000.00')

  // --- Back up now → success, status shows a real last-synced time, no error ---
  await page.getByTestId('nav-settings').click()
  await page.waitForURL('**/app/settings/**')
  await page.getByTestId('sync-now').click()
  await expect(page.getByTestId('sync-message')).toContainText('Backed up')
  await expect(page.getByTestId('sync-error')).toHaveCount(0)
  await expect(page.getByTestId('sync-last-synced')).not.toContainText('Never')

  // --- Simulate a brand-new phone: wipe local data, re-onboard ---
  await simulateNewDevice(page)
  // Language pref lives in localStorage (survives the IDB wipe) — ensure English anyway.
  await useEnglish(page)

  // The new device is empty — no bill yet.
  await expect(page.getByTestId('bill-list')).toContainText('No bills yet')

  // --- Re-enter the connection and restore ---
  await configureSync(page, BACKEND_URL, DEVICE_TOKEN)
  await page.getByTestId('sync-restore').click()
  await expect(page.getByTestId('sync-message')).toContainText('Restore complete')
  await expect(page.getByTestId('sync-error')).toHaveCount(0)

  // --- Restore reproduced the bill on home ---
  await page.getByTestId('nav-bills').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
  const restoredCard = page.getByTestId('bill-card').filter({ hasText: 'Ramesh' }).first()
  await expect(restoredCard).toBeVisible()
  await expect(restoredCard).toContainText(EXPECTED_TOTAL)

  // --- ...with its total AND payment history intact ---
  await restoredCard.click()
  await page.waitForURL('**/app/bill/**')
  await expect(page.getByTestId('detail-bill-total')).toContainText(EXPECTED_TOTAL)
  await expect(page.getByTestId('paid-total')).toContainText('1741.72')
  await expect(page.getByTestId('outstanding-balance')).toContainText('2000.00')

  // --- ...and the business profile came back too ---
  await page.getByTestId('nav-settings').click()
  await page.waitForURL('**/app/settings/**')
  await expect(page.getByTestId('settings-shop')).toHaveValue('Ramesh Traders')
})

test('saves bills locally and reports a graceful error when the backend is unreachable', async ({
  page,
}) => {
  await page.goto('./')
  await useEnglish(page)

  // Point sync at an unreachable backend (offline-first: writes must still work).
  await configureSync(page, 'http://localhost:9', 'irrelevant-token')

  // The local write path never touches the network — the bill saves and lists.
  await createWheatBill(page, 'Offline', 'Village')
  await expect(page.getByTestId('bill-list')).toBeVisible()
  const card = page.getByTestId('bill-card').filter({ hasText: 'Offline' }).first()
  await expect(card).toBeVisible()
  await expect(card).toContainText(EXPECTED_TOTAL)

  // A manual back-up degrades gracefully: a clear network message, no crash.
  await page.getByTestId('nav-settings').click()
  await page.waitForURL('**/app/settings/**')
  await page.getByTestId('sync-now').click()
  await expect(page.getByTestId('sync-error')).toContainText('unreachable')

  // Local data is untouched — the bill is still there.
  await page.getByTestId('nav-bills').click()
  await page.waitForURL(/\/app\/(\?.*)?$/)
  await expect(page.getByTestId('bill-card').filter({ hasText: 'Offline' }).first()).toBeVisible()
})

test('reports an auth error when the device token is wrong', async ({ page }) => {
  await page.goto('./')
  await useEnglish(page)

  // Correct URL, WRONG token → the backend gates /sync/* with 401.
  await configureSync(page, BACKEND_URL, 'definitely-the-wrong-token')

  await page.getByTestId('sync-now').click()
  await expect(page.getByTestId('sync-error')).toContainText('Wrong device token')
})
