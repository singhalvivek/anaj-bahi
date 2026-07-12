# Capability: Firestore Shared Store (offline-persistent data layer)

_Phase 7 · slice(s) re-pointing `lib/db/repo` at Firestore + migration + Sync-now/status; removes the old backend & `SyncSettings`._

Frozen repo contract + collection paths: [architecture.md § Firestore-backed repo contract](../architecture.md#firestore-backed-repo-contract--libdbrepo-re-pointed-in-phase-7) and [§ Firestore data model](../architecture.md#firestore-data-model--frozen-collection-path-map).

## What It Does
Replaces the Dexie-for-synced-entities + FastAPI sync backend with **Cloud Firestore accessed directly from the client**, using **IndexedDB offline persistence as the on-device store**. The **shared, business-scoped ledger** (bills/farmers/grain types/business profile) is live across all members and devices; offline writes queue locally and auto-sync on reconnect. Includes the **one-time local→cloud migration** and a visible **online/sync status + "Sync now"**.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| active business | `bizId` | `AuthProvider.setActiveBusiness` | yes |
| ledger writes | `Bill`/`Farmer`/`GrainType`/profile | bill-form / settings (unchanged callers) | yes |
| legacy local data | Dexie `bills`/`farmers`/`grainTypes` | IndexedDB (migration source) | on first owner sign-in |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| shared ledger | Firestore docs | `businesses/{bizId}/{bills,farmers,grainTypes}` + business profile |
| live reads | `onSnapshot` streams | `useBills`/`useBill`/`useFarmers`/`useGrainTypes` |
| sync status | `{ online, pendingWrites }` | Settings sync indicator + "Sync now" |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Firestore reads/writes (via `lib/db/repo`, business-scoped) | CRUD + `onSnapshot` | Offline: served from the local persistence cache; write queues and flushes on reconnect — never blocks the UI, never loses data |
| One-time `migrateLocalToFirestore(bizId)` | upload legacy Dexie data | Idempotent (guarded by `users/{uid}.migratedAt`); re-runs safely; local Dexie kept read-only, never wiped |

## Business Rules
- **Offline persistence IS the store** (`persistentLocalCache` + `persistentMultipleTabManager`) — there is **no separate outbox** (`lib/sync/*` deleted).
- The Firestore-backed `repo` keeps the **same function names/shapes** as Phases 1–5, so `lib/calc` and all bill-form/detail/receipt components are unchanged; only reactive reads move from `useLiveQuery` to Firestore snapshot hooks.
- **Shared ledger:** every member of the business sees all its bills/farmers/dues, with live multi-device updates (last-write-wins per document).
- **Migration** runs once on the first **owner** sign-in and is idempotent.
- **Removed in this phase:** the `backend/` FastAPI+SQLite tree, `frontend/src/lib/sync/*`, `SyncSettings` (base-URL/token box), the Phase-4 backend deploy docs, and `sync-journey.spec.ts`. Firebase replaces all of it (see [cloud-sync](cloud-sync.md), [offline-queue](offline-queue.md), [backup-restore](backup-restore.md), all annotated REPLACED-BY-Firestore).
- Sync is **automatic**; the Settings **"Sync now"** simply surfaces `waitForPendingWrites()` + an online/offline indicator — no URL or token to enter (the user is identified by their phone).

## Success Criteria
- [ ] A bill created by one member appears live on another member's device (shared, `onSnapshot`).
- [ ] A bill created **offline** persists locally and **auto-syncs** on reconnect, with the status indicator reflecting pending → synced; no data loss, no duplication.
- [ ] `lib/calc` and every bill-form/detail/receipt component compile and behave unchanged against the re-pointed `repo` (same signatures).
- [ ] On the first owner sign-in, existing local bills/farmers/grain types are migrated into the business scope; re-running the migration changes nothing (idempotent).
- [ ] The `backend/` tree, `lib/sync/*`, `SyncSettings`, and `sync-journey.spec.ts` are gone; no code imports them.
