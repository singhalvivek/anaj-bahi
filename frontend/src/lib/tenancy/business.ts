// Tenancy write helpers — create a business and manage its claimed roster. All
// writes use the modular Firestore SDK and hit the exact frozen collection paths in
// architecture.md § Firestore data model + § Tenancy write helpers.
//
// Identity is the Firebase `uid`: creating a business writes only the business, the
// owner's member doc, and users/{uid} — there is NO owner invite/membership doc.
// Employee onboarding is the invites/{code} flow in ./invite.ts.
//
// Name snapshots (`displayName` / `createdByName` / `addedByName`) are written at
// action time — never a live join — so attribution survives renames/removal.
// `createdAt` / `updatedAt` / `addedAt` are numeric (`Date.now()`).

import { collection, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/app'
import type { AppUser } from '@/lib/auth/session'
import { phoneKey, type Role } from '@/lib/auth/membership'

// phoneKey lives in the firebase-free ./auth/membership module (so the pure invite
// check + its unit tests never pull in the SDK); re-exported here to preserve the
// frozen `business.phoneKey` export in architecture.md § Tenancy write helpers.
export { phoneKey }

export interface NewBusinessInput {
  shopName: string
  traderName: string
  phone?: string
  address?: string
}

/**
 * Create a new business owned by `owner`. Three docs — the business profile, the
 * owner's per-business member doc (`owner`, `active`), and the owner's `users/{uid}`
 * record ({ bizId, role:'owner', phone, email }) — are written in a single **atomic
 * `writeBatch`** so onboarding never leaves a half-created business (offline the
 * batch queues and syncs together). There is NO owner invite/membership doc — the
 * owner's own `uid` recognises them on any device via `users/{uid}.bizId`. Returns
 * the new bizId.
 */
export async function createBusiness(owner: AppUser, input: NewBusinessInput): Promise<string> {
  const bizId = crypto.randomUUID()
  const ts = Date.now()
  const ownerName = owner.displayName ?? ''
  const ownerPhone = input.phone ?? owner.phone ?? ''
  const batch = writeBatch(firestore)

  // businesses/{bizId} — the business + its profile
  batch.set(doc(firestore, 'businesses', bizId), {
    id: bizId,
    shopName: input.shopName,
    traderName: input.traderName,
    phone: ownerPhone,
    ...(input.address !== undefined ? { address: input.address } : {}),
    createdByUid: owner.uid,
    createdByName: ownerName,
    createdAt: ts,
    updatedAt: ts,
  })

  // businesses/{bizId}/members/{uid} — owner, active. `inviteCode: null` + `phoneKey`
  // are REQUIRED by the hardened members-create rule: this doc passes the
  // owner-bootstrap arm because businesses/{bizId} does not yet exist in committed
  // state while this create batch is evaluated.
  batch.set(doc(firestore, 'businesses', bizId, 'members', owner.uid), {
    uid: owner.uid,
    phone: ownerPhone,
    displayName: ownerName,
    role: 'owner',
    addedByUid: owner.uid,
    addedByName: ownerName,
    addedAt: ts,
    status: 'active',
    inviteCode: null,
    phoneKey: phoneKey(ownerPhone),
  })

  // users/{uid} — {bizId, role} is what routes the user into the app
  batch.set(
    doc(firestore, 'users', owner.uid),
    {
      uid: owner.uid,
      bizId,
      role: 'owner',
      phone: ownerPhone,
      email: owner.email ?? null,
      updatedAt: ts,
    },
    { merge: true },
  )

  await batch.commit()
  return bizId
}

// ---- Employee management (owner-only roster) ----

/**
 * A claimed row of the in-business roster, read from `businesses/{bizId}/members`.
 * These are the members who have actually signed in and joined (the owner on
 * create; employees once they redeem an invite code).
 */
export interface MemberRecord {
  uid: string
  phone: string
  displayName: string
  role: Role
  status: 'active'
  addedByUid: string
  addedByName: string
  addedAt: number
  // Required by the hardened members-create Security Rule (§ Security Rules): the
  // code used at claim (null/omitted for the owner's own doc) + the normalized digits
  // of the claimed mobile (owner: from their own onboarding mobile).
  inviteCode: string | null
  phoneKey: string
}

/**
 * The roster of CLAIMED members for a business: read `businesses/{bizId}/members`
 * and sort owners first, then by `addedAt` ascending.
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
      status: 'active',
      addedByUid: data.addedByUid ?? '',
      addedByName: data.addedByName ?? '',
      addedAt: data.addedAt ?? 0,
      inviteCode: data.inviteCode ?? null,
      phoneKey: data.phoneKey ?? '',
    }
  })
  members.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'owner' ? -1 : 1
    return a.addedAt - b.addedAt
  })
  return members
}

/**
 * Owner removes a member: delete the per-business `members/{uid}` doc. Security
 * Rules then reject the removed person's reads/writes; on that person's next load
 * their client detects they are no longer a member and clears their own
 * `users/{uid}.bizId`, returning them to onboarding (removal-safety). Their own
 * `users/{uid}` doc and past bill/activity attribution snapshots are left intact.
 */
export async function removeEmployee(
  bizId: string,
  member: { uid: string; phone: string },
): Promise<void> {
  await deleteDoc(doc(firestore, 'businesses', bizId, 'members', member.uid))
}
