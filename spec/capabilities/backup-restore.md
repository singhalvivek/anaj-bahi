# Capability: Backup & Restore — DEFERRED (Phase 4)

_Target phase: **Phase 4** · slice-c (frontend) + slice-a (**FastAPI + SQLite** backend)._

Frozen wire + `lib/sync` contract: [architecture.md § Phase-4 sync contract](../architecture.md#phase-4-sync-contract).

## What It Does
Restores the trader's full ledger onto a fresh device by pulling all records from the **SQLite** cloud backup (`restoreFromCloud()` → `GET /sync/pull` → write into local Dexie).

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| base URL | string | Settings (Dexie `meta`), user-entered | yes |
| device token | bearer token | Settings (Dexie `meta`) — same as `backend/.env` `DEVICE_TOKEN` | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| restored records | `{ bills, farmers, grainTypes, profile }` | IndexedDB (Dexie) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| FastAPI `GET /sync/pull` (`Authorization: Bearer <token>`) | full pull | Visible error; no partial corruption. Missing/wrong token → 401. |

## Business Rules
- Restore is a **full pull** of all device data (`GET /sync/pull`) written into the local Dexie store.
- Restoring into an empty/fresh store recreates the ledger; re-running restore is safe (upsert-by-id, bill `updatedAt` last-write-wins).
- The same `DEVICE_TOKEN` identifies the same user's data; a wrong/missing token → 401 (no data).

## Success Criteria
- [ ] Entering the base URL + token on a fresh device and running Restore repopulates all bills (payments embedded)/farmers/grain types/profile.
- [ ] Restored data matches the source device exactly.
- [ ] Restore is safe to re-run (idempotent — no duplicates, no corruption).
- [ ] Restore against a wrong/missing token is rejected (401) and leaves the local store untouched.
