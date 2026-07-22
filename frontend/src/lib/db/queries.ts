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
  undated: Bill[]
}

/**
 * Group an in-memory bill list by due state. **Inclusion is by balance, not by due
 * date:** every bill that still owes money (`outstanding > 0`) appears in exactly
 * one bucket — a blank due date never hides a bill. Fully-paid bills
 * (`outstanding <= 0`) are excluded from every bucket.
 *
 *   overdue  → has a due date before today, still owes (sorted by dueDate asc)
 *   dueSoon  → has a due date within `soonDays` (default 7), still owes (dueDate asc)
 *   upcoming → has a due date beyond the soon window, still owes (dueDate asc)
 *   undated  → still owes but has NO due date (sorted newest-created first)
 */
export function listDueBills(bills: Bill[], today: string, soonDays = 7): DueBuckets {
  const overdue: Bill[] = []
  const dueSoon: Bill[] = []
  const upcoming: Bill[] = []
  const undated: Bill[] = []

  for (const bill of bills) {
    const { outstanding } = billBalance(bill)
    if (outstanding <= 0) continue
    if (!bill.dueDate) {
      undated.push(bill)
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
  // Undated bills have no dueDate to order by → newest-created first (consistent
  // with listBills()).
  undated.sort((a, b) => b.createdAt - a.createdAt)
  return { overdue, dueSoon, upcoming, undated }
}
