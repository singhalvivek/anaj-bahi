import { describe, it, expect } from 'vitest'
import { computeGrainLine, roundRupees } from '@/lib/calc'
import { verifyReadBill, CONFIDENCE_THRESHOLD } from './verify'
import type { ReadBill, ReadBillLine, ReadField } from './types'

// Phase 13 — the seven rules frozen in spec/architecture.md § Bill Check.
//
// Every figure here is derived by hand from the stated inputs, not copied out of a
// run of the code: this module decides whether the app tells a trader his paper
// arithmetic is wrong, and a test that merely echoes the implementation would
// prove nothing about that.
//
// Worked example used throughout (two grains, a deduction on the first):
//   Wheat   — ₹2455/qtl, 1524 kg gross, 5 kg deduction -> net 1519 kg
//             amount = 15.19 qtl x 2455 = ₹37,291.45
//   Mustard — ₹4800/qtl,   70 kg gross, no deduction   -> net 70 kg
//             amount =  0.70 qtl x 4800 =  ₹3,360.00
//   Correct bill total = ₹40,651.45

const WHEAT_AMOUNT = 37291.45
const MUSTARD_AMOUNT = 3360.0
const CORRECT_TOTAL = 40651.45

function sure<T>(value: T): ReadField<T> {
  return { value, confidence: 1 }
}

function unsure<T>(value: T): ReadField<T> {
  return { value, confidence: 0.4 }
}

function unread<T>(): ReadField<T> {
  return { value: null, confidence: 0 }
}

function line(p: {
  grain?: string
  rate?: ReadField<number>
  weight?: ReadField<number>
  deduction?: ReadField<number>
  sacks?: ReadField<number>
  amount?: ReadField<number>
}): ReadBillLine {
  return {
    grainName: sure(p.grain ?? 'Wheat'),
    ratePerQuintal: p.rate ?? sure(2455),
    weightKg: p.weight ?? sure(1524),
    deductionKg: p.deduction ?? sure(5),
    sackCount: p.sacks ?? sure(30),
    amount: p.amount ?? sure(WHEAT_AMOUNT),
  }
}

const WHEAT = line({})
const MUSTARD = line({
  grain: 'Mustard',
  rate: sure(4800),
  weight: sure(70),
  deduction: sure(0),
  sacks: sure(2),
  amount: sure(MUSTARD_AMOUNT),
})

function bill(p: {
  lines?: ReadBillLine[]
  paldari?: ReadField<number>
  paperTotal?: ReadField<number>
}): ReadBill {
  return {
    farmerName: sure('Girdhari'),
    place: sure('Kheri'),
    date: sure('2026-10-15'),
    lines: p.lines ?? [WHEAT, MUSTARD],
    paldari: p.paldari ?? sure(0),
    paperTotal: p.paperTotal ?? sure(CORRECT_TOTAL),
  }
}

describe('verifyReadBill — a bill whose arithmetic is right', () => {
  it('passes with both diffs exactly zero', () => {
    const r = verifyReadBill(bill({}))
    expect(r.verdict).toBe('ok')
    expect(r.sumWritten).toBe(CORRECT_TOTAL)
    expect(r.sumComputed).toBe(CORRECT_TOTAL)
    expect(r.paperTotal).toBe(CORRECT_TOTAL)
    expect(r.mathDiff).toBe(0)
    expect(r.additionDiff).toBe(0)
    expect(r.unsureCount).toBe(0)
  })

  it('computes each line through lib/calc, net of its deduction', () => {
    const r = verifyReadBill(bill({}))
    const [wheat, mustard] = r.lines
    expect(wheat.netWeightKg).toBe(1519) // 1524 − 5
    expect(wheat.computedAmount).toBe(WHEAT_AMOUNT)
    expect(wheat.lineDiff).toBe(0)
    expect(mustard.netWeightKg).toBe(70)
    expect(mustard.computedAmount).toBe(MUSTARD_AMOUNT)
    expect(mustard.lineDiff).toBe(0)
  })

  it('never re-implements the formula — computedAmount equals lib/calc exactly', () => {
    // Rule 1. If this ever diverges, the screen is showing the trader a number the
    // rest of the app would not agree with, which is the one thing it must not do.
    const r = verifyReadBill(bill({}))
    const viaCalc = computeGrainLine({
      pricePerQuintal: 2455,
      sackWeights: [1524],
      deductions: [{ basis: 'flat_kg', value: 5 }],
    }).amount
    expect(r.lines[0].computedAmount).toBe(viaCalc)
  })
})

describe('verifyReadBill — line math is wrong (mathDiff)', () => {
  it('reports the exact rupee difference when a written amount is too high', () => {
    // He wrote ₹13.32 more than rate x net on the wheat line.
    const written = roundRupees(WHEAT_AMOUNT + 13.32)
    const r = verifyReadBill(
      bill({
        lines: [line({ amount: sure(written) }), MUSTARD],
        paperTotal: sure(roundRupees(written + MUSTARD_AMOUNT)),
      }),
    )
    expect(r.verdict).toBe('check')
    expect(r.lines[0].lineDiff).toBe(13.32)
    expect(r.mathDiff).toBe(13.32)
    // His addition of his own (wrong) lines is still correct — the two are separate.
    expect(r.additionDiff).toBe(0)
  })

  it('signs the difference when a written amount is too low', () => {
    const written = roundRupees(WHEAT_AMOUNT - 100)
    const r = verifyReadBill(
      bill({
        lines: [line({ amount: sure(written) }), MUSTARD],
        paperTotal: sure(roundRupees(written + MUSTARD_AMOUNT)),
      }),
    )
    expect(r.lines[0].lineDiff).toBe(-100)
    expect(r.mathDiff).toBe(-100)
  })
})

describe('verifyReadBill — addition is wrong (additionDiff)', () => {
  it('flags a mis-added grand total while the lines themselves are correct', () => {
    // Rule 3, the headline case: every line right, column added wrong by ₹20.
    const r = verifyReadBill(bill({ paperTotal: sure(roundRupees(CORRECT_TOTAL - 20)) }))
    expect(r.verdict).toBe('check')
    expect(r.mathDiff).toBe(0) // the lines are fine
    expect(r.additionDiff).toBe(-20) // the addition is not
    expect(r.lines.every((l) => l.lineDiff === 0)).toBe(true)
  })

  it('reports both diffs independently when BOTH are wrong', () => {
    // Rule 3 in the other direction — the two must not mask each other.
    const written = roundRupees(WHEAT_AMOUNT + 13.32)
    const r = verifyReadBill(
      bill({
        lines: [line({ amount: sure(written) }), MUSTARD],
        paperTotal: sure(roundRupees(written + MUSTARD_AMOUNT + 50)),
      }),
    )
    expect(r.mathDiff).toBe(13.32)
    expect(r.additionDiff).toBe(50)
  })

  it('yields additionDiff null — never 0 — when the paper has no grand total', () => {
    // Rule 4. "No total written" and "your addition is correct" are different
    // statements; reporting 0 here would invent a pass the paper never claimed.
    const r = verifyReadBill(bill({ paperTotal: unread<number>() }))
    expect(r.additionDiff).toBeNull()
    expect(r.paperTotal).toBeNull()
    expect(r.mathDiff).toBe(0)
    expect(r.verdict).toBe('ok') // the lines check out, which is all the paper asserted
  })
})

describe('verifyReadBill — paldari', () => {
  it('belongs to the TOTAL comparison, never to the line comparison', () => {
    // Rule 2, and the single most important case in this file. A real bill writes
    // grain lines GROSS, then one paldari charge, then the payable total:
    //   lines  40651.45
    //   paldari  −500.00
    //   total  40151.45
    // Every line's arithmetic is correct here, so mathDiff MUST be 0. Subtracting
    // paldari from only the computed side would report "line amounts are ₹500 off"
    // on every bill that carries a labour charge — a false accusation.
    const r = verifyReadBill(
      bill({ paldari: sure(500), paperTotal: sure(roundRupees(CORRECT_TOTAL - 500)) }),
    )
    expect(r.paldari).toBe(500)
    expect(r.sumWritten).toBe(CORRECT_TOTAL) // gross
    expect(r.sumComputed).toBe(CORRECT_TOTAL) // gross — comparable
    expect(r.mathDiff).toBe(0) // the lines ARE right
    expect(r.payableWritten).toBe(roundRupees(CORRECT_TOTAL - 500))
    expect(r.additionDiff).toBe(0) // and so is his total
    expect(r.verdict).toBe('ok')
  })

  it('subtracts the charge exactly once, not twice', () => {
    // A trader who forgot to deduct the paldari from his total is off by exactly
    // one paldari — never two.
    const r = verifyReadBill(
      bill({ paldari: sure(500), paperTotal: sure(roundRupees(CORRECT_TOTAL)) }),
    )
    expect(r.mathDiff).toBe(0)
    expect(r.additionDiff).toBe(500)
    expect(r.verdict).toBe('check')
  })

  it('treats an unread paldari as none, not as unknown', () => {
    const r = verifyReadBill(bill({ paldari: unread<number>() }))
    expect(r.paldari).toBe(0)
    expect(r.sumComputed).toBe(CORRECT_TOTAL)
    expect(r.payableWritten).toBe(CORRECT_TOTAL)
  })
})

describe('verifyReadBill — unreadable fields', () => {
  it('is incomplete, never ok, when an amount-bearing field could not be read', () => {
    // Rule 6. The most dangerous possible bug here would be calling this a pass.
    const r = verifyReadBill(bill({ lines: [line({ amount: unread<number>() }), MUSTARD] }))
    expect(r.verdict).toBe('incomplete')
    expect(r.sumWritten).toBeNull()
    expect(r.mathDiff).toBeNull()
    expect(r.additionDiff).toBeNull()
  })

  it('refuses to compute a line whose rate is unreadable, rather than treating it as 0', () => {
    // A ₹0 rate would compute ₹0 and then "prove" the paper wrong by its full
    // amount — a confident, totally wrong accusation. null is the only safe answer.
    const r = verifyReadBill(bill({ lines: [line({ rate: unread<number>() }), MUSTARD] }))
    expect(r.lines[0].computedAmount).toBeNull()
    expect(r.lines[0].lineDiff).toBeNull()
    expect(r.sumComputed).toBeNull()
    expect(r.verdict).toBe('incomplete')
  })

  it('is incomplete when there are no lines at all', () => {
    const r = verifyReadBill(bill({ lines: [] }))
    expect(r.verdict).toBe('incomplete')
  })

  it('flags low-confidence fields by name without blocking the computation', () => {
    const r = verifyReadBill(bill({ lines: [line({ weight: unsure(1524) }), MUSTARD] }))
    expect(r.lines[0].unsureFields).toContain('weightKg')
    expect(r.lines[0].unsureFields).not.toContain('ratePerQuintal')
    expect(r.lines[0].computedAmount).toBe(WHEAT_AMOUNT) // still computed
    expect(r.unsureCount).toBe(1)
    expect(r.verdict).toBe('ok') // low confidence is a prompt to check, not a failure
  })

  it('counts an unread field as unsure regardless of its claimed confidence', () => {
    const r = verifyReadBill(
      bill({ lines: [line({ deduction: { value: null, confidence: 1 } }), MUSTARD] }),
    )
    expect(r.lines[0].unsureFields).toContain('deductionKg')
  })

  it('treats exactly-at-threshold confidence as sure', () => {
    const r = verifyReadBill(
      bill({ lines: [line({ weight: { value: 1524, confidence: CONFIDENCE_THRESHOLD } }), MUSTARD] }),
    )
    expect(r.lines[0].unsureFields).toEqual([])
  })
})

describe('verifyReadBill — edge arithmetic', () => {
  it('clamps net weight at zero when the deduction exceeds the weight', () => {
    // Rule 5. A negative net would produce a negative amount and a nonsense verdict.
    const r = verifyReadBill(
      bill({
        lines: [line({ weight: sure(10), deduction: sure(25), amount: sure(0) })],
        paperTotal: sure(0),
      }),
    )
    expect(r.lines[0].netWeightKg).toBe(0)
    expect(r.lines[0].computedAmount).toBe(0)
    expect(r.verdict).toBe('ok')
  })

  it('rounds each line before summing, so the total matches a hand-added column', () => {
    // Round-then-sum, inherited from computeBillTotal. Two lines that each round
    // up must give 2 x the rounded figure, not the rounded true sum.
    // 0.5 qtl x 2455.01 = ₹1227.505 -> ₹1227.51 each; 2 lines -> ₹2455.02.
    const l = (): ReadBillLine =>
      line({ rate: sure(2455.01), weight: sure(50), deduction: sure(0), amount: sure(1227.51) })
    const r = verifyReadBill(bill({ lines: [l(), l()], paperTotal: sure(2455.02) }))
    expect(r.sumComputed).toBe(2455.02)
    expect(r.mathDiff).toBe(0)
    expect(r.additionDiff).toBe(0)
  })

  it('is pure — the same input always yields the same output', () => {
    // Rule 7. No clock, no randomness, no mutation of the input.
    const input = bill({})
    const a = verifyReadBill(input)
    const b = verifyReadBill(input)
    expect(a).toEqual(b)
    expect(input.lines).toHaveLength(2) // input untouched
  })
})
