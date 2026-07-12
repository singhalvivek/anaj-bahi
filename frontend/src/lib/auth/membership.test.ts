import { describe, it, expect } from 'vitest'
import { decideMembership, type MembershipLookup } from './membership'

describe('decideMembership — the four frozen branches', () => {
  it('existing OWNER membership → enter as owner (regardless of status)', () => {
    const lookup: MembershipLookup = { bizId: 'biz-1', role: 'owner', status: 'active' }
    expect(decideMembership('owner', lookup)).toEqual({ kind: 'owner', bizId: 'biz-1' })
  })

  it('existing EMPLOYEE membership → employee-joined', () => {
    const lookup: MembershipLookup = { bizId: 'biz-2', role: 'employee', status: 'invited' }
    expect(decideMembership('employee', lookup)).toEqual({
      kind: 'employee-joined',
      bizId: 'biz-2',
    })
  })

  it('no membership + chose Owner → new (create a business)', () => {
    expect(decideMembership('owner', null)).toEqual({ kind: 'new' })
  })

  it('no membership + chose Employee → employee-unadded (ask your owner)', () => {
    expect(decideMembership('employee', null)).toEqual({ kind: 'employee-unadded' })
  })
})

describe('decideMembership — existing membership overrides the fresh choice', () => {
  it('owner-lookup but chose Employee → still owner (one-person-one-business)', () => {
    const lookup: MembershipLookup = { bizId: 'biz-3', role: 'owner', status: 'active' }
    // The user tapped Employee, but their phone already owns a business.
    expect(decideMembership('employee', lookup)).toEqual({ kind: 'owner', bizId: 'biz-3' })
  })

  it('employee-lookup but chose Owner → still employee-joined (cannot start a 2nd business)', () => {
    const lookup: MembershipLookup = { bizId: 'biz-4', role: 'employee', status: 'active' }
    // The user tapped Owner, but their phone is already an employee somewhere.
    expect(decideMembership('owner', lookup)).toEqual({
      kind: 'employee-joined',
      bizId: 'biz-4',
    })
  })

  it('an invited employee membership still routes to employee-joined even if Owner chosen', () => {
    const lookup: MembershipLookup = { bizId: 'biz-5', role: 'employee', status: 'invited' }
    expect(decideMembership('owner', lookup)).toEqual({
      kind: 'employee-joined',
      bizId: 'biz-5',
    })
  })
})
