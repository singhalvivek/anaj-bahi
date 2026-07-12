// One-time local→cloud migration (Phase 7). On the trader's first OWNER sign-in,
// the legacy Dexie ledger (bills / farmers / grain types accumulated in Phases 1–5)
// is uploaded into the business scope `businesses/{bizId}/…`.
//
// Guarantees:
// - IDEMPOTENT: guarded by `users/{uid}.migratedAt`. If set, returns immediately.
//   Existing Firestore docs are never overwritten (check-then-write), so a re-run
//   after a partial failure fills only the gaps.
// - NON-DESTRUCTIVE: the Dexie DB is read-only here and is never wiped.
// - BACKGROUND: callers fire-and-forget this; it must not block the UI. `migratedAt`
//   is stamped only after a FULL success so a partial failure safely retries.

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/app'
import { db, type Bill, type Farmer, type GrainType } from './schema'

// Same sanitize as repo: the bill id `DDMMYY/xxxxx` contains a `/` (illegal in a
// single Firestore doc-id segment) — store under `/` → `_`, original id kept in data.
function billDocId(billId: string): string {
  return billId.replace(/\//g, '_')
}

/** Write `data` at `path/id` only if no doc already exists there (never overwrite). */
async function writeIfAbsent(
  segments: [string, string, string, string],
  data: unknown,
): Promise<void> {
  const ref = doc(firestore, ...segments)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, data as Record<string, unknown>)
  }
}

/**
 * Upload legacy Dexie data into `businesses/{bizId}/…`. Idempotent; guarded by
 * `users/{uid}.migratedAt`. Safe to call on every owner sign-in.
 */
export async function migrateLocalToFirestore(bizId: string, uid: string): Promise<void> {
  const userRef = doc(firestore, 'users', uid)
  const userSnap = await getDoc(userRef)
  const migratedAt = userSnap.exists() ? (userSnap.data() as { migratedAt?: number }).migratedAt : undefined
  if (migratedAt) return // already migrated — nothing to do

  // Read the legacy local ledger (migration source only; never mutated/wiped).
  const [farmers, grainTypes, bills] = await Promise.all([
    db.farmers.toArray() as Promise<Farmer[]>,
    db.grainTypes.toArray() as Promise<GrainType[]>,
    db.bills.toArray() as Promise<Bill[]>,
  ])

  await Promise.all([
    ...farmers.map((f) => writeIfAbsent(['businesses', bizId, 'farmers', f.id], f)),
    ...grainTypes.map((g) => writeIfAbsent(['businesses', bizId, 'grainTypes', g.id], g)),
    ...bills.map((b) => writeIfAbsent(['businesses', bizId, 'bills', billDocId(b.id)], b)),
  ])

  // Only mark done after every write above resolved (a rejection above aborts the
  // Promise.all and leaves migratedAt unset, so the next sign-in retries).
  await setDoc(userRef, { migratedAt: Date.now() }, { merge: true })
}
