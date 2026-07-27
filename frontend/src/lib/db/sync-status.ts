// Local-first sync-status helpers for the Settings sync indicator + "Sync now"
// (consumed by slice-c). Sync is AUTOMATIC — Firestore flushes queued writes on
// reconnect — so these helpers only SURFACE that state; they never drive it.
//
// The per-doc/query `snapshot.metadata.hasPendingWrites` flag is Firestore's
// "pending vs synced" signal: true while a local write has not yet been
// acknowledged by the server.

import { collection, onSnapshot, waitForPendingWrites } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/app'
import type { Bill } from './schema'
import { getActiveBusiness } from './repo'

/**
 * Resolve once every locally-queued write has flushed to the server. Powers the
 * "Sync now" control: pressing it awaits this. Offline it stays pending and
 * resolves on reconnect once the queue drains (it never rejects for offline).
 */
export function waitForSync(): Promise<void> {
  return waitForPendingWrites(firestore)
}

/** Phase 12 — which bills are not yet backed up, and how many. */
export interface UnsyncedBills {
  /** Bills whose OWN doc carries locally-pending writes. */
  count: number
  /** Their `Bill.id` values (`DDMMYY/xxxxx`), for the drill-down. */
  billIds: string[]
}

const NOTHING_PENDING: UnsyncedBills = { count: 0, billIds: [] }

/**
 * Subscribe to the un-synced bill COUNT for the active business's bills
 * collection — the primary write target — using `includeMetadataChanges` so
 * metadata-only transitions (pending → synced) fire the callback. Returns an
 * unsubscribe function.
 *
 * This is the Phase-12 primitive: the previous helper only exposed the
 * QUERY-level boolean, so it could say "something is pending" but never *which*
 * bills or *how many* — and not knowing which bills are at risk is the whole
 * problem the badge exists to solve.
 *
 * Costs no extra document read (this collection is already listened to) and
 * works offline, since pending-write metadata is purely local. Scoped to the
 * business active at call time (via the repo's ambient scope). No active
 * business, or a listen error → `{ count: 0, billIds: [] }` plus a no-op
 * unsubscribe; never throws. Callers that outlive a business switch should
 * re-subscribe.
 */
export function subscribeUnsyncedBills(cb: (state: UnsyncedBills) => void): () => void {
  const bizId = getActiveBusiness()
  if (!bizId) {
    cb(NOTHING_PENDING)
    return () => {}
  }
  const col = collection(firestore, 'businesses', bizId, 'bills')
  return onSnapshot(
    col,
    { includeMetadataChanges: true },
    (snap) => {
      const billIds: string[] = []
      for (const docSnap of snap.docs) {
        // Per-DOC metadata, not the query-level flag: that is what turns a
        // boolean into a count. Read the id from the data, not `docSnap.id` —
        // doc ids sanitize `/` → `_`, so only the stored `Bill.id` matches the
        // ids the bill list and the drill-down use.
        if (docSnap.metadata.hasPendingWrites) billIds.push((docSnap.data() as Bill).id)
      }
      cb({ count: billIds.length, billIds })
    },
    () => cb(NOTHING_PENDING),
  )
}

/**
 * Unchanged signature and semantics, now **derived** — so there is exactly ONE
 * sync-state implementation rather than two that can disagree. `SyncStatus.tsx`
 * keeps its DOM and testids.
 *
 * Equivalent to the old query-level `snap.metadata.hasPendingWrites`: the app has
 * no delete-bill mutation, so a pending write always belongs to a doc present in
 * `snap.docs`.
 */
export function subscribePendingWrites(cb: (hasPending: boolean) => void): () => void {
  return subscribeUnsyncedBills((state) => cb(state.count > 0))
}
