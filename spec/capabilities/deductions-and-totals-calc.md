# Capability: Deductions & Totals Calculation

_Phase 1 · slice-a (pure `lib/calc`) — highest-risk correctness surface_

## What It Does
Computes, exactly and unit-correctly, each grain line's gross weight, resolved deductions (kg), net weight, line amount (₹), and the bill total — as pure functions the UI calls on every change.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| pricePerQuintal | number (₹/100kg) | Grain-line editor | yes |
| sackWeights | number[] (kg) | Sack-by-sack entry | yes |
| deductions | Deduction[] (basis + value) | Deduction editor | no (0..N) |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| GrainLineTotals | { sackCount, grossWeightKg, deductionKg, netWeightKg, amount } | Live line totals |
| billTotal | number (₹, 2 dp) | Live bill total |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| (none — pure functions) | — | — |

## Business Rules
- 1 quintal = 100 kg. Deduction bases resolve per the [data.md](../data.md) table; multiple deductions are additive.
- `netWeightKg = max(0, gross − deductionKg)` (never negative).
- `amount = roundRupees(netQuintals × pricePerQuintal)`; `roundRupees` = half-up to 2 dp.
- Bill total = sum of already-rounded line amounts (no penny drift).
- Weights are not rounded; only ₹ amounts are.

## Summary-line handling (quick-entry) — **Phase 5**
For a **summary** grain line ([quick-bill-entry](quick-bill-entry.md)) the engine does **not** sum sacks and does **not** recompute the amount:
- `grossWeightKg = summary.totalWeightKg`; `deductionKg = summary.deductionKg ?? 0`; `netWeightKg = max(0, gross − deductionKg)`; `sackCount = summary.sackCount ?? 0`.
- `amount = roundRupees(summary.amount)` — the **entered** amount, returned verbatim (2 dp), NOT `netQuintals × price`.
- `computeGrainLine` dispatches on `line.summary` (present → this rule; absent → the sacks rule above). `computeBillTotal` is unchanged and thereby summary-aware. Because `billBalance` (payments/outstanding/due) calls `computeBillTotal`, summary bills get correct balances with no extra code. Sacks bills only ever take the sacks path → provably unaffected. See [data.md § Summary-line calc](../data.md#summary-line-calc-quick-entry).

## Success Criteria
- [ ] Worked Examples 1–4 in [data.md](../data.md) reproduce exactly in unit tests (₹3741.72; ₹2745.88; total ₹7101.72; clamp → ₹0.00).
- [ ] Each deduction basis resolves to the documented kg for given gross/sackCount.
- [ ] `roundRupees(3741.715)=3741.72` and `roundRupees(3741.714)=3741.71`.
- [ ] Pure: identical inputs always yield identical outputs, no side effects.
- [ ] **Summary line (Example 5, [data.md](../data.md)):** `computeSummaryLine` / `computeGrainLine({summary})` returns the entered amount verbatim (even when `net × price` differs), `deductionKg ?? 0`, `sackCount ?? 0`, net clamped ≥ 0; a mixed sacks+summary bill's `computeBillTotal` = Σ line amounts.
