# Capability: Bilingual Hindi/English Toggle

_Phase 1 · slice-a (i18n lib) + slice-c (toggle UI)_

## What It Does
Provides a top-right toggle that switches the entire UI between Hindi (Devanagari) and English instantly, remembering the choice across launches.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| lang selection | 'hi' \| 'en' | Language toggle tap | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| active language | Lang | i18n context → all components via `t(key)` |
| persisted preference | string | `localStorage` key `anajbahi.lang` |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| localStorage | read/write language pref | Fall back to in-memory default `'hi'` |

## Business Rules
- All user-facing labels come from the typed dictionary via `t(key)`; no hard-coded strings in components.
- Default language is Hindi on first run.
- Numbers, ₹, kg, and dates are locale-neutral (Western digits) in both languages; only labels translate.
- Grain-type names use `nameHi`/`nameEn` per current language.
- (Phase 3 receipt honours the same active language.)

## Success Criteria
- [ ] Toggling flips every visible label immediately (no reload).
- [ ] The choice persists after closing and reopening the app.
- [ ] Every screen in Phase 1 has both Hindi and English strings (no missing-key fallbacks visible).
