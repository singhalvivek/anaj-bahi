# Capability: Sack-by-Sack Weight Entry

_Phase 1 · slice-b (UI) — the signature interaction_

## What It Does
Lets the trader add individual sack weights one at a time into a grain line, always seeing the already-entered weights (scrollable list), a running sack count, and a running total **directly above** the numeric input.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| weight | number (kg, decimal ok) | Numeric-only input (`inputmode="decimal"`) | yes per Add |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| sackWeights | number[] (ordered) | Parent grain line state → saved on the bill |
| running summary | { count, totalKg } | Rendered live above the input |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| (none — local component state) | — | — |

## Business Rules
- Input accepts digits + a single decimal point only; empty/zero Add is ignored.
- **Add** (button or Enter) appends the weight, then **clears and re-focuses** the field for the next sack.
- The entered-weights list sits **above** the input, is scrollable (capped height), auto-scrolls to the newest entry, and each row has a ✕ to remove (preserving order of the rest).
- Summary shows "Sacks: N • Total: X.X kg"; updates live and feeds line/bill totals.

## Success Criteria
- [ ] Adding 30 weights in sequence keeps the input focused and the newest weight visible without manual scrolling.
- [ ] Count and total update on every Add and every remove.
- [ ] Order is preserved exactly as entered (verified on reopen and, later, on the receipt).
- [ ] Non-numeric input is rejected; empty Add is a no-op.
