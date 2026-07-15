import { describe, it, expect } from 'vitest'
import { routeOnboarding, checkInvite, phoneKey, type InviteRecord } from './membership'

describe('routeOnboarding — the two role-free branches', () => {
  it("'create' ('New business') → { kind: 'create' } (go to create-business)", () => {
    expect(routeOnboarding('create')).toEqual({ kind: 'create' })
  })

  it("'join' ('Business already registered') → { kind: 'join' } (go to JoinByCode)", () => {
    expect(routeOnboarding('join')).toEqual({ kind: 'join' })
  })
})

describe('phoneKey — E.164 → digits only', () => {
  it('strips the leading + ', () => {
    expect(phoneKey('+911111111111')).toBe('911111111111')
  })

  it('strips spaces, dashes and other non-digits', () => {
    expect(phoneKey('+91 98765-43210')).toBe('919876543210')
  })
})

function makeInvite(overrides: Partial<InviteRecord> = {}): InviteRecord {
  return {
    code: 'ABC234',
    bizId: 'biz-1',
    role: 'employee',
    assignedPhone: '+911111111111',
    phoneKey: '911111111111',
    displayName: 'Ramesh',
    addedByUid: 'owner-uid',
    addedByName: 'Owner',
    status: 'unused',
    claimedByUid: null,
    createdAt: 1,
    claimedAt: null,
    ...overrides,
  }
}

describe('checkInvite — the three frozen branches', () => {
  it('null invite → not-found (no such code)', () => {
    expect(checkInvite(null, '+911111111111')).toEqual({ kind: 'not-found' })
  })

  it('already-claimed invite (status !== unused) → not-found', () => {
    const invite = makeInvite({ status: 'claimed', claimedByUid: 'someone', claimedAt: 2 })
    expect(checkInvite(invite, '+911111111111')).toEqual({ kind: 'not-found' })
  })

  it('valid code but non-matching mobile → phone-mismatch', () => {
    const invite = makeInvite()
    expect(checkInvite(invite, '+919999999999')).toEqual({ kind: 'phone-mismatch' })
  })

  it('valid code + matching mobile → ok with bizId', () => {
    const invite = makeInvite()
    expect(checkInvite(invite, '+911111111111')).toEqual({ kind: 'ok', bizId: 'biz-1' })
  })

  it('mobile match is normalized (spaces/dashes ignored)', () => {
    const invite = makeInvite()
    expect(checkInvite(invite, '+91 11111-11111')).toEqual({ kind: 'ok', bizId: 'biz-1' })
  })
})
