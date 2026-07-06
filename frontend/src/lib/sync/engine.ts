// Sync engine — the FROZEN public API the Settings UI (slice-c) drives.
//
// OFFLINE-FIRST GUARANTEE: nothing in this module is called on the local write
// path. Phases 1–3 write straight to Dexie with zero network. Sync is purely
// OPPORTUNISTIC — `startAutoSync` flushes when connectivity returns, and every
// path here degrades safely: a missing config, a down/absent backend, or a bad
// token returns a typed result WITHOUT throwing to the UI and WITHOUT touching or
// corrupting local data. A failed push never advances `lastSyncedAt`, so it retries.

import { db } from '@/lib/db/schema'
import { listBills, listFarmers, listGrainTypes } from '@/lib/db/repo'
import { getSyncConfig } from './config'
import { push, pull, SyncAuthError, SyncNetworkError } from './client'
import { collectSnapshot, applySnapshot } from './snapshot'

const SYNC_STATE_META_KEY = 'syncState'
const SYNC_PROFILE_MARK_META_KEY = 'syncProfileMark'
const PROFILE_META_KEY = 'businessProfile' // mirrors lib/settings/profile.ts

export type SyncErrorKind = 'auth' | 'network' | 'config' | 'unknown'

/** Result of a `syncNow()` attempt. Never thrown — always resolved. */
export interface SyncResult {
  ok: boolean
  counts?: Record<string, number>
  error?: SyncErrorKind
}

/** Snapshot of sync status for the Settings UI. */
export interface SyncState {
  lastSyncedAt: number | null
  pendingCount: number
  lastError: string | null
}

interface StoredSyncState {
  lastSyncedAt: number | null
  lastError: string | null
}

const EMPTY_STATE: StoredSyncState = { lastSyncedAt: null, lastError: null }

async function readStoredState(): Promise<StoredSyncState> {
  const row = await db.meta.get(SYNC_STATE_META_KEY)
  const rec = row?.value as Partial<StoredSyncState> | undefined
  if (!rec) return { ...EMPTY_STATE }
  return {
    lastSyncedAt: typeof rec.lastSyncedAt === 'number' ? rec.lastSyncedAt : null,
    lastError: typeof rec.lastError === 'string' ? rec.lastError : null,
  }
}

async function writeStoredState(state: StoredSyncState): Promise<void> {
  await db.meta.put({ key: SYNC_STATE_META_KEY, value: state })
}

/** Serialise the saved profile row (or null if the user never saved one) for change detection. */
async function readProfileMark(): Promise<string | null> {
  const row = await db.meta.get(PROFILE_META_KEY)
  return row ? JSON.stringify(row.value) : null
}

async function writeSyncedProfileMark(): Promise<void> {
  const mark = await readProfileMark()
  await db.meta.put({ key: SYNC_PROFILE_MARK_META_KEY, value: mark })
}

async function profileChangedSinceLastSync(): Promise<boolean> {
  const current = await readProfileMark()
  if (current === null) return false // no saved profile → nothing to sync
  const row = await db.meta.get(SYNC_PROFILE_MARK_META_KEY)
  const marked = (row?.value ?? null) as string | null
  return current !== marked
}

/**
 * Count local records not yet reflected in the cloud, deduped by id (each record
 * counts at most once). Before the first successful sync everything local is
 * pending; afterwards, a record is pending if it changed since `lastSyncedAt`
 * (bills by `updatedAt`, farmers/grain types by `createdAt`, plus the profile if
 * it changed). Approximate by design — used only for a UI badge, never for
 * correctness (the push itself is idempotent + last-write-wins).
 */
async function computePendingCount(lastSyncedAt: number | null): Promise<number> {
  const [bills, farmers, grainTypes] = await Promise.all([
    listBills(),
    listFarmers(),
    listGrainTypes(),
  ])

  if (lastSyncedAt === null) {
    const profileRow = await db.meta.get(PROFILE_META_KEY)
    const profilePending = profileRow ? 1 : 0
    return bills.length + farmers.length + grainTypes.length + profilePending
  }

  const billsPending = bills.filter((b) => b.updatedAt > lastSyncedAt).length
  const farmersPending = farmers.filter((f) => f.createdAt > lastSyncedAt).length
  const grainsPending = grainTypes.filter((g) => g.createdAt > lastSyncedAt).length
  const profilePending = (await profileChangedSinceLastSync()) ? 1 : 0
  return billsPending + farmersPending + grainsPending + profilePending
}

/**
 * Push the full local snapshot to the backend. Idempotent (safe to call repeatedly).
 * Never throws — always resolves to a `SyncResult`:
 *   - no config      → { ok:false, error:'config' }
 *   - success        → { ok:true, counts }, and `lastSyncedAt` advances + error cleared
 *   - 401            → { ok:false, error:'auth' },    `lastSyncedAt` NOT advanced
 *   - unreachable    → { ok:false, error:'network' }, `lastSyncedAt` NOT advanced (retry-safe)
 *   - anything else  → { ok:false, error:'unknown' }, `lastSyncedAt` NOT advanced
 * A failed attempt persists `lastError` but preserves the previous `lastSyncedAt`.
 */
export async function syncNow(): Promise<SyncResult> {
  const cfg = await getSyncConfig()
  if (!cfg) return { ok: false, error: 'config' }

  const snapshot = await collectSnapshot()

  try {
    const counts = await push(cfg, snapshot)
    await writeStoredState({ lastSyncedAt: Date.now(), lastError: null })
    await writeSyncedProfileMark()
    return {
      ok: true,
      counts: {
        bills: counts.bills,
        farmers: counts.farmers,
        grainTypes: counts.grainTypes,
        profile: counts.profile,
      },
    }
  } catch (e) {
    const error: SyncErrorKind =
      e instanceof SyncAuthError ? 'auth' : e instanceof SyncNetworkError ? 'network' : 'unknown'
    // Persist the error but preserve the previous lastSyncedAt so the next attempt retries.
    const prev = await readStoredState()
    await writeStoredState({ lastSyncedAt: prev.lastSyncedAt, lastError: error })
    return { ok: false, error }
  }
}

/**
 * RESTORE — pull the cloud snapshot and merge it into the local store (idempotent,
 * last-write-wins by `updatedAt` for bills). Propagates `SyncAuthError` /
 * `SyncNetworkError` from the client so the UI can show a precise message; throws a
 * plain Error if sync is not configured. Does not advance `lastSyncedAt`.
 */
export async function restoreFromCloud(): Promise<void> {
  const cfg = await getSyncConfig()
  if (!cfg) throw new Error('Sync is not configured.')
  const snap = await pull(cfg) // may throw SyncAuthError / SyncNetworkError — propagate
  await applySnapshot(snap)
}

/** Current sync status for the UI: last successful sync, pending count, last error. */
export async function getSyncState(): Promise<SyncState> {
  const stored = await readStoredState()
  const pendingCount = await computePendingCount(stored.lastSyncedAt)
  return {
    lastSyncedAt: stored.lastSyncedAt,
    pendingCount,
    lastError: stored.lastError,
  }
}

/**
 * Register an `online`-event listener that opportunistically flushes via `syncNow()`
 * when connectivity returns. Returns an unsubscribe fn. Safe when config is unset
 * (syncNow just resolves `{ ok:false, error:'config' }` — it never throws) and safe
 * in non-DOM environments (no-op). Never blocks or touches the local write path.
 */
export function startAutoSync(): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {}
  }
  const handler = (): void => {
    void syncNow()
  }
  window.addEventListener('online', handler)
  return () => {
    window.removeEventListener('online', handler)
  }
}
