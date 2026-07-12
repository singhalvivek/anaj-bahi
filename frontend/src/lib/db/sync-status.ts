// Local-first sync-status helpers for the Settings sync indicator + "Sync now"
// (consumed by slice-c). Sync is AUTOMATIC — Firestore flushes queued writes on
// reconnect — so these helpers only SURFACE that state; they never drive it.
//
// The per-doc/query `snapshot.metadata.hasPendingWrites` flag is Firestore's
// "pending vs synced" signal: true while a local write has not yet been
// acknowledged by the server.

import { collection, onSnapshot, waitForPendingWrites } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/app'
import { getActiveBusiness } from './repo'

/**
 * Resolve once every locally-queued write has flushed to the server. Powers the
 * "Sync now" control: pressing it awaits this. Offline it stays pending and
 * resolves on reconnect once the queue drains (it never rejects for offline).
 */
export function waitForSync(): Promise<void> {
  return waitForPendingWrites(firestore)
}

/**
 * Subscribe to the "has locally-pending (un-synced) writes?" signal for the
 * active business's bills collection — the primary write target — using
 * `includeMetadataChanges` so metadata-only transitions (pending → synced) fire
 * the callback. Returns an unsubscribe function.
 *
 * Scoped to the business active at call time (via the repo's ambient scope). If
 * no business is active it reports `false` immediately and returns a no-op
 * unsubscribe. Callers that outlive a business switch should re-subscribe.
 */
export function subscribePendingWrites(cb: (hasPending: boolean) => void): () => void {
  const bizId = getActiveBusiness()
  if (!bizId) {
    cb(false)
    return () => {}
  }
  const col = collection(firestore, 'businesses', bizId, 'bills')
  return onSnapshot(
    col,
    { includeMetadataChanges: true },
    (snap) => cb(snap.metadata.hasPendingWrites),
    () => cb(false),
  )
}
