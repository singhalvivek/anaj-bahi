// Phase 12 — money formatting for the CROSS-BILL rollup surfaces only.
//
// Why this file exists at all: `@/components/format`'s `formatRupees` renders
// `₹1200.55` — 2 dp, NO thousands separators — and shipped E2E specs assert that
// exact literal (`₹7101.72`), as does the rasterised receipt. It is therefore
// frozen byte-for-byte. Rollup aggregates need the opposite treatment (whole
// rupees, Indian grouping), so they get their own formatter here and the two
// coexist deliberately.
//
// The rounding rule is the load-bearing part. Aggregates round EACH per-bill
// figure to a whole rupee and only THEN add, so the printed rows always add up to
// the printed total. The trader adds the column by hand; a ₹1 disagreement
// destroys trust in every number on the screen. See data.md § Display rounding.

/**
 * Round to a whole rupee, half-up **on the absolute value** so the sign never
 * skews the boundary (`Math.round(-258.5)` is `-258` — it rounds toward +∞ —
 * which would quietly bias negative figures upward).
 *
 * Degrades a non-finite input to `0` rather than letting a NaN poison a total,
 * and never returns `-0` (`Object.is(-0, 0)` is false, so a leaked `-0` would
 * break equality checks downstream).
 */
export function roundToRupee(amount: number): number {
  if (!Number.isFinite(amount)) return 0
  const magnitude = Math.round(Math.abs(amount))
  if (magnitude === 0) return 0
  return amount < 0 ? -magnitude : magnitude
}

/**
 * Group an integer in the Indian system — last three digits, then pairs
 * (`4,20,000`, `1,23,45,678`). Hand-rolled rather than `Intl.NumberFormat`:
 * the output must be byte-identical on every low-end Android WebView, and this
 * runs inside a rasterised-to-PNG surface where a locale surprise is invisible
 * until it reaches the farmer.
 *
 * Truncates a fractional input (it is a digit grouper, not a rounder — callers
 * round first) and yields `'0'` for anything non-finite, never `'NaN'`.
 */
export function groupIndian(value: number): string {
  if (!Number.isFinite(value)) return '0'

  const whole = Math.trunc(value)
  const negative = whole < 0
  const digits = String(Math.abs(whole))

  let grouped: string
  if (digits.length <= 3) {
    grouped = digits
  } else {
    const last3 = digits.slice(-3)
    let rest = digits.slice(0, -3)
    const pairs: string[] = []
    while (rest.length > 2) {
      pairs.unshift(rest.slice(-2))
      rest = rest.slice(0, -2)
    }
    if (rest.length > 0) pairs.unshift(rest)
    grouped = `${pairs.join(',')},${last3}`
  }

  return negative ? `-${grouped}` : grouped
}

/**
 * The ONLY money formatter used on rollup surfaces: whole rupees, Indian
 * grouping, no paise. Rounds internally, so it is idempotent on the already
 * whole-rupee figures the rollup module returns.
 *
 * Never use this for a per-bill or per-line amount — those go through
 * `formatRupees`, which keeps paise and is asserted verbatim by the E2E suite.
 */
export function formatRupeesIndian(amount: number): string {
  return `₹${groupIndian(roundToRupee(amount))}`
}
