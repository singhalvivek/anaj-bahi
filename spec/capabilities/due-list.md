# Capability: Due / Outstanding List — DEFERRED (Phase 2)

_Target phase: **Phase 2** · slice-b (UI) + slice-a (data)._

## What It Does
An in-app list of **every bill that still has an outstanding balance** (`outstanding > 0`), whether or not it has a due date. Bills are grouped into buckets by due date (overdue / due-soon / upcoming / undated) — a bill is **never hidden just because its due date is blank**. No phone notifications.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| dueDate | ISO date | Bill create/edit | no — **may be blank; a blank due date does not exclude the bill** |
| today | date | Device clock | yes |
| soonDays | number | Config (default 7) | no |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| outstanding bills | Bill[] grouped into 4 buckets | Due / Outstanding screen |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| IndexedDB (Dexie) | query all bills, keep those with `outstanding > 0` | Empty state |

## Business Rules
- **Inclusion is by balance, not by due date:** a bill appears **iff `outstanding > 0`** (`outstanding` per [data.md § Line and bill totals / Paldari](../data.md#paldari-labor-charge--phase-10), net of paldari and payments). Fully-paid bills (`outstanding ≤ 0`) never appear.
- **Bucketing (by due date) of the included bills:**
  - **Overdue** — has a `dueDate`, `dueDate < today`, and `outstanding > 0`.
  - **Due soon** — has a `dueDate`, `today ≤ dueDate ≤ today + soonDays` (default 7), and `outstanding > 0`.
  - **Upcoming** — has a `dueDate`, `dueDate > today + soonDays`, and `outstanding > 0`. **(This bucket is now rendered — previously the `'upcoming'` status was computed but never displayed.)**
  - **Outstanding (undated)** — `outstanding > 0` and **no `dueDate`**. **(These bills are now shown — previously they were excluded entirely, which meant a bill created with the due-date field left blank never appeared on the Due screen despite having a balance.)**
- Every included bill falls into **exactly one** of the four buckets. Bucketing changes only how a bill is grouped, never whether it appears.
- Suggested display order: Overdue → Due soon → Upcoming → Outstanding (undated). Empty buckets are omitted from the UI.

## Success Criteria
- [ ] A bill with `outstanding > 0` and **no due date** appears under **Outstanding (undated)** (it is NOT hidden).
- [ ] A bill past its due date with a balance appears under **Overdue**.
- [ ] A bill due within `soonDays` with a balance appears under **Due soon**.
- [ ] A bill with a due date beyond `soonDays` and a balance appears under **Upcoming** (a visible bucket, not silently dropped).
- [ ] Every bill with `outstanding > 0` appears in exactly one bucket; no outstanding bill is ever absent from the screen.
- [ ] Paying a bill in full (`outstanding ≤ 0`) removes it from the list.
- [ ] When no bill has `outstanding > 0`, the screen shows the empty state ("nothing outstanding").
