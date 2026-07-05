# Capability: Create Bill

_Phase 1 · slice-b (UI) + slice-a (data)_

## What It Does
Lets the trader create and save a complete purchase bill — one farmer, a purchase date, an auto-generated `DDMMYY/xxxxx` id, and one or more grain lines — to local IndexedDB, offline.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| farmer | Farmer (existing or new) | Farmer picker / autocomplete | yes |
| purchaseDate | ISO date | Date field (defaults to today) | yes |
| lines | StoredGrainLine[] (≥1) | Grain-line editor(s) | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| bill | Bill (with generated id, denormalised farmerName/place, grainTypeIds, payments: []) | IndexedDB `bills` via `repo.createBill` |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| IndexedDB (Dexie) | `upsertFarmer`, `generateBillId`, `createBill` | Surface visible error; do not navigate away or lose entered data |

## Business Rules
- ≥1 grain line; each line needs ≥1 sack weight and `pricePerQuintal > 0`.
- Bill id per the [data.md](../data.md) rule; regenerate on collision.
- Farmer name/place and each line's grainTypeId are denormalised onto the bill at save.
- `payments` is `[]` and the bill is fully editable in Phase 1 (Phase 2 adds the edit-lock).
- No network; entire flow works offline.

## Success Criteria
- [ ] Saving with a new farmer creates both the farmer and the bill; the bill appears in the list.
- [ ] The generated id matches `DDMMYY/xxxxx` for the chosen date.
- [ ] Reopening the saved bill shows identical farmer, lines, sacks, deductions, and totals.
- [ ] Save is blocked (with an inline hint) until a farmer, ≥1 line, ≥1 sack, and a positive price are present.
