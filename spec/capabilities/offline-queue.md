# Capability: Offline Queue — ⚠️ SHIPPED (Phase 4) → REPLACED-BY-Firestore (Phase 7)

> **Superseded.** The custom outbox/pending-set is **replaced by Firestore's built-in offline persistence** (see [firestore-store](firestore-store.md)) — offline writes queue in the local IndexedDB cache and auto-sync on reconnect with no separate outbox. `frontend/src/lib/sync/*` is **removed in Phase 7**. Kept only as the Phases-1–5 record.

_Original target phase: **Phase 4** · slice-b (frontend `lib/sync`)._

Backend is **FastAPI + SQLite**; frozen `lib/sync` API: [architecture.md § Phase-4 sync contract](../architecture.md#phase-4-sync-contract).

## What It Does
Tracks local mutations (the pending set) while offline and flushes them to the **FastAPI + SQLite** backend automatically on reconnect, never blocking the UI, never losing or duplicating a record.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| pending records | records changed since `lastSyncedAt` | Dexie (deduped by `id`) | yes |
| online event | browser event | `navigator.onLine` / `online` | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| pending set | records to sync (deduped by id) | IndexedDB / `lib/sync` state |
| flush result | `SyncResult` | `syncNow()` / `getSyncState()` |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| FastAPI `POST /sync/push` (via `syncNow()`) | flush pending on reconnect | Retain pending, record `lastError`, retry later |

## Business Rules
- **Pending** = local records changed since `lastSyncedAt`, **deduped by `id`** (a record edited twice counts once, not twice).
- `startAutoSync()` registers an `online` listener that calls `syncNow()`; `pendingCount` clears only after a successful push updates `lastSyncedAt`.
- **Idempotent** by record `id` + `updatedAt` — re-flushing the same records is a safe no-op; sync never blocks the UI, never loses a record, never duplicates one.

## Success Criteria
- [ ] Records changed offline appear in `pendingCount` and persist across reloads.
- [ ] Reconnecting (the `online` event) flushes them automatically via `syncNow()`.
- [ ] A failed flush leaves `pendingCount` unchanged and sets `lastError` for retry; no record is lost.
- [ ] Editing the same record twice while offline yields `pendingCount` of 1 for it (deduped by id), and syncing produces no duplicate server row.
