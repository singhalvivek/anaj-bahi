# Capability: Cloud Sync — ⚠️ SHIPPED (Phase 4) → REPLACED-BY-Firestore (Phase 7)

> **Superseded.** This FastAPI + SQLite push/pull sync is **replaced by [firestore-store](firestore-store.md)** — Cloud Firestore with IndexedDB offline persistence, accessed directly from the client. Its code (`backend/`, `frontend/src/lib/sync/*`, `SyncSettings`) is **removed in Phase 7**. Kept only as the Phases-1–5 record.

_Original target phase: **Phase 4** · slice-a (FastAPI/**SQLite** backend) + slice-b (frontend `lib/sync` engine)._

Frozen wire + storage + `lib/sync` contract: [architecture.md § Phase-4 sync contract](../architecture.md#phase-4-sync-contract).

## What It Does
Syncs local farmers/bills (payments embedded)/custom grain types/business profile to a personal **FastAPI + SQLite** backend when online (backup), and pulls all data back for restore. The local IndexedDB store stays the device source of truth.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| local snapshot | `{ bills, farmers, grainTypes, profile }` | Dexie (deduped by id) | yes |
| device token | bearer token | Settings (Dexie `meta`) — same as `backend/.env` `DEVICE_TOKEN` | yes |
| base URL | string | Settings (Dexie `meta`), user-entered | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| pushed records | JSON rows (`id` + `updated_at` + JSON) | **SQLite** via FastAPI `/sync/push` |
| pulled records | merged into Dexie | IndexedDB |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| FastAPI `POST /sync/push`, `GET /sync/pull` (`Authorization: Bearer <token>`) | push/pull | Record `lastError`, retain pending, retry later; local store unaffected. Missing/wrong token → 401. |

## Business Rules
- Push/pull require `Authorization: Bearer <DEVICE_TOKEN>`; missing/wrong → **401**. `GET /health` needs no auth.
- **Bills:** last-write-wins by `updatedAt`. **Farmers/grain types:** upsert-by-id (last push wins). **Profile:** singleton, latest wins; `null` is a no-op.
- Push is **idempotent** — re-pushing the same payload is a safe no-op (no dupes).
- Never blocks offline use; local IndexedDB stays the device source of truth.

## Success Criteria
- [ ] Records created offline push on reconnect via the token-gated `/sync/push`.
- [ ] Pull merges remote changes without clobbering newer local edits (bill `updatedAt` last-write-wins).
- [ ] Re-pushing an unchanged snapshot changes nothing (idempotent, no duplicate rows).
- [ ] A push without / with a wrong `Authorization` header is rejected with 401.
- [ ] Backend tests run against a **real on-disk SQLite file** (not an in-memory substitute).
