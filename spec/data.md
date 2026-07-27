# Data Model — Anaj Bahi

> The heart of the app. The TypeScript shapes and repository signatures are frozen in [architecture.md § Phase-1 module contract](architecture.md#phase-1-module-contract-slice-a). This file specifies the entities, the Dexie/IndexedDB schema, the bill-id rule, and the **exact calculation rules with worked numeric examples and rounding decisions**.

---

## Storage Technology

**Phases 1–5: IndexedDB via Dexie 4**, on the phone — a single-user store on one device, no auth/tenant scoping, reactive reads via `dexie-react-hooks` `useLiveQuery`. (The Phase-4 FastAPI + SQLite backup backend is **superseded** — see [architecture.md § Phase-4 sync contract](architecture.md#phase-4-sync-contract).)

**Phases 6–9: Cloud Firestore** becomes the store — accessed **directly from the client**, with **IndexedDB offline persistence as the local cache/source-of-truth-on-device**, and data **scoped per business** (multi-tenant, multi-user shared ledger). Firebase Auth (**Google sign-in**) provides identity (the Firebase `uid`). The **entities, calc rules, and worked examples below are unchanged** — the same `Bill`/`Farmer`/`GrainType`/`Payment` shapes are stored as Firestore documents instead of Dexie rows. What is added is the **tenancy layer** (users, businesses, invites, members, activity) and **per-action attribution snapshots**. See [§ Firebase multi-tenant data model](#firebase-multi-tenant-data-model-phases-69) below and the frozen [architecture.md § Firebase multi-tenant redesign](architecture.md#firebase-multi-tenant-redesign-phases-69--frozen-contracts).

## Entities

### Entity: Farmer

Reusable seller record, saved once and referenced by bills. Powers autocomplete and search by name/place.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (uuid) | yes | Primary key |
| name | string | yes | Farmer name (as the trader writes it) |
| place | string | yes | Village / place |
| phone | string | no | Optional phone |
| createdAt | number (epoch ms) | yes | Creation time |

### Entity: GrainType

A grain kind with bilingual names. Seeded starter list + user-added custom types.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | yes | Primary key (slug for seeds, uuid for custom) |
| nameEn | string | yes | English name |
| nameHi | string | yes | Hindi (Devanagari) name |
| isCustom | 0 \| 1 | yes | 1 for user-added, 0 for seeded |
| createdAt | number | yes | Creation time |

**Seed list (idempotent, on first run):**

| id | nameEn | nameHi |
|----|--------|--------|
| wheat | Wheat | गेहूँ |
| paddy | Paddy / Rice | धान |
| mustard | Mustard | सरसों |
| gram | Gram / Chana | चना |
| soybean | Soybean | सोयाबीन |
| maize | Maize | मक्का |
| bajra | Bajra / Pearl millet | बाजरा |

### Entity: Bill (Purchase Entry)

Belongs to one farmer; a purchase date; 1..N grain lines. Farmer name/place and grain-type ids are **denormalised** onto the bill so search never needs a join.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | yes | `DDMMYY/xxxxx` (see rule below) — primary key |
| farmerId | string | yes | FK → Farmer.id |
| farmerName | string | yes | Denormalised at save (search by name) |
| farmerPlace | string | yes | Denormalised at save (search by place) |
| purchaseDate | string | yes | ISO `yyyy-mm-dd` |
| grainTypeIds | string[] | yes | Denormalised list of the line grain-type ids (multiEntry index; search by grain) |
| lines | StoredGrainLine[] | yes | Embedded, ordered; ≥1 |
| dueDate | string | no | ISO `yyyy-mm-dd` — **Phase 2** |
| payments | Payment[] | yes | Embedded; **empty `[]` in Phase 1** (Phase 2 populates) |
| entryMode | `'sacks' \| 'summary'` | no | **Phase 5** — how the bill was captured. **Absent → `'sacks'`** (back-compat). See [Summary grain lines](#summary-grain-lines-quick-entry). |
| paldari | number | no | **Phase 10** — bill-level labor (loading/unloading) charge in ₹ borne by the farmer; subtracted from the bill total. Absent → 0. See [Paldari](#paldari-labor-charge--phase-10). |
| createdAt | number | yes | Creation time |
| updatedAt | number | yes | Last edit time |

### Embedded: GrainLineItem (`StoredGrainLine`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (uuid) | yes | Line id (stable for editing) |
| grainTypeId | string | yes | FK → GrainType.id |
| pricePerQuintal | number | yes | ₹ per 100 kg (rate; **not** used to compute a summary line's amount) |
| sackWeights | number[] | yes | Individual sack weights (kg), **in entry order**; may be decimal. **Summary lines: `[]`.** |
| deductions | StoredDeduction[] | yes | Zero or more; applied additively. **Summary lines: `[]`.** |
| summary | GrainLineSummary | no | **Phase 5** — present iff the bill is `entryMode: 'summary'`; the per-line discriminant. See below. |

### Summary grain lines (quick-entry)  — **Phase 5**

A **summary** grain line transcribes a paper bill: it stores the entered figures directly and carries **no per-sack weights and no multi-basis deductions**. Its authoritative money `amount` is entered verbatim and **never recomputed**.

**Embedded: `GrainLineSummary`** (present only on summary lines):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| totalWeightKg | number | yes | Gross weight (kg), entered as ONE number (not per sack); > 0 |
| sackCount | number (int) | no | Count of sacks only; no per-sack weights |
| deductionKg | number | no | Single total-kg deduction (NOT the multi-basis editor) |
| amount | number (₹) | yes | Money amount taken verbatim from the paper bill — **authoritative, never recomputed**; > 0 |

**Representation decision:** the discriminator is the bill-level `entryMode` plus the presence of `summary` on the line. Summary lines keep `sackWeights: []` and `deductions: []` (empty, never read) rather than omitting them, so `StoredGrainLine`'s existing (required) fields stay non-optional and **every existing reader/serializer keeps working unchanged**. The alternative — a discriminated union that omits the arrays — was rejected because it would force `sackWeights`/`deductions` optional and add guard-rails across every existing consumer (detail, receipt, sync), increasing churn and risk to the proven sacks path. A `'sacks'` line's stored shape is **byte-for-byte identical to before** (no `summary` key).

**Back-compat read rule:** always read the mode as `bill.entryMode ?? 'sacks'`. Bills created before Phase 5 (no `entryMode`, no `summary`) read as `'sacks'` and render/total exactly as today.

### Embedded: SackWeight

Not a separate table — an ordered `number` in `StoredGrainLine.sackWeights` (kg). Order is preserved (entry order) so the receipt shows sacks exactly as entered.

### Embedded: Deduction (`StoredDeduction`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| basis | `'per_sack_kg' \| 'per_quintal_kg' \| 'percent_gross' \| 'flat_kg'` | yes | How `value` is interpreted |
| value | number | yes | Amount per the basis (see resolution table) |

### Embedded: Payment — **Phase 2** (modelled now, built later)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (uuid) | yes | Payment id |
| amount | number | yes | ₹ paid |
| date | string | yes | ISO `yyyy-mm-dd` |
| note | string | no | Optional note |
| createdAt | number | yes | Record time |

### Relationships

- Farmer **1 — N** Bill (`Bill.farmerId`).
- Bill **1 — N** GrainLineItem (embedded array).
- GrainLineItem **1 — N** SackWeight (embedded `number[]`) and **1 — N** Deduction (embedded array).
- GrainType **1 — N** GrainLineItem (`grainTypeId`).
- Bill **1 — N** Payment (embedded; Phase 2).

## Dexie / IndexedDB Schema

```ts
// lib/db/schema.ts
db.version(1).stores({
  farmers:    '&id, name, place, phone, createdAt',
  grainTypes: '&id, isCustom, createdAt',
  bills:      '&id, farmerId, purchaseDate, farmerName, farmerPlace, *grainTypeIds, createdAt',
  meta:       '&key',   // settings: language pref is in localStorage; meta holds the business profile (Phase 3) and sync config {baseUrl, token} + lastSyncedAt (Phase 4)
})
```

- `&id` = unique primary key.
- **Search indexes (Phase 2 `search-filters` uses them; created now so no migration is needed):**
  - by **date**: `purchaseDate` (range/equality).
  - by **farmer name**: `farmerName` (`startsWithIgnoreCase` prefix search; also used by farmer autocomplete on `farmers.name`).
  - by **place**: `farmerPlace` (`startsWithIgnoreCase`).
  - by **grain type**: `*grainTypeIds` (multiEntry — a bill matches if any line uses that grain).
- Payments/dueDate are embedded on the bill (no separate table) — fine for a single-user local store; Phase 2 reads them by loading the bill.
- **Phase 5 (`entryMode` + line `summary`) needs no schema/version bump:** neither field is indexed (grain search still uses the existing `*grainTypeIds`), and Dexie stores whatever object is `put`, so the new optional fields ride along with no migration. `createBill`/`updateBill` are unchanged — only the `Bill`/`StoredGrainLine` TypeScript interfaces gain the optional fields.
- **Phase 10 (`paldari`) needs no schema/version bump either:** `paldari` is an unindexed optional bill-level number that rides along on the stored object exactly like `entryMode` did — no Dexie/Firestore migration, `createBill`/`updateBill` unchanged, only the `Bill` interface gains the optional field. Omitted (never stored as `0`/`undefined`) when blank or zero.

## Bill-ID Generation Rule

Format: **`DDMMYY/xxxxx`**
- `DDMMYY` — zero-padded day/month/2-digit-year of `purchaseDate` (e.g. 6 July 2026 → `060726`).
- `/` separator.
- `xxxxx` — **5 characters** drawn from `[a-z0-9]` (36-symbol alphabet, ~60M combinations) using `crypto.getRandomValues` (not `Math.random`).
- On collision with an existing bill id, regenerate the random suffix and retry.
- Example: `060726/ghvg7`.

> **Assumed:** the 5-char code is **lowercase** `[a-z0-9]`. The brief's example `ghvg` is 4 chars; the spec fixes the length at **5** for a wider space while staying short. Because the id contains `/`, the detail route reads it from a **URL-encoded `?id=` query param** (`/bill?id=060726%2Fghvg7`) rather than a path segment — this also sidesteps Next.js static-export dynamic-route constraints.

## Exact Calculation Rules

All math lives in the pure `lib/calc` module (see contract). Units: weights in **kg**; **1 quintal = 100 kg**; price is **₹ per quintal**; currency ₹ INR.

### Deduction resolution (`resolveDeductionKg`)

For a grain line with `gross` = sum of sack weights (kg) and `sackCount` = number of sacks:

| basis | meaning of `value` | resolved kg |
|-------|--------------------|-------------|
| `per_sack_kg` | kg deducted **per sack** | `value × sackCount` |
| `per_quintal_kg` | kg deducted **per quintal of gross** | `value × (gross / 100)` |
| `percent_gross` | **percent** of gross weight | `(value / 100) × gross` |
| `flat_kg` | flat kg deducted **once** | `value` |

Multiple deductions on one line are **additive**: `deductionKg = Σ resolveDeductionKg(d)` over all deductions.

### Line and bill totals

```
grossWeightKg = Σ sackWeights
deductionKg   = Σ resolveDeductionKg(deduction, grossWeightKg, sackCount)
netWeightKg   = max(0, grossWeightKg − deductionKg)          // clamp: net never negative
netQuintals   = netWeightKg / 100
amount        = roundRupees(netQuintals × pricePerQuintal)    // ₹, 2 decimal places
billTotal     = Σ (each line's rounded amount)                // 2 decimal places
```

### Rounding decision

- **`roundRupees` rounds half-up to 2 decimal places (paise).** Grain trade routinely involves paise on per-quintal pricing, and 2-dp keeps line amounts and the bill total reconcilable. Weights are **not** rounded (kept as entered, e.g. `40.5`); only the final ₹ amount per line is rounded, then the bill total is the sum of the already-rounded line amounts (so the printed total always equals the sum of the printed line amounts — no penny drift).
- Half-up example: `3741.715 → 3741.72`; `3741.714 → 3741.71`.

> **Assumed:** rounding is applied **per line** (not once on the grand total). This guarantees the receipt's line amounts visibly sum to the printed total. A future "round grand total to nearest ₹" is a display-only option deferred to the Phase-3 receipt; Phase-1 storage/display is 2-dp throughout.

### Worked examples (must match unit tests)

**Example 1 — single line, two deductions (the Phase-1 handoff example):**
- Wheat, price ₹2400/quintal. Sacks `[40, 40, 40.5, 39]` → `sackCount = 4`, `gross = 159.5 kg`.
- Deductions: `per_sack_kg 0.5` → `0.5 × 4 = 2 kg`; `percent_gross 1` → `0.01 × 159.5 = 1.595 kg`. `deductionKg = 3.595 kg`.
- `net = 159.5 − 3.595 = 155.905 kg` → `netQuintals = 1.55905`.
- `amount = roundRupees(1.55905 × 2400) = roundRupees(3741.72) = ₹3741.72`.

**Example 2 — per-quintal-kg + flat-kg deductions:**
- Paddy, price ₹1900/quintal. Sacks `[50, 50, 48]` → `sackCount = 3`, `gross = 148 kg`.
- Deductions: `per_quintal_kg 1` → `1 × (148/100) = 1.48 kg`; `flat_kg 2` → `2 kg`. `deductionKg = 3.48 kg`.
- `net = 148 − 3.48 = 144.52 kg` → `netQuintals = 1.4452`.
- `amount = roundRupees(1.4452 × 1900) = roundRupees(2745.88) = ₹2745.88`.

**Example 3 — multi-line bill total:**
- Line A (Example 1) = ₹3741.72. Line B: Mustard ₹5600/quintal, sacks `[30, 30]` → gross 60 kg, no deductions → net 60 kg → 0.6 quintal → `roundRupees(0.6 × 5600) = ₹3360.00`.
- `billTotal = 3741.72 + 3360.00 = ₹7101.72`.

**Example 4 — clamp guard:** if deductions exceed gross (misconfiguration), `netWeightKg = max(0, …) = 0` and `amount = ₹0.00` (never negative). Unit-tested.

### Summary-line calc (quick-entry)  — **Phase 5**

For a **summary** grain line the engine does **not** sum sacks and does **not** recompute the amount:

```
grossWeightKg = summary.totalWeightKg
deductionKg   = summary.deductionKg ?? 0
netWeightKg   = max(0, grossWeightKg − deductionKg)
sackCount     = summary.sackCount ?? 0
amount        = roundRupees(summary.amount)        // ENTERED verbatim — NOT netQuintals × price
billTotal     = Σ (each line's amount)             // summary lines contribute their entered amount
```

`computeGrainLine` **dispatches** on `line.summary`: present → the summary rule above; absent → the unchanged sacks rule. `computeBillTotal` is unchanged (Σ `computeGrainLine(line).amount`) and is therefore summary-aware transitively. The sacks path only runs when `summary` is absent, so **sacks bills are provably unaffected**. `pricePerQuintal` is still stored and shown as the rate, but a summary line's amount ignores it.

**Example 5 — summary line (amount authoritative):** Wheat, price ₹2400/quintal, `totalWeightKg 159.5`, `deductionKg 3.595`, `sackCount 4`, entered `amount 3741.72`. → gross 159.5, deduction 3.595, net 155.905, sackCount 4, **amount ₹3741.72 (returned as entered, not derived)**. A deliberately mismatched entered amount (e.g. `amount 3700` on the same figures) is still returned as **₹3700.00** — the entered value wins. Unit-tested.

### Paldari (labor charge)  — **Phase 10**

**Paldari** is a single **bill-level** loading/unloading labor charge in ₹, borne by the farmer. When the farmer bears it the merchant enters a rupee amount and it is **subtracted from the bill total** (so outstanding/due drop by that amount); when the merchant bears it the field is left blank. It is **NOT** per grain line and **NOT** a kg deduction — it is one bill-level rupee figure that applies to **both** entry modes (`sacks` and `summary`).

```
linesTotal        = computeBillTotal(lines)          // Σ line amounts, gross-of-paldari (unchanged)
paldari           = roundRupees(bill.paldari ?? 0)   // absent → 0
payableBillTotal  = roundRupees(linesTotal − paldari) // NOT clamped; validation keeps paldari ≥ 0
outstanding       = roundRupees(payableBillTotal − paid)
```

`billBalance` is the single chokepoint: it now returns `{ linesTotal, paldari, total, paid, outstanding, fullyPaid }` where `total` is the payable (net-of-paldari) figure. Everything downstream — the due list (`queries.ts`), the due page, the bill detail total, the home card, and the receipt total — reads through `billBalance` (or mirrors its net formula) and is therefore automatically net-of-paldari. `computeBillTotal(lines)` is **unchanged** (still "sum of line amounts") — many call-sites depend on that meaning.

**Example 6 — paldari subtracted:** a bill whose lines total **₹7101.72** (Example 3) with `paldari 200` → **payable ₹6901.72**; a ₹1000 payment leaves outstanding **₹5901.72**. Absent paldari → payable === linesTotal (existing bills unchanged). Unit-tested.

## Phase-12 derived aggregates (NO schema change)

> **Nothing is added to any entity in this phase.** No new field, no new collection, no new index, no new `ActivityType`, no Dexie/Firestore migration, and **no new Firestore read** — every figure below is derived on the device from the bills the home screen has already loaded (the live `useBills()` snapshot), so it all works offline. `Bill.dueDate` already exists as an optional ISO string; Phase 12 only makes the **entry forms** always populate it (see [entry-defaults](capabilities/entry-defaults.md)). Product rationale and the drill-down contract are in [home-rollups](capabilities/home-rollups.md); the frozen signatures are in [architecture.md § Phase-12 contract](architecture.md#phase-12-pilot-readiness-contract-frozen).

### Display rounding for aggregates — round first, then add

The Phase-1 [Rounding decision](#rounding-decision) says: line amounts are rounded, and the bill total is the sum of the **already-rounded** lines, so the printed total always equals the printed lines. Phase 12 applies the **same discipline one level up**:

- `roundToRupee(x)` = half-up to a **whole rupee**, on the absolute value (`1200.55 → 1201`, `4000.30 → 4000`, `−258.28 → −258`).
- **Every aggregate is DEFINED as `Σ` of its already-rounded per-bill contributions** — never `roundToRupee(true sum)`. The drill-down list therefore adds up to the headline as an invariant of the arithmetic, not a coincidence of the UI.
- **Aggregate surfaces are whole-rupee only** (paise are noise at month scale and kill big-number readability). Per-bill surfaces — bill card, bill detail, receipt — keep the **unchanged** 2-dp `formatRupees`. A bill's whole-rupee drill-down row may therefore differ by ≤ ₹0.50 from the 2-dp figure on that bill's own card; there is **never** a mismatch *within* one screen, which is the invariant that matters.
- Rationale: he adds the column by hand. A ₹1 disagreement kills not just that number but every number on the screen.

### The three definitions

Notation: `total(b) = billBalance(b).total` (payable, **net of paldari**, not clamped); `outstanding(b) = billBalance(b).outstanding`; `inMonth(iso, m) = iso.slice(0,7) === m` (pure ISO string prefix compare — no `Date`, no timezone/DST hazard).

```
bought(m)   = Σ roundToRupee(total(b))                       over b where inMonth(b.purchaseDate, m)
paid(m)     = Σ roundToRupee(Σ p.amount for p in b.payments  // matched by the PAYMENT's own date,
                             where inMonth(p.date, m))       //   over ** ALL BILLS **
due         = Σ roundToRupee(max(0, outstanding(b)))         over ** ALL BILLS **  — ALL-TIME, CLAMPED PER BILL

billCount(d) = count of b where b.purchaseDate === d
bought(d)    = Σ roundToRupee(total(b))                      over b where b.purchaseDate === d
paid(d)      = Σ roundToRupee(Σ p.amount where p.date === d) over ** ALL BILLS **
pending(d)   = Σ roundToRupee(max(0, outstanding(b)))        over b where b.purchaseDate === d
```

Two properties that a generator must not "tidy up":

1. **The bought/paid asymmetry is intended.** `bought` selects **bills** by the bill's `purchaseDate`; `paid` selects **payments** by the payment's own `date` across **every** bill. So a June bill paid in July counts in July's `paid` and **not** in July's `bought`. They are a purchasing figure and a cash-out figure, not two views of one set.
2. **The `due`/`pending` clamp is PER BILL.** `billBalance` returns a **negative** `outstanding` when a bill is overpaid (an advance — the detail screen already shows it as `advance-credit`). Clamping each bill at 0 before summing stops an advance on one bill from silently reducing reported exposure on unrelated bills. Displaying advances is out of scope in Phase 12, but they must not distort this figure.

### Canonical fixture (unit tests assert these exact numbers)

`today = 2026-07-26`, `monthKey = 2026-07`. All money in ₹.

| Bill | purchaseDate | linesTotal | paldari | `total` | payments (amount @ date) | `outstanding` |
|------|--------------|-----------:|--------:|--------:|--------------------------|--------------:|
| A | 2026-06-28 (**last month**) | 10000.40 | — | 10000.40 | 4000.30 @ 2026-07-02 (**this month**) | 6000.10 |
| B | 2026-07-01 | 7101.72 | 200 | 6901.72 | 1000.00 @ 2026-07-01; **500.00 @ 2026-08-03 (next month)** | 5401.72 |
| C | 2026-07-26 (**today**) | 3741.72 | — | 3741.72 | 3741.72 @ 2026-07-26 | 0.00 |
| D | 2026-07-26 (**today**) | 2745.88 | — | 2745.88 | **3000.00 @ 2026-07-26 (overpaid)** | **−254.12** |
| E | 2026-08-02 (**next month**) | 5000.00 | — | 5000.00 | — | 5000.00 |
| F | 2026-07-26 (**today**) | 1200.55 | — | 1200.55 | — | 1200.55 |

**Example 7 — `bought(2026-07)` and why round-then-add matters.** In-month bills are B, C, D, F:
`6902 + 3742 + 2746 + 1201 = ` **₹14,591**, and `billCount = 4`.
The true unrounded sum is `6901.72 + 3741.72 + 2745.88 + 1200.55 = 14589.87`, so `roundToRupee(true sum) = 14590` — **₹1 lower**. The spec figure is **14591**; a unit test asserts both numbers so the round-then-add rule cannot silently regress. Bill A (June) and E (August) are excluded.

**Example 8 — `paid(2026-07)` and the asymmetry, in both directions.** Over **all** bills, payments dated in July:
`A 4000 (4000.30) + B 1000 + C 3742 + D 3000 = ` **₹11,742**.
- **A contributes** although A is a **June** bill — its payment is dated July (and A does **not** appear in `bought(2026-07)`).
- **B's 500.00 is excluded** although B is a **July** bill — that payment is dated **August**.
- E and F have no payments and contribute nothing.

**Example 9 — `due` (all-time) and the per-bill clamp.** Over all bills, each clamped at 0:
`A 6000 + B 5402 + C 0 + D 0 (max(0, −254.12)) + E 5000 + F 1201 = ` **₹17,603**.
Without the per-bill clamp, D would contribute `−254` and the figure would read **₹17,349** — a **₹254 understatement of real exposure**. Both values are asserted so the clamp is proven by value, not by inspection. The drill-down for this metric has **4 rows** (A, B, E, F); C and D are zero contributors and are excluded.

**Example 10 — the day rollup for 2026-07-26.** Bills dated today are C, D, F:
`billCount = 3`; `bought = 3742 + 2746 + 1201 = ` **₹7,689**; `paid = 3742 (C) + 3000 (D) = ` **₹6,742**; `pending = 0 + 0 + 1201 = ` **₹1,201**.
`paid` here (6742) includes D's **overpayment** of 3000 against a 2745.88 bill, and on another day `paid` may legitimately **exceed** `bought` entirely (settling old bills). Neither is a bug and neither must be "corrected" by capping a payment or by netting advances.

**Example 11 — month and year boundaries.** With `monthKey = 2026-07`: `2026-06-30` excluded, `2026-07-01` included, `2026-07-31` included, `2026-08-01` excluded. With `monthKey = 2025-12`: `2025-12-31` included, `2026-01-01` excluded. Membership is a string prefix compare, so no timezone or DST case exists.

### Due buckets — the additive fourth group

`listDueBills` gains `noDueDate` = bills with **no `dueDate`** and `outstanding > 0`, sorted `purchaseDate` ascending (oldest first; ties by `createdAt` ascending). The three existing buckets (`overdue` / `dueSoon` / `upcoming`) keep their exact membership rules, contents and ordering. This group exists **only** for pre-Phase-12 rows — from Phase 12 on, both entry forms require a due date, so nothing can create a new undated bill. Repairing one uses `setBillDueDate`, which writes only `dueDate` + `updatedAt` and is deliberately **not** gated by the edit-lock (a due date changes no money figure — `billBalance` never reads it). See [entry-defaults](capabilities/entry-defaults.md).

## Data Lifecycle

- **Create:** farmer on first use; grain seeds on first app run (idempotent); bill on Save.
- **Update:** a bill is **fully editable in Phase 1** (no payments exist yet). **Phase 2 edit-lock rule:** once `payments.length > 0`, the bill's purchase data locks; only new payments may be added. `updatedAt` set on every write. **Phase 12 — one narrow, deliberate exception:** `setBillDueDate` may set a bill's **`dueDate`** (and `updatedAt`) even on a locked bill, because the lock protects **purchase figures** after money has moved and `billBalance` never reads `dueDate` — so it can change no total, no payment and no outstanding. It exists so a pre-Phase-12 bill with a payment and no due date cannot keep its outstanding money hidden. Every other purchase-data edit stays locked, and this is the **only** lock exception.
- **Delete:** not offered in Phase 1 (avoids accidental data loss on the tested path); a guarded delete may come later.
- **Retention:** nothing is time-boxed or archived; the ledger is permanent local history (Phase 4 adds cloud backup).

## Sensitive Data

- Farmer name/place/phone are mildly personal but low-risk; stored locally only in Phase 1.
- The app has **no access gate / PIN** — it opens straight to the bill list.
- Phase 4 adds a device token for sync; documented in `backend/.env.example`, never committed.

## Compatibility Note

- The app previously shipped a 4-digit PIN gate that stored a `pinHash` key in the `meta` table. That feature has been removed. Existing installs may carry an **orphaned `pinHash` meta row**, which is now simply **ignored** — no migration or cleanup is required, and no schema version bump is needed (the `meta` table itself is unchanged).

---

## Firebase multi-tenant data model (Phases 6–9)

> The **frozen collection-path map, field lists, and access rules** live in [architecture.md § Firestore data model](architecture.md#firestore-data-model--frozen-collection-path-map) (one fact, one place). This section describes the entities in product terms and how the existing bill/farmer/grain entities move into the tenant scope.

### New tenancy entities

| Entity | Where it lives | What it is |
|--------|----------------|------------|
| **User** | `users/{uid}` | One signed-in person. Identity = the Firebase **`uid`** (stable per **Google** account, cross-device); carries their **email**, **display name**, **mobile** (`phone`, set at onboarding — profile data, not an auth factor), single `bizId`, and `role` (**`owner` \| `partner` \| `employee`**). A brand-new account has `bizId: null` until onboarding completes. |
| **Business (tenant)** | `businesses/{bizId}` | An independent shop/trader. Holds the **business profile** (shop/trader/phone/address) and owns all the ledger sub-collections. Created self-serve by whoever chooses **New business** (they become the **owner**). |
| **Invite** | `invites/{code}` (one-time code) + `businesses/{bizId}/members/{uid}` (per-business roster) | A **manager-generated invite** (an owner **or a partner** mints it) keyed by a one-time 6-char code (ambiguity-safe, no `O/0/I/1`): `{ bizId, role:'employee'\|'partner', assignedPhone, phoneKey, displayName label, addedBy*, status:'unused'\|'claimed', claimedByUid, createdAt, claimedAt }`. The manager shares **code + mobile** out-of-band; the invited person redeems it at first run (enter code → mobile matches `phoneKey` → name), which writes their `members/{uid}` roster doc with the **invite's `role`**. **No phone-keyed lookup at sign-in** — returning users are recognized purely by `users/{uid}.bizId`. |
| **Activity entry** | `businesses/{bizId}/activity/{id}` | Append-only audit record of **bill-create / payment / edit / delete**, each with an **actor snapshot** (uid + phone + name-at-the-time) and timestamp. **Manager-only read** (owner or partner). |

- **Roles (`owner` \| `partner` \| `employee`):**
  - `employee` may create bills (sack + quick), record payments, edit/delete bills (respecting the edit-lock), and manage farmers & custom grain types. Employees cannot see the Members roster or the activity log, and see the business profile read-only.
  - `partner` (co-owner) has **owner powers minus removing an owner and minus editing the business profile**: CAN add members (employees **and** partners) by generating invite codes, read **all** activity, and remove **employees and other partners**; CANNOT remove/downgrade an **owner** or edit the **business profile**. A partner exists **only** because an owner/partner invited them as Partner — there is no self-serve partner onboarding.
  - `owner` additionally **edits the business profile** (owner-only), and can remove partners (and employees). Multiple owners per business are allowed; owners are **not removable** through the roster (owner-to-owner removal is out of scope).
- **Where roles are shown:** the Owner/Partner/Employee tag is surfaced **only** in the Members roster (managers-only screen); the Settings identity strip and personal profile show **no role badge** for anyone.
- **One person → one business:** enforced by the Firebase **`uid`** — once `users/{uid}.bizId` is set, sign-in routes the user straight into the app and they never re-enter onboarding, so they can never create or join a second business (see [architecture § one-person-one-business](architecture.md#firestore-data-model--frozen-collection-path-map)).
- **Name snapshots:** `displayName`/`createdByName`/`actorName`/`addedByName` are copied at write time, never a live join — attribution survives renames and removal.

### The existing ledger entities, now business-scoped

The **Farmer, GrainType, Bill (with embedded lines/deductions/payments), and all calc rules above are unchanged**. They simply move from Dexie tables to Firestore sub-collections under the business:

| Was (Dexie, Phases 1–5) | Now (Firestore, Phase 7+) |
|-------------------------|---------------------------|
| `farmers` table | `businesses/{bizId}/farmers/{farmerId}` |
| `grainTypes` table | `businesses/{bizId}/grainTypes/{grainTypeId}` |
| `bills` table | `businesses/{bizId}/bills/{billId}` (id still `DDMMYY/xxxxx`) |
| `meta.businessProfile` row | fields on `businesses/{bizId}` |

- **Attribution field (Phase 8):** `Bill` and each `Payment` gain an **optional** `createdBy: { uid, phone, name }` snapshot. It is **optional/back-compat** — bills migrated from the local store (or created before Phase 8) simply have no `createdBy`, read as "unknown actor", and are otherwise identical. No breaking change to the frozen `Bill` shape.
- **One-time migration (Phase 7):** on the first **owner** sign-in, the legacy Dexie `bills`/`farmers`/`grainTypes` are uploaded into the new business scope, guarded by a `users/{uid}.migratedAt` flag (runs **once, idempotently**; the local Dexie DB is kept read-only as the source, never wiped destructively).

### Storage & offline

Firestore's **IndexedDB offline persistence is the on-device store**: offline writes save + queue in the local cache and auto-sync on reconnect; reads are live (`onSnapshot`) and merge across devices last-write-wins per document. There is **no separate outbox** — the retired `lib/sync/*` outbox and the FastAPI backend are removed (Phase 7).
