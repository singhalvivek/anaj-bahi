# Capability: Due / Outstanding List — DEFERRED (Phase 2)

_Target phase: **Phase 2** · slice-b (UI) + slice-a (data)._

## What It Does
An in-app list of every bill that **has a due date and still has an outstanding balance** (`outstanding > 0`). Dated bills are grouped into buckets by due date (overdue / due-soon / upcoming). A bill with **no due date does not appear** on this screen — the due date is what makes a bill "due". No phone notifications.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| dueDate | ISO date | Bill create/edit | no — but a bill with no due date is not shown on the Due screen |
| today | date | Device clock | yes |
| soonDays | number | Config (default 7) | no |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| dated outstanding bills | Bill[] grouped into 3 buckets | Due / Outstanding screen |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| IndexedDB (Dexie) | query all bills, keep those with a `dueDate` and `outstanding > 0` | Empty state |

## Business Rules
- **A bill appears iff it has a `dueDate` AND `outstanding > 0`** (`outstanding` per [data.md § Line and bill totals / Paldari](../data.md#paldari-labor-charge--phase-10), net of paldari and payments). A bill with no due date, and any fully-paid bill (`outstanding ≤ 0`), never appears.
- **Bucketing (by due date) of the included bills:**
  - **Overdue** — `dueDate < today` and `outstanding > 0`.
  - **Due soon** — `today ≤ dueDate ≤ today + soonDays` (default 7) and `outstanding > 0`.
  - **Upcoming** — `dueDate > today + soonDays` and `outstanding > 0`. This bucket is rendered so a bill whose due date is more than `soonDays` out still shows immediately after creation.
- Every included bill falls into **exactly one** of the three buckets.
- Suggested display order: Overdue → Due soon → Upcoming. Empty buckets are omitted from the UI.

## Success Criteria
- [ ] A bill with a due date **after today** (even far beyond `soonDays`) and a balance appears under **Upcoming** — right after it is created.
- [ ] A bill past its due date with a balance appears under **Overdue**.
- [ ] A bill due within `soonDays` with a balance appears under **Due soon**.
- [ ] A bill with `outstanding > 0` and **no due date** does **not** appear on the Due screen.
- [ ] Paying a bill in full (`outstanding ≤ 0`) removes it from the list.
- [ ] When no bill has a due date and an outstanding balance, the screen shows the empty state ("nothing due").
