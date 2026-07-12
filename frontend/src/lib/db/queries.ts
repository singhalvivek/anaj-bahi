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
}

/**
 * Group an in-memory bill list into overdue / dueSoon: bills that still owe money
 * AND carry a due date, each sorted by dueDate ascending (most pressing first).
 * Fully-paid bills, bills without a due date, and bills whose due date is beyond
 * the soon window are excluded. `soonDays` is the due-soon window (default 7).
 */
export function listDueBills(bills: Bill[], today: string, soonDays = 7): DueBuckets {
  const overdue: Bill[] = []
  const dueSoon: Bill[] = []

  for (const bill of bills) {
    if (!bill.dueDate) continue
    const { outstanding } = billBalance(bill)
    if (outstanding <= 0) continue
    const status = dueStatus(bill.dueDate, outstanding, today, soonDays)
    if (status === 'overdue') overdue.push(bill)
    else if (status === 'due_soon') dueSoon.push(bill)
  }

  const byDueDateAsc = (a: Bill, b: Bill): number =>
    a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : 0
  overdue.sort(byDueDateAsc)
  dueSoon.sort(byDueDateAsc)
  return { overdue, dueSoon }
}
