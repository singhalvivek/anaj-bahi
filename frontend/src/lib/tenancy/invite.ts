// Invite-code helpers — owner-generated one-time employee invites.
//
// Contract: architecture.md § Invite-code generation — lib/tenancy/invite.ts and
// § Firestore data model (invites/{code}). `generateInviteCode` is pure and
// unit-tested; the rest write/read the frozen `invites/{code}` docs directly.
//
// Name snapshots (`displayName` / `addedByName`) are written at action time so
// attribution survives renames/removal. Timestamps are numeric (`Date.now()`).

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase/app'
import type { AppUser } from '@/lib/auth/session'
import { phoneKey, type InviteRecord } from '@/lib/auth/membership'

// Ambiguity-safe alphabet — no O, 0, I, 1 (32 chars).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

/**
 * A 6-char, uppercase, human-shareable invite code from the ambiguity-safe
 * alphabet, drawn from `crypto.getRandomValues`. Reject-samples the random bytes
 * so the mapping onto the 32-char alphabet is unbiased regardless of alphabet size.
 */
export function generateInviteCode(): string {
  const n = CODE_ALPHABET.length
  const limit = Math.floor(256 / n) * n // largest multiple of n ≤ 256
  const buf = new Uint8Array(1)
  let code = ''
  while (code.length < CODE_LENGTH) {
    crypto.getRandomValues(buf)
    const b = buf[0]
    if (b >= limit) continue // reject to avoid modulo bias
    code += CODE_ALPHABET[b % n]
  }
  return code
}

/** Normalize a user-entered code (trim + uppercase) to the stored doc-id form. */
function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

/**
 * Owner creates a one-time employee invite. Generates a random code, retries on the
 * rare id collision, and writes `invites/{code}` with `status:'unused'`. Returns the
 * created record so the UI can show the code large to copy + share out-of-band.
 */
export async function createInvite(
  owner: AppUser,
  bizId: string,
  employeeName: string,
  employeePhoneE164: string,
): Promise<InviteRecord> {
  const ts = Date.now()
  const key = phoneKey(employeePhoneE164)
  const ownerName = owner.displayName ?? ''

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode()
    const ref = doc(firestore, 'invites', code)
    const existing = await getDoc(ref)
    if (existing.exists()) continue // rare collision — try a fresh code

    const record: InviteRecord = {
      code,
      bizId,
      role: 'employee',
      assignedPhone: employeePhoneE164,
      phoneKey: key,
      displayName: employeeName,
      addedByUid: owner.uid,
      addedByName: ownerName,
      status: 'unused',
      claimedByUid: null,
      createdAt: ts,
      claimedAt: null,
    }
    await setDoc(ref, record)
    return record
  }
  throw new Error('Could not generate a unique invite code — please try again.')
}

/** Read `invites/{code}` → the record, or null if it does not exist. */
export async function getInvite(code: string): Promise<InviteRecord | null> {
  const snap = await getDoc(doc(firestore, 'invites', normalizeCode(code)))
  return snap.exists() ? (snap.data() as InviteRecord) : null
}

/** Unused (unclaimed) invites for a business — the owner's pending-invite roster. */
export async function listPendingInvites(bizId: string): Promise<InviteRecord[]> {
  const q = query(
    collection(firestore, 'invites'),
    where('bizId', '==', bizId),
    where('status', '==', 'unused'),
  )
  const snap = await getDocs(q)
  const invites = snap.docs.map((d) => d.data() as InviteRecord)
  invites.sort((a, b) => b.createdAt - a.createdAt) // newest first
  return invites
}

/** Owner cancels an unused invite by deleting `invites/{code}`. */
export async function cancelInvite(code: string): Promise<void> {
  await deleteDoc(doc(firestore, 'invites', normalizeCode(code)))
}

/**
 * Employee redeems an invite in one atomic `writeBatch`:
 *   - flip `invites/{code}` → `status:'claimed'`, `claimedByUid`, `claimedAt`
 *   - write `businesses/{bizId}/members/{uid}` (employee, active; attribution copied
 *     from the invite)
 *   - set `users/{uid}` → `{ bizId, role:'employee', phone, email, displayName }`
 *
 * Pre-condition (enforced by the caller): checkInvite(getInvite(code), phoneE164)
 * resolved to `{ kind:'ok' }`. The employee's chosen name is taken from
 * `user.displayName` (set in the JoinByCode name step before this call).
 */
export async function claimInvite(user: AppUser, code: string, phoneE164: string): Promise<void> {
  const normalized = normalizeCode(code)
  const invite = await getInvite(normalized)
  if (!invite) {
    throw new Error('Invite not found — it may have been cancelled or already used.')
  }
  const ts = Date.now()
  const name = user.displayName ?? invite.displayName
  const batch = writeBatch(firestore)

  // invites/{code} → claimed (merge so the owner's fields are preserved)
  batch.set(
    doc(firestore, 'invites', normalized),
    { status: 'claimed', claimedByUid: user.uid, claimedAt: ts },
    { merge: true },
  )

  // businesses/{bizId}/members/{uid} — employee, active; attribution from the invite.
  // `inviteCode` + `phoneKey` are REQUIRED by the hardened members-create rule, which
  // reads the invite's still-'unused' committed state during this batch and verifies
  // it exists, ties this bizId, and carries the same phoneKey. `phoneKey` MUST equal
  // the invite's phoneKey (both normalized from the same mobile) or the rule denies.
  batch.set(doc(firestore, 'businesses', invite.bizId, 'members', user.uid), {
    uid: user.uid,
    phone: phoneE164,
    displayName: name,
    role: 'employee',
    addedByUid: invite.addedByUid,
    addedByName: invite.addedByName,
    addedAt: invite.createdAt,
    status: 'active',
    inviteCode: normalized, // the invite doc-id the members-create rule looks up
    phoneKey: phoneKey(phoneE164),
  })

  // users/{uid} — routes the employee into the shared business
  batch.set(
    doc(firestore, 'users', user.uid),
    {
      uid: user.uid,
      bizId: invite.bizId,
      role: 'employee',
      phone: phoneE164,
      email: user.email ?? null,
      displayName: name,
      updatedAt: ts,
    },
    { merge: true },
  )

  await batch.commit()
}
