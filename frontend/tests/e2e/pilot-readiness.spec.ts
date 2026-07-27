import { test, expect, type Page } from '@playwright/test'
import { OWNER_EMAIL, signInTestOwner } from './support/auth'
import { clearBillDueDate, getOwnerBizId, listCollection, str } from './support/emulator'

/**
 * Phase 12 — "pilot readiness" E2E.
 *
 * Covers the items that make the two-week trader trial viable: quick entry as the
 * default path, the cross-bill month strip, the close-of-day card, the drill-down
 * that makes those figures checkable, the mandatory +15-day due date, and the
 * legacy-undated repair on the Due screen.
 *
 * DETERMINISM (frozen in architecture.md § E2E determinism for Phase 12):
 * `global-setup` clears the emulator ONCE per run, not per spec, and Playwright
 * runs with `retries: 1`. So every money assertion here is a DELTA against a
 * baseline read at the start of the test — never an absolute total. That makes
 * this spec immune both to bills other specs left behind and to its own first
 * attempt on a retry. Farmer names are unique per test run for the same reason.
 *
 * Figures are read from the numeric `data-amount` / `data-count` attributes rather
 * than on-screen text: the text is Indian-grouped and translated, so parsing it
 * would couple these assertions to formatting and to the active language.
 */

test.beforeEach(async ({ page }) => {
  await signInTestOwner(page)
})

const PLACE = 'Kheri'

/** A farmer name no other run (or retry) will collide with. */
function uniqueFarmer(tag: string): string {
  return `Rollup ${tag} ${Date.now().toString().slice(-6)}`
}

/** Read a numeric `data-amount` / `data-count` off a testid. */
async function num(page: Page, testid: string, attr: 'amount' | 'count' = 'amount') {
  const raw = await page.getByTestId(testid).first().getAttribute(`data-${attr}`)
  expect(raw, `${testid} should carry a numeric data-${attr}`).not.toBeNull()
  return Number(raw)
}

/** `yyyy-mm-dd` + n days, mirroring lib/calc addDaysIso — UTC, so no timezone drift. */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Create a quick-entry bill for a WHOLE-rupee amount, landing back on the list.
 * Whole rupees keep the delta assertions exact without re-deriving the
 * round-then-add rule here — that is unit-tested against the spec fixture.
 */
async function createQuickBill(page: Page, farmer: string, amount: string): Promise<void> {
  await page.goto('/app/')
  // The app opens in HINDI by default, so 'Place / Village' and the grain <select>
  // labels only resolve in English. Same reason the shipped journeys do this.
  await page.getByTestId('lang-toggle-en').click()
  await expect(page.getByTestId('new-bill-btn')).toContainText('New Bill')
  await page.getByTestId('new-bill-btn').click()
  await page.getByTestId('choice-quick').click()
  await page.waitForURL('**/app/bills/quick/**')

  await page.getByTestId('farmer-input').fill(farmer)
  await page.getByLabel('Place / Village').fill(PLACE)

  await page.getByTestId('grain-type-select').first().selectOption({ label: 'Wheat' })
  await page.getByTestId('price-input').first().fill('2400')
  await page.getByTestId('total-weight-input').first().fill('100')
  // Filled last: the amount auto-computes from price × weight until touched.
  await page.getByTestId('amount-input').first().fill(amount)

  await page.getByTestId('save-bill').click()
  // Quick bills deliberately show no post-save share prompt — straight to the list.
  await expect(page.getByTestId('bill-list')).toBeVisible()
}

/** Resolve a bill's `DDMMYY/xxxxx` id from the emulator by its farmer name. */
async function billIdForFarmer(bizId: string, farmer: string): Promise<string> {
  const docs = await listCollection(`businesses/${bizId}/bills`)
  const match = docs.find((d) => str(d.fields, 'farmerName') === farmer)
  if (!match) throw new Error(`No bill found for farmer ${farmer}`)
  const id = str(match.fields, 'id')
  if (!id) throw new Error(`Bill for ${farmer} has no id field`)
  return id
}

test('quick entry leads the chooser and is badged as recommended', async ({ page }) => {
  await page.goto('/app/')
  await page.getByTestId('new-bill-btn').click()

  const choices = page.getByTestId('new-bill-choice')
  await expect(choices).toBeVisible()

  // Both routes still exist — this is a re-ordering, not a removal.
  await expect(page.getByTestId('choice-quick')).toBeVisible()
  await expect(page.getByTestId('choice-fresh')).toBeVisible()
  await expect(page.getByTestId('choice-quick-badge')).toBeVisible()

  // Quick entry renders FIRST in DOM order — the whole point of the change.
  const order = await choices.evaluate((el) =>
    Array.from(el.querySelectorAll('[data-testid]'))
      .map((n) => n.getAttribute('data-testid'))
      .filter((id) => id === 'choice-quick' || id === 'choice-fresh'),
  )
  expect(order).toEqual(['choice-quick', 'choice-fresh'])

  // …and it still goes where it always went.
  await page.getByTestId('choice-quick').click()
  await expect(page).toHaveURL(/\/bills\/quick/)
})

test('both entry forms pre-fill the due date at purchase + 15 days and require it', async ({
  page,
}) => {
  for (const route of ['/app/bills/quick/', '/app/bills/new/']) {
    await page.goto(route)
    await expect(page.getByTestId('due-date-input')).toBeVisible()

    const purchase = await page.getByTestId('purchase-date').inputValue()
    expect(purchase, `${route} should default the purchase date`).not.toBe('')
    await expect(page.getByTestId('due-date-input')).toHaveValue(addDays(purchase, 15))

    // Moving the purchase date drags the untouched due date along with it.
    const moved = addDays(purchase, 3)
    await page.getByTestId('purchase-date').fill(moved)
    await expect(page.getByTestId('due-date-input')).toHaveValue(addDays(moved, 15))

    // Editing it by hand pins it — the purchase date no longer overwrites it.
    const pinned = addDays(moved, 40)
    await page.getByTestId('due-date-input').fill(pinned)
    await page.getByTestId('purchase-date').fill(addDays(moved, 1))
    await expect(page.getByTestId('due-date-input')).toHaveValue(pinned)

    // Required: clearing it blocks Save.
    await page.getByTestId('due-date-input').fill('')
    await expect(page.getByTestId('save-bill')).toBeDisabled()
  }
})

test('a new bill moves the month strip and the today card by exactly its amount', async ({
  page,
}) => {
  await page.goto('/app/')
  await expect(page.getByTestId('month-strip')).toBeVisible()

  const before = {
    bought: await num(page, 'month-bought'),
    due: await num(page, 'month-due'),
    todayBought: await num(page, 'today-bought'),
    todayPending: await num(page, 'today-pending'),
    todayCount: await num(page, 'today-count', 'count'),
  }

  await createQuickBill(page, uniqueFarmer('Delta'), '5000')

  // Deltas, not absolutes — other specs' bills may already sit in this ledger.
  await expect(page.getByTestId('month-bought')).toHaveAttribute(
    'data-amount',
    String(before.bought + 5000),
  )
  await expect(page.getByTestId('month-due')).toHaveAttribute(
    'data-amount',
    String(before.due + 5000),
  )
  await expect(page.getByTestId('today-bought')).toHaveAttribute(
    'data-amount',
    String(before.todayBought + 5000),
  )
  await expect(page.getByTestId('today-pending')).toHaveAttribute(
    'data-amount',
    String(before.todayPending + 5000),
  )
  await expect(page.getByTestId('today-count')).toHaveAttribute(
    'data-count',
    String(before.todayCount + 1),
  )
})

test('every headline drills down to rows that add up to it', async ({ page }) => {
  await createQuickBill(page, uniqueFarmer('Drill'), '4000')

  // The invariant that makes a total believable: he can open it and add the rows.
  for (const metric of ['bought-month', 'due-all', 'bought-today']) {
    await page.goto(`/app/rollup/?metric=${metric}`)
    await expect(page.getByTestId('rollup-screen')).toBeVisible()

    const headline = await num(page, 'rollup-headline')
    const rows = page.getByTestId('rollup-row-amount')
    const count = await rows.count()
    expect(count, `${metric} should itemise its headline`).toBeGreaterThan(0)

    let sum = 0
    for (let i = 0; i < count; i++) {
      sum += Number(await rows.nth(i).getAttribute('data-amount'))
    }
    expect(sum, `Sum of rows must equal the ${metric} headline`).toBe(headline)
    await expect(page.getByTestId('rollup-count')).toHaveAttribute('data-count', String(count))
  }
})

test('a legacy bill with no due date surfaces on Due and can be dated there', async ({ page }) => {
  const farmer = uniqueFarmer('Legacy')
  await createQuickBill(page, farmer, '3000')

  // Manufacture the pre-Phase-12 row the UI can no longer produce.
  const bizId = await getOwnerBizId(OWNER_EMAIL)
  const billId = await billIdForFarmer(bizId, farmer)
  await clearBillDueDate(bizId, billId)

  await page.goto('/app/due/')
  const section = page.getByTestId('due-no-date')
  await expect(section).toBeVisible({ timeout: 15_000 })

  // Scope to OUR row: other specs may have left undated bills behind.
  const row = section.locator('div', { hasText: farmer }).first()
  const dateInput = row.getByTestId('due-set-date-input')
  await expect(dateInput).not.toHaveValue('')

  // Repairing it is allowed even though the normal edit path is lock-gated.
  await row.getByTestId('due-set-date-btn').click()

  // The live snapshot re-buckets the bill, so our legacy row leaves this section.
  await expect(section.locator('div', { hasText: farmer })).toHaveCount(0, { timeout: 15_000 })
})
