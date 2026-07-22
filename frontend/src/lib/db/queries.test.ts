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

    const { overdue, dueSoon, upcoming } = listDueBills(bills, today)
    expect(overdue.map((b) => b.id)).toEqual(['060726/over1'])
    expect(dueSoon.map((b) => b.id)).toEqual(['060726/soon1'])
    expect(upcoming.map((b) => b.id)).toEqual(['060726/far01'])
    // Neither the fully-paid nor the undated bill appears in any bucket.
    const allShown = [...overdue, ...dueSoon, ...upcoming].map((b) => b.id)
    expect(allShown).not.toContain('060726/paid1')
    expect(allShown).not.toContain('060726/nodue')
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

  it('a bill with no due date never appears on the Due screen', () => {
    const undated = makeBill({ id: '060726/nodue2', dueDate: undefined })
    expect(listDueBills([undated], today)).toEqual({ overdue: [], dueSoon: [], upcoming: [] })
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
