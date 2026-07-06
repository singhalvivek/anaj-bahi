import { describe, it, expect } from 'vitest'
import { toColumns, columnSubtotals, fmtNum, deductionSummary } from './columns'
import { computeGrainLine, resolveDeductionKg, type Deduction } from '@/lib/calc'

describe('toColumns — ceil(N / perColumn) columns, entry order preserved', () => {
  it('empty input → 0 columns', () => {
    expect(toColumns([])).toEqual([])
  })

  it('1 sack → 1 column of 1', () => {
    expect(toColumns([42])).toEqual([[42]])
  })

  it('exactly 10 sacks → 1 column of 10 (no empty second column)', () => {
    const w = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const cols = toColumns(w)
    expect(cols).toHaveLength(1)
    expect(cols[0]).toEqual(w)
  })

  it('11 sacks → 2 columns split 10 + 1', () => {
    const w = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    const cols = toColumns(w)
    expect(cols).toHaveLength(2)
    expect(cols[0]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(cols[1]).toEqual([11])
  })

  it('25 sacks → 3 columns split 10 + 10 + 5 with the right entry-order slices', () => {
    const w = Array.from({ length: 25 }, (_, i) => i + 1) // 1..25 in entry order
    const cols = toColumns(w)
    expect(cols.map((c) => c.length)).toEqual([10, 10, 5])
    expect(cols[0]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(cols[1]).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    expect(cols[2]).toEqual([21, 22, 23, 24, 25])
  })

  it('100 sacks (app cap) → exactly 10 full columns', () => {
    const w = Array.from({ length: 100 }, (_, i) => i + 1)
    const cols = toColumns(w)
    expect(cols).toHaveLength(10)
    expect(cols.every((c) => c.length === 10)).toBe(true)
    // Flattening back gives the original entry order.
    expect(cols.flat()).toEqual(w)
  })

  it('preserves decimal weights exactly (no rounding)', () => {
    const w = [40.5, 39.25, 100.125, 0.5]
    expect(toColumns(w)).toEqual([[40.5, 39.25, 100.125, 0.5]])
  })

  it('honours a custom perColumn', () => {
    const w = [1, 2, 3, 4, 5]
    expect(toColumns(w, 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('does not mutate the input array', () => {
    const w = [1, 2, 3]
    const copy = [...w]
    toColumns(w)
    expect(w).toEqual(copy)
  })

  it('rejects a non-positive or non-integer perColumn', () => {
    expect(() => toColumns([1], 0)).toThrow()
    expect(() => toColumns([1], -1)).toThrow()
    expect(() => toColumns([1], 2.5)).toThrow()
  })
})

describe('columnSubtotals — sum of each column', () => {
  it('empty → empty', () => {
    expect(columnSubtotals([])).toEqual([])
  })

  it('subtotal equals the sum of each column (25 sacks → 10/10/5)', () => {
    const w = Array.from({ length: 25 }, (_, i) => i + 1) // 1..25
    const cols = toColumns(w)
    // 1..10 = 55, 11..20 = 155, 21..25 = 115
    expect(columnSubtotals(cols)).toEqual([55, 155, 115])
  })

  it('matches the worked receipt example: 12 sacks (50×10 | 45,40) → [500, 85]', () => {
    const wheat = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 45, 40]
    const cols = toColumns(wheat)
    expect(cols.map((c) => c.length)).toEqual([10, 2])
    expect(columnSubtotals(cols)).toEqual([500, 85])
  })

  it('preserves decimal precision in the subtotal', () => {
    const cols = toColumns([40.5, 39.5, 20.25])
    expect(columnSubtotals(cols)).toEqual([100.25])
  })

  it('a single short column subtotals to the sum of its members', () => {
    expect(columnSubtotals(toColumns([40, 40, 40, 40, 40, 40]))).toEqual([240])
  })
})

describe('fmtNum — integers bare, decimals trimmed to 3 dp', () => {
  it('renders integers without a decimal point', () => {
    expect(fmtNum(40)).toBe('40')
    expect(fmtNum(0)).toBe('0')
    expect(fmtNum(159)).toBe('159')
  })

  it('renders decimals trimmed to at most 3 places, no trailing zeros', () => {
    expect(fmtNum(0.5)).toBe('0.5')
    expect(fmtNum(3.595)).toBe('3.595')
    expect(fmtNum(1.48)).toBe('1.48')
    expect(fmtNum(159.5)).toBe('159.5')
  })
})

/**
 * Deduction-cell helper — the receipt's most regression-prone new string. Every case
 * cross-checks `kg` against the UNCHANGED @/lib/calc engine (resolveDeductionKg /
 * computeGrainLine), so the receipt and the engine can never silently diverge.
 * `note` is the compact per-basis string the receipt wraps in parentheses.
 */
describe('deductionSummary — resolved kg (via @/lib/calc) + compact basis note', () => {
  it('empty deductions → kg 0, note "" (the deduction-free path every prior test used)', () => {
    const line = { sackWeights: [40, 40, 40], deductions: [] as Deduction[] }
    expect(deductionSummary(line)).toEqual({ kg: 0, note: '' })
    // matches the engine's deduction-free line
    expect(computeGrainLine({ ...line, pricePerQuintal: 2000 }).deductionKg).toBe(0)
  })

  it('WORKED EXAMPLE — wheat [40,40,40.5,39] (gross 159.5, 4 sacks) + per_sack_kg 0.5 + percent_gross 1 → 3.595 kg, "0.5/sack + 1%"', () => {
    const line = {
      sackWeights: [40, 40, 40.5, 39],
      deductions: [
        { basis: 'per_sack_kg', value: 0.5 },
        { basis: 'percent_gross', value: 1 },
      ] as Deduction[],
    }
    // per_sack_kg: 0.5 × 4 = 2 ; percent_gross: 1% × 159.5 = 1.595 ; total 3.595
    const summary = deductionSummary(line)
    // Raw kg carries binary-float tail (3.5949999999999998) exactly as the engine does;
    // the receipt renders it through fmtNum → "3.595" (the byte-identical displayed value).
    expect(summary.kg).toBeCloseTo(3.595, 10)
    expect(fmtNum(summary.kg)).toBe('3.595')
    expect(summary.note).toBe('0.5/sack + 1%')
    // The rendered cell text the receipt composes for this line.
    expect(`${fmtNum(summary.kg)} kg (${summary.note})`).toBe('3.595 kg (0.5/sack + 1%)')
    // kg matches the calc engine EXACTLY (same float, no divergence).
    expect(summary.kg).toBe(
      computeGrainLine({ ...line, pricePerQuintal: 2000 }).deductionKg,
    )
  })

  it('per_quintal_kg 1 on gross 148 ([50,50,48], 3 sacks) → 1.48 kg, "1/qtl"', () => {
    const line = {
      sackWeights: [50, 50, 48],
      deductions: [{ basis: 'per_quintal_kg', value: 1 }] as Deduction[],
    }
    const summary = deductionSummary(line)
    expect(summary.kg).toBe(1.48) // 1 × (148 / 100)
    expect(summary.note).toBe('1/qtl')
    expect(summary.kg).toBe(resolveDeductionKg(line.deductions[0], 148, 3))
  })

  it('flat_kg 2 → 2 kg, "2 kg" (independent of gross/sackCount)', () => {
    const line = {
      sackWeights: [30, 30, 30],
      deductions: [{ basis: 'flat_kg', value: 2 }] as Deduction[],
    }
    const summary = deductionSummary(line)
    expect(summary.kg).toBe(2)
    expect(summary.note).toBe('2 kg')
    expect(summary.kg).toBe(resolveDeductionKg(line.deductions[0], 90, 3))
  })

  it('percent_gross 1 alone → 1% of gross, "1%"', () => {
    const line = {
      sackWeights: [50, 50, 48], // gross 148
      deductions: [{ basis: 'percent_gross', value: 1 }] as Deduction[],
    }
    const summary = deductionSummary(line)
    expect(summary.kg).toBe(1.48) // 1% × 148
    expect(summary.note).toBe('1%')
    expect(summary.kg).toBe(resolveDeductionKg(line.deductions[0], 148, 3))
  })

  it('per_sack_kg 0.5 alone → 0.5 × sackCount, "0.5/sack"', () => {
    const line = {
      sackWeights: [40, 40, 40.5, 39], // 4 sacks
      deductions: [{ basis: 'per_sack_kg', value: 0.5 }] as Deduction[],
    }
    const summary = deductionSummary(line)
    expect(summary.kg).toBe(2) // 0.5 × 4
    expect(summary.note).toBe('0.5/sack')
    expect(summary.kg).toBe(resolveDeductionKg(line.deductions[0], 159.5, 4))
  })

  it('ALL FOUR bases combined → summed kg matches the engine, note joins in order with " + "', () => {
    const line = {
      sackWeights: [50, 50, 48], // gross 148, 3 sacks
      deductions: [
        { basis: 'per_sack_kg', value: 0.5 }, // 1.5
        { basis: 'per_quintal_kg', value: 1 }, // 1.48
        { basis: 'percent_gross', value: 1 }, // 1.48
        { basis: 'flat_kg', value: 2 }, // 2
      ] as Deduction[],
    }
    const summary = deductionSummary(line)
    const expectedKg =
      resolveDeductionKg(line.deductions[0], 148, 3) +
      resolveDeductionKg(line.deductions[1], 148, 3) +
      resolveDeductionKg(line.deductions[2], 148, 3) +
      resolveDeductionKg(line.deductions[3], 148, 3)
    expect(summary.kg).toBe(expectedKg) // 6.46
    expect(summary.note).toBe('0.5/sack + 1/qtl + 1% + 2 kg')
    // kg also matches computeGrainLine's aggregate deductionKg.
    expect(summary.kg).toBe(
      computeGrainLine({ ...line, pricePerQuintal: 1500 }).deductionKg,
    )
  })

  it('does not mutate the input line', () => {
    const deductions: Deduction[] = [{ basis: 'flat_kg', value: 2 }]
    const sackWeights = [30, 30]
    const before = JSON.stringify({ sackWeights, deductions })
    deductionSummary({ sackWeights, deductions })
    expect(JSON.stringify({ sackWeights, deductions })).toBe(before)
  })
})
