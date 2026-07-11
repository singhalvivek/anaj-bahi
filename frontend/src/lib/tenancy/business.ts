// Tenancy write helpers — create a business, look up a membership by phone, and
// claim an employee membership. All writes use the modular Firestore SDK and hit
// the exact frozen collection paths in architecture.md § Firestore data model.
//
// Name snapshots (`displayName` / `addedByName` / `createdByName`) are written at
// action time — never a live join — so attribution survives renames/removal.
// `createdAt` / `updatedAt` / `addedAt` / `claimedAt` are numeric (`Date.now()`).

import { doc, getDoc, writeBatch } from 'firebase/firestore'
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
