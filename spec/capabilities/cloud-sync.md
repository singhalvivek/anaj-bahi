# Capability: Cloud Sync — DEFERRED (Phase 4)

_Target phase: **Phase 4** · slice-a (FastAPI/Postgres backend) + slice-b (frontend engine). First phase requiring `.env`/secrets._

## What It Does
Syncs local farmers/bills/payments/custom grain types to a personal cloud backend when online (backup), pulling remote changes to merge.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| local mutations | records since last sync | IndexedDB outbox | yes |
| device token | bearer token | device / `.env` | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| pushed records | server rows | Postgres via FastAPI |
| pulled records | merged into Dexie | IndexedDB |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| FastAPI `/sync/push`, `/sync/pull` | push/pull | Queue and retry; local store unaffected |

## Business Rules
- Last-write-wins by `updatedAt` per record.
- Auth via per-device bearer token; local IndexedDB stays the device source of truth.
- Never blocks offline use.

## Success Criteria
- [ ] Records created offline push on reconnect.
- [ ] Pull merges remote changes without clobbering newer local edits.
- [ ] Backend tests run against a real Postgres (not SQLite).
