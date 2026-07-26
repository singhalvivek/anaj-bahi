// Phase 12 — the cross-bill aggregation module. PURE: it takes an already-loaded
// `Bill[]` (from the existing `useBills()` snapshot) and derives every rollup
// figure on-device. No Firestore query, no new read, no schema change — so it
// works fully offline exactly like the rest of the app.
//
// Three rules govern every number in here, and all three are load-bearing:
//
//  1. ROUND THEN ADD. Each per-bill figure is rounded to a whole rupee BEFORE it
//     enters a sum, so the rows shown on the drill-down always add up to the
//     headline. `round(true sum)` would read ₹1 lower on the canonical fixture
//     (14590 vs 14591) — precisely the disagreement that breaks a hand-added
//     column. See format.ts and data.md § Display rounding.
//
//  2. bought and paid are ASYMMETRIC ON PURPOSE. `bought` is matched by the
//     BILL's `purchaseDate`; `paid` is matched by each PAYMENT's own `date`,
//     across ALL bills. So last month's bill paid this month lands in this
//     month's `paid` but not its `bought`, and vice versa. This is why the
//     drill-down is a projection rather than a `BillFilter` — a bill-level
//     filter cannot express "payments dated in July".
//
//  3. EXPOSURE IS CLAMPED PER BILL. `billBalance().outstanding` goes negative on
//     an overpaid bill (advance credit). Summing raw would let an advance on one
//     bill silently shrink the money owed elsewhere, so each bill contributes
//     `max(0, …)`. Unclamped, the canonical fixture reads 17349 instead of 17603.
//     Displaying advances is out of scope this phase; distorting the exposure
//     figure with them is simply wrong.
//
// `bought` is deliberately NOT clamped — `billBalance().total` is unclamped
// upstream (a paldari above the line subtotal yields a negative), and the rollup
// must mirror the bill card rather than quietly disagree with it.

import type { Bill } from '@/lib/db/schema'
import { billBalance } from '@/lib/calc'
import { roundToRupee } from './format'

/** Current-calendar-month aggregate. `dueAllTime` is deliberately not month-scoped. */
export interface MonthRollup {
  /** Echoed back so a caller can assert which period a figure belongs to. */
  monthKey: string
  /** Bills whose `purchaseDate` falls in the month (zero-amount bills still count). */
  billCount: number
  /** Σ round(billBalance.total) over in-month bills — net of paldari, unclamped. */
  bought: number
  /** Σ round(in-month payment sum) over ALL bills, matched by payment date. */
  paid: number
  /** ALL-TIME outstanding exposure, clamped per bill at 0. Ignores `monthKey`. */
  dueAllTime: number
}

/** Single-day aggregate — the close-of-day summary. */
export interface DayRollup {
  date: string
  billCount: number
  bought: number
  paid: number
  /** Σ clamped outstanding over THAT DAY's bills only. */
  pending: number
}

/** Which headline figure a drill-down is itemising. */
export type RollupMetric = 'bought-month' | 'paid-month' | 'due-all' | 'bought-today'

/** The period a drill-down resolves its metric against. */
export interface RollupPeriod {
  monthKey: string
  today: string
}

/**
 * One bill's exact contribution to a headline figure. `Σ amount` over the rows
 * equals the headline by construction — that invariant is what makes the number
 * checkable, and it is unit-tested for every metric.
 */
export interface RollupContribution {
  billId: string
  farmerName: string
  farmerPlace: string
  /** Purchase date for bought/due metrics; the LATEST in-period payment date for paid. */
  date: string
  amount: number
}

/** `2026-07-26` → `2026-07`. An ISO prefix compare — no `Date`, so no timezone can shift a month or year boundary. */
export function monthKeyOf(isoDate: string): string {
  return isoDate.slice(0, 7)
}

/** Sum a bill's payments whose own date matches, plus the latest such date. */
function matchingPayments(
  bill: Bill,
  matches: (date: string) => boolean,
): { sum: number; latest: string | null } {
  let sum = 0
  let latest: string | null = null
  for (const payment of bill.payments ?? []) {
    if (!matches(payment.date)) continue
    sum += payment.amount
    if (latest === null || payment.date > latest) latest = payment.date
  }
  return { sum, latest }
}

export function monthRollup(bills: Bill[], monthKey: string): MonthRollup {
  let billCount = 0
  let bought = 0
  let paid = 0
  let dueAllTime = 0

  for (const bill of bills) {
    const balance = billBalance(bill)

    // Rule 2, half one: membership by the BILL's purchase date.
    if (monthKeyOf(bill.purchaseDate) === monthKey) {
      billCount += 1
      bought += roundToRupee(balance.total)
    }

    // Rule 2, half two: membership by each PAYMENT's own date, over ALL bills.
    paid += roundToRupee(matchingPayments(bill, (d) => monthKeyOf(d) === monthKey).sum)

    // Rule 3: all-time exposure, clamped per bill.
    dueAllTime += Math.max(0, roundToRupee(balance.outstanding))
  }

  return { monthKey, billCount, bought, paid, dueAllTime }
}

export function dayRollup(bills: Bill[], date: string): DayRollup {
  let billCount = 0
  let bought = 0
  let paid = 0
  let pending = 0

  for (const bill of bills) {
    const balance = billBalance(bill)

    if (bill.purchaseDate === date) {
      billCount += 1
      bought += roundToRupee(balance.total)
      pending += Math.max(0, roundToRupee(balance.outstanding))
    }

    // Payments settled today may belong to older bills, so `paid` can exceed
    // `bought` on a given day. That is correct, not a bug.
    paid += roundToRupee(matchingPayments(bill, (d) => d === date).sum)
  }

  return { date, billCount, bought, paid, pending }
}

/** Internal row shape — `createdAt` is the sort tiebreak and is stripped before returning. */
interface SortableContribution extends RollupContribution {
  createdAt: number
}

export function rollupContributions(
  bills: Bill[],
  metric: RollupMetric,
  period: RollupPeriod,
): RollupContribution[] {
  const rows: SortableContribution[] = []

  for (const bill of bills) {
    const identity = {
      billId: bill.id,
      farmerName: bill.farmerName,
      farmerPlace: bill.farmerPlace,
      createdAt: bill.createdAt,
    }

    if (metric === 'bought-month' || metric === 'bought-today') {
      const inPeriod =
        metric === 'bought-month'
          ? monthKeyOf(bill.purchaseDate) === period.monthKey
          : bill.purchaseDate === period.today
      if (!inPeriod) continue
      // Zero-amount bills ARE kept: row count must equal `billCount`.
      rows.push({
        ...identity,
        date: bill.purchaseDate,
        amount: roundToRupee(billBalance(bill).total),
      })
      continue
    }

    if (metric === 'paid-month') {
      const { sum, latest } = matchingPayments(bill, (d) => monthKeyOf(d) === period.monthKey)
      const amount = roundToRupee(sum)
      // A bill with no in-period payment contributes no row; nor does sub-rupee
      // dust that rounds to zero, which would otherwise show as a "₹0" row.
      if (amount === 0 || latest === null) continue
      rows.push({ ...identity, date: latest, amount })
      continue
    }

    // due-all — only bills that still owe something.
    const amount = Math.max(0, roundToRupee(billBalance(bill).outstanding))
    if (amount === 0) continue
    rows.push({ ...identity, date: bill.purchaseDate, amount })
  }

  // Exposure reads biggest-first (act on the largest debt); every other metric
  // reads newest-first, matching the bill list. `rows` is local, so the caller's
  // array is never mutated.
  if (metric === 'due-all') {
    rows.sort((a, b) => b.amount - a.amount || b.createdAt - a.createdAt)
  } else {
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))
  }

  return rows.map(({ billId, farmerName, farmerPlace, date, amount }) => ({
    billId,
    farmerName,
    farmerPlace,
    date,
    amount,
  }))
}
