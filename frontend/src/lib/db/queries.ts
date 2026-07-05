// Search & filter / due-list queries over the Dexie store.
// The ONLY layer besides repo.ts that touches IndexedDB. Pure balance/date math
// is delegated to lib/calc so this file only orchestrates queries + grouping.

import { db, type Bill } from './schema'
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
 * Find bills matching a filter. Any subset of {text, grainTypeId, date} may be set;
 * set filters combine with AND. An empty filter returns all bills, newest first.
 *
 * `text` uses the `farmerName`/`farmerPlace` prefix indexes (`startsWithIgnoreCase`)
 * and unions the two matches; `grainTypeId` and `date` further narrow in memory
 * (single-user local store — small result sets, exact and simple).
 */
export async function searchBills(filter: BillFilter = {}): Promise<Bill[]> {
  const text = filter.text?.trim()
  const { grainTypeId, date } = filter

  let bills: Bill[]
  if (text) {
    const [byName, byPlace] = await Promise.all([
      db.bills.where('farmerName').startsWithIgnoreCase(text).toArray(),
      db.bills.where('farmerPlace').startsWithIgnoreCase(text).toArray(),
    ])
    const deduped = new Map<string, Bill>()
    for (const b of byName) deduped.set(b.id, b)
    for (const b of byPlace) deduped.set(b.id, b)
    bills = [...deduped.values()]
  } else {
    bills = await db.bills.toArray()
  }

  if (grainTypeId) bills = bills.filter((b) => b.grainTypeIds.includes(grainTypeId))
  if (date) bills = bills.filter((b) => b.purchaseDate === date)

  // Newest first, consistent with listBills().
  bills.sort((a, b) => b.createdAt - a.createdAt)
  return bills
}

export interface DueBuckets {
  overdue: Bill[]
  dueSoon: Bill[]
}

/**
 * Bills that still owe money AND carry a due date, grouped into overdue / dueSoon
 * and each sorted by dueDate ascending (most pressing first). Fully-paid bills,
 * bills without a due date, and bills whose due date is beyond the soon window are
 * excluded. `soonDays` is the due-soon window (default 7).
 */
export async function listDueBills(today: string, soonDays = 7): Promise<DueBuckets> {
  const all = await db.bills.toArray()
  const overdue: Bill[] = []
  const dueSoon: Bill[] = []

  for (const bill of all) {
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
