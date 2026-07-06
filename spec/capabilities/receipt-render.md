# Capability: Receipt Render — DEFERRED (Phase 3)

_Target phase: **Phase 3** · slice-b._

## What It Does
Renders a bill as a clean, bilingual on-screen receipt that mirrors the trader's paper ledger: business header, farmer/bill identity, a top **weight column-grid** (per grain: sack weights arranged in **vertical columns of up to 10 sacks each**, with per-column subtotals), and — below the grid — a **single consolidated summary table** (columns = grains, rows = the line items gross → deduction → net → rate → amount) ending in the bill grand total. This rendered node is the input to [share-as-image](share-as-image.md).

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| bill | Bill | IndexedDB | yes |
| profile | business profile | [business-profile](business-profile.md) | yes |
| lang | 'hi' \| 'en' | i18n context | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| receipt node | rendered DOM | Screen (input to share) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| (none — render only) | — | — |

## Sack column layout (the ledger arrangement)
- Each grain's sacks are laid out as **vertical columns of up to 10 rows (10 sacks per column)**, showing **weight values only — no sack numbers**.
- **Column fill (entry order):** column 1 = sacks 1–10, column 2 = 11–20, etc. A grain with N sacks occupies **`ceil(N/10)` columns**. Max 100 sacks/bill → max 10 columns.
- **Grains flow left-to-right sharing one continuous column track:** grain 1 starts at column 1; each later grain starts in the next free column after the previous grain's last column. Example: grain A 25 sacks → columns 1–3 (10, 10, 5); grain B 11 sacks → columns 4–5 (10, 1); grain C 6 sacks → column 6.
- The split is produced by a **pure column-grouping helper** (`ceil(N/10)` columns per grain, entry-order split into ≤10-cell columns, plus each column's subtotal) so it is unit-testable independent of rendering.

## Top weight column-grid — per-grain block (width = its column count)
1. **Grain-name header** spanning the block (localized to the current language).
2. **Its weight columns side by side**, each ≤10 cells, weight values only (no numbers/indices).
3. A **subtotal row** under the block, one cell **aligned beneath each column** = that column's sum of weights.

The grid holds **only** the weight columns + per-column subtotals — there are **no per-grain summary lines under the grid** anymore. All gross/deduction/net/rate/amount figures live in the single consolidated table below.

## Consolidated summary table (below the grid)
Below the weight column-grid, render **one** summary table for the whole bill:
- **Columns = the grains**, one column per grain, header = the **grain name**, in the **same order as the grid** (left-to-right).
- **Rows = the line items**, top-to-bottom, so reading a grain's column downward gives gross → deduction → net → rate → amount:
  1. **Gross weight (kg)** — sum of that grain's sack weights.
  2. **Deduction** — the resolved kg **and** a compact basis in one cell, e.g. `3.595 kg (0.5/sack + 1%)`; a grain with multiple deductions shows the summed resolved kg with each basis in the compact form, matching [deductions-and-totals-calc](deductions-and-totals-calc.md).
  3. **Net weight** — in **kg only** (weight is always shown in kg; the quintal unit appears only on the Rate row, the trade standard).
  4. **Rate (₹/quintal)**.
  5. **Amount (₹)**.
- **Bill grand total** for Amount is shown as either a trailing **"Total" column** or a **bill-total line** directly under the table = the sum of the grains' Amount cells.
- **Single-width, no-crop sizing:** the table is sized to its own content — **width = `max-content`, `min-width: 100%`, and NO inner horizontal scroll/overflow** — so the whole receipt is one consistent width and the rasterized PNG never crops off the last grain column. On-screen horizontal scrolling of a wide receipt is owned by the **outer preview container**, not the table.
- All figures come from `lib/calc` — the table only re-arranges them; it performs no arithmetic of its own beyond summing the printed Amount cells for the total.

## Business Rules
- **Header & identity (UNCHANGED from Phase 3):** business header from the [business profile](business-profile.md); bill id (`DDMMYY/xxxxx`) + purchase date; farmer name / village / phone; bilingual Hindi/English following the current toggle; Indian-style ₹ formatting.
- Below the consolidated table, print the **bill grand total** = sum of the grains' Amount cells (trailing "Total" column or a bill-total line).
- **Math is unchanged:** all gross/deduction/net/amount/total values come from the existing calc engine (`lib/calc`) — see [data.md](../data.md); this capability only changes the **visual arrangement**, not the arithmetic.
- Sacks appear in the exact **entry order** captured by [sack-by-sack entry](sack-by-sack-entry.md); column fill follows that order.
- The receipt is intentionally **wider than the old flat breakdown** (up to 10 columns) to match the paper ledger — this is expected, not a defect. The consolidated summary table sizes to its own content (single consistent width, no inner horizontal scroll) so the rasterized image never clips the last grain column.
- Language follows the current toggle; amounts use the same rounding as [data.md](../data.md).

## Success Criteria
- [ ] Each grain's sacks render in vertical columns of ≤10 weights (no sack numbers), in entry order.
- [ ] A grain with N sacks spans exactly `ceil(N/10)` columns; grains flow left-to-right with no gap or overlap in the shared column track.
- [ ] Each column's subtotal equals the sum of the weights in that column; the grid shows **no** per-grain summary lines.
- [ ] Below the grid, a single consolidated table has **one column per grain** (header = grain name, same order as the grid) and rows **Gross weight (kg)**, **Deduction** (resolved kg + compact basis), **Net weight** (kg only), **Rate ₹/quintal**, **Amount ₹**, in that top-to-bottom order.
- [ ] Each grain's Gross = sum of that grain's sacks; each grain's Amount and the bill grand total match `lib/calc` exactly; the grains' Amount cells sum to the printed grand total.
- [ ] Header, bill id, purchase date, and farmer details render as in Phase 3, in both Hindi and English.
- [ ] The consolidated summary table sizes to its own content (width `max-content`, `min-width: 100%`, no inner horizontal scroll) so a multi-grain bill (e.g. 3 grains) rasterizes to a single-width PNG with the last grain column fully visible — never clipped.
- [ ] The column-grouping helper is covered by unit tests (entry-order split, `ceil(N/10)`, per-column subtotals) independent of the DOM.
