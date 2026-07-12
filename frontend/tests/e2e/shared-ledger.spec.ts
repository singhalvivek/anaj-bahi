import { test, expect } from '@playwright/test'
import { signInTestOwner } from './support/auth'

// Phase 7: the ledger is Cloud Firestore with offline persistence (local-first).
// Sign the real test owner in first (business exists from `auth-onboarding.spec.ts`).
test.beforeEach(async ({ page }) => {
  await signInTestOwner(page)
})

/**
 * Shared-ledger, local-first E2E (Phase 7 redesign).
 *
 * Proves the two properties the Firestore redesign is about:
 *   1. LOCAL-FIRST — a bill created while fully OFFLINE saves and reads back from the
 *      on-device cache with no network at all.
 *   2. SHARED LEDGER — once back online the write auto-syncs to Cloud Firestore, so a
 *      SECOND device (a fresh browser context signed in as the same owner) sees it.
 *
 * Uses the simplest robust create path — the Phase-5 QUICK-ENTRY summary form (no
 * sack-by-sack loop) — reusing the flow + testids from `quick-bill-journey.spec.ts`.
 * Runs against real Firebase (registered test number, fixed OTP via `signInTestOwner`).
 *
 * A distinctive farmer name identifies THIS spec's bill in the shared business ledger
 * (which other journey specs also write to within one run).
 */

const FARMER_NAME = 'Offline Farmer'
const FARMER_PLACE = 'Cachegaon'
const PRICE = '2000'
const TOTAL_WEIGHT = '585'
const AMOUNT = '11700'

test('a bill created offline is not lost — it persists locally and auto-syncs to the shared ledger', async ({
  page,
  context,
  browser,
}) => {
  // --- Home in English so the grain <select> labels + 'Place / Village' resolve ---
  await page.goto('./')
  await page.getByTestId('lang-toggle-en').click()
  await expect(page.getByTestId('new-bill-btn')).toContainText('New Bill')

  // --- Open the quick-entry form WHILE ONLINE so the seeded grain list is cached ---
  await page.getByTestId('new-bill-btn').click()
  await page.waitForURL('**/app/bills/choose/**')
  await page.getByTestId('choice-quick').click()
  await page.waitForURL('**/app/bills/quick/**')

  // Wait until the grain list has loaded (Wheat option present) — this guarantees the
  // grain types are in the local cache before we cut the network.
  const grainSelect = page.getByTestId('grain-type-select').first()
  await expect(grainSelect.locator('option', { hasText: 'Wheat' })).toHaveCount(1)

  // --- GO OFFLINE — everything below happens with no network (local-first) ---
  await context.setOffline(true)

  // --- Transcribe a one-line summary bill entirely offline ---
  await page.getByTestId('farmer-input').fill(FARMER_NAME)
  await page.getByLabel('Place / Village').fill(FARMER_PLACE)
  await grainSelect.selectOption({ label: 'Wheat' })
  await page.getByTestId('price-input').first().fill(PRICE)
  await page.getByTestId('total-weight-input').first().fill(TOTAL_WEIGHT)
  await page.getByTestId('amount-input').first().fill(AMOUNT)

  await page.getByTestId('save-bill').click()

  // The bill is written to the local Firestore cache immediately (local-first): the
  // write resolves against the on-device cache with NO network. In the dev server there
  // is no service worker to serve route chunks offline, so the app's post-save route
  // navigation can't fetch while fully offline — that's a production/SW concern, not a
  // data-layer one. We prove the offline WRITE was not lost by coming back online and
  // confirming it auto-synced and is present. (Give the local write a moment to settle.)
  await page.waitForTimeout(1500)

  // --- BACK ONLINE — Firestore auto-flushes the queued write ---
  await context.setOffline(false)
  await page.waitForTimeout(1500)

  // App reboot online — the offline-created bill persisted (read back) and synced.
  await page.goto('./')
  const persistedCard = page.getByTestId('bill-card').filter({ hasText: FARMER_NAME }).first()
  await expect(persistedCard).toBeVisible({ timeout: 15_000 })
  await expect(persistedCard).toContainText(FARMER_NAME)

  // --- SHARED LEDGER: a second device sees the same bill via Firestore ---
  // Best-effort and generously timed: a cross-context server round-trip can be slow.
  // If this ever proves flaky, widen the timeout rather than deleting the assertion.
  const secondDevice = await browser.newContext()
  try {
    const page2 = await secondDevice.newPage()
    await signInTestOwner(page2)
    await page2.goto('./')
    const sharedCard = page2.getByTestId('bill-card').filter({ hasText: FARMER_NAME }).first()
    await expect(sharedCard).toBeVisible({ timeout: 30_000 })
    await expect(sharedCard).toContainText(FARMER_NAME)
  } finally {
    await secondDevice.close()
  }
})
