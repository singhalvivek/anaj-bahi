// Pure membership-decision logic — no I/O, fully unit-tested.
//
// Contract: architecture.md § Membership decision logic — lib/auth/membership.ts.
// An existing membership ALWAYS wins over the freshly-chosen role; that is what
// enforces one-person-one-business (a phone already tied to a business can never
// create or join a second).

export type Role = 'owner' | 'employee'

export interface MembershipLookup {
  bizId: string
  role: Role
  status: 'invited' | 'active'
}

export type MembershipDecision =
  | { kind: 'owner'; bizId: string } // phone already has an OWNER membership → enter as owner
  | { kind: 'employee-joined'; bizId: string } // phone already has an EMPLOYEE membership → join
  | { kind: 'employee-unadded' } // chose Employee, no membership → "ask your owner"
  | { kind: 'new' } // chose Owner, no membership → create a business

/**
 * Decide where a signed-in phone goes after picking a role.
 *
 * FROZEN RULES (all four branches):
 *   lookup && lookup.role === 'owner'      → { kind:'owner', bizId }
 *   lookup && lookup.role === 'employee'   → { kind:'employee-joined', bizId }
 *   !lookup && chosenRole === 'owner'      → { kind:'new' }
 *   !lookup && chosenRole === 'employee'   → { kind:'employee-unadded' }
 *
 * The existing membership overrides `chosenRole` in the first two branches.
 */
export function decideMembership(
  chosenRole: Role,
  lookup: MembershipLookup | null,
): MembershipDecision {
  if (lookup) {
    if (lookup.role === 'owner') return { kind: 'owner', bizId: lookup.bizId }
    return { kind: 'employee-joined', bizId: lookup.bizId }
  }
  if (chosenRole === 'owner') return { kind: 'new' }
  return { kind: 'employee-unadded' }
}
