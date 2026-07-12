import { describe, it, expect } from 'vitest'
import {
  resolveDeductionKg,
  computeGrainLine,
  computeSummaryLine,
  computeBillTotal,
  roundRupees,
  computePaid,
  computeOutstanding,
  isFullyPaid,
  billBalance,
  dueStatus,
  todayIso,
  addDaysIso,
  type Deduction,
  type GrainLineInput,
  type PaymentLike,
} from './index'

describe('roundRupees — half-up to 2 dp', () => {
  it('rounds the documented half-up boundaries exactly', () => {
    expect(roundRupees(3741.715)).toBe(3741.72)
    expect(roundRupees(3741.714)).toBe(3741.71)
  })

  it('leaves already-2dp values unchanged', () => {
    expect(roundRupees(3741.72)).toBe(3741.72)
    expect(roundRupees(3360)).toBe(3360)
    expect(roundRupees(0)).toBe(0)
  })

  it('rounds classic float-error products correctly', () => {
    // 1.55905 * 2400 = 3741.72 (float ~3741.7199999999998)
    expect(roundRupees(1.55905 * 2400)).toBe(3741.72)
    // 1.4452 * 1900 = 2745.88 (float ~2745.8799999999997)
    expect(roundRupees(1.4452 * 1900)).toBe(2745.88)
    expect(roundRupees(0.6 * 5600)).toBe(3360.0)
  })

  it('is idempotent', () => {
    expect(roundRupees(roundRupees(3741.715))).toBe(3741.72)
  })
})

describe('resolveDeductionKg — each basis', () => {
  // gross 159.5 kg over 4 sacks used throughout to exercise every basis
  const gross = 159.5
  const sackCount = 4

  it('per_sack_kg → value × sackCount', () => {
    expect(resolveDeductionKg({ basis: 'per_sack_kg', value: 0.5 }, gross, sackCount)).toBe(2)
  })

  it('per_quintal_kg → value × (gross / 100)', () => {
    expect(resolveDeductionKg({ basis: 'per_quintal_kg', value: 1 }, 148, 3)).toBeCloseTo(1.48, 10)
  })

  it('percent_gross → (value / 100) × gross', () => {
    expect(resolveDeductionKg({ basis: 'percent_gross', value: 1 }, gross, sackCount)).toBeCloseTo(
      1.595,
      10,
    )
  })

  it('flat_kg → value (independent of gross/sacks)', () => {
    expect(resolveDeductionKg({ basis: 'flat_kg', value: 2 }, gross, sackCount)).toBe(2)
    expect(resolveDeductionKg({ basis: 'flat_kg', value: 2 }, 999, 99)).toBe(2)
  })
})

describe('computeGrainLine — worked examples from data.md', () => {
  it('Example 1 — single line, per_sack_kg + percent_gross deductions → ₹3741.72', () => {
    const line: GrainLineInput = {
      pricePerQuintal: 2400,
      sackWeights: [40, 40, 40.5, 39],
      deductions: [
        { basis: 'per_sack_kg', value: 0.5 },
        { basis: 'percent_gross', value: 1 },
      ],
    }
    const totals = computeGrainLine(line)
    expect(totals.sackCount).toBe(4)
    expect(totals.grossWeightKg).toBeCloseTo(159.5, 10)
    expect(totals.deductionKg).toBeCloseTo(3.595, 10)
    expect(totals.netWeightKg).toBeCloseTo(155.905, 10)
    expect(totals.amount).toBe(3741.72)
  })

  it('Example 2 — per_quintal_kg + flat_kg deductions → ₹2745.88', () => {
    const line: GrainLineInput = {
      pricePerQuintal: 1900,
      sackWeights: [50, 50, 48],
      deductions: [
        { basis: 'per_quintal_kg', value: 1 },
        { basis: 'flat_kg', value: 2 },
      ],
    }
    const totals = computeGrainLine(line)
    expect(totals.sackCount).toBe(3)
    expect(totals.grossWeightKg).toBeCloseTo(148, 10)
    expect(totals.deductionKg).toBeCloseTo(3.48, 10)
    expect(totals.netWeightKg).toBeCloseTo(144.52, 10)
    expect(totals.amount).toBe(2745.88)
  })

  it('Example 4 — deductions exceed gross → net clamps to 0, amount ₹0.00', () => {
    const line: GrainLineInput = {
      pricePerQuintal: 2400,
      sackWeights: [10, 10],
      deductions: [{ basis: 'flat_kg', value: 50 }], // 50 kg > 20 kg gross
    }
    const totals = computeGrainLine(line)
    expect(totals.grossWeightKg).toBe(20)
    expect(totals.deductionKg).toBe(50)
    expect(totals.netWeightKg).toBe(0)
    expect(totals.amount).toBe(0)
  })
})

describe('computeGrainLine — edge cases', () => {
  it('zero deductions → net equals gross', () => {
    const line: GrainLineInput = {
      pricePerQuintal: 5600,
      sackWeights: [30, 30],
      deductions: [],
    }
    const totals = computeGrainLine(line)
    expect(totals.grossWeightKg).toBe(60)
    expect(totals.deductionKg).toBe(0)
    expect(totals.netWeightKg).toBe(60)
    expect(totals.amount).toBe(3360)
  })

  it('all four deduction bases additive on one line', () => {
    const line: GrainLineInput = {
      pricePerQuintal: 2000,
      sackWeights: [50, 50], // gross 100, 2 sacks
      deductions: [
        { basis: 'per_sack_kg', value: 0.5 }, // 1 kg
        { basis: 'per_quintal_kg', value: 1 }, // 1 kg (100/100)
        { basis: 'percent_gross', value: 2 }, // 2 kg
        { basis: 'flat_kg', value: 1 }, // 1 kg
      ],
    }
    const totals = computeGrainLine(line)
    expect(totals.deductionKg).toBeCloseTo(5, 10)
    expect(totals.netWeightKg).toBeCloseTo(95, 10)
    expect(totals.amount).toBe(1900) // 0.95 quintal × 2000
  })

  it('decimal sack weights are kept exactly (weights not rounded)', () => {
    const line: GrainLineInput = {
      pricePerQuintal: 2400,
      sackWeights: [40.5, 39.25],
      deductions: [],
    }
    const totals = computeGrainLine(line)
    expect(totals.grossWeightKg).toBeCloseTo(79.75, 10)
    expect(totals.netWeightKg).toBeCloseTo(79.75, 10)
  })

  it('single sack line', () => {
    const line: GrainLineInput = {
      pricePerQuintal: 1000,
      sackWeights: [100],
      deductions: [],
    }
    const totals = computeGrainLine(line)
    expect(totals.sackCount).toBe(1)
    expect(totals.grossWeightKg).toBe(100)
    expect(totals.amount).toBe(1000)
  })

  it('empty line (no sacks) → all zeros', () => {
    const line: GrainLineInput = {
      pricePerQuintal: 2400,
      sackWeights: [],
      deductions: [],
    }
    const totals = computeGrainLine(line)
    expect(totals.sackCount).toBe(0)
    expect(totals.grossWeightKg).toBe(0)
    expect(totals.deductionKg).toBe(0)
    expect(totals.netWeightKg).toBe(0)
    expect(totals.amount).toBe(0)
  })

  it('exactly-equal deductions and gross → net 0 (boundary of clamp)', () => {
    const line: GrainLineInput = {
      pricePerQuintal: 2400,
      sackWeights: [20],
      deductions: [{ basis: 'flat_kg', value: 20 }],
    }
    const totals = computeGrainLine(line)
    expect(totals.netWeightKg).toBe(0)
    expect(totals.amount).toBe(0)
  })

  it('is pure — same input yields same output and does not mutate input', () => {
    const line: GrainLineInput = {
      pricePerQuintal: 2400,
      sackWeights: [40, 40],
      deductions: [{ basis: 'per_sack_kg', value: 0.5 }],
    }
    const snapshot = JSON.stringify(line)
    const a = computeGrainLine(line)
    const b = computeGrainLine(line)
    expect(a).toEqual(b)
    expect(JSON.stringify(line)).toBe(snapshot)
  })
})

describe('computeBillTotal', () => {
  const lineA: GrainLineInput = {
    pricePerQuintal: 2400,
    sackWeights: [40, 40, 40.5, 39],
    deductions: [
      { basis: 'per_sack_kg', value: 0.5 },
      { basis: 'percent_gross', value: 1 },
    ],
  }
  const lineB: GrainLineInput = {
    pricePerQuintal: 5600,
    sackWeights: [30, 30],
    deductions: [],
  }

  it('Example 3 — multi-line bill total = sum of rounded line amounts → ₹7101.72', () => {
    expect(computeGrainLine(lineA).amount).toBe(3741.72)
    expect(computeGrainLine(lineB).amount).toBe(3360.0)
    expect(computeBillTotal([lineA, lineB])).toBe(7101.72)
  })

  it('single-line bill total equals that line amount', () => {
    expect(computeBillTotal([lineA])).toBe(3741.72)
  })

  it('empty bill → ₹0.00', () => {
    expect(computeBillTotal([])).toBe(0)
  })

  it('sums rounded line amounts (no penny drift vs unrounded sum)', () => {
    // Two lines each rounding up by ~half a paisa: printed total = sum of printed lines.
    const l: GrainLineInput = {
      pricePerQuintal: 333,
      sackWeights: [33.35], // 0.3335 q × 333 = 111.0555 → 111.06
      deductions: [],
    }
    const each = computeGrainLine(l).amount
    expect(each).toBe(111.06)
    expect(computeBillTotal([l, l])).toBe(222.12) // 111.06 + 111.06
  })
})

// ---------------------------------------------------------------------------
// Phase 5 — summary (quick-entry) lines: amount entered verbatim, dispatch
// ---------------------------------------------------------------------------

describe('computeSummaryLine — entered amount is authoritative', () => {
  it('Example 5 — returns gross/net/deduction/sackCount from totals; amount verbatim', () => {
    // Wheat, price 2400, totalWeight 159.5, deduction 3.595, sackCount 4, amount 3741.72
    const totals = computeSummaryLine(2400, {
      totalWeightKg: 159.5,
      deductionKg: 3.595,
      sackCount: 4,
      amount: 3741.72,
    })
    expect(totals.grossWeightKg).toBeCloseTo(159.5, 10)
    expect(totals.deductionKg).toBeCloseTo(3.595, 10)
    expect(totals.netWeightKg).toBeCloseTo(155.905, 10)
    expect(totals.sackCount).toBe(4)
    expect(totals.amount).toBe(3741.72)
  })

  it('entered amount wins even when net × price would differ (NOT recomputed)', () => {
    // Same figures as above but a deliberately mismatched entered amount 3700.
    // net × price would be 155.905/100 × 2400 = 3741.72, but 3700 is returned.
    const totals = computeSummaryLine(2400, {
      totalWeightKg: 159.5,
      deductionKg: 3.595,
      sackCount: 4,
      amount: 3700,
    })
    expect(totals.netWeightKg).toBeCloseTo(155.905, 10)
    expect(totals.amount).toBe(3700)
    // prove it is NOT the weight×price figure
    expect(totals.amount).not.toBe(3741.72)
  })

  it('rounds the entered amount half-up to 2 dp', () => {
    const totals = computeSummaryLine(2400, { totalWeightKg: 100, amount: 3741.715 })
    expect(totals.amount).toBe(3741.72)
  })

  it('deductionKg defaults to 0 and sackCount to 0 when omitted', () => {
    const totals = computeSummaryLine(2400, { totalWeightKg: 200, amount: 5000 })
    expect(totals.deductionKg).toBe(0)
    expect(totals.netWeightKg).toBe(200)
    expect(totals.sackCount).toBe(0)
    expect(totals.amount).toBe(5000)
  })

  it('net clamps at 0 when deduction exceeds gross (amount still verbatim)', () => {
    const totals = computeSummaryLine(2400, {
      totalWeightKg: 20,
      deductionKg: 50,
      amount: 123.45,
    })
    expect(totals.netWeightKg).toBe(0)
    expect(totals.amount).toBe(123.45)
  })
})

describe('computeGrainLine — dispatches on line.summary', () => {
  it('routes a summary line to the entered amount (ignores sackWeights/deductions)', () => {
    const totals = computeGrainLine({
      pricePerQuintal: 2400,
      sackWeights: [], // summary lines carry empty arrays
      deductions: [],
      summary: { totalWeightKg: 159.5, deductionKg: 3.595, sackCount: 4, amount: 3700 },
    })
    expect(totals.grossWeightKg).toBeCloseTo(159.5, 10)
    expect(totals.netWeightKg).toBeCloseTo(155.905, 10)
    expect(totals.sackCount).toBe(4)
    expect(totals.amount).toBe(3700) // entered, not recomputed
  })

  it('a sacks line (no summary) is unchanged — takes the sacks path', () => {
    const totals = computeGrainLine({
      pricePerQuintal: 2400,
      sackWeights: [40, 40, 40.5, 39],
      deductions: [
        { basis: 'per_sack_kg', value: 0.5 },
        { basis: 'percent_gross', value: 1 },
      ],
    })
    expect(totals.amount).toBe(3741.72)
  })
})

describe('computeBillTotal — mixed sacks + summary bill', () => {
  it('sums a sacks line amount and a summary line entered amount', () => {
    const sacksLine: GrainLineInput = {
      pricePerQuintal: 2400,
      sackWeights: [40, 40, 40.5, 39],
      deductions: [
        { basis: 'per_sack_kg', value: 0.5 },
        { basis: 'percent_gross', value: 1 },
      ],
    }
    // computed amount 3741.72
    const summaryLine: GrainLineInput = {
      pricePerQuintal: 5600,
      sackWeights: [],
      deductions: [],
      summary: { totalWeightKg: 60, amount: 3360.0 },
    }
    // entered amount 3360.00
    expect(computeGrainLine(sacksLine).amount).toBe(3741.72)
    expect(computeGrainLine(summaryLine).amount).toBe(3360.0)
    expect(computeBillTotal([sacksLine, summaryLine])).toBe(7101.72)
  })

  it('a two-summary-line bill totals the entered amounts (₹3741.72 + ₹3360.00)', () => {
    const a: GrainLineInput = {
      pricePerQuintal: 2400,
      sackWeights: [],
      deductions: [],
      summary: { totalWeightKg: 159.5, deductionKg: 3.595, sackCount: 4, amount: 3741.72 },
    }
    const b: GrainLineInput = {
      pricePerQuintal: 5600,
      sackWeights: [],
      deductions: [],
      summary: { totalWeightKg: 60, amount: 3360.0 },
    }
    expect(computeBillTotal([a, b])).toBe(7101.72)
  })
})

// ---------------------------------------------------------------------------
// Phase 2 — payments, balance & due status
// ---------------------------------------------------------------------------

const pay = (amount: number): PaymentLike => ({ amount })

describe('computePaid / computeOutstanding / isFullyPaid', () => {
  it('no payments → paid 0, outstanding equals bill total, not fully paid', () => {
    expect(computePaid([])).toBe(0)
    expect(computeOutstanding(3741.72, [])).toBe(3741.72)
    expect(isFullyPaid(3741.72, [])).toBe(false)
  })

  it('single partial payment on a ₹3741.72 bill: pay 1741.72 → paid 1741.72, outstanding 2000.00', () => {
    const payments = [pay(1741.72)]
    expect(computePaid(payments)).toBe(1741.72)
    expect(computeOutstanding(3741.72, payments)).toBe(2000.0)
    expect(isFullyPaid(3741.72, payments)).toBe(false)
  })

  it('second payment settles it exactly: +2000.00 → paid 3741.72, outstanding 0.00, fully paid', () => {
    const payments = [pay(1741.72), pay(2000.0)]
    expect(computePaid(payments)).toBe(3741.72)
    expect(computeOutstanding(3741.72, payments)).toBe(0.0)
    expect(isFullyPaid(3741.72, payments)).toBe(true)
  })

  it('overpayment: pay 4000 on a ₹3741.72 bill → outstanding ≤ 0, fully paid (no negative-looking bug)', () => {
    const payments = [pay(4000)]
    const outstanding = computeOutstanding(3741.72, payments)
    expect(outstanding).toBeLessThanOrEqual(0)
    expect(outstanding).toBe(-258.28)
    expect(isFullyPaid(3741.72, payments)).toBe(true)
  })

  it('multiple partial payments sum correctly with rounding (no penny drift)', () => {
    // 111.06 + 111.06 + 111.06 = 333.18 against a 333.18 bill → settled.
    const payments = [pay(111.06), pay(111.06), pay(111.06)]
    expect(computePaid(payments)).toBe(333.18)
    expect(computeOutstanding(333.18, payments)).toBe(0)
    expect(isFullyPaid(333.18, payments)).toBe(true)
  })

  it('many float-y partials round to a clean paise sum', () => {
    const payments = [pay(0.1), pay(0.2)] // 0.1 + 0.2 = 0.30000000000000004 in float
    expect(computePaid(payments)).toBe(0.3)
    expect(computeOutstanding(1, payments)).toBe(0.7)
  })
})

describe('billBalance', () => {
  const lineA: GrainLineInput = {
    pricePerQuintal: 2400,
    sackWeights: [40, 40, 40.5, 39],
    deductions: [
      { basis: 'per_sack_kg', value: 0.5 },
      { basis: 'percent_gross', value: 1 },
    ],
  }
  const lineB: GrainLineInput = {
    pricePerQuintal: 5600,
    sackWeights: [30, 30],
    deductions: [],
  }

  it('snapshots total/paid/outstanding/fullyPaid for a partly-paid multi-line bill', () => {
    // total = 3741.72 + 3360.00 = 7101.72
    const balance = billBalance({ lines: [lineA, lineB], payments: [pay(1000), pay(500)] })
    expect(balance.total).toBe(7101.72)
    expect(balance.paid).toBe(1500)
    expect(balance.outstanding).toBe(5601.72)
    expect(balance.fullyPaid).toBe(false)
  })

  it('fully-paid bill reports outstanding 0 and fullyPaid true', () => {
    const balance = billBalance({ lines: [lineA], payments: [pay(3741.72)] })
    expect(balance.total).toBe(3741.72)
    expect(balance.paid).toBe(3741.72)
    expect(balance.outstanding).toBe(0)
    expect(balance.fullyPaid).toBe(true)
  })

  it('no payments → outstanding equals total, not fully paid', () => {
    const balance = billBalance({ lines: [lineA], payments: [] })
    expect(balance.outstanding).toBe(3741.72)
    expect(balance.fullyPaid).toBe(false)
  })
})

describe('billBalance — paldari (Phase 10)', () => {
  const lineA: GrainLineInput = {
    pricePerQuintal: 2400,
    sackWeights: [40, 40, 40.5, 39],
    deductions: [
      { basis: 'per_sack_kg', value: 0.5 },
      { basis: 'percent_gross', value: 1 },
    ],
  }

  it('paldari subtracts from total and outstanding (no payments)', () => {
    // lineA amount 3741.72; paldari 200 → payable total 3541.72
    const balance = billBalance({ lines: [lineA], paldari: 200, payments: [] })
    expect(balance.linesTotal).toBe(3741.72)
    expect(balance.paldari).toBe(200)
    expect(balance.total).toBe(3541.72)
    expect(balance.paid).toBe(0)
    expect(balance.outstanding).toBe(3541.72)
    expect(balance.fullyPaid).toBe(false)
  })

  it('absent paldari behaves exactly as before — total === linesTotal, paldari 0', () => {
    const balance = billBalance({ lines: [lineA], payments: [] })
    expect(balance.linesTotal).toBe(3741.72)
    expect(balance.paldari).toBe(0)
    expect(balance.total).toBe(3741.72)
    expect(balance.total).toBe(balance.linesTotal)
    expect(balance.outstanding).toBe(3741.72)
  })

  it('paldari with a partial payment → outstanding = linesTotal − paldari − paid', () => {
    // 3741.72 − 200 − 1000 = 2541.72
    const balance = billBalance({ lines: [lineA], paldari: 200, payments: [pay(1000)] })
    expect(balance.total).toBe(3541.72)
    expect(balance.paid).toBe(1000)
    expect(balance.outstanding).toBe(2541.72)
    expect(balance.fullyPaid).toBe(false)
  })

  it('paldari rounds half-up to 2 dp (200.005 → 200.01 effect)', () => {
    const balance = billBalance({ lines: [lineA], paldari: 200.005, payments: [] })
    expect(balance.paldari).toBe(200.01)
    expect(balance.total).toBe(3541.71) // 3741.72 − 200.01
  })

  it('paldari can settle the whole bill (outstanding ≤ 0, fully paid)', () => {
    const balance = billBalance({ lines: [lineA], paldari: 3741.72, payments: [] })
    expect(balance.total).toBe(0)
    expect(balance.outstanding).toBe(0)
    expect(balance.fullyPaid).toBe(true)
  })
})

describe('addDaysIso', () => {
  it('adds days across a month boundary', () => {
    expect(addDaysIso('2026-07-06', 3)).toBe('2026-07-09')
    expect(addDaysIso('2026-07-30', 7)).toBe('2026-08-06')
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('adds zero days → same date', () => {
    expect(addDaysIso('2026-07-06', 0)).toBe('2026-07-06')
  })
})

describe('todayIso', () => {
  it('returns a well-formed ISO yyyy-mm-dd string', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('dueStatus', () => {
  const today = '2026-07-06'

  it('past due date with outstanding > 0 → overdue', () => {
    expect(dueStatus('2026-07-01', 2000, today)).toBe('overdue')
  })

  it('due date today+3 with outstanding > 0 → due_soon', () => {
    expect(dueStatus(addDaysIso(today, 3), 2000, today)).toBe('due_soon')
  })

  it('due date exactly today → due_soon (inclusive lower bound)', () => {
    expect(dueStatus(today, 2000, today)).toBe('due_soon')
  })

  it('due date exactly today+7 (soon window edge) → due_soon; today+8 → upcoming', () => {
    expect(dueStatus(addDaysIso(today, 7), 2000, today)).toBe('due_soon')
    expect(dueStatus(addDaysIso(today, 8), 2000, today)).toBe('upcoming')
  })

  it('due date today+30 → upcoming', () => {
    expect(dueStatus(addDaysIso(today, 30), 2000, today)).toBe('upcoming')
  })

  it('fully-paid bill (outstanding ≤ 0) → none even if overdue by date', () => {
    expect(dueStatus('2026-07-01', 0, today)).toBe('none')
    expect(dueStatus('2026-07-01', -50, today)).toBe('none')
  })

  it('no due date → none regardless of outstanding', () => {
    expect(dueStatus(undefined, 5000, today)).toBe('none')
  })

  it('honours a custom soonDays window', () => {
    expect(dueStatus(addDaysIso(today, 10), 2000, today, 14)).toBe('due_soon')
    expect(dueStatus(addDaysIso(today, 10), 2000, today, 7)).toBe('upcoming')
  })
})
