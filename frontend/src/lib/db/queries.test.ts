import { describe, it, expect } from 'vitest'
import type { Bill, Payment } from './schema'
import { searchBills, listDueBills } from './queries'

// Phase 7: searchBills / listDueBills are now PURE functions over an in-memory
// Bill[]. No Dexie, no fake-indexeddb, no db seeding — build fixtures directly and
// call the functions. Assertions/coverage are preserved from the Dexie-era tests.

// Monotonic createdAt so fixtures sort deterministically (newest = last built).
let seq = 0

function makeBill(overrides: Partial<Bill> = {}): Bill {
  const ts = ++seq
  return {
    id: '060726/aaaaa',
    farmerId: 'farmer-1',
    farmerName: 'Ramesh',
    farmerPlace: 'Kheri',
    purchaseDate: '2026-07-06',
    grainTypeIds: ['wheat', 'mustard'],
    lines: [
      {
        id: 'line-1',
        grainTypeId: 'wheat',
        pricePerQuintal: 2400,
        sackWeights: [40, 40, 40.5, 39],
        deductions: [
          { basis: 'per_sack_kg', value: 0.5 },
          { basis: 'percent_gross', value: 1 },
        ],
      },
    ],
    payments: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

function payment(amount: number, date: string): Payment {
  return { id: `pay-${amount}-${date}`, amount, date, createdAt: ++seq }
}

describe('searchBills — filters', () => {
  // Three bills, built oldest→newest so createdAt ordering is deterministic.
  const bills: Bill[] = [
    makeBill({ id: '060726/aaaaa', farmerName: 'Ramesh', farmerPlace: 'Kheri', purchaseDate: '2026-07-06', grainTypeIds: ['wheat'] }),
    makeBill({ id: '070726/bbbbb', farmerName: 'Rajesh', farmerPlace: 'Sitapur', purchaseDate: '2026-07-07', grainTypeIds: ['mustard'] }),
    makeBill({ id: '080726/ccccc', farmerName: 'Suresh', farmerPlace: 'Kheri', purchaseDate: '2026-07-08', grainTypeIds: ['wheat', 'gram'] }),
  ]

  it('by farmer name prefix returns only that farmer’s bills, case-insensitive', () => {
    expect(searchBills(bills, { text: 'Ram' }).map((b) => b.id)).toEqual(['060726/aaaaa'])
    expect(searchBills(bills, { text: 'RAM' }).map((b) => b.id)).toEqual(['060726/aaaaa'])
  })

  it('text also matches place (farmerPlace) prefix — Kheri returns both Kheri bills', () => {
    const results = searchBills(bills, { text: 'Kheri' })
    expect(results.map((b) => b.id).sort()).toEqual(['060726/aaaaa', '080726/ccccc'])
  })

  it('by grain type returns only bills containing that grain (multiEntry)', () => {
    expect(searchBills(bills, { grainTypeId: 'wheat' }).map((b) => b.id).sort()).toEqual([
      '060726/aaaaa',
      '080726/ccccc',
    ])
    expect(searchBills(bills, { grainTypeId: 'mustard' }).map((b) => b.id)).toEqual(['070726/bbbbb'])
  })

  it('by date returns only that purchaseDate’s bills', () => {
    expect(searchBills(bills, { date: '2026-07-07' }).map((b) => b.id)).toEqual(['070726/bbbbb'])
  })

  it('combined filters AND together (place Kheri AND grain gram → only the gram bill)', () => {
    expect(searchBills(bills, { text: 'Kheri', grainTypeId: 'gram' }).map((b) => b.id)).toEqual([
      '080726/ccccc',
    ])
  })

  it('empty filter returns all bills, newest first', () => {
    expect(searchBills(bills, {}).map((b) => b.id)).toEqual([
      '080726/ccccc',
      '070726/bbbbb',
      '060726/aaaaa',
    ])
  })

  it('no match returns an empty array', () => {
    expect(searchBills(bills, { text: 'Zzz' })).toEqual([])
    expect(searchBills(bills, { grainTypeId: 'soybean' })).toEqual([])
    expect(searchBills(bills, { date: '1999-01-01' })).toEqual([])
  })

  it('does not mutate the input array (returns a fresh sorted copy)', () => {
    const input = [...bills]
    searchBills(input, {})
    expect(input.map((b) => b.id)).toEqual(['060726/aaaaa', '070726/bbbbb', '080726/ccccc'])
  })
})

describe('listDueBills — dated outstanding grouping (overdue / dueSoon / upcoming)', () => {
  const today = '2026-07-06'
  // A bill of total 3741.72; a single payment of 3741.72 fully settles it.
  const FULL_PAYMENT = 3741.72

  it('groups dated outstanding bills; fully-paid and undated bills are excluded', () => {
    const bills: Bill[] = [
      // Overdue: dueDate before today, still owes.
      makeBill({ id: '060726/over1', dueDate: '2026-07-01' }),
      // Due-soon: dueDate today+3, still owes.
      makeBill({ id: '060726/soon1', dueDate: '2026-07-09' }),
      // Fully-paid with a past due date → excluded from every bucket.
      makeBill({ id: '060726/paid1', dueDate: '2026-07-01', payments: [payment(FULL_PAYMENT, '2026-07-02')] }),
      // Outstanding but no due date → excluded (the Due screen only shows dated bills).
      makeBill({ id: '060726/nodue', dueDate: undefined }),
      // Far-future due date (beyond the 7-day window), still owes → appears under `upcoming`.
      makeBill({ id: '060726/far01', dueDate: '2026-08-15' }),
    ]

    const { overdue, dueSoon, upcoming, noDueDate } = listDueBills(bills, today)
    expect(overdue.map((b) => b.id)).toEqual(['060726/over1'])
    expect(dueSoon.map((b) => b.id)).toEqual(['060726/soon1'])
    expect(upcoming.map((b) => b.id)).toEqual(['060726/far01'])
    // Neither the fully-paid nor the undated bill appears in a DATED bucket.
    const allShown = [...overdue, ...dueSoon, ...upcoming].map((b) => b.id)
    expect(allShown).not.toContain('060726/paid1')
    expect(allShown).not.toContain('060726/nodue')
    // Phase 12 — the undated bill that still owes money now surfaces separately.
    expect(noDueDate.map((b) => b.id)).toEqual(['060726/nodue'])
  })

  it('REGRESSION — a bill with a due date after today appears right away (not just within the soon window)', () => {
    // The reported bug: a bill created with a due date more than `soonDays` out
    // was computed as `upcoming` but never rendered, so it never showed as due.
    const dated = makeBill({ id: '060726/fresh1', dueDate: '2026-08-01' }) // ~4 weeks out

    const buckets = listDueBills([dated], today)
    expect(buckets.upcoming.map((b) => b.id)).toEqual(['060726/fresh1'])
    // It is not lost: exactly one bucket holds it.
    const total = buckets.overdue.length + buckets.dueSoon.length + buckets.upcoming.length
    expect(total).toBe(1)
  })

  it('a bill with no due date never appears in the three DATED buckets', () => {
    // Phase 12: it is not dropped any more — it surfaces in the additive `noDueDate`
    // bucket (asserted in its own describe below) — but the dated-only principle for
    // overdue/dueSoon/upcoming stands.
    const undated = makeBill({ id: '060726/nodue2', dueDate: undefined })
    const { overdue, dueSoon, upcoming } = listDueBills([undated], today)
    expect(overdue).toEqual([])
    expect(dueSoon).toEqual([])
    expect(upcoming).toEqual([])
  })

  it('dated groups sort by dueDate ascending (most pressing first)', () => {
    const bills: Bill[] = [
      makeBill({ id: '060726/over2', dueDate: '2026-07-04' }),
      makeBill({ id: '060726/over1', dueDate: '2026-07-01' }),
      makeBill({ id: '060726/soonB', dueDate: '2026-07-10' }),
      makeBill({ id: '060726/soonA', dueDate: '2026-07-07' }),
      makeBill({ id: '060726/upB', dueDate: '2026-09-01' }),
      makeBill({ id: '060726/upA', dueDate: '2026-08-01' }),
    ]

    const { overdue, dueSoon, upcoming } = listDueBills(bills, today)
    expect(overdue.map((b) => b.dueDate)).toEqual(['2026-07-01', '2026-07-04'])
    expect(dueSoon.map((b) => b.dueDate)).toEqual(['2026-07-07', '2026-07-10'])
    expect(upcoming.map((b) => b.dueDate)).toEqual(['2026-08-01', '2026-09-01'])
  })

  it('paying a bill in full removes it from every bucket', () => {
    const unpaid = makeBill({ id: '060726/pay01', dueDate: '2026-07-01' })
    expect(listDueBills([unpaid], today).overdue.map((b) => b.id)).toEqual(['060726/pay01'])

    const paid = { ...unpaid, payments: [payment(FULL_PAYMENT, '2026-07-05')] }
    const buckets = listDueBills([paid], today)
    expect(buckets.overdue).toEqual([])
    expect(buckets.dueSoon).toEqual([])
    expect(buckets.upcoming).toEqual([])
  })

  it('empty store → empty buckets', () => {
    expect(listDueBills([], today)).toEqual({
      overdue: [],
      dueSoon: [],
      upcoming: [],
      noDueDate: [],
    })
  })

  it('respects a custom soonDays window (widening moves a bill upcoming → dueSoon)', () => {
    const bills: Bill[] = [makeBill({ id: '060726/w10', dueDate: '2026-07-16' })] // today+10
    // Default 7-day window: beyond soon → it is now visible under `upcoming` (not dropped).
    expect(listDueBills(bills, today, 7).dueSoon).toEqual([])
    expect(listDueBills(bills, today, 7).upcoming.map((b) => b.id)).toEqual(['060726/w10'])
    // Widen to 14 days: it becomes due-soon and leaves upcoming.
    expect(listDueBills(bills, today, 14).dueSoon.map((b) => b.id)).toEqual(['060726/w10'])
    expect(listDueBills(bills, today, 14).upcoming).toEqual([])
  })
})

describe('listDueBills — noDueDate (Phase 12 additive fourth bucket)', () => {
  const today = '2026-07-06'
  const FULL_PAYMENT = 3741.72 // settles the default fixture bill exactly

  it('holds exactly the undated bills that still owe money', () => {
    const bills: Bill[] = [
      makeBill({ id: '010726/undat1', dueDate: undefined, purchaseDate: '2026-07-01' }),
      // Undated but fully paid → nothing owed, so it never appears (same gate as the
      // other three buckets).
      makeBill({
        id: '020726/undat2',
        dueDate: undefined,
        purchaseDate: '2026-07-02',
        payments: [payment(FULL_PAYMENT, '2026-07-03')],
      }),
      // Dated → belongs to a dated bucket, never here.
      makeBill({ id: '030726/dated1', dueDate: '2026-07-01', purchaseDate: '2026-07-03' }),
    ]

    const { noDueDate, overdue } = listDueBills(bills, today)
    expect(noDueDate.map((b) => b.id)).toEqual(['010726/undat1'])
    expect(overdue.map((b) => b.id)).toEqual(['030726/dated1'])
  })

  it('LEGACY LOCKED CASE — an undated bill with a PARTIAL payment still appears (its money is hidden otherwise)', () => {
    // This is the exact row `setBillDueDate` exists to repair: it has a payment (so
    // `updateBill` would throw BillLockedError) and no due date, yet it still owes.
    const locked = makeBill({
      id: '010726/locked',
      dueDate: undefined,
      purchaseDate: '2026-07-01',
      payments: [payment(1000, '2026-07-02')],
    })
    const { noDueDate } = listDueBills([locked], today)
    expect(noDueDate.map((b) => b.id)).toEqual(['010726/locked'])
  })

  it('sorts oldest purchaseDate first, ties broken by createdAt ascending', () => {
    // Built oldest-createdAt first, then handed in deliberately scrambled.
    const sameDayEarly = makeBill({ id: '010726/tieA', dueDate: undefined, purchaseDate: '2026-07-01' })
    const sameDayLate = makeBill({ id: '010726/tieB', dueDate: undefined, purchaseDate: '2026-07-01' })
    const older = makeBill({ id: '200626/older', dueDate: undefined, purchaseDate: '2026-06-20' })
    const newer = makeBill({ id: '040726/newer', dueDate: undefined, purchaseDate: '2026-07-04' })

    const { noDueDate } = listDueBills([newer, sameDayLate, older, sameDayEarly], today)
    expect(noDueDate.map((b) => b.id)).toEqual([
      '200626/older',
      '010726/tieA',
      '010726/tieB',
      '040726/newer',
    ])
  })

  it('is purely ADDITIVE — the three dated buckets are identical with or without undated rows', () => {
    const dated: Bill[] = [
      makeBill({ id: '060726/over9', dueDate: '2026-07-01' }),
      makeBill({ id: '060726/soon9', dueDate: '2026-07-09' }),
      makeBill({ id: '060726/far09', dueDate: '2026-08-15' }),
    ]
    const undated = makeBill({ id: '060726/nodue9', dueDate: undefined })

    const withoutUndated = listDueBills(dated, today)
    const withUndated = listDueBills([...dated, undated], today)

    expect(withUndated.overdue).toEqual(withoutUndated.overdue)
    expect(withUndated.dueSoon).toEqual(withoutUndated.dueSoon)
    expect(withUndated.upcoming).toEqual(withoutUndated.upcoming)
    expect(withoutUndated.noDueDate).toEqual([])
    expect(withUndated.noDueDate.map((b) => b.id)).toEqual(['060726/nodue9'])
  })

  it('does not mutate the caller’s array', () => {
    const input: Bill[] = [
      makeBill({ id: '040726/keep2', dueDate: undefined, purchaseDate: '2026-07-04' }),
      makeBill({ id: '010726/keep1', dueDate: undefined, purchaseDate: '2026-07-01' }),
    ]
    const order = input.map((b) => b.id)
    listDueBills(input, today)
    expect(input.map((b) => b.id)).toEqual(order)
  })
})
