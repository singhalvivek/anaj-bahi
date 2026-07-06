# Data Model — Anaj Bahi

> The heart of the app. The TypeScript shapes and repository signatures are frozen in [architecture.md § Phase-1 module contract](architecture.md#phase-1-module-contract-slice-a). This file specifies the entities, the Dexie/IndexedDB schema, the bill-id rule, and the **exact calculation rules with worked numeric examples and rounding decisions**.

---

## Storage Technology

**IndexedDB via Dexie 4**, on the phone. No server database on the device. A single-user app on one device — no auth/tenant scoping. Reactive reads use `dexie-react-hooks` `useLiveQuery`. Phase 4 adds an optional **FastAPI + SQLite** backend as backup/restore (schema-light JSON-row storage — see [architecture.md § Phase-4 sync contract](architecture.md#phase-4-sync-contract)); the local IndexedDB store always remains the device source of truth.

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
| createdAt | number | yes | Creation time |
| updatedAt | number | yes | Last edit time |

### Embedded: GrainLineItem (`StoredGrainLine`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (uuid) | yes | Line id (stable for editing) |
| grainTypeId | string | yes | FK → GrainType.id |
| pricePerQuintal | number | yes | ₹ per 100 kg |
| sackWeights | number[] | yes | Individual sack weights (kg), **in entry order**; may be decimal |
| deductions | StoredDeduction[] | yes | Zero or more; applied additively |

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
  meta:       '&key',   // settings: language pref is in localStorage; meta holds PIN hash (Phase 2), business profile (Phase 3), and sync config {baseUrl, token} + lastSyncedAt (Phase 4)
})
```

- `&id` = unique primary key.
- **Search indexes (Phase 2 `search-filters` uses them; created now so no migration is needed):**
  - by **date**: `purchaseDate` (range/equality).
  - by **farmer name**: `farmerName` (`startsWithIgnoreCase` prefix search; also used by farmer autocomplete on `farmers.name`).
  - by **place**: `farmerPlace` (`startsWithIgnoreCase`).
  - by **grain type**: `*grainTypeIds` (multiEntry — a bill matches if any line uses that grain).
- Payments/dueDate are embedded on the bill (no separate table) — fine for a single-user local store; Phase 2 reads them by loading the bill.

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

## Data Lifecycle

- **Create:** farmer on first use; grain seeds on first app run (idempotent); bill on Save.
- **Update:** a bill is **fully editable in Phase 1** (no payments exist yet). **Phase 2 edit-lock rule:** once `payments.length > 0`, the bill's purchase data locks; only new payments may be added. `updatedAt` set on every write.
- **Delete:** not offered in Phase 1 (avoids accidental data loss on the tested path); a guarded delete may come later.
- **Retention:** nothing is time-boxed or archived; the ledger is permanent local history (Phase 4 adds cloud backup).

## Sensitive Data

- Farmer name/place/phone are mildly personal but low-risk; stored locally only in Phase 1.
- The **4-digit PIN (Phase 2)** is stored **hashed** (salted SHA-256) in the `meta` table — never in plaintext. It gates app access; it is not a cryptographic data-at-rest guarantee.
- Phase 4 adds a device token for sync; documented in `backend/.env.example`, never committed.
