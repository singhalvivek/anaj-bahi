# Capability: Bill List & Reopen

_Phase 1 · slice-c (UI) + slice-a (data)_

## What It Does
Shows all saved bills newest-first on the home screen and lets the trader reopen any bill to see its full, identical detail.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| — | — | On mount, reads all bills | — |
| bill id | string (URL-encoded) | `?id=` on the detail route | yes (detail) |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| bill cards | Bill[] | Home list (reactive `useLiveQuery`) |
| bill detail | Bill | Detail screen |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| IndexedDB (Dexie) | `listBills()`, `getBill(id)` | Empty/clear state; visible error if storage fails |

## Business Rules
- List sorted by `createdAt` descending; each card shows id, farmer + place, date, grain chips, total.
- Detail reads the id from the URL-encoded `?id=` query param (bill ids contain `/`).
- Detail renders each grain line's sacks in the **paper-ledger column-grid layout** (vertical columns of up to 10 sacks, **weight values only, no sack numbers**, `ceil(N/10)` columns per grain with per-column subtotals, columns restarting within each grain section) using the shared, unit-tested column-grouping helper; plus deductions, per-line and bill totals.
- Empty state is friendly and bilingual; Payments/Share appear as labelled stubs on detail.

## Success Criteria
- [ ] A newly saved bill appears at the top of the list without a manual refresh.
- [ ] Reopening shows the exact farmer, sacks (in order), deductions, and totals that were saved.
- [ ] Deep-linking `/bill?id=<encoded>` opens the correct bill.
