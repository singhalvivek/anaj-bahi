import { describe, it, expect, vi } from 'vitest'

// invite.ts imports `@/lib/firebase/app`, whose module top-level initializes the
// Firebase SDK from NEXT_PUBLIC_FIREBASE_* env (absent in unit tests). Stub it so
// importing invite.ts is side-effect-free — generateInviteCode uses only crypto.
vi.mock('@/lib/firebase/app', () => ({ app: {}, auth: {}, firestore: {} }))

import { generateInviteCode } from './invite'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const AMBIGUOUS = /[O0I1]/

describe('generateInviteCode', () => {
  it('is always 6 characters long', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateInviteCode()).toHaveLength(6)
    }
  })

  it('uses only the ambiguity-safe alphabet (uppercase, no O/0/I/1)', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateInviteCode()
      for (const ch of code) {
        expect(ALPHABET).toContain(ch)
      }
      expect(code).not.toMatch(AMBIGUOUS)
      expect(code).toBe(code.toUpperCase())
    }
  })

  it('is effectively unique across many calls (no early collisions)', () => {
    const seen = new Set<string>()
    const N = 5000
    for (let i = 0; i < N; i++) {
      seen.add(generateInviteCode())
    }
    // 32^6 ≈ 1.07e9 keyspace → 5000 draws should collide vanishingly rarely.
    // Allow a tiny slack so the test is not flaky, while still catching a broken RNG.
    expect(seen.size).toBeGreaterThan(N - 3)
  })

  it('draws a spread of characters (not a stuck/constant RNG)', () => {
    const chars = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      for (const ch of generateInviteCode()) chars.add(ch)
    }
    // A healthy RNG hits most of the 32-char alphabet across 6000 characters.
    expect(chars.size).toBeGreaterThan(24)
  })
})
