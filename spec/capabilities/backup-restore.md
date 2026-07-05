# Capability: Backup & Restore — DEFERRED (Phase 4)

_Target phase: **Phase 4** · slice-c (frontend) + slice-a (backend)._

## What It Does
Restores the trader's full ledger onto a fresh device by pulling all records from the cloud backup.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| device token | bearer token | user entry | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| restored records | farmers/bills/grain types | IndexedDB |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| FastAPI `/sync/pull` | full pull | Visible error; no partial corruption |

## Business Rules
- Restore is a full pull (`since=0`) merged into an empty/local store.
- Same token identifies the same user's data.

## Success Criteria
- [ ] Entering the token on a new device restores all bills/farmers/payments.
- [ ] Restored data matches the source device.
- [ ] Restore is safe to re-run (idempotent).
