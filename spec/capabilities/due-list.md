# Capability: Due-Soon / Overdue List — DEFERRED (Phase 2)

_Target phase: **Phase 2** · slice-b (UI) + slice-a (data)._

## What It Does
An in-app list of bills with an outstanding balance and a due date, grouped into due-soon and overdue (no phone notifications).

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| dueDate | ISO date | Bill create/edit | no |
| today | date | Device clock | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| due/overdue bills | Bill[] grouped | Due screen |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| IndexedDB (Dexie) | query bills with outstanding + dueDate | Empty state |

## Business Rules
- Overdue: `dueDate < today` and `outstanding > 0`.
- Due-soon: `today ≤ dueDate ≤ today + N days` and `outstanding > 0` (N configurable, default 7).
- Fully-paid bills never appear.

## Success Criteria
- [ ] A bill past its due date with balance appears under Overdue.
- [ ] A bill due within N days appears under Due-soon.
- [ ] Paying a bill in full removes it from the list.
