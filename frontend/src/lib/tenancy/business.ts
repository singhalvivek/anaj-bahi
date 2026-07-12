// Tenancy write helpers — create a business, look up a membership by phone, and
// claim an employee membership. All writes use the modular Firestore SDK and hit
// the exact frozen collection paths in architecture.md § Firestore data model.
//
// Name snapshots (`displayName` / `addedByName` / `createdByName`) are written at
// action time — never a live join — so attribution survives renames/removal.
// `createdAt` / `updatedAt` / `addedAt` / `claimedAt` are numeric (`Date.now()`).

import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/app'
import type { AppUser } from '@/lib/auth/session'
import type { Role } from '@/lib/auth/membership'

export interface NewBusinessInput {
  shopName: string
  traderName: string
  phone?: string
  address?: string
}

export interface MembershipRecord {
  phone: string
  phoneKey: string
  bizId: string
  role: Role
  displayName: string
  addedByUid: string
  addedByName: string
  status: 'invited' | 'active'
  uid: string | null
  createdAt: number
  claimedAt: number | null
}

/** E.164 → digits-only doc id. `'+911111111111'` → `'911111111111'`. */
export function phoneKey(phoneE164: string): string {
  return phoneE164.replace(/^\+/, '').replace(/\D/g, '')
}

/** Read the top-level phone→business lookup at `memberships/{phoneKey}`. */
export async function findMembershipByPhone(
  phoneE164: string,
): Promise<MembershipRecord | null> {
  const snap = await getDoc(doc(firestore, 'memberships', phoneKey(phoneE164)))
  return snap.exists() ? (snap.data() as MembershipRecord) : null
}

/**
 * Create a new business owned by `owner`. All four docs — the business profile,
 * the owner's per-business member doc, the top-level membership lookup, and the
 * owner's `users/{uid}` record — are written in a single **atomic `writeBatch`**
 * so onboarding never leaves a half-created business (offline the batch queues
 * and syncs together). Returns the new bizId.
 */
export async function createBusiness(owner: AppUser, input: NewBusinessInput): Promise<string> {
  const bizId = crypto.randomUUID()
  const ts = Date.now()
  const key = phoneKey(owner.phone)
  const ownerName = owner.displayName ?? ''
  const batch = writeBatch(firestore)

  // businesses/{bizId} — the business + its profile
  batch.set(doc(firestore, 'businesses', bizId), {
    id: bizId,
    shopName: input.shopName,
    traderName: input.traderName,
    phone: input.phone ?? '',
    ...(input.address !== undefined ? { address: input.address } : {}),
    createdByUid: owner.uid,
    createdByName: ownerName,
    createdAt: ts,
    updatedAt: ts,
  })

  // businesses/{bizId}/members/{uid} — owner, active
  batch.set(doc(firestore, 'businesses', bizId, 'members', owner.uid), {
    uid: owner.uid,
    phone: owner.phone,
    displayName: ownerName,
    role: 'owner',
    addedByUid: owner.uid,
    addedByName: ownerName,
    addedAt: ts,
    status: 'active',
  })

  // memberships/{phoneKey} — owner, active, uid set (recognises the owner on any device)
  const membership: MembershipRecord = {
    phone: owner.phone,
    phoneKey: key,
    bizId,
    role: 'owner',
    displayName: ownerName,
    addedByUid: owner.uid,
    addedByName: ownerName,
    status: 'active',
    uid: owner.uid,
    createdAt: ts,
    claimedAt: ts,
  }
  batch.set(doc(firestore, 'memberships', key), membership)

  // users/{uid} — {bizId, role} is what routes the user into the app
  batch.set(
    doc(firestore, 'users', owner.uid),
    { uid: owner.uid, phone: owner.phone, bizId, role: 'owner', updatedAt: ts },
    { merge: true },
  )

  await batch.commit()
  return bizId
}

// ---- Phase 8 — employee management (owner-only roster + add/remove) ----

/**
 * A claimed row of the in-business roster, read from `businesses/{bizId}/members`.
 * These are the members who have actually signed in and joined (the owner on
 * create; employees once they claim their invited membership).
 */
export interface MemberRecord {
  uid: string
  phone: string
  displayName: string
  role: Role
  status: 'invited' | 'active'
  addedByUid: string
  addedByName: string
  addedAt: number
}

/**
 * Thrown by `addEmployee` when the phone already belongs to a business — the
 * one-person-one-business rule. The UI catches this to show a translated inline
 * error (`employees.existsError`).
 */
export class EmployeeExistsError extends Error {
  constructor(message = 'That phone number already belongs to a business.') {
    super(message)
    this.name = 'EmployeeExistsError'
  }
}

/**
 * The roster of CLAIMED members for a business: read `businesses/{bizId}/members`
 * and sort owners first, then by `addedAt` ascending. Newly-invited employees
 * appear here once they sign in and claim their membership.
 */
export async function listMembers(bizId: string): Promise<MemberRecord[]> {
  const snap = await getDocs(collection(firestore, 'businesses', bizId, 'members'))
  const members: MemberRecord[] = snap.docs.map((d) => {
    const data = d.data() as Partial<MemberRecord>
    return {
      uid: data.uid ?? d.id,
      phone: data.phone ?? '',
      displayName: data.displayName ?? '',
      role: (data.role ?? 'employee') as Role,
      status: (data.status ?? 'active') as 'invited' | 'active',
      addedByUid: data.addedByUid ?? '',
      addedByName: data.addedByName ?? '',
      addedAt: data.addedAt ?? 0,
    }
  })
  members.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'owner' ? -1 : 1
    return a.addedAt - b.addedAt
  })
  return members
}

/**
 * Owner adds an employee by phone + name label. Enforces one-person-one-business:
 * if the phone already has ANY membership, throws `EmployeeExistsError`. Otherwise
 * writes an `invited` employee membership at `memberships/{phoneKey}` matching the
 * frozen `MembershipRecord` shape, so the Phase-6 claim flow resolves it to
 * `employee-joined` when that phone signs in and picks Employee. The `displayName`
 * is a snapshot label; the employee's own name replaces it once they sign in.
 */
export async function addEmployee(
  owner: AppUser,
  bizId: string,
  employeePhoneE164: string,
  employeeName: string,
): Promise<void> {
  const existing = await findMembershipByPhone(employeePhoneE164)
  if (existing) {
    throw new EmployeeExistsError()
  }
  const key = phoneKey(employeePhoneE164)
  const membership: MembershipRecord = {
    phone: employeePhoneE164,
    phoneKey: key,
    bizId,
    role: 'employee',
    displayName: employeeName,
    addedByUid: owner.uid,
    addedByName: owner.displayName ?? '',
    status: 'invited',
    uid: null,
    createdAt: Date.now(),
    claimedAt: null,
  }
  await setDoc(doc(firestore, 'memberships', key), membership)
}

/**
 * Owner removes a member: delete the top-level `memberships/{phoneKey}` lookup and,
 * if the member has claimed (has a `uid`), the per-business `members/{uid}` doc.
 * Security Rules then reject the removed person's reads/writes. Their own
 * `users/{uid}` doc and past bill/activity attribution snapshots are left intact
 * (history stays truthful; on next load with no membership they re-onboard).
 */
export async function removeEmployee(
  bizId: string,
  member: { uid: string | null; phone: string },
): Promise<void> {
  await deleteDoc(doc(firestore, 'memberships', phoneKey(member.phone)))
  if (member.uid) {
    await deleteDoc(doc(firestore, 'businesses', bizId, 'members', member.uid))
  }
}

/**
 * An employee joins the business `bizId` an owner already added their phone to:
 * claim the pre-existing `invited` membership (set `uid`, `status:'active'`,
 * `claimedAt`), write the per-business member doc, and point `users/{uid}` at the
 * business. Attribution (`addedBy*`) is copied from the membership snapshot.
 */
export async function claimEmployeeMembership(user: AppUser, bizId: string): Promise<void> {
  const ts = Date.now()
  const key = phoneKey(user.phone)
  const name = user.displayName ?? ''

  // Read the membership to carry over the owner's attribution snapshot + role.
  const memRef = doc(firestore, 'memberships', key)
  const memSnap = await getDoc(memRef)
  const mem = memSnap.exists() ? (memSnap.data() as MembershipRecord) : null
  const role: Role = mem?.role ?? 'employee'

  // Claim + member doc + users pointer land together as one atomic unit.
  const batch = writeBatch(firestore)

  // Claim the membership (set uid + active + claimedAt).
  batch.set(memRef, { uid: user.uid, status: 'active', claimedAt: ts }, { merge: true })

  // businesses/{bizId}/members/{uid}
  batch.set(
    doc(firestore, 'businesses', bizId, 'members', user.uid),
    {
      uid: user.uid,
      phone: user.phone,
      displayName: name,
      role,
      addedByUid: mem?.addedByUid ?? '',
      addedByName: mem?.addedByName ?? '',
      addedAt: mem?.createdAt ?? ts,
      status: 'active',
    },
    { merge: true },
  )

  // users/{uid} — routes the employee into the shared business
  batch.set(
    doc(firestore, 'users', user.uid),
    { uid: user.uid, phone: user.phone, bizId, role, updatedAt: ts },
    { merge: true },
  )

  await batch.commit()
}
