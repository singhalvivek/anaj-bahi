import { describe, it, expect } from 'vitest'
import { parseReadBill, parseReadBillFromText } from './parse'
import { isBillReadError, type BillReadErrorKind } from './types'
import { verifyReadBill } from './verify'

// Phase 13 — "never trust the model". Every case here is a shape a real model has
// been known to emit despite a responseSchema: a numeric string, a null where a
// number was promised, a truncated body, a markdown fence, extra invented keys.
//
// No API key, no network, no model — fixture JSON only.
//
// The invariant that matters most: NO input may produce NaN. A "₹NaN" rendered
// next to a real paper bill looks like an answer, which is worse than an error.

/** Assert a thrown BillReadError and return its kind. */
function kindOf(fn: () => unknown): BillReadErrorKind {
  try {
    fn()
  } catch (e) {
    if (isBillReadError(e)) return e.kind
    throw e
  }
  throw new Error('expected a BillReadError, but nothing was thrown')
}

const GOOD = {
  farmerName: { value: 'Girdhari', confidence: 0.95 },
  place: { value: 'Kheri', confidence: 0.9 },
  date: { value: '2026-10-15', confidence: 0.8 },
  lines: [
    {
      grainName: { value: 'गेहूँ', confidence: 0.97 },
      ratePerQuintal: { value: 2455, confidence: 0.95 },
      weightKg: { value: 1524, confidence: 0.9 },
      deductionKg: { value: 5, confidence: 0.85 },
      sackCount: { value: 30, confidence: 0.9 },
      amount: { value: 37291.45, confidence: 0.92 },
    },
  ],
  paldari: { value: 0, confidence: 1 },
  paperTotal: { value: 37291.45, confidence: 0.9 },
}

describe('parseReadBill — the well-formed case', () => {
  it('parses every field through', () => {
    const r = parseReadBill(GOOD)
    expect(r.farmerName.value).toBe('Girdhari')
    expect(r.date.value).toBe('2026-10-15')
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].ratePerQuintal.value).toBe(2455)
    expect(r.lines[0].amount.confidence).toBeCloseTo(0.92)
    expect(r.paperTotal.value).toBe(37291.45)
  })

  it('feeds straight into verify and produces a clean verdict', () => {
    // The two pure modules are contracted to compose without any glue.
    expect(verifyReadBill(parseReadBill(GOOD)).verdict).toBe('ok')
  })
})

describe('parseReadBill — numbers arriving as strings', () => {
  it('coerces plain numeric strings', () => {
    const r = parseReadBill({
      ...GOOD,
      lines: [{ ...GOOD.lines[0], ratePerQuintal: { value: '2455', confidence: 0.9 } }],
    })
    expect(r.lines[0].ratePerQuintal.value).toBe(2455)
  })

  it('strips the symbols a model copies off the paper (₹, commas, kg)', () => {
    const r = parseReadBill({
      ...GOOD,
      lines: [
        {
          ...GOOD.lines[0],
          weightKg: { value: '1,524 kg', confidence: 0.9 },
          amount: { value: '₹37,291.45', confidence: 0.9 },
        },
      ],
    })
    expect(r.lines[0].weightKg.value).toBe(1524)
    expect(r.lines[0].amount.value).toBe(37291.45)
  })

  it('reads an uncoercible string as UNREAD, never as 0 or NaN', () => {
    const r = parseReadBill({
      ...GOOD,
      lines: [{ ...GOOD.lines[0], ratePerQuintal: { value: 'कुछ नहीं', confidence: 0.9 } }],
    })
    expect(r.lines[0].ratePerQuintal.value).toBeNull()
    expect(r.lines[0].ratePerQuintal.confidence).toBe(0)
    expect(Number.isNaN(r.lines[0].ratePerQuintal.value as unknown as number)).toBe(false)
  })
})

describe('parseReadBill — nulls and absent fields', () => {
  it('keeps an explicit null amount as unread', () => {
    const r = parseReadBill({
      ...GOOD,
      lines: [{ ...GOOD.lines[0], amount: { value: null, confidence: 0.1 } }],
    })
    expect(r.lines[0].amount.value).toBeNull()
    // Confidence is pinned to 0 for an unread field, whatever the model claimed —
    // so it always surfaces as amber.
    expect(r.lines[0].amount.confidence).toBe(0)
  })

  it('defaults an absent deduction and paldari to a confident zero', () => {
    // "No deduction written" means 0, which is known — not unknown.
    const { paldari: _p, ...noPaldari } = GOOD
    const { deductionKg: _d, ...lineNoDeduction } = GOOD.lines[0]
    const r = parseReadBill({ ...noPaldari, lines: [lineNoDeduction] })
    expect(r.paldari).toEqual({ value: 0, confidence: 1 })
    expect(r.lines[0].deductionKg).toEqual({ value: 0, confidence: 1 })
  })

  it('defaults an unreadable deduction to zero rather than blocking the check', () => {
    const r = parseReadBill({
      ...GOOD,
      lines: [{ ...GOOD.lines[0], deductionKg: { value: null, confidence: 0 } }],
    })
    expect(r.lines[0].deductionKg.value).toBe(0)
  })

  it('leaves a missing paperTotal unread, so verify reports no written total', () => {
    const { paperTotal: _t, ...noTotal } = GOOD
    const r = parseReadBill(noTotal)
    expect(r.paperTotal.value).toBeNull()
    expect(verifyReadBill(r).additionDiff).toBeNull()
  })

  it('rejects a negative weight or amount as a misread', () => {
    const r = parseReadBill({
      ...GOOD,
      lines: [{ ...GOOD.lines[0], weightKg: { value: -1524, confidence: 0.9 } }],
    })
    expect(r.lines[0].weightKg.value).toBeNull()
  })
})

describe('parseReadBill — confidence handling', () => {
  it('clamps out-of-range confidence into 0..1', () => {
    const r = parseReadBill({
      ...GOOD,
      lines: [
        {
          ...GOOD.lines[0],
          ratePerQuintal: { value: 2455, confidence: 7 },
          weightKg: { value: 1524, confidence: -3 },
        },
      ],
    })
    expect(r.lines[0].ratePerQuintal.confidence).toBe(1)
    expect(r.lines[0].weightKg.confidence).toBe(0)
  })

  it('treats a junk confidence as fully unsure rather than NaN', () => {
    const r = parseReadBill({
      ...GOOD,
      lines: [{ ...GOOD.lines[0], weightKg: { value: 1524, confidence: 'very' } }],
    })
    expect(r.lines[0].weightKg.confidence).toBe(0)
  })

  it('accepts a field flattened to a bare scalar, as fully confident', () => {
    // Models drop the {value, confidence} wrapper often enough that discarding the
    // whole read over it would cost the trader a retry for nothing.
    const r = parseReadBill({
      ...GOOD,
      lines: [{ ...GOOD.lines[0], ratePerQuintal: 2455 }],
    })
    expect(r.lines[0].ratePerQuintal).toEqual({ value: 2455, confidence: 1 })
  })
})

describe('parseReadBill — dates', () => {
  it('accepts a real ISO date', () => {
    expect(parseReadBill(GOOD).date.value).toBe('2026-10-15')
  })

  it.each(['15/10/2026', '2026-13-01', '2026-02-30', 'Tuesday', ''])(
    'rejects %o as unreadable rather than inventing a date',
    (bad) => {
      const r = parseReadBill({ ...GOOD, date: { value: bad, confidence: 0.9 } })
      expect(r.date.value).toBeNull()
    },
  )
})

describe('parseReadBill — unsalvageable shapes', () => {
  it('rejects a non-object response', () => {
    expect(kindOf(() => parseReadBill('not json'))).toBe('bad-response')
    expect(kindOf(() => parseReadBill(null))).toBe('bad-response')
    expect(kindOf(() => parseReadBill([GOOD]))).toBe('bad-response')
  })

  it('rejects a missing or non-array lines field', () => {
    const { lines: _l, ...noLines } = GOOD
    expect(kindOf(() => parseReadBill(noLines))).toBe('bad-response')
    expect(kindOf(() => parseReadBill({ ...GOOD, lines: 'one' }))).toBe('bad-response')
  })

  it('rejects a line that is not an object', () => {
    expect(kindOf(() => parseReadBill({ ...GOOD, lines: [42] }))).toBe('bad-response')
  })

  it('rejects an absurd line count as a runaway response', () => {
    const many = Array.from({ length: 500 }, () => GOOD.lines[0])
    expect(kindOf(() => parseReadBill({ ...GOOD, lines: many }))).toBe('bad-response')
  })
})

describe('parseReadBill — well-formed but no bill in the photo', () => {
  it('reports no-bill-found for an empty lines array', () => {
    // A distinct kind on purpose: the trader needs "I could not find a bill in this
    // photo", which is a different instruction from "something went wrong".
    expect(kindOf(() => parseReadBill({ ...GOOD, lines: [] }))).toBe('no-bill-found')
  })

  it('reports no-bill-found when no line yielded a single usable figure', () => {
    const blind = {
      grainName: { value: null, confidence: 0 },
      ratePerQuintal: { value: null, confidence: 0 },
      weightKg: { value: null, confidence: 0 },
      deductionKg: { value: null, confidence: 0 },
      sackCount: { value: null, confidence: 0 },
      amount: { value: null, confidence: 0 },
    }
    expect(kindOf(() => parseReadBill({ ...GOOD, lines: [blind, blind] }))).toBe('no-bill-found')
  })
})

describe('parseReadBill — unknown keys', () => {
  it('ignores extra invented fields instead of failing the read', () => {
    const r = parseReadBill({
      ...GOOD,
      notes: 'the farmer seemed happy',
      confidence_overall: 0.8,
      lines: [{ ...GOOD.lines[0], moisturePercent: 12, mandiFee: { value: 3 } }],
    })
    expect(r.lines[0].ratePerQuintal.value).toBe(2455)
  })
})

describe('parseReadBillFromText', () => {
  it('parses a bare JSON body', () => {
    expect(parseReadBillFromText(JSON.stringify(GOOD)).lines).toHaveLength(1)
  })

  it('strips a markdown fence the model added anyway', () => {
    const fenced = '```json\n' + JSON.stringify(GOOD) + '\n```'
    expect(parseReadBillFromText(fenced).lines).toHaveLength(1)
  })

  it('reports bad-response for a truncated body', () => {
    const truncated = JSON.stringify(GOOD).slice(0, 80)
    expect(kindOf(() => parseReadBillFromText(truncated))).toBe('bad-response')
  })

  it('reports bad-response for an empty body', () => {
    expect(kindOf(() => parseReadBillFromText('   '))).toBe('bad-response')
  })

  it('never leaks the raw model text into the error message shown to the trader', () => {
    try {
      parseReadBillFromText('garbage {{{ not json')
    } catch (e) {
      expect(isBillReadError(e)).toBe(true)
      if (isBillReadError(e)) expect(e.detail ?? '').not.toContain('garbage')
    }
  })
})

describe('parse + verify — the NaN invariant', () => {
  it.each([
    ['string rate', { ratePerQuintal: { value: '2455', confidence: 0.9 } }],
    ['junk rate', { ratePerQuintal: { value: {}, confidence: 0.9 } }],
    ['null weight', { weightKg: { value: null, confidence: 0 } }],
    ['junk confidence', { amount: { value: 100, confidence: 'x' } }],
    ['infinite amount', { amount: { value: 1e400, confidence: 1 } }],
    ['null deduction', { deductionKg: { value: null, confidence: 0 } }],
  ])('produces no NaN anywhere for: %s', (_label, patch) => {
    const result = verifyReadBill(parseReadBill({ ...GOOD, lines: [{ ...GOOD.lines[0], ...patch }] }))
    const everyNumber = JSON.stringify(result)
    expect(everyNumber).not.toContain('NaN')
    expect(everyNumber).not.toContain('Infinity')
  })
})
