# Capability: Search & Filter Bills — DEFERRED (Phase 2)

_Target phase: **Phase 2** · slice-c (UI) + slice-a (queries). Indexes already exist in the Phase-1 Dexie schema._

## What It Does
Finds bills by date, farmer name, place/village, or grain type from the home list.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| query/filter | { text?, date?, grainTypeId? } | Search bar | yes (any one) |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| filtered bills | Bill[] | Home list |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| IndexedDB (Dexie) | indexed queries on `farmerName`/`farmerPlace`/`purchaseDate`/`*grainTypeIds` | Empty result |

## Business Rules
- Text search matches farmer name or place (prefix, case-insensitive) via the existing indexes.
- Date filter matches `purchaseDate`; grain filter matches the multiEntry `grainTypeIds`.
- Filters combine (AND) when more than one is set.

## Success Criteria
- [ ] Searching a farmer name returns only that farmer's bills.
- [ ] Filtering by grain type returns bills containing that grain.
- [ ] Filtering by date returns bills of that date.
