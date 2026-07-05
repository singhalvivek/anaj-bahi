import { describe, it, expect } from 'vitest'
import {
  resolveDeductionKg,
  computeGrainLine,
  computeBillTotal,
  roundRupees,
  type Deduction,
  type GrainLineInput,
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
