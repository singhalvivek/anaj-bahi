import { describe, it, expect } from 'vitest'
import { generateBillId, billDatePart, randomBillCode } from './id'

const neverExists = async () => false
const BILL_ID_RE = /^\d{6}\/[a-z0-9]{5}$/

describe('billDatePart', () => {
  it('zero-pads day/month and uses 2-digit year (6 July 2026 → 060726)', () => {
    // Month is 0-indexed in JS Date: 6 = July
    expect(billDatePart(new Date(2026, 6, 6))).toBe('060726')
  })

  it('handles single-digit day and December', () => {
    expect(billDatePart(new Date(2025, 11, 1))).toBe('011225')
  })

  it('handles a 2-digit day', () => {
    expect(billDatePart(new Date(2024, 0, 25))).toBe('250124')
  })
})

describe('randomBillCode', () => {
  it('is 5 chars from [a-z0-9]', () => {
    for (let i = 0; i < 50; i++) {
      expect(randomBillCode()).toMatch(/^[a-z0-9]{5}$/)
    }
  })

  it('varies across calls (not constant)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => randomBillCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})

describe('generateBillId', () => {
  it('matches the DDMMYY/xxxxx format', async () => {
    const id = await generateBillId(new Date(2026, 6, 6), neverExists)
    expect(id).toMatch(BILL_ID_RE)
  })

  it('uses the correct date part for a known date', async () => {
    const id = await generateBillId(new Date(2026, 6, 6), neverExists)
    expect(id.startsWith('060726/')).toBe(true)
  })

  it('regenerates the suffix on collision (exists returns true once)', async () => {
    let calls = 0
    const existsOnce = async () => {
      calls += 1
      return calls === 1 // first candidate collides, second is free
    }
    const id = await generateBillId(new Date(2026, 6, 6), existsOnce)
    expect(id).toMatch(BILL_ID_RE)
    expect(calls).toBe(2) // proved it retried exactly once
  })

  it('throws if it can never find a free id', async () => {
    await expect(generateBillId(new Date(2026, 6, 6), async () => true)).rejects.toThrow()
  })
})
