import { describe, it, expect } from 'vitest'
import type { Bill, Payment } from '@/lib/db/schema'
import { billBalance } from '@/lib/calc'
import { roundToRupee } from './format'
import {
  monthKeyOf,
  monthRollup,
  dayRollup,
  rollupContributions,
  type RollupMetric,
} from './rollup'

// Phase 12 — the canonical fixture from data.md § Phase-12 derived aggregates.
// Every number asserted below is a spec figure (Examples 7–11), not a recomputation:
// one wrong total destroys trust in every number on the screen, so the fixture is the
// contract. Bills are built as quick-entry (summary) lines because a summary line's
// `amount` is authoritative and verbatim, which pins `linesTotal` to an exact rupee
// figure without re-deriving sack math here.

const TODAY = '2026-07-26'
const MONTH = '2026-07'
const PERIOD = { monthKey: MONTH, today: TODAY }

function payment(amount: number, date: string, seq: number): Payment {
  return { id: `pay-${seq}`, amount, date, createdAt: seq }
}

function bill(input: {
  id: string
  purchaseDate: string
  /** The single summary line's entered amount === the bill's `linesTotal`. */
  amount: number
  paldari?: number
  payments?: Array<[amount: number, date: string]>
  createdAt: number
  farmerName?: string
  farmerPlace?: string
  dueDate?: string
}): Bill {
  return {
    id: input.id,
    farmerId: `farmer-${input.id}`,
    farmerName: input.farmerName ?? `Farmer ${input.id}`,
    farmerPlace: input.farmerPlace ?? 'Kheri',
    purchaseDate: input.purchaseDate,
    grainTypeIds: ['wheat'],
    lines: [
      {
        id: `line-${input.id}`,
        grainTypeId: 'wheat',
        pricePerQuintal: 2400,
        sackWeights: [],
        deductions: [],
        summary: { totalWeightKg: 100, amount: input.amount },
      },
    ],
    ...(input.paldari !== undefined ? { paldari: input.paldari } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    entryMode: 'summary',
    payments: (input.payments ?? []).map(([amount, date], i) =>
      payment(amount, date, input.createdAt * 100 + i),
    ),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  }
}

// A — last month's bill, paid THIS month (the bought/paid asymmetry, direction 1)
const A = bill({
  id: '280626/aaaaa',
  purchaseDate: '2026-06-28',
  amount: 10000.4,
  payments: [[4000.3, '2026-07-02']],
  createdAt: 1,
  farmerName: 'Ramesh',
  farmerPlace: 'Kheri',
})
// B — this month, with paldari, one in-month payment and one NEXT-month payment
//     (the asymmetry, direction 2)
const B = bill({
  id: '010726/bbbbb',
  purchaseDate: '2026-07-01',
  amount: 7101.72,
  paldari: 200,
  payments: [
    [1000, '2026-07-01'],
    [500, '2026-08-03'],
  ],
  createdAt: 2,
  farmerName: 'Rajesh',
})
// C — today, settled exactly
const C = bill({
  id: '260726/ccccc',
  purchaseDate: TODAY,
  amount: 3741.72,
  payments: [[3741.72, TODAY]],
  createdAt: 3,
  farmerName: 'Suresh',
})
// D — today, OVERPAID (outstanding −254.12 → must clamp to 0)
const D = bill({
  id: '260726/ddddd',
  purchaseDate: TODAY,
  amount: 2745.88,
  payments: [[3000, TODAY]],
  createdAt: 4,
  farmerName: 'Dinesh',
})
// E — next month, untouched
const E = bill({
  id: '020826/eeeee',
  purchaseDate: '2026-08-02',
  amount: 5000,
  createdAt: 5,
  farmerName: 'Eshwar',
})
// F — today, unpaid, the .55 that makes round-then-add visible
const F = bill({
  id: '260726/fffff',
  purchaseDate: TODAY,
  amount: 1200.55,
  createdAt: 6,
  farmerName: 'Firoz',
})

const FIXTURE: Bill[] = [A, B, C, D, E, F]

describe('monthKeyOf — ISO prefix compare, no Date', () => {
  it('takes the first 7 characters', () => {
    expect(monthKeyOf('2026-07-26')).toBe('2026-07')
    expect(monthKeyOf('2025-12-31')).toBe('2025-12')
    expect(monthKeyOf('2026-01-01')).toBe('2026-01')
  })
})

describe('monthRollup — data.md Examples 7, 8, 9', () => {
  const m = monthRollup(FIXTURE, MONTH)

  it('Example 7 — bought(2026-07) === 14591 and round-then-add is what makes it so', () => {
    expect(m.bought).toBe(14591)
    expect(m.billCount).toBe(4) // B, C, D, F

    // The proof that the rule is round-THEN-add, asserted by value: rounding the true
    // sum instead gives 14590 — ₹1 lower — which is exactly the disagreement that
    // would break his hand-added column.
    const trueSum = [B, C, D, F].reduce((s, b) => s + billBalance(b).total, 0)
    expect(trueSum).toBeCloseTo(14589.87, 6)
    expect(roundToRupee(trueSum)).toBe(14590)
    expect(m.bought).not.toBe(roundToRupee(trueSum))
  })

  it('Example 8 — paid(2026-07) === 11742, matched by the PAYMENT date over ALL bills', () => {
    expect(m.paid).toBe(11742)
  })

  it('Example 8 — the asymmetry holds in BOTH directions', () => {
    // A is a JUNE bill: its July payment counts in July's paid…
    expect(monthRollup([A], MONTH).paid).toBe(4000)
    // …and A is NOT in July's bought.
    expect(monthRollup([A], MONTH).bought).toBe(0)
    expect(monthRollup([A], MONTH).billCount).toBe(0)
    // B is a JULY bill whose 500.00 payment is dated AUGUST: excluded from July's paid
    // (only its 1000.00 counts), yet B's full total is in July's bought.
    expect(monthRollup([B], MONTH).paid).toBe(1000)
    expect(monthRollup([B], MONTH).bought).toBe(6902)
    // …and that August payment lands in August's paid.
    expect(monthRollup([B], '2026-08').paid).toBe(500)
  })

  it('Example 9 — due === 17603, CLAMPED PER BILL (unclamped would read 17349)', () => {
    expect(m.dueAllTime).toBe(17603)

    const unclamped = FIXTURE.reduce((s, b) => s + roundToRupee(billBalance(b).outstanding), 0)
    expect(unclamped).toBe(17349)
    // The overpaid bill D contributes 0, never −254.
    expect(roundToRupee(billBalance(D).outstanding)).toBe(-254)
    expect(monthRollup([D], MONTH).dueAllTime).toBe(0)
  })

  it('due is ALL-TIME, not month-scoped — the same figure for any monthKey', () => {
    expect(monthRollup(FIXTURE, '2026-08').dueAllTime).toBe(17603)
    expect(monthRollup(FIXTURE, '1999-01').dueAllTime).toBe(17603)
  })

  it('echoes the monthKey it was asked for', () => {
    expect(m.monthKey).toBe(MONTH)
    expect(monthRollup(FIXTURE, '2026-08').monthKey).toBe('2026-08')
  })

  it('EDGE — no bills at all → all zeros (never NaN), and a month with no bills → 0 bought', () => {
    expect(monthRollup([], MONTH)).toEqual({
      monthKey: MONTH,
      billCount: 0,
      bought: 0,
      paid: 0,
      dueAllTime: 0,
    })
    const empty = monthRollup(FIXTURE, '2026-09')
    expect(empty.billCount).toBe(0)
    expect(empty.bought).toBe(0)
    expect(empty.paid).toBe(0)
    // …while the all-time due figure is unaffected by the empty month.
    expect(empty.dueAllTime).toBe(17603)
  })

  it('EDGE — bought is NOT clamped: a paldari above the line subtotal yields a negative', () => {
    const pathological = bill({
      id: '100726/ppppp',
      purchaseDate: '2026-07-10',
      amount: 100,
      paldari: 400,
      createdAt: 9,
    })
    // Mirrors the bill card exactly (billBalance.total is unclamped upstream).
    expect(billBalance(pathological).total).toBe(-300)
    expect(monthRollup([pathological], MONTH).bought).toBe(-300)
    // …but its outstanding still clamps out of the exposure figure.
    expect(monthRollup([pathological], MONTH).dueAllTime).toBe(0)
  })

  it('ERROR PATH — a bill with no lines and no payments contributes nothing, does not throw', () => {
    const blank: Bill = { ...F, id: '260726/blank', lines: [], payments: [] }
    const r = monthRollup([blank], MONTH)
    expect(r.billCount).toBe(1)
    expect(r.bought).toBe(0)
    expect(r.paid).toBe(0)
    expect(r.dueAllTime).toBe(0)
  })
})

describe('dayRollup — data.md Example 10', () => {
  it('dayRollup(2026-07-26) === { billCount: 3, bought: 7689, paid: 6742, pending: 1201 }', () => {
    expect(dayRollup(FIXTURE, TODAY)).toEqual({
      date: TODAY,
      billCount: 3,
      bought: 7689,
      paid: 6742,
      pending: 1201,
    })
  })

  it('paid MAY legitimately exceed bought on a day (old bills settled today)', () => {
    // A's payment is dated 2026-07-02 while no bill was purchased that day.
    const d = dayRollup(FIXTURE, '2026-07-02')
    expect(d.billCount).toBe(0)
    expect(d.bought).toBe(0)
    expect(d.paid).toBe(4000)
    expect(d.pending).toBe(0)
    expect(d.paid).toBeGreaterThan(d.bought)
  })

  it('pending is clamped per bill (the overpaid bill on that day contributes 0)', () => {
    expect(dayRollup([D], TODAY).pending).toBe(0)
    expect(dayRollup([D], TODAY).paid).toBe(3000)
  })

  it('day membership is an exact string equality on purchaseDate', () => {
    expect(dayRollup(FIXTURE, '2026-07-25').billCount).toBe(0)
    expect(dayRollup(FIXTURE, '2026-07-27').billCount).toBe(0)
  })

  it('EDGE — no bills → all zeros with the date echoed', () => {
    expect(dayRollup([], TODAY)).toEqual({
      date: TODAY,
      billCount: 0,
      bought: 0,
      paid: 0,
      pending: 0,
    })
  })
})

describe('period membership — data.md Example 11 (month + year boundaries)', () => {
  const boundary: Bill[] = [
    bill({ id: '300626/xxxxx', purchaseDate: '2026-06-30', amount: 100, createdAt: 1 }),
    bill({ id: '010726/xxxxx', purchaseDate: '2026-07-01', amount: 100, createdAt: 2 }),
    bill({ id: '310726/xxxxx', purchaseDate: '2026-07-31', amount: 100, createdAt: 3 }),
    bill({ id: '010826/xxxxx', purchaseDate: '2026-08-01', amount: 100, createdAt: 4 }),
  ]

  it('2026-07 includes the first and last day, excludes one day either side', () => {
    const r = monthRollup(boundary, MONTH)
    expect(r.billCount).toBe(2)
    expect(r.bought).toBe(200)
    expect(
      rollupContributions(boundary, 'bought-month', PERIOD).map((c) => c.date),
    ).toEqual(['2026-07-31', '2026-07-01'])
  })

  it('crosses a YEAR boundary without a Date object: 2025-12-31 in, 2026-01-01 out', () => {
    const yearEnd: Bill[] = [
      bill({ id: '311225/xxxxx', purchaseDate: '2025-12-31', amount: 100, createdAt: 1 }),
      bill({ id: '010126/xxxxx', purchaseDate: '2026-01-01', amount: 100, createdAt: 2 }),
    ]
    expect(monthRollup(yearEnd, '2025-12').billCount).toBe(1)
    expect(monthRollup(yearEnd, '2025-12').bought).toBe(100)
    expect(monthRollup(yearEnd, '2026-01').billCount).toBe(1)
  })

  it('payment membership uses the same prefix rule', () => {
    const paidAcrossYear = bill({
      id: '311225/yyyyy',
      purchaseDate: '2025-12-31',
      amount: 1000,
      payments: [
        [400, '2025-12-31'],
        [600, '2026-01-01'],
      ],
      createdAt: 1,
    })
    expect(monthRollup([paidAcrossYear], '2025-12').paid).toBe(400)
    expect(monthRollup([paidAcrossYear], '2026-01').paid).toBe(600)
  })
})

describe('rollupContributions — the sum-of-displayed-parts invariant', () => {
  const m = monthRollup(FIXTURE, MONTH)
  const d = dayRollup(FIXTURE, TODAY)
  const total = (metric: RollupMetric): number =>
    rollupContributions(FIXTURE, metric, PERIOD).reduce((s, c) => s + c.amount, 0)

  it('Σ contributions === the matching rollup figure, for EVERY money metric', () => {
    expect(total('bought-month')).toBe(m.bought)
    expect(total('paid-month')).toBe(m.paid)
    expect(total('due-all')).toBe(m.dueAllTime)
    expect(total('bought-today')).toBe(d.bought)
  })

  it('bought row count === billCount (zero-amount bills are still rows)', () => {
    expect(rollupContributions(FIXTURE, 'bought-month', PERIOD).length).toBe(m.billCount)
    expect(rollupContributions(FIXTURE, 'bought-today', PERIOD).length).toBe(d.billCount)
  })

  it('bought-month rows are the in-month bills, newest first (date DESC, then createdAt DESC)', () => {
    expect(rollupContributions(FIXTURE, 'bought-month', PERIOD).map((c) => c.billId)).toEqual([
      F.id,
      D.id,
      C.id,
      B.id,
    ])
    expect(rollupContributions(FIXTURE, 'bought-month', PERIOD).map((c) => c.amount)).toEqual([
      1201, 2746, 3742, 6902,
    ])
  })

  it('bought-today rows are today’s bills only', () => {
    expect(rollupContributions(FIXTURE, 'bought-today', PERIOD).map((c) => c.billId)).toEqual([
      F.id,
      D.id,
      C.id,
    ])
  })

  it('paid-month rows carry the bill’s in-period payment sum and its LATEST in-period date', () => {
    const rows = rollupContributions(FIXTURE, 'paid-month', PERIOD)
    // D and C paid today, then A (07-02), then B (07-01). E and F never paid.
    expect(rows.map((c) => c.billId)).toEqual([D.id, C.id, A.id, B.id])
    expect(rows.map((c) => c.amount)).toEqual([3000, 3742, 4000, 1000])
    expect(rows.map((c) => c.date)).toEqual([TODAY, TODAY, '2026-07-02', '2026-07-01'])
  })

  it('paid-month picks the LATEST in-period payment date when a bill paid twice in-month', () => {
    const twice = bill({
      id: '050726/twice',
      purchaseDate: '2026-07-05',
      amount: 5000,
      payments: [
        [1000, '2026-07-05'],
        [1500, '2026-07-20'],
        [900, '2026-08-01'], // out of period — neither summed nor date-selected
      ],
      createdAt: 7,
    })
    const rows = rollupContributions([twice], 'paid-month', PERIOD)
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe(2500)
    expect(rows[0].date).toBe('2026-07-20')
  })

  it('due-all rows exclude zero contributors and sort by amount DESC (biggest exposure first)', () => {
    const rows = rollupContributions(FIXTURE, 'due-all', PERIOD)
    // Example 9: exactly 4 rows — A, B, E, F. C (settled) and D (overpaid) are excluded.
    expect(rows.map((c) => c.billId)).toEqual([A.id, B.id, E.id, F.id])
    expect(rows.map((c) => c.amount)).toEqual([6000, 5402, 5000, 1201])
    expect(rows.map((c) => c.date)).toEqual([
      A.purchaseDate,
      B.purchaseDate,
      E.purchaseDate,
      F.purchaseDate,
    ])
  })

  it('paid-month excludes a bill with no in-period payment (zero rows dropped)', () => {
    const ids = rollupContributions(FIXTURE, 'paid-month', PERIOD).map((c) => c.billId)
    expect(ids).not.toContain(E.id)
    expect(ids).not.toContain(F.id)
  })

  it('every row carries the farmer name + place for display', () => {
    const row = rollupContributions(FIXTURE, 'due-all', PERIOD)[0]
    expect(row).toEqual({
      billId: A.id,
      farmerName: 'Ramesh',
      farmerPlace: 'Kheri',
      date: '2026-06-28',
      amount: 6000,
    })
  })

  it('EDGE — no bills → no rows for any metric, and the invariant still holds trivially', () => {
    const metrics: RollupMetric[] = ['bought-month', 'paid-month', 'due-all', 'bought-today']
    for (const metric of metrics) {
      expect(rollupContributions([], metric, PERIOD)).toEqual([])
    }
  })

  it('EDGE — a sub-rupee in-period payment rounds to 0, is dropped as a row, and the invariant survives', () => {
    const dust = bill({
      id: '060726/dusty',
      purchaseDate: '2026-07-06',
      amount: 1000,
      payments: [[0.4, '2026-07-06']],
      createdAt: 8,
    })
    expect(monthRollup([dust], MONTH).paid).toBe(0)
    expect(rollupContributions([dust], 'paid-month', PERIOD)).toEqual([])
  })

  it('does not mutate the caller’s array', () => {
    const input = [...FIXTURE]
    rollupContributions(input, 'due-all', PERIOD)
    expect(input.map((b) => b.id)).toEqual(FIXTURE.map((b) => b.id))
  })
})
