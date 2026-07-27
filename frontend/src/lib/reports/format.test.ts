import { describe, it, expect } from 'vitest'
import { roundToRupee, groupIndian, formatRupeesIndian } from './format'
import { formatRupees } from '@/components/format'

// Phase 12 — the aggregate formatters. Cases are taken verbatim from
// architecture.md § Phase-12 contract and data.md § Display rounding.

describe('roundToRupee — half-up on the absolute value', () => {
  it('rounds the documented cases exactly', () => {
    expect(roundToRupee(1200.55)).toBe(1201)
    expect(roundToRupee(4000.3)).toBe(4000)
    expect(roundToRupee(-258.28)).toBe(-258)
    expect(roundToRupee(0)).toBe(0)
  })

  it('rounds a true .5 boundary AWAY from zero on both signs (abs, so the sign never skews it)', () => {
    // Math.round alone would give -258 here (it rounds toward +∞).
    expect(roundToRupee(258.5)).toBe(259)
    expect(roundToRupee(-258.5)).toBe(-259)
    expect(roundToRupee(0.5)).toBe(1)
    expect(roundToRupee(-0.5)).toBe(-1)
  })

  it('leaves whole rupees unchanged and is idempotent', () => {
    expect(roundToRupee(6902)).toBe(6902)
    expect(roundToRupee(roundToRupee(1200.55))).toBe(1201)
  })

  it('EDGE — a sub-rupee amount collapses to a signed-free zero (never -0)', () => {
    expect(roundToRupee(0.2)).toBe(0)
    expect(roundToRupee(-0.2)).toBe(0)
    // Object.is(-0, 0) is false, so a -0 leak would break every toBe(0) downstream.
    expect(Object.is(roundToRupee(-0.2), 0)).toBe(true)
  })

  it('ERROR PATH — a non-finite amount degrades to 0 instead of NaN poisoning a total', () => {
    expect(roundToRupee(Number.NaN)).toBe(0)
    expect(roundToRupee(Number.POSITIVE_INFINITY)).toBe(0)
    expect(roundToRupee(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})

describe('groupIndian — hand-rolled last-3-then-pairs (no Intl)', () => {
  it('groups the documented cases', () => {
    expect(groupIndian(0)).toBe('0')
    expect(groupIndian(999)).toBe('999')
    expect(groupIndian(1000)).toBe('1,000')
    expect(groupIndian(100000)).toBe('1,00,000')
    expect(groupIndian(420000)).toBe('4,20,000')
    expect(groupIndian(12345678)).toBe('1,23,45,678')
  })

  it('keeps the sign outside the grouping', () => {
    expect(groupIndian(-420000)).toBe('-4,20,000')
    expect(groupIndian(-999)).toBe('-999')
  })

  it('EDGE — the boundaries either side of each group', () => {
    expect(groupIndian(99)).toBe('99')
    expect(groupIndian(1234)).toBe('1,234')
    expect(groupIndian(99999)).toBe('99,999')
    expect(groupIndian(9999999)).toBe('99,99,999')
    expect(groupIndian(14591)).toBe('14,591')
    expect(groupIndian(17603)).toBe('17,603')
  })

  it('ERROR PATH — a non-integer/non-finite input never yields "NaN" or a decimal point', () => {
    expect(groupIndian(1200.55)).toBe('1,200') // truncated, not formatted as a decimal
    expect(groupIndian(Number.NaN)).toBe('0')
    expect(groupIndian(Number.POSITIVE_INFINITY)).toBe('0')
  })
})

describe('formatRupeesIndian — the ONLY money formatter on rollup surfaces', () => {
  it('formats whole rupees with Indian grouping and no paise', () => {
    expect(formatRupeesIndian(0)).toBe('₹0')
    expect(formatRupeesIndian(999)).toBe('₹999')
    expect(formatRupeesIndian(1000)).toBe('₹1,000')
    expect(formatRupeesIndian(420000)).toBe('₹4,20,000')
    expect(formatRupeesIndian(12345678)).toBe('₹1,23,45,678')
  })

  it('rounds internally, so it is idempotent on the already-integer rollup figures', () => {
    expect(formatRupeesIndian(1200.55)).toBe('₹1,201')
    expect(formatRupeesIndian(4000.3)).toBe('₹4,000')
    expect(formatRupeesIndian(14591)).toBe('₹14,591')
  })
})

describe('the per-bill formatter is untouched (regression guard)', () => {
  it('formatRupees still renders 2 dp with NO thousands separators', () => {
    // Shipped E2E specs assert this literal and the rasterised receipt depends on it.
    expect(formatRupees(7101.72)).toBe('₹7101.72')
    expect(formatRupees(420000)).toBe('₹420000.00')
  })

  it('the two formatters coexist and are deliberately different', () => {
    expect(formatRupees(1200.55)).toBe('₹1200.55')
    expect(formatRupeesIndian(1200.55)).toBe('₹1,201')
  })
})
