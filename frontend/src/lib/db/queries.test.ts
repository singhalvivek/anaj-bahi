import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './schema'
import { createBill, addPayment, type Bill } from './repo'
import { searchBills, listDueBills } from './queries'

// fake-indexeddb/auto is loaded in vitest.setup.ts.

beforeEach(async () => {
  await db.delete()
  await db.open()
})

function billInput(overrides: Partial<Bill> = {}): Omit<Bill, 'createdAt' | 'updatedAt'> {
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
    ...overrides,
  }
}

describe('searchBills — filters', () => {
  beforeEach(async () => {
    await createBill(
      billInput({ id: '060726/aaaaa', farmerName: 'Ramesh', farmerPlace: 'Kheri', purchaseDate: '2026-07-06', grainTypeIds: ['wheat'] }),
    )
    await createBill(
      billInput({ id: '070726/bbbbb', farmerName: 'Rajesh', farmerPlace: 'Sitapur', purchaseDate: '2026-07-07', grainTypeIds: ['mustard'] }),
    )
    await createBill(
      billInput({ id: '080726/ccccc', farmerName: 'Suresh', farmerPlace: 'Kheri', purchaseDate: '2026-07-08', grainTypeIds: ['wheat', 'gram'] }),
    )
  })

  it('by farmer name prefix returns only that farmer’s bills, case-insensitive', async () => {
    const results = await searchBills({ text: 'Ram' })
    expect(results.map((b) => b.id)).toEqual(['060726/aaaaa'])
    const upper = await searchBills({ text: 'RAM' })
    expect(upper.map((b) => b.id)).toEqual(['060726/aaaaa'])
  })

  it('text also matches place (farmerPlace) prefix — Kheri returns both Kheri bills', async () => {
    const results = await searchBills({ text: 'Kheri' })
    expect(results.map((b) => b.id).sort()).toEqual(['060726/aaaaa', '080726/ccccc'])
  })

  it('by grain type returns only bills containing that grain (multiEntry)', async () => {
    const wheat = await searchBills({ grainTypeId: 'wheat' })
    expect(wheat.map((b) => b.id).sort()).toEqual(['060726/aaaaa', '080726/ccccc'])
    const mustard = await searchBills({ grainTypeId: 'mustard' })
    expect(mustard.map((b) => b.id)).toEqual(['070726/bbbbb'])
  })

  it('by date returns only that purchaseDate’s bills', async () => {
    const results = await searchBills({ date: '2026-07-07' })
    expect(results.map((b) => b.id)).toEqual(['070726/bbbbb'])
  })

  it('combined filters AND together (place Kheri AND grain gram → only the gram bill)', async () => {
    const results = await searchBills({ text: 'Kheri', grainTypeId: 'gram' })
    expect(results.map((b) => b.id)).toEqual(['080726/ccccc'])
  })

  it('empty filter returns all bills, newest first', async () => {
    const results = await searchBills({})
    expect(results.map((b) => b.id)).toEqual(['080726/ccccc', '070726/bbbbb', '060726/aaaaa'])
  })

  it('no match returns an empty array', async () => {
    expect(await searchBills({ text: 'Zzz' })).toEqual([])
    expect(await searchBills({ grainTypeId: 'soybean' })).toEqual([])
    expect(await searchBills({ date: '1999-01-01' })).toEqual([])
  })
})

describe('listDueBills — overdue / due-soon grouping', () => {
  const today = '2026-07-06'

  it('past-due outstanding bill → overdue; near-future → dueSoon; fully-paid excluded; no-due excluded; far-future excluded', async () => {
    // Overdue: dueDate before today, still owes.
    await createBill(billInput({ id: '060726/over1', dueDate: '2026-07-01' }))
    // Due-soon: dueDate today+3, still owes.
    await createBill(billInput({ id: '060726/soon1', dueDate: '2026-07-09' }))
    // Fully-paid (bill total 3741.72) with a past due date → excluded.
    const paid = await createBill(billInput({ id: '060726/paid1', dueDate: '2026-07-01' }))
    await addPayment(paid.id, { amount: 3741.72, date: '2026-07-02' })
    // Outstanding but no due date → excluded.
    await createBill(billInput({ id: '060726/nodue', dueDate: undefined }))
    // Far-future due date (beyond 7-day window) → excluded.
    await createBill(billInput({ id: '060726/far01', dueDate: '2026-08-15' }))

    const { overdue, dueSoon } = await listDueBills(today)
    expect(overdue.map((b) => b.id)).toEqual(['060726/over1'])
    expect(dueSoon.map((b) => b.id)).toEqual(['060726/soon1'])
  })

  it('groups sort by dueDate ascending (most pressing first)', async () => {
    await createBill(billInput({ id: '060726/over2', dueDate: '2026-07-04' }))
    await createBill(billInput({ id: '060726/over1', dueDate: '2026-07-01' }))
    await createBill(billInput({ id: '060726/soonB', dueDate: '2026-07-10' }))
    await createBill(billInput({ id: '060726/soonA', dueDate: '2026-07-07' }))

    const { overdue, dueSoon } = await listDueBills(today)
    expect(overdue.map((b) => b.dueDate)).toEqual(['2026-07-01', '2026-07-04'])
    expect(dueSoon.map((b) => b.dueDate)).toEqual(['2026-07-07', '2026-07-10'])
  })

  it('paying a bill in full removes it from the due list', async () => {
    const bill = await createBill(billInput({ id: '060726/pay01', dueDate: '2026-07-01' }))
    let buckets = await listDueBills(today)
    expect(buckets.overdue.map((b) => b.id)).toEqual(['060726/pay01'])

    await addPayment(bill.id, { amount: 3741.72, date: '2026-07-05' })
    buckets = await listDueBills(today)
    expect(buckets.overdue).toEqual([])
    expect(buckets.dueSoon).toEqual([])
  })

  it('empty store → empty buckets', async () => {
    expect(await listDueBills(today)).toEqual({ overdue: [], dueSoon: [] })
  })

  it('respects a custom soonDays window', async () => {
    await createBill(billInput({ id: '060726/w10', dueDate: '2026-07-16' })) // today+10
    const narrow = await listDueBills(today, 7)
    expect(narrow.dueSoon).toEqual([])
    const wide = await listDueBills(today, 14)
    expect(wide.dueSoon.map((b) => b.id)).toEqual(['060726/w10'])
  })
})
