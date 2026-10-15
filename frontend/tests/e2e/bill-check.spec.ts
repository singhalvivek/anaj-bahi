import { test, expect, type Page, type Route } from '@playwright/test'
import { signInTestOwner } from './support/auth'

/**
 * Phase 13 — Bill Check E2E.
 *
 * EVERY Gemini request is intercepted with `page.route` and fulfilled from a
 * canned payload, so this spec spends NO API CALLS and needs no real key. The
 * dev server runs with a dummy `NEXT_PUBLIC_GEMINI_API_KEY` (see
 * playwright.config.ts) purely so the screen renders its configured state.
 *
 * Crucially there are NO test-only hooks in production code: the interception is
 * at the network layer, so the real shipped path — reader.ts -> parse.ts ->
 * verify.ts -> render — is exactly what is under test.
 *
 * The worked bill (matching verify.test.ts, so the two agree end to end):
 *   Wheat   — ₹2455/qtl, 1524 kg, 5 kg deduction -> net 1519 kg -> ₹37,291.45
 *   Mustard — ₹4800/qtl,   70 kg, no deduction   -> net   70 kg ->  ₹3,360.00
 *   Correct total = ₹40,651.45
 *
 * The fixture deliberately contains BOTH kinds of error, because the product
 * claim is that they are reported independently:
 *   - the wheat line is written ₹13.32 too high  (line math)
 *   - the grand total is written ₹20 too low      (addition)
 */

test.beforeEach(async ({ page }) => {
  await signInTestOwner(page)
})

const GEMINI_GLOB = '**generativelanguage.googleapis.com**'

const WHEAT_COMPUTED = 37291.45
const WHEAT_WRITTEN = 37304.77 // +13.32
const MUSTARD = 3360.0
const SUM_WRITTEN = 40664.77 // 37304.77 + 3360.00
const PAPER_TOTAL = 40644.77 // ₹20 under his own column

/** A `{value, confidence}` field as the model would return it. */
function f(value: unknown, confidence = 0.95) {
  return { value, confidence }
}

/** The canned read. `wheatAmountConfidence` lets a test force an amber cell. */
function readPayload(opts: { wheatAmountConfidence?: number } = {}) {
  return {
    farmerName: f('Girdhari'),
    place: f('Kheri'),
    date: f('2026-10-15'),
    lines: [
      {
        grainName: f('Wheat'),
        ratePerQuintal: f(2455),
        weightKg: f(1524),
        deductionKg: f(5),
        sackCount: f(30),
        amount: f(WHEAT_WRITTEN, opts.wheatAmountConfidence ?? 0.95),
      },
      {
        grainName: f('Mustard'),
        ratePerQuintal: f(4800),
        weightKg: f(70),
        deductionKg: f(0),
        sackCount: f(2),
        amount: f(MUSTARD),
      },
    ],
    paldari: f(0, 1),
    paperTotal: f(PAPER_TOTAL),
  }
}

/** Wrap a payload in the Gemini response envelope. */
function geminiEnvelope(payload: unknown) {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: 'STOP' }],
  }
}

/**
 * Intercept Gemini and return a counter of how many requests were made.
 * The count is the assertion that proves the arithmetic is local.
 */
async function stubGemini(
  page: Page,
  handler: (route: Route, callIndex: number) => Promise<void> | void,
): Promise<{ count: () => number }> {
  let calls = 0
  await page.route(GEMINI_GLOB, async (route) => {
    const index = calls
    calls += 1
    await handler(route, index)
  })
  return { count: () => calls }
}

/** Fulfil with a successful canned read. */
async function fulfilOk(route: Route, payload: unknown = readPayload()) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(geminiEnvelope(payload)),
  })
}

/**
 * A 1x1 PNG, generated here so no binary is committed to the repo.
 * The real image bytes are irrelevant — the model call is stubbed; what matters
 * is that the app's canvas downscale path runs on a genuinely decodable image.
 */
const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

async function choosePhoto(page: Page) {
  await page.getByTestId('check-file-input').setInputFiles({
    name: 'bill.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_1X1_BASE64, 'base64'),
  })
  await expect(page.getByTestId('check-photo-preview')).toBeVisible()
}

async function gotoCheck(page: Page) {
  await page.getByTestId('bill-check-btn').click()
  await expect(page.getByTestId('check-photo-btn')).toBeVisible()
}

test.describe('Bill Check — the happy path', () => {
  test('reads a bill, reports both errors independently, and re-verifies locally', async ({
    page,
  }) => {
    const gemini = await stubGemini(page, (route) => fulfilOk(route))

    await page.goto('./')

    // (1) Entry point on home, and it must not have disturbed the shipped surfaces.
    const entry = page.getByTestId('bill-check-btn')
    await expect(entry).toBeVisible()
    await expect(page.getByTestId('new-bill-btn')).toBeVisible()
    await expect(page.getByTestId('month-bought')).toBeVisible()

    await gotoCheck(page)

    // (2) The read button only exists once a photo does.
    await expect(page.getByTestId('check-read-btn')).toHaveCount(0)
    await choosePhoto(page)
    await expect(page.getByTestId('check-read-btn')).toBeEnabled()
    expect(gemini.count()).toBe(0) // nothing sent just by picking a photo

    // (3) Read it.
    await page.getByTestId('check-read-btn').click()
    await expect(page.getByTestId('check-result')).toBeVisible()
    expect(gemini.count()).toBe(1)

    // (4) One row per grain, with the computed figure derived locally by lib/calc.
    await expect(page.getByTestId('check-line-row')).toHaveCount(2)
    const wheat = page.getByTestId('check-line-row').first()
    await expect(wheat.getByTestId('check-cell-rate')).toHaveText('₹2455.00')
    await expect(wheat.getByTestId('check-cell-weight')).toHaveText('1524 kg')
    await expect(wheat.getByTestId('check-cell-amount')).toHaveText(`₹${WHEAT_WRITTEN.toFixed(2)}`)
    // The computed figure is derived on-device by lib/calc, not read off the photo.
    await expect(wheat).toContainText(`₹${WHEAT_COMPUTED.toFixed(2)}`)
    await expect(wheat.getByTestId('check-line-diff')).toHaveAttribute('data-diff', '13.32')

    // (5) BOTH verdicts, each naming its own exact rupee difference. This is the
    //     product claim: line math and addition are different mistakes.
    await expect(page.getByTestId('check-verdict')).toHaveAttribute('data-verdict', 'check')
    await expect(page.getByTestId('check-verdict-math')).toContainText('₹13.32')
    await expect(page.getByTestId('check-verdict-addition')).toContainText('₹20.00')

    // (6) Bill-level totals, labelled by provenance.
    await expect(page.getByTestId('check-total-written')).toHaveAttribute(
      'data-amount',
      String(SUM_WRITTEN),
    )
    await expect(page.getByTestId('check-total-computed')).toHaveAttribute(
      'data-amount',
      String(40651.45),
    )
    await expect(page.getByTestId('check-total-paper')).toHaveAttribute(
      'data-amount',
      String(PAPER_TOTAL),
    )

    // (7) "The paper is right" dismisses without changing a number.
    await page.getByTestId('check-accept-paper').click()
    await expect(page.getByTestId('check-verdict')).toHaveAttribute('data-verdict', 'accepted')
    await expect(page.getByTestId('check-verdict-math')).toHaveCount(0)

    // (8) STILL exactly one API call for the whole journey.
    expect(gemini.count()).toBe(1)
  })

  test('correcting an amber cell re-verifies with NO second API call', async ({ page }) => {
    // The whole point of keeping arithmetic out of the model: a corrected digit
    // recomputes on the phone, instantly, offline, for free.
    const gemini = await stubGemini(page, (route) =>
      fulfilOk(route, readPayload({ wheatAmountConfidence: 0.2 })),
    )

    await page.goto('./')
    await gotoCheck(page)
    await choosePhoto(page)
    await page.getByTestId('check-read-btn').click()
    await expect(page.getByTestId('check-result')).toBeVisible()
    expect(gemini.count()).toBe(1)

    // The low-confidence amount renders amber and tappable.
    const unsure = page.getByTestId('check-cell-unsure').filter({ hasText: '₹37304.77' })
    await expect(unsure).toBeVisible()
    await expect(page.getByTestId('check-verdict-math')).toContainText('₹13.32')

    // Correct it to the figure that actually makes the line add up.
    await unsure.click()
    const input = page.getByTestId('check-cell-amount-input')
    await input.fill(String(WHEAT_COMPUTED))
    await input.press('Enter')

    // The line difference is gone and mathDiff is clean — computed locally.
    await expect(page.getByTestId('check-line-diff')).toHaveCount(0)
    await expect(page.getByTestId('check-verdict-math')).toHaveCount(0)
    // The addition is now off by the amount his wrong line was carrying.
    await expect(page.getByTestId('check-verdict-addition')).toBeVisible()
    await expect(page.getByTestId('check-total-written')).toHaveAttribute(
      'data-amount',
      String(40651.45),
    )

    // THE ASSERTION THAT MATTERS: still one call.
    expect(gemini.count()).toBe(1)
  })

  test('a clean bill passes with no difference rows at all', async ({ page }) => {
    const payload = readPayload()
    payload.lines[0].amount = f(WHEAT_COMPUTED)
    payload.paperTotal = f(40651.45)
    await stubGemini(page, (route) => fulfilOk(route, payload))

    await page.goto('./')
    await gotoCheck(page)
    await choosePhoto(page)
    await page.getByTestId('check-read-btn').click()

    await expect(page.getByTestId('check-verdict')).toHaveAttribute('data-verdict', 'ok')
    await expect(page.getByTestId('check-verdict-math')).toHaveCount(0)
    await expect(page.getByTestId('check-verdict-addition')).toHaveCount(0)
    await expect(page.getByTestId('check-line-diff')).toHaveCount(0)
  })

  test('a bill with no written grand total says so, rather than claiming a pass', async ({
    page,
  }) => {
    const payload = readPayload()
    payload.lines[0].amount = f(WHEAT_COMPUTED)
    payload.paperTotal = f(null, 0)
    await stubGemini(page, (route) => fulfilOk(route, payload))

    await page.goto('./')
    await gotoCheck(page)
    await choosePhoto(page)
    await page.getByTestId('check-read-btn').click()

    await expect(page.getByTestId('check-verdict-no-total')).toBeVisible()
    await expect(page.getByTestId('check-verdict-addition')).toHaveCount(0)
    await expect(page.getByTestId('check-total-paper')).toHaveText('—')
  })
})

test.describe('Bill Check — failure paths all stay legible', () => {
  test('a server error shows a retryable message and KEEPS the photo', async ({ page }) => {
    // First call fails, second succeeds — proving retry works off the same photo.
    const gemini = await stubGemini(page, async (route, i) => {
      if (i === 0) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
        return
      }
      await fulfilOk(route)
    })

    await page.goto('./')
    await gotoCheck(page)
    await choosePhoto(page)
    await page.getByTestId('check-read-btn').click()

    const err = page.getByTestId('check-error')
    await expect(err).toBeVisible()
    await expect(err).toHaveAttribute('data-error-key', 'check.error.network')
    // The photo survives — re-shooting a bill over a network blip loses traders.
    await expect(page.getByTestId('check-photo-preview')).toBeVisible()

    await page.getByTestId('check-retry').click()
    await expect(page.getByTestId('check-result')).toBeVisible()
    await expect(page.getByTestId('check-error')).toHaveCount(0)
    expect(gemini.count()).toBe(2)
  })

  test('a malformed 200 is reported as unreadable, not rendered as NaN', async ({ page }) => {
    await stubGemini(page, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"lines": [{"ratePer' }] } }],
        }),
      }),
    )

    await page.goto('./')
    await gotoCheck(page)
    await choosePhoto(page)
    await page.getByTestId('check-read-btn').click()

    await expect(page.getByTestId('check-error')).toHaveAttribute(
      'data-error-key',
      'check.error.badResponse',
    )
    await expect(page.getByTestId('check-result')).toHaveCount(0)
    // Nothing numeric leaked onto the screen.
    await expect(page.locator('body')).not.toContainText('NaN')
  })

  test('rate limiting gets its own message', async ({ page }) => {
    await stubGemini(page, (route) =>
      route.fulfill({ status: 429, contentType: 'application/json', body: '{}' }),
    )

    await page.goto('./')
    await gotoCheck(page)
    await choosePhoto(page)
    await page.getByTestId('check-read-btn').click()

    await expect(page.getByTestId('check-error')).toHaveAttribute(
      'data-error-key',
      'check.error.rateLimited',
    )
  })

  test('a photo with no readable bill is told apart from a failure', async ({ page }) => {
    await stubGemini(page, (route) => fulfilOk(route, { lines: [] }))

    await page.goto('./')
    await gotoCheck(page)
    await choosePhoto(page)
    await page.getByTestId('check-read-btn').click()

    await expect(page.getByTestId('check-error')).toHaveAttribute(
      'data-error-key',
      'check.error.noBillFound',
    )
  })

  test('offline says offline — before even trying — and keeps the photo', async ({
    page,
    context,
  }) => {
    const gemini = await stubGemini(page, (route) => fulfilOk(route))

    await page.goto('./')
    await gotoCheck(page)
    await choosePhoto(page)

    // Same mechanism the shipped shared-ledger.spec.ts uses.
    await context.setOffline(true)
    await page.getByTestId('check-read-btn').click()

    await expect(page.getByTestId('check-error')).toHaveAttribute(
      'data-error-key',
      'check.error.offline',
    )
    // The guard runs BEFORE the fetch, so nothing was ever attempted.
    expect(gemini.count()).toBe(0)
    await expect(page.getByTestId('check-photo-preview')).toBeVisible()

    // Back online, the same photo reads fine.
    await context.setOffline(false)
    await page.getByTestId('check-retry').click()
    await expect(page.getByTestId('check-result')).toBeVisible()
    expect(gemini.count()).toBe(1)
  })
})

test.describe('Bill Check — it never touches the ledger', () => {
  test('checking a bill creates nothing and moves no home figure', async ({ page }) => {
    await stubGemini(page, (route) => fulfilOk(route))

    await page.goto('./')
    const baselineBought = await page.getByTestId('month-bought').getAttribute('data-amount')
    const baselineCount = await page.getByTestId('today-count').getAttribute('data-count')
    const baselineBills = await page.getByTestId('bill-card').count()

    await gotoCheck(page)
    await choosePhoto(page)
    await page.getByTestId('check-read-btn').click()
    await expect(page.getByTestId('check-result')).toBeVisible()

    await page.goto('./')
    // Not a single figure moved, and no bill appeared. The screen is a leaf.
    await expect(page.getByTestId('month-bought')).toHaveAttribute(
      'data-amount',
      baselineBought ?? '',
    )
    await expect(page.getByTestId('today-count')).toHaveAttribute('data-count', baselineCount ?? '')
    expect(await page.getByTestId('bill-card').count()).toBe(baselineBills)
  })
})
