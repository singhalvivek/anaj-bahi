# Capability: Farmer Autocomplete

_Phase 1 · slice-b (UI) + slice-a (data)_

## What It Does
As the trader types a farmer name on a new bill, suggests matching saved farmers; selecting one reuses that farmer, otherwise a quick inline form saves a new one.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| prefix | string | Farmer text input | yes |
| new farmer | { name, place, phone? } | Inline add-farmer form | when no match chosen |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| selected farmer | Farmer | Bill create state |
| saved farmer | Farmer | IndexedDB `farmers` via `upsertFarmer` |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| IndexedDB (Dexie) | `searchFarmers(prefix)` (name `startsWithIgnoreCase`), `upsertFarmer` | Visible error; keep typed value |

## Business Rules
- Suggestions match on `farmers.name` prefix, case-insensitive; show name + place to disambiguate.
- Selecting a suggestion fills farmerId/name/place/phone.
- If none selected, name + place are required (phone optional) to create a new farmer at save.
- Same-named farmers in different places are distinct records.

## Success Criteria
- [ ] Typing a saved farmer's prefix lists it within one keystroke of a unique match.
- [ ] Selecting a suggestion reuses the existing farmer (no duplicate created).
- [ ] A new farmer typed once autocompletes on the next bill.
