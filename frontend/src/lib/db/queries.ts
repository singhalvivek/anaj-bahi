// Search & filter / due-list queries — PURE functions over an in-memory Bill[].
// Phase 7: the store moved to Firestore and reactive reads flow through
// `lib/db/hooks` (useBills). These functions no longer touch the store; callers
// pass the already-loaded bills and these shape/filter/group them. Pure balance/
// date math is delegated to lib/calc so this file only orchestrates filtering + grouping.

import type { Bill } from './schema'
import { billBalance, dueStatus } from '@/lib/calc'

export interface BillFilter {
  /** Prefix, case-insensitive; matches farmerName OR farmerPlace. */
  text?: string
  /** Matches the multiEntry `grainTypeIds` (bill uses that grain on any line). */
  grainTypeId?: string
  /** Matches `purchaseDate` exactly (ISO yyyy-mm-dd). */
  date?: string
}

/**
 * Filter an in-memory bill list. Any subset of {text, grainTypeId, date} may be
 * set; set filters combine with AND. An empty filter returns all bills, newest
 * first.
 *
 * `text` is a case-insensitive prefix on `farmerName` OR `farmerPlace` (either
 * matches); `grainTypeId` matches when the bill uses that grain on any line;
 * `date` matches `purchaseDate` exactly. Single-user local store — small result
 * sets, exact and simple.
 */
export function searchBills(bills: Bill[], filter: BillFilter = {}): Bill[] {
  const text = filter.text?.trim().toLowerCase()
  const { grainTypeId, date } = filter

  let result = bills
  if (text) {
    result = result.filter(
      (b) =>
        b.farmerName.toLowerCase().startsWith(text) ||
        b.farmerPlace.toLowerCase().startsWith(text),
    )
  }
  if (grainTypeId) result = result.filter((b) => b.grainTypeIds.includes(grainTypeId))
  if (date) result = result.filter((b) => b.purchaseDate === date)

  // Newest first, consistent with listBills(). Copy before sorting so the caller's
  // array is never mutated.
  return [...result].sort((a, b) => b.createdAt - a.createdAt)
}

export interface DueBuckets {
  overdue: Bill[]
  dueSoon: Bill[]
  upcoming: Bill[]
  /**
   * **Phase 12, additive.** Legacy bills (created before the due date became
   * mandatory) that carry **no** due date but still owe money. They are not
   * "due" — nothing dates them — but their money is real and must not be
   * invisible, so they surface here instead of in a dated group.
   */
  noDueDate: Bill[]
}

/**
 * Group an in-memory bill list by due state. Every bucket requires the bill to
 * still owe money (`outstanding > 0`); fully-paid bills appear nowhere.
 *
 *   overdue   → due date before today (sorted by dueDate asc)
 *   dueSoon   → due date within `soonDays` (default 7) (dueDate asc)
 *   upcoming  → due date beyond the soon window (dueDate asc)
 *   noDueDate → **no** due date at all (oldest purchaseDate first, then createdAt asc)
 *
 * The three DATED buckets keep the dated-only rule exactly as before — an
 * undated bill can never enter one of them. `noDueDate` is **purely additive**:
 * adding undated rows to the input leaves overdue/dueSoon/upcoming byte-for-byte
 * identical. Since Phase 12 makes the due date mandatory at creation, this
 * bucket only ever holds pre-Phase-12 rows and drains to empty as they are
 * repaired (see `setBillDueDate`, which can date a payment-locked bill that
 * `updateBill` would refuse).
 */
export function listDueBills(bills: Bill[], today: string, soonDays = 7): DueBuckets {
  const overdue: Bill[] = []
  const dueSoon: Bill[] = []
  const upcoming: Bill[] = []
  const noDueDate: Bill[] = []

  for (const bill of bills) {
    const { outstanding } = billBalance(bill)
    if (outstanding <= 0) continue

    // Undated but still owing: real money, so never dropped — but it is not
    // "due", so it stays out of the dated groups.
    if (!bill.dueDate) {
      noDueDate.push(bill)
      continue
    }

    const status = dueStatus(bill.dueDate, outstanding, today, soonDays)
    if (status === 'overdue') overdue.push(bill)
    else if (status === 'due_soon') dueSoon.push(bill)
    else if (status === 'upcoming') upcoming.push(bill)
  }

  const byDueDateAsc = (a: Bill, b: Bill): number =>
    a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : 0
  overdue.sort(byDueDateAsc)
  dueSoon.sort(byDueDateAsc)
  upcoming.sort(byDueDateAsc)

  // Oldest purchase first — the longest-unresolved row is the one to repair next.
  noDueDate.sort((a, b) =>
    a.purchaseDate < b.purchaseDate
      ? -1
      : a.purchaseDate > b.purchaseDate
        ? 1
        : a.createdAt - b.createdAt,
  )

  return { overdue, dueSoon, upcoming, noDueDate }
}
