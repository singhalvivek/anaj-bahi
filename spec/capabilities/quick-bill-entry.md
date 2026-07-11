# Capability: Quick-Entry (Summary) Bills

_Phase 5 · slice-a (data + calc) → slice-b (chooser + quick form) + slice-c (summary detail + receipt)_

## What It Does
Adds a **second way to create a bill** — a summary "quick entry" form for transcribing a bill that was **already written on paper** (per-grain totals only, no per-sack weights) — alongside the unchanged sack-by-sack "fresh" flow. Tapping **+ New Bill** now opens a two-option chooser; the quick form captures each grain's price, total weight, and an **entered money amount that the app stores verbatim and never recomputes**.

## Why (user problem)
The trader often already has a bill written on paper (only the summary line per grain, and the final rupee amount). Re-entering every sack weight just to reproduce a number he has already computed is wasted effort and risks the app's math disagreeing with the paper he handed the farmer. Quick entry transcribes the paper bill faithfully — the entered amount is authoritative.

## User Flow
1. Home **+ New Bill** (`new-bill-btn`) → **chooser** (`/bills/choose`).
2. **Fresh bill** (`choice-fresh`) → the existing `/bills/new` sack-by-sack form, **completely unchanged**.
3. **Quick entry** (`choice-quick`) → the new `/bills/quick` summary form.
4. Fill farmer (name + place required, phone optional, same autocomplete), purchase date (defaults today), optional due date; add ≥1 grain line; **Save** (`save-bill`) → persist to IndexedDB (offline) → navigate home. The new bill appears in the list and, on reopen, renders **totals-only** detail.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| farmer | Farmer (existing or new) | FarmerPicker autocomplete (reused) | yes (name + place) |
| purchaseDate | ISO `yyyy-mm-dd` | date field (defaults today) | yes |
| dueDate | ISO `yyyy-mm-dd` | date field | no |
| lines[].grainTypeId | string | grain-type selector (seeded + add-custom, reused) | yes |
| lines[].pricePerQuintal | number (₹/quintal) | numeric input | yes (> 0) |
| lines[].totalWeightKg | number (kg, gross) | numeric input — ONE number, not per sack | yes (> 0) |
| lines[].amount | number (₹) | numeric input — entered verbatim from paper | yes (> 0) |
| lines[].sackCount | integer | numeric input, **no "(optional)" label** | no |
| lines[].deductionKg | number (kg) | numeric input, **no "(optional)" label** | no |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| bill | `Bill` with `entryMode: 'summary'`, generated `DDMMYY/xxxxx` id, denormalised farmerName/place + grainTypeIds, `payments: []`, and summary grain lines | IndexedDB `bills` via `repo.createBill` (unchanged) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| IndexedDB (Dexie) | `upsertFarmer`, `generateBillId`, `createBill`, (edit) `updateBill` | Visible error; do not navigate away or lose entered data (same pattern as create-bill) |

## Data Shape (extends [data.md](../data.md), no breaking change)
- Bill gains an optional discriminator **`entryMode?: 'sacks' | 'summary'`**. **Back-compat rule:** a bill with no `entryMode` reads as `'sacks'` (`bill.entryMode ?? 'sacks'`). Every existing bill is unaffected — its stored shape is byte-for-byte identical (no `entryMode`, no `summary`).
- A **summary grain line** carries an optional **`summary`** sub-object `{ totalWeightKg, sackCount?, deductionKg?, amount }` and keeps `sackWeights: []` + `deductions: []` (empty — never read for a summary line). The presence of `summary` is the per-line discriminant. See [data.md § Summary grain lines](../data.md#summary-grain-lines-quick-entry).
- Sync: bills serialise whole to Dexie **and** the Phase-4 cloud sync (backend stores each bill's JSON verbatim; see [api.md](../api.md) / [architecture.md § Phase-4 sync contract](../architecture.md#phase-4-sync-contract)) — the new fields ride along automatically. **No backend schema change** (the backend never validates bill shape). Confirmed against `spec/api.md` and `architecture.md`.

## Calc Rule (extends [deductions-and-totals-calc.md](deductions-and-totals-calc.md))
The pure `lib/calc` engine handles a summary line **without summing sacks**:
- `grossWeightKg = summary.totalWeightKg`
- `deductionKg = summary.deductionKg ?? 0`
- `netWeightKg = max(0, gross − deductionKg)`
- `sackCount = summary.sackCount ?? 0`
- `amount = roundRupees(summary.amount)` — **the entered amount, NOT recomputed** from `net × price`.
- `computeBillTotal` still = **Σ each line's amount** (2 dp) — for summary lines the amount is the entered figure.

`computeGrainLine` **dispatches** on `line.summary`: present → `computeSummaryLine(...)`; absent → the unchanged sacks path. Because every existing consumer (home card totals, bill detail, receipt, **and `billBalance` → payments/outstanding/due-status**) calls `computeGrainLine`/`computeBillTotal`, they all stay correct for both modes with no call-site changes. The sacks path is only ever taken when `summary` is absent, so **sacks bills are provably unaffected**. See [architecture.md § Quick-entry calc + type additions](../architecture.md#quick-entry-summary-bills--frozen-additions-phase-5).

## Validation
Save (`save-bill`, reused) is enabled **only** when: farmer name + place set, purchase date set, AND every grain line has grainTypeId + `price > 0` + `totalWeightKg > 0` + `amount > 0`. Otherwise disabled with an inline bilingual hint (same pattern as the fresh form). `sackCount` and `deductionKg` are never required.

## Detail & Receipt (branch on `entryMode`)
- **Bill Detail** (`/bill?id=…`): a summary bill renders **totals-only per grain** — grain name, price, total weight, sacks (only if given), deduction kg (only if given), entered amount — plus the bill total. **No sack column-grid.** A sacks bill renders exactly as today. See [ui.md § Bill Detail](../ui.md#screen-bill-detail--reopen-billidencoded-id--slice-c).
- **Share-as-image receipt**: a summary bill's receipt shows the same totals-only content — **no weight column-grid**; the consolidated summary table (gross/deduction/net/rate/amount) still renders, sourced from the summary figures (net = weight − deduction; rate = price; amount = entered; deduction cell shows resolved kg with **no basis note**). Sharing still works unchanged. A sacks bill's receipt is unchanged. See [receipt-render.md](receipt-render.md).

## Edit & Edit-Lock
- Editing a summary bill reopens the **quick form pre-filled** (`/bills/quick?edit=<id>`); a sacks bill still edits via `/bills/new?edit=<id>`. Bill Detail's Edit link branches on `entryMode`.
- The existing **edit-lock is unchanged and applies to both modes**: once `payments.length > 0` the bill is edit-locked (`updateBill` throws `BillLockedError`); only payments may be added. See [bill-edit-lock.md](bill-edit-lock.md).
- Payments / outstanding / due list are **unchanged** — they run off the bill total, which now can come from either mode via the same `billBalance`.

## Business Rules
- The chooser is the only new entry point for creating a bill; both Fresh and Quick remain reachable. Fresh lands in exactly today's `/bills/new` form.
- Bill total = **sum of the grain lines' entered Amounts** (mirrors the "sum of line amounts" rule; only here each amount is entered, not computed).
- Bill id per the [data.md](../data.md) `DDMMYY/xxxxx` rule; regenerate on collision (reuses `generateBillId`).
- No network; the entire quick-entry flow works offline (Phase-1 discipline preserved).

## Success Criteria
- [ ] `+ New Bill` opens the chooser (`new-bill-choice`) with `choice-fresh` and `choice-quick`; both are large, thumb-reachable, bilingual.
- [ ] `choice-fresh` lands on the unchanged `/bills/new` sack form; its existing E2E journey still passes.
- [ ] `choice-quick` opens `/bills/quick`; `sack-count-input` and `deduction-kg-input` render **without** any "(optional)" text.
- [ ] Save is disabled until farmer name + place + purchase date are set and every line has grainType + price > 0 + totalWeight > 0 + amount > 0; enabling shows no hint.
- [ ] Saving a 2-grain summary bill (amounts e.g. ₹3741.72 + ₹3360.00) persists `entryMode: 'summary'`; the home card and detail both show total **₹7101.72** — the **sum of entered amounts**, never a recomputed `net × price`.
- [ ] `computeSummaryLine` unit tests: entered amount is returned verbatim (rounded 2 dp) even when `net × price` would differ; `deductionKg ?? 0`; `sackCount ?? 0`; net clamps at 0.
- [ ] Reopening a summary bill shows **totals-only** detail (no sack grid); reopening a sacks bill still shows the paper-ledger column grid.
- [ ] Editing a summary bill reopens `/bills/quick?edit=` pre-filled; after a payment exists the bill is edit-locked in both modes.
- [ ] Share on a summary bill produces a receipt (totals-only, no weight grid) and shares/downloads a PNG successfully.
- [ ] A saved sacks bill created before this capability renders and totals identically (back-compat: missing `entryMode` reads as `'sacks'`).
</content>
</invoke>
