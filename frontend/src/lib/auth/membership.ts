// Pure role-routing + invite-check logic — no I/O, fully unit-tested.
//
// Contract: architecture.md § Role routing + invite logic — lib/auth/membership.ts.
//
// Recognition of returning users happens BEFORE onboarding (via users/{uid}.bizId),
// so the role chooser only routes a genuinely-new user to the correct onboarding
// sub-screen. One-person-one-business is enforced upstream (a user with a bizId
// never reaches onboarding), so no phone→business lookup happens here anymore.

export type Role = 'owner' | 'employee'

/**
 * E.164 → digits-only (leading `+` stripped). `'+911111111111'` → `'911111111111'`.
 * Used ONLY to match the mobile an employee enters against the mobile the owner put
 * on the invite — never an identity/document key. Lives here (firebase-free) so the
 * pure invite check and its unit tests never pull in the Firebase SDK.
 */
export function phoneKey(phoneE164: string): string {
  return phoneE164.replace(/^\+/, '').replace(/\D/g, '')
}

// Role chooser is a trivial 2-way route (no phone lookup): 'owner' → create a
// business; 'employee' → join an existing business by invite code.
export type RoleRoute = { kind: 'create' } | { kind: 'join' }

/** 'owner' → { kind:'create' } (create-business); 'employee' → { kind:'join' } (JoinByCode). */
export function routeRole(chosenRole: Role): RoleRoute {
  return chosenRole === 'owner' ? { kind: 'create' } : { kind: 'join' }
}

/** Shape read from `invites/{code}` (see the collection-path map). */
export interface InviteRecord {
  code: string
  bizId: string
  role: 'employee'
  assignedPhone: string
  phoneKey: string
  displayName: string
  addedByUid: string
  addedByName: string
  status: 'unused' | 'claimed'
  claimedByUid: string | null
  createdAt: number
  claimedAt: number | null
}

/** PURE invite check — drives the two JoinByCode steps and their distinct errors. */
export type InviteCheck =
  | { kind: 'ok'; bizId: string } // code exists, unused, mobile matches → claimable
  | { kind: 'not-found' } // no such code OR status !== 'unused' (step-1 error)
  | { kind: 'phone-mismatch' } // code ok but entered mobile ≠ invite.phoneKey (step-2 error)

/**
 * Verify an invite against the mobile the employee entered.
 *
 * FROZEN RULES (unit-tested):
 *   !invite || invite.status !== 'unused'          → { kind: 'not-found' }
 *   phoneKey(enteredPhoneE164) !== invite.phoneKey → { kind: 'phone-mismatch' }
 *   else                                           → { kind: 'ok', bizId: invite.bizId }
 */
export function checkInvite(invite: InviteRecord | null, enteredPhoneE164: string): InviteCheck {
  if (!invite || invite.status !== 'unused') return { kind: 'not-found' }
  if (phoneKey(enteredPhoneE164) !== invite.phoneKey) return { kind: 'phone-mismatch' }
  return { kind: 'ok', bizId: invite.bizId }
}
