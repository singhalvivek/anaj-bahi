# Capability: Business Profile — DEFERRED (Phase 3)

_Target phase: **Phase 3** · slice-a._

## What It Does
Stores the trader's business header (shop/trader name + phone) used on the shared receipt.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| shopName | string | Settings | yes |
| traderName | string | Settings | no |
| phone | string | Settings | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| profile | { shopName, traderName?, phone } | IndexedDB `meta` (settings) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| IndexedDB (Dexie) | read/write profile | Visible error |

## Business Rules
- Single profile (one user). Editable any time.
- Receipt header renders from this profile in the current language.

## Success Criteria
- [ ] Saved profile persists and appears on the receipt.
- [ ] Editing updates future receipts.
