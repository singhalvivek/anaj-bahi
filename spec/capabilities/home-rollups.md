# Capability: Home Rollups (this month · today · not-backed-up) — Phase 12

_Target phase: **Phase 12** (pilot readiness) · slice-a (pure aggregation + formatters + sync count) + slice-b (home surfaces + drill-down)._

## What It Does
Puts the first figures in Anaj Bahi that **span more than one bill** on the home screen — a **"this month" strip** (bought / paid / all-time due), a **close-of-day line** (today's bill count / bought / paid / pending), and a **persistent "not backed up yet" badge** — every one of them derived on the device from the bills already loaded, tappable through to the bills behind it, and working fully offline.

## Why
The app is bill-centric: today **no figure anywhere spans two bills** ([strategy §1](../../strategy/product-review-2026-07.md)). Paper beats the app at capture speed and loses at recall and totals — so competing on the pen is the losing move: **paper is the input device, the app is the brain** (§5). The pilot (3–5 real traders, two weeks) needs exactly two things true: entry is fast, and **something visible comes back after every entry**. These three surfaces are the give-back:

- The **month strip** is the cheap slice of the analysis spine — it is worth something from the very first bill, which the full Phase-13 period report is not.
- The **close-of-day line** is the cheapest item on the whole P0 list and the strongest habit hook: a fixed reason to open the app every evening (§9-P0.4).
- The **not-backed-up badge** converts the one real data-loss risk from *silent and unknown in scope* into *visible and countable*. The scary part of losing the phone (or Android clearing PWA site data) is not the loss — it is not knowing **which** bills were lost (§11).

And the governing caveat: **one wrong total destroys trust in all of them, permanently** (§5). Hence the exact, unambiguous definitions below, the per-bill clamp, and the round-then-sum display rule.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| bills | `Bill[] \| undefined` | the existing live `useBills()` snapshot (`lib/db/hooks`) — `undefined` = not loaded yet | yes |
| current month | `string` (`yyyy-mm`) | `monthKeyOf(todayIso())` from the device clock | yes |
| today | `string` (ISO `yyyy-mm-dd`) | `todayIso()` (`lib/calc`) from the device clock | yes |
| unsynced bill set | `{ count, billIds }` | `subscribeUnsyncedBills()` (`lib/db/sync-status`) — Firestore per-doc `metadata.hasPendingWrites` | yes (badge only) |

**No new entity, no new field, no schema change, and no new Firestore query.** The rollups are a pure derivation over the snapshot the home screen already holds; the badge attaches a metadata-change listener to the **same** bills collection that is already being listened to (local pending-write metadata — it needs no network and costs no extra document read). See [data.md § Phase-12 derived aggregates](../data.md#phase-12-derived-aggregates-no-schema-change).

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| month rollup | `MonthRollup` (`{ monthKey, billCount, bought, paid, dueAllTime }`, whole rupees) | the month strip on `/` |
| day rollup | `DayRollup` (`{ date, billCount, bought, paid, pending }`, whole rupees) | the close-of-day line on `/` |
| unsynced count + bill ids | `{ count: number; billIds: string[] }` | the badge on `/` + the `unsynced` drill-down |
| contribution list | `Contribution[]` (one row per contributing bill, whole rupees) | the `/rollup` drill-down screen |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Cloud Firestore (existing `useBills()` listener) | live read of the business's bills, served from the local cache first | already handled: the hook falls back to `[]` on a listen error; while `undefined` the surfaces render skeletons, never `₹0` |
| Cloud Firestore metadata listener (`subscribeUnsyncedBills`) | `onSnapshot(bills, { includeMetadataChanges: true })` — counts docs whose own `metadata.hasPendingWrites` is true | on listen error or no active business → `{ count: 0, billIds: [] }` (badge hidden); never throws |

No network is introduced. Everything above works in airplane mode.

---

## The three exact definitions (get these wrong and the feature is worse than nothing)

All figures are **whole rupees** (integers) by construction — see [Display rounding](#display-rounding-round-first-then-add) below. `roundToRupee` is half-up on the absolute value. `billBalance(bill).total` is the **payable, net-of-paldari** figure the home bill cards already show; `billBalance(bill).outstanding` is `total − paid`.

### 1. bought (month)

```
boughtContribution(bill) = roundToRupee(billBalance(bill).total)      // net of paldari, NOT clamped
bought(monthKey)         = Σ boughtContribution(bill)
                           over bills where monthKeyOf(bill.purchaseDate) === monthKey
```

- Matched by the **bill's own `purchaseDate`**.
- **Net of paldari** — the same number the bill card shows, so the drill-down list visibly matches the cards.
- **Not clamped.** `billBalance.total` is deliberately unclamped upstream (a paldari larger than the line subtotal yields a negative payable); this figure mirrors the card exactly rather than inventing a second truth. Form validation keeps `paldari >= 0`, so this is pathological, not routine.

### 2. paid (month) — **note the asymmetry, it is deliberate**

```
paidContribution(bill, inPeriod) = roundToRupee( Σ p.amount
                                                 for p in bill.payments where inPeriod(p.date) )
paid(monthKey) = Σ paidContribution(bill, d => monthKeyOf(d) === monthKey)
                 over  ** ALL BILLS **
```

- Matched by **the payment's own `date`**, over **every bill in the ledger** — **regardless of which month (or which bill) the bill itself belongs to.**
- So a bill purchased in June whose payment is dated in July **counts in July's `paid` and does NOT count in July's `bought`**. That is correct and intended: `bought` is a purchasing figure, `paid` is a cash-out figure, and they are not two views of the same set of bills.
- Rounding is applied **once per bill** (to the bill's in-period payment sum), not per payment, so one bill is exactly one drill-down row with exactly one figure.

### 3. due — **ALL-TIME, deliberately not month-scoped, clamped per bill**

```
dueContribution(bill) = roundToRupee( max(0, billBalance(bill).outstanding) )   // CLAMP PER BILL
due                   = Σ dueContribution(bill)   over ** ALL BILLS **
```

- This is his **real outstanding exposure right now** — the question a trader actually asks — so scoping it to a calendar month would answer nothing. It sits in the "this month" strip because that is where he is looking, labelled **"Due (all)" / "कुल बकाया"** so the all-time scope is on screen.
- **The per-bill clamp at 0 is load-bearing.** `billBalance` returns a **negative** outstanding when a bill is overpaid (an advance — the detail screen already shows it as `advance-credit`). Without the clamp, an advance on one bill would silently **reduce reported exposure on unrelated bills** and under-report what he is actually owed. Displaying advances anywhere is **out of scope this phase**, but they must never distort this figure.

### 4. Today (close of day) — same definitions, scoped to `today`

```
billCount(today) = count of bills where bill.purchaseDate === today
bought(today)    = Σ boughtContribution(bill)  over bills where purchaseDate === today
paid(today)      = Σ paidContribution(bill, d => d === today)   over ** ALL BILLS **
pending(today)   = Σ dueContribution(bill)      over bills where purchaseDate === today
```

`paid(today)` carries the **same asymmetry** as `paid(month)` (payments matched by payment date, over all bills). `pending(today)` carries the **same per-bill clamp**. It is therefore perfectly legitimate for `paid(today)` to exceed `bought(today)` — he can settle old bills today. That is not a bug and must not be "fixed".

---

## Display rounding: round first, then add

He is a trader; **he will add the column by hand.** If the app's total disagrees with his by ₹1, the number is dead and so is every other number on the screen ([strategy §7.8](../../strategy/product-review-2026-07.md), and the same rule the money math already follows — [data.md § Rounding decision](../data.md#rounding-decision)).

- **Every aggregate is defined as the sum of its already-rounded per-bill contributions** — never `round(true sum)`. Because the aggregate is *defined* that way, the drill-down list provably adds up to the headline; it is an invariant of the arithmetic, not a coincidence of the UI.
- **Aggregate surfaces show whole rupees only.** Paise are meaningless at month scale and destroy the big-number readability the reader needs. Per-bill 2-dp figures stay exactly where they already are (bill card, bill detail, receipt) via the **unchanged** `formatRupees`.
- Consequence, documented and accepted: a bill's whole-rupee drill-down row may differ by up to ₹0.50 from the 2-dp figure on that same bill's card. There is **never** a mismatch *within* one screen, which is the invariant that matters.
- **`formatRupees` must NOT change.** It is `₹${amount.toFixed(2)}` with **no thousands separators**, and shipped E2E specs assert that literal (`₹7101.72`) and the receipt depends on it. The Indian-grouped formatter is a **separate, separately-named export in a separate file** — see [architecture.md § Phase-12 contract](../architecture.md#phase-12-pilot-readiness-contract-frozen).
- Indian grouping is **hand-rolled** (last 3 digits, then pairs), not `Intl.NumberFormat`, so it is deterministic in Vitest/jsdom and independent of ICU data on a low-end Android: `420000 → 4,20,000`, `12345678 → 1,23,45,678`.

## Drill-down contract (a trust requirement, not a convenience)

> He will not believe a total he cannot check ([strategy §10](../../strategy/product-review-2026-07.md)).

- Each of the **three month figures** is its own ≥48 px tap target → `/rollup?metric=<bought-month|paid-month|due-all>`.
- The **close-of-day line** is one tap target → `/rollup?metric=bought-today`.
- The **badge** taps → `/rollup?metric=unsynced`.
- `paid(today)` and `pending(today)` are **display-only** (no drill-down of their own). Justification: their drillable counterparts `paid-month` and `due-all` contain the same bills as strict supersets, so every figure on home is either itself drillable or fully contained in one that is. This keeps home to one route and no extra sub-navigation.
- On the drill-down screen: **`Σ (displayed row amounts) === (displayed headline amount)`, exactly.** Both are integers from the same computation, and both are exposed as a numeric `data-amount` attribute so a test asserts the invariant directly rather than parsing formatted text.
- Every row taps through to `/bill?id=<encoded id>`.

## Business Rules

- **Current calendar month**, not a rolling 30 days. Month membership is a **string compare on the ISO date prefix** (`iso.slice(0,7)`) — no `Date` objects, no timezone or DST hazard. Seasons / Rabi-Kharif / custom ranges are **Phase 13**.
- **Loading is not zero.** `useBills() === undefined` means "not loaded yet"; the strip and the day line render **skeleton bars** (matching the home list's existing skeleton), never a misleading `₹0`.
- **Never an empty screen.** A month or a day with no bills shows the labels with `₹0` **plus a warm one-line explanation** ("No bills this month yet — add one and these numbers fill up"), never a bare zero and never a blank.
- **The month strip never silently substitutes another period.** A strip labelled "This month" showing some other month's numbers would be actively misleading, so — deliberately diverging from strategy §10's "show the nearest period that has data" — this phase shows the real ₹0 with the warm line. Period switching belongs to Phase 13's report.
- **Bill count is shown next to money** on the day line and on every drill-down screen ("N bills") — the honesty signal from §5: a number he can trust beats a complete-looking number he can't.
- **The badge clears only at zero.** It renders whenever `count > 0` and disappears at `count === 0`; there is no dismiss control.
- **Badge anti-flicker:** a write is briefly pending on every save even when online, so the badge appears only once `count > 0` has held continuously for **1500 ms** (`UNSYNCED_BADGE_DELAY_MS`), and hides **immediately** on reaching 0. Without this the pilot trader sees a scary "not backed up" flash after every single save.
- **One source of truth for sync state.** `subscribeUnsyncedBills` is the primitive; the existing `subscribePendingWrites` is refactored to a thin derived wrapper (`count > 0`) so `SyncStatus.tsx`, `sync-pending-indicator`, `sync-online-indicator` and `sync-now-btn` keep their exact current behaviour and DOM. No second sync-state implementation.
- **Home ordering:** badge (only when > 0) → month strip → close-of-day line → the existing `SearchBar` → list heading → bill list. The bill list, `bill-list`, `bill-card` and `new-bill-btn` are otherwise untouched, and the new surfaces are **outside** the `bill-list` container (which doubles as the empty-state container).
- **Number density:** at most **three hero-sized figures** on home (the month strip). Today's four figures render as **one compact secondary line** (`3 bills · ₹7,689 bought · ₹6,742 paid · ₹1,201 pending`), exactly as strategy §9-P0.4 phrases it, so home reads as one hero block plus one supporting line. The badge is a status chip, not a figure.

## Testids (see [ui.md](../ui.md))
`month-strip`, `month-bought`, `month-paid`, `month-due`, `month-empty`; `today-card`, `today-count`, `today-bought`, `today-paid`, `today-pending`, `today-empty`; `unsynced-badge`; `rollup-screen`, `rollup-headline`, `rollup-count`, `rollup-row`, `rollup-row-amount`, `rollup-empty`. Every money figure carries a numeric **`data-amount`** (whole rupees) and every count a numeric **`data-count`**, so assertions never depend on grouping or language.

## Success Criteria

- [ ] `bought(month)` = Σ `roundToRupee(billBalance(bill).total)` over bills whose `purchaseDate` is in the current calendar month — matching [data.md Example 7](../data.md#phase-12-derived-aggregates-no-schema-change) exactly (**₹14,591** on the canonical fixture, **not** ₹14,590 — proving round-then-sum).
- [ ] `paid(month)` = **₹11,742** on the canonical fixture, which **includes** a **June** bill's **July** payment and **excludes** a **July** bill's **August** payment — proving the payment-date-over-all-bills asymmetry in both directions.
- [ ] `due` (all-time, clamped) = **₹17,603** on the canonical fixture; dropping the per-bill clamp yields **₹17,349**, so the clamp is asserted by value, not by inspection.
- [ ] `dayRollup(today)` on the canonical fixture = `{ billCount: 3, bought: 7689, paid: 6742, pending: 1201 }`, with `paid > bought` accepted as legitimate.
- [ ] Month membership is decided on the ISO prefix; bills on the **first and last day** of the month are included and bills one day either side are excluded (unit-tested at a month boundary and across a year boundary, e.g. `2025-12-31` vs `2026-01-01`).
- [ ] For every money metric, `Σ rollupContributions(...).amount === ` the corresponding rollup figure (unit-tested invariant), and `rollupContributions(..., 'bought-month').length === monthRollup.billCount`.
- [ ] `formatRupeesIndian(420000) === '₹4,20,000'`; `formatRupeesIndian(0) === '₹0'`; `formatRupeesIndian(999) === '₹999'`; `formatRupeesIndian(1000) === '₹1,000'`; `formatRupeesIndian(12345678) === '₹1,23,45,678'`; `roundToRupee(1200.55) === 1201`; `roundToRupee(4000.30) === 4000`.
- [ ] `formatRupees` is byte-for-byte unchanged and `frontend/src/components/format.ts` is not modified at all.
- [ ] Home shows skeletons (never `₹0`) while `useBills()` is `undefined`, and a warm `month-empty` / `today-empty` line when a period genuinely has no bills.
- [ ] Tapping `month-bought` opens `/rollup`, whose `rollup-headline` `data-amount` equals the strip's `data-amount`, and the sum of all `rollup-row-amount` `data-amount` values equals the headline exactly.
- [ ] With the browser offline, saving a bill makes `unsynced-badge` appear (`data-count >= 1`) within the anti-flicker delay; tapping it lists that bill; going back online clears it.
- [ ] `subscribePendingWrites` still drives `SyncStatus` unchanged (`sync-pending-indicator` toggles as before) while being derived from `subscribeUnsyncedBills`.
- [ ] Every new EN key has an HI counterpart (`Record<TKey,string>` — a missing HI key fails `pnpm build`).
- [ ] All of the above works with the phone offline.

## Explicitly OUT OF SCOPE (do not build — a generator must not gold-plate this)
- **No charts, no graphs, no sparklines** of any kind.
- **No season / Rabi-Kharif / custom-range / full-year selector**, no period pills, no "compare to last month" — **Phase 13**.
- **No farmer khata**, no per-farmer totals, no rate trend, no quintals-by-grain, no average ₹/quintal — **Phase 13**.
- **No advances display** anywhere (the overpaid case is *clamped out* of `due`, not shown).
- **No lakh/crore shorthand** (`₹8.4L`) — full grouped figures only, because an abbreviated number cannot be checked by hand.
- **No shareable month-summary image**, no PDF, no CSV, no export.
- **No push / notification / weekly nudge.**
- **No schema change, no new Firestore collection, no new index, no `firestore.rules` change.**
- **No change to `formatRupees`, `lib/calc/index.ts`, `BillFilter`, `searchBills`, the bill card, the bill detail, or the receipt.**
- **No "mark period complete" flag** (a §5 idea deliberately answered here by the visible bill count instead).
- **No field-cutting for entry speed.** Timing a real bill end-to-end is measured manually by the product owner after this build; do not remove or reorder entry fields for it.
